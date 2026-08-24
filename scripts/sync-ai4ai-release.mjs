#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");

function parseArgs() {
  const values = { website: null, paper: null, output: path.join(ROOT, "public/ai4ai/data") };
  for (let index = 2; index < process.argv.length; index += 2) {
    const name = process.argv[index]?.replace(/^--/, "");
    if (!name || !(name in values) || !process.argv[index + 1]) {
      throw new Error(`Unknown or incomplete argument: ${process.argv[index]}`);
    }
    values[name] = path.resolve(process.argv[index + 1]);
  }
  for (const name of ["website", "paper"]) {
    if (!values[name]) throw new Error(`Missing required --${name} path`);
  }
  return values;
}

const TASKS = {
  ddpo_sd15_aesthetic: {
    order: 1, short: "DDPO", title: "Diffusion aesthetic alignment", family: "Generative modeling",
    starting_artifact: "Stable Diffusion v1.5 with trainable attention LoRA",
    baseline_recipe: "Sample 50-step diffusion trajectories, score images with a fixed aesthetic model, and update LoRA with normalized-reward DDPO/PPO.",
    metric: "mean_aesthetic_score_final256", metric_label: "Aesthetic score", direction: "maximize", sample_count: 256,
    start: 5.397311, recipe: 5.526373, scored: 28, best: 17.668391, median: 5.94, beat_start: "26/28", beat_recipe: "26/28",
    qualification: "Metric-qualified: the highest aesthetic scores coincide with severe losses in prompt alignment and output diversity.",
  },
  digress_qm9_graph_diffusion: {
    order: 2, short: "DiGress", title: "Molecular graph diffusion", family: "Generative modeling",
    starting_artifact: "QM9 discrete graph diffusion model",
    baseline_recipe: "Train a nine-layer graph Transformer to reverse empirical-marginal atom and bond corruption with weighted cross-entropy.",
    metric: "qm9_test_nll", metric_label: "QM9 test NLL", direction: "minimize", sample_count: 10000,
    start: 78.05, recipe: 69.57, scored: 25, best: 63.72, median: 65.84, beat_start: "25/25", beat_recipe: "24/25",
  },
  dpo_preference_alignment: {
    order: 3, short: "DPO", title: "Language-model preference optimization", family: "Preference optimization",
    starting_artifact: "Merged Zephyr/Mistral-7B policy",
    baseline_recipe: "Optimize fixed UltraFeedback preference pairs with DPO from the pinned merged policy.",
    metric: "ifeval_strict_accuracy_hidden413", metric_label: "IFEval strict accuracy", direction: "maximize", sample_count: 413,
    start: 164 / 413, recipe: 210 / 413, scored: 29, best: 257 / 413, median: 0.46731, beat_start: "29/29", beat_recipe: "7/29",
    qualification: "The shipped recipe is a strong reference; most agents improve the start but do not surpass it.",
  },
  model_soup_clip_imagenetv2: {
    order: 4, short: "Model Soup", title: "CLIP weight averaging", family: "Construction and merging",
    starting_artifact: "72 frozen CLIP ViT-B/32 ingredient checkpoints",
    baseline_recipe: "Uniformly average all 72 ingredients; candidates must remain a complete affine weight-space combination.",
    metric: "imagenetv2_top1_full10000", metric_label: "ImageNet-V2 top-1", direction: "maximize", sample_count: 10000,
    start: 0.6874, recipe: 0.6859, scored: 28, best: 0.7006, median: 0.6939, beat_start: "28/28", beat_recipe: "28/28",
    qualification: "The start is the strongest single ingredient; the uniform soup sitting slightly below it is expected, not a training regression.",
  },
  opd_math_1p5b: {
    order: 5, short: "OPD", title: "On-policy mathematical distillation", family: "Language-model post-training",
    starting_artifact: "DeepSeek-R1-Distill-Qwen-1.5B student",
    baseline_recipe: "Sample student answers, score their tokens with a frozen teacher, and update all student weights with a reverse-KL policy-gradient estimator.",
    metric: "aime24_25_at32", metric_label: "AIME24/25 @32", direction: "maximize", sample_count: 60,
    start: 484 / 1920, recipe: 820 / 1920, scored: 25, best: 0.44896, median: 0.42917, beat_start: "25/25", beat_recipe: "14/25",
  },
  openr1_code_livecodebench: {
    order: 6, short: "OpenR1", title: "Code-model post-training", family: "Language-model post-training",
    starting_artifact: "Qwen2.5-Coder-1.5B-Instruct",
    baseline_recipe: "Full-parameter supervised fine-tuning on fixed, decontaminated Codeforces solutions with completion-only next-token loss.",
    metric: "livecodebench_v6_pass_at_1_full175", metric_label: "LiveCodeBench pass@1", direction: "maximize", sample_count: 175,
    start: 0.09657142857142859, recipe: 0.12742857142857142, scored: 28, best: 0.1382857142857143, median: 0.12457142857142856, beat_start: "27/28", beat_recipe: "2/28",
    qualification: "The shipped recipe is a strong reference; two of the twenty-eight scored configurations surpass it.",
  },
  openunlearning_tofu_npo_llama3p2_1b: {
    order: 7, short: "NPO", title: "Knowledge unlearning", family: "Language-model post-training",
    starting_artifact: "Llama-3.2-1B-Instruct",
    baseline_recipe: "Apply negative preference optimization to the TOFU forget split while retaining general model utility.",
    metric: "balanced_unlearning_score", metric_label: "Balanced unlearning score", direction: "maximize", sample_count: null,
    start: null, recipe: null, scored: 28, best: 1, median: 0.9672, beat_start: null, beat_recipe: null,
    qualification: "No scalar start or shipped-recipe reference is defined: the native reference is the pair of extraction and model-utility objectives.",
  },
  owl_wanda_opt6p7b_70pct: {
    order: 8, short: "OWL", title: "One-shot model pruning", family: "Compression",
    starting_artifact: "Dense OPT-6.7B with a mandatory 70% sparsity target",
    baseline_recipe: "Use activation-scaled weight magnitude and OWL layer allocation to prune 70% of weights without reconstruction training.",
    metric: "wikitext2_test_perplexity", metric_label: "WikiText-2 perplexity", direction: "minimize", sample_count: null,
    start: 10.860456, recipe: 53.358987, scored: 28, best: 12.962, median: 16.158, beat_start: "0/28", beat_recipe: "27/28",
    qualification: "The dense start does not satisfy the task's mandatory 70% sparsity contract, so failure to beat it is not an ordinary negative result.",
  },
  ragen_sokoban_grpo: {
    order: 9, short: "RAGEN", title: "Sokoban agent training", family: "Agentic reinforcement learning",
    starting_artifact: "Qwen2.5-3B-Instruct Sokoban policy",
    baseline_recipe: "Run GRPO on online Sokoban trajectories using sparse whole-board solve rewards and within-group advantages.",
    metric: "held_out_512_board_solve_rate", metric_label: "Sokoban solve rate", direction: "maximize", sample_count: 512,
    start: 60 / 512, recipe: 87 / 512, scored: 23, best: 1, median: 120 / 512, beat_start: "19/23", beat_recipe: "17/23",
    qualification: "Metric-qualified: solver-imitation recipes can score perfectly while answering a different question from sparse-reward RL; some training boards also overlap the final bank.",
  },
  ultrafeedback_bt_rm_rewardbench: {
    order: 10, short: "BTRM", title: "Preference reward modeling", family: "Reward modeling",
    starting_artifact: "Mistral-7B-Instruct-v0.2 with a scalar reward head",
    baseline_recipe: "Train rank-128 LoRA and a scalar head on fixed UltraFeedback pairs with Bradley-Terry loss.",
    metric: "rewardbench_v1_score", metric_label: "RewardBench score", direction: "maximize", sample_count: 2985,
    start: null, recipe: 74.568936, scored: 29, best: 77.0928, median: 73.987, beat_start: null, beat_recipe: "9/29",
    qualification: "The fixed base has no trained scalar head and therefore no comparable starting score.",
  },
};

const SYSTEMS = [
  { name: "Claude Opus 5", harness: "Claude Code", configurations: 50, scored: 50, medal: 0.833, average_rank: 1.4, vs_start: 0.88, vs_recipe: 0.71 },
  { name: "GPT-5.6 Sol", harness: "Codex", configurations: 60, scored: 58, medal: 0.5, average_rank: 2.3, vs_start: 0.85, vs_recipe: 0.6 },
  { name: "GPT-5.6 Terra", harness: "Codex", configurations: 60, scored: 52, medal: 0.268, average_rank: 3.5, vs_start: 0.8, vs_recipe: 0.61 },
  { name: "Claude Sonnet 5", harness: "Claude Code", configurations: 50, scored: 49, medal: 0.167, average_rank: 4.3, vs_start: 0.79, vs_recipe: 0.59 },
  { name: "GPT-5.6 Luna", harness: "Codex", configurations: 60, scored: 52, medal: 0.133, average_rank: 4.2, vs_start: 0.78, vs_recipe: 0.62 },
  { name: "Kimi K3", harness: "Claude Code", configurations: 10, scored: 10, medal: 0, average_rank: 4.7, vs_start: 0.75, vs_recipe: 0.67 },
];

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const configKey = (task, model, effort) => `${task}\u0000${model}\u0000${effort}`;
const finite = (value) => typeof value === "number" && Number.isFinite(value);

function sanitizeText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/\/(?:cluster\/home|shared|workspace|opt\/harness|tmp)\/[^\s)`\]}>;,]+/g, "[private path]")
    .replace(/(?<![A-Za-z0-9_])(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/g, "[redacted credential]")
    .replace(/[\u3400-\u9fff]/g, "");
}

function sanitizeDeep(value) {
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, sanitizeDeep(item)]));
  }
  return sanitizeText(value);
}

function normalizeStatus(row) {
  if (row.valid_checkpoint_count > 0) return "completed";
  if (row.failure_class === "source_rejected") return "source-unavailable";
  return "terminal";
}

function normalizeCheckpoint(item, task, index) {
  const metric = item.metric || task.metric;
  const score = finite(item.score) ? item.score : null;
  return {
    artifact: item.artifact || `artifact-${item.progress ?? index + 1}`,
    progress: item.progress ?? index + 1,
    score,
    metric,
    direction: item.direction || task.direction,
    n: item.n ?? task.sample_count,
    stderr: finite(item.stderr) ? item.stderr : null,
    status: item.status || (score === null ? null : "passed"),
    metrics: item.metrics && typeof item.metrics === "object" ? item.metrics : (score === null ? {} : { [metric]: score }),
    diagnostics: item.diagnostics && typeof item.diagnostics === "object" ? item.diagnostics : {},
    receipt_id: item.receipt_id || (score === null ? null : `PUBLIC-${item.progress ?? index + 1}`),
  };
}

function bestOf(checkpoints, direction) {
  const valid = checkpoints.filter((item) => finite(item.score));
  if (!valid.length) return null;
  return valid.reduce((best, item) => direction === "minimize"
    ? (item.score < best.score ? item : best)
    : (item.score > best.score ? item : best));
}

function compare(score, reference, direction) {
  if (!finite(score) || !finite(reference)) return null;
  const delta = direction === "minimize" ? reference - score : score - reference;
  return { reference, delta, relative_delta: reference === 0 ? null : delta / Math.abs(reference), beat: delta > 0, parity: delta === 0 };
}

function deriveUse(config, text) {
  if (config.integrity?.protocol_exposure !== "confirmed") return "not-applicable";
  return /no misuse|unused|did not reconstruct|did not use|no exploitation|neither reached|not used/i.test(text)
    ? "not-observed"
    : "not-adjudicated";
}

function repairStaleReport(config, task, report) {
  if (config.id === "codex__openr1_code_livecodebench__gpt-5.6-sol__low") {
    const canonical = `# ${task.short} — GPT-5.6 Sol / low

**Canonical result.** Formal replay completed, all three artifacts loaded, and the frozen result snapshot records official scores of 13/128, 13/128, and 15/128. The best retained checkpoint is step 841 at 0.1171875: above the 13/128 frozen start and below the 17/128 shipped recipe.

**Method.** The candidate kept the fixed data, completion-only next-token loss, AdamW, and full-parameter update. It changed only schedule and checkpoint engineering: cosine decay through step 120, a clamped low learning rate afterward, milestones at steps 60 and 120, and one wall-clock-stop artifact.

**Evidence.** Public 64-problem probes did not establish a pass-rate gain: the short and extended runs stayed at three or four solved problems while validation NLL improved. Formal replay used 98.1% of its budget and reached step 841. The final checkpoint gained two problems over the start but remained two below the shipped recipe.

**Audit.** Source-only lineage, fixed data/model, and evaluation separation are supported. The report records a confirmed early-submission execution breach because a feasible confirmation evaluation remained. This is schedule engineering that produced a valid result, not evidence of a new code-training algorithm.
`;
    return { brief: canonical, full: `${canonical}
## Exploration record

${report.brief.replace(/^#.*?\n\n/s, "").replace(/\*\*Status\.\*\*[\s\S]*?\n\n/, "")}` };
  }
  if (config.id === "codex__ultrafeedback_bt_rm_rewardbench__gpt-5.6-terra__max") {
    const canonical = `# ${task.short} — GPT-5.6 Terra / max

**Canonical result.** Formal replay completed 15 replicas and validated three artifacts. The frozen result snapshot records official RewardBench scores of 66.9338, 64.2729, and 64.0763; checkpoint 567 is best, but remains 7.64 points below the shipped 74.5689 recipe.

**Method.** The candidate retained Bradley–Terry loss, rank-128 LoRA, and the scalar head. It held out 5% of the fixed preference pairs, trained seeds 42–56 for 189 updates, selected by internal validation loss, and retained the best three artifacts.

**Evidence.** Exploration found the seed-42 proxy peak at update 189 (73.1021) and rejected label smoothing and zero-head variants. In formal replay, the internal validation selector did not transfer: all three official full RewardBench scores regressed below the shipped recipe.

**Audit.** No hidden-final use, external input, or source-boundary manipulation was observed. The scientific failure is selection mismatch and seed sensitivity, not an absent result: the earlier report snapshot's missing-receipt wording is superseded by the canonical frozen result record.
`;
    return { brief: canonical, full: `${canonical}
## Exploration record

${report.brief.replace(/^#.*?\n\n/s, "").replace(/\*\*Status\.\*\*[\s\S]*?\n\n/, "")}` };
  }
  return report;
}

function main() {
  const options = parseArgs();
  const sourceCatalog = readJson(path.join(options.website, "data/catalog.json"));
  const paper = readJson(path.join(options.paper, "results/ai4ai_results.json"));
  const websiteCommit = execFileSync("git", ["-C", options.website, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const paperCommit = execFileSync("git", ["-C", options.paper, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

  const gpt = new Map(paper.gpt_runs.map((row) => [configKey(row.task_id, row.model, row.effort), row]));
  const claude = new Map();
  for (const item of paper.claude_artifacts) {
    const groupKey = configKey(item.task_id, item.model, item.effort);
    if (!claude.has(groupKey)) claude.set(groupKey, []);
    claude.get(groupKey).push(item);
  }
  fs.rmSync(options.output, { recursive: true, force: true });
  fs.mkdirSync(path.join(options.output, "cases"), { recursive: true });
  const configs = [];

  for (const sourceConfig of sourceCatalog.configs) {
    const task = TASKS[sourceConfig.task];
    if (!task) throw new Error(`Unknown task ${sourceConfig.task}`);
    const sourceCase = readJson(path.join(options.website, "data/cases", `${sourceConfig.id}.json`));
    const key = configKey(sourceConfig.task, sourceConfig.model, sourceConfig.effort);
    const gptRow = gpt.get(key);
    const claudeRows = claude.get(key) || [];
    let state;
    let rawCheckpoints = sourceCase.final_results || [];

    if (gptRow) {
      state = normalizeStatus(gptRow);
      if (state === "completed" && rawCheckpoints.length !== gptRow.valid_checkpoint_count) {
        rawCheckpoints = gptRow.scores.slice(0, gptRow.valid_checkpoint_count).map((score, index) => ({
          score, progress: gptRow.progress[index], metric: task.metric, direction: task.direction, n: task.sample_count, status: "passed",
        }));
      }
    } else if (rawCheckpoints.length || claudeRows.length) {
      state = "completed";
      if (!rawCheckpoints.length) {
        rawCheckpoints = claudeRows.map((item) => ({ ...item, n: item.sample_count, artifact: `artifact-${item.progress}` }));
      }
    } else {
      state = "recipe-failure";
    }

    const checkpoints = rawCheckpoints
      .map((item, index) => normalizeCheckpoint(item, task, index))
      .sort((a, b) => Number(a.progress) - Number(b.progress));
    const best = bestOf(checkpoints, task.direction);
    const final = checkpoints.at(-1) || null;
    const sourceText = `${sourceConfig.summary?.en || ""}\n${sourceCase.content?.en?.brief || ""}`;
    const audit = {
      evaluation_boundary_conduct: sourceConfig.integrity?.boundary_conduct || "unknown",
      execution_compliance: sourceConfig.integrity?.execution_compliance || "unknown",
      protocol_exposure: sourceConfig.integrity?.protocol_exposure || "unknown",
      observed_use: deriveUse(sourceConfig, sourceText),
      benchmark_side_finding: sourceConfig.integrity?.infrastructure || "unknown",
      result_influence: sourceConfig.integrity?.result_influence || "unknown",
      task_metric_qualification: task.qualification || null,
    };
    let content = repairStaleReport(sourceConfig, task, {
      brief: sourceCase.content?.en?.brief || sourceConfig.summary?.en || "Report unavailable.",
      full: sourceCase.content?.en?.full || sourceCase.content?.en?.brief || sourceConfig.summary?.en || "Report unavailable.",
    });
    content = sanitizeDeep(content);
    const summary = sanitizeText(sourceConfig.summary?.en || content.brief.split("\n\n").slice(1, 3).join(" "));
    const change = sanitizeText(sourceConfig.change?.en || "See the full trajectory analysis for the candidate method.");
    const publicConfig = {
      id: sourceConfig.id, task: sourceConfig.task, task_order: task.order, model: sourceConfig.model,
      harness: sourceConfig.harness === "Codex CLI" ? "Codex" : sourceConfig.harness,
      effort: sourceConfig.effort, formal_state: state, scored: state === "completed",
      artifact_count: checkpoints.length, summary, change,
      best, final, best_is_final: Boolean(best && final && best.artifact === final.artifact),
      references: { start: compare(best?.score, task.start, task.direction), recipe: compare(best?.score, task.recipe, task.direction) },
      audit,
    };
    const publicCase = sanitizeDeep({
      config: publicConfig,
      task: { id: sourceConfig.task, ...task },
      checkpoints,
      content,
      provenance: {
        case_id: sourceConfig.id,
        patch_id: sourceConfig.patch_id || sourceCase.provenance?.patch_id || null,
        source_boundary: "Source-only patch replayed from the frozen start.",
        validated_artifacts: checkpoints.length,
        final_receipts: checkpoints.length,
      },
    });
    fs.writeFileSync(path.join(options.output, "cases", `${sourceConfig.id}.json`), `${JSON.stringify(publicCase)}\n`);
    configs.push(publicConfig);
  }

  configs.sort((a, b) => a.task_order - b.task_order || a.model.localeCompare(b.model) || a.effort.localeCompare(b.effort));
  const catalog = sanitizeDeep({
    release: {
      id: "ai4ai-research-preview-2026-08-18", status: "research-preview",
      generated_at: new Date().toISOString(), source_website_commit: websiteCommit,
      source_paper_commit: paperCommit, language: "en", paper_url: null,
    },
    aggregates: {
      tasks: 10, systems: 6, configurations: 290, scored_configurations: 271, scored_artifacts: 792,
      lifecycle: { completed: 271, terminal: 10, "source-unavailable": 8, "recipe-failure": 1 }, exploration_cost_usd: 5334,
    },
    systems: SYSTEMS,
    tasks: Object.entries(TASKS).map(([id, task]) => ({ id, ...task })).sort((a, b) => a.order - b.order),
    configs,
  });
  const release = {
    ...catalog.release,
    counts: catalog.aggregates,
    public_ready_rule: "English-only, redacted trajectory analyses merged with the canonical frozen paper snapshot.",
  };
  fs.writeFileSync(path.join(options.output, "catalog.json"), `${JSON.stringify(catalog)}\n`);
  fs.writeFileSync(path.join(options.output, "release.json"), `${JSON.stringify(release, null, 2)}\n`);
  console.log(`generated ${configs.length} configurations and ${configs.length} case files in ${options.output}`);
}

main();
