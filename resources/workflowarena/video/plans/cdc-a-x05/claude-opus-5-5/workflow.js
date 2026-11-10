export const meta = {
  name: "cdc-a-x05-assembly",
  description: "Probe 45 anonymous clips (frame counts, hard cuts, thumbnails), describe every shot, match candidates to the 7 slots with frame-accurate content bounds, solve the 1248-frame length allocation deterministically, render losslessly, verify frame-by-frame and repair if needed.",
  phases: [
    {title: "Probe", detail: "ffprobe, cut detection, thumbnails/contact sheets"},
    {title: "Describe", detail: "per-clip shot descriptions and slot fit"},
    {title: "Match", detail: "per-slot candidate verification with precise frame bounds"},
    {title: "Plan", detail: "deterministic assignment + length allocation in JS"},
    {title: "Render", detail: "lossless render and solution.json"},
    {title: "Verify", detail: "technical + content verification, repair loop"}
  ]
};

const TOTAL = 1248;
const MARGIN = 12;
const IDS = Array.from({length: 45}, (_, i) => String(i + 1).padStart(2, "0"));
const norm = (id) => String(id).replace(/\D/g, "").padStart(2, "0").slice(-2);

const SLOTS = [
  {slot: 1, title: "Waking", spec: "Content: the mouth of a burrow, at first completely dark inside; the protagonist's face gradually emerges from the darkness and his ears rise. Hard cut to a side wide shot: he crawls out of the hole, stands up and stretches. Camera: medium shot of the burrow at eye level; side wide shot from a slightly low camera; both locked off."},
  {slot: 2, title: "Greeting the morning", spec: "Content: looking up at the sky, the protagonist rises into frame from the bottom edge and stretches; cut to a medium close-up of him against treetops and sky, smiling contentedly. Camera: low-angle upshot, then an eye-level medium close-up; locked off."},
  {slot: 3, title: "Absorbed", spec: "Content: white flowers in the foreground; the protagonist walks up from the distance and leans in to smell them; cut to a wide shot of him from behind; then a shot through leaves, past a dark blurred foreground shape, toward the small distant protagonist; finally a close-up of him smelling the flowers, enraptured. Camera: medium shot with foreground occlusion, wide shot, voyeuristic wide shot with foreground occlusion, close-up."},
  {slot: 4, title: "A tender contact", spec: "Content: the protagonist faces camera; a purple butterfly flies in from off-screen, settles on the tip of his nose, then lifts off and circles him while he breaks into an open-mouthed laugh; cut to his back as he walks toward a large tree in the distance. Camera: medium close-up, locked off; then a full shot from behind."},
  {slot: 5, title: "The threat gathers", spec: "Content: behind a fallen tree trunk, at first only one grey, fluffy small animal is present; a red small animal then joins it, and a third climbs out over the top of the trunk; a fruit they were holding drops onto the grass. Camera: low-camera medium shot, a single locked-off shot."},
  {slot: 6, title: "The strike", spec: "Content: it starts with the throw from behind the trunk, a fruit flying out of frame; cut to a wide shot of the protagonist alone in the meadow, struck by fruit after fruit, the last one - a red fruit - landing squarely on top of his head; cut back behind the trunk, where they keep throwing. Camera: low medium shot behind the trunk, eye-level wide shot, medium shot again. Cause and effect complete within one segment."},
  {slot: 7, title: "Humiliation", spec: "Content: a wide shot of an empty meadow and a large tree; the protagonist dashes in from frame left and runs for the trunk through a hail of falling green fruit; cut to beside the trunk, where he hides and peers out, shaken; cut to a wide shot of the three small animals jumping for joy under a tree. Camera: wide shot, medium shot beside the trunk, wide shot."}
];
const SLOT_TEXT = SLOTS.map(s => `Slot ${s.slot} (${s.title}): ${s.spec}`).join("\n");

const RULES = `Context: you work in /workspace. Read /workspace/instruction.md first (full task). Inputs: input/01.mp4 .. input/45.mp4 (silent, 640x360, 24 fps, 6-12 s, anonymous, random numbering; several overlap in time or show different portions of the same event). Scratch work goes ONLY in work/; deliverables ONLY in output/ (which must finally contain only solution.mp4 and solution.json). Python 3.11 + ffmpeg/ffprobe available, no network, no GPU. Frame numbers are 0-based decoded frame indices of a candidate. A "cut at frame c" means frame c is the FIRST frame of a new shot. Never guess clip identity from file names, sizes or hashes - only from actually looking at decoded frames. You can view extracted JPEG/PNG images with your file-reading tool. Be efficient: the whole job has roughly one hour of wall time.`;

// ---------------- Phase 1: Probe ----------------
phase("Probe");
const probeSchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      id: {type: "string"},
      frames: {type: "integer"},
      fps: {type: "string"},
      cuts: {type: "array", items: {type: "integer"}},
      gradual: {type: "array", items: {type: "string"}},
      notes: {type: "string"}
    }, required: ["id", "frames", "cuts"]}},
    framesDir: {type: "string"},
    sheetsDir: {type: "string"},
    sheetLayout: {type: "string"},
    notes: {type: "string"}
  },
  required: ["clips"]
};

const PROBE_PROMPT = `${RULES}

Your assignment: technical probe of all 45 candidates. Write Python scripts under work/ and run them.
1. For every input/NN.mp4: ffprobe width/height/SAR/r_frame_rate/pix_fmt and the exact decoded frame count (ffprobe -count_frames, cross-check by actually decoding, e.g. counting rawvideo frames). Note any VFR/timestamp oddities.
2. Detect HARD CUTS frame-accurately: decode each clip to small grayscale (e.g. 160x90, ffmpeg -f rawvideo -pix_fmt gray piped into Python), compute per-frame mean absolute difference and a histogram distance between consecutive frames; a cut at frame i is a strong outlier versus neighbouring differences (e.g. > 3x local median and above an absolute floor). Cross-check with ffmpeg select='gt(scene,0.3)',showinfo. For any ambiguous spike (fast motion, flashes, fruit flying, dark frames) extract frames i-1 and i as images and LOOK at them to decide. Record gradual transitions (fades/dissolves) and long dark stretches separately in 'gradual' (free text with frame ranges).
3. Save everything to work/probe.json as {"NN": {"frames":..., "cuts":[...], "gradual":[...], ...}}.
4. Thumbnails for later workers: work/frames/NN/fXXXX.jpg (XXXX = 4-digit frame index) for every 4th frame (0,4,8,...) plus frames c-1 and c for every cut, at 320x180. Also a contact sheet per clip work/sheets/NN.jpg: ffmpeg select='not(mod(n\\,12))',scale=160:90,tile=6xR (R rows enough to hold all frames; row-major, tile k = frame 12k). If drawtext with a font works, burn frame numbers; otherwise rely on the row-major mapping. Describe the exact layout in sheetLayout.
Return the structured result: one entry per clip with id ("01".."45"), frames, cuts (sorted ints), gradual, notes. Do not choose clips for slots.`;

let probe = null;
try { probe = await agent(PROBE_PROMPT, {label: "probe", phase: "Probe", schema: probeSchema}); } catch (e) { probe = null; }
if (!probe) {
  try { probe = await agent(PROBE_PROMPT + "\n(Second attempt: a previous attempt failed; reuse any files already present in work/.)", {label: "probe-retry", phase: "Probe", schema: probeSchema}); } catch (e) { probe = null; }
}
const clipInfo = {};
if (probe && Array.isArray(probe.clips)) for (const c of probe.clips) clipInfo[norm(c.id)] = c;
log(`Probe: ${Object.keys(clipInfo).length} clips characterised`);
const probeNote = probe ? `Probe data: work/probe.json; thumbnails ${probe.framesDir || "work/frames/NN/"}; contact sheets ${probe.sheetsDir || "work/sheets/NN.jpg"}; layout: ${probe.sheetLayout || "row-major, tile k = frame 12k"}.` : `Probe stage FAILED: no precomputed data. Run your own ffprobe frame counts and cut detection (frame-difference outliers, visually confirmed) for your clips and extract your own frames into work/frames/NN/.`;

// ---------------- Phase 2: Describe ----------------
const descSchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      id: {type: "string"},
      frames: {type: "integer"},
      cuts: {type: "array", items: {type: "integer"}},
      shots: {type: "array", items: {type: "object", properties: {
        start: {type: "integer"}, end: {type: "integer"},
        camera: {type: "string"}, content: {type: "string"}
      }, required: ["start", "end", "camera", "content"]}},
      summary: {type: "string"},
      slotFit: {type: "array", items: {type: "object", properties: {
        slot: {type: "integer"}, fit: {type: "string", enum: ["full", "partial", "none"]}, note: {type: "string"}
      }, required: ["slot", "fit"]}}
    }, required: ["id", "shots", "summary", "slotFit"]}}
  },
  required: ["clips"]
};

const descPrompt = (ids) => `${RULES}
${probeNote}

The 7-slot shot list (from instruction.md):
${SLOT_TEXT}

Your assignment: describe candidates ${ids.join(", ")} in detail. For each clip, using the probe cut list (${ids.map(id => `${id}: frames=${clipInfo[id] ? clipInfo[id].frames : "?"} cuts=${clipInfo[id] ? JSON.stringify(clipInfo[id].cuts) : "?"}`).join("; ")}), view the contact sheet and enough individual frames (work/frames/NN/) to describe every shot: frame range [start,end) half-open, framing/angle/camera movement, which characters appear (protagonist = large rabbit-like character; also small grey fluffy animal, red small animal, butterfly, etc.), and the actions IN ORDER with approximate frame numbers of key events (e.g. "butterfly lands on nose ~f80"). If you see a cut the probe missed or a false cut, say so and give corrected cuts. Then rate fit for each of slots 1-7: "full" only if this clip alone contains EVERYTHING that slot describes, in order; "partial" if it contains only a portion (note which part is missing). Also write each clip's description to work/desc/NN.json. Be factual; do not invent content you did not see.`;

phase("Describe");
const batches = [];
for (let i = 0; i < IDS.length; i += 4) batches.push(IDS.slice(i, i + 4));
let descResults = await parallel(batches.map((b, bi) => () => agent(descPrompt(b), {label: `describe-${b[0]}-${b[b.length - 1]}`, phase: "Describe", schema: descSchema})));
const missingBatches = batches.map((b, i) => descResults[i] ? null : i).filter(i => i !== null);
if (missingBatches.length) {
  const retry = await parallel(missingBatches.map(i => () => agent(descPrompt(batches[i]), {label: `describe-retry-${batches[i][0]}`, phase: "Describe", schema: descSchema})));
  missingBatches.forEach((i, k) => { descResults[i] = retry[k]; });
}
const descById = {};
for (const r of descResults) if (r && Array.isArray(r.clips)) for (const c of r.clips) descById[norm(c.id)] = c;
const undescribed = IDS.filter(id => !descById[id]);
log(`Described ${Object.keys(descById).length}/45 clips; missing: ${undescribed.join(",") || "none"}`);

const compactDesc = IDS.map(id => {
  const d = descById[id];
  const ci = clipInfo[id];
  if (!d) return {id, frames: ci ? ci.frames : null, cuts: ci ? ci.cuts : null, missing: true};
  return {id, frames: d.frames || (ci ? ci.frames : null), cuts: d.cuts || (ci ? ci.cuts : null), shots: d.shots, summary: d.summary,
    fits: (d.slotFit || []).filter(f => f.fit !== "none").map(f => `${f.slot}:${f.fit}${f.note ? " (" + f.note + ")" : ""}`)};
});

// ---------------- Phase 3: Match per slot ----------------
const candSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    candidates: {type: "array", items: {type: "object", properties: {
      source: {type: "string"},
      confidence: {type: "number"},
      coversAll: {type: "boolean"},
      frames: {type: "integer"},
      cuts: {type: "array", items: {type: "integer"}},
      inFloor: {type: "integer"}, inCeil: {type: "integer"},
      outFloor: {type: "integer"}, outCeil: {type: "integer"},
      evidence: {type: "string"}
    }, required: ["source", "confidence", "coversAll", "inFloor", "inCeil", "outFloor", "outCeil", "evidence"]}},
    notes: {type: "string"}
  },
  required: ["slot", "candidates"]
};

const slotPrompt = (s, extra) => `${RULES}
${probeNote}

Your assignment: find the best candidate clip(s) for SLOT ${s.slot} ("${s.title}") and determine precise frame bounds.
Slot ${s.slot} specification: ${s.spec}
(Other slots, for context so you can tell similar material apart:)
${SLOT_TEXT}

Shot descriptions of all 45 candidates produced by earlier workers (may contain errors; clips marked missing were not described - check them yourself if plausible):
${JSON.stringify(compactDesc)}

Procedure:
1. Shortlist plausible clips from the descriptions (include "partial" ones that might actually be complete). Several candidates overlap in time or show different portions of the same event - the correct choice must contain EVERYTHING the slot describes, in the described order, within ONE contiguous range. Prefer the clip that covers all required beats with the least unrelated material.
2. VERIFY each shortlisted clip yourself by viewing frames (work/frames/NN/, or extract more with ffmpeg -vf select='eq(n\\,K)' etc.), densely (every 1-4 frames) around the first and last required beats and around cuts. Confirm the cut positions.
3. For each of up to 4 ranked candidates report (all 0-based frame indices of that clip, half-open ranges):
   - inCeil: the LATEST in-point that still shows the slot's first required beat from its beginning (e.g. the burrow still completely dark, the protagonist not yet in frame, only one grey animal present, the throw before the fruit leaves frame, the meadow still empty...). If the first required shot starts at an internal cut c, inCeil should be > c (some frames after the cut are fine).
   - inFloor: the EARLIEST acceptable in-point: 0, or the first frame after any preceding material that does NOT belong to this slot (e.g. first frame of the first required shot). inFloor <= inCeil.
   - outFloor: the EARLIEST exclusive out-point that still contains the slot's last required beat completely (e.g. the stretch completed, the smile shown, the walk toward the tree established, the fruit landed on the grass, the animals' jumping shown).
   - outCeil: the LATEST acceptable exclusive out-point: clip frame count, or the cut frame where unrelated following material starts. outFloor <= outCeil.
   - frames (clip frame count) and cuts (verified internal hard-cut frames of the whole clip).
   - Do not apply the 12-frame cut margin yourself; the planner enforces |in-point - cut| >= 12 and |out-point - cut| >= 12 automatically, so just give honest content bounds.
   - coversAll: true only if you verified all beats are present in order. confidence 0..1. evidence: concise frame-referenced justification.
If no clip covers everything, still return the best partial ones with coversAll=false and explain in notes.${extra ? "\n\nAdditional instructions: " + extra : ""}`;

phase("Match");
let slotResults = await parallel(SLOTS.map(s => () => agent(slotPrompt(s), {label: `slot-${s.slot}`, phase: "Match", schema: candSchema})));
const missingSlots = SLOTS.filter((s, i) => !slotResults[i] || !Array.isArray(slotResults[i].candidates) || slotResults[i].candidates.length === 0);
if (missingSlots.length) {
  const retry = await parallel(missingSlots.map(s => () => agent(slotPrompt(s, "A previous attempt returned nothing; be decisive and return your best candidates."), {label: `slot-${s.slot}-retry`, phase: "Match", schema: candSchema})));
  missingSlots.forEach((s, k) => { slotResults[s.slot - 1] = retry[k]; });
}

// ---------------- Phase 4: Plan (deterministic) ----------------
phase("Plan");
const toInt = (x, d) => (Number.isFinite(Number(x)) ? Math.round(Number(x)) : d);

function prepCand(c) {
  const src = norm(c.source);
  const ci = clipInfo[src];
  const frames = toInt(ci ? ci.frames : c.frames, toInt(c.frames, 0));
  const cutsSet = new Set();
  for (const x of (ci && Array.isArray(ci.cuts) ? ci.cuts : [])) cutsSet.add(toInt(x, -1000));
  for (const x of (Array.isArray(c.cuts) ? c.cuts : [])) cutsSet.add(toInt(x, -1000));
  const cuts = [...cutsSet].filter(x => x > 0 && x < frames).sort((a, b) => a - b);
  const clamp = (v) => Math.max(0, Math.min(frames, v));
  let inFloor = clamp(toInt(c.inFloor, 0)), inCeil = clamp(toInt(c.inCeil, 0));
  let outFloor = clamp(toInt(c.outFloor, frames)), outCeil = clamp(toInt(c.outCeil, frames));
  if (inFloor > inCeil) inFloor = inCeil;
  if (outCeil < outFloor) outCeil = outFloor;
  return {src, frames, cuts, inFloor, inCeil, outFloor, outCeil, confidence: Number(c.confidence) || 0, coversAll: !!c.coversAll, evidence: c.evidence || ""};
}

function legal(a, b, cuts, strict) {
  for (const c of cuts) {
    if (strict) {
      if (Math.abs(a - c) < MARGIN || Math.abs(b - c) < MARGIN) return false;
    } else {
      if (c > a - 2 && c < a + MARGIN) return false;
      if (c > b - MARGIN && c < b + 2) return false;
    }
  }
  return true;
}

function lengthMap(p, strict) {
  const m = new Map();
  if (!p.frames) return m;
  for (let a = p.inFloor; a <= p.inCeil; a++) {
    for (let b = p.outFloor; b <= p.outCeil; b++) {
      if (b <= a || b > p.frames || a < 0) continue;
      if (!legal(a, b, p.cuts, strict)) continue;
      const L = b - a;
      const bal = Math.abs((p.inCeil - a) - (b - p.outFloor));
      const prev = m.get(L);
      if (!prev || bal < prev.bal) m.set(L, {a, b, bal});
    }
  }
  return m;
}

const K = 4;
const slotCands = SLOTS.map((s, i) => {
  const r = slotResults[i];
  const list = (r && Array.isArray(r.candidates) ? r.candidates : []).map(prepCand).filter(p => p.frames > 0);
  list.sort((x, y) => (Number(y.coversAll) - Number(x.coversAll)) || (y.confidence - x.confidence));
  const seen = new Set();
  const uniq = [];
  for (const p of list) if (!seen.has(p.src)) { seen.add(p.src); uniq.push(p); }
  return uniq.slice(0, K).map(p => ({...p, maps: {strict: lengthMap(p, true), relaxed: lengthMap(p, false)}}));
});

function solveLengths(chosen, mode) {
  const lists = chosen.map(p => [...p.maps[mode].keys()].sort((a, b) => a - b));
  if (lists.some(l => l.length === 0)) return null;
  const mins = lists.map(l => l[0]), maxs = lists.map(l => l[l.length - 1]);
  const sMin = mins.reduce((a, b) => a + b, 0), sMax = maxs.reduce((a, b) => a + b, 0);
  if (sMin > TOTAL || sMax < TOTAL) return null;
  const f = sMax === sMin ? 0 : (TOTAL - sMin) / (sMax - sMin);
  const targets = mins.map((mn, k) => mn + f * (maxs[k] - mn));
  const n = chosen.length;
  let dp = new Array(TOTAL + 1).fill(Infinity);
  dp[0] = 0;
  const parents = [];
  for (let k = 0; k < n; k++) {
    const nd = new Array(TOTAL + 1).fill(Infinity);
    const par = new Array(TOTAL + 1).fill(-1);
    for (let s = 0; s <= TOTAL; s++) {
      if (dp[s] === Infinity) continue;
      for (const L of lists[k]) {
        const t = s + L;
        if (t > TOTAL) break;
        const cost = dp[s] + Math.abs(L - targets[k]);
        if (cost < nd[t]) { nd[t] = cost; par[t] = L; }
      }
    }
    parents.push(par);
    dp = nd;
  }
  if (dp[TOTAL] === Infinity) return null;
  const lens = new Array(n);
  let s = TOTAL;
  for (let k = n - 1; k >= 0; k--) { lens[k] = parents[k][s]; s -= lens[k]; }
  return lens;
}

function bestPlan() {
  const combos = [];
  const pick = new Array(SLOTS.length);
  function rec(k, used, score) {
    if (k === SLOTS.length) { combos.push({idx: pick.slice(), score}); return; }
    const cands = slotCands[k];
    for (let j = 0; j < cands.length; j++) {
      const p = cands[j];
      if (used.has(p.src)) continue;
      pick[k] = j; used.add(p.src);
      rec(k + 1, used, score + p.confidence + (p.coversAll ? 1 : 0) - 0.05 * j);
      used.delete(p.src);
    }
  }
  if (slotCands.some(c => c.length === 0)) return null;
  rec(0, new Set(), 0);
  combos.sort((x, y) => y.score - x.score);
  for (const mode of ["strict", "relaxed"]) {
    for (const combo of combos.slice(0, 300)) {
      const chosen = combo.idx.map((j, k) => slotCands[k][j]);
      const lens = solveLengths(chosen, mode);
      if (!lens) continue;
      let o = 0;
      const segments = chosen.map((p, k) => {
        const e = p.maps[mode].get(lens[k]);
        const seg = {slot: k + 1, source: p.src, source_frames: [e.a, e.b], output_frames: [o, o + lens[k]]};
        o += lens[k];
        return seg;
      });
      return {mode, score: combo.score, segments, chosen: chosen.map(p => ({src: p.src, coversAll: p.coversAll, confidence: p.confidence, frames: p.frames, cuts: p.cuts, bounds: [p.inFloor, p.inCeil, p.outFloor, p.outCeil]}))};
    }
  }
  return null;
}

const planSchema = {
  type: "object",
  properties: {
    segments: {type: "array", items: {type: "object", properties: {
      slot: {type: "integer"}, source: {type: "string"},
      source_frames: {type: "array", items: {type: "integer"}},
      output_frames: {type: "array", items: {type: "integer"}}
    }, required: ["slot", "source", "source_frames", "output_frames"]}},
    notes: {type: "string"}
  },
  required: ["segments"]
};

function checkPlan(segs) {
  const issues = [];
  if (!Array.isArray(segs) || segs.length !== 7) return ["plan must have exactly 7 segments"];
  const srcs = new Set();
  let o = 0;
  segs.forEach((s, k) => {
    if (s.slot !== k + 1) issues.push(`segment ${k} has slot ${s.slot}`);
    const src = norm(s.source);
    if (srcs.has(src)) issues.push(`source ${src} reused`);
    srcs.add(src);
    const [a, b] = s.source_frames, [c, d] = s.output_frames;
    if (c !== o) issues.push(`slot ${k + 1} output start ${c} != ${o}`);
    if (d - c !== b - a || b <= a) issues.push(`slot ${k + 1} length mismatch`);
    const ci = clipInfo[src];
    if (ci) {
      if (a < 0 || b > ci.frames) issues.push(`slot ${k + 1} range outside clip (${ci.frames} frames)`);
      if (!legal(a, b, (ci.cuts || []).filter(x => x > 0 && x < ci.frames), false)) issues.push(`slot ${k + 1} in/out within ${MARGIN} frames of a cut`);
    }
    o = d;
  });
  if (o !== TOTAL) issues.push(`total ${o} != ${TOTAL}`);
  return issues;
}

let plan = bestPlan();
let planOrigin = "deterministic";
if (!plan) {
  log("Deterministic planner found no feasible combination; delegating to a planning worker");
  const pp = await agent(`${RULES}
${probeNote}
Shot list:
${SLOT_TEXT}

Per-slot candidate analyses from verification workers (frame bounds: inFloor/inCeil = earliest/latest acceptable in-point; outFloor/outCeil = earliest/latest acceptable exclusive out-point):
${JSON.stringify(slotResults)}

An automatic solver could not find 7 DISTINCT candidates whose legal lengths sum to exactly ${TOTAL} frames while keeping every in/out point at least ${MARGIN} frames from any internal cut. Resolve this: re-inspect the relevant clips (view frames), possibly choose other candidates or re-derive tighter/looser content bounds, and produce a plan of 7 segments (slot order, distinct sources, contiguous output_frames from 0 to ${TOTAL}, d-c=b-a, all required content of each slot inside its range, in/out points >= ${MARGIN} frames from any cut in that clip). Check the arithmetic with Python. Save it to work/plan.json and return it. Do not render.`, {label: "plan-fallback", phase: "Plan", schema: planSchema});
  if (pp && Array.isArray(pp.segments)) {
    plan = {mode: "worker", segments: pp.segments.map(s => ({...s, source: norm(s.source)})), notes: pp.notes};
    planOrigin = "worker";
  }
}
if (!plan) return {status: "unresolved", reason: "No plan could be produced", slotResults, undescribed};
let planIssues = checkPlan(plan.segments);
log(`Plan (${planOrigin}, mode ${plan.mode}): ${JSON.stringify(plan.segments)}; issues: ${planIssues.join("; ") || "none"}`);

// ---------------- Phase 5: Render ----------------
const renderSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    frameCount: {type: "integer"},
    framemd5Match: {type: "boolean"},
    notes: {type: "string"}
  },
  required: ["ok", "notes"]
};

const renderPrompt = (segs, why) => `${RULES}

Your assignment: render the deliverables EXACTLY according to this plan (do not change clip choices or ranges${why ? "; context: " + why : ""}):
${JSON.stringify({segments: segs})}

1. Write output/solution.json as {"segments":[...]} with exactly these 7 objects, keys slot, source ("NN" string), source_frames [a,b], output_frames [c,d] (integers, half-open).
2. Render output/solution.mp4 with ONE ffmpeg command: inputs input/NN.mp4 for each segment; per input filter trim=start_frame=a:end_frame=b,setpts=PTS-STARTPTS,setsar=1 (frame-index based trim; do NOT use time-based seeking), concat=n=7:v=1:a=0, then fps-safe output: -an -c:v libx264 -preset medium -qp 0 -pix_fmt yuv420p -r 24 (constant 24/1), -fps_mode cfr (or -vsync cfr on older ffmpeg), -movflags +faststart. No scaling/cropping/filters beyond trim/setpts/setsar/concat. If qp 0 with yuv420p is not possible, use -crf 10.
3. Verify with ffprobe: codec h264, yuv420p, 640x360, SAR 1:1, r_frame_rate 24/1, avg 24/1, no audio stream, decoded frame count exactly ${TOTAL}.
4. Frame-exactness: compare ffmpeg -f framemd5 (or per-frame PSNR if not lossless) of the output frames [c,d) against source frames [a,b) of each segment decoded the same way (gray or yuv420p). Every frame must match (lossless) or PSNR > 40.
5. Ensure output/ contains only solution.mp4 and solution.json (move any scratch to work/).
Return ok=true only if all checks pass; give frameCount and details in notes.`;

phase("Render");
let render = await agent(renderPrompt(plan.segments), {label: "render", phase: "Render", schema: renderSchema});
if (!render || !render.ok) {
  render = await agent(renderPrompt(plan.segments, "a previous render attempt failed or reported: " + (render ? render.notes : "no result") + ". Fix the technical problem."), {label: "render-retry", phase: "Render", schema: renderSchema});
}

// ---------------- Phase 6: Verify + repair ----------------
const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    technicalOk: {type: "boolean"},
    issues: {type: "array", items: {type: "object", properties: {
      slot: {type: "integer"}, kind: {type: "string"}, detail: {type: "string"}
    }, required: ["kind", "detail"]}},
    slotChecks: {type: "array", items: {type: "object", properties: {
      slot: {type: "integer"}, ok: {type: "boolean"}, note: {type: "string"}
    }, required: ["slot", "ok"]}}
  },
  required: ["passed", "technicalOk", "issues"]
};

const verifyPrompt = () => `${RULES}

Shot list:
${SLOT_TEXT}

Your assignment: independently verify the current deliverables output/solution.mp4 and output/solution.json against instruction.md. Do not modify output/.
Technical: output/ holds only the two files; JSON has 7 segments in slot order, distinct sources, integer half-open ranges, contiguous output_frames from 0 to ${TOTAL}, d-c=b-a; ranges inside each clip's decoded frame count; the video is H.264 yuv420p 640x360 SAR 1:1 constant 24/1 fps, no audio, exactly ${TOTAL} decoded frames; every output frame equals its declared source frame (framemd5 or PSNR > 40 per frame); detect internal hard cuts of each chosen source yourself (frame-difference outliers, visually confirmed) and check every in-point and out-point is at least ${MARGIN} frames from any cut inside the segment (and no 1-11 frame fragment of another shot at segment edges).
Content: for each slot, extract frames from the rendered output across the segment (first frames, every ~6 frames, around internal cuts, last frames) and LOOK at them. Confirm every described beat is present, in order, within the trimmed range (e.g. slot 1 starts with the burrow fully dark; slot 5 starts with only the grey animal and includes the fruit hitting the grass; slot 6 starts with the throw and includes the red fruit landing on his head and the cut back behind the trunk; slot 7 starts with the empty meadow, ends with the three animals jumping). Report shots that do not belong to the slot as issues too.
Report passed=true only if everything is satisfied. For each issue name the slot and be specific with frame numbers (source and output) and what is missing.`;

const repairPrompt = (issues, segs) => `${RULES}
${probeNote}

Shot list:
${SLOT_TEXT}

Current plan (already rendered to output/):
${JSON.stringify({segments: segs})}

Per-slot candidate analyses from earlier verification workers:
${JSON.stringify(slotResults)}

An independent verifier reported these problems:
${JSON.stringify(issues)}

Your assignment: fix the problems. Inspect the relevant clips (view frames) to confirm each issue before acting. You may change ranges and, if a chosen clip really lacks required content, the clip choice (use another candidate - all 7 must remain distinct). Keep the global constraints: total exactly ${TOTAL} frames, contiguous output_frames from 0, d-c=b-a, every in/out point at least ${MARGIN} frames from any internal cut of its clip, all required content of every slot kept. When lengthening/shortening one segment, rebalance others within their legal content bounds; check all arithmetic with Python. Then re-render output/solution.mp4 (frame-index trim + concat, libx264 -qp 0 yuv420p, 24/1 cfr, no audio) and rewrite output/solution.json, verify ${TOTAL} frames and framemd5 equality with sources, keep output/ to only the two files. Return the final plan.`;

phase("Verify");
let verdict = await agent(verifyPrompt(), {label: "verify-0", phase: "Verify", schema: verifySchema});
const history = [];
const MAX_REPAIRS = 2;
for (let round = 0; round < MAX_REPAIRS && (!verdict || !verdict.passed); round++) {
  const issues = verdict ? verdict.issues : [{kind: "verifier-missing", detail: "verifier returned no result; re-check deliverables and render status: " + JSON.stringify(render)}];
  history.push({round, verdict});
  const repaired = await agent(repairPrompt(issues, plan.segments), {label: `repair-${round + 1}`, phase: "Verify", schema: planSchema});
  if (repaired && Array.isArray(repaired.segments) && repaired.segments.length === 7) {
    plan = {...plan, mode: "repaired", segments: repaired.segments.map(s => ({...s, source: norm(s.source)})), notes: repaired.notes};
    planIssues = checkPlan(plan.segments);
    log(`Repair ${round + 1}: ${JSON.stringify(plan.segments)}; local issues: ${planIssues.join("; ") || "none"}`);
  } else {
    log(`Repair ${round + 1} returned no usable plan`);
  }
  verdict = await agent(verifyPrompt(), {label: `verify-${round + 1}`, phase: "Verify", schema: verifySchema});
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  plan: plan.segments,
  planMode: plan.mode,
  planOrigin,
  localPlanIssues: planIssues,
  render,
  verdict,
  verifyHistory: history,
  undescribedClips: undescribed,
  slotCandidates: slotCands.map((c, k) => ({slot: k + 1, candidates: c.map(p => ({src: p.src, confidence: p.confidence, coversAll: p.coversAll, bounds: [p.inFloor, p.inCeil, p.outFloor, p.outCeil], cuts: p.cuts}))}))
};
