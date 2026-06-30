import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

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
  const model = loadYaml("overall-model.yaml").rankings || [];
  const framework = loadYaml("overall-framework.yaml").rankings || [];
  return tasks.map((task, i) => ({
    params: { task: task.slug },
    props: {
      task,
      prev: i > 0 ? tasks[i - 1] : null,
      next: i < tasks.length - 1 ? tasks[i + 1] : null,
      index: i + 1,
      total: tasks.length,
      model: rankFor(model, task.name),
      framework: rankFor(framework, task.name),
    },
  }));
}
