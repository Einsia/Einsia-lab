#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const read = (relative) => fs.readFileSync(path.join(DIST, relative), "utf8");
const check = (condition, message) => { if (!condition) throw new Error(message); };

const home = read("ai4ai/index.html");
const explorer = read("ai4ai/trajectories/index.html");
const research = read("research/index.html");
const points = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/ai4ai/data/points.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/ai4ai/data/catalog.json'), 'utf8'));
for (const text of [String(points.overall.cells), points.overall.mean.toFixed(3), String(points.overall.belowBaseline), "Ten frozen research projects", "Citation", "/ai4ai/figures/task-cards.webp", "arxiv.org/abs/2608.20318"]) {
  check(home.includes(text), `homepage missing ${text}`);
}
check(research.includes("AI4AI-Bench") && research.includes("/ai4ai/figures/logo-banner.webp") && research.includes('href="/ai4ai/"'), "Research entry missing");
check((explorer.match(/ data-case-card(?: |\>)/g) || []).length === catalog.configs.length, "Explorer card count differs from catalog");
const explorerScripts = [...explorer.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(([, src]) => src).filter(src => src.startsWith('/_astro/'));
check(explorer.includes("data-ai4ai-explorer") && (explorer.includes("URLSearchParams") || explorerScripts.some(src => read(src.replace(/^\//, '')).includes("URLSearchParams"))), "Explorer filter bundle missing");
check(!explorer.includes(">Selection<") && !explorer.includes(">Case study<"), "Explorer exposes editorial selection labels");
check(!home.includes("case=selected"), "Homepage exposes an editorial selection link");

const caseRoot = path.join(DIST, "ai4ai/trajectories");
const caseDirs = fs.readdirSync(caseRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
check(caseDirs.length === catalog.configs.length, `expected ${catalog.configs.length} case routes, got ${caseDirs.length}`);
for (const config of catalog.configs) check(caseDirs.some(entry => entry.name === config.id), `missing case route ${config.id}`);
let publicHtml = `${home}\n${explorer}`;
for (const entry of caseDirs) {
  const html = read(path.join("ai4ai/trajectories", entry.name, "index.html"));
  check(html.includes("Best of up to 3 retained checkpoints"), `${entry.name} missing checkpoint rule`);
  check(html.includes("What the agent changed"), `${entry.name} missing algorithm explanation`);
  check(html.includes("Audit and provenance"), `${entry.name} missing public audit`);
  publicHtml += `\n${html}`;
}

const ddpo = read("ai4ai/trajectories/claude__ddpo_sd15_aesthetic__claude-opus-5__max/index.html");
check(ddpo.includes("Aesthetic score versus alignment and diversity"), "DDPO diagnostic qualification missing");
for (const value of ["17.6684", "0.1085", "0.0471"]) check(ddpo.includes(value), `DDPO diagnostic ${value} missing`);
const ragen = read("ai4ai/trajectories/claude__ragen_sokoban_grpo__claude-opus-5__high/index.html");
for (const text of ["GRPO improvement", "solver imitation", "response format"]) check(ragen.includes(text), `RAGEN qualification missing ${text}`);

const banned = [
  [/[㐀-鿿]/, "Chinese text"],
  [/\/(?:cluster\/home|shared|workspace|opt\/harness|tmp)\//, "private absolute path"],
  [/#(?:10b981|16a34a|22c55e|059669)/i, "old green brand color"],
  [/Best sealed final/i, "obsolete result wording"],
  [/mark as (?:valuable|problematic)|public annotation/i, "public annotation control"],
  [/(?<![A-Za-z0-9_])(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/, "credential-like string"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, "email address"],
  [/\b(?:localhost|lj-gpu\d*)\b|\b127\.0\.0\.1\b|\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b192\.168\.\d{1,3}\.\d{1,3}\b|\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/, "local host or private IP address"],
];
// The published Chinese media outlet name is a resource label, not report prose.
for (const [pattern, label] of banned) check(!pattern.test(publicHtml.replaceAll('机器之心', '')), `AI4AI build contains ${label}`);

console.log("AI4AI built site validated", { cases: caseDirs.length, homepage: true, explorer: true });
