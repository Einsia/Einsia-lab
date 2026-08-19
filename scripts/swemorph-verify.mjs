/**
 * Check the data layer against the paper's published tables, cell by cell.
 *
 * The site derives every number from the released CSV rather than transcribing
 * the paper, so this is the test that the derivation is the same one the paper
 * used. Run from the repository root:
 *
 *     node scripts/swemorph-verify.mjs
 */
import {
  getSystems, getFamilies, getTasks, getEffortSweep, getFunnel, getNullEdit, getDurationBasis,
  getScoreDistribution, getRuns, getToolMix, getCorpusStats,
} from "../src/lib/swemorph.js";

let fail = 0;
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;

function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    fail++;
    console.log(`  MISMATCH ${label}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
  }
  return ok;
}

// ---- Table: Main results (paper Table 3) --------------------------------
// cfg, n, gate, gate%, ceiling, accepted, broken%, blind, score
const MAIN = {
  "claude-opus-5":   [5, 100, 88, 88.0, 45, 16, 57.9, 7, 32.30],
  "gpt-5.6-sol":     [6, 120, 68, 56.7, 24, 5, 75.0, 4, 12.42],
  "claude-sonnet-5": [5, 100, 69, 69.0, 16, 3, 72.7, 5, 8.50],
  "gpt-5.6-luna":    [6, 120, 69, 57.5, 16, 0, 100.0, 8, 4.67],
  "kimi-k3":         [1, 20, 15, 75.0, 5, 2, 60.0, 0, 19.50],
  "qwen3.8-max":     [1, 20, 8, 40.0, 6, 2, 0.0, 4, 10.00],
  "dsv4-flash":      [1, 20, 13, 65.0, 3, 0, 100.0, 1, 7.00],
  "glm-5.2":         [1, 20, 10, 50.0, 3, 0, 100.0, 1, 6.50],
};
const ALL = [26, 520, 340, 65.4, 118, 28, 68.2, 30, 13.44];
const CATS = {
  "Build-toolchain rewrite": [26, 78, 63, 80.8, 36, 6, 82.4, 2, 31.41],
  "Platform port":           [26, 78, 45, 57.7, 21, 4, 76.5, 4, 17.18],
  "Framework rewrite":       [26, 182, 132, 72.5, 40, 14, 44.0, 15, 11.98],
  "Language rewrite":        [26, 182, 100, 54.9, 21, 4, 66.7, 9, 5.60],
};
const row = (s) => [s.cfg, s.n, s.gate, r1(s.gatePct), s.ceiling, s.accepted, r1(s.brokenPct), s.blind, r2(s.score)];

console.log("Table: Main results");
const sys = getSystems();
for (const s of sys.all) check(s.model, row(s), MAIN[s.model]);
check("All systems", row(sys.overall), ALL);
for (const f of getFamilies()) check(f.label, row(f), CATS[f.label]);

// The paper orders the two blocks by score; check the published order.
check("swept order", sys.swept.map((s) => s.model),
  ["claude-opus-5", "gpt-5.6-sol", "claude-sonnet-5", "gpt-5.6-luna"]);
check("single order", sys.single.map((s) => s.model),
  ["kimi-k3", "qwen3.8-max", "dsv4-flash", "glm-5.2"]);

// ---- Table: Per-task attrition (paper Table 7) --------------------------
// n, gate, ceiling, blind, accepted, score
const TASKS = {
  lang01: [26, 6, 5, 5, 0, 0.00],   lang02: [26, 18, 4, 0, 0, 12.69],
  lang03: [26, 14, 0, 0, 0, 0.00],  lang04: [26, 20, 0, 0, 0, 0.00],
  lang05: [26, 18, 4, 0, 1, 12.69], lang06: [26, 10, 3, 2, 0, 2.31],
  lang07: [26, 14, 5, 2, 3, 11.54],
  fw01: [26, 24, 1, 1, 0, 0.00],    fw02: [26, 13, 1, 1, 0, 0.00],
  fw03: [26, 26, 5, 0, 2, 16.92],   fw04: [26, 25, 7, 1, 3, 21.54],
  fw05: [26, 22, 2, 1, 0, 2.31],    fw06: [26, 13, 22, 9, 9, 43.08],
  fw07: [26, 9, 2, 2, 0, 0.00],
  pf01: [26, 15, 1, 0, 0, 2.31],    pf02: [26, 12, 0, 0, 0, 0.00],
  pf03: [26, 18, 20, 4, 4, 49.23],
  build01: [26, 19, 2, 0, 0, 4.23], build02: [26, 20, 13, 0, 0, 25.38],
  build03: [26, 24, 21, 2, 6, 64.62],
};
console.log("Table: Per-task attrition");
const tasks = getTasks();
check("task count", tasks.length, 20);
for (const t of tasks) {
  check(t.id, [t.n, t.gate, t.ceiling, t.blind, t.accepted, r2(t.score)], TASKS[t.id]);
}
check("tasks solved by nobody", tasks.filter((t) => !t.solved).length, 13);
// Static catalog totals must match the paper's catalog table.
check("total lines", tasks.reduce((a, t) => a + t.lines, 0), 867062);
check("total checks", tasks.reduce((a, t) => a + t.checks, 0), 130118);
check("total gates", tasks.reduce((a, t) => a + t.gates, 0), 136);
check("total modules", tasks.reduce((a, t) => a + t.modules, 0), 264);
check("total budget h", tasks.reduce((a, t) => a + t.budget_h, 0), 262);

// ---- Table: Reasoning-effort sweep (paper Table 8) ----------------------
// G (gate %), C (ceiling), A (accepted); null = level not exposed
const EFFORT = {
  "claude-opus-5":   { none: null, low: [90, 5, 2], medium: [85, 9, 2], high: [90, 10, 4], xhigh: [95, 12, 5], max: [80, 9, 3] },
  "claude-sonnet-5": { none: null, low: [70, 2, 0], medium: [70, 4, 1], high: [75, 4, 0], xhigh: [60, 3, 1], max: [70, 3, 1] },
  "gpt-5.6-sol":     { none: [45, 1, 0], low: [45, 2, 0], medium: [45, 5, 0], high: [60, 5, 1], xhigh: [70, 4, 0], max: [75, 7, 4] },
  "gpt-5.6-luna":    { none: [45, 2, 0], low: [25, 2, 0], medium: [60, 1, 0], high: [60, 3, 0], xhigh: [70, 4, 0], max: [85, 4, 0] },
};
console.log("Table: Reasoning-effort sweep");
const sweep = getEffortSweep();
check("swept systems", sweep.rows.length, 4);
for (const r of sweep.rows) {
  for (const c of r.cells) {
    const want = EFFORT[r.model][c.effort];
    if (want === null) check(`${r.model}/${c.effort} absent`, !!c.missing, true);
    else check(`${r.model}/${c.effort}`, [r1(c.gatePct), c.ceiling, c.accepted], want);
  }
}

// ---- Abstract and validity claims --------------------------------------
console.log("Abstract claims");
const f = getFunnel();
check("total runs", f.total, 520);
check("at behavioral ceiling", f.ceiling, 118);
check("ceiling rejected", f.blind + f.brokenAtCeiling, 90);
check("rejected: never migrated", f.blind, 30);
check("rejected: verifier separated the trees", f.brokenAtCeiling, 60);
check("cleared all three rungs", f.accepted, 28);
check("systems", new Set(getRuns().map((r) => r.model)).size, 8);

// "68.2% of the 88 gate-passing ceiling runs" (Section 4.3)
check("admitted (gate-passing ceiling) runs", getSystems().overall.admitted, 88);

// The survivor chain the homepage strip reports. Each rung is handed what the one
// before it passed, so these are three different denominators on purpose: 118 is
// not a rung-2 survivor count, because 30 of those runs had already failed rung 1.
check("rung entrants", f.rungs.map((g) => g.entered), [520, 340, 88]);
check("rung survivors", f.rungs.map((g) => g.survived), [340, 88, 28]);
check("rung pass rate over its own entrants", f.rungs.map((g) => r1(g.rate)), [65.4, 25.9, 31.8]);
check("rung survivors as a share of the campaign", f.rungs.map((g) => r1(g.share)), [65.4, 16.9, 5.4]);
// A rung's entrants are the rung above it's survivors — the property that makes
// the chain a chain, and the one a count comparison cannot see.
check("the chain is a chain", f.rungs.slice(1).map((g, i) => g.entered === f.rungs[i].survived), [true, true]);
check("rung 2 passed fewer than the ceiling cohort", f.admitted < f.ceiling, true);
check("and the difference is exactly the blind runs", f.ceiling - f.admitted, f.blind);

// Where the 520 stopped, partitioned by the rung that ended them.
check("stopped at the gate", f.stops.gate, 180);
check("stopped at the frozen checks", f.stops.checks, 252);
check("stopped at a verifier", f.stops.verifier, 60);
check("accepted", f.stops.accepted, 28);
check("the four terminal states exhaust the campaign",
  f.stops.gate + f.stops.checks + f.stops.verifier + f.stops.accepted, 520);

// The duration column is not one measurement. These pin the split the leaderboard
// and runs pages state, plus the two structural claims their wording rests on:
// that it does not follow the harness boundary, and that four systems straddle it.
const db = getDurationBasis();
check("duration: runs on the session span", db.wall, 292);
check("duration: runs on the narrower measure", db.other, 228);
check("duration: the two bases exhaust the campaign", db.wall + db.other, 520);
check("duration: split does not follow the harness", db.followsHarness, false);
check("duration: systems straddling both bases", db.mixedSystems, 4);

// The null edit's standing on the behavioral metric, which the homepage states.
// It scores a perfect rate by identity, so it beats everything below the ceiling
// and ties everything at it — and nothing in the campaign outscores it.
const ne = getNullEdit();
check("null edit: runs beaten outright", ne.beaten, 402);
check("null edit: runs tied", ne.tied, 118);
check("null edit: beaten + tied is the whole campaign", ne.beaten + ne.tied, 520);
check("null edit: perfect on every task", ne.tasks, 20);

// Score distribution: the scale is discrete, and 432 of 520 score zero.
check("score distribution", getScoreDistribution().map((b) => [b.score, b.n]),
  [[0, 432], [40, 6], [50, 7], [60, 10], [70, 7], [80, 19], [90, 11], [100, 28]]);

// ---- Trajectory corpus -------------------------------------------------
console.log("Trajectory corpus");
const mix = getToolMix();
check("harnesses", mix.map((m) => m.harness), ["claude-code", "codex-cli"]);
check("runs per harness", mix.map((m) => m.runs), [280, 240]);
check("calls per harness", mix.map((m) => m.calls), [154301, 93690]);
// codex logs no tool results and no thinking blocks: these must be null, not 0.
const codex = mix.find((m) => m.harness === "codex-cli");
check("codex error rate unobservable", codex.errRate, null);
check("codex thinking unobservable", codex.thinkShare, null);
const cc = mix.find((m) => m.harness === "claude-code");
check("claude-code error rate observable", cc.errRate !== null, true);
const corpus = getCorpusStats();
check("corpus bytes", corpus.bytes, 332711306);
check("corpus tool calls", corpus.toolCalls, 154301 + 93690);

console.log(fail ? `\n${fail} mismatch(es)` : "\nall checks pass — the site's numbers are the paper's");
process.exit(fail ? 1 : 0);
