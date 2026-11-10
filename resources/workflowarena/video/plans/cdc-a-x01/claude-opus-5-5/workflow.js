export const meta = {
  name: "cdc-a-x01-pursuit-search-assembly",
  description: "Catalog 40 anonymous clips (cuts, motion, contact sheets), describe them, match each of 7 slots with an independent review, allocate frame ranges deterministically to total 1650 frames, assemble with ffmpeg, verify, and repair if needed.",
  phases: [
    {title: "Catalog", detail: "ffprobe, cut detection, global motion, contact sheets for all 40 clips"},
    {title: "Describe", detail: "Visual per-shot descriptions of every clip in batches"},
    {title: "Match", detail: "Per-slot candidate selection, range bounds, independent review"},
    {title: "Allocate", detail: "Resolve duplicates, deterministic range allocation to 1650 frames"},
    {title: "Assemble", detail: "Render output/assembly.mp4 and output/selection.json"},
    {title: "Verify", detail: "Independent verification and repair loop"}
  ]
};

const ROOT = "/workspace";
const TOTAL = 1650;
const CLIP_IDS = Array.from({length: 40}, (_, i) => String(i + 1).padStart(2, "0"));

const SLOTS = [
  {slot: 1, title: "Establishing: the endless snowfield",
   text: "Aerial. Snow-covered crags and blue ice in the foreground; past them an open snowfield, one tiny walker and a winding line of footprints behind them. Single shot. Camera: a steady aerial fly-forward with a continuous lateral drift, at an even speed."},
  {slot: 2, title: "Collapse: the searcher gives out",
   text: "Close-up of a red-haired woman's face as she lies on her side in the snow; tilted, ground-level framing, snow drifting past. Single shot. Camera: a slow push-in on her face with a slight drift, continuing to the end of the shot."},
  {slot: 3, title: "Transition: the remembered city",
   text: "A city panorama fading up from black (dense rooftops, a tower in the distance), cut to a high-angle shot looking down a narrow alley. Two shots. Camera: both shots locked off; the framing does not change within either shot."},
  {slot: 4, title: "Searching along the wall",
   text: "The frame opens almost entirely covered by a large dark foreground mass; it sweeps away to reveal a short-red-haired girl against a sunlit wall; she leans out to look and moves along the wall, and the framing ends behind her shoulder. Single shot. Camera: a lateral tracking move travelling with her, with a slight handheld feel."},
  {slot: 5, title: "The chase",
   text: "Close shot of the short-red-haired girl turning away; wide shot of her running down a narrow alley; she climbs over the edge of a roof; an injured small winged creature on the roof tiles. Camera: in both the running shot and the creature shot the camera pushes forward."},
  {slot: 6, title: "Discovery and approach",
   text: "Close-up of the girl's gaze; a hand reaching toward the small winged creature on the tiles; close-up of the girl breaking into a smile. Three shots. Camera: the two face close-ups are locked off; the middle shot pulls back while trucking sideways, gradually opening up the hand-creature relationship."},
  {slot: 7, title: "Losing control",
   text: "High overhead view of a dim interior, papers and clutter strewn on the floor; the image becomes turbulent later in the shot. Single shot. Camera: completely static at first, then it starts to push forward and keeps accelerating."}
];
const SLOT_TEXT = SLOTS.map(s => `Slot ${s.slot} · ${s.title}: ${s.text}`).join("\n");

const CONTRACT = `Assembly contract (from ${ROOT}/instruction.md): for each slot use ONE contiguous range of the chosen clip at 1x, forward, no scaling/cropping/mirroring/filters/text/interpolation; the range must keep every shot and the whole camera move described for the slot; cuts inside a clip stay as they are. 7 distinct candidates. Join in slot order with hard cuts, no transitions, no black. Total exactly ${TOTAL} frames at 30 fps. Deliverables: output/assembly.mp4 (H.264, yuv420p, 1280x720, SAR 1:1, CFR 30/1, no audio, ${TOTAL} frames) and output/selection.json {"slots":[{slot, source:"NN", source_frames:[a,b], output_frames:[c,d], closest_alternative:"NN", reason}]} (half-open, 0-based, abutting, last d=${TOTAL}, b-a=d-c). output/ must contain only those two files. Drafts go in work/.`;

const COMMON = `You are working in ${ROOT} (task directory). Read ${ROOT}/instruction.md first. Inputs: ${ROOT}/input/01.mp4 ... 40.mp4 (silent, 1280x720 letterboxed, 30 fps, 6-12 s, anonymous, random numbering). Python 3.11, FFmpeg/ffprobe, OpenCV available; no network, no GPU. You can view images (JPG/PNG) with your file-reading tool — use that to actually look at frames; do not guess clip identities from file names or sizes.\n\nShot list:\n${SLOT_TEXT}\n\n${CONTRACT}\n`;

// ---------------- Phase 1: Catalog ----------------
phase("Catalog");
const catalogSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    clips: {type: "array", items: {type: "object", properties: {
      id: {type: "string"},
      frames: {type: "integer"},
      cuts: {type: "array", items: {type: "integer"}},
      fades: {type: "string"},
      anomalies: {type: "string"}
    }, required: ["id", "frames", "cuts"]}},
    notes: {type: "string"}
  },
  required: ["ok", "clips"]
};

const catalog = await agent(COMMON + `
YOUR ASSIGNMENT: build a technical catalog of all 40 clips that later workers will rely on. Do NOT pick clips for slots.

1. Write ${ROOT}/work/analyze.py (Python + OpenCV + ffprobe) and run it on all 40 clips (use multiprocessing to keep it fast; target < 10 minutes total).
2. For each clip NN write ${ROOT}/work/catalog/NN.json containing:
   - ffprobe facts: width, height, SAR, r_frame_rate, avg_frame_rate, start_time, nb_frames AND the true decoded frame count (decode every frame with OpenCV or ffprobe -count_frames; report both and flag mismatches). Frame index i means the i-th decoded frame, 0-based.
   - detected active picture area (letterbox bars) — do analysis inside it.
   - per-frame arrays: mean luma, histogram/abs-diff to previous frame, global motion estimate between consecutive frames inside the active area on a downscaled grayscale (dx, dy, zoom/scale factor, rotation — e.g. ORB/goodFeatures + estimateAffinePartial2D with RANSAC, fallback phase correlation), plus inlier ratio / residual as a "turbulence" indicator.
   - cuts: list of frame indices where a new shot starts (combine hist-diff threshold with adaptive check; also detect very short flash shots of 1-5 frames at clip start/end). Detect fades (luma ramp from/to near-black) and report fade ranges.
   - per-shot summary: [start,end), mean/std of dx, dy, cumulative zoom, cumulative pan, whether it looks locked-off (near-zero motion), whether motion accelerates (trend of speed over the shot), luma range.
3. Contact sheets: for each clip write ${ROOT}/work/sheets/NN.jpg — a grid of thumbnails (about 320px wide each) sampled every 15 frames plus the first and last frame and the first/last frame of every detected shot, each thumbnail labeled with its frame index. Keep each sheet readable (split into NN_a.jpg/NN_b.jpg if it gets too big).
4. Write ${ROOT}/work/catalog/summary.json with per clip: id, decoded frames, cuts, fades, per-shot motion summary in a compact form.
5. Open a handful of sheets yourself to sanity check they are legible and cut detection looks right; fix obvious problems.

Return the structured summary (frames = decoded frame count; cuts = shot start indices excluding 0; fades = short text; anomalies = any unusual fps/size/SAR/frame-count mismatch).`, {label: "catalog", phase: "Catalog", schema: catalogSchema});

if (!catalog) {
  return {status: "unresolved", reason: "Catalog worker failed; no technical catalog available."};
}
const frameCount = {};
for (const c of catalog.clips || []) frameCount[c.id] = c.frames;

// ---------------- Phase 2: Describe ----------------
phase("Describe");
const describeSchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      id: {type: "string"},
      frames: {type: "integer"},
      shots: {type: "array", items: {type: "object", properties: {
        start: {type: "integer"}, end: {type: "integer"},
        content: {type: "string"}, camera: {type: "string"}
      }, required: ["start", "end", "content", "camera"]}},
      overall: {type: "string"},
      plausible_slots: {type: "array", items: {type: "integer"}},
      notes: {type: "string"}
    }, required: ["id", "frames", "shots", "overall", "plausible_slots"]}}
  },
  required: ["clips"]
};

const batches = [];
for (let i = 0; i < CLIP_IDS.length; i += 5) batches.push(CLIP_IDS.slice(i, i + 5));

const descResults = await parallel(batches.map((batch, bi) => () => agent(COMMON + `
YOUR ASSIGNMENT: describe clips ${batch.join(", ")} precisely and neutrally. Do NOT make final slot picks.

Technical data already exists: ${ROOT}/work/catalog/NN.json (decoded frame counts, cuts, fades, per-frame global motion, per-shot motion summaries) and contact sheets ${ROOT}/work/sheets/NN*.jpg labeled with frame indices. Look at the sheets with your image-viewing tool. When something is ambiguous (hair colour, number of characters, whether a hand is present, black foreground mass, footprints, a tower, a winged creature, roof tiles, papers on a floor, etc.) extract extra full-resolution frames with ffmpeg into ${ROOT}/work/frames/NN_<frame>.jpg (use select='eq(n\\,K)' for exact frame indices) and look at them. Verify cut positions visually (a detected cut might be a flash or fast motion; a soft cut could be missed).

For every clip report each shot as [start,end) in decoded frame indices with: concrete visible content (setting, characters, hair colour/length, clothing, objects, lighting, weather) and the camera behaviour (locked-off / push-in / pull-back / pan / truck / aerial fly-forward / handheld shake / accelerating / turbulence), cross-checked against the motion numbers in the catalog JSON. Note fades from/to black and any stray frames from another shot at the clip edges. Also list which slot numbers (1-7) the clip could plausibly be a candidate or a decoy for, and in notes mention anything that would disqualify it (e.g. wrong hair colour, extra shot, wrong camera move, mirrored composition).

Also write your descriptions to ${ROOT}/work/desc/batch_${bi}.json. Return the structured result.`,
  {label: `describe-${batch[0]}-${batch[batch.length - 1]}`, phase: "Describe", schema: describeSchema})));

const descriptions = {};
const missingDesc = [];
batches.forEach((batch, bi) => {
  const r = descResults[bi];
  const got = new Set();
  if (r && Array.isArray(r.clips)) for (const c of r.clips) { descriptions[c.id] = c; got.add(c.id); }
  for (const id of batch) if (!got.has(id)) missingDesc.push(id);
});

if (missingDesc.length) {
  log("Retrying descriptions for: " + missingDesc.join(","));
  const retry = await agent(COMMON + `
YOUR ASSIGNMENT: describe clips ${missingDesc.join(", ")} (a previous worker failed). Use ${ROOT}/work/catalog/NN.json and ${ROOT}/work/sheets/NN*.jpg; extract extra frames with ffmpeg into ${ROOT}/work/frames/ as needed and view them. For each clip give shots [start,end) with concrete content and camera behaviour, plausible slots, and disqualifying notes. Write to ${ROOT}/work/desc/retry.json and return structured.`,
    {label: "describe-retry", phase: "Describe", schema: describeSchema});
  if (retry && Array.isArray(retry.clips)) for (const c of retry.clips) descriptions[c.id] = c;
}
const stillMissing = CLIP_IDS.filter(id => !descriptions[id]);

const compactDesc = CLIP_IDS.filter(id => descriptions[id]).map(id => {
  const d = descriptions[id];
  return {id, frames: d.frames, shots: d.shots, overall: d.overall, plausible_slots: d.plausible_slots, notes: d.notes || ""};
});
const DESC_JSON = JSON.stringify(compactDesc);

// ---------------- Phase 3: Match ----------------
phase("Match");
const pickSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    source: {type: "string"},
    confidence: {type: "string", enum: ["high", "medium", "low"]},
    clip_frames: {type: "integer"},
    shots_in_clip: {type: "array", items: {type: "array", items: {type: "integer"}}},
    core_start: {type: "integer", description: "earliest frame that MUST be included (start of first required shot / camera move)"},
    core_end: {type: "integer", description: "exclusive end of the frames that MUST be included"},
    usable_start: {type: "integer", description: "earliest frame that MAY be included without violating the slot (e.g. not including a foreign shot)"},
    usable_end: {type: "integer", description: "exclusive latest frame that MAY be included"},
    closest_alternative: {type: "string"},
    reason: {type: "string", description: "one sentence naming a concrete visible difference between the pick and the closest alternative"},
    other_candidates: {type: "array", items: {type: "object", properties: {
      id: {type: "string"}, why_rejected: {type: "string"}
    }, required: ["id", "why_rejected"]}},
    second_choice: {type: "string", description: "best fallback source if the pick must be used elsewhere, or empty"},
    evidence: {type: "string"}
  },
  required: ["slot", "source", "confidence", "core_start", "core_end", "usable_start", "usable_end", "closest_alternative", "reason", "other_candidates", "evidence"]
};

const reviewSchema = {
  type: "object",
  properties: {
    agree: {type: "boolean"},
    preferred_source: {type: "string"},
    range_ok: {type: "boolean"},
    suggested_core_start: {type: "integer"},
    suggested_core_end: {type: "integer"},
    suggested_usable_start: {type: "integer"},
    suggested_usable_end: {type: "integer"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["agree", "preferred_source", "range_ok", "issues"]
};

const RANGE_RULES = `Range rules: core_start/core_end must cover every shot listed in the slot and the WHOLE described camera move (e.g. slot 2 push-in continues to the end of the shot, so core_end = end of that shot; slot 3 includes the fade-up from black and the cut to the alley — start at the beginning of the fade-up, ideally not more than a couple of fully black frames before it, and include the whole alley shot unless a foreign shot follows; slot 4 must start on the frame almost fully covered by the dark foreground mass and end once framing is behind her shoulder; slot 5 needs close turn-away + running + roof climb + creature; slot 6 needs gaze close-up + hand/creature truck-and-pull-back + smile close-up; slot 7 needs a static opening and the accelerating push with turbulence through the end of the shot). usable_start/usable_end bound the maximal range that still matches the slot: never include frames of a shot that is not described (a "Single shot" slot must not contain any other shot; multi-shot slots must contain exactly the described shots), never include stray flash frames at clip edges. 0 <= usable_start <= core_start < core_end <= usable_end <= decoded frame count. Prefer generous usable bounds whenever the extra frames still match the description, because the 7 ranges must sum to exactly ${TOTAL} frames.`;

function slotPickPrompt(s, exclude) {
  return COMMON + `
YOUR ASSIGNMENT: choose the best candidate for SLOT ${s.slot} only.
Slot ${s.slot} · ${s.title}: ${s.text}
${exclude && exclude.length ? `These sources are already taken by other slots and must NOT be picked: ${exclude.join(", ")}.\n` : ""}
Neutral per-clip descriptions from earlier workers (may contain mistakes; verify!):
${DESC_JSON}

Method:
1. Shortlist every clip that could plausibly match (expect deliberate decoys: same character or setting but different hair, different number of shots, different camera move such as locked-off vs push, pan vs fly-forward, missing element like footprints/tower/hand, extra shots, etc.).
2. For each shortlisted clip, view its contact sheet ${ROOT}/work/sheets/NN*.jpg and extract dense frames with ffmpeg (select='eq(n\\,K)') into ${ROOT}/work/frames/ to check EVERY clause of the slot description, including shot count and order. Check the camera clause against the per-frame motion data in ${ROOT}/work/catalog/NN.json (dx, dy, zoom, residual/turbulence), computing your own trends if needed (e.g. even speed vs accelerating, locked-off = near-zero motion through the whole shot, push-in = zoom > 1 steadily).
3. Pick the one clip that matches every part. Determine exact frame indices of its shot boundaries by inspecting frames around each cut.
${RANGE_RULES}
4. Name the closest_alternative (the most similar other candidate that is wrong for this slot) and a one-sentence reason naming a concrete visible difference.
Write your findings to ${ROOT}/work/slots/slot_${s.slot}.json and return the structured result.`;
}

function reviewPrompt(s, pick) {
  return COMMON + `
YOUR ASSIGNMENT: independently audit a proposed pick for SLOT ${s.slot}. Be skeptical; do not just agree.
Slot ${s.slot} · ${s.title}: ${s.text}
Proposed pick: ${JSON.stringify(pick)}
Per-clip descriptions (may contain mistakes): ${DESC_JSON}

1. View frames of the proposed source (contact sheet ${ROOT}/work/sheets/NN*.jpg and extracted frames via ffmpeg into ${ROOT}/work/frames/) and verify every clause of the slot, including shot count and the camera clause using ${ROOT}/work/catalog/NN.json motion data.
2. Also inspect the named closest_alternative and the other candidates listed; check whether any of them matches better.
3. Verify the core/usable frame bounds by checking frames at and around each boundary. ${RANGE_RULES}
Return agree=true only if the proposed source is the best match. preferred_source = the source you think is right. If bounds are wrong set range_ok=false and give suggested_* values. List concrete issues.`;
}

function adjudicatePrompt(s, pick, review) {
  return COMMON + `
YOUR ASSIGNMENT: settle a disagreement about SLOT ${s.slot}.
Slot ${s.slot} · ${s.title}: ${s.text}
Picker result: ${JSON.stringify(pick)}
Reviewer result: ${JSON.stringify(review)}
Descriptions: ${DESC_JSON}
Look at the disputed clips yourself (sheets in ${ROOT}/work/sheets/, extract frames with ffmpeg into ${ROOT}/work/frames/, motion data in ${ROOT}/work/catalog/NN.json) and check every clause. Decide the final source and exact bounds. ${RANGE_RULES}
Write to ${ROOT}/work/slots/slot_${s.slot}_final.json and return the full structured pick.`;
}

function sanitizePick(p, s) {
  if (!p) return null;
  const n = frameCount[p.source] ?? p.clip_frames ?? null;
  const out = Object.assign({}, p, {slot: s.slot});
  if (n != null) {
    out.clip_frames = n;
    out.usable_start = Math.max(0, Math.min(out.usable_start, n));
    out.usable_end = Math.max(0, Math.min(out.usable_end, n));
    out.core_start = Math.max(out.usable_start, Math.min(out.core_start, n));
    out.core_end = Math.min(out.usable_end, Math.max(out.core_end, out.core_start + 1));
  }
  return out;
}

async function decideSlot(s, exclude) {
  let pick = await agent(slotPickPrompt(s, exclude), {label: `pick-slot${s.slot}`, phase: "Match", schema: pickSchema});
  if (!pick) pick = await agent(slotPickPrompt(s, exclude), {label: `pick-slot${s.slot}-retry`, phase: "Match", schema: pickSchema});
  if (!pick) return {slot: s.slot, pick: null, status: "failed"};
  pick = sanitizePick(pick, s);
  const review = await agent(reviewPrompt(s, pick), {label: `review-slot${s.slot}`, phase: "Match", schema: reviewSchema});
  if (!review) return {slot: s.slot, pick, review: null, status: "unreviewed"};
  if (review.agree && review.preferred_source === pick.source && review.range_ok) {
    return {slot: s.slot, pick, review, status: "agreed"};
  }
  if (review.agree && review.preferred_source === pick.source && !review.range_ok) {
    // Source agreed; bounds disputed -> adjudicate bounds only via same adjudicator.
  }
  const final = await agent(adjudicatePrompt(s, pick, review), {label: `adjudicate-slot${s.slot}`, phase: "Match", schema: pickSchema});
  if (!final) return {slot: s.slot, pick, review, status: "adjudication-failed"};
  return {slot: s.slot, pick: sanitizePick(final, s), review, status: "adjudicated"};
}

let slotResults = await parallel(SLOTS.map(s => () => decideSlot(s, [])));
slotResults = slotResults.map((r, i) => r || {slot: SLOTS[i].slot, pick: null, status: "failed"});

// ---------------- Phase 4: Allocate ----------------
phase("Allocate");

// Resolve duplicate sources
for (let round = 0; round < 2; round++) {
  const bySource = {};
  slotResults.forEach(r => { if (r.pick) (bySource[r.pick.source] = bySource[r.pick.source] || []).push(r.slot); });
  const dups = Object.entries(bySource).filter(([, slots]) => slots.length > 1);
  if (!dups.length) break;
  log("Duplicate sources: " + JSON.stringify(dups));
  const resolveSchema = {
    type: "object",
    properties: {assignments: {type: "array", items: {type: "object", properties: {
      slot: {type: "integer"}, keep: {type: "boolean"}
    }, required: ["slot", "keep"]}}, notes: {type: "string"}},
    required: ["assignments"]
  };
  const res = await agent(COMMON + `
YOUR ASSIGNMENT: the 7 slots must use distinct clips, but these sources were picked for more than one slot: ${JSON.stringify(dups)}.
Current slot results: ${JSON.stringify(slotResults.map(r => ({slot: r.slot, pick: r.pick})))}
Descriptions: ${DESC_JSON}
For each conflicted source, look at the clip (sheets in ${ROOT}/work/sheets/, frames via ffmpeg) and decide which ONE slot it truly matches. Return assignments with keep=true for the slot that keeps it and keep=false for slots that must re-pick.`,
    {label: `resolve-dups-${round}`, phase: "Allocate", schema: resolveSchema});
  const losers = new Set();
  if (res && Array.isArray(res.assignments)) {
    for (const a of res.assignments) if (!a.keep) losers.add(a.slot);
  }
  if (!losers.size) {
    // deterministic fallback: keep the higher-confidence / lowest slot
    const rank = {high: 0, medium: 1, low: 2};
    for (const [, slots] of dups) {
      const sorted = slots.slice().sort((a, b) => {
        const pa = slotResults.find(r => r.slot === a).pick, pb = slotResults.find(r => r.slot === b).pick;
        return (rank[pa.confidence] ?? 3) - (rank[pb.confidence] ?? 3) || a - b;
      });
      sorted.slice(1).forEach(sl => losers.add(sl));
    }
  }
  const taken = slotResults.filter(r => r.pick && !losers.has(r.slot)).map(r => r.pick.source);
  const redo = await parallel([...losers].map(sl => () => decideSlot(SLOTS[sl - 1], taken)));
  [...losers].forEach((sl, i) => { if (redo[i]) slotResults[sl - 1] = redo[i]; });
}

function allocate(picks) {
  // picks: array of 7 sanitized picks, returns {ok, ranges, reason}
  const segs = picks.map(p => ({a: p.core_start, b: p.core_end, lo: p.usable_start, hi: p.usable_end}));
  const coreSum = segs.reduce((t, s) => t + (s.b - s.a), 0);
  const maxSum = segs.reduce((t, s) => t + (s.hi - s.lo), 0);
  if (coreSum > TOTAL) return {ok: false, reason: `core frames ${coreSum} exceed ${TOTAL}`, coreSum, maxSum};
  if (maxSum < TOTAL) return {ok: false, reason: `usable frames ${maxSum} below ${TOTAL}`, coreSum, maxSum};
  let need = TOTAL - coreSum;
  // water-fill: extend one frame at a time, round-robin over slots with slack, alternating end then start
  let guard = 0;
  while (need > 0 && guard < 100000) {
    guard++;
    let progressed = false;
    for (const s of segs) {
      if (need <= 0) break;
      const slackAfter = s.hi - s.b, slackBefore = s.a - s.lo;
      if (slackAfter <= 0 && slackBefore <= 0) continue;
      // extend toward the side with more slack to keep the core centred within available material
      if (slackAfter >= slackBefore) s.b++; else s.a--;
      need--; progressed = true;
    }
    if (!progressed) break;
  }
  if (need !== 0) return {ok: false, reason: "allocation failed to converge", coreSum, maxSum};
  let c = 0;
  const ranges = segs.map((s, i) => {
    const len = s.b - s.a;
    const r = {slot: i + 1, source_frames: [s.a, s.b], output_frames: [c, c + len]};
    c += len;
    return r;
  });
  return {ok: c === TOTAL, ranges, coreSum, maxSum};
}

let alloc = null;
let missingSlots = slotResults.filter(r => !r.pick).map(r => r.slot);
if (!missingSlots.length) {
  alloc = allocate(slotResults.map(r => r.pick));
  for (let attempt = 0; !alloc.ok && attempt < 2; attempt++) {
    log("Allocation infeasible: " + alloc.reason);
    const fixSchema = {
      type: "object",
      properties: {slots: {type: "array", items: {type: "object", properties: {
        slot: {type: "integer"}, source: {type: "string"},
        core_start: {type: "integer"}, core_end: {type: "integer"},
        usable_start: {type: "integer"}, usable_end: {type: "integer"},
        closest_alternative: {type: "string"}, reason: {type: "string"}, changed: {type: "boolean"}, why: {type: "string"}
      }, required: ["slot", "source", "core_start", "core_end", "usable_start", "usable_end", "closest_alternative", "reason", "changed"]}},
        notes: {type: "string"}},
      required: ["slots"]
    };
    const fix = await agent(COMMON + `
YOUR ASSIGNMENT: the frame budget does not work out: ${alloc.reason} (core sum ${alloc.coreSum}, usable sum ${alloc.maxSum}, target ${TOTAL}).
Current slot decisions: ${JSON.stringify(slotResults.map(r => r.pick))}
Descriptions: ${DESC_JSON}
Re-examine the bounds (view frames with ffmpeg into ${ROOT}/work/frames/, motion data in ${ROOT}/work/catalog/NN.json). If cores are too large, check whether core bounds were set too conservatively (core must only cover the described shots and whole camera move). If usable material is too small, check whether usable bounds were set too tightly (extra frames that still match the description are allowed), and only as a last resort consider whether a different candidate truly matching the slot exists. ${RANGE_RULES}
Return all 7 slots with corrected values (changed=true where you modified something).`,
      {label: `fix-budget-${attempt}`, phase: "Allocate", schema: fixSchema});
    if (!fix || !Array.isArray(fix.slots)) break;
    for (const f of fix.slots) {
      const r = slotResults[f.slot - 1];
      if (!r) continue;
      r.pick = sanitizePick(Object.assign({}, r.pick, f), SLOTS[f.slot - 1]);
    }
    alloc = allocate(slotResults.map(r => r.pick));
  }
}

if (missingSlots.length || !alloc || !alloc.ok) {
  return {
    status: "unresolved",
    reason: missingSlots.length ? `No pick for slots ${missingSlots.join(",")}` : `Allocation infeasible: ${alloc && alloc.reason}`,
    slotResults, missingDescriptions: stillMissing, catalogNotes: catalog.notes || ""
  };
}

const plan = slotResults.map((r, i) => ({
  slot: r.slot,
  source: r.pick.source,
  source_frames: alloc.ranges[i].source_frames,
  output_frames: alloc.ranges[i].output_frames,
  closest_alternative: r.pick.closest_alternative,
  reason: r.pick.reason
}));
log("Plan: " + JSON.stringify(plan.map(p => [p.slot, p.source, p.source_frames])));

// ---------------- Phase 5: Assemble ----------------
phase("Assemble");
const assembleSchema = {
  type: "object",
  properties: {
    done: {type: "boolean"},
    decoded_frames: {type: "integer"},
    ffprobe_summary: {type: "string"},
    problems: {type: "array", items: {type: "string"}}
  },
  required: ["done", "decoded_frames", "problems"]
};

function assemblePrompt(extra) {
  return COMMON + `
YOUR ASSIGNMENT: render the deliverables exactly according to this plan (do not change sources or frame ranges; if you believe the plan is impossible, report it in problems instead of improvising):
${JSON.stringify(plan, null, 1)}
${extra || ""}
Steps:
1. Write ${ROOT}/work/assemble.py (or a shell script) that cuts each segment by decoded frame index — e.g. ffmpeg -i input/NN.mp4 -vf "trim=start_frame=a:end_frame=b,setpts=PTS-STARTPTS" — and joins all 7 with the concat FILTER in one ffmpeg run (or frame-accurate intermediate files in work/ followed by concat), re-encoding once with libx264, -pix_fmt yuv420p, setsar=1, 1280x720 (no scaling should be needed — confirm inputs are 1280x720; do not crop or scale), -r 30 / fps=30 CFR (-fps_mode cfr or -vsync cfr), -an, and no transitions. Make sure timestamps do not cause duplicated or dropped frames (check that each segment yields exactly b-a frames).
2. Output ${ROOT}/output/assembly.mp4. Verify with ffprobe -count_frames that it has exactly ${TOTAL} decoded frames, r_frame_rate 30/1, avg_frame_rate 30/1, yuv420p, h264, 1280x720, SAR 1:1, no audio stream.
3. Spot-check frame accuracy: for each segment compare the first and last output frames with the corresponding source frames (e.g. PSNR > 30 dB or mean abs diff small) and confirm the frame before/after does not match better (off-by-one check).
4. Write ${ROOT}/output/selection.json exactly as {"slots":[...]} with the 7 objects from the plan (fields slot, source, source_frames, output_frames, closest_alternative, reason). source and closest_alternative are two-digit strings.
5. Ensure ${ROOT}/output/ contains ONLY assembly.mp4 and selection.json (move any scratch to work/).
Return the structured result.`;
}

let assembled = await agent(assemblePrompt(""), {label: "assemble", phase: "Assemble", schema: assembleSchema});
if (!assembled) assembled = await agent(assemblePrompt("A previous attempt failed; check work/ and output/ state and redo cleanly."), {label: "assemble-retry", phase: "Assemble", schema: assembleSchema});

// ---------------- Phase 6: Verify ----------------
phase("Verify");
const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    technical_issues: {type: "array", items: {type: "string"}},
    content_issues: {type: "array", items: {type: "object", properties: {
      slot: {type: "integer"}, issue: {type: "string"}, suggested_source_frames: {type: "array", items: {type: "integer"}}
    }, required: ["slot", "issue"]}}
  },
  required: ["passed", "technical_issues", "content_issues"]
};
const verifyPrompt = () => COMMON + `
YOUR ASSIGNMENT: independently verify the deliverables in ${ROOT}/output/. Do not modify output/ — only report.
Intended plan: ${JSON.stringify(plan)}
Technical checks: output/ contains only assembly.mp4 and selection.json; assembly is h264, yuv420p, 1280x720, SAR 1:1, r_frame_rate and avg_frame_rate 30/1, no audio, exactly ${TOTAL} decoded frames (ffprobe -count_frames and an OpenCV decode count); selection.json schema: 7 objects in slot order, slot 1-7, two-digit string sources, distinct sources, half-open ranges, output_frames start at 0, abut, end at ${TOTAL}, b-a=d-c, source_frames within each clip's decoded frame count, closest_alternative differs from source, reason is one sentence. Frame accuracy: for each segment, compare several output frames (first, middle, last) with the claimed source frames (PSNR/mean abs diff), verify no off-by-one, no black frames at joins except a slot-3 fade-up that is part of the source, and no unexpected extra shot fragments at segment edges.
Content checks: extract frames from the ASSEMBLY at each segment's start, end, and around internal cuts, view them, and confirm each segment shows every element of its slot description (all shots, whole camera move — e.g. slot 7 static start and accelerating push, slot 2 push continuing to end of shot, slot 4 opening dark foreground mass, slot 6 three shots), with no foreign shot included.
Report passed=true only if everything checks out. For content issues where the fix is a different range within the same source, give suggested_source_frames [a,b].`;

let verdict = await agent(verifyPrompt(), {label: "verify", phase: "Verify", schema: verifySchema});
const repairLog = [];
for (let round = 0; verdict && !verdict.passed && round < 2; round++) {
  // Apply suggested range changes deterministically if they keep total length and stay within usable bounds.
  let planChanged = false;
  for (const ci of verdict.content_issues || []) {
    const sfs = ci.suggested_source_frames;
    const idx = (ci.slot || 0) - 1;
    if (!Array.isArray(sfs) || sfs.length !== 2 || !plan[idx]) continue;
    const p = slotResults[idx].pick;
    const [a, b] = sfs;
    const curLen = plan[idx].source_frames[1] - plan[idx].source_frames[0];
    if (b - a === curLen && a >= p.usable_start && b <= p.usable_end && a <= p.core_start && b >= p.core_end) {
      plan[idx].source_frames = [a, b];
      planChanged = true;
    } else if (a >= 0 && b > a) {
      // widen core to include the suggestion, then reallocate
      p.core_start = Math.min(p.core_start, a);
      p.core_end = Math.max(p.core_end, b);
      p.usable_start = Math.min(p.usable_start, p.core_start);
      p.usable_end = Math.max(p.usable_end, p.core_end);
      const re = allocate(slotResults.map(r => r.pick));
      if (re.ok) {
        re.ranges.forEach((rr, i) => { plan[i].source_frames = rr.source_frames; plan[i].output_frames = rr.output_frames; });
        planChanged = true;
      } else {
        repairLog.push({slot: ci.slot, unapplied: ci.issue, reason: re.reason});
      }
    }
  }
  const repair = await agent(assemblePrompt(`REPAIR ROUND ${round + 1}. A verifier reported these issues with the current output: ${JSON.stringify(verdict)}. ${planChanged ? "The plan above has been updated accordingly; re-render from scratch." : "Fix technical issues; keep the plan unless it is literally impossible."}`),
    {label: `repair-${round}`, phase: "Verify", schema: assembleSchema});
  repairLog.push({round, verdictIssues: verdict, planChanged, repair});
  if (!repair) break;
  verdict = await agent(verifyPrompt(), {label: `verify-${round + 1}`, phase: "Verify", schema: verifySchema});
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  plan,
  assembled,
  verdict,
  repairLog,
  slotDecisions: slotResults.map(r => ({slot: r.slot, status: r.status, source: r.pick && r.pick.source, confidence: r.pick && r.pick.confidence,
    core: r.pick && [r.pick.core_start, r.pick.core_end], usable: r.pick && [r.pick.usable_start, r.pick.usable_end],
    reviewIssues: r.review ? r.review.issues : null})),
  missingDescriptions: stillMissing,
  catalogNotes: catalog.notes || ""
};
