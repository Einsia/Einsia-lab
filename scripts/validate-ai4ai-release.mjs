#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "public/ai4ai/data");
const rawCatalog = fs.readFileSync(path.join(DATA, "catalog.json"), "utf8");
const rawRelease = fs.readFileSync(path.join(DATA, "release.json"), "utf8");
const catalog = JSON.parse(rawCatalog);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const privatePathPattern = /\/(?:cluster\/home|shared|workspace|opt\/harness|tmp)\/|\/(?:home\/[^/\s"']+|root)\//;
const credentialPattern = /(?<![A-Za-z0-9_])(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/;
const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const localHostPattern = /\b(?:localhost|lj-gpu\d*)\b|\b127\.0\.0\.1\b|\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b192\.168\.\d{1,3}\.\d{1,3}\b|\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/;
const publicChunks = [rawCatalog, rawRelease];

check(catalog.tasks.length === 10, `expected 10 tasks, got ${catalog.tasks.length}`);
check(catalog.systems.length === 6, `expected 6 systems, got ${catalog.systems.length}`);
check(catalog.configs.length === 290, `expected 290 configurations, got ${catalog.configs.length}`);
check(new Set(catalog.configs.map((item) => item.id)).size === 290, "duplicate configuration id");

const states = Object.fromEntries(
  Object.keys(catalog.aggregates.lifecycle).map((state) => [state, catalog.configs.filter((item) => item.formal_state === state).length]),
);
check(JSON.stringify(states) === JSON.stringify(catalog.aggregates.lifecycle), `lifecycle mismatch ${JSON.stringify(states)}`);
check(catalog.configs.filter((item) => item.scored).length === 271, "expected 271 scored configurations");
check(catalog.configs.reduce((sum, item) => sum + item.artifact_count, 0) === 792, "expected 792 scored artifacts");
check(catalog.configs.every((item) => !("case_study" in item)), "catalog exposes editorial case-study labels");

for (const config of catalog.configs) {
  const file = path.join(DATA, "cases", `${config.id}.json`);
  check(fs.existsSync(file), `missing ${file}`);
  const raw = fs.readFileSync(file, "utf8");
  publicChunks.push(raw);
  const data = JSON.parse(raw);
  check(!("case_study" in data.config), `${config.id} exposes an editorial case-study label`);
  check(data.config.formal_state === config.formal_state, `${config.id} state mismatch`);
  check(data.checkpoints.length === config.artifact_count, `${config.id} checkpoint count mismatch`);
  if (config.scored) check(data.checkpoints.length > 0 && config.best?.score !== null, `${config.id} missing a scored checkpoint`);
  else check(config.best === null, `${config.id} turns an unavailable result into a score`);
}

const publicRelease = publicChunks.join("\n");
check(!/[\u3400-\u9fff]/.test(publicRelease), "public release contains Chinese text");
check(!privatePathPattern.test(publicRelease), "public release contains a private absolute path");
check(!credentialPattern.test(publicRelease), "public release contains a credential-like string");
check(!emailPattern.test(publicRelease), "public release contains an email address");
check(!localHostPattern.test(publicRelease), "public release contains a local host or private IP address");
check(!/ta\[redacted credential\]/.test(publicRelease), "public release contains prose corrupted by credential redaction");

const publisherSource = fs.readFileSync(path.join(ROOT, "scripts/sync-ai4ai-release.mjs"), "utf8");
check(!privatePathPattern.test(publisherSource), "publisher source contains a private absolute path");
check(!emailPattern.test(publisherSource), "publisher source contains an email address");

for (const id of [
  "codex__openr1_code_livecodebench__gpt-5.6-sol__low",
  "codex__ultrafeedback_bt_rm_rewardbench__gpt-5.6-terra__max",
]) {
  const item = catalog.configs.find((config) => config.id === id);
  check(item?.formal_state === "completed" && item.artifact_count === 3, `${id} stale final status`);
}

console.log("AI4AI public release validated", { configurations: 290, artifacts: 792, states });
