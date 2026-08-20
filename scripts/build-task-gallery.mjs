// Build the Task Gallery data from the benchmark repository.
//
// Reads ../AI4AI-Bench/tasks/<task>/{task.toml, instruction.md} plus the file tree
// of environment/, harness/ and solution/, and writes the JSON the gallery pages
// read. Only a documented subset of TOML appears in these files, so the parser
// below covers exactly that: tables, quoted keys, strings, numbers, arrays and
// inline tables.

import fs from "node:fs";
import path from "node:path";

const TASKS_DIR = path.resolve("../AI4AI-Bench/tasks");
const OUT = path.resolve("public/ai4ai/data/tasks-gallery.json");

const SHORT = {
  openr1_code_livecodebench: ["OpenR1", "supervised fine-tuning"],
  ragen_sokoban_grpo: ["RAGEN", "multi-turn agentic RL"],
  opd_math_1p5b: ["OPD", "on-policy distillation"],
  ultrafeedback_bt_rm_rewardbench: ["BTRM", "reward modelling"],
  dpo_preference_alignment: ["DPO", "preference optimization"],
  ddpo_sd15_aesthetic: ["DDPO", "diffusion RL"],
  openunlearning_tofu_npo_llama3p2_1b: ["NPO", "machine unlearning"],
  digress_qm9_graph_diffusion: ["DiGress", "discrete graph diffusion"],
  model_soup_clip_imagenetv2: ["Model Soup", "weight averaging"],
  owl_wanda_opt6p7b_70pct: ["OWL", "one-shot pruning"],
};

const scalar = (raw) => {
  const value = raw.trim();
  if (value.startsWith('"')) return value.slice(1, -1);
  if (value.startsWith("[")) {
    return value.slice(1, -1).split(",").map((v) => v.trim().replace(/^"|"$/g, "")).filter(Boolean);
  }
  if (value.startsWith("{")) {
    return Object.fromEntries(
      value.slice(1, -1).split(",").map((pair) => {
        const [k, v] = pair.split("=");
        return [k.trim(), scalar(v ?? "")];
      }),
    );
  }
  if (/^-?\d+$/.test(value)) return Number(value);
  if (value === "true" || value === "false") return value === "true";
  return value;
};

function parseToml(text) {
  const out = {};
  let table = out;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const header = trimmed.match(/^\[([^\]]+)\]$/);
    if (header) {
      table = out;
      for (const part of header[1].split(".")) {
        const key = part.replace(/^"|"$/g, "");
        table[key] = table[key] ?? {};
        table = table[key];
      }
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^"|"$/g, "");
    table[key] = scalar(trimmed.slice(eq + 1));
  }
  return out;
}

const listFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, bytes: fs.statSync(path.join(dir, entry.name)).size }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// The instruction is long and structured by "## " headings; keep the opening
// paragraphs and the sections a reader of the gallery actually wants.
function sliceInstruction(markdown) {
  const lines = markdown.split("\n");
  const sections = [];
  let current = { heading: null, body: [] };
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      sections.push(current);
      current = { heading: heading[1].trim(), body: [] };
      continue;
    }
    if (/^#\s+/.test(line)) continue;
    current.body.push(line);
  }
  sections.push(current);
  return sections
    .map((section) => ({ heading: section.heading, body: section.body.join("\n").trim() }))
    .filter((section) => section.body);
}

const tasks = fs
  .readdirSync(TASKS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const dir = path.join(TASKS_DIR, entry.name);
    const toml = parseToml(fs.readFileSync(path.join(dir, "task.toml"), "utf8"));
    const instruction = fs.readFileSync(path.join(dir, "instruction.md"), "utf8");
    const [short, family] = SHORT[entry.name] ?? [entry.name, ""];
    const meta = toml.metadata ?? {};
    const env = toml.environment ?? {};
    return {
      id: entry.name,
      short,
      family,
      title: instruction.split("\n")[0].replace(/^#\s*/, ""),
      description: toml.task?.description ?? "",
      version: toml.task?.version ?? "",
      shippedMethod: meta.shipped_method ?? "",
      shippedSource: meta.shipped_method_source ?? "",
      baseModel: meta.base_model ?? "",
      trainData: meta.train_data ?? "",
      fastMetric: meta.fast_metric ?? "",
      fastDirection: meta.fast_direction ?? "",
      finalMetric: meta.final_metric ?? "",
      finalDirection: meta.final_direction ?? "",
      finalGate: meta.final_gate ?? "",
      agentSeconds: toml.agent?.timeout_sec ?? null,
      verifierSeconds: toml.verifier?.timeout_sec ?? null,
      retrainSeconds: toml["x-ai4ai"]?.formal?.retrain_budget_sec ?? null,
      artifactLimit: toml["x-ai4ai"]?.formal?.artifact_limit ?? null,
      selectionRule: toml["x-ai4ai"]?.formal?.selection_rule ?? "",
      gpu: (env.gpu_types ?? [])[0] ?? "",
      gpus: env.gpus ?? null,
      cpus: env.cpus ?? null,
      memoryMb: env.memory_mb ?? null,
      network: env.network_mode ?? "",
      peakMemoryMib: toml["x-ai4ai"]?.gpu?.peak_memory_mib ?? null,
      assets: Object.entries(toml.assets ?? {}).map(([slot, source]) => ({ slot, source })),
      files: {
        solution: listFiles(path.join(dir, "solution")),
        harness: listFiles(path.join(dir, "harness")),
        environment: listFiles(path.join(dir, "environment")),
      },
      instruction: sliceInstruction(instruction),
    };
  })
  .sort((a, b) => a.short.localeCompare(b.short));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ tasks }, null, 1));
console.log(`wrote ${OUT}: ${tasks.length} tasks`);
