// The landing page's result figure: mean score by system and reasoning effort.
// One group per model, one bar per effort, the tops joined so the effort ladder is
// visible, and each bar labelled with what that configuration scored and what its
// four hours of exploration cost. Hand-built SVG; no charting dependency.

type Configuration = {
  model: string;
  modelLabel: string;
  effort: string;
  harness: string;
  cost: number | null;
  mean: number;
  tokens: number;
};

type Point = { task: string; taskShort: string; family: string; model: string; effort: string; score: number; tokens: number };

type Payload = {
  points: Point[];
  configurations: Configuration[];
  ladder: { floor: number; baseline: number; optimum: number };
  tasks: { id: string; short: string; family: string; mean: number }[];
  systems: { id: string; label: string; mean: number; cells: number }[];
  overall: { mean: number; cells: number; belowBaseline: number };
};

const COLOR: Record<string, string> = {
  "claude-opus-5": "#E0863F",
  "claude-sonnet-5": "#E3A63C",
  "kimi-k3": "#8C939B",
  "gpt-5.6-sol": "#3E7CB4",
  "gpt-5.6-terra": "#4E9AA6",
  "gpt-5.6-luna": "#57A06C",
};
const ORDER = ["claude-opus-5", "claude-sonnet-5", "kimi-k3", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
const EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"];
const ALPHA: Record<string, number> = { none: 0.34, low: 0.46, medium: 0.58, high: 0.72, xhigh: 0.86, max: 1 };

const SVG = "http://www.w3.org/2000/svg";
const el = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}) => {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};

const root = document.querySelector<HTMLElement>("[data-ai4ai-bars]");

if (root) {
  const plot = root.querySelector<HTMLElement>("[data-plot]")!;
  const tooltip = root.querySelector<HTMLElement>("[data-tooltip]")!;
  const taskSelect = root.querySelector<HTMLSelectElement>("[data-task-filter]")!;
  const readout = root.querySelector<HTMLElement>("[data-readout]")!;
  let data: Payload | null = null;

  const width = 900;
  const height = 420;
  const pad = { top: 30, right: 20, bottom: 62, left: 52 };

  const draw = () => {
    if (!data) return;
    const task = taskSelect.value;
    const perTask = new Map<string, Point>();
    if (task) for (const p of data.points) if (p.task === task) perTask.set(`${p.model}|${p.effort}`, p);

    const bars = data.configurations
      .map((c) => {
        const point = perTask.get(`${c.model}|${c.effort}`);
        return { ...c, score: task ? point?.score ?? 0 : c.mean };
      })
      .sort((a, b) => ORDER.indexOf(a.model) - ORDER.indexOf(b.model) || EFFORTS.indexOf(a.effort) - EFFORTS.indexOf(b.effort));

    const yMax = 0.5;
    const y = (v: number) => height - pad.bottom - (Math.min(v, yMax) / yMax) * (height - pad.top - pad.bottom);

    const groups = ORDER.map((model) => bars.filter((b) => b.model === model)).filter((g) => g.length);
    const slots = bars.length + groups.length; // one blank slot between families
    const step = (width - pad.left - pad.right) / slots;
    const barW = Math.min(30, step * 0.82);

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, class: "ai4ai-bars-svg", role: "img" });
    svg.setAttribute("aria-label", "Mean score by system and reasoning effort");

    for (let v = 0; v <= yMax + 1e-9; v += 0.1) {
      svg.append(el("line", { x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v), stroke: "#E5E7EB" }));
      const label = el("text", { x: pad.left - 10, y: y(v) + 4, "text-anchor": "end", class: "ai4ai-axis-label" });
      label.textContent = v.toFixed(1);
      svg.append(label);
    }

    let cursor = pad.left + step / 2;
    for (const group of groups) {
      const centers: number[] = [];
      for (const bar of group) {
        const cx = cursor;
        centers.push(cx);
        const top = y(bar.score);
        const rect = el("rect", {
          x: cx - barW / 2, y: top, width: barW, height: Math.max(0, height - pad.bottom - top),
          fill: COLOR[bar.model], "fill-opacity": ALPHA[bar.effort] ?? 0.8, rx: 2, class: "ai4ai-bar",
        });
        rect.addEventListener("pointerenter", (event) => {
          tooltip.hidden = false;
          tooltip.innerHTML = `<strong>${bar.modelLabel} · ${bar.effort}</strong>
            <span>${bar.harness}${task ? ` · ${data!.tasks.find((t) => t.id === task)?.short}` : " · averaged over ten tasks"}</span>
            <span>score <b>${bar.score.toFixed(3)}</b></span>
            ${bar.cost === null ? "" : `<span>exploration cost <b>$${bar.cost.toFixed(0)}</b> · ${(bar.tokens / 1000).toFixed(0)}k output tokens</span>`}`;
          const box = plot.getBoundingClientRect();
          const r = (event.currentTarget as SVGRectElement).getBoundingClientRect();
          tooltip.style.left = `${Math.min(box.width - 236, Math.max(0, r.left - box.left - 100))}px`;
          tooltip.style.top = `${Math.max(0, r.top - box.top - tooltip.offsetHeight - 10)}px`;
        });
        rect.addEventListener("pointerleave", () => { tooltip.hidden = true; });
        svg.append(rect);

        const scoreLabel = el("text", { x: cx, y: top - 15, "text-anchor": "middle", class: "ai4ai-bar-score" });
        scoreLabel.textContent = bar.score.toFixed(2).replace(/^0/, "");
        svg.append(scoreLabel);
        if (!task && bar.cost !== null) {
          const costLabel = el("text", { x: cx, y: top - 5, "text-anchor": "middle", class: "ai4ai-bar-cost" });
          costLabel.textContent = `$${bar.cost.toFixed(0)}`;
          svg.append(costLabel);
        }

        const effortLabel = el("text", { x: cx, y: height - pad.bottom + 14, "text-anchor": "middle", class: "ai4ai-bar-effort" });
        effortLabel.textContent = bar.effort;
        svg.append(effortLabel);
        cursor += step;
      }
      if (centers.length > 1) {
        svg.append(el("polyline", {
          points: group.map((b, i) => `${centers[i]},${y(b.score)}`).join(" "),
          fill: "none", stroke: COLOR[group[0].model], "stroke-width": 1.5, "stroke-opacity": 0.85,
        }));
      }
      for (const [i, cx] of centers.entries()) {
        svg.append(el("circle", { cx, cy: y(group[i].score), r: 2.6, fill: "#fff", stroke: COLOR[group[0].model], "stroke-width": 1.4 }));
      }
      const name = el("text", { x: (centers[0] + centers[centers.length - 1]) / 2, y: height - pad.bottom + 34, "text-anchor": "middle", class: "ai4ai-bar-group" });
      name.textContent = group[0].modelLabel;
      svg.append(name);
      cursor += step;
    }

    svg.append(el("line", {
      x1: pad.left, x2: width - pad.right, y1: y(data.ladder.baseline), y2: y(data.ladder.baseline),
      stroke: "#26313C", "stroke-width": 1.3, "stroke-dasharray": "5 4",
    }));
    svg.append(el("line", { x1: pad.left, x2: width - pad.right, y1: height - pad.bottom, y2: height - pad.bottom, stroke: "#C8CED5" }));

    plot.replaceChildren(svg, tooltip);
    const mean = bars.reduce((sum, b) => sum + b.score, 0) / bars.length;
    readout.textContent = task
      ? `29 configurations on this task · mean ${mean.toFixed(3)}`
      : `29 configurations · mean ${mean.toFixed(3)} · $${bars.reduce((s, b) => s + (b.cost ?? 0), 0).toFixed(0)} of exploration in total`;
  };

  fetch("/ai4ai/data/points.json")
    .then((response) => response.json())
    .then((payload: Payload) => {
      data = payload;
      taskSelect.replaceChildren(
        new Option("All ten tasks", ""),
        ...payload.tasks.map((t) => new Option(`${t.short} — ${t.family}`, t.id)),
      );
      draw();
    })
    .catch(() => { readout.textContent = "Chart data unavailable."; });

  taskSelect.addEventListener("change", draw);
}
