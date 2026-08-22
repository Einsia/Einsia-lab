/**
 * Generate the research-page banner for SWE Morph Bench.
 *
 * The figure is the benchmark itself: one cell per graded run, 20 task rows by
 * 26 configuration columns, shaded by where that run stopped. It is drawn from
 * the same released score table the site reads, so the banner cannot drift from
 * the numbers — regenerate it and it stays true.
 *
 * Composed at 16:9 because /research frames every banner in `aspect-[16/9]`
 * with object-contain; a squarer figure would sit letterboxed inside the card.
 * The grid carries no per-row or per-column labels: at the size this renders on
 * the page they would be illegible, so the axes are named once instead and the
 * cells are left to do the work.
 *
 *   node scripts/swemorph-banner.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { getRuns, getCatalog, getSystems, outcomeOf, EFFORTS } from "../src/lib/swemorph.js";

const OUT = path.join(process.cwd(), "public/swe-morph-bench/img/attrition.svg");

const runs = getRuns();
const tasks = getCatalog().tasks;
const systems = getSystems().all.map((s) => s.model);
const effortRank = new Map(EFFORTS.map((e, i) => [e, i]));

// Columns are configurations: grouped by system in leaderboard order, ordered by
// effort inside each group. The strongest systems land on the left, so what few
// accepted cells there are cluster there.
const cols = [];
for (const model of systems) {
  const efforts = [...new Set(runs.filter((r) => r.model === model).map((r) => r.effort))].sort(
    (a, b) => effortRank.get(a) - effortRank.get(b)
  );
  for (const effort of efforts) cols.push({ model, effort });
}

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace";

const INK = "#1a1a1a";
const INK2 = "#6b6b6b";
const INK3 = "#8d8d8d";
const INK4 = "#b0b0b0";
const LINE = "#eaeaea";
const PAPER = "#fcfcfc";

// Five terminal states, ordered as the eye should read them: the outcome that
// counts first, the one that never got started last.
const LEGEND = [
  { key: "accepted", label: "Accepted", fill: INK, stroke: null },
  { key: "broken", label: "A verifier found a difference", fill: INK3, stroke: null },
  { key: "blind", label: "Perfect suite, gate rejected", fill: "url(#hatch)", stroke: LINE },
  { key: "partial", label: "Migrated, behavior lost", fill: "#dcdddf", stroke: null },
  { key: "failed", label: "Never migrated", fill: "#f3f4f5", stroke: LINE },
];

const counts = {};
for (const r of runs) counts[outcomeOf(r)] = (counts[outcomeOf(r)] || 0) + 1;

// --- geometry -------------------------------------------------------------
const CELL = 16;
const GAP = 2.5;
const GROUP_GAP = 7;
const PAD = 42;
const PANEL_W = 306;
const PANEL_GAP = 46;
const AXIS_W = 22; // room for the rotated row-axis label
const AXIS_H = 20; // room for the column-axis label above the grid

const xs = [];
let cursor = 0;
cols.forEach((c, i) => {
  if (i > 0) cursor += cols[i - 1].model === c.model ? CELL + GAP : CELL + GROUP_GAP;
  xs.push(cursor);
});
const gridW = cursor + CELL;
const gridH = tasks.length * CELL + (tasks.length - 1) * GAP;

const W = Math.round(PAD + PANEL_W + PANEL_GAP + AXIS_W + gridW + PAD);
const H = Math.round((W * 9) / 16);

// The grid is the dominant mass, so it is what gets centred — the axis caption
// above it is faint enough that including it in the measure would read as the
// whole field sitting low.
const gridX = PAD + PANEL_W + PANEL_GAP + AXIS_W;
const gridY = Math.round((H - gridH) / 2);
if (gridY < AXIS_H + 8) throw new Error("grid does not fit the 16:9 canvas; reduce CELL");

const at = new Map();
for (const r of runs) at.set(`${r.task}|${r.model}|${r.effort}`, r);

const cellFill = Object.fromEntries(LEGEND.map((l) => [l.key, l.fill]));
const cellStroke = Object.fromEntries(LEGEND.map((l) => [l.key, l.stroke]));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n1 = (x) => (Math.round(x * 10) / 10).toString();

const out = [];
out.push(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="ttl desc">`
);
out.push(`<title id="ttl">SWE Morph Bench: where 520 graded runs stopped</title>`);
out.push(
  `<desc id="desc">A grid of ${runs.length} cells, ${tasks.length} migration rows by ${cols.length} configuration columns. ` +
    LEGEND.map((l) => `${l.label}: ${counts[l.key] ?? 0}`).join(". ") +
    `.</desc>`
);
out.push(
  `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
    `<rect width="4" height="4" fill="#ffffff"/>` +
    `<line x1="0" y1="0" x2="0" y2="4" stroke="${INK3}" stroke-width="1.5"/></pattern></defs>`
);
out.push(`<rect width="${W}" height="${H}" fill="${PAPER}"/>`);

// --- left panel -----------------------------------------------------------
// Laid out against a local origin of 0 so the block's height is known, then
// translated as a unit to sit optically centred against the grid.
const panel = [];
const SW = 11; // legend swatch
let y = 0;
let inkTop = 0; // topmost inked pixel, relative to the local origin
let inkBottom = 0;

const line = (dy, svg, top, bottom) => {
  y += dy;
  panel.push(svg(y));
  inkTop = Math.min(inkTop, y - top);
  inkBottom = Math.max(inkBottom, y + bottom);
};

line(
  0,
  (at) =>
    `<text x="${PAD}" y="${at}" font-family="${SANS}" font-size="11" font-weight="600" letter-spacing="1.7" fill="${INK3}">SWE MORPH BENCH</text>`,
  8,
  0
);
line(
  52,
  (at) =>
    `<text x="${PAD}" y="${at}" font-family="${SERIF}" font-size="42" font-weight="700" fill="${INK}">${runs.length} runs.</text>`,
  30,
  0
);
line(
  46,
  (at) =>
    `<text x="${PAD}" y="${at}" font-family="${SERIF}" font-size="42" font-weight="700" fill="${INK}">${counts.accepted} accepted.</text>`,
  30,
  10
);
line(
  32,
  (at) =>
    `<text x="${PAD}" y="${at}" font-family="${SANS}" font-size="12.5" fill="${INK2}">${tasks.length} whole-repository migrations</text>`,
  9,
  0
);
line(
  18,
  (at) =>
    `<text x="${PAD}" y="${at}" font-family="${SANS}" font-size="12.5" fill="${INK2}">${systems.length} systems · ${cols.length} configurations</text>`,
  9,
  3
);
line(
  24,
  (at) =>
    `<line x1="${PAD}" y1="${at}" x2="${PAD + PANEL_W - 26}" y2="${at}" stroke="${LINE}" stroke-width="1"/>`,
  0,
  0
);

// Legend: swatch, count, label. One row per terminal state. `y` is the swatch
// top here rather than a baseline, so the text rides 1px above its bottom edge.
y += 12;
for (const l of LEGEND) {
  const top = y;
  panel.push(
    `<rect x="${PAD}" y="${top}" width="${SW}" height="${SW}" rx="2" fill="${l.fill}"` +
      (l.stroke ? ` stroke="${l.stroke}" stroke-width="1"` : "") +
      `/>`
  );
  // Right-aligned so 28 and 252 agree on their last digit.
  panel.push(
    `<text x="${PAD + SW + 42}" y="${top + SW - 1}" font-family="${MONO}" font-size="11.5" font-weight="600" fill="${INK}" text-anchor="end">${
      counts[l.key] ?? 0
    }</text>`
  );
  panel.push(
    `<text x="${PAD + SW + 48}" y="${top + SW - 1}" font-family="${SANS}" font-size="11.5" fill="${INK2}">${esc(l.label)}</text>`
  );
  inkBottom = Math.max(inkBottom, top + SW);
  y += 21;
}

const panelDy = Math.round((H - (inkBottom - inkTop)) / 2 - inkTop);
out.push(`<g transform="translate(0 ${panelDy})">`, ...panel, `</g>`);

// --- axis labels ----------------------------------------------------------
out.push(
  `<text x="${gridX}" y="${gridY - 8}" font-family="${SANS}" font-size="10.5" letter-spacing="0.5" fill="${INK4}">${cols.length} configurations, strongest first →</text>`
);
out.push(
  `<text x="${gridX - AXIS_W + 4}" y="${gridY + gridH}" font-family="${SANS}" font-size="10.5" letter-spacing="0.5" fill="${INK4}" transform="rotate(-90 ${
    gridX - AXIS_W + 4
  } ${gridY + gridH})">${tasks.length} migrations</text>`
);

// --- grid -----------------------------------------------------------------
tasks.forEach((t, ri) => {
  const cy = gridY + ri * (CELL + GAP);
  cols.forEach((c, ci) => {
    const r = at.get(`${t.slug}|${c.model}|${c.effort}`);
    if (!r) return;
    const o = outcomeOf(r);
    const stroke = cellStroke[o];
    out.push(
      `<rect x="${n1(gridX + xs[ci])}" y="${n1(cy)}" width="${CELL}" height="${CELL}" rx="2.5" fill="${cellFill[o]}"` +
        (stroke ? ` stroke="${stroke}" stroke-width="1"` : "") +
        `/>`
    );
  });
});

out.push("</svg>");

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join("\n") + "\n");

const drawn = tasks.length * cols.length;
const found = tasks.reduce(
  (a, t) => a + cols.filter((c) => at.has(`${t.slug}|${c.model}|${c.effort}`)).length,
  0
);
console.log(`wrote ${path.relative(process.cwd(), OUT)}  ${W}×${H} (16:9)`);
console.log(`grid ${cols.length} cols × ${tasks.length} rows = ${drawn} slots, ${found} filled`);
console.log("outcomes:", JSON.stringify(counts), "total", Object.values(counts).reduce((a, b) => a + b, 0));
