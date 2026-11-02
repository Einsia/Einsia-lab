/**
 * "One day": the overview video, drawn frame by frame on a canvas.
 *
 * It tells one causal chain, twice: something happens in a world the agent cannot
 * see, the agent receives a reading, it acts through a device, and glucose answers.
 * window.DAY holds the recorded day (see render.mjs). Readings, doses and curves
 * come straight from it, and render.mjs refuses to run if a quote or reading below
 * is not what the run recorded.
 */
(() => {
  const W = 1920;
  const H = 1080;
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");

  const C = {
    paper: "#f4efe4",
    paper2: "#ebe8db",
    paper3: "#dfe6d6",
    card: "#fbf8f1",
    ink: "#273d32",
    night: "#223a2f",
    ink2: "#5d6e60",
    ink3: "#758a71",
    line: "#c9cfbb",
    accent: "#c2673c",
    glow: "#e08a5c",
    amber: "#c98a3a",
    purple: "#6d5aa8",
    teal: "#2f8f83",
    red: "#b4483c",
    white: "#f5f1e8",
    sage: "#a9bda6",
  };
  const SERIF = "Georgia, 'Times New Roman', serif";
  const SANS = "Inter, sans-serif";

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (v) => v * v * (3 - 2 * v);
  const out = (v) => 1 - (1 - v) ** 3;
  const inOut = (v) => (v < 0.5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2);
  const back = (v) => 1 + 2.2 * (v - 1) ** 3 + 1.2 * (v - 1) ** 2;
  const lerp = (a, b, v) => a + (b - a) * v;

  // Timeline, in seconds. Each beat's stage times drive the cards and the camera.
  const T = {
    titleEnd: 4.4,
    setupEnd: 13.2,
    dayEnd: 56.2,
    recapEnd: 64.2,
    end: 73,
  };

  // Moments inside the scenes that the soundtrack lands on too. The setup's are
  // offsets into that scene; the others are video seconds.
  const AT = {
    neverTold: [2, 2.6, 3.2],
    sensor: 3.6,
    pump: 5.2,
    rows: T.dayEnd + 1.6,
    rowGap: 0.55,
    rings: T.recapEnd + 0.3,
    ringGap: 0.2,
    barGap: 0.25,
    closing: T.end - 3.6,
  };

  // Sim-minute keyframes: [video second, minute of the day]. Equal minutes hold time.
  const clockKeys = [
    [13.2, 0],
    [16.4, 480],
    [21.2, 480],
    [22.0, 525],
    [24.6, 580],
    [30.6, 580],
    [33.2, 600],
    [37.6, 1125],
    [39.8, 1200],
    [46.2, 1200],
    [48.4, 1260],
    [52.8, 1260],
    [54.6, 1320],
    [56.2, 1440],
  ];

  // Camera: [video second, window start, window end] in minutes of the day.
  const cameraKeys = [
    [13.2, 0, 1440],
    [15.6, 0, 1440],
    [17, 330, 750],
    [33.4, 330, 750],
    [34.6, 0, 1440],
    [36.2, 0, 1440],
    [37.6, 1020, 1400],
    [54.6, 1020, 1400],
    [55.8, 0, 1440],
  ];

  // Quote pieces are verbatim and joined with an ellipsis where the rationale runs on.
  const BEATS = [
    {
      from: 16.4, observe: 16.6, act: 20, respond: 21.2, to: 22,
      m: 480,
      event: { time: "08:00", title: "The sensor looks calm", note: "But two earlier days dipped late in the morning." },
      reading: { value: 94, trend: "" },
      quote: ["The 10:00-13:00 dips recurred on days 1 and 2, so I'm starting a 60% TBR now (to 10:00) to build a low-insulin cushion"],
      action: { big: "60%", small: "basal, ahead of time", color: C.ink2, kind: "basal" },
      response: { big: "…", small: "waiting" },
    },
    {
      from: 22, observe: 24.6, act: 29.6, respond: 30.6, to: 34,
      m: 580,
      event: { time: "08:45", title: "Exercise begins", note: "Three hours, on an empty stomach." },
      reading: { value: 74, trend: "↓" },
      quote: ["Urgent: CGM 74 and falling -7/5 min despite 60% TBR", "This is the recurring late-morning dip, so I'm giving 8 g fast carbs now"],
      action: { big: "8 g", small: "fast carbs", color: C.amber, kind: "carbs" },
      response: { big: "74 → 96", small: "by 10:00, no low" },
    },
    {
      from: 37.6, observe: 39.8, act: 45, respond: 46.2, to: 48.4,
      m: 1200,
      event: { time: "18:45", title: "Dinner, 44 g", note: "Nobody tells the agent." },
      reading: { value: 182, trend: "↑" },
      quote: ["CGM rose 92→182 since 18:55", "so this is the hidden dinner.", "Giving 1.0 U, the same as day 2 (1.0 U → 147 peak → 100)"],
      action: { big: "1.0 U", small: "bolus", color: C.purple, kind: "bolus" },
      response: { big: "191", small: "the peak, at 20:25" },
    },
    {
      from: 48.4, observe: 48.5, act: 52, respond: 52.8, to: 56,
      m: 1260,
      event: { time: "21:00", title: "Insulin still acting", note: "The fall is not over yet." },
      reading: { value: 156, trend: "↓" },
      quote: ["Day 2 dipped to 75 about 3.5 h after the dinner bolus, so a mild 60% TBR to 23:00 cushions the fall without carbs."],
      action: { big: "60%", small: "basal, before any low", color: C.ink2, kind: "basal" },
      response: { big: "182 → 99", small: "by 22:00, no low" },
    },
  ];
  window.MOMENTS = BEATS.map((b) => ({ m: b.m, quote: b.quote, reading: b.reading.value }));
  window.DURATION = T.end;
  window.POSTER_TIME = 44.4;
  // Everything score.mjs needs, so a retime here moves the sound too.
  window.CUES = {
    ...T,
    beats: BEATS.map(({ from, observe, act, respond, action, response }) => ({
      from, observe, act, respond,
      kind: action.kind,
      settled: response.small.includes("no low"),
    })),
    moves: cameraKeys.slice(1).flatMap((key, i) => (key[1] !== cameraKeys[i][1] ? [[cameraKeys[i][0], key[0]]] : [])),
    neverTold: AT.neverTold.map((at) => T.titleEnd + at),
    sensor: T.titleEnd + AT.sensor,
    pump: T.titleEnd + AT.pump,
    rows: [0, 1, 2, 3, 4, 5].map((i) => AT.rows + i * AT.rowGap),
    rings: [0, 1, 2].map((i) => AT.rings + i * AT.ringGap),
    bars: [0, 1, 2].map((i) => AT.rings + 2 + i * AT.barGap),
    closing: AT.closing,
  };

  function interp(keys, t) {
    if (t <= keys[0][0]) return keys[0].slice(1);
    for (let i = 1; i < keys.length; i += 1) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1];
        const b = keys[i];
        const v = inOut(seg(t, a[0], b[0]));
        return a.slice(1).map((value, j) => lerp(value, b[j + 1], v));
      }
    }
    return keys[keys.length - 1].slice(1);
  }
  const minuteAt = (t) => interp(clockKeys, t)[0];

  // Text ---------------------------------------------------------------------
  function text(str, x, y, { size = 32, family = SANS, weight = 400, color = C.ink, align = "left", alpha = 1, italic = false } = {}) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function wrap(str, maxWidth, font) {
    ctx.save();
    ctx.font = font;
    const lines = [];
    let line = "";
    for (const word of str.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    ctx.restore();
    return lines;
  }

  /** Words rise and fade in one after another. progress runs 0..1 over the text. */
  function reveal(str, x, y, maxWidth, lineHeight, progress, { size, family = SERIF, color = C.ink, weight = 400, alpha = 1 }) {
    const font = `${weight} ${size}px ${family}`;
    const lines = wrap(str, maxWidth, font);
    const total = lines.join(" ").split(" ").length;
    const base = ctx.globalAlpha;
    let index = 0;
    ctx.save();
    ctx.font = font;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;
    lines.forEach((line, row) => {
      let cursor = x;
      for (const word of line.split(" ")) {
        const a = smooth(clamp((progress - index / total) / 0.12));
        if (a > 0) {
          ctx.globalAlpha = base * alpha * a;
          ctx.fillText(word, cursor, y + row * lineHeight + (1 - a) * 10);
        }
        cursor += ctx.measureText(`${word} `).width;
        index += 1;
      }
    });
    ctx.restore();
  }

  function card(x, y, w, h, { r = 22, fill = C.card, shadow = 0.1, stroke = null, alpha = 1 } = {}) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (shadow) {
      ctx.shadowColor = `rgba(39, 61, 50, ${shadow})`;
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
    }
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  function pill(label, x, y, { size = 30, color = C.white, fill = C.ink, alpha = 1, align = "left", pad = 20, weight = 600 } = {}) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = `${weight} ${size}px ${SANS}`;
    const w = ctx.measureText(label).width + pad * 2;
    const height = size * 1.7;
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.beginPath();
    ctx.roundRect(left, y - height / 2, w, height, height / 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(label, left + pad, y + 1);
    ctx.restore();
    return w;
  }

  function badge(n, x, y, active) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 21, 0, Math.PI * 2);
    ctx.fillStyle = active ? C.accent : C.paper3;
    ctx.fill();
    ctx.restore();
    text(String(n), x, y + 9, { size: 25, weight: 700, color: active ? C.white : C.ink3, align: "center" });
  }

  /** A glowing dot travelling along a dotted curve. */
  function signal(x0, y0, cx0, cy0, cx1, cy1, x1, y1, progress, color, alpha = 1) {
    if (progress <= 0 || alpha <= 0) return;
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.globalAlpha = base * alpha;
    ctx.setLineDash([3, 12]);
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(cx0, cy0, cx1, cy1, x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    if (progress < 1) {
      for (let i = 0; i < 4; i += 1) {
        const p = clamp(out(progress) - i * 0.022);
        const q = 1 - p;
        const x = q ** 3 * x0 + 3 * q * q * p * cx0 + 3 * q * p * p * cx1 + p ** 3 * x1;
        const y = q ** 3 * y0 + 3 * q * q * p * cy0 + 3 * q * p * p * cy1 + p ** 3 * y1;
        ctx.beginPath();
        ctx.arc(x, y, 12 - i * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = base * alpha * (1 - i * 0.24);
        ctx.shadowColor = color;
        ctx.shadowBlur = 22;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  const clockLabel = (m) => {
    const value = Math.min(m, 1439.99);
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  };

  const valueAt = (series, m) => {
    let latest = null;
    for (const [at, v] of series) {
      if (at > m) break;
      if (v != null) latest = v;
    }
    return latest;
  };

  /** Height of the drawn line at minute m. A missed reading sits on the join between its neighbours. */
  const lineAt = (series, m) => {
    let before = null;
    for (const [at, v] of series) {
      if (v == null) continue;
      if (at >= m) return before && at > m ? lerp(before[1], v, (m - before[0]) / (at - before[0])) : v;
      before = [at, v];
    }
    return before && before[1];
  };

  // The person ----------------------------------------------------------------
  function limb(x, y, a1, l1, a2, l2, width, color) {
    const kx = x + Math.sin(a1) * l1;
    const ky = y + Math.cos(a1) * l1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(kx, ky);
    ctx.lineTo(kx + Math.sin(a2) * l2, ky + Math.cos(a2) * l2);
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  /** A virtual child: run and eat blend the pose. Returns device anchor points. */
  function person(cx, cy, s, run, eat, t, { color = C.ink, sensorPing = 0, pumpPulse = 0 } = {}) {
    const phase = t * 8.5;
    const lean = run * 0.2;
    const bob = run > 0 ? Math.abs(Math.sin(phase)) * -10 * run : Math.sin(t * 1.6) * 2.5;
    const hipX = cx;
    const hipY = cy + bob;
    const neckX = hipX + Math.sin(lean) * 112 * s;
    const neckY = hipY - Math.cos(lean) * 112 * s;

    const stride = Math.sin(phase) * run;
    const legA = 0.17 * (1 - run) + stride * 0.85;
    const legB = -0.17 * (1 - run) - stride * 0.85;
    const bendA = run * Math.max(0, -Math.cos(phase)) * 1.25;
    const bendB = run * Math.max(0, Math.cos(phase)) * 1.25;
    limb(hipX, hipY, legB, 74 * s, legB - bendB, 72 * s, 25 * s, color);
    limb(hipX, hipY, legA, 74 * s, legA - bendA, 72 * s, 25 * s, color);

    // Far arm, torso, then near arm so the sensor sits on top.
    const armFar = 0.5 * (1 - run) * (1 - eat) + stride * -0.8 + eat * 0.25;
    limb(neckX, neckY + 14 * s, armFar, 52 * s, armFar + run * 1.35 + 0.1, 50 * s, 20 * s, color);
    ctx.beginPath();
    ctx.moveTo(hipX, hipY - 8 * s);
    ctx.lineTo(neckX, neckY + 8 * s);
    ctx.lineWidth = 52 * s;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(neckX + Math.sin(lean) * 52 * s, neckY - 50 * s, 36 * s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    const armNear = lerp(-0.5 * (1 - run) + stride * 0.8, 1.15, eat);
    const foreNear = lerp(armNear + run * 1.35 + 0.1, 3.0, eat);
    limb(neckX, neckY + 14 * s, armNear, 52 * s, foreNear, 50 * s, 20 * s, color);

    // Sensor on the upper arm.
    const sx = neckX + Math.sin(armNear) * 30 * s;
    const sy = neckY + 14 * s + Math.cos(armNear) * 30 * s;
    const base = ctx.globalAlpha;
    if (sensorPing > 0) {
      for (let i = 0; i < 2; i += 1) {
        const p = (sensorPing + i * 0.5) % 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 14 + p * 46, 0, Math.PI * 2);
        ctx.strokeStyle = C.teal;
        ctx.globalAlpha = base * (1 - p) * 0.7;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.globalAlpha = base;
    }
    ctx.beginPath();
    ctx.arc(sx, sy, 12 * s + 3, 0, Math.PI * 2);
    ctx.fillStyle = C.teal;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.card;
    ctx.stroke();

    // Pump on the hip.
    const px = hipX + 34 * s + Math.sin(lean) * 12;
    const py = hipY - 20 * s;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px - 4, py - 16, 44, 32, 8);
    ctx.fillStyle = C.purple;
    if (pumpPulse > 0) {
      ctx.shadowColor = C.purple;
      ctx.shadowBlur = 34 * pumpPulse;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.card;
    ctx.stroke();
    ctx.restore();
    return { sensor: [sx, sy], pump: [px + 18, py], mouth: [neckX + 38 * s, neckY - 40 * s] };
  }

  function exerciseAt(m) {
    let v = 0;
    for (const e of window.DAY.events) {
      if (e.type === "exercise") v = Math.max(v, seg(m, e.m - 8, e.m) * (1 - seg(m, e.end - 2, e.end + 8)));
    }
    return smooth(v);
  }

  function mealAt(m) {
    let v = 0;
    let grams = null;
    for (const e of window.DAY.events) {
      if (e.type === "meal") {
        const w = seg(m, e.m - 6, e.m + 2) * (1 - seg(m, e.m + 24, e.m + 34));
        if (w > v) {
          v = w;
          grams = e.grams;
        }
      }
    }
    return { v: smooth(v), grams };
  }

  function plate(x, y, a, grams) {
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.globalAlpha = base * a;
    ctx.beginPath();
    ctx.ellipse(x, y, 62, 22, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.line;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y - 8, 38, 20, 0, Math.PI, 0);
    ctx.fillStyle = C.amber;
    ctx.fill();
    ctx.restore();
    if (grams) text(`${Math.round(grams)} g`, x, y + 58, { size: 30, weight: 600, color: C.amber, align: "center", alpha: a });
  }

  // The chart -----------------------------------------------------------------
  function drawChart(rect, x0, x1, t, minute, { sensorAlpha = 1, truthTo = -1, head = true, markers = true } = {}) {
    const X = (m) => rect.x + ((m - x0) / (x1 - x0)) * rect.w;
    const Y = (v) => rect.y + rect.h - ((Math.min(v, 210) - 50) / (210 - 50)) * rect.h;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y - 40, rect.w, rect.h + 40);
    ctx.clip();

    const band = ctx.createLinearGradient(0, Y(144), 0, Y(72));
    band.addColorStop(0, "#dbe5d3");
    band.addColorStop(1, "#e6ecdc");
    ctx.fillStyle = band;
    ctx.fillRect(rect.x, Y(144), rect.w, Y(72) - Y(144));

    const span = x1 - x0;
    const step = span > 900 ? 360 : span > 500 ? 120 : 60;
    for (let m = Math.ceil(x0 / step) * step; m <= x1; m += step) {
      ctx.strokeStyle = "rgba(117, 138, 113, 0.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(m), rect.y);
      ctx.lineTo(X(m), rect.y + rect.h);
      ctx.stroke();
    }
    ctx.save();
    ctx.setLineDash([7, 9]);
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(rect.x, Y(70));
    ctx.lineTo(rect.x + rect.w, Y(70));
    ctx.stroke();
    ctx.restore();

    // The line itself warns: ink in range, amber above, red below.
    const top = Y(200);
    const height = Y(60) - top;
    const stroke = ctx.createLinearGradient(0, top, 0, Y(60));
    stroke.addColorStop(0, C.accent);
    stroke.addColorStop(clamp((Y(146) - top) / height), C.amber);
    stroke.addColorStop(clamp((Y(138) - top) / height), C.ink);
    stroke.addColorStop(clamp((Y(76) - top) / height), C.ink);
    stroke.addColorStop(1, C.red);

    const trace = (series, limit) => {
      ctx.beginPath();
      let pen = false;
      for (const [m, v] of series) {
        if (m > limit) break;
        // The sensor gives no reading while it is calibrated, so the line runs straight on to the next one.
        if (v == null) continue;
        if (m < x0 - 30 || m > x1 + 30) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(X(m), Y(v));
        else ctx.moveTo(X(m), Y(v));
        pen = true;
      }
    };

    if (sensorAlpha > 0) {
      ctx.save();
      ctx.globalAlpha *= sensorAlpha;
      trace(window.DAY.cgm, minute);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    }

    if (truthTo >= 0) {
      trace(window.DAY.truth, truthTo);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 6;
      ctx.save();
      ctx.shadowColor = "rgba(194, 103, 60, 0.45)";
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    }

    if (markers) {
      for (const [m, kind] of window.DAY.acts) {
        if (m > minute || m < x0 || m > x1) continue;
        const v = lineAt(window.DAY.cgm, m);
        if (v == null) continue;
        const pop = back(clamp((minute - m) / 18));
        const color = kind === "BOLUS" ? C.purple : kind === "INGEST_CARBS" ? C.amber : C.ink2;
        ctx.beginPath();
        ctx.arc(X(m), Y(v), 9 * Math.max(0, pop), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = C.card;
        ctx.stroke();
      }
    }
    ctx.restore();

    for (const v of [70, 144, 200]) text(String(v), rect.x - 16, Y(v) + 9, { size: 26, color: C.ink2, align: "right" });
    for (let m = Math.ceil(x0 / step) * step; m < x1; m += step) {
      if (X(m) < rect.x || X(m) > rect.x + rect.w - 70) continue;
      text(clockLabel(m), X(m) + 8, rect.y + rect.h + 38, { size: 26, color: C.ink2 });
    }

    if (head) {
      const now = valueAt(window.DAY.cgm, minute);
      if (now != null) {
        const x = X(minute);
        const y = Y(now);
        const beat = (t * 1.4) % 1;
        const base = ctx.globalAlpha;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 12 + beat * 26, 0, Math.PI * 2);
        ctx.strokeStyle = C.ink;
        ctx.globalAlpha = base * (1 - beat) * 0.45;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = base;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = C.ink;
        ctx.shadowColor = "rgba(39,61,50,.5)";
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.restore();
        const right = x > rect.x + rect.w - 240;
        pill(`CGM ${now}`, x + (right ? -28 : 28), y - 42, { size: 28, align: right ? "right" : "left", pad: 16 });
      }
    }
    return { X, Y };
  }

  // Scenes --------------------------------------------------------------------
  function titleScene(t) {
    ctx.fillStyle = C.night;
    ctx.fillRect(0, 0, W, H);
    const a = smooth(seg(t, 0.2, 1));
    const lineY = (v) => 930 - ((v - 50) / 160) * 340;
    const draw = inOut(seg(t, 0.1, 4.2));
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.fillStyle = C.sage;
    ctx.fillRect(0, lineY(144), W, lineY(72) - lineY(144));
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    let pen = false;
    let last = null;
    for (const [m, v] of window.DAY.cgm) {
      if (v == null) continue;
      const x = (m / 1440) * W;
      if (x > draw * W) break;
      if (pen) ctx.lineTo(x, lineY(v));
      else ctx.moveTo(x, lineY(v));
      pen = true;
      last = [x, lineY(v)];
    }
    ctx.strokeStyle = C.glow;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.shadowColor = C.glow;
    ctx.shadowBlur = 22;
    ctx.stroke();
    if (last) {
      ctx.beginPath();
      ctx.arc(last[0], last[1], 9, 0, Math.PI * 2);
      ctx.fillStyle = C.white;
      ctx.fill();
    }
    ctx.restore();
    const rise = (1 - out(seg(t, 0.2, 1.3))) * 26;
    text("One day.", W / 2, 360 + rise, { size: 168, family: SERIF, weight: 700, align: "center", color: C.white, alpha: a });
    const b = smooth(seg(t, 0.9, 1.8));
    text("An agent keeps one virtual person's glucose in range,", W / 2, 462, { size: 44, color: C.sage, align: "center", alpha: b });
    text("with incomplete information and delayed insulin.", W / 2, 524, { size: 44, color: C.sage, align: "center", alpha: b });
  }

  function setupScene(t) {
    const local = t - T.titleEnd;
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);
    const appear = (a, b = a + 0.5) => smooth(seg(local, a, b));

    text("A virtual 9-year-old with type 1 diabetes.", W / 2, 124, { size: 60, family: SERIF, weight: 700, align: "center", alpha: appear(0.1) });

    // Hidden world on the left, agent on the right, a wall between them.
    const wall = 980;
    card(140, 190, 740, 640, { fill: C.paper2, shadow: 0.05, alpha: appear(0.3) });
    card(1080, 190, 700, 640, { fill: C.card, shadow: 0.1, alpha: appear(0.5) });
    text("The world", 186, 256, { size: 38, family: SERIF, weight: 700, alpha: appear(0.3) });
    text("The agent", 1126, 256, { size: 38, family: SERIF, weight: 700, alpha: appear(0.5) });

    ctx.save();
    ctx.globalAlpha = appear(0.6);
    const running = smooth(seg(local, 2.6, 3.2)) * (1 - smooth(seg(local, 5.2, 5.8)));
    const anchors = person(700, 590, 1.05, running, 0, t, {
      sensorPing: local > AT.sensor ? (local * 0.8) % 1 : 0,
      pumpPulse: smooth(seg(local, AT.pump, AT.pump + 0.6)) * (0.5 + 0.5 * Math.sin(t * 5)),
    });
    ctx.restore();

    text("Never told", 186, 340, { size: 30, color: C.accent, weight: 600, alpha: appear(1.8) });
    ["Meals", "Exercise", "Why glucose moved"].forEach((label, i) => {
      const a = appear(AT.neverTold[i]);
      text(label, 186, 414 + i * 76 + (1 - a) * 12, { size: 42, family: SERIF, alpha: a });
    });

    // The wall, with one way through it: the devices.
    ctx.save();
    ctx.globalAlpha = appear(1);
    ctx.setLineDash([12, 14]);
    ctx.strokeStyle = C.ink3;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wall, 170);
    ctx.lineTo(wall, 850);
    ctx.stroke();
    ctx.restore();

    signal(anchors.sensor[0], anchors.sensor[1], 820, anchors.sensor[1] - 110, 1000, 400, 1120, 400, seg(local, AT.sensor, AT.sensor + 1), C.teal, appear(AT.sensor));
    text("Sensor glucose", 1130, 372, { size: 36, weight: 600, color: C.teal, alpha: appear(4.3) });
    text("One reading every five minutes", 1130, 420, { size: 30, color: C.ink2, alpha: appear(4.5) });

    signal(1120, 610, 1000, 610, 860, 640, anchors.pump[0] + 24, anchors.pump[1], seg(local, AT.pump, AT.pump + 1), C.purple, appear(AT.pump));
    text("Pump commands", 1130, 582, { size: 36, weight: 600, color: C.purple, alpha: appear(5.8) });
    text("Doses, temporary rates, repairs", 1130, 630, { size: 30, color: C.ink2, alpha: appear(6) });

    text("And each dose takes over an hour to peak.", W / 2, 950, { size: 50, family: SERIF, italic: true, align: "center", alpha: appear(6.6) });
    text("Day 3 of 3. It has already seen two days of this person.", W / 2, 1014, { size: 34, color: C.ink2, align: "center", alpha: appear(7.2) });
  }

  const LAYOUT = {
    world: { x: 56, y: 136, w: 430, h: 888 },
    chart: { x: 610, y: 176, w: 1230, h: 420 },
    obs: { x: 520, y: 684, w: 760, h: 340 },
    act: { x: 1298, y: 684, w: 270, h: 340 },
    glu: { x: 1586, y: 684, w: 278, h: 340 },
  };

  const currentBeat = (t) => BEATS.find((beat) => t >= beat.from && t < beat.to) ?? null;

  function dayScene(t) {
    const minute = minuteAt(t);
    const [x0, x1] = interp(cameraKeys, t);
    const recap = smooth(seg(t, T.dayEnd, T.dayEnd + 1.2));
    const panels = 1 - recap;

    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);

    const beat = currentBeat(t);
    const stage = beat ? (t >= beat.respond ? 3 : t >= beat.act ? 2 : t >= beat.observe ? 1 : 0) : -1;

    // Clock and the 24-hour track, with the camera's window marked on it.
    text(clockLabel(minute), 56, 104, { size: 84, family: SERIF, weight: 700, alpha: panels });
    const track = { x: 610, y: 84, w: 1230 };
    ctx.save();
    ctx.globalAlpha = panels;
    ctx.beginPath();
    ctx.roundRect(track.x, track.y, track.w, 10, 5);
    ctx.fillStyle = C.paper2;
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(track.x, track.y, Math.max(10, track.w * (minute / 1440)), 10, 5);
    ctx.fillStyle = C.ink;
    ctx.fill();
    const zoomed = smooth(seg(1440 - (x1 - x0), 0, 300));
    if (zoomed > 0) {
      ctx.globalAlpha = panels * zoomed;
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.accent;
      ctx.beginPath();
      ctx.roundRect(track.x + track.w * (x0 / 1440), track.y - 9, track.w * ((x1 - x0) / 1440), 28, 10);
      ctx.stroke();
    }
    ctx.restore();
    text("Day 3 of 3 · DiabAgent with Claude Opus 5.5", track.x + track.w, 60, { size: 28, color: C.ink2, align: "right", alpha: panels });

    // World card ---------------------------------------------------------------
    let anchors = null;
    if (panels > 0) {
      ctx.save();
      ctx.globalAlpha = panels;
      const w = LAYOUT.world;
      card(w.x, w.y, w.w, w.h, { fill: C.paper2, shadow: 0.06, stroke: stage === 0 ? C.accent : null });
      badge(1, w.x + 48, w.y + 48, stage === 0);
      text("The world", w.x + 84, w.y + 58, { size: 32, family: SERIF, weight: 700 });
      text("hidden from the agent", w.x + 34, w.y + 108, { size: 28, color: C.ink2 });

      const meal = mealAt(minute);
      const pumpPulse = beat && beat.action.kind !== "carbs" && stage === 2 ? 0.6 + 0.4 * Math.sin(t * 8) : 0;
      anchors = person(w.x + w.w / 2 - 14, w.y + 410, 1, exerciseAt(minute), meal.v, t, {
        sensorPing: stage === 1 ? (t * 0.9) % 1 : 0,
        pumpPulse,
      });
      if (meal.v > 0) plate(w.x + 96, w.y + 580, meal.v, meal.grams);

      if (beat) {
        const appear = smooth(seg(t, beat.from, beat.from + 0.5));
        const y = w.y + 680 + (1 - appear) * 16;
        text(beat.event.time, w.x + 34, y, { size: 30, color: C.accent, weight: 700, alpha: appear });
        const lines = wrap(beat.event.title, w.w - 68, `700 38px ${SERIF}`);
        lines.forEach((line, i) => text(line, w.x + 34, y + 50 + i * 44, { size: 38, family: SERIF, weight: 700, alpha: appear }));
        wrap(beat.event.note, w.w - 68, `400 27px ${SANS}`).forEach((line, i) => {
          text(line, w.x + 34, y + 58 + lines.length * 44 + i * 36, { size: 27, color: C.ink2, alpha: appear });
        });
      } else {
        text("Watching.", w.x + 34, w.y + 730, { size: 38, family: SERIF, italic: true, color: C.ink2 });
      }
      ctx.restore();
    }

    // Chart card, which grows into the recap -----------------------------------
    const frame = {
      x: lerp(520, 40, recap),
      y: lerp(136, 44, recap),
      w: lerp(1344, 1840, recap),
      h: lerp(530, 800, recap),
    };
    card(frame.x, frame.y, frame.w, frame.h, { shadow: 0.1 });
    const chartRect = {
      x: lerp(LAYOUT.chart.x, 130, recap),
      y: lerp(LAYOUT.chart.y, 136, recap),
      w: lerp(LAYOUT.chart.w, 1720, recap),
      h: lerp(LAYOUT.chart.h, 640, recap),
    };
    const truthTo = t > T.dayEnd ? inOut(seg(t, T.dayEnd + 1, T.dayEnd + 4)) * 1440 : -1;
    const sensorAlpha = lerp(1, 0.28, smooth(seg(t, T.dayEnd + 0.6, T.dayEnd + 1.8)));
    const { X } = drawChart(chartRect, x0, x1, t, minute, {
      sensorAlpha,
      truthTo,
      head: t < T.dayEnd,
      markers: recap < 0.6,
    });

    // Insulin's slow arrival, drawn ahead of the dose.
    if (beat && beat.action.kind === "bolus" && t > beat.act) {
      const g = smooth(seg(t, beat.act + 0.2, beat.act + 0.8));
      const y = LAYOUT.chart.y + LAYOUT.chart.h - 24;
      const x = X(beat.m);
      const x2 = X(beat.m + 75);
      ctx.save();
      ctx.globalAlpha = g;
      ctx.strokeStyle = C.purple;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(lerp(x, x2, out(seg(t, beat.act + 0.2, beat.act + 1.2))), y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x2, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = C.purple;
      ctx.fill();
      ctx.restore();
      text("peak in ~75 min", x2 + 18, y + 10, { size: 28, weight: 600, color: C.purple, alpha: g });
    }

    // Chain cards --------------------------------------------------------------
    if (panels > 0) {
      ctx.save();
      ctx.globalAlpha = panels;
      const o = LAYOUT.obs;
      card(o.x, o.y, o.w, o.h, { shadow: 0.08, stroke: stage === 1 ? C.accent : null });
      badge(2, o.x + 48, o.y + 48, stage === 1);
      text("Agent receives a reading", o.x + 84, o.y + 58, { size: 32, family: SERIF, weight: 700 });

      const c = LAYOUT.act;
      card(c.x, c.y, c.w, c.h, { shadow: 0.08, stroke: stage === 2 ? C.accent : null });
      badge(3, c.x + 44, c.y + 48, stage === 2);
      text("Acts", c.x + 78, c.y + 58, { size: 32, family: SERIF, weight: 700 });

      const g = LAYOUT.glu;
      card(g.x, g.y, g.w, g.h, { shadow: 0.08, stroke: stage === 3 ? C.accent : null });
      badge(4, g.x + 44, g.y + 48, stage === 3);
      text("Glucose", g.x + 78, g.y + 58, { size: 32, family: SERIF, weight: 700 });

      if (beat) {
        const leave = 1 - smooth(seg(t, beat.to - 0.35, beat.to));
        if (t >= beat.observe) {
          const a = smooth(seg(t, beat.observe, beat.observe + 0.4)) * leave;
          const arrow = beat.reading.trend ? ` ${beat.reading.trend}` : "";
          pill(`CGM ${beat.reading.value}${arrow}`, o.x + 36, o.y + 118, { size: 32, alpha: a, pad: 22 });
          const quote = `“${beat.quote.join(" … ")}”`;
          const span = Math.max(1.4, Math.min(2.8, beat.act - beat.observe - 1.5));
          reveal(quote, o.x + 36, o.y + 192, o.w - 72, 44, seg(t, beat.observe + 0.25, beat.observe + 0.25 + span) * 1.12, { size: 32, alpha: leave });
        }
        if (t >= beat.act) {
          const v = back(seg(t, beat.act, beat.act + 0.45));
          const a = smooth(seg(t, beat.act, beat.act + 0.25)) * leave;
          ctx.save();
          ctx.globalAlpha *= a;
          ctx.translate(c.x + 34, c.y + 190);
          ctx.scale(Math.max(0.2, v), Math.max(0.2, v));
          text(beat.action.big, 0, 0, { size: 74, family: SERIF, weight: 700, color: beat.action.color });
          ctx.restore();
          wrap(beat.action.small, c.w - 60, `400 29px ${SANS}`).forEach((line, i) => {
            text(line, c.x + 34, c.y + 242 + i * 38, { size: 29, color: C.ink2, alpha: a });
          });
        }
        if (t >= beat.respond) {
          const a = smooth(seg(t, beat.respond, beat.respond + 0.4)) * leave;
          const size = beat.response.big.length >= 7 ? 48 : beat.response.big.length > 2 ? 58 : 74;
          text(beat.response.big, g.x + 32, g.y + 186, { size, family: SERIF, weight: 700, alpha: a });
          wrap(beat.response.small, g.w - 58, `400 29px ${SANS}`).forEach((line, i) => {
            text(line, g.x + 32, g.y + 242 + i * 38, { size: 29, color: C.ink2, alpha: a });
          });
        }

        // The chain itself: reading out of the world, command back into it.
        if (stage === 1) signal(anchors.sensor[0], anchors.sensor[1], 500, anchors.sensor[1] + 40, 470, o.y + 40, o.x + 18, o.y + 48, seg(t, beat.observe - 0.15, beat.observe + 0.7), C.teal, leave);
        if (stage === 2) {
          const target = beat.action.kind === "carbs" ? anchors.mouth : anchors.pump;
          const color = beat.action.kind === "carbs" ? C.amber : C.purple;
          signal(c.x + c.w / 2, c.y - 4, c.x + 100, c.y - 70, 600, c.y - 70, target[0] + 22, target[1], seg(t, beat.act, beat.act + 0.8), color, leave);
        }
      } else {
        text("Waiting for the next look.", o.x + 36, o.y + 150, { size: 32, family: SERIF, italic: true, color: C.ink2 });
      }
      ctx.restore();
    }

    // Recap: what it saw, and what really happened ------------------------------
    if (recap > 0) {
      ctx.save();
      ctx.globalAlpha = recap;
      text("What it saw, and what really happened.", frame.x + 90, frame.y + 62, { size: 42, family: SERIF, weight: 700 });
      const legend = smooth(seg(t, T.dayEnd + 1, T.dayEnd + 1.8));
      ctx.save();
      ctx.globalAlpha = recap * legend;
      ctx.fillStyle = C.accent;
      ctx.fillRect(frame.x + frame.w - 500, frame.y + 42, 44, 7);
      ctx.fillStyle = C.ink3;
      ctx.fillRect(frame.x + frame.w - 210, frame.y + 44, 44, 4);
      ctx.restore();
      text("True glucose", frame.x + frame.w - 444, frame.y + 56, { size: 28, alpha: legend });
      text("Sensor", frame.x + frame.w - 154, frame.y + 56, { size: 28, color: C.ink2, alpha: legend });

      const laneY = 892;
      ctx.beginPath();
      ctx.roundRect(chartRect.x, laneY, chartRect.w, 62, 12);
      ctx.fillStyle = C.paper2;
      ctx.fill();
      const start = AT.rows;
      const row = (i) => smooth(seg(t, start + i * AT.rowGap, start + i * AT.rowGap + 0.4));
      const lx = (m) => chartRect.x + (m / 1440) * chartRect.w;
      ctx.save();
      ctx.globalAlpha = recap * row(0);
      ctx.fillStyle = "#d3cbe0";
      ctx.fillRect(lx(405), laneY, lx(915) - lx(405), 62);
      ctx.restore();
      const exercise = window.DAY.events.filter((e) => e.type === "exercise");
      const meals = window.DAY.events.filter((e) => e.type === "meal");
      exercise.forEach((event, i) => {
        ctx.save();
        ctx.globalAlpha = recap * row(1 + i);
        ctx.fillStyle = C.accent;
        ctx.beginPath();
        ctx.roundRect(lx(event.m), laneY + 11, lx(event.end) - lx(event.m), 40, 8);
        ctx.fill();
        ctx.restore();
        text("Exercise", lx(event.m), laneY + 104, { size: 30, weight: 600, color: C.accent, alpha: row(1 + i) });
      });
      meals.forEach((event, i) => {
        const x = lx(event.m);
        ctx.save();
        ctx.globalAlpha = recap * row(3 + i);
        ctx.fillStyle = C.amber;
        ctx.beginPath();
        ctx.moveTo(x - 17, laneY + 8);
        ctx.lineTo(x + 17, laneY + 8);
        ctx.lineTo(x, laneY + 54);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        text(["Late lunch", "Dinner", "Snack"][i], x - 17, laneY + 104, { size: 30, weight: 600, color: C.amber, alpha: row(3 + i) });
      });
      text("No breakfast, no lunch", lx(405), laneY - 14, { size: 30, weight: 600, color: "#7d6a9c", alpha: row(0) });
      ctx.restore();
    }
  }

  function ring(cx, cy, r, value, color, t0, t) {
    const p = inOut(seg(t, t0, t0 + 1.4)) * value;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 22;
    ctx.strokeStyle = "rgba(245, 241, 232, 0.13)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    if (p > 0.001) {
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function scoreScene(t) {
    ctx.fillStyle = C.night;
    ctx.fillRect(0, 0, W, H);
    const { day, whole, nextBest, nextBestName, daily } = window.DAY.summary;
    const start = AT.rings;
    const count = inOut(seg(t, start, start + 1.4));
    const items = [
      { value: day.score / 100, label: "COGI this day", show: (day.score * count).toFixed(1), color: C.glow },
      { value: day.tir / 100, label: "time in 4–8 mmol/L", show: `${(day.tir * count).toFixed(1)}%`, color: C.sage },
      { value: 0, label: "time below 70 mg/dL", show: `${day.below.toFixed(0)}%`, color: C.sage },
    ];
    items.forEach((item, i) => {
      const cx = 400 + i * 560;
      const a = smooth(seg(t, start - 0.2 + i * AT.ringGap, start + 0.3 + i * AT.ringGap));
      ctx.save();
      ctx.globalAlpha = a;
      ring(cx, 214, 128, item.value, item.color, start + i * AT.ringGap, t);
      ctx.restore();
      text(item.show, cx, 238, { size: 64, family: SERIF, weight: 700, align: "center", color: C.white, alpha: a });
      text(item.label, cx, 402, { size: 32, color: C.sage, align: "center", alpha: a });
    });

    // Three days, each better than the last.
    const barsAt = start + 2;
    const baseY = 852;
    daily.forEach((value, i) => {
      const x = 620 + i * 340;
      const a = smooth(seg(t, barsAt + i * AT.barGap, barsAt + 0.4 + i * AT.barGap));
      const grow = out(seg(t, barsAt + i * AT.barGap, barsAt + 0.9 + i * AT.barGap));
      const h = value * 3.4 * grow;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.roundRect(x - 90, baseY - h, 180, h, [14, 14, 0, 0]);
      ctx.fillStyle = i === 2 ? C.glow : "rgba(169, 189, 166, 0.55)";
      ctx.fill();
      ctx.restore();
      text(value.toFixed(0), x, baseY - h - 16, { size: 50, family: SERIF, weight: 700, align: "center", color: C.white, alpha: a });
      text(`Day ${i + 1}`, x, baseY + 42, { size: 32, color: C.sage, align: "center", alpha: a });
    });
    const line = smooth(seg(t, barsAt + 1.4, barsAt + 2));
    text(`Whole episode ${whole.toFixed(1)}. Next-best model here: ${nextBest.toFixed(1)} (${nextBestName}).`, W / 2, 980, { size: 36, color: C.white, align: "center", alpha: line });

    // Close on the name.
    const closing = smooth(seg(t, AT.closing, T.end - 2.9));
    if (closing > 0) {
      ctx.fillStyle = C.night;
      ctx.globalAlpha = closing;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      text("DiabAgent", W / 2, 500, { size: 128, family: SERIF, weight: 700, align: "center", color: C.white, alpha: closing });
      text("Toward Agentic Physiological Control", W / 2, 572, { size: 44, color: C.sage, align: "center", alpha: closing });
    }
  }

  /** Dark curtain with a circular opening: progress 0 closed, 1 fully open. */
  function iris(progress) {
    if (progress >= 1) return;
    const r = inOut(progress) * Math.hypot(W, H) * 0.62;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2, true);
    ctx.fillStyle = C.night;
    ctx.fill("evenodd");
    ctx.restore();
  }

  function veil(color, amount) {
    if (amount <= 0) return;
    ctx.fillStyle = color;
    ctx.globalAlpha = amount;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  window.drawFrame = (t) => {
    ctx.globalAlpha = 1;
    ctx.shadowColor = "transparent";
    if (t < T.titleEnd) {
      titleScene(t);
    } else if (t < T.setupEnd) {
      setupScene(t);
      iris(seg(t, T.titleEnd, T.titleEnd + 0.9));
      veil(C.paper, smooth(seg(t, T.setupEnd - 0.45, T.setupEnd)));
    } else if (t < T.recapEnd) {
      dayScene(t);
      veil(C.paper, 1 - smooth(seg(t, T.setupEnd, T.setupEnd + 0.5)));
      iris(1 - seg(t, T.recapEnd - 0.8, T.recapEnd));
    } else {
      scoreScene(t);
    }
    veil(C.night, smooth(seg(t, T.end - 0.6, T.end)));
  };
})();
