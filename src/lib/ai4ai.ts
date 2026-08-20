import fs from "node:fs";
import path from "node:path";

const dataRoot = path.join(process.cwd(), "public/ai4ai/data");

export function getAi4aiCatalog() {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, "catalog.json"), "utf8"));
}

export function getAi4aiPoints() {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, "points.json"), "utf8"));
}

export function getAi4aiCase(id: string) {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, "cases", `${id}.json`), "utf8"));
}

export function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "Unavailable";
  const number = Number(value);
  if (Math.abs(number) >= 100) return number.toFixed(2);
  if (Math.abs(number) >= 10) return number.toFixed(3);
  return number.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${(Number(value) * 100).toFixed(1)}%`;
}

export function displayModel(model: string) {
  const names: Record<string, string> = {
    "gpt-5.6-sol": "GPT-5.6 Sol",
    "gpt-5.6-terra": "GPT-5.6 Terra",
    "gpt-5.6-luna": "GPT-5.6 Luna",
    "claude-opus-5": "Claude Opus 5",
    "claude-sonnet-5": "Claude Sonnet 5",
    "kimi-k3": "Kimi K3",
  };
  return names[model] || model;
}

export function displayState(state: string) {
  const names: Record<string, string> = {
    completed: "Completed",
    terminal: "Terminal",
    "source-unavailable": "Source unavailable",
    "recipe-failure": "Recipe failure",
  };
  return names[state] || state;
}

export function displayAudit(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function markdownToHtml(markdown: string) {
  const lines = String(markdown || "Report unavailable.").replace(/\r/g, "").split("\n");
  const output: string[] = [];
  let paragraph: string[] = [];
  let inList = false;
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (inList) output.push("</ul>");
    inList = false;
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = Math.min(4, heading[1].length + 1);
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    const item = trimmed.match(/^[-*]\s+(.+)$/);
    if (item) {
      flushParagraph();
      if (!inList) { output.push("<ul>"); inList = true; }
      output.push(`<li>${inlineMarkdown(item[1])}</li>`);
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      flushParagraph(); closeList(); output.push("<hr />"); continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph(); closeList();
  return output.join("\n");
}

export function getAi4aiTaskGallery() {
  return JSON.parse(fs.readFileSync(path.join(dataRoot, "tasks-gallery.json"), "utf8"));
}

// The task instructions use fenced code blocks and pipe tables, which the general
// markdown helper above does not cover; both carry information a reader of the
// gallery wants (the exact commands, the shipped-solution reference numbers).
export function taskMarkdownToHtml(markdown: string) {
  const blocks = String(markdown || "").split(/\n{2,}/);
  const out: string[] = [];
  let fence: string[] | null = null;

  for (const block of blocks) {
    if (fence) {
      if (block.includes("```")) {
        fence.push(block.replace(/```[a-z]*/g, ""));
        out.push(`<pre><code>${escapeHtml(fence.join("\n\n").trim())}</code></pre>`);
        fence = null;
      } else fence.push(block);
      continue;
    }
    if (block.trimStart().startsWith("```")) {
      const body = block.replace(/^\s*```[a-z]*\n?/, "");
      if (body.includes("```")) {
        out.push(`<pre><code>${escapeHtml(body.replace(/```\s*$/, "").trim())}</code></pre>`);
      } else fence = [body];
      continue;
    }
    const lines = block.split("\n");
    if (lines.length > 1 && lines[0].includes("|") && /^\s*\|?[\s:|-]+\|/.test(lines[1])) {
      const rows = lines.filter((line) => line.includes("|") && !/^\s*\|?[\s:|-]+\|/.test(line));
      const cells = rows.map((row) => row.split("|").map((c) => c.trim()).filter((c, i, a) => !(c === "" && (i === 0 || i === a.length - 1))));
      const [head, ...body] = cells;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inlineMarkdown(c)}</th>`).join("")}</tr></thead>` +
        `<tbody>${body.map((row) => `<tr>${row.map((c) => `<td>${inlineMarkdown(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
      );
      continue;
    }
    out.push(markdownToHtml(block));
  }
  return out.join("\n");
}
