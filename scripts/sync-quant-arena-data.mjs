/**
 * Copy the published Quant Arena tables into src/data/quant-arena/*.json.
 *
 * The paper workspace is the single source of truth. Only public columns are
 * kept: identifiers and bookkeeping columns in the source files are dropped.
 *
 *   node scripts/sync-quant-arena-data.mjs [path/to/arena-reports]
 *
 * Figures are re-exported to public/quant-arena/*.webp when `cwebp` is on PATH.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const source = path.resolve(process.argv[2] ?? path.join(os.homedir(), "arena-reports"));
const files = {
  raw: path.join(source, "paper/raw-data-final.md"),
  representatives: path.join(source, "scripts/paper-figures-v1/data/representatives-final.csv"),
  max: path.join(source, "paper/maintable-max-V3NE.csv"),
  png: path.join(source, "scripts/paper-figures-v1/build/max/png"),
};
const outDir = path.join(repo, "src/data/quant-arena");
const figureDir = path.join(repo, "public/quant-arena");
const figures = ["fig_nav_max", "fig_effort_bars", "fig_signal_quantiles_max", "fig_investment_styles_max"];

const families = [
  { short: "Opus", model: "Claude Opus 5.5", color: "#E07B4F" },
  { short: "Sonnet", model: "Claude Sonnet 5.5", color: "#B0607E" },
  { short: "Astra", model: "GPT-6 Astra", color: "#4E79D8" },
  { short: "Sol", model: "GPT-6 Sol", color: "#5E8CA8" },
  { short: "Terra", model: "GPT-5.6 Terra", color: "#A97A3F" },
  { short: "Gemini", model: "Gemini 3.8 Flash", color: "#9370D0" },
  { short: "DeepSeek", model: "DeepSeek V4.1 Flash", color: "#2FA59A" },
  { short: "Kimi", model: "Kimi K3", color: "#7E9F3A" },
  { short: "GLM", model: "GLM-5.3", color: "#D9578E" },
];
const familyByShort = new Map(families.map((family) => [family.short, family]));
const familyByModel = new Map(families.map((family) => [family.model, family]));
const effortLabel = { none: "None", low: "Low", medium: "Medium", high: "High", xhigh: "XHigh", max: "Max" };
const settingLabel = { Iterative: "iterative", "One-shot": "oneshot", vanilla: "iterative", oneshot: "oneshot" };

const parseCsv = (text) => {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [keys[index], value])));
};
// "−7.8%" -> -0.078, "−24.9" -> -24.9, "–" -> null
const parseCell = (value, { percent = false } = {}) => {
  const text = value.trim().replace(/−/g, "-").replace("%", "");
  if (text === "" || text === "–" || text === "-") return null;
  const number = Number(text);
  if (Number.isNaN(number)) throw new Error(`Not a number: ${value}`);
  return percent ? number / 100 : number;
};
const round = (value, digits) => (value == null ? null : Number(value.toFixed(digits)));

const rawRows = (await readFile(files.raw, "utf8"))
  .split("\n")
  .filter((line) => /^\| [A-Z]/.test(line) && !line.startsWith("| model"))
  .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
const representatives = parseCsv(await readFile(files.representatives, "utf8"));
const precise = new Map(
  representatives.map((row) => [`${settingLabel[row.track] ?? row.track}|${row.model}|${row.effort}`, row]),
);

const rows = rawRows.map(([short, setting, effort, total, sIn, sOut, arr, excess, rankIc, sharpe, mdd]) => {
  const reference = setting === "Reference";
  const family = familyByShort.get(short);
  const model = reference ? short : family.model;
  const track = reference ? "reference" : settingLabel[setting];
  const exact = precise.get(`${track}|${model}|${reference ? "" : effort}`);
  if (!exact) throw new Error(`No representative score for ${short} ${setting} ${effort}`);
  if (Math.abs(Number(exact.V3NE) - parseCell(total)) > 0.006) {
    throw new Error(`Score mismatch for ${short} ${setting} ${effort}: ${exact.V3NE} vs ${total}`);
  }
  return {
    model,
    short,
    track,
    effort: reference ? null : effortLabel[effort],
    total: round(Number(exact.V3NE), 2),
    sIn: round(Number(exact.S_in), 2),
    sOut: round(Number(exact.S_out), 2),
    arr: round(parseCell(arr, { percent: true }), 4),
    excess: parseCell(excess),
    rankIc: parseCell(rankIc),
    sharpe: parseCell(sharpe),
    mdd: round(parseCell(mdd, { percent: true }), 4),
  };
});
if (rows.length !== representatives.length) {
  throw new Error(`Expected ${representatives.length} rows, parsed ${rows.length}`);
}

const maxRows = parseCsv(await readFile(files.max, "utf8")).map((row) => {
  const reference = row.track === "reference";
  const value = (key, digits) => (row[key] === "" ? null : round(Number(row[key]), digits));
  return {
    model: row.model,
    short: row.short,
    track: reference ? "reference" : settingLabel[row.track],
    effort: reference ? null : effortLabel[row.effort],
    total: value("V3NE", 2),
    sIn: value("V3NE_S_in", 2),
    sOut: value("V3NE_S_out", 2),
    arr: value("arr_2024", 4),
    excess: row.excess_2024 === "" ? null : round(Number(row.excess_2024) * 100, 2),
    rankIc: value("rank_ic_2024", 3),
    sharpe: value("sharpe_2024", 2),
    mdd: value("mdd_2024", 4),
  };
});
for (const row of maxRows) {
  if (row.track !== "reference" && !familyByModel.has(row.model)) throw new Error(`Unknown model ${row.model}`);
}

await mkdir(outDir, { recursive: true });
const write = (name, data) => writeFile(path.join(outDir, name), `${JSON.stringify(data, null, 2)}\n`);
await write("families.json", families);
await write("leaderboard.json", rows);
await write("max-effort.json", maxRows);
console.log(`Wrote ${rows.length} leaderboard rows and ${maxRows.length} max-effort rows to ${outDir}`);

try {
  await mkdir(figureDir, { recursive: true });
  for (const name of figures) {
    const output = path.join(figureDir, `${name.replaceAll("_", "-")}.webp`);
    execFileSync("cwebp", ["-quiet", "-q", "82", "-m", "6", path.join(files.png, `${name}.png`), "-o", output]);
  }
  console.log(`Exported ${figures.length} figures to ${figureDir}`);
} catch (error) {
  console.warn(`Skipped figure export: ${error.message}`);
}
