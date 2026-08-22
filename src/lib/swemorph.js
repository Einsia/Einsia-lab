/**
 * SWE Morph Bench — build-time data layer.
 *
 * Everything the pages show is derived here from the two released artifacts in
 * `public/swe-morph-bench/data/`: the score table (one row per graded run) and
 * the per-run trajectory summaries. Nothing is transcribed by hand, so a
 * regenerated corpus updates the site without anyone editing a number.
 *
 * The column definitions below are the paper's, and reproduce its main table
 * cell for cell. The one that is easy to get wrong is `cfg`: for a single system
 * it is that system's number of reasoning-effort levels, but for an aggregate
 * row it is the sum over systems (5+6+5+6+1+1+1+1 = 26). Counting distinct
 * (model, effort) pairs gets both cases right.
 */
import fs from "node:fs";
import path from "node:path";

const DATA = path.join(process.cwd(), "public/swe-morph-bench/data");

const read = (f) => fs.readFileSync(path.join(DATA, f), "utf8");

/** The released table is quote-free and every row has 16 fields, so a plain
 *  split is safe and avoids a CSV dependency. Verified over all 520 rows.
 *  It is written with CRLF endings, so the line split has to drop the \r --
 *  otherwise the last column is named "total_score\r" and reads as undefined. */
function parseCsv(text) {
  const [head, ...body] = text.trim().split(/\r?\n/);
  const cols = head.split(",");
  return body.map((line) => {
    const cells = line.split(",");
    if (cells.length !== cols.length) {
      throw new Error(`scores_by_cell.csv: expected ${cols.length} fields, got ${cells.length}`);
    }
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}

/** "4699/4720" → {passed, total, full}. Empty/absent → null. */
function frac(s) {
  if (!s || !s.includes("/")) return null;
  const [a, b] = s.split("/").map(Number);
  return { passed: a, total: b, full: a === b, rate: b ? a / b : 0 };
}

let _rows = null;

/** One record per graded run, with the derived fields the pages read. */
export function getRuns() {
  if (_rows) return _rows;

  const summaries = JSON.parse(read("runs.json"));
  const catalog = getCatalog();
  const byId = new Map(catalog.tasks.map((t) => [t.slug, t]));

  _rows = parseCsv(read("scores_by_cell.csv")).map((r) => {
    const checks = frac(r.s2_checks);
    const modules = frac(r.s2_modules);
    const gates = frac(r.s1_passed);
    const score = Number(r.total_score);
    const gatePass = r.s1_gate === "pass";
    const task = byId.get(r.task);
    if (!task) throw new Error(`scores_by_cell.csv: unknown task ${r.task}`);
    const traj = summaries.runs[r.file] || null;

    // Two token figures, and they disagree on exactly 5 of 520 runs. The score
    // table's `agent_tokens` was reduced by taking a codex run's final usage
    // record alone, which drops everything before a mid-run session reset. The
    // corpus contradicts that on every codex run, in `usage_basis_note`: the
    // counter is cumulative *within* a session, so the segments must be summed.
    // The corpus is the authority, so the reduced split drives both axes and the
    // released column rides along for audit. See `notes.usage` in runs.json.
    const tokensReported = Number(r.agent_tokens);
    const tokensCounted = traj?.usage
      ? traj.usage.input + traj.usage.output
      : tokensReported;

    return {
      // identity
      file: r.file,
      task: r.task,
      taskId: task.id,
      family: task.family,
      model: r.model,
      effort: r.effort,

      // rung 1 — did the migration happen
      gatePass,
      gates,

      // rung 2 — how much behavior survived. Scoring is all-or-nothing: only a
      // run at the ceiling opens rung 3, and the weighted rate below is the
      // paper's diagnostic F, which pays nothing.
      checks,
      modules,
      atCeiling: !!checks?.full,
      rate: checks ? checks.rate : 0,
      s2Score: Number(r.s2_score),

      // rung 3 — what the frozen suite failed to ask. Blank means not run.
      survived: r.s3_survived === "" ? null : Number(r.s3_survived),
      s3Ran: r.s3_state === "counted",
      s3Score: Number(r.s3_score),

      // composite
      score,
      accepted: score === 100,
      // A run the gate passed and the suite scored perfect: the only runs a
      // verifier is paid to attack.
      admitted: gatePass && !!checks?.full,
      // Perfect on every frozen check, yet the reviewer found it unmigrated.
      blind: !gatePass && !!checks?.full,

      // cost — the two universal axes
      durationSec: Number(r.agent_duration_sec),
      tokens: tokensCounted,
      // What the released score table says, for the 5 runs where it differs.
      tokensReported,
      // The harness's own token split: input, output, and how much of the input
      // was a cache read. See `runCost`. Null for a run with no usage records.
      usage: traj?.usage ?? null,

      // trajectory shape, when the summary file has it
      traj,
      harness: traj?.harness ?? null,
      // When the run started. The cache-read field comes through for some
      // systems only from 2026-08-13, so the date is what `cacheEvidence`
      // separates the reporting runs from the silent ones by.
      startedAt: traj?.started_at ?? null,
    };
  });
  return _rows;
}

export function getCatalog() {
  return JSON.parse(read("tasks.json"));
}

export function getRunNotes() {
  const s = JSON.parse(read("runs.json"));
  return { notes: s.notes, shapeLegend: s.shape_legend, shapeBins: s.shape_bins };
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * List API prices, US dollars per million tokens, as published on 2026-08-18.
 *
 * `cached` is the provider's cache-read rate, and it does most of the work: the
 * runs are 88-97% cache reads where the harness recorded them, so the discount
 * is the difference between a $17k campaign and an $86k one. `write` is the
 * multiple of the input rate a vendor charges to put a prefix in the cache —
 * Anthropic bills 1.25x for its 5-minute tier, the others fold it into input.
 *
 * Prices are a property of the vendor on one date, not of the benchmark, so they
 * live here as data with their source attached rather than being folded into the
 * numbers. A price change is a one-line edit and every figure follows.
 */
export const CACHE_WRITE_MULT = 1.25;

export const PRICES = {
  "claude-opus-5": { in: 5.0, out: 25.0, cached: 0.5, src: "platform.claude.com/docs/en/about-claude/pricing" },
  // Sonnet 5 is $2/$10 on an introductory rate that ends 2026-08-31. The
  // standard rate is used so all eight systems are priced on the same footing.
  "claude-sonnet-5": { in: 3.0, out: 15.0, cached: 0.3, note: "standard rate; introductory $2/$10 runs to 2026-08-31", src: "platform.claude.com/docs/en/about-claude/pricing" },
  "gpt-5.6-sol": { in: 5.0, out: 30.0, cached: 0.5, src: "developers.openai.com/api/docs/pricing" },
  "gpt-5.6-luna": { in: 0.2, out: 1.2, cached: 0.02, note: "after the 2026-07-30 cut", src: "developers.openai.com/api/docs/pricing" },
  // DeepSeek moved to peak/off-peak on 2026-08-16. Off-peak is the lower of the
  // two and is what a batch of long agent runs would mostly land in.
  "dsv4-flash": { in: 0.22, out: 0.66, cached: 0.007, note: "off-peak; peak is 2x", src: "api-docs.deepseek.com/quick_start/pricing" },
  "glm-5.2": { in: 1.4, out: 4.4, cached: 0.26, src: "docs.z.ai/guides/overview/pricing" },
  "kimi-k3": { in: 3.0, out: 15.0, cached: 0.3, src: "platform.moonshot.ai pricing" },
  "qwen3.8-max": { in: 2.0, out: 6.0, cached: 0.25, src: "Alibaba Model Studio pricing" },
};

/**
 * One hue per system, for the charts.
 *
 * Keyed by model rather than by rank, so a system keeps its colour when the
 * ranking moves and the same hue means the same system on every figure. Grouped
 * by vendor — the two Claude models are reds, the two GPT models blues, the rest
 * take their own hue — so the chart reads as families first and the eye is not
 * asked to hold eight unrelated colours at once.
 *
 * Desaturated and dark enough to sit on near-white paper without shouting: the
 * site is monochrome by design and these are the only hues on it. The order
 * within a family runs strong to light, which matches the model tiers.
 */
export const HUES = {
  "claude-opus-5": "#94070a",
  "claude-sonnet-5": "#c2673c",
  "gpt-5.6-sol": "#1d3f7a",
  "gpt-5.6-luna": "#5b8bc4",
  "kimi-k3": "#6b3f8f",
  "qwen3.8-max": "#8a6a1f",
  "glm-5.2": "#3f7a58",
  "dsv4-flash": "#1f7a86",
};
/** Fallback for a system the palette does not name yet. */
export const hueOf = (model) => HUES[model] ?? "#6b6b6b";

/**
 * What one run cost at list prices.
 *
 * The token split is measured, not modelled. Each harness logs a `usage` record
 * per round and the builder reduces them on the basis each file declares, so
 * every run arrives here with its own input, output and cache-read counts, and
 * `input + output` equals the score table's `agent_tokens` for all 520 runs.
 *
 * Two things in that split move the bill by more than the prices do.
 *
 * Output is 0.33% of the tokens, not the ~10% a token count invites you to
 * assume. Priced at 5-6x input it is still only about 2% of the total, so the
 * axis is essentially the input bill.
 *
 * Cache reads are the whole story. An agent loop resends a growing prefix every
 * round, which is exactly what prompt caching is for, and every run that reports
 * a hit rate reports a high one: median 96.2% over 457 of the 520 runs, across
 * four vendors and both harnesses. Billing those at the cached rate rather than
 * the input rate divides the campaign by 5.1x.
 *
 * The other 63 runs report a hit rate of exactly zero, and this function prices
 * them as written -- which makes them upper bounds, not bills. Read `runCostLow`
 * before comparing any of them against a system that did report, because the
 * gap is 3.6-7x and it is large enough to invert the ordering.
 *
 * Anthropic bills a cache write at 1.25x input and reports it separately; the
 * other vendors fold writes into the input count, so there is nothing to add.
 *
 * `null` when the model has no published price, or the run logged no usage.
 */
export function runCost(r) {
  const p = PRICES[r.model];
  const u = r.usage;
  if (!p || !u) return null;
  const M = 1e6;
  const write = u.cache_write ? (u.cache_write / M) * p.in * CACHE_WRITE_MULT : 0;
  return (
    (u.input_uncached / M) * p.in +
    write +
    ((u.cache_read ?? 0) / M) * p.cached +
    (u.output / M) * p.out
  );
}

/**
 * What the same run costs with no cache discount at all.
 *
 * Kept because it is the only figure comparable across all eight systems: it
 * needs nothing the three zero-cache-read systems fail to record. Used for the
 * ceiling shown beside the measured number, never as the headline.
 */
export function runCostUncached(r) {
  const p = PRICES[r.model];
  const u = r.usage;
  if (!p || !u) return null;
  return (u.input / 1e6) * p.in + (u.output / 1e6) * p.out;
}

/** Did this run's harness record any cache reads? See `runCost`. */
export const cacheKnown = (r) => !!r.usage && (r.usage.cache_read ?? 0) > 0;

/**
 * Median cache-read share among the runs that report one, per harness.
 *
 * Computed rather than assumed, and quoted on the pages, because it is the whole
 * basis of `runCostLow`. Memoised: it needs every run, and the pages call the
 * cost functions per row.
 */
let _reuseMemo = null;
export function reuseByHarness() {
  if (_reuseMemo) return _reuseMemo;
  const acc = new Map();
  for (const r of getRuns()) {
    if (!cacheKnown(r)) continue;
    if (!acc.has(r.harness)) acc.set(r.harness, []);
    acc.get(r.harness).push(r.usage.cache_read / r.usage.input);
  }
  _reuseMemo = new Map([...acc].map(([h, v]) => [h, median(v)]));
  return _reuseMemo;
}

/**
 * The same run priced as if its unreported cache reads had happened.
 *
 * Equal to `runCost` for the 457 runs that report a hit rate. For the 63 that
 * report zero, the input is split at the median reuse their own harness measured
 * and priced accordingly.
 *
 * The imputation is a reading of what the zeros are, and the reading rests on
 * where they fall. `cache_read_input_tokens` is recorded on every claude-code
 * round record for all four systems -- the field is never absent -- and two of
 * the four return nonzero values on some of their runs:
 *
 *  - kimi-k3 reports reuse on sixteen of its twenty runs and exactly zero on
 *    four. The sixteen all started on 2026-08-13 or later; the four started on
 *    08-10 and 08-11. Split by task it looks arbitrary; split by date it is a
 *    clean boundary.
 *  - glm-5.2 is the same shape at smaller scale: nineteen runs from 08-09 report
 *    zero, the one run from 08-14 reports 97.9%, which is a higher figure than
 *    any Anthropic model's own median, not a lower one.
 *  - dsv4-flash and qwen3.8-max report zero on every run, including the ones
 *    that started on 08-14 alongside the reporting kimi-k3 and glm-5.2 runs. For
 *    these two there is no self-evidence either way, so their low end stands on
 *    the peer figure alone and their range is correspondingly the widest.
 *
 * What changed on 08-13 is not in the release, so the boundary is evidence about
 * the plumbing rather than an explanation of it. Prefix caching that switched off
 * for four tasks and back on for sixteen would have to follow the calendar to
 * produce this; a usage field arriving through a gateway does.
 *
 * So the honest figure for those systems is a range, and both ends are shown
 * wherever they appear. This is the low end; `runCost` is the high end.
 */
/**
 * Per model: how many of its runs report a cache read, how many are silent, the
 * reuse its own reporting runs measured, and the dates on either side of the
 * split. The page quotes this rather than asserting a mechanism.
 */
export function cacheEvidence() {
  const out = new Map();
  for (const r of getRuns()) {
    if (!r.usage) continue;
    const e =
      out.get(r.model) ??
      out.set(r.model, { model: r.model, harness: r.harness, rep: 0, sil: 0, read: 0, input: 0, repDates: new Set(), silDates: new Set() }).get(r.model);
    const day = (r.startedAt ?? "").slice(0, 10);
    if (cacheKnown(r)) {
      e.rep += 1;
      e.read += r.usage.cache_read;
      e.input += r.usage.input;
      if (day) e.repDates.add(day);
    } else {
      e.sil += 1;
      if (day) e.silDates.add(day);
    }
  }
  for (const e of out.values()) {
    e.reuse = e.input ? e.read / e.input : null;
    e.repDates = [...e.repDates].sort();
    e.silDates = [...e.silDates].sort();
    // The date the field starts coming through, for the models where it does.
    e.boundary = e.repDates.length && e.silDates.length ? e.repDates[0] : null;
  }
  return out;
}

export function runCostLow(r) {
  const p = PRICES[r.model];
  const u = r.usage;
  if (!p || !u) return null;
  if (cacheKnown(r)) return runCost(r);
  // No `?? 0` fallback: a harness with nothing to measure would quietly price
  // every one of its runs as uncached, which is the failure this function exists
  // to prevent. If it ever happens, it should be visible.
  const reuse = reuseByHarness().get(r.harness);
  if (reuse === undefined) {
    throw new Error(
      `runCostLow: ${r.harness} has no run reporting a cache read, so there is ` +
        `nothing to impute ${r.file} from`
    );
  }
  const M = 1e6;
  return (
    ((u.input * (1 - reuse)) / M) * p.in +
    ((u.input * reuse) / M) * p.cached +
    (u.output / M) * p.out
  );
}

/** Runs per terminal state, for the stacked attrition bars. */
export function outcomeCounts(rows) {
  const out = { failed: 0, partial: 0, blind: 0, broken: 0, accepted: 0 };
  for (const r of rows) out[outcomeOf(r)]++;
  return out;
}

/**
 * The paper's main-results columns over any subset of runs.
 * `broken` is a share of *admitted* runs, not of all runs — the denominator is
 * the set a verifier was actually paid to attack.
 */
export function stats(rows) {
  const gate = rows.filter((r) => r.gatePass);
  const ceiling = rows.filter((r) => r.atCeiling);
  const admitted = rows.filter((r) => r.admitted);
  const accepted = rows.filter((r) => r.accepted);
  const broken = admitted.filter((r) => !r.accepted);
  return {
    cfg: new Set(rows.map((r) => `${r.model} ${r.effort}`)).size,
    n: rows.length,
    gate: gate.length,
    gatePct: rows.length ? (100 * gate.length) / rows.length : 0,
    ceiling: ceiling.length,
    accepted: accepted.length,
    admitted: admitted.length,
    broken: broken.length,
    brokenPct: admitted.length ? (100 * broken.length) / admitted.length : 0,
    blind: rows.filter((r) => r.blind).length,
    score: mean(rows.map((r) => r.score)),
    rate: mean(rows.map((r) => r.rate)),
    tokens: sum(rows.map((r) => r.tokens)),
    // List-price dollars, null-safe: a model with no published price contributes
    // nothing rather than zero, so `priced` says how many runs the sum covers.
    cost: sum(rows.map((r) => runCost(r) ?? 0)),
    // The low end of the range, for the runs whose cache reads went unreported.
    // Equal to `cost` for any set that contains none of them. See `runCostLow`.
    costLow: sum(rows.map((r) => runCostLow(r) ?? 0)),
    costUncached: sum(rows.map((r) => runCostUncached(r) ?? 0)),
    priced: rows.filter((r) => runCost(r) != null).length,
    // Cache reads are what separates the two figures above, so the pages report
    // how much of this set's input got the discount, and how many of its runs got
    // none of it. See `runCost`.
    cacheKnown: rows.some(cacheKnown),
    noCacheRuns: rows.filter((r) => r.usage && !cacheKnown(r)).length,
    outTokens: sum(rows.map((r) => r.usage?.output ?? 0)),
    cacheReadTokens: sum(rows.map((r) => r.usage?.cache_read ?? 0)),
    cacheReadShare: (() => {
      const inTok = sum(rows.map((r) => r.usage?.input ?? 0));
      return inTok ? sum(rows.map((r) => r.usage?.cache_read ?? 0)) / inTok : 0;
    })(),
    // Whether this set's cost has to be read as a range.
    //
    // True exactly when some of its runs reported no cache read, so that pricing
    // them as written comes out above pricing them like their neighbours. No
    // threshold to argue about: the test is whether the two ends differ at all,
    // and 1% absorbs float noise rather than admitting anything real (the real
    // gaps are 1.5x to 11x).
    //
    // An earlier version tested `cacheReadShare < 0.5`, chosen to sit in the gap
    // in a bimodal distribution. That picks out the three systems that report
    // nothing, but calls kimi-k3 exact when sixteen of its twenty runs report and
    // four do not — a 1.5x understatement of its own uncertainty.
    get costIsRange() {
      return this.cost > this.costLow * 1.01;
    },
    medianMin: median(rows.map((r) => r.durationSec / 60)),
    hours: sum(rows.map((r) => r.durationSec)) / 3600,
    counts: outcomeCounts(rows),
  };
}

/** Client and effort-level count per system, read off the runs themselves. */
function systemMeta(rows) {
  const harnesses = new Set(rows.map((r) => r.harness).filter(Boolean));
  const client = harnesses.size === 1 ? [...harnesses][0] : [...harnesses].sort().join(" + ");
  return {
    client: { "claude-code": "Claude Code", "codex-cli": "Codex CLI" }[client] ?? client,
    efforts: [...new Set(rows.map((r) => r.effort))],
  };
}

/**
 * Leaderboard, ordered by mean composite. Systems swept over more than one
 * effort level are listed first, matching the paper's two blocks: a swept
 * system and a single-configuration one are not directly comparable.
 */
export function getSystems() {
  const runs = getRuns();
  const out = [...new Set(runs.map((r) => r.model))].map((model) => {
    const rows = runs.filter((r) => r.model === model);
    return { model, ...systemMeta(rows), ...stats(rows) };
  });
  out.sort((a, b) => b.cfg - a.cfg || b.score - a.score);
  const swept = out.filter((s) => s.cfg > 1).sort((a, b) => b.score - a.score);
  const single = out.filter((s) => s.cfg === 1).sort((a, b) => b.score - a.score);
  return { swept, single, all: [...swept, ...single], overall: stats(runs) };
}

/** Category rows, ordered by mean composite like the paper's table. */
export function getFamilies() {
  const runs = getRuns();
  return getCatalog()
    .families.map((f) => {
      const rows = runs.filter((r) => r.family === f.key);
      return {
        ...f,
        taskCount: new Set(rows.map((r) => r.task)).size,
        ...stats(rows),
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Per-task attrition, in catalog order, with the static metadata attached. */
export function getTasks() {
  const runs = getRuns();
  const catalog = getCatalog();
  const famLabel = new Map(catalog.families.map((f) => [f.key, f.label]));
  return catalog.tasks.map((t) => {
    const rows = runs.filter((r) => r.task === t.slug);
    const best = Math.max(...rows.map((r) => r.score));
    return {
      ...t,
      familyLabel: famLabel.get(t.family),
      ...stats(rows),
      // Best composite anyone reached, and which systems reached it. On a task
      // nobody scored on, every system ties at zero, so naming them all says
      // nothing -- `bestBy` is empty there rather than a list of all 8.
      best,
      bestBy: best > 0 ? [...new Set(rows.filter((r) => r.score === best).map((r) => r.model))] : [],
      solved: rows.some((r) => r.accepted),
    };
  });
}

/**
 * The effort sweep: one cell per (system, level), only for systems swept over
 * more than one level. A level the interface does not expose stays absent.
 */
export function getEffortSweep() {
  const runs = getRuns();
  const levels = ["none", "low", "medium", "high", "xhigh", "max"];
  const models = [...new Set(runs.map((r) => r.model))].filter(
    (m) => new Set(runs.filter((r) => r.model === m).map((r) => r.effort)).size > 1
  );
  const rows = models.map((model) => {
    const cells = levels.map((effort) => {
      const rs = runs.filter((r) => r.model === model && r.effort === effort);
      return rs.length ? { effort, ...stats(rs) } : { effort, missing: true };
    });
    return { model, cells, overall: stats(runs.filter((r) => r.model === model)) };
  });
  rows.sort((a, b) => b.overall.score - a.overall.score);
  return { levels, rows };
}

/** Composite score histogram. The scale is discrete: 0, then 40 to 100 by 10. */
export function getScoreDistribution() {
  const runs = getRuns();
  const buckets = [0, 40, 50, 60, 70, 80, 90, 100];
  return buckets.map((b) => ({
    score: b,
    n: runs.filter((r) => r.score === b).length,
  }));
}

/** task × system grid of the best composite reached, for the heatmap. */
export function getHeatmap() {
  const runs = getRuns();
  const tasks = getCatalog().tasks;
  const systems = getSystems().all.map((s) => s.model);
  return {
    systems,
    rows: tasks.map((t) => ({
      id: t.id,
      slug: t.slug,
      migration: t.migration,
      family: t.family,
      cells: systems.map((model) => {
        const rs = runs.filter((r) => r.task === t.slug && r.model === model);
        return {
          model,
          n: rs.length,
          best: rs.length ? Math.max(...rs.map((r) => r.score)) : null,
          gate: rs.filter((r) => r.gatePass).length,
          ceiling: rs.filter((r) => r.atCeiling).length,
        };
      }),
    })),
  };
}

/**
 * Where the 520 runs end up, read two ways.
 *
 * `rungs` is the survivor chain, and it is the reading the headline states: each
 * rung is handed what the rung before it passed, so rung 2's survivors are the
 * runs the gate admitted *and* the frozen suite scored perfect. That is 88, not
 * the 118 runs with a perfect suite — the 30 it leaves out had already failed
 * rung 1, and counting them would credit rung 2 with clearing runs rung 1 had
 * rejected. A rung's rate is over its own entrants, which is the only
 * denominator that says anything about the rung.
 *
 * `stops` is the same 520 runs partitioned by the rung that ended them, and
 * `ceiling` is the behavioral cohort the funnel band magnifies: perfect suite
 * regardless of the gate, which is all an instrument that reads only behavior
 * can see. Its three terminal states are mutually exclusive and exhaust it.
 */
export function getFunnel() {
  const runs = getRuns();
  const gate = runs.filter((r) => r.gatePass);
  const admitted = runs.filter((r) => r.admitted);
  const accepted = runs.filter((r) => r.accepted);
  const ceiling = runs.filter((r) => r.atCeiling);

  const rung = (n, entered, survived) => ({
    n,
    entered: entered.length,
    survived: survived.length,
    stopped: entered.length - survived.length,
    // Share of what this rung was handed, and of the whole campaign.
    rate: entered.length ? (100 * survived.length) / entered.length : 0,
    share: (100 * survived.length) / runs.length,
  });

  const f = {
    total: runs.length,
    gateFail: runs.length - gate.length,
    gatePass: gate.length,
    belowCeiling: runs.length - ceiling.length,
    ceiling: ceiling.length,
    admitted: admitted.length,
    blind: ceiling.filter((r) => r.blind).length,
    brokenAtCeiling: admitted.filter((r) => !r.accepted).length,
    accepted: accepted.length,
    rungs: [rung(1, runs, gate), rung(2, gate, admitted), rung(3, admitted, accepted)],
    stops: {
      gate: runs.length - gate.length,
      checks: gate.length - admitted.length,
      verifier: admitted.length - accepted.length,
      accepted: accepted.length,
    },
  };

  // The chain only means anything if the rungs nest. Comparing counts would not
  // catch a rung 2 fed the ceiling cohort instead of the gate survivors: 118 is
  // duly less than 340 either way. Set containment is what has teeth.
  const within = (inner, outer) => {
    const keys = new Set(outer.map((r) => r.file));
    return inner.every((r) => keys.has(r.file));
  };
  if (!within(admitted, gate) || !within(accepted, admitted)) {
    throw new Error("funnel: the rungs do not nest — a rung passed a run the rung above it stopped");
  }
  if (f.stops.gate + f.stops.checks + f.stops.verifier + f.stops.accepted !== f.total) {
    throw new Error("funnel: the terminal states do not partition the campaign");
  }
  if (f.admitted + f.blind !== f.ceiling) {
    throw new Error("funnel: the ceiling cohort is not the admitted runs plus the blind ones");
  }
  if (f.blind + f.brokenAtCeiling + f.accepted !== f.ceiling) {
    throw new Error("funnel: ceiling runs do not partition into the three terminal states");
  }
  return f;
}

/**
 * Where a null edit would land on the behavioral metric alone.
 *
 * Submitting the repository untouched preserves behavior by identity, so its
 * weighted functional rate is 1 on every task. That is the ceiling of the same
 * metric the runs are scored on, so its standing against the campaign follows
 * from the released rates without needing a control run: it is strictly above
 * every run below the ceiling and level with every run at it.
 */
export function getNullEdit() {
  const runs = getRuns();
  const ceiling = runs.filter((r) => r.atCeiling);
  // The rate is `full` exactly when it is 1, so there is no boundary case where
  // a run ties the null edit without being counted at the ceiling.
  const inconsistent = runs.filter((r) => (r.rate >= 1) !== r.atCeiling);
  if (inconsistent.length > 0) {
    throw new Error(
      `null edit: ${inconsistent.length} runs where rate == 1 disagrees with the ceiling flag`
    );
  }
  return {
    total: runs.length,
    beaten: runs.length - ceiling.length,
    tied: ceiling.length,
    tasks: getCatalog().tasks.length,
  };
}

/**
 * What the duration column actually measures, run by run.
 *
 * `agent_duration_sec` is not one quantity. On most runs it is exactly the
 * session span the trajectory summary reports as `wall_sec` -- which is
 * `finished_at` minus `started_at` on all 520 runs, so it is the span by
 * construction. On the rest it is something narrower, mostly well below the
 * span and, on two runs, slightly above it.
 *
 * Nothing in the release names that second basis, so this reports only what is
 * checkable: which runs agree with the session span and which do not. The split
 * is worth surfacing because it does not follow the harness boundary -- Claude
 * Code sits on both sides of it -- so two durations are comparable only when
 * both are on the same basis, and no pooled duration total is like-for-like.
 */
export function getDurationBasis() {
  const runs = getRuns();
  const missing = runs.filter((r) => !r.traj || typeof r.traj.wall_sec !== "number");
  if (missing.length > 0) {
    throw new Error(
      `duration basis: ${missing.length} runs have no session span to compare against`
    );
  }
  // A second of slack: the wall figures are published to 0.1s, and the runs that
  // agree with the span agree with it exactly, so nothing sits near this cut.
  const isWall = (r) => Math.abs(r.durationSec - r.traj.wall_sec) < 1;
  const other = runs.filter((r) => !isWall(r));
  const per = (key) =>
    [...new Set(runs.map((r) => r[key]))].sort().map((v) => {
      const rows = runs.filter((r) => r[key] === v);
      return { [key]: v, n: rows.length, wall: rows.filter(isWall).length };
    });
  const bySystem = per("model");
  const byHarness = per("harness");
  return {
    total: runs.length,
    wall: runs.length - other.length,
    other: other.length,
    below: other.filter((r) => r.durationSec < r.traj.wall_sec).length,
    above: other.filter((r) => r.durationSec > r.traj.wall_sec).length,
    medianRatio: median(other.map((r) => r.durationSec / r.traj.wall_sec)),
    // The campaign on one ruler: every run at its session span. The published
    // hour total is a plain sum over two bases, so this is what it would read if
    // the narrower measure were replaced by the span it sits inside.
    spanHours: sum(runs.map((r) => r.traj.wall_sec)) / 3600,
    // Systems with runs on both bases: the reason a per-system median is still
    // not one measurement.
    mixedSystems: bySystem.filter((s) => s.wall > 0 && s.wall < s.n).length,
    // True only if each harness sits wholly on one basis. It does not.
    followsHarness: byHarness.every((h) => h.wall === 0 || h.wall === h.n),
    bySystem,
    byHarness,
  };
}

/** Tool mix, per harness. Never pooled — see the note in runs.json. */
export function getToolMix() {
  const runs = getRuns().filter((r) => r.traj);
  const harnesses = [...new Set(runs.map((r) => r.harness))].sort();
  return harnesses.map((h) => {
    const rows = runs.filter((r) => r.harness === h);
    const cats = {};
    const raw = {};
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.traj.tools || {})) cats[k] = (cats[k] || 0) + v;
      for (const [k, v] of Object.entries(r.traj.top_tools || {})) raw[k] = (raw[k] || 0) + v;
    }
    const total = sum(Object.values(cats));
    return {
      harness: h,
      version: rows[0]?.traj?.harness_version ?? null,
      runs: rows.length,
      models: [...new Set(rows.map((r) => r.model))].sort(),
      calls: total,
      categories: Object.entries(cats)
        .map(([k, v]) => ({ key: k, n: v, pct: total ? (100 * v) / total : 0 }))
        .sort((a, b) => b.n - a.n),
      top: Object.entries(raw)
        .map(([k, v]) => ({ name: k, n: v, pct: total ? (100 * v) / total : 0 }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 6),
      medianTools: median(rows.map((r) => r.traj.n_tool)),
      // Recorded by claude-code only; null keeps "not logged" distinct from zero.
      thinkShare: rows.every((r) => r.traj.think_chars == null)
        ? null
        : sum(rows.map((r) => r.traj.think_chars ?? 0)) /
          Math.max(1, sum(rows.map((r) => (r.traj.think_chars ?? 0) + (r.traj.assist_chars ?? 0)))),
      errRate: rows.every((r) => r.traj.n_tool_err == null)
        ? null
        : sum(rows.map((r) => r.traj.n_tool_err ?? 0)) /
          Math.max(1, sum(rows.map((r) => r.traj.n_tool_result ?? 0))),
    };
  });
}

/** Corpus-scale numbers for the release section. */
export function getCorpusStats() {
  const runs = getRuns();
  const withTraj = runs.filter((r) => r.traj);
  return {
    runs: runs.length,
    bytes: sum(withTraj.map((r) => r.traj.bytes)),
    records: sum(withTraj.map((r) => r.traj.records)),
    toolCalls: sum(withTraj.map((r) => r.traj.n_tool)),
    tokens: sum(runs.map((r) => r.tokens)),
    cost: sum(runs.map((r) => runCost(r) ?? 0)),
    costLow: sum(runs.map((r) => runCostLow(r) ?? 0)),
    costUncached: sum(runs.map((r) => runCostUncached(r) ?? 0)),
    // Generated tokens as the harnesses recorded them, so the page can state how
    // small a share of the total they are: 0.33%, not the ~10% a single token
    // column invites you to assume.
    outTokens: sum(runs.map((r) => r.usage?.output ?? 0)),
    inTokens: sum(runs.map((r) => r.usage?.input ?? 0)),
    cacheReadTokens: sum(runs.map((r) => r.usage?.cache_read ?? 0)),
    // Median reuse among the runs that report it, and how many those are. Both
    // are quoted on the leaderboard, because they are what `runCostLow` assumes.
    reuseMedian: median(
      runs.filter(cacheKnown).map((r) => r.usage.cache_read / r.usage.input)
    ),
    cacheReportingRuns: runs.filter(cacheKnown).length,
    // Runs whose harness recorded no cache read at all. Their cost is a ceiling.
    noCacheRuns: runs.filter((r) => r.usage && !cacheKnown(r)).length,
    hours: sum(runs.map((r) => r.durationSec)) / 3600,
    stopReasons: Object.entries(
      withTraj.reduce((acc, r) => {
        const k = r.traj.stop_reason ?? "unknown";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]),
  };
}

/** Effort levels in the order the paper prints them. */
export const EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"];

/**
 * The five terminal states a run can end in. Mutually exclusive and exhaustive,
 * so they partition all 520 runs. `blind` is the one the benchmark exists to
 * expose: a run perfect on every frozen check that never migrated anything.
 */
export const OUTCOMES = [
  { key: "accepted", label: "Accepted", note: "cleared all three rungs" },
  { key: "broken", label: "Broken", note: "a verifier found a difference" },
  { key: "blind", label: "Blind", note: "perfect suite, gate rejected" },
  { key: "partial", label: "Partial", note: "migrated, behavior lost" },
  { key: "failed", label: "Failed", note: "never migrated" },
];

export function outcomeOf(r) {
  if (r.accepted) return "accepted";
  if (r.admitted) return "broken";
  if (r.blind) return "blind";
  return r.gatePass ? "partial" : "failed";
}

/** The runs of one task, ordered the way its page reads them. */
function taskRuns(runs, slug) {
  const rank = new Map(EFFORTS.map((e, i) => [e, i]));
  return runs
    .filter((r) => r.task === slug)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.rate - a.rate ||
        a.model.localeCompare(b.model) ||
        (rank.get(a.effort) ?? 9) - (rank.get(b.effort) ?? 9)
    );
}

/**
 * One entry per task for `getStaticPaths`, with everything the page draws
 * already assembled so the page body does no data work of its own.
 */
export function getTaskPaths() {
  const runs = getRuns();
  const tasks = getTasks();
  const families = new Map(getCatalog().families.map((f) => [f.key, f]));
  return tasks.map((t, i) => {
    const rows = runs.filter((r) => r.task === t.slug);
    return {
      params: { task: t.slug },
      props: {
        task: t,
        family: families.get(t.family),
        runs: taskRuns(runs, t.slug).map((r) => ({ ...r, outcome: outcomeOf(r) })),
        // Per-system best on this task, for the small ranking beside the runs.
        systems: [...new Set(rows.map((r) => r.model))]
          .map((model) => {
            const rs = rows.filter((r) => r.model === model);
            return { model, best: Math.max(...rs.map((r) => r.score)), ...stats(rs) };
          })
          .sort((a, b) => b.best - a.best || b.score - a.score),
        index: i + 1,
        total: tasks.length,
        prev: i > 0 ? tasks[i - 1] : tasks[tasks.length - 1],
        next: i < tasks.length - 1 ? tasks[i + 1] : tasks[0],
      },
    };
  });
}

/**
 * Lean rows for the runs explorer: only the fields the table draws, so the page
 * does not ship data it never renders.
 */
export function getRunTable() {
  const meta = new Map(getCatalog().tasks.map((t) => [t.slug, t]));
  return getRuns().map((r) => ({
    file: r.file,
    taskId: r.taskId,
    slug: r.task,
    migration: meta.get(r.task).migration,
    family: r.family,
    model: r.model,
    effort: r.effort,
    harness: r.harness,
    gatePass: r.gatePass,
    gates: r.gates,
    checks: r.checks,
    rate: r.rate,
    atCeiling: r.atCeiling,
    survived: r.survived,
    score: r.score,
    outcome: outcomeOf(r),
    minutes: r.durationSec / 60,
    tokens: r.tokens,
    shape: r.traj?.shape ?? null,
    stop: r.traj?.stop_reason ?? null,
    tools: r.traj?.n_tool ?? null,
  }));
}

/**
 * The benchmark cell as the leaderboard ranks it: one (system, effort) pair.
 *
 * A configuration is the unit that was actually run — every one of them saw all
 * 20 tasks, so the rows share a denominator and their compositions are directly
 * comparable. A *system* row is a mean over its configurations and hides the
 * spread the sweep exposes, which is why the board defaults to one row per
 * system's best configuration and can expand to all 26.
 */
export function getConfigs() {
  const runs = getRuns();
  const effortRank = new Map(EFFORTS.map((e, i) => [e, i]));
  const rank = (e) => effortRank.get(e) ?? 99;

  const rows = [...new Set(runs.map((r) => `${r.model}|${r.effort}`))].map((key) => {
    const [model, effort] = key.split("|");
    const rs = runs.filter((r) => r.model === model && r.effort === effort);
    const st = stats(rs);
    return {
      key,
      model,
      effort,
      harness: rs[0].harness,
      client: systemMeta(rs).client,
      n: rs.length,
      counts: st.counts,
      score: st.score,
      gate: st.gate,
      gatePct: st.gatePct,
      ceiling: st.ceiling,
      admitted: st.admitted,
      broken: st.broken,
      blind: st.blind,
      accepted: st.accepted,
      // Per-run averages, so a configuration that ran fewer tasks would still
      // compare — they all ran 20, but the reading should not depend on that.
      tokensPerRun: st.tokens / rs.length,
      // Dollars per run at list prices — the chart's x axis. Measured token
      // split, cache reads billed at the cached rate. See runCost.
      //
      // For the three systems whose cache reads went unreported these two differ
      // and the chart draws the gap, because it is 3.6-7x and wide enough to
      // invert the ordering against systems that did report. `costLowPerRun` is
      // the end to compare on; `costPerRun` is what the records literally say.
      costPerRun: st.priced === rs.length ? st.cost / rs.length : null,
      costLowPerRun: st.priced === rs.length ? st.costLow / rs.length : null,
      // The same run with no cache discount at all, for the price table.
      costUncachedPerRun: st.priced === rs.length ? st.costUncached / rs.length : null,
      // Cache accounting, for the range marks. See `stats`.
      cacheKnown: st.cacheKnown,
      cacheReadShare: st.cacheReadShare,
      costIsRange: st.costIsRange,
      noCacheRuns: st.noCacheRuns,
      medianMin: st.medianMin,
      // The session span, which every run records, so a chart axis can compare
      // configurations on one ruler. `medianMin` above is the recorded duration,
      // and for 12 of the 26 configurations that is a narrower measure sitting
      // inside the span (see getDurationBasis) — a median of the two mixed
      // together would put those configurations about 1.45x too low. The Cost
      // section reports the recorded column and explains it; an axis cannot.
      spanMin: median(rs.map((r) => r.traj.wall_sec / 60)),
    };
  });

  rows.sort((a, b) => b.score - a.score || rank(a.effort) - rank(b.effort));

  // The best configuration per system, by the same order the board sorts on.
  const best = new Map();
  for (const r of rows) if (!best.has(r.model)) best.set(r.model, r.key);

  return rows.map((r, i) => ({ ...r, i: i + 1, isBest: best.get(r.model) === r.key }));
}

/**
 * Per-task difficulty, ordered hardest last: the best composite anyone reached,
 * and how the campaign's 26 attempts on that task were distributed.
 *
 * Sorting by the best score rather than by the mean is deliberate. The mean over
 * 26 configurations mostly measures how many weak configurations were pointed at
 * the task; the maximum answers the question the benchmark is for — whether the
 * task is solvable by anything currently available.
 */
export function getDifficulty() {
  const tasks = getTasks();
  return [...tasks]
    .sort((a, b) => b.best - a.best || b.score - a.score || a.id.localeCompare(b.id))
    .map((t) => ({
      id: t.id,
      slug: t.slug,
      migration: t.migration,
      project: t.project,
      family: t.family,
      familyLabel: t.familyLabel,
      lines: t.lines,
      checks: t.checks,
      n: t.n,
      best: t.best,
      bestBy: t.bestBy,
      score: t.score,
      counts: t.counts,
      gate: t.gate,
      ceiling: t.ceiling,
      accepted: t.accepted,
      solved: t.solved,
    }));
}

/**
 * How far the admitted runs got through the six verifiers, as a survival curve.
 *
 * `atLeast[i]` is the admitted runs that survived i or more verifiers, so the
 * curve starts at the whole admitted set and ends at the accepted set. Read as a
 * survival function it says what each additional verifier bought: the drop from
 * i to i+1 is the runs that verifier i+1 was the first to break.
 */
/**
 * The rung-3 panel: which model holds each of the six verifier slots, and how
 * each one did over the rounds it ran.
 *
 * This is configuration, not a measurement recoverable from the release. The
 * score table records how many slots failed to break a submission and never
 * which ones, so the roster is transcribed from the paper. What the release does
 * pin is the total: every admitted submission faces all six slots, so the breaks
 * recorded here, the survivals the score table carries, and the one round that
 * returned no verdict have to account for every paid round. If they stop adding
 * up — a transcription typo, or a change in the released scores — the build
 * fails here rather than publishing a roster that disagrees with the board.
 */
export function getVerifierPanel() {
  const panel = JSON.parse(read("verifiers.json"));
  const { admitted } = getVerifierSurvival();
  const runs = getRuns().filter((r) => r.admitted);
  const rounds = admitted * panel.rounds_per_submission;
  const survivals = sum(runs.map((r) => r.survived));
  const broke = sum(panel.slots.map((s) => s.broke));
  const errors = sum(panel.slots.map((s) => s.errors));
  if (broke + survivals + errors !== rounds) {
    throw new Error(
      `verifier panel: ${broke} breaks + ${survivals} survivals + ${errors} errors != ${rounds} rounds`
    );
  }
  if (panel.slots.length !== panel.rounds_per_submission) {
    throw new Error("verifier panel: roster does not have one slot per round");
  }
  return {
    rounds,
    breaks: broke,
    // The models are what the section is about; a model holding two slots is the
    // paper's finding, so the count of distinct models is stated, not assumed.
    models: new Set(panel.slots.map((s) => s.model)).size,
    slots: panel.slots.map((s) => ({
      ...s,
      // Over the rounds the slot actually returned a verdict on.
      rate: s.rounds ? s.broke / s.rounds : 0,
    })),
  };
}

export function getVerifierSurvival() {
  const runs = getRuns();
  const adm = runs.filter((r) => r.admitted);
  const exact = Array.from({ length: 7 }, (_, i) => adm.filter((r) => r.survived === i).length);
  if (sum(exact) !== adm.length) {
    throw new Error("verifier survival: admitted runs do not partition by verifiers survived");
  }
  const atLeast = exact.map((_, i) => sum(exact.slice(i)));
  return {
    admitted: adm.length,
    accepted: exact[6],
    exact,
    atLeast,
    // The share of the admitted set still standing after each verifier, which is
    // what makes the curve comparable to a per-task or per-system one.
    share: atLeast.map((n) => (adm.length ? n / adm.length : 0)),
  };
}
