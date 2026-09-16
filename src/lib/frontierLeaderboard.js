import fs from "node:fs";
import path from "node:path";

const data = path.join(process.cwd(), "public/frontier-eng/data");
export const leaderboard = JSON.parse(
  fs.readFileSync(path.join(data, "medal_leaderboard.json"), "utf8"),
);
export const podium = JSON.parse(
  fs.readFileSync(path.join(data, "medal_podium.json"), "utf8"),
);

const names = {
  "claude-opus-4.6": "Claude Opus 4.6",
  "deepseek-v3.2": "DeepSeek V3.2",
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview",
  "glm-5": "GLM-5",
  "gpt-5.4": "GPT-5.4",
  "grok-4.20": "Grok 4.20",
  "qwen3-coder-next": "Qwen3 Coder Next",
  "seed-2.0-pro": "Seed 2.0 Pro",
};
export const modelName = (model) => names[model] || model;
const display = (rows) => rows.map((row) => ({
  rank: row.rank,
  model: modelName(row.model),
  score: row.medal.toFixed(3),
  g: row.gold, s: row.silver, b: row.bronze,
}));

export const medalV1 = display(leaderboard.v1.leaderboard);
export const medalLite = display(leaderboard.v1_lite.leaderboard);
export const sourceUrl = `${leaderboard.source.repository}/tree/${leaderboard.source.commit}/leaderboard`;
