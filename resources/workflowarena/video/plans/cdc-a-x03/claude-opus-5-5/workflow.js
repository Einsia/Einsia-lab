export const meta = {
  name: "cdc-a-x03-axis-sequence",
  description: "Catalog 45 anonymous clips, match each of 7 shot-list slots with visual evidence and 180-degree-rule checks, then assemble and verify solution.mp4 and the JSON deliverables.",
  phases: [
    {title: "Probe", detail: "ffprobe, cut detection, contact sheets for all 45 clips"},
    {title: "Describe", detail: "Visual description of every clip in batches"},
    {title: "Match", detail: "Per-slot candidate selection with near-duplicate discrimination"},
    {title: "Reconcile", detail: "Distinctness + axis continuity review across slots"},
    {title: "Assemble", detail: "Encode solution.mp4 and write JSON files"},
    {title: "Verify", detail: "Independent check and repair"}
  ]
};

const ROOT = "/workspace";
const CLIPS = [];
for (let i = 1; i <= 45; i++) CLIPS.push(String(i).padStart(2, "0"));

const SLOTS = [
  {slot: 1, title: "Establishing: two people in danger", spec: "Cold cyan mechanical space; suspended grated platform runs across frame, tall wall of buttons and mist behind. Thin boy sprawled/struggling on platform on FRAME LEFT; bald old man in dark coat stands FRAME RIGHT, bending and looking toward the boy. Extreme wide, both small full figures. Side-on, eye level, platform roughly parallel to bottom of frame. Single continuous locked-off shot (no internal cuts)."},
  {slot: 2, title: "First exchange: shot/reverse shot", spec: "Most of clip is a profile close-up of the boy against a pale riveted metal wall; he looks up and speaks several lines. Then ONE cut to a single close-up of the old man leaning forward and replying. Close-up vs close-up, near-eye-level profile/three-quarter singles, soft background, locked off. Axis: boy should be looking toward screen right (toward where old man was in slot 1), old man looking toward screen left."},
  {slot: 3, title: "Standoff in a closed room", spec: "Dark-red room. Shot order inside the clip: medium close single of old man -> medium single of boy -> close-up of an old candlestick telephone -> brief high-angle view down on the old man -> ends on close single of the old man. Near-eye-level frontal three-quarter singles, one high-angle shot; essentially static."},
  {slot: 4, title: "Escalation: the receiver", spec: "Clip OPENS DIRECTLY on the boy walking toward the old telephone in the foreground and reaching out (no earlier shot before that); cut to an over-the-shoulder shot past the back of the boy's head as the old man reaches across, snatches the receiver and holds it up toward the lens. Medium-full of boy, then OTS close. Low camera with telephone as big foreground block; mostly static."},
  {slot: 5, title: "Restaging", spec: "Warm brown hall with a huge arched grille door behind. Old man starts with back to camera, then turns to face it; boy walks into frame and stops beside and behind him, forming a foreground/background two-shot (old man foreground) as they keep talking. Medium two-shot, eye level, one continuous locked-off shot."},
  {slot: 6, title: "The escape begins: through the doorway", spec: "Inside a door: heavy black curtain on one side, bright doorway on the other. Old man squeezes in from the light and looks around warily; boy follows close behind. Medium to medium close as they come toward lens. Eye level from dark interior facing doorway, strong backlight; one continuous locked-off shot."},
  {slot: 7, title: "Escape: leaving the other behind", spec: "Dim space with green shafts of light. One continuous shot: opens with boy standing at edge of a platform and old man already on a nearby thin tall post; old man hops post to post away from him, boy gradually leaves frame. Full shot, eye level slightly low. Camera trucks with the old man in the direction of his hops (screen direction must be consistent with the slot-1 axis)."}
];

const CONTEXT = `You are a worker on task CDC-A-X03 (full text in ${ROOT}/instruction.md; read it first). Workspace root: ${ROOT}. Inputs: ${ROOT}/input/01.mp4..45.mp4 (silent, 1280x720, 24fps, 6-12 s). Scratch: ${ROOT}/work/. Deliverables only in ${ROOT}/output/ (exactly solution.mp4, solution.json, selection-evidence.json). Python 3.11 + ffmpeg/ffprobe available, no network, no GPU. You can view extracted JPG/PNG frames with your file-reading tool to see image content. Never guess clip identity from file numbers; decide only from what you see. Candidates include near-duplicates: time-overlapping excerpts (starting earlier/later, so they may contain an extra shot at start or end, or miss one), similar-looking takes of the same scene, and possibly horizontally mirrored copies (which would break the 180-degree axis). Pay attention to the exact shot order, first/last shot, left/right positions, eyeline and movement directions.`;

// ---------------- Phase 1: probe ----------------
phase("Probe");
const probeSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    catalog_path: {type: "string"},
    clips: {type: "array", items: {type: "object", properties: {
      source: {type: "string"},
      frame_count: {type: "integer"},
      duration_s: {type: "number"},
      cuts: {type: "array", items: {type: "integer"}},
      anomalies: {type: "string"}
    }, required: ["source", "frame_count", "cuts"]}},
    sheet_layout_note: {type: "string"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["ok", "clips", "issues"]
};

const probe = await agent(`${CONTEXT}

YOUR JOB: prepare machine-readable metadata and visual material for all 45 clips so other workers can inspect them. Do not choose clips.
1. For every clip: ffprobe stream info (codec, w/h, SAR, fps, pix_fmt), and the EXACT decoded frame count (ffprobe -count_frames -select_streams v:0 -show_entries stream=nb_read_frames). Record any anomaly (non-24fps, odd SAR, etc).
2. Detect internal hard cuts per clip (e.g. ffmpeg select='gt(scene,0.3)' with showinfo, or a Python frame-difference pass over decoded downscaled frames via ffmpeg rawvideo pipe; combine for robustness; report cut frame indices = first frame of each new shot).
3. Produce for each clip NN, in ${ROOT}/work/frames/NN/:
   - sheet.jpg: a labelled contact sheet (frame number burned in or in filename order documented) sampling ~every 12 frames (0.5 s) covering the whole clip incl. the first and last frame, tiles about 320x180, e.g. via ffmpeg select+scale+tile, or Python/PIL if available. drawtext may not be available; if not, document tile order.
   - first.jpg, last.jpg (full 1280x720 or 640x360), and for every detected cut c: cut_<c>_before.jpg (frame c-1) and cut_<c>_after.jpg (frame c).
   - A simple camera-motion estimate per shot if feasible (e.g. global phase correlation / mean horizontal shift between sampled downscaled frames using numpy if installed): report as 'static', 'pan/truck left', 'pan/truck right', etc. Skip gracefully if numpy is unavailable.
4. Write ${ROOT}/work/catalog.json: {"clips":[{"source":"NN","frame_count":int,"duration_s":float,"fps":"24/1","cuts":[...],"motion":[...],"anomalies":"..."}]} and a README in work/frames explaining the files.
Use parallel shell loops sensibly; this should take a few minutes. Return the summary in the schema.`, {label: "probe-all", phase: "Probe", schema: probeSchema});

if (!probe || !probe.ok) {
  log("Probe failed or incomplete; continuing with workers re-probing as needed.");
}
const probeByClip = {};
if (probe && probe.clips) for (const c of probe.clips) probeByClip[c.source] = c;

// ---------------- Phase 2: describe ----------------
phase("Describe");
const describeSchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      source: {type: "string"},
      frame_count: {type: "integer"},
      setting_palette: {type: "string"},
      shots: {type: "array", items: {type: "object", properties: {
        start_frame: {type: "integer"},
        end_frame: {type: "integer"},
        shot_size: {type: "string"},
        angle: {type: "string"},
        camera: {type: "string"},
        content: {type: "string"},
        screen_positions_eyelines_motion: {type: "string"}
      }, required: ["start_frame", "end_frame", "shot_size", "camera", "content", "screen_positions_eyelines_motion"]}},
      distinctive_details: {type: "string"},
      plausible_slots: {type: "array", items: {type: "integer"}}
    }, required: ["source", "setting_palette", "shots", "distinctive_details", "plausible_slots"]}}
  },
  required: ["clips"]
};

const slotSummary = SLOTS.map(s => `Slot ${s.slot} (${s.title}): ${s.spec}`).join("\n");
const BATCH = 5;
const batches = [];
for (let i = 0; i < CLIPS.length; i += BATCH) batches.push(CLIPS.slice(i, i + BATCH));

const describeResults = await parallel(batches.map((batch, bi) => () => agent(`${CONTEXT}

Prepared material (may be incomplete; regenerate anything missing yourself with ffmpeg into ${ROOT}/work/frames/NN/): ${ROOT}/work/catalog.json and ${ROOT}/work/frames/NN/ (sheet.jpg, first.jpg, last.jpg, cut_*_before/after.jpg; see README there).
Probe info for your clips: ${JSON.stringify(batch.map(c => probeByClip[c] || {source: c, note: "not probed"}))}

YOUR JOB: Visually describe clips ${batch.join(", ")} precisely and objectively. LOOK at the images (contact sheet plus extra frames you extract as needed, e.g. every 6 frames around cuts and at the start/end). For each clip list every shot (frame ranges half-open, using the verified cut positions; fix cut detection if you see a missed or false cut) with: shot size, angle, camera movement (static / pan / truck + screen direction), content/action, and explicitly WHO is on frame-left vs frame-right, which way each character looks (screen left/right/toward lens), and screen direction of any movement. Describe setting & palette (e.g. cold cyan machinery, dark-red room, warm brown hall, green light shafts). Note distinctive details useful for telling near-duplicates apart (what the first and last frames show, props, exact poses).
Characters: a thin boy and a bald old man in a dark coat. Other figures may appear — describe them as seen.
For reference only, the slots being filled are:
${slotSummary}
In plausible_slots list slot numbers this clip might match (can be empty). Do NOT write to output/. Also save your result as ${ROOT}/work/descriptions/batch_${bi}.json.`, {label: `describe-${batch[0]}-${batch[batch.length - 1]}`, phase: "Describe", schema: describeSchema})));

const descriptions = {};
const missingDescriptions = [];
batches.forEach((batch, bi) => {
  const r = describeResults[bi];
  const got = new Set();
  if (r && r.clips) for (const c of r.clips) { descriptions[c.source] = c; got.add(c.source); }
  for (const c of batch) if (!got.has(c)) missingDescriptions.push(c);
});

// Retry missing descriptions once, one clip per worker
if (missingDescriptions.length) {
  log("Retrying descriptions for: " + missingDescriptions.join(","));
  const retry = await parallel(missingDescriptions.map(c => () => agent(`${CONTEXT}

Material: ${ROOT}/work/catalog.json, ${ROOT}/work/frames/${c}/ (regenerate if missing).
YOUR JOB: Visually describe clip ${c} precisely (every shot with frame ranges, shot size, angle, camera move, content, left/right positions, eyelines, motion direction, setting/palette, distinctive details, plausible slots). Slots:
${slotSummary}
Save to ${ROOT}/work/descriptions/clip_${c}.json.`, {label: `describe-retry-${c}`, phase: "Describe", schema: describeSchema})));
  retry.forEach((r, i) => { if (r && r.clips) for (const c of r.clips) descriptions[c.source] = c; });
}
const stillMissing = CLIPS.filter(c => !descriptions[c]);

// compact descriptions text
function compactDesc(c) {
  const d = descriptions[c];
  if (!d) return `${c}: (no description available — inspect directly)`;
  const shots = (d.shots || []).map(s => `[${s.start_frame}-${s.end_frame}) ${s.shot_size}; ${s.angle || ""}; cam ${s.camera}; ${s.content}; pos/eye/motion: ${s.screen_positions_eyelines_motion}`).join(" | ");
  return `${c} (frames ${d.frame_count ?? (probeByClip[c] && probeByClip[c].frame_count)}): palette ${d.setting_palette}. Shots: ${shots}. Details: ${d.distinctive_details}. Plausible slots: ${JSON.stringify(d.plausible_slots)}`;
}
const allDescText = CLIPS.map(compactDesc).join("\n");

// ---------------- Phase 3: per-slot matching ----------------
phase("Match");
const slotSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    chosen: {type: "string"},
    confidence: {type: "string", enum: ["high", "medium", "low"]},
    alternatives: {type: "array", items: {type: "object", properties: {
      source: {type: "string"},
      why_rejected: {type: "string"}
    }, required: ["source", "why_rejected"]}},
    most_similar_other: {type: "string"},
    evidence_frames: {type: "array", items: {type: "integer"}},
    reason: {type: "string"},
    axis_observations: {type: "string"}
  },
  required: ["slot", "chosen", "confidence", "alternatives", "most_similar_other", "evidence_frames", "reason", "axis_observations"]
};

function slotPrompt(s, extra) {
  return `${CONTEXT}

YOUR JOB: choose the single best candidate clip for SLOT ${s.slot} — "${s.title}".
Slot specification (EVERY field must match): ${s.spec}

Global axis rule: slot 1 puts the boy frame-LEFT and the old man frame-RIGHT. All later slots must keep that relationship (boy left / old man right in two-shots or OTS framing, boy's eyeline toward screen right, old man's toward screen left, consistent screen direction of movement). A horizontally mirrored copy or a reverse-angle take that crosses the line is WRONG even if content matches.

Textual descriptions of all 45 clips from earlier workers (may contain errors — verify visually):
${allDescText}

Material: ${ROOT}/work/catalog.json, ${ROOT}/work/frames/NN/ (contact sheets, first/last, cut frames). Extract more frames yourself with ffmpeg into ${ROOT}/work/slot${s.slot}/ as needed.
Procedure:
1. Shortlist every clip that could plausibly match (setting/palette and action), not just the ones tagged for this slot.
2. For each shortlisted clip LOOK at frames: verify the exact shot structure (number and order of shots, what the first shot and last shot are, whether it's one continuous shot), shot size, angle, camera movement, left/right positions, eyelines, movement direction. Compare near-duplicates side by side (e.g. build a side-by-side image of matching moments with ffmpeg hstack) — check for mirroring (asymmetric details like a coat fold, button wall layout, text, light direction), extra/missing shots at the head or tail, different takes/framing.
3. Choose the clip matching ALL fields. Record two frame numbers inside the chosen clip that show the key evidence, the most similar other candidate, and ONE concrete visible difference between them (e.g. "05 starts with a wide shot of the hall before the boy approaches the phone; 23 opens directly on the boy walking").
${extra || ""}
Save your result also as ${ROOT}/work/slots/slot${s.slot}.json. Do not write to output/.`;
}

const slotResults = await parallel(SLOTS.map(s => () => agent(slotPrompt(s), {label: `slot-${s.slot}`, phase: "Match", schema: slotSchema})));

// retry failed slots once
for (let i = 0; i < SLOTS.length; i++) {
  if (!slotResults[i] || !slotResults[i].chosen) {
    log(`Retrying slot ${SLOTS[i].slot}`);
    slotResults[i] = await agent(slotPrompt(SLOTS[i], "A previous attempt failed to return; be efficient."), {label: `slot-${SLOTS[i].slot}-retry`, phase: "Match", schema: slotSchema});
  }
}

// ---------------- Phase 4: reconcile ----------------
phase("Reconcile");
const norm = s => (s == null ? null : String(s).replace(/\D/g, "").padStart(2, "0"));
let selection = SLOTS.map((s, i) => {
  const r = slotResults[i];
  return r ? {...r, slot: s.slot, chosen: norm(r.chosen)} : {slot: s.slot, chosen: null, missing: true};
});

const reconcileSchema = {
  type: "object",
  properties: {
    final: {type: "array", items: {type: "object", properties: {
      slot: {type: "integer"},
      source: {type: "string"},
      evidence_frames: {type: "array", items: {type: "integer"}},
      most_similar_other: {type: "string"},
      reason: {type: "string"},
      changed: {type: "boolean"},
      confidence: {type: "string"}
    }, required: ["slot", "source", "evidence_frames", "most_similar_other", "reason", "changed"]}},
    axis_check: {type: "string"},
    unresolved: {type: "array", items: {type: "string"}}
  },
  required: ["final", "axis_check", "unresolved"]
};

function dupInfo(sel) {
  const seen = {};
  const dups = [];
  for (const s of sel) {
    if (!s.chosen) continue;
    if (seen[s.chosen]) dups.push(`${s.chosen} chosen for slots ${seen[s.chosen]} and ${s.slot}`);
    else seen[s.chosen] = s.slot;
  }
  return dups;
}

const dups = dupInfo(selection);
const lowConf = selection.filter(s => s.missing || s.confidence === "low").map(s => s.slot);

const reconcile = await agent(`${CONTEXT}

YOUR JOB: reconcile per-slot selections into a final 7-clip sequence and check 180-degree axis continuity across all of them.
Slot specs:
${slotSummary}

Per-slot worker results:
${JSON.stringify(selection, null, 1)}

Detected duplicate choices: ${JSON.stringify(dups)}. Missing/low-confidence slots: ${JSON.stringify(lowConf)}.
All clip descriptions (verify visually; may contain errors):
${allDescText}

Steps:
1. Ensure 7 DISTINCT clips. Resolve any duplicate by visually re-checking which slot the clip truly fits and picking the best alternative for the other slot.
2. For missing/low-confidence slots, visually re-examine the shortlisted alternatives (extract frames into ${ROOT}/work/reconcile/) and decide.
3. Axis check: extract a representative frame from each chosen clip, build a strip/grid image in slot order and LOOK at it. Slot 1: boy left, old man right. Verify in later slots: left/right relationships, eyeline directions of singles (boy looks screen-right, old man screen-left), and movement/truck direction in slot 7 are consistent. If a chosen clip violates the axis (e.g. a mirrored copy or a line-crossing take exists as a near-duplicate), swap to the candidate that respects it — but only after confirming that the candidate also matches every content field.
4. Each final entry needs: evidence_frames = two frame numbers inside the chosen clip (within [0, frame_count)), most_similar_other = clip number, reason = one concrete visible difference between the chosen clip and that most similar other candidate.
Write ${ROOT}/work/final_selection.json with the result. Do not write to output/.`, {label: "reconcile", phase: "Reconcile", schema: reconcileSchema});

let finalSel;
if (reconcile && reconcile.final && reconcile.final.length === 7) {
  finalSel = reconcile.final.map(f => ({...f, source: norm(f.source)})).sort((a, b) => a.slot - b.slot);
} else {
  log("Reconcile failed; falling back to per-slot results.");
  finalSel = selection.map(s => ({slot: s.slot, source: s.chosen, evidence_frames: s.evidence_frames || [0, 1], most_similar_other: s.most_similar_other || "", reason: s.reason || "", changed: false}));
}
const finalDups = dupInfo(finalSel.map(f => ({slot: f.slot, chosen: f.source})));
const finalMissing = finalSel.filter(f => !f.source).map(f => f.slot);

if (finalMissing.length) {
  // Last attempt to fill gaps
  for (const slotNo of finalMissing) {
    const s = SLOTS[slotNo - 1];
    const used = finalSel.filter(f => f.source).map(f => f.source);
    const r = await agent(slotPrompt(s, `These clips are already used by other slots and must NOT be chosen: ${used.join(", ")}.`), {label: `slot-${slotNo}-fill`, phase: "Reconcile", schema: slotSchema});
    if (r && r.chosen) {
      const idx = finalSel.findIndex(f => f.slot === slotNo);
      finalSel[idx] = {slot: slotNo, source: norm(r.chosen), evidence_frames: r.evidence_frames, most_similar_other: r.most_similar_other, reason: r.reason, changed: true};
    }
  }
}

// ---------------- Phase 5: assemble ----------------
phase("Assemble");
const assembleSchema = {
  type: "object",
  properties: {
    done: {type: "boolean"},
    total_frames: {type: "integer"},
    segments: {type: "array", items: {type: "object", properties: {
      slot: {type: "integer"}, source: {type: "string"}, frames: {type: "integer"}
    }}},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["done", "issues"]
};

function assemblePrompt(sel, fixes) {
  return `${CONTEXT}

YOUR JOB: build the deliverables from this FINAL selection (slot order):
${JSON.stringify(sel, null, 1)}
${fixes ? "\nA verifier reported these problems with a previous build; fix them:\n" + JSON.stringify(fixes, null, 1) + "\n" : ""}
Requirements:
1. output/solution.mp4: the 7 source clips, each complete (every decoded frame, none dropped/duplicated), 1x speed, unmodified picture, hard-cut joined in slot order. H.264, yuv420p, 1280x720, SAR 1:1, constant 24/1 fps, NO audio stream. Recommended: re-encode with ffmpeg concat filter, e.g. inputs -i input/NN.mp4 x7, filter_complex "[0:v]setpts=PTS-STARTPTS,setsar=1[v0];...;[v0][v1]...concat=n=7:v=1:a=0,fps=24[out]" -map [out] -an -c:v libx264 -crf 12 -preset medium -pix_fmt yuv420p -r 24 -movflags +faststart. Alternatively concat demuxer with -c copy only if you verify the frame count & timestamps are exact. Ensure no frame is dropped/duplicated by the fps conversion (check timestamps of sources first).
2. Verify: decoded frame count of solution.mp4 (ffprobe -count_frames) == sum of the sources' decoded frame counts; ffprobe shows h264, yuv420p, 1280x720, SAR 1:1, r_frame_rate 24/1, no audio. Spot-check per segment that output frames match source frames (e.g. ffmpeg psnr/ssim of each segment vs its source, or compare a few frames numerically; expect PSNR > 35 dB, and verify alignment at each segment boundary, i.e. output frame start_k equals source frame 0 and end_k-1 equals the source's last frame).
3. output/solution.json: {"segments":[{"slot":1,"source":"NN","output_frames":[start,end],"source_frames":[0,count],"output":[start/24,end/24]}, ...]} 7 objects in slot order, contiguous from 0, integer half-open frames, seconds = frames/24 rounded to 6 decimals, final end = actual decoded frame count of solution.mp4. "source" is the two-digit string.
4. output/selection-evidence.json: array of 7 objects {"slot":n,"source":"NN","frames":[a,b],"reason":"..."} — frames are two integers inside [0, count) of the chosen clip; reason names one concrete visible difference vs the most similar other candidate (mention that candidate's number).
5. output/ must contain EXACTLY these three files — delete anything else (put scratch in work/).
Write a Python script work/build.py that generates the JSON from measured frame counts so numbers are consistent. Report results.`;
}

let assemble = await agent(assemblePrompt(finalSel, null), {label: "assemble", phase: "Assemble", schema: assembleSchema});

// ---------------- Phase 6: verify & repair ----------------
phase("Verify");
const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    selection_concerns: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues", "selection_concerns"]
};

const verifyPrompt = () => `${CONTEXT}

YOUR JOB: independently verify the deliverables in ${ROOT}/output/ against instruction.md. Intended selection: ${JSON.stringify(finalSel.map(f => ({slot: f.slot, source: f.source})))}.
Check with your own commands (do not trust earlier reports):
- output/ contains exactly solution.mp4, solution.json, selection-evidence.json.
- solution.mp4: h264, yuv420p, 1280x720, SAR 1:1 (or unset equivalent 1:1), r_frame_rate 24/1 and constant, no audio stream; decoded frame count.
- solution.json: valid, 7 segments in slot order 1..7, sources match intended selection and are distinct two-digit strings, output_frames contiguous from 0 with no gaps/overlaps, each length == decoded frame count of that source, source_frames == [0, count], output seconds == frames/24 within 0.001, final end == decoded frame count of solution.mp4.
- Frame content: for each segment compare output frames to source frames (e.g. ffmpeg -ss by frame / select filter, compute PSNR/SSIM for first, middle and last frames of each segment, and run whole-segment psnr if quick). Misalignment by even one frame is a failure.
- selection-evidence.json: array of 7 with slot, source, frames [a,b] inside the clip's range, non-empty concrete reason mentioning a visible difference.
- Quick sanity look: extract the first frame of each segment from solution.mp4 and view them; flag (in selection_concerns, not issues) anything that obviously contradicts a slot spec:
${slotSummary}
passed=true only if all format/contract checks pass.`;

let verdict = await agent(verifyPrompt(), {label: "verify", phase: "Verify", schema: verifySchema});
const MAX_REPAIRS = 2;
for (let round = 0; round < MAX_REPAIRS && (!verdict || !verdict.passed); round++) {
  const fixes = verdict ? verdict.issues : ["Verifier returned no result; rebuild and self-verify thoroughly."];
  assemble = await agent(assemblePrompt(finalSel, fixes), {label: `repair-${round + 1}`, phase: "Verify", schema: assembleSchema});
  verdict = await agent(verifyPrompt(), {label: `verify-${round + 2}`, phase: "Verify", schema: verifySchema});
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  final_selection: finalSel,
  duplicate_conflicts_after_reconcile: finalDups,
  axis_check: reconcile ? reconcile.axis_check : null,
  reconcile_unresolved: reconcile ? reconcile.unresolved : ["reconcile worker failed"],
  per_slot_initial: selection.map(s => ({slot: s.slot, chosen: s.chosen, confidence: s.confidence, most_similar_other: s.most_similar_other})),
  descriptions_missing: stillMissing,
  probe_issues: probe ? probe.issues : ["probe failed"],
  assemble,
  verdict
};
