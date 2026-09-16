import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { podium, modelName } from "./frontierLeaderboard.js";

const DATA = path.join(process.cwd(), "public/frontier-eng/data");
const JS = path.join(process.cwd(), "public/frontier-eng/js");

const loadYaml = (file) =>
  yaml.load(fs.readFileSync(path.join(DATA, file), "utf8"));

const slugify = (name) =>
  name
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

function loadDescriptions() {
  const src = fs.readFileSync(path.join(JS, "taskDescriptions.js"), "utf8");
  const win = {};
  // The file body is `window.TASK_DESCRIPTIONS = { ... }`.
  new Function("window", src)(win);
  return win.TASK_DESCRIPTIONS || {};
}

const rankFor = (rankings, taskName) =>
  (rankings || [])
    .map((p) => ({
      name: p.participant_name,
      score: p.task_scores?.[taskName]?.normalized_score,
    }))
    .filter((r) => typeof r.score === "number")
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1, score: (r.score * 100).toFixed(1) }));

const taskNames = {
  "Cryptographic_AES-128": "crypto_aes128",
  "Cryptographic_SHA-256": "crypto_sha256",
  "Cryptographic_SHA3-256": "crypto_sha3_256",
  "Robotics_DynamicObstacleAvoidanceNavigation": "DynamicObstacleNavigation",
  "Robotics_QuadrupedGaitOptimization": "QuadrupedGait",
  "Robotics_RobotArmCycleTimeOptimization": "RobotArmCycleTime",
};
const taskNameFor = (name) => taskNames[name] || name.slice(name.indexOf("_") + 1);
const currentTasks = Object.fromEntries(
  Object.entries(podium.tasks).map(([name, scores]) => [taskNameFor(name), scores]),
);
const rawFormat = new Intl.NumberFormat("en", { maximumSignificantDigits: 8 });

function modelRankFor(taskName) {
  const task = currentTasks[taskName];
  if (!task) return [];
  const rows = Object.entries(task.model_scores)
    .map(([model, score]) => ({
      name: modelName(model),
      raw: score,
      medal: ({ 1: "Gold", 0.67: "Silver", 0.33: "Bronze" })[task.model_points[model]] || "—",
    }))
    .sort((a, b) => (b.raw ?? -Infinity) - (a.raw ?? -Infinity));
  return rows.map((row) => ({
    ...row,
    rank: row.raw === null ? "—" : 1 + rows.filter((other) => other.raw !== null && other.raw > row.raw).length,
    score: row.raw === null ? "No valid score" : rawFormat.format(row.raw),
  }));
}

/** All tasks (name, domain, slug, description), in benchmark order. */
export function getTasks() {
  const index = loadYaml("tasks_index.yaml").tasks || [];
  const descriptions = loadDescriptions();
  return index.map((t) => ({
    name: t.task_name,
    domain: t.domain,
    slug: slugify(t.task_name),
    description: descriptions[t.task_name]?.en || "",
  }));
}

/** Per-task model + framework leaderboards for a static-paths build. */
export function getTaskPaths() {
  const tasks = getTasks();
  const framework = loadYaml("overall-framework.yaml").rankings || [];
  return tasks.map((task, i) => ({
    params: { task: task.slug },
    props: {
      task,
      prev: i > 0 ? tasks[i - 1] : null,
      next: i < tasks.length - 1 ? tasks[i + 1] : null,
      index: i + 1,
      total: tasks.length,
      model: modelRankFor(task.name),
      framework: rankFor(framework, task.name),
    },
  }));
}
