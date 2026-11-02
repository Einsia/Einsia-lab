"""Build the public DiabAgent data from the Main212 experiment records.

Offline preparation only: normal site builds use the committed output.

    python3 -I scripts/build-diabagent-data.py <main212-dir>

<main212-dir> holds 02_trajectories/CATALOGUE.json, 02_trajectories/SUMMARY.json
and <model>/<task>/run.json for the five models. Writes:

    src/data/diabagent/leaderboard.json   standings, group and cohort means
    src/data/diabagent/tasks.json         32 templates and 212 task instances
    public/diabagent/runs/<task>.json.gz  one task, all five trajectories

Only published fields are kept: true and sensor glucose, hidden events, actions
with their stated rationale, and scores. Raw transcripts, prompts, simulator
parameters and host paths stay out. Any rationale that mentions a host path or
looks like a credential stops the build.
"""
import datetime
import gzip
import json
import re
import statistics
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DATA_OUT = REPO / "src/data/diabagent"
RUNS_OUT = REPO / "public/diabagent/runs"

MODELS = [
    dict(id="opus55", name="Claude Opus 5.5", harness="Claude Code", color="#E07B4F"),
    dict(id="gpt61", name="GPT 6.1 Sol", harness="Codex CLI", color="#5E8CA8"),
    dict(id="deepseek41", name="DeepSeek 4.1 Flash", harness="Claude Code", color="#2FA59A"),
    dict(id="kimi31", name="Kimi K3.1 Pro", harness="Claude Code", color="#7E9F3A"),
    dict(id="glm53flash", name="GLM 5.3 Flash", harness="Claude Code", color="#D9578E"),
]
MODEL_IDS = [m["id"] for m in MODELS]

# Paper table: simulated baselines under the same decision schedule.
BASELINES = [
    dict(name="Simulated HCL", score=66.87, tir=46.39, hypo=91.79, gv=76.98),
    dict(name="Simulated oref1", score=63.20, tir=38.86, hypo=92.96, gv=74.93),
    dict(name="Guideline rules", score=60.06, tir=36.08, hypo=88.99, gv=72.53),
    dict(name="Standard care", score=58.54, tir=30.33, hypo=92.21, gv=74.02),
    dict(name="Patient self-management", score=55.13, tir=24.21, hypo=91.52, gv=73.29),
    dict(name="Wait (no additional action)", score=54.54, tir=23.36, hypo=91.03, gv=73.32),
]

GROUPS = [
    dict(id="A", name="Meal timing and absorption", line="Meals that arrive late, overlap, or never arrive after the dose."),
    dict(id="B", name="Insulin from earlier doses", line="Earlier doses still acting when the next decision is due."),
    dict(id="C", name="Exercise", line="Activity quietly pulls glucose down while the agent sees only the fall."),
    dict(id="D", name="Changing insulin needs", line="Stress, sleep loss and dawn change what a unit of insulin does."),
    dict(id="E", name="Pump under-delivery", line="The pump reports a dose that never fully reaches the body."),
    dict(id="F", name="Sensor errors", line="The reading itself drifts, gaps or lies."),
    dict(id="H", name="Illness and recovery", line="Insulin needs and appetite recover on different clocks."),
]

# Paper appendix: every template and its event combination.
TEMPLATES = {
    "A01": "Repeated small intakes overlapping a slowly absorbed main meal",
    "A02": "Two slow-meal tails overlapping subsequent intake",
    "A03": "A meal cancelled after pre-bolusing, followed by activity",
    "A04": "Breakfast cancelled after a meal bolus, followed by prolonged fasting",
    "B01": "Repeated dosing after a small meal; absorption ends while insulin effects overlap",
    "B02": "Activity and small meals after earlier stacked doses",
    "B03": "Remaining extended delivery after a cancelled meal, with delayed replacement intake",
    "B04": "Rescue carbohydrate still absorbing while the main meal is delayed",
    "C01": "Two activity bouts interleaved with replenishment and meals",
    "C02": "A transient increase in hepatic glucose output followed by aerobic activity",
    "C03": "Delayed effects of evening activity and alcohol",
    "C04": "Breakfast and lunch skipped during prolonged aerobic activity",
    "D01": "Two short stress episodes resolving before subsequent activity",
    "D02": "Insulin needs returning after sleep loss and the dawn phenomenon",
    "D03": "Dawn-related needs receding during slow breakfast absorption and later fast intake",
    "D04": "Sleep-loss-related needs recovering during lunch absorption and later intake",
    "D05": "Two post-meal stress episodes resolving during slow and fast intake",
    "D06": "A slow overnight meal tail overlapping delayed alcohol effects and next-morning intake",
    "E01": "Silent under-delivery overlapping multiple meals",
    "E02": "Three intermittent under-delivery episodes with irregular meals",
    "E03": "Active repair of under-delivery followed by activity",
    "E04": "Silent under-delivery combined with progressively false-high sensor readings",
    "F01": "An activity-related glucose fall combined with false-high sensor readings",
    "F02": "Real post-meal glucose input combined with false-low sensor readings",
    "F03": "Meals and activity around a sensor-signal gap",
    "F04": "Illness recovery combined with incorrect calibration and sensor drift",
    "F05": "Calibration expiry with residual slow-meal absorption and recent dosing",
    "F06": "Missed meals and exercise causing low glucose, masked by positive sensor bias",
    "H01": "Repeated meals during illness; slow absorption persists into recovery",
    "H02": "Reduced intake during illness with pre-episode slow absorption and recent treatment",
    "H03": "Insulin needs recover before appetite; slow lunch absorption precedes fast intake",
    "H04": "Illness with under-delivery requiring repair, followed by recovery of insulin needs",
}

COHORTS = [("child", "Children, 9 y"), ("adolescent", "Adolescents, 15 y"), ("adult", "Adults, 39 y"), ("older", "Older adults, 70 y")]
PERSON_NOUN = {
    ("child", "male"): "Boy",
    ("child", "female"): "Girl",
    ("adolescent", "male"): "Teen boy",
    ("adolescent", "female"): "Teen girl",
    ("adult", "male"): "Man",
    ("adult", "female"): "Woman",
    ("older", "male"): "Older man",
    ("older", "female"): "Older woman",
}

# Event types drawn in the hidden lane. Free-text records are dropped: under the
# main evaluation's information condition (I2) they never reach the agent either.
LANE_EVENTS = {
    "meal", "exercise", "stress", "illness", "sleep_loss", "alcohol", "alcohol_effect",
    "infusion_deficit", "sensor_drift", "sensor_calibration_error",
}
FORBIDDEN = re.compile(r"/mnt/|/home/|\bsk-[A-Za-z0-9]{16}|api[_ -]?key", re.I)

LOW, HIGH = 72.064, 144.128


def cogi(samples):
    """COGI-4-8 of a list of true-glucose samples (paper, Metrics)."""
    n = len(samples)
    tir = 100 * sum(LOW <= v <= HIGH for v in samples) / n
    tbr = 100 * sum(v < 70 for v in samples) / n
    mean = sum(samples) / n
    sd = (sum((v - mean) ** 2 for v in samples) / n) ** 0.5
    hypo = 100 * min(1, max(0, 1 - tbr / 15))
    gv = 100 * min(1, max(0, (108 - sd) / 90))
    return 0.5 * tir + 0.35 * hypo + 0.15 * gv


def round1(value):
    return round(value, 1)


def local_start_minute(run):
    """Minute of the local day at which the episode starts."""
    start = datetime.datetime.strptime(run["start"], "%Y-%m-%dT%H:%M:%S.%fZ")
    return (start.hour * 60 + start.minute + run["utc_offset_minutes"]) % 1440


def compact_run(run, entry, stats, reward):
    truth = [v for _, v in run["truth"]]
    # The recorded daily reward wins; a few runs lack the file, so recompute those.
    daily = [
        round1(reward[f"day_{d + 1}_reward"])
        if f"day_{d + 1}_reward" in reward
        else round1(cogi([v for m, v in run["truth"] if d * 1440 < m <= (d + 1) * 1440]))
        for d in range(3)
    ]
    cgm = {m: v for m, v, source in run["readings"] if source == "cgm"}
    scheduled = run["profile"]["basal"]
    series = run["series"]["basal"]
    rates = dict((m, rate) for m, rate in series)
    basal, last = [], None
    for m, rate in series:
        pct = round(100 * rate / scheduled / 5) * 5
        if pct != last:
            basal.append([m, pct])
            last = pct
    acts = []
    for m, kind, dose, why in run["treatments"]:
        why = (why or "").strip()
        if FORBIDDEN.search(why):
            raise SystemExit(f"Rationale needs review: {why[:160]!r}")
        if kind == "TEMP_BASAL":
            rate = rates.get(m + 5)
            dose = round(100 * rate / scheduled / 5) * 5 if rate is not None else None
        acts.append([m, kind, dose, why])
    metrics = run["metrics"]
    return dict(
        score=round(entry["score"], 2),
        tir=round1(entry["s_tir"]),
        hypo=round1(entry["s_hypo"]),
        gv=round1(entry["s_gv"]),
        below=round1(100 * metrics["tbr"]),
        daily=daily,
        decisions=stats.get("decisions"),
        truth=truth,
        cgm=[cgm.get(5 * i) for i in range(1, 865)],
        meter=[[m, v] for m, v, source in run["readings"] if source != "cgm"],
        basal=basal,
        acts=acts,
    )


def lane_events(run):
    out = []
    for event in run["events"]:
        if event["type"] in LANE_EVENTS:
            out.append([event["m"], event.get("end"), event["type"], event.get("grams")])
    return out


def main():
    source = Path(sys.argv[1]) / "02_trajectories"
    catalogue = json.loads((source / "CATALOGUE.json").read_text())
    summary = {row["model_id"]: row for row in json.loads((source / "SUMMARY.json").read_text())}
    by_task = {}
    for entry in catalogue:
        by_task.setdefault(entry["task_id"], {})[entry["model_id"]] = entry
    assert len(by_task) == 212, len(by_task)
    assert all(set(models) == set(MODEL_IDS) for models in by_task.values())

    DATA_OUT.mkdir(parents=True, exist_ok=True)
    RUNS_OUT.mkdir(parents=True, exist_ok=True)
    for stale in RUNS_OUT.glob("*.json.gz"):
        stale.unlink()

    instances = []
    written = 0
    for task_id, entries in sorted(by_task.items()):
        runs = {m: json.loads((source / m / task_id / "run.json").read_text()) for m in MODEL_IDS}
        lead = runs["opus55"]
        person = lead["person"]
        template = task_id[:3].upper()
        assert template in TEMPLATES, template
        key = f"{task_id[:3]}-{person['group']}-{person['sex']}"
        compact = {}
        for m in MODEL_IDS:
            stats_path = source / m / task_id / "raw/stats.json"
            stats = json.loads(stats_path.read_text()) if stats_path.exists() else {}
            reward_path = source / m / task_id / "raw/native-reward.json"
            reward = json.loads(reward_path.read_text()) if reward_path.exists() else {}
            compact[m] = compact_run(runs[m], entries[m], stats, reward)
            assert abs(runs[m]["metrics"]["score"] - entries[m]["score"]) < 1e-6
            assert lane_events(runs[m]) == lane_events(lead), f"{task_id}: hidden events differ"
        noun = PERSON_NOUN[(person["group"], person["sex"])]
        payload = dict(
            key=key,
            template=template,
            title=TEMPLATES[template],
            person=dict(label=f"{noun}, {person['age']} y", age=person["age"], weight=person["weight"]),
            start=local_start_minute(lead),
            target=[72, 144],
            events=lane_events(lead),
            runs=compact,
        )
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
        (RUNS_OUT / f"{key}.json.gz").write_bytes(gzip.compress(raw, 9, mtime=0))
        written += 1
        scores = {m: round(entries[m]["score"], 1) for m in MODEL_IDS}
        instances.append(
            dict(
                key=key,
                template=template,
                group=template[0],
                cohort=person["group"],
                label=payload["person"]["label"],
                scores=scores,
                best=max(MODEL_IDS, key=lambda m: entries[m]["score"]),
                events=payload["events"],
            )
        )

    assert len({row["key"] for row in instances}) == 212

    def mean_score(rows, model):
        return round(statistics.mean(by_task_key[row["key"]][model]["score"] for row in rows), 2)

    by_task_key = {}
    for task_id, entries in by_task.items():
        person_key = next(row["key"] for row in instances if row["key"].startswith(task_id[:3]) and task_id[4:].startswith(row["key"][4:] + "-"))
        by_task_key[person_key] = entries

    standings = []
    for model in MODELS:
        rows = [by_task_key[row["key"]][model["id"]] for row in instances]
        entry = dict(
            **model,
            score=round(statistics.mean(r["score"] for r in rows), 2),
            tir=round(statistics.mean(r["s_tir"] for r in rows), 2),
            hypo=round(statistics.mean(r["s_hypo"] for r in rows), 2),
            gv=round(statistics.mean(r["s_gv"] for r in rows), 2),
            wins=sum(row["best"] == model["id"] for row in instances),
            scores=sorted(row["scores"][model["id"]] for row in instances),
        )
        assert abs(entry["score"] - summary[model["id"]]["score"]) < 0.01, model["id"]
        standings.append(entry)

    groups = []
    for group in GROUPS:
        rows = [row for row in instances if row["group"] == group["id"]]
        groups.append(
            dict(
                **group,
                tasks=len(rows),
                templates=len({row["template"] for row in rows}),
                scores={m: mean_score(rows, m) for m in MODEL_IDS},
            )
        )
    cohorts = []
    for cohort, name in COHORTS:
        rows = [row for row in instances if row["cohort"] == cohort]
        cohorts.append(dict(id=cohort, name=name, tasks=len(rows), scores={m: mean_score(rows, m) for m in MODEL_IDS}))

    templates = []
    for template, title in TEMPLATES.items():
        rows = sorted((row for row in instances if row["template"] == template), key=lambda r: -r["scores"]["opus55"])
        scores = {m: mean_score(rows, m) for m in MODEL_IDS}
        templates.append(
            dict(
                id=template,
                group=template[0],
                title=title,
                tasks=len(rows),
                scores=scores,
                best=max(MODEL_IDS, key=lambda m: scores[m]),
                instances=[{k: row[k] for k in ("key", "label", "cohort", "scores", "best")} for row in rows],
                events=rows[0]["events"],
                eventsFrom=rows[0]["label"],
            )
        )

    (DATA_OUT / "leaderboard.json").write_text(
        json.dumps(dict(models=standings, baselines=BASELINES, groups=groups, cohorts=cohorts), indent=1) + "\n"
    )
    (DATA_OUT / "tasks.json").write_text(
        json.dumps(dict(groups=GROUPS, templates=templates), separators=(",", ":")) + "\n"
    )

    total = sum(p.stat().st_size for p in RUNS_OUT.glob("*.json.gz"))
    top = max(((e["score"], m, t) for t, models in by_task.items() for m, e in models.items()))
    print(f"{written} task files, {total / 1e6:.1f} MB; templates {len(templates)}; best single run {top}")
    for row in standings:
        print(row["name"], row["score"], "wins", row["wins"])


if __name__ == "__main__":
    main()
