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
for (const text of ["271/290", "792", "175/214", "152/243", "16/86", "Research preview"]) {
  check(home.includes(text), `homepage missing ${text}`);
}
check(research.includes("AI4AI-Bench") && research.includes("/ai4ai/figures/teaser.webp"), "Research card missing");
check((explorer.match(/ data-case-card(?: |\>)/g) || []).length === 290, "Explorer does not render 290 static cards");
check(explorer.includes("data-ai4ai-explorer") && explorer.includes("URLSearchParams"), "Explorer filter bundle missing");
check(!explorer.includes(">Selection<") && !explorer.includes(">Case study<"), "Explorer exposes editorial selection labels");
check(!home.includes("case=selected"), "Homepage exposes an editorial selection link");

const caseRoot = path.join(DIST, "ai4ai/trajectories");
const caseDirs = fs.readdirSync(caseRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
check(caseDirs.length === 290, `expected 290 case routes, got ${caseDirs.length}`);
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
for (const [pattern, label] of banned) check(!pattern.test(publicHtml), `AI4AI build contains ${label}`);

console.log("AI4AI built site validated", { cases: caseDirs.length, homepage: true, explorer: true });
