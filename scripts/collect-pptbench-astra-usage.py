"""Run with the benchmark Python (-P) to export selected-generation usage.

Usage: python -P collect-pptbench-astra-usage.py REPO OUTPUT_JSON
Only reads frozen results. Does not call models or load credentials.
Costs are Standard-rate token estimates, not provider invoices. Invocation
totals span multiple API requests, so long-context surcharges cannot be inferred.
"""
import argparse
import datetime
import hashlib
import json
from pathlib import Path

from eval_harness.usage import ledger_from_invocation_paths, aggregate_usage_ledger


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    repo = args.repo.resolve()
    out = repo / "results/astra-20260910-aws"
    expected = {t.strip() for t in (repo / "configs/taskset.txt").read_text().splitlines()
                if t.strip() and not t.lstrip().startswith("#")}
    assert len(expected) == 500
    rows, evidence = [], []
    seen_paths = set()
    for effort in ("low", "medium", "high", "xhigh", "max"):
        summary = json.loads((out / f"generation/rollout-driver/codex/gpt-6-astra/{effort}/summary.json").read_text())
        cases = summary["cases"]
        assert len(cases) == 500 and {c["task_id"] for c in cases} == expected
        totals = {}
        missing, valid, invalid, over_threshold, cache_writes = 0, 0, 0, 0, 0
        for case in cases:
            if case["status"] == "complete":
                run = json.loads(Path(case["result_path"]).read_text())
                valid += 1
            else:
                assert case["failure_kind"] == "artifact" and case["retryable"] is False
                artifact = json.loads(Path(case["artifact_run_path"]).read_text())
                assert len(artifact["cases"]) == 1
                run = artifact["cases"][0]
                invalid += 1
            assert run["sample_id"] == case["task_id"]
            if "turns" in run:
                turns = run["turns"]
                assert len(turns) == 1 and turns[0]["role"] == "generator"
                path = Path(turns[0]["invocation_path"]).resolve()
            else:
                # Early artifact validation failures retain the invocation but
                # only the usage summary in the top-level case record.
                assert case["failure_kind"] == "artifact"
                paths = list(Path(case["artifact_run_path"]).parent.glob(
                    "case-0000/agent_run/turns/generator-*/invocation.json"))
                assert len(paths) == 1
                path = paths[0].resolve()
            assert path not in seen_paths
            seen_paths.add(path)
            invocation = json.loads(path.read_text())
            assert invocation["model"] == "gpt-6-astra" and invocation["reasoning_effort"] == effort
            assert invocation["session_mode"] == "start"
            usage = aggregate_usage_ledger(ledger_from_invocation_paths([path]))
            assert usage["overall"] == run["usage"]["overall"]
            missing += usage["usage_missing_call_count"]
            counters = usage["overall"]
            for key, value in counters.items():
                totals[key] = totals.get(key, 0) + value
            over_threshold += counters["input_tokens"] > 272000
            writes = invocation.get("usage", {}).get("cache_write_input_tokens", 0)
            assert type(writes) is int and 0 <= writes <= counters["uncached_input_tokens"]
            cache_writes += writes
            evidence.append({"effort": effort, "task_id": case["task_id"],
                             "invocation": str(path.relative_to(repo)),
                             "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                             "usage": {**counters, "cache_write_input_tokens": writes}})
        # Cached input is a subset of input; reasoning is a subset of output.
        cost = (totals["uncached_input_tokens"] * 10 + totals["cached_input_tokens"]
                + cache_writes * 2.5 + totals["output_tokens"] * 50) / 1_000_000
        rows.append({"candidateId": f"gpt-6-astra__{effort}__codex", "taskCount": 500,
                     "validArtifacts": valid, "invalidArtifacts": invalid, "failedTasks": 0,
                     **totals, "totalTokens": totals["total_tokens"],
                     "averageTokensPerTask": totals["total_tokens"] / 500,
                     "totalCostUsd": round(cost, 6), "averageCostPerTaskUsd": round(cost / 500, 8),
                     "usageStatus": "complete" if missing == 0 else "lower_bound_missing_usage",
                     "missingUsageCalls": missing, "cacheWriteTokens": cache_writes,
                     "invocationsAboveLongContextThreshold": over_threshold})
    report = {"checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "scope": "selected generation per task, including artifact failures; excludes judge calls and unselected retries",
              "pricing": {"currency": "USD", "basis": "standard_rate_token_estimate",
                          "perMillion": {"uncachedInput": 10, "cachedInput": 1, "cacheWrite": 12.5, "output": 50},
                          "verifiedOn": "2026-09-17",
                          "sources": ["https://developers.openai.com/api/docs/models/gpt-6-astra",
                                      "https://openrouter.ai/openai/gpt-6-astra"],
                          "limitation": "No provider invoice or per-request context sizes; excludes long-context surcharges, service-tier adjustments and tool fees."},
              "configurations": rows}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    args.output.with_suffix(".evidence.json").write_text(json.dumps(evidence, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
