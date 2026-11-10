export const meta = {
  name: "cdc-a-x04-machine-runaway",
  description: "Catalog 44 candidate clips, match them to 6 storyboard slots, find exact change-point frames, assign distinct sources, render the beat-locked cut and verify the deliverables.",
  phases: [
    {title: "Setup", detail: "Probe clips, frame counts, contact sheets, per-frame stats"},
    {title: "Survey", detail: "Describe every clip and score it against each slot"},
    {title: "Slot verification", detail: "Frame-accurate change points and feasibility per slot"},
    {title: "Assignment", detail: "Distinct candidate per slot"},
    {title: "Render", detail: "Build output/solution.mp4, solution.json, events.csv"},
    {title: "Verify", detail: "Independent checks and repair"}
  ]
};

// ---------- Static task data (workers must re-read input/beats.json and trust it over this) ----------
const BEATS = [
  {slot: 1, start: 0, end: 150, accent: 72},
  {slot: 2, start: 150, end: 276, accent: 204},
  {slot: 3, start: 276, end: 420, accent: 360},
  {slot: 4, start: 420, end: 534, accent: 480},
  {slot: 5, start: 534, end: 690, accent: 630},
  {slot: 6, start: 690, end: 858, accent: 780}
];
for (const b of BEATS) { b.len = b.end - b.start; b.offset = b.accent - b.start; }
const TOTAL_FRAMES = 858;

const SLOT_TEXT = {
  1: "Slot 1 | Overload. In a pitch-black void, a lanky young man and a bald old man stand side by side on a small floating platform; full-figure long shot, camera essentially locked. Change: a blinding flash, and the surroundings turn from total black into a bright, heavily motion-blurred grey-white space, the two still standing on the platform.",
  2: "Slot 2 | Power cut. An open square hatch in a green tiled wall with a lamp lit inside it; close shot, locked camera. A tiled panel slides down over the hatch and a pair of gloved hands presses it flat. Change: the picture drops to full black; afterwards a wide engine room slowly emerges from the dark with two figures standing in it.",
  3: "Slot 3 | Intrusion. An empty square room with bare walls; frontal symmetrical long shot, locked camera; the young man swings his arms in the middle of the room. Change: dark cables pour out of the left corner and crawl over the left wall.",
  4: "Slot 4 | Breach. A tilted low-angle close shot hugging a tiled wall with a metal pipe running along it; the camera slides along the wall. Change: cables burst through the wall, debris flies, and the warm orange, cable-filled space behind it is fully revealed.",
  5: "Slot 5 | Encirclement. The bald old man stands alone before a golden curtain of vertically flowing light, hands clutching his head; medium shot, camera essentially locked. Change: the curtain behind him turns into rows of dark machinery studded with red indicator lights.",
  6: "Slot 6 | Failure. The old man stands alone in diagonally falling streaks of light; full-figure long shot, the camera settling to rest. Change: the warm orange light of the whole scene drains away into a dim, cold green."
};
const ALL_SLOTS_TEXT = BEATS.map(b => SLOT_TEXT[b.slot] + `\n  [beats: output frames [${b.start},${b.end}) length ${b.len}, accent_frame ${b.accent} = ${b.offset} frames after slot start]`).join("\n\n");

const CLIP_IDS = [];
for (let i = 1; i <= 44; i++) CLIP_IDS.push(String(i).padStart(2, "0"));

const CONTEXT = `You are a worker on a video-editing task in /workspace (read /workspace/instruction.md for the full brief).
Inputs: /workspace/input/clips/01.mp4 ... 44.mp4 (44 anonymous silent candidates, 1280x720, 30fps, 6-12 s, random numbering, a clip may contain internal cuts from the original film) and /workspace/input/beats.json.
Drafts go in /workspace/work/, deliverables (exactly 3 files) in /workspace/output/.
Goal: for 6 ordered slots, pick one distinct candidate each, take a contiguous 1x forward sub-range of exactly the slot length, such that the slot's CHANGE POINT (first frame at which the later state of the change holds) lands exactly on the slot's accent_frame, and hard-cut them in order. Frame numbers are 0-based indices of fully decoded frames.
For a candidate with change point at source frame c in slot s: source_start = c - (accent - slot_start), source_end = source_start + slot_length; requires source_start >= 0 and source_end <= clip decoded frame count.
Some candidates are likely near-duplicate distractors (same film, similar scene but different shot, framing, camera motion, timing, mirroring or colour). Match ALL storyboard details, not just the gist. Never guess clip identities; base every judgement on frames you actually extracted and looked at.
Tools: use whatever is available in the shell (ffmpeg/ffprobe, python3 with numpy/PIL/opencv if installed). View extracted images with your file-reading tool to judge content visually.

Storyboard and beats:
${ALL_SLOTS_TEXT}
`;

// ---------- Schemas ----------
const setupSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    tools: {type: "string"},
    clips: {type: "array", items: {type: "object", properties: {
      id: {type: "string"}, frames: {type: "integer"}, width: {type: "integer"}, height: {type: "integer"},
      fps: {type: "string"}, internalCuts: {type: "array", items: {type: "integer"}}
    }, required: ["id", "frames"]}},
    sheetPattern: {type: "string"},
    statsPattern: {type: "string"},
    extractCommand: {type: "string"},
    notes: {type: "string"}
  },
  required: ["ok", "clips", "notes"]
};

const surveySchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      id: {type: "string"},
      frames: {type: "integer"},
      description: {type: "string"},
      scores: {type: "array", items: {type: "object", properties: {
        slot: {type: "integer"},
        score: {type: "number", description: "0-10 match to that slot's full description incl. before-state, change and after-state"},
        approxChangeFrame: {type: "integer", description: "-1 if not applicable"},
        note: {type: "string"}
      }, required: ["slot", "score", "approxChangeFrame"]}}
    }, required: ["id", "description", "scores"]}}
  },
  required: ["clips"]
};

const slotSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    ranked: {type: "array", items: {type: "object", properties: {
      source: {type: "string"},
      confidence: {type: "number", description: "0-1 that this is the intended clip for the slot"},
      changeFrame: {type: "integer"},
      clipFrames: {type: "integer"},
      sourceStart: {type: "integer"},
      sourceEnd: {type: "integer"},
      feasible: {type: "boolean"},
      reasons: {type: "string"}
    }, required: ["source", "confidence", "changeFrame", "clipFrames", "sourceStart", "sourceEnd", "feasible", "reasons"]}},
    notes: {type: "string"}
  },
  required: ["slot", "ranked", "notes"]
};

const renderSchema = {
  type: "object",
  properties: {
    done: {type: "boolean"},
    frameCount: {type: "integer"},
    commands: {type: "string"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["done", "issues"]
};

const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    checks: {type: "array", items: {type: "string"}},
    issues: {type: "array", items: {type: "string"}},
    changePointConcerns: {type: "array", items: {type: "object", properties: {
      slot: {type: "integer"}, suggestedChangeFrame: {type: "integer"}, note: {type: "string"}
    }, required: ["slot", "note"]}}
  },
  required: ["passed", "issues"]
};

// ---------- Phase 1: setup ----------
phase("Setup");
const setup = await agent(CONTEXT + `
YOUR ASSIGNMENT (setup, shared infrastructure for later workers):
1. Check available tools (ffmpeg, ffprobe, python3, numpy, PIL, cv2). Report them.
2. For every clip 01..44: count fully decoded frames exactly (e.g. ffprobe -count_frames -select_streams v:0 -show_entries stream=nb_read_frames, or decode with ffmpeg and count). Note width/height/fps and any non-zero start_time / edit-list oddities.
3. Write /workspace/work/catalog.json with that info.
4. Make a labelled contact sheet per clip at /workspace/work/sheets/NN.jpg: one thumbnail every 10 frames (frame index burned into each thumbnail label, e.g. drawtext or PIL), ~320px wide thumbnails in a grid, so a reader can see the whole clip in 1-2 images. If a sheet would be too large, split into NN_a.jpg/NN_b.jpg.
5. Compute per-frame stats per clip into /workspace/work/stats/NN.csv: frame,mean_luma,mean_r,mean_g,mean_b,diff_prev (mean abs diff vs previous frame on a downscaled gray image). Detect likely internal hard cuts (large diff spikes) and list them.
6. Write a reusable helper script /workspace/work/tools/extract.sh (or .py) that extracts specific decoded frame indices of a clip to PNGs with the frame index in the filename, using exact decoded-frame indexing (e.g. ffmpeg -i clip -vf "select='between(n,A,B)'" -vsync 0 out_%d.png with correct numbering, or python cv2 sequential read). Verify it maps index->frame correctly on one clip. Report its usage as extractCommand.
Do this efficiently (script it in a loop, parallelise if helpful). Do not choose clips for slots.`, {label: "setup", phase: "Setup", schema: setupSchema});

const frameCounts = {};
if (setup && Array.isArray(setup.clips)) for (const c of setup.clips) if (c && c.id) frameCounts[String(c.id).padStart(2, "0")] = c.frames;
const setupInfo = setup ? `Setup results: tools=${setup.tools || "?"}; contact sheets: ${setup.sheetPattern || "/workspace/work/sheets/NN.jpg"}; per-frame stats: ${setup.statsPattern || "/workspace/work/stats/NN.csv"}; frame extractor: ${setup.extractCommand || "/workspace/work/tools/"}; catalog: /workspace/work/catalog.json. Notes: ${setup.notes}` :
  "Setup worker failed: build any contact sheets/frame extracts you need yourself under /workspace/work/ (use a subfolder named after your label to avoid clashes).";
log(`Setup ${setup ? "ok" : "FAILED"}; frame counts known for ${Object.keys(frameCounts).length} clips`);

// ---------- Phase 2: survey ----------
phase("Survey");
const BATCH = 4;
const batches = [];
for (let i = 0; i < CLIP_IDS.length; i += BATCH) batches.push(CLIP_IDS.slice(i, i + BATCH));
const surveyResults = await parallel(batches.map((ids, bi) => () => agent(CONTEXT + `\n${setupInfo}\n
YOUR ASSIGNMENT (survey): clips ${ids.join(", ")}.
For each clip: look at its contact sheet(s) and, where needed, extract extra frames to understand it. Describe the content shot by shot (characters, setting, framing, camera motion, colours, internal cuts with frame indices, and any state change with its approximate frame).
Then score the clip 0-10 against EACH of the 6 slots (10 = matches every detail incl. before-state, change and after-state; near-duplicates with wrong framing/camera/colour/mirroring should score lower and say why). Give approxChangeFrame for slots with score >= 4 (else -1).
Return all 6 scores for every clip. Be honest; do not inflate.`, {label: `survey-${ids.join("-")}`, phase: "Survey", schema: surveySchema})));

const survey = {};
const surveyMissing = [];
surveyResults.forEach((r, bi) => {
  if (!r || !Array.isArray(r.clips)) { surveyMissing.push(...batches[bi]); return; }
  for (const c of r.clips) if (c && c.id) survey[String(c.id).padStart(2, "0")] = c;
  for (const id of batches[bi]) if (!survey[id]) surveyMissing.push(id);
});
// retry missing clips once
if (surveyMissing.length) {
  log(`Retrying survey for ${surveyMissing.join(",")}`);
  const retryBatches = [];
  for (let i = 0; i < surveyMissing.length; i += BATCH) retryBatches.push(surveyMissing.slice(i, i + BATCH));
  const rr = await parallel(retryBatches.map(ids => () => agent(CONTEXT + `\n${setupInfo}\n
YOUR ASSIGNMENT (survey retry): clips ${ids.join(", ")}. Describe each clip shot by shot and score 0-10 against each of the 6 slots with approxChangeFrame (-1 if n/a).`, {label: `survey-retry-${ids.join("-")}`, phase: "Survey", schema: surveySchema})));
  rr.forEach(r => { if (r && Array.isArray(r.clips)) for (const c of r.clips) if (c && c.id) survey[String(c.id).padStart(2, "0")] = c; });
}
const unsurveyed = CLIP_IDS.filter(id => !survey[id]);

function scoreOf(id, slot) {
  const c = survey[id];
  if (!c || !Array.isArray(c.scores)) return -1;
  const s = c.scores.find(x => x && x.slot === slot);
  return s ? s.score : -1;
}
const digest = CLIP_IDS.map(id => {
  const c = survey[id];
  if (!c) return `${id}: (not surveyed)`;
  const sc = (c.scores || []).map(s => `s${s.slot}=${s.score}${s.approxChangeFrame >= 0 ? "@" + s.approxChangeFrame : ""}`).join(" ");
  return `${id} [${frameCounts[id] ?? c.frames ?? "?"} fr]: ${c.description} | ${sc}`;
}).join("\n");

// ---------- Phase 3: per-slot verification ----------
phase("Slot verification");
function shortlist(slot, exclude) {
  const ranked = CLIP_IDS.filter(id => !(exclude || []).includes(id))
    .map(id => ({id, s: scoreOf(id, slot)})).sort((a, b) => b.s - a.s);
  let list = ranked.filter(x => x.s >= 4).slice(0, 6);
  if (list.length < 3) list = ranked.slice(0, 3);
  return list.map(x => x.id).concat(unsurveyed.filter(id => !(exclude || []).includes(id))).filter((v, i, a) => a.indexOf(v) === i);
}

function slotPrompt(b, cands, extra) {
  return CONTEXT + `\n${setupInfo}\n
Survey digest of all clips (from other workers; may contain errors):
${digest}

YOUR ASSIGNMENT (frame-accurate verification for slot ${b.slot}):
${SLOT_TEXT[b.slot]}
Slot length ${b.len} frames, accent offset ${b.offset} (change point must be source frame sourceStart+${b.offset}).
Candidates to examine closely: ${cands.join(", ")}. If the digest suggests another clip could match better, examine it too.
For each candidate:
- Extract dense frames around the relevant shot and view them; check every storyboard detail (characters, framing, camera motion, before-state, change, after-state). Reject near-duplicates that differ (mirrored, recoloured, different framing/camera, missing elements).
- Determine the exact change point = the FIRST decoded frame at which the later state holds. Use per-frame stats (luma/colour/diff) to pin it to the frame, then visually confirm the frames c-2..c+2 (e.g. slot 1: first frame of flash/bright state; slot 2: first fully black frame; slot 3: first frame cables visible coming out of the left corner; slot 4: first frame the wall breaks; slot 5: first frame machinery replaces the curtain; slot 6: first frame the cold green state holds — for gradual changes, justify your choice with colour stats and pick the frame where the scene has switched to the later state).
- Compute sourceStart=c-${b.offset}, sourceEnd=sourceStart+${b.len}, feasible iff sourceStart>=0 and sourceEnd<=decoded frame count. Check that before-state, change and after-state all fall within [sourceStart,sourceEnd) as the main content.
Rank candidates by confidence (0-1) of being the intended clip. Include infeasible ones with feasible=false. Write your evidence notes to /workspace/work/slot${b.slot}_notes.md.${extra || ""}`;
}

const slotResults = {};
const firstPass = await parallel(BEATS.map(b => () => agent(slotPrompt(b, shortlist(b.slot)), {label: `slot-${b.slot}`, phase: "Slot verification", schema: slotSchema})));
BEATS.forEach((b, i) => { slotResults[b.slot] = firstPass[i]; });

function feasibleOptions(slot) {
  const r = slotResults[slot];
  if (!r || !Array.isArray(r.ranked)) return [];
  const b = BEATS.find(x => x.slot === slot);
  return r.ranked.filter(o => {
    if (!o || !o.feasible) return false;
    const id = String(o.source).padStart(2, "0");
    const fc = frameCounts[id] ?? o.clipFrames;
    const st = o.changeFrame - b.offset;
    return st >= 0 && st + b.len <= fc && o.confidence > 0.05;
  }).map(o => ({...o, source: String(o.source).padStart(2, "0"), sourceStart: o.changeFrame - b.offset, sourceEnd: o.changeFrame - b.offset + b.len}));
}

// Fallback: broader search for slots without feasible options
for (const b of BEATS) {
  if (feasibleOptions(b.slot).length === 0) {
    log(`Slot ${b.slot}: no feasible candidate; broad search`);
    const tried = (slotResults[b.slot]?.ranked || []).map(o => String(o.source).padStart(2, "0"));
    const r = await agent(slotPrompt(b, CLIP_IDS.filter(id => !tried.includes(id)),
      `\nPREVIOUS ATTEMPT found no feasible candidate among ${tried.join(", ") || "(none)"}. Previous notes: ${slotResults[b.slot]?.notes || "n/a"}. Scan ALL remaining clips' contact sheets for this slot, and re-check whether a previously tried clip's change frame was mis-measured.`),
      {label: `slot-${b.slot}-broad`, phase: "Slot verification", schema: slotSchema});
    if (r && Array.isArray(r.ranked)) {
      const prev = slotResults[b.slot]?.ranked || [];
      slotResults[b.slot] = {slot: b.slot, ranked: prev.concat(r.ranked), notes: (slotResults[b.slot]?.notes || "") + " | broad: " + r.notes};
    }
  }
}

// ---------- Phase 4: assignment (distinct sources, maximise confidence) ----------
phase("Assignment");
function assign() {
  const opts = BEATS.map(b => feasibleOptions(b.slot).sort((x, y) => y.confidence - x.confidence).slice(0, 6));
  let best = null, bestScore = -Infinity;
  const cur = [];
  const used = new Set();
  function rec(i, score) {
    if (i === opts.length) { if (score > bestScore) { bestScore = score; best = cur.slice(); } return; }
    const list = opts[i];
    let any = false;
    for (const o of list) {
      if (used.has(o.source)) continue;
      any = true; used.add(o.source); cur.push(o);
      rec(i + 1, score + o.confidence);
      cur.pop(); used.delete(o.source);
    }
    // allow slot to be unfilled (heavy penalty) so we still get a partial plan
    cur.push(null); rec(i + 1, score - 10); cur.pop();
  }
  rec(0, 0);
  return best;
}
let plan = assign();
const conflicts = [];
if (plan) BEATS.forEach((b, i) => {
  const top = feasibleOptions(b.slot).sort((x, y) => y.confidence - x.confidence)[0];
  if (top && plan[i] && top.source !== plan[i].source) conflicts.push(`slot ${b.slot}: top choice ${top.source} displaced by distinctness; using ${plan[i].source}`);
});

// If the same clip is the top choice for 2 slots, or the confidence is low, run an arbitration worker
const lowConf = plan ? BEATS.filter((b, i) => !plan[i] || plan[i].confidence < 0.5).map(b => b.slot) : BEATS.map(b => b.slot);
if (conflicts.length || lowConf.length) {
  log(`Arbitration needed: conflicts=${conflicts.length}, lowConf=${lowConf.join(",")}`);
  const arb = await agent(CONTEXT + `\n${setupInfo}\n
Survey digest:\n${digest}\n
Per-slot verification results (JSON):\n${JSON.stringify(slotResults)}\n
Current automatic assignment: ${JSON.stringify(plan)}\nConflicts: ${JSON.stringify(conflicts)}\nLow-confidence/unfilled slots: ${JSON.stringify(lowConf)}\n
YOUR ASSIGNMENT (arbitration): resolve these issues by re-examining the disputed/low-confidence clips frame by frame. Decide the best distinct source for EVERY slot with an exact change frame. Return the result with schema: one 'ranked' list per slot is not needed — instead return slot=0 and put exactly one entry per slot into 'ranked' in slot order 1..6 (source, confidence, changeFrame, clipFrames, sourceStart, sourceEnd, feasible, reasons starting with 'slot N:').`,
    {label: "arbitration", phase: "Assignment", schema: slotSchema});
  if (arb && Array.isArray(arb.ranked) && arb.ranked.length === 6) {
    const newPlan = arb.ranked.map((o, i) => {
      const b = BEATS[i];
      const src = String(o.source).padStart(2, "0");
      const fc = frameCounts[src] ?? o.clipFrames;
      const st = o.changeFrame - b.offset;
      if (!(st >= 0 && st + b.len <= fc)) return null;
      return {...o, source: src, sourceStart: st, sourceEnd: st + b.len};
    });
    const srcs = newPlan.filter(Boolean).map(o => o.source);
    if (newPlan.every(Boolean) && new Set(srcs).size === 6) plan = newPlan;
    else log("Arbitration result invalid (infeasible or duplicate); keeping automatic plan");
  }
}

if (!plan || plan.some(p => !p)) {
  return {status: "unresolved", reason: "Could not find a feasible distinct candidate for every slot", plan, slotResults, conflicts};
}

const segments = BEATS.map((b, i) => ({
  slot: b.slot, source: plan[i].source,
  source_frames: [plan[i].sourceStart, plan[i].sourceEnd],
  output_frames: [b.start, b.end],
  change_source_frame: plan[i].changeFrame, change_output_frame: b.accent,
  confidence: plan[i].confidence
}));
log("Plan: " + segments.map(s => `${s.slot}:${s.source}[${s.source_frames}]`).join(" "));

// ---------- Phase 5: render ----------
function renderPrompt(segs, extra) {
  return CONTEXT + `\n${setupInfo}\n
YOUR ASSIGNMENT (render deliverables) using EXACTLY this plan:
${JSON.stringify(segs, null, 1)}
1. Build /workspace/output/solution.mp4: for each segment in slot order take decoded frames [a,b) of input/clips/<source>.mp4 (exact decoded-frame indices, e.g. ffmpeg filter trim=start_frame=a:end_frame=b,setpts=PTS-STARTPTS, then concat filter), no retiming/scaling/cropping/colour changes; encode libx264 -crf 16 (<=18) -pix_fmt yuv420p, 1280x720, setsar=1, constant 30/1 fps (-r 30 / fps_mode cfr), -an, +faststart optional. Total decoded frames must be ${TOTAL_FRAMES}. Watch out for non-zero start times / B-frame timestamp issues: verify by decoding.
2. Write /workspace/output/solution.json: {"segments":[{"slot":1,"source":"NN","source_frames":[a,b],"output_frames":[c,d]}, ...]} exactly 6 objects, sources as 2-digit strings, integers only (no extra fields needed).
3. Write /workspace/output/events.csv with header exactly: slot,source,source_frame,output_frame and one row per slot (source_frame = change_source_frame, output_frame = change_output_frame).
4. Ensure /workspace/output contains exactly these 3 files (move scratch files to /workspace/work/).
5. Sanity check: ffprobe codec/pix_fmt/size/SAR/fps, count decoded frames, and for each segment compare a few output frames (first, accent, last) against the corresponding source frames (PSNR should be high, >~35 dB).${extra || ""}`;
}

phase("Render");
let render = await agent(renderPrompt(segments), {label: "render", phase: "Render", schema: renderSchema});

// ---------- Phase 6: verify + repair ----------
phase("Verify");
const verifyPrompt = (segs) => CONTEXT + `\n${setupInfo}\n
Intended plan: ${JSON.stringify(segs)}
YOUR ASSIGNMENT (independent verification; do not trust the renderer). Check /workspace/output:
- Exactly 3 files: solution.mp4, solution.json, events.csv.
- solution.mp4: h264, yuv420p, 1280x720, SAR 1:1, constant 30/1 fps, no audio stream, decoded frame count == ${TOTAL_FRAMES}.
- solution.json: valid, 6 segments in slot order, slot/source/source_frames/output_frames correct types; output_frames tile [0,${TOTAL_FRAMES}) matching beats.json boundaries; each source range length equals its slot length and lies within the clip's decoded frame count; sources distinct.
- events.csv: exact header slot,source,source_frame,output_frame; 6 rows; output_frame == accent_frame for each slot; source_frame == source_frames[0] + (accent - slot start).
- Frame-by-frame: decode the output and compare EVERY output frame against the declared source frame (e.g. PSNR/mean abs diff on downscaled frames via python or ffmpeg psnr filter on trimmed streams). Report any off-by-one shift (test neighbouring offsets ±1..±3 if mismatch).
- Change points: view output frames accent-2..accent+2 for each slot and confirm accent is the first frame of the later state for that slot's change and that the slot content matches the storyboard. If you believe a change frame is off, report it in changePointConcerns with the suggested source change frame.
passed=true only if everything checks out.`;

let verdict = await agent(verifyPrompt(segments), {label: "verify", phase: "Verify", schema: verifySchema});
let curSegs = segments;
for (let round = 0; round < 2 && (!verdict || !verdict.passed); round++) {
  // apply change-point corrections when suggested
  let extra = "";
  if (verdict && Array.isArray(verdict.changePointConcerns) && verdict.changePointConcerns.length) {
    const adjudicate = await agent(CONTEXT + `\n${setupInfo}\n
Current plan: ${JSON.stringify(curSegs)}
A verifier raised these change-point concerns: ${JSON.stringify(verdict.changePointConcerns)}
YOUR ASSIGNMENT: re-examine each flagged slot's source frames densely (view frames and colour/diff stats) and decide the correct change frame (first frame at which the later state holds). Return slot=0 and in 'ranked' one entry per slot 1..6 in order with the final source and changeFrame (unchanged slots keep their values; reasons start with 'slot N:'). Ensure feasibility (changeFrame-offset >= 0 and range within clip).`,
      {label: `adjudicate-${round}`, phase: "Verify", schema: slotSchema});
    if (adjudicate && Array.isArray(adjudicate.ranked) && adjudicate.ranked.length === 6) {
      const next = BEATS.map((b, i) => {
        const o = adjudicate.ranked[i];
        const src = String(o.source).padStart(2, "0");
        const st = o.changeFrame - b.offset;
        const fc = frameCounts[src] ?? o.clipFrames;
        if (!(st >= 0 && st + b.len <= fc)) return curSegs[i];
        return {...curSegs[i], source: src, source_frames: [st, st + b.len], change_source_frame: o.changeFrame};
      });
      if (new Set(next.map(s => s.source)).size === 6) curSegs = next;
    }
  }
  if (verdict && verdict.issues) extra = `\nFix these verifier issues: ${JSON.stringify(verdict.issues)}`;
  render = await agent(renderPrompt(curSegs, extra + "\nOverwrite existing outputs."), {label: `rerender-${round}`, phase: "Verify", schema: renderSchema});
  verdict = await agent(verifyPrompt(curSegs), {label: `reverify-${round}`, phase: "Verify", schema: verifySchema});
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  segments: curSegs,
  conflicts,
  lowConfidenceSlots: lowConf,
  unsurveyed,
  render,
  verdict
};
