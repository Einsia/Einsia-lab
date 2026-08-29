/**
 * Public, paper-aligned data used by the PPTBench showcase pages.
 *
 * The release keeps the large task payloads out of this site.  The page only
 * carries the small summary tables and a curated set of representative
 * previews, so the benchmark page stays fast and remains easy to audit.
 */

export const domains = [
  ["Systems, architecture & software engineering", 91],
  ["AI & machine learning", 90],
  ["Computer vision & imaging", 67],
  ["Language, speech & audio", 54],
  ["Quantum & fundamental physics", 43],
  ["Astronomy & astrophysics", 37],
  ["Robotics & human–computer interaction", 29],
  ["Networks, security & information systems", 25],
  ["Biomedical & life sciences", 19],
  ["Signal processing & control", 17],
  ["Materials & condensed matter", 12],
  ["Social computing & economics", 10],
  ["Other science & instrumentation", 6],
];

export const representatives = [
  [
    "task_0526-reference.png",
    "Systems & software",
    "TDFlow · agentic workflows for test-driven development",
  ],
  [
    "task_0032-reference.png",
    "AI & machine learning",
    "Connector · graph representation learning architecture",
  ],
  [
    "task_0452-reference.png",
    "Computer vision & imaging",
    "Interpretable neural architecture search",
  ],
  [
    "task_0935-reference.png",
    "Language, speech & audio",
    "Hybrid architectures for efficient LLMs",
  ],
  [
    "task_0489-reference.png",
    "Quantum & fundamental physics",
    "Cryogenic predecoder for surface-code decoding",
  ],
  [
    "task_0079-reference.png",
    "Astronomy & astrophysics",
    "HERA validation pipeline",
  ],
  [
    "task_0116-reference.png",
    "Robotics & HCI",
    "ROS 2 intrusion prevention architecture",
  ],
  [
    "task_0583-reference.png",
    "Materials & condensed matter",
    "DFT workflow across implementations",
  ],
  [
    "task_0443-reference.png",
    "Social computing & economics",
    "Network rewiring and systemic risk",
  ],
  [
    "task_0113-reference.png",
    "Biomedical & life sciences",
    "MegaFold protein-model architecture",
  ],
  [
    "task_0277-reference.png",
    "Signal processing & control",
    "Aircraft radar interference mitigation",
  ],
  [
    "task_0479-reference.png",
    "Science & instrumentation",
    "Nab data acquisition architecture",
  ],
  [
    "task_0829-reference.webp",
    "Networks & security",
    "IsolateGPT execution-isolation architecture",
  ],
];

// [model, harness, effort, final score, gate pass rate, conditional detail,
// generation cost in USD].  Values are the paper's frozen leaderboard.
export const leaderboard = [
  ["Kimi K3", "OpenCode", "High", 67.8, 73.8, 91.9, 1158],
  ["GPT-5.6 Sol", "Codex", "Max", 49.28, 52.6, 93.7, 988],
  ["Qwen 3.8 Max", "Claude Code", "XHigh", 47.69, 53.2, 89.6, 307],
  ["GPT-5.6 Sol", "Generator-Critic", "Medium", 36.7, 40.4, 90.8, 564],
  ["GPT-5.6 Sol", "Codex", "XHigh", 36.24, 40.0, 90.6, 495],
  ["Claude Opus 5", "Claude Code", "XHigh", 35.91, 43.6, 82.4, 685],
  ["Claude Opus 5", "Claude Code", "Max", 33.54, 40.8, 82.2, 719],
  ["GPT-5.6 Terra", "Codex", "Max", 33.46, 37.4, 89.5, 283],
  ["Claude Opus 5", "Claude Code", "High", 33.12, 40.8, 81.2, 365],
  ["GLM-5.3-Flash", "OpenCode", "Max", 32.41746, 36.8, 88.0909, 52.525738],
  ["GPT-5.6 Luna", "Codex", "Max", 31.02, 36.4, 85.2, 166],
  ["GPT-5.6 Sol", "Codex", "High", 28.28, 31.8, 88.9, 285],
  ["GPT-5.6 Terra", "Codex", "XHigh", 25.84, 29.6, 87.3, 125],
  ["GPT-5.6 Luna", "Codex", "XHigh", 24.63, 29.0, 84.9, 87],
  ["Claude Opus 5", "Claude Code", "Medium", 24.13, 31.2, 77.3, 132],
  ["GPT-5.6 Sol", "Codex", "Medium", 22.2, 25.4, 87.4, 182],
  ["GPT-5.6 Luna", "Codex", "High", 19.47, 23.8, 81.8, 57],
  ["Claude Opus 5", "Claude Code", "Low", 17.9, 23.6, 75.8, 73],
  ["GPT-5.6 Terra", "Codex", "High", 16.89, 19.4, 87.1, 81],
  ["GPT-5.6 Sol", "Codex", "Low", 11.12, 13.0, 85.5, 123],
  ["GPT-5.6 Terra", "Codex", "Medium", 10.1, 12.0, 84.2, 62],
  ["GPT-5.5", "Codex", "Medium", 9.64, 11.4, 84.6, 262],
  ["Claude Sonnet 5", "Claude Code", "XHigh", 8.98, 12.8, 70.2, 214],
  ["Claude Sonnet 5", "Claude Code", "High", 8.76, 12.4, 70.6, 137],
  ["GPT-5.6 Terra", "Codex", "Low", 8.6, 9.8, 87.8, 58],
  ["GPT-5.6 Luna", "Codex", "Medium", 8.15, 10.0, 81.5, 31],
  ["Claude Sonnet 5", "Claude Code", "Medium", 5.99, 9.2, 65.1, 99],
  ["GPT-5.6 Sol", "Codex", "None", 4.99, 5.8, 86.0, 117],
  ["Claude Sonnet 5", "Claude Code", "Low", 4.03, 6.4, 63.0, 61],
  ["GPT-5.6 Terra", "Codex", "None", 3.55, 4.2, 84.5, 45],
  ["GPT-5.6 Luna", "Codex", "Low", 3.03, 3.6, 84.2, 21],
  ["GPT-5.6 Luna", "Codex", "None", 1.53, 1.8, 85.0, 22],
];

export const tokenByKey = new Map([
  ["GPT-5.6 Sol|Codex|None", 83655],
  ["GPT-5.6 Sol|Codex|Low", 93026],
  ["GPT-5.6 Sol|Codex|Medium", 146793],
  ["GPT-5.6 Sol|Codex|High", 254199],
  ["GPT-5.6 Sol|Codex|XHigh", 531671],
  ["GPT-5.6 Sol|Codex|Max", 1370852],
  ["GPT-5.6 Sol|Generator-Critic|Medium", 544494],
  ["GPT-5.6 Terra|Codex|None", 70522],
  ["GPT-5.6 Terra|Codex|Low", 119274],
  ["GPT-5.6 Terra|Codex|Medium", 111330],
  ["GPT-5.6 Terra|Codex|High", 152878],
  ["GPT-5.6 Terra|Codex|XHigh", 207341],
  ["GPT-5.6 Terra|Codex|Max", 565341],
  ["GPT-5.6 Luna|Codex|None", 77709],
  ["GPT-5.6 Luna|Codex|Low", 76986],
  ["GPT-5.6 Luna|Codex|Medium", 131364],
  ["GPT-5.6 Luna|Codex|High", 255343],
  ["GPT-5.6 Luna|Codex|XHigh", 410524],
  ["GPT-5.6 Luna|Codex|Max", 1056879],
  ["GPT-5.5|Codex|Medium", 243908],
  ["Claude Opus 5|Claude Code|Low", 87561],
  ["Claude Opus 5|Claude Code|Medium", 159533],
  ["Claude Opus 5|Claude Code|High", 511632],
  ["Claude Opus 5|Claude Code|XHigh", 896363],
  ["Claude Opus 5|Claude Code|Max", 1001465],
  ["Claude Sonnet 5|Claude Code|Low", 194207],
  ["Claude Sonnet 5|Claude Code|Medium", 371068],
  ["Claude Sonnet 5|Claude Code|High", 572255],
  ["Claude Sonnet 5|Claude Code|XHigh", 895365],
  ["Qwen 3.8 Max|Claude Code|XHigh", 1067521],
  ["Kimi K3|OpenCode|High", 3486485],
  ["GLM-5.3-Flash|OpenCode|Max", 2381120],
]);

// Published dimensions and generation accounting for the GLM run. Keep these
// separate from the compact seven-field leaderboard tuple so older consumers
// can continue to read the paper-aligned summary. In that legacy tuple,
// `gatePass` is the surviving/pass percentage (100 - the raw consensus gate
// rate), while the raw 63.2% value remains available to audit consumers.
const glmKey = "GLM-5.3-Flash|OpenCode|Max";
export const scoreBreakdownByKey = new Map([
  [glmKey, {
    candidateId: "glm-5.3-flash__max__opencode",
    gateRate: 63.2,
    layout: 10.44946,
    text: 12.60906,
    local: 9.35894,
  }],
]);

export const generationMetricsByKey = new Map([
  [glmKey, {
    candidateId: "glm-5.3-flash__max__opencode",
    taskCount: 500,
    validArtifacts: 453,
    invalidArtifacts: 47,
    failedTasks: 0,
    totalTokens: 1190559998,
    averageTokensPerTask: 2381120,
    totalCostUsd: 52.525738,
    averageCostPerTaskUsd: 0.105051,
    usageStatus: "complete",
  }],
]);

export const familyStyles = {
  "GPT-5.6 Sol": "#3f718d",
  "GPT-5.6 Sol · Generator–Critic": "#536f80",
  "GPT-5.6 Terra": "#a26d34",
  "GPT-5.6 Luna": "#7b5a9d",
  "GPT-5.5": "#526777",
  "Claude Opus 5": "#b45858",
  "Claude Sonnet 5": "#3c8a6e",
  "GLM-5.3-Flash": "#3f806f",
  "Qwen 3.8 Max": "#de7b31",
  "Kimi K3": "#1d4f86",
};

// The chart is read left-to-right, so keep the ordering rules next to the
// grouped data instead of relying on the source row order. Effort labels are
// ordered from the deepest reasoning setting to the shallowest one.
const effortOrder = ["None", "Low", "Medium", "High", "XHigh", "Max"];
const effortIndex = (value) => {
  const index = effortOrder.indexOf(String(value));
  return index === -1 ? -1 : index;
};

const familyOrder = [
  "Kimi K3",
  "GPT-5.6 Sol",
  "GPT-5.6 Sol · Generator–Critic",
  "Qwen 3.8 Max",
  "Claude Opus 5",
  "GLM-5.3-Flash",
  "GPT-5.6 Terra",
  "GPT-5.6 Luna",
  "Claude Sonnet 5",
  "GPT-5.5",
];

export const leaderboardGroups = familyOrder.map((name) => ({
  name,
  color: familyStyles[name],
  rows: leaderboard
    .filter(([model, harness]) =>
      name.includes("Generator")
        ? model === "GPT-5.6 Sol" && harness === "Generator-Critic"
        : model === name && harness !== "Generator-Critic",
    )
    .sort((a, b) => {
      // Reverse the natural effort order so Max appears first in each family.
      // Score is a deterministic tie-break for any repeated effort label.
      return effortIndex(b[2]) - effortIndex(a[2]) || Number(b[3]) - Number(a[3]);
    }),
})).sort((a, b) => {
  const bestScore = (group) => Math.max(...group.rows.map((row) => Number(row[3])));
  const scoreDelta = bestScore(b) - bestScore(a);
  // Keep declaration order as a deterministic tie-break if two families share
  // the same best score.
  return scoreDelta || familyOrder.indexOf(a.name) - familyOrder.indexOf(b.name);
});

export const effortOpacity = {
  None: 0.34,
  Low: 0.45,
  Medium: 0.58,
  High: 0.7,
  XHigh: 0.84,
  Max: 1,
};

export const formatUsd = (value) => `$${value.toLocaleString("en-US")}`;
export const formatTokens = (value) => `${(value / 1000).toFixed(0)}k`;
