#!/usr/bin/env python3
"""Distill the SWE Morph Bench trajectory corpus into the small files the site ships.

The corpus is 520 JSONL files / 333 MB and lives on the CDN -- far too big for the
repository. What the pages need is (a) the score table, which is small, and (b) a
per-run *summary* of each trajectory: how long it ran, how many tool calls, what
mix of tools, where the errors landed. That is a few hundred bytes per run, so all
520 fit in one JSON.

Run this only when the corpus changes:

    python3 scripts/swemorph-build-data.py --oss /path/to/corpus

Outputs (both committed, both small):
    public/swe-morph-bench/data/scores_by_cell.csv   verbatim copy of the score table
    public/swe-morph-bench/data/runs.json            per-run trajectory summaries

The corpus is opened read-only and nothing here touches the network.

WHY THIS IS FUSSIER THAN IT LOOKS
---------------------------------
The two harnesses do not record the same things, so a naive summary would report
"0" for quantities one of them simply never logs. Measured over all 520 files:

  * `user` records exist only in claude-code (154,385 of them; codex has none).
    Tool *results* -- and therefore tool *errors* -- are unobservable for codex.
    So n_tool_err is null for codex, never 0.
  * `assistant.content_type == "thinking"` exists only in claude-code (46,951
    records). Thinking volume is null for codex, never 0.
  * codex tool records carry no `at` timestamp at all, so there is no wall-clock
    timeline for those runs. `round` is universal, so the run shape is derived
    from the tool *sequence* instead, which both harnesses support.
  * codex logs `arguments_raw` (a JS call as a string) for 96.6% of calls and a
    real `arguments` dict for only 3.4%; claude-code logs a dict for 99.9%.
  * `end.outcome` is claude-code-only, `end.stop_reason` is codex-only, but
    `start.stop_reason` carries the same value in both and covers 520/520 -- so
    that is the field the site reads.
  * `rounds` means different things: for claude-code it counts agent-loop rounds,
    for codex it counts codex turns and the loop-round count is a *separate*
    field, `loop_rounds`, which differs in all 240 codex files (and is missing in
    18). Both are kept, each labelled with its own unit, and the site never puts
    them on one axis.

Tool names are mapped to shared categories because the vocabularies barely
overlap: claude-code spreads work over Bash/Read/Edit/Write, while codex routes
96.6% of everything through `exec` and does its file edits as shell commands
inside it. Categories make the two comparable at all; the raw counts are kept in
`top_tools` so nothing is hidden. Even so, tool mix is only ever reported
per-harness on the site -- pooling it would attribute the scaffold's shape to the
model.
"""
import argparse
import collections
import csv
import datetime as dt
import json
import os
import sys

# Complete as of the released corpus: a census over all 520 files finds exactly
# 17 tool names under claude-code and 7 under codex-cli, all listed here. Any
# name added by a future harness falls through to "other" and is reported.
TOOL_CATEGORY = {
    # claude-code (154,301 calls)
    "Bash": "shell",
    "Read": "read",
    "Edit": "edit",
    "Write": "edit",
    "NotebookEdit": "edit",
    "Glob": "search",
    "Grep": "search",
    "TaskCreate": "task",
    "TaskUpdate": "task",
    "TaskList": "task",
    "TaskGet": "task",
    "TaskOutput": "task",
    "TaskStop": "task",
    "Agent": "agent",
    "SendMessage": "agent",
    "Skill": "agent",
    "invoke": "agent",
    "WebSearch": "web",
    "WebFetch": "web",
    "ScheduleWakeup": "other",
    # codex-cli (93,690 calls). `exec` is a shell call and is also how codex
    # edits files, which is why the site never pools tool mix across harnesses.
    "exec": "shell",
    "wait": "other",
    "wait_agent": "other",
    "send_message": "agent",
    "spawn_agent": "agent",
    "list_agents": "agent",
    "followup_task": "task",
}
CATEGORIES = ["shell", "read", "edit", "search", "task", "agent", "web", "other"]
# One letter per category, for the compact run-shape strip.
LETTER = {"shell": "s", "read": "r", "edit": "e", "search": "f",
          "task": "t", "agent": "a", "web": "w", "other": "o"}
SHAPE_BINS = 24


def parse_ts(s):
    """ISO-8601, spelled both `...Z` and `...+00:00` in the corpus."""
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def summarize(path):
    """One trajectory -> a compact summary. Streaming, read-only.

    Quantities a harness does not record come back as None, not 0.
    """
    start = end = None
    kinds = collections.Counter()
    cats = collections.Counter()
    raw_tools = collections.Counter()
    seq = []                      # category of each tool call, in order
    stamps = []                   # tool timestamps, when the harness logs them
    n_tool_err = 0
    n_tool_result = 0
    n_think = 0
    think_chars = 0
    assist_chars = 0
    assist_text_chars = 0
    result_chars = 0
    arg_chars = 0
    n_args_dict = 0
    n_args_raw = 0
    n_compaction = 0
    tools_by_round = collections.Counter()
    rounds_seen = set()
    usage_rounds = []             # each round's own usage record, in order
    lines = 0
    unknown = set()

    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            lines += 1
            d = json.loads(line)
            kind = d.get("kind")
            kinds[kind] += 1

            if kind == "start":
                start = d
            elif kind == "end":
                end = d
            elif kind == "tool":
                name = d.get("name")
                raw_tools[name] += 1
                cat = TOOL_CATEGORY.get(name)
                if cat is None:
                    cat = "other"
                    unknown.add(name)
                cats[cat] += 1
                seq.append(cat)
                if d.get("at"):
                    stamps.append(d["at"])
                args = d.get("arguments")
                if isinstance(args, dict):
                    n_args_dict += 1
                    arg_chars += len(json.dumps(args, ensure_ascii=False))
                elif isinstance(d.get("arguments_raw"), str):
                    n_args_raw += 1
                    arg_chars += len(d["arguments_raw"])
                r = d.get("round")
                if isinstance(r, int):
                    tools_by_round[r] += 1
            elif kind == "user":
                # claude-code only; role is "tool_result" or "instruction"
                if d.get("role") == "tool_result":
                    n_tool_result += 1
                    if d.get("is_error"):
                        n_tool_err += 1
                result_chars += d.get("chars") or 0
            elif kind == "assistant":
                if d.get("content_type") == "thinking":
                    n_think += 1
                    think_chars += d.get("thinking_chars") or 0
                else:
                    assist_chars += d.get("chars") or 0
                    assist_text_chars += len(d.get("text") or "")
            elif kind == "system":
                if d.get("event") == "context-compacted":
                    n_compaction += 1
            elif kind == "round":
                u = d.get("usage")
                if isinstance(u, dict):
                    usage_rounds.append(u)

            r = d.get("round")
            if isinstance(r, int):
                rounds_seen.add(r)

    if start is None:
        raise ValueError(f"{os.path.basename(path)}: no start record")

    harness_full = start.get("harness") or ""
    harness = harness_full.split()[0] if harness_full else "unknown"
    is_cc = harness == "claude-code"

    # Token usage. Two harnesses, two bases, and the file says which.
    #
    # claude-code writes `usage_basis: "round"`: each round record is that
    # invocation's own usage, so the rounds are summed.
    #
    # codex-cli writes `usage_basis: "cumulative"`, and every codex start record
    # spells out what that means in `usage_basis_note`: the total is cumulative
    # within one codex *session*, but the driver may start a new session mid-run,
    # which resets the counter. Sum the last value of each session segment. The
    # note explicitly rules out both of the easy readings -- do not take the final
    # round alone, and do not sum every round. Summing every round overstates
    # codex by ~69x; taking the final round alone undercounts any run that
    # restarted, by up to 16.9x on `fw04__gpt-5.6-sol__none`.
    #
    # A segment boundary is a *drop* in the running total. A round that logs no
    # usage is not a boundary: `lang01__gpt-5.6-luna__low` has 8 such gaps across
    # 1454 rounds and its counter climbs through every one of them, so segmenting
    # on gaps would double-count 1.5B tokens on that file alone. Measured over the
    # 240 codex runs there are 6 drops, in 5 files, and every one sits immediately
    # after a gap. `output_tokens` corroborates: generated tokens cannot carry into
    # a fresh process, and output drops exactly 6 times, in exactly those 5 files.
    #
    # `loop_rounds` counts agent-loop rounds, not sessions -- it is >= 2 in 236 of
    # 240 runs while only 5 runs ever reset, because codex normally resumes the
    # same session across loop rounds.
    #
    # Not corrected here, because it is not detectable: a new session whose first
    # record already exceeds the old session's last would leave no drop to find.
    # That needs a resumption that climbs, of which the corpus has 9, 8 of them in
    # the one file above whose counter is monotone throughout.
    #
    # Verified against the score table: input + output equals `agent_tokens` for
    # 515 of 520 runs. The exceptions are the 5 reset runs, where the released
    # column was reduced the old way and is short by a total of 11,621,574 tokens
    # ($9.73 of the campaign's $16,943, and $59.49 of the uncached ceiling, whose
    # rate is ten times higher). The corpus note is the authority, so those 5 are
    # corrected here and asserted by name in the checks; no ranking moves on
    # either axis.
    #
    # Do not use the `cost_usd` field on these records. It is computed from
    # `client_session_usage`, which the corpus documents as spanning earlier rounds
    # under `--continue` and including the client's own compaction calls, so it is
    # not this round's cost and is not summable. It is also priced with the
    # client's own rate table regardless of which model was served, which puts it
    # ~$5/Mtok for every system including ones listed at $0.22.
    usage = None
    n_sessions = None
    if usage_rounds:
        basis = start.get("usage_basis")
        if basis == "cumulative":
            # Split where the running total drops, then add up each segment's last
            # record. A segment is monotone by construction, so its last value is
            # also its maximum.
            def _running(u):
                return (u.get("input_tokens") or 0) + (u.get("output_tokens") or 0)

            segments = [[usage_rounds[0]]]
            for u in usage_rounds[1:]:
                if _running(u) < _running(segments[-1][-1]):
                    segments.append([u])
                else:
                    segments[-1].append(u)
            n_sessions = len(segments)
            acc = collections.Counter()
            for seg in segments:
                for k, v in seg[-1].items():
                    if isinstance(v, (int, float)):
                        acc[k] += v
            usage = dict(acc)
        else:
            acc = collections.Counter()
            for u in usage_rounds:
                for k, v in u.items():
                    if isinstance(v, (int, float)):
                        acc[k] += v
            usage = dict(acc)
        usage["basis"] = basis

    # Run shape: SHAPE_BINS characters, each the dominant tool category in that
    # slice of the tool sequence. Derived from sequence position, not time, so it
    # works for codex too (which logs no timestamps).
    shape = ""
    if seq:
        n = len(seq)
        for b in range(SHAPE_BINS):
            lo = b * n // SHAPE_BINS
            hi = max(lo + 1, (b + 1) * n // SHAPE_BINS)
            chunk = seq[lo:hi]
            if chunk:
                dom = collections.Counter(chunk).most_common(1)[0][0]
                shape += LETTER[dom]

    # Wall-clock span of tool activity, only where timestamps exist.
    tool_span_sec = None
    if len(stamps) > 1:
        stamps.sort()
        tool_span_sec = round((parse_ts(stamps[-1]) - parse_ts(stamps[0])).total_seconds(), 1)

    wall_sec = None
    if start.get("started_at") and start.get("finished_at"):
        wall_sec = round(
            (parse_ts(start["finished_at"]) - parse_ts(start["started_at"])).total_seconds(), 1)

    # `rounds` is not one quantity across harnesses. claude-code's `rounds`
    # counts agent-loop rounds; codex's counts codex turns and carries the
    # loop-round count separately in `loop_rounds` (absent in 18 files). Keep
    # both, name the unit, and let the page decide -- never one shared axis.
    n = {
        "task": start.get("task"),
        "model": start.get("model"),
        "effort": start.get("reasoning_effort"),
        "run_id": start.get("run_id"),
        "harness": harness,
        "harness_version": harness_full.split()[-1] if harness_full else None,
        # universal: identical to end.outcome (claude-code) / end.stop_reason (codex)
        "stop_reason": start.get("stop_reason"),
        "validity": start.get("validity"),
        "started_at": start.get("started_at"),
        "finished_at": start.get("finished_at"),
        "wall_sec": wall_sec,
        "budget_sec": start.get("budget_sec"),
        "max_turns": start.get("max_turns"),
        "bytes": os.path.getsize(path),
        "records": lines,
        "rounds": start.get("rounds"),
        "rounds_unit": start.get("rounds_unit") or ("agent-loop round" if is_cc else None),
        "loop_rounds": start.get("rounds") if is_cc else start.get("loop_rounds"),
        "n_tool": cats.total() if hasattr(cats, "total") else sum(cats.values()),
        "n_assistant": kinds.get("assistant", 0),
        "n_nudge": kinds.get("nudge", 0),
        "n_compaction": n_compaction,
        "tools": {c: cats[c] for c in CATEGORIES if cats[c]},
        "top_tools": dict(raw_tools.most_common(6)),
        "shape": shape,
        "arg_chars": arg_chars,
        "tool_span_sec": tool_span_sec,
        # --- recorded by claude-code only; None means "not logged", not zero ---
        "n_tool_result": n_tool_result if is_cc else None,
        "n_tool_err": n_tool_err if is_cc else None,
        "n_thinking": n_think if is_cc else None,
        "think_chars": think_chars if is_cc else None,
        "result_chars": result_chars if is_cc else None,
        "assist_chars": (assist_chars if is_cc else assist_text_chars),
        "assist_chars_basis": "declared" if is_cc else "measured from text",
        # --- token usage, normalized across the two harnesses ---
        # `cache_read` is the discounted-input count both vendors bill at a
        # fraction of the input rate. `cache_write` is Anthropic-only (codex does
        # not bill a separate write). `reasoning_out` is codex-only and is a
        # subset of `output`, not an addition to it. A null is "not recorded".
        "usage": None if usage is None else {
            "basis": usage.get("basis"),
            "input": usage.get("input_tokens"),
            "output": usage.get("output_tokens"),
            "cache_read": usage.get("cache_read_input_tokens" if is_cc else "cached_input_tokens"),
            "cache_write": usage.get("cache_creation_input_tokens") if is_cc else None,
            "input_uncached": (usage.get("input_tokens_uncached") if is_cc else
                               (usage.get("input_tokens", 0) - usage.get("cached_input_tokens", 0))),
            "reasoning_out": None if is_cc else usage.get("reasoning_output_tokens"),
            # How many codex sessions the run's counter spans, so the reduction is
            # auditable from the shipped file. 1 for all but 5 runs; null for
            # claude-code, whose per-round basis has no sessions to count.
            "sessions": n_sessions,
        },
        "_unknown": sorted(unknown),
    }
    return n


FAMILY = {"build": "Build toolchain", "fw": "Framework",
          "lang": "Language", "pf": "Platform"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--oss", required=True,
                    help="directory holding the 520 .jsonl files and scores_by_cell.csv")
    ap.add_argument("--out", default=None,
                    help="output dir (default: ../public/swe-morph-bench/data)")
    args = ap.parse_args()

    oss = os.path.abspath(args.oss)
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.abspath(args.out or os.path.join(
        here, "..", "public", "swe-morph-bench", "data"))
    os.makedirs(out, exist_ok=True)

    table = os.path.join(oss, "scores_by_cell.csv")
    if not os.path.exists(table):
        sys.exit(f"missing {table}")
    with open(table, newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    print(f"score table: {len(rows)} rows x {len(rows[0])} columns")

    dest_csv = os.path.join(out, "scores_by_cell.csv")
    with open(table, "rb") as src, open(dest_csv, "wb") as dst:
        dst.write(src.read())
    print(f"wrote {dest_csv} ({os.path.getsize(dest_csv)/1e3:.1f} kB)")

    summaries = {}
    unknown_all = set()
    missing = []
    for i, r in enumerate(rows, 1):
        p = os.path.join(oss, r["file"])
        if not os.path.exists(p):
            missing.append(r["file"])
            continue
        s = summarize(p)
        unknown_all.update(s.pop("_unknown"))
        # The trajectory header must agree with the score table on all three keys.
        for key, col in (("task", "task"), ("model", "model"), ("effort", "effort")):
            if s[key] != r[col]:
                sys.exit(f"{r['file']}: header {key}={s[key]!r} != table {col}={r[col]!r}")
        summaries[r["file"]] = s
        if i % 100 == 0:
            print(f"  ... {i}/{len(rows)}")

    if missing:
        sys.exit(f"{len(missing)} trajectory file(s) missing, e.g. {missing[:3]}")
    if unknown_all:
        print(f"note: unmapped tool name(s) -> 'other': {sorted(unknown_all)}")

    by_harness = collections.Counter(s["harness"] for s in summaries.values())
    print(f"harness split: {dict(by_harness)}")

    payload = {
        "schema": "swemorph.run-summaries/1",
        "generated_from": "repomorph.agent-trajectory/1",
        "n_runs": len(summaries),
        "shape_bins": SHAPE_BINS,
        "shape_legend": {v: k for k, v in LETTER.items()},
        "categories": CATEGORIES,
        "notes": {
            "tool_mix": ("Tool names are normalized into categories because the two "
                         "harnesses share almost no vocabulary: claude-code spreads work "
                         "over Bash/Read/Edit/Write while codex-cli routes 96.6% of calls "
                         "through `exec` and edits files with shell commands inside it. "
                         "Report tool mix per harness only."),
            "nulls": ("null means the harness does not record the quantity, not zero. "
                      "codex-cli logs no tool results, so tool errors and result volume "
                      "are unobservable there; it logs no thinking blocks either."),
            "rounds": ("`rounds` is harness-native: agent-loop rounds for claude-code, "
                       "codex turns for codex-cli. `loop_rounds` is the comparable "
                       "agent-loop count and is null for 18 codex runs."),
            "usage": ("Token counts are the harness's own per-round `usage` records, "
                      "reduced on the basis each file declares: summed for claude-code "
                      "(`usage_basis: round`); for codex-cli (`usage_basis: cumulative`) "
                      "the counter is cumulative within a session and resets when the "
                      "driver starts a new one, so the series is split where it drops and "
                      "each segment's last value is added, per the `usage_basis_note` the "
                      "corpus carries on every codex run. `sessions` reports how many "
                      "segments were found. input+output equals the score table's "
                      "`agent_tokens` for 515 of 520 runs; the 5 exceptions are runs whose "
                      "counter reset, where the released column took the final round alone "
                      "and is short by 11,621,574 tokens in total. `cache_write` is Anthropic-only. "
                      "`reasoning_out` is codex-only and is part of `output`, not extra. "
                      "Three models record no cache reads at all (dsv4-flash and "
                      "qwen3.8-max in 20/20 runs, glm-5.2 in 19/20); per the nulls note "
                      "that is 'not recorded', which is not the same as 'not cached'."),
            "shape": (f"{SHAPE_BINS} characters, each the dominant tool category over that "
                      "slice of the tool sequence. Sequence-based, not time-based, because "
                      "codex records no timestamps."),
        },
        "runs": summaries,
    }
    dest = os.path.join(out, "runs.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"), sort_keys=True)
    print(f"wrote {dest} ({os.path.getsize(dest)/1e3:.1f} kB) for {len(summaries)} runs")


if __name__ == "__main__":
    main()
