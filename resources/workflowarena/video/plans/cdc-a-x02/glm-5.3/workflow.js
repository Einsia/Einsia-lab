export const meta = {
  name: "cdc-a-x02-mourning-sequence",
  description: "Screen 42 anonymous candidate clips, assign six distinct clips to the fixed mourning-sequence slots, assemble sequence.mp4 with a 24-frame J-cut, and verify all three deliverables",
  phases: [
    {title: "Probe", detail: "ffprobe all 42 clips, extract sampled frames and contact sheets into work/"},
    {title: "Screen", detail: "Describe each candidate clip's content, subjects, camera and slot candidacy"},
    {title: "Assign", detail: "Match candidates to the six ordered slots and verify each match against the actual frames"},
    {title: "Assemble", detail: "Build output/sequence.mp4, output/edl.json and output/selection-evidence.json"},
    {title: "Verify", detail: "Check specs, EDL/evidence consistency and frame-level accuracy; repair if needed"}
  ]
};

const maxRepairs = (typeof args !== "undefined" && args && Number.isInteger(args.maxRepairs)) ? args.maxRepairs : 2;
const maxReassignRounds = (typeof args !== "undefined" && args && Number.isInteger(args.maxReassignRounds)) ? args.maxReassignRounds : 2;

const clipIds = [];
for (let i = 1; i <= 42; i++) clipIds.push(String(i).padStart(2, "0"));

const SLOT_SPECS = [
  "Slot 1 - starting point of grief. A SINGLE shot. A close shot (head and shoulders) of a young red-haired woman against a background of tangled tree roots. At the start her head is bowed and her hair hides her face. She slowly lifts her face. Her gaze first falls downward, then turns to screen right and stays there until the clip ends. Front three-quarter, slightly above eye level. Camera locked off; all change in the frame comes from the character.",
  "Slot 2 - memory, the warmth of meeting. Low angle: a small winged creature stands on a wooden beam, opens its wings, then folds them. Cut to a smiling close shot of the woman against a bright timber-roof background. Cut back to the creature crouched quietly on the beam while a flock of birds crosses the sky; the clip stays on this image. Medium on the creature, close on the woman. Low angle on the creature, eye level on the woman. Camera locked off.",
  "Slot 3 - memory, the peak of joy. High ground at sunset. The woman starts walking from beside a stone pillar toward the camera. Once she is close, she cups her hands around her mouth and calls out. Cut to a run of hard-backlit images: her silhouette, with small flying dragons circling around her; the clip ends inside the backlit images. Full shot, walking into a medium close-up; the backlit images are full and medium shots. Eye level or slightly below. The calling shot is locked off; in the backlit images the camera moves with her.",
  "Slot 4 - memory, the loss. A small winged creature glides alone in a pink-orange sky. A huge dragon's head dives into frame from the top. Cut to a wider image: the dragon sweeps over the rooftops. Over the woman's back: she reaches out, the dragon's claws seize the small creature, then her horrified face. Cut to the small creature being carried off in the dragon's grip, with the woman's open hand in the foreground reaching after it; the clip ends on this foreground-hand image. Medium in the sky, long shot over the roofs, over-the-shoulder medium, foreground hand close shot. Mostly low angle, including an over-the-shoulder view. Pans and tracks that follow the flyers; fast pacing.",
  "Slot 5 - back to the present, the stillness of grief. A SINGLE shot. An extreme long shot of a barren high cliff. The woman sits alone at the edge, small in frame, with misty mountains behind her. The clip stays on this image throughout. Eye level, side-on. Camera locked off, with almost no movement in frame.",
  "Slot 6 - release and departure (J-cut entry). A SINGLE shot. Ground-level low camera, with white snowdrop flowers in the right foreground. At the start, the frame holds only the foreground flowers and the small figure of the woman walking away in the distance. Midway through the clip, a small winged creature flies in low from the left, lands, pauses for a moment, then turns its back to the camera and crawls away into the distance. The clip ends while it is still crawling away. Long shot, with the foreground flowers in close shot. Ground-level low angle. Camera locked off."
];
const SLOTS_TEXT = SLOT_SPECS.map((s, i) => "### " + s).join("\n\n");

const CONTEXT =
  "Context: task CDC-A-X02 in the workspace (/workspace). input/01.mp4 through input/42.mp4 are 42 anonymous candidate clips " +
  "(H.264, 1280x544, SAR 1:1, 24 fps, AAC stereo 48 kHz, 6-12 s each) excerpted from an open animated film with original production sound. " +
  "Numbering is random and carries no story-order information. Python 3.11 and FFmpeg/ffprobe are available; there is no network and no GPU. " +
  "Drafts go in work/, deliverables in output/. Never modify anything in input/. The full task is in instruction.md.";

// ---------- schemas ----------

const probeSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          frames: {type: "integer"},
          duration_sec: {type: "number"},
          audio_duration_sec: {type: "number"},
          has_audio: {type: "boolean"},
          fps: {type: "number"}
        },
        required: ["id", "frames", "duration_sec"],
        additionalProperties: false
      }
    }
  },
  required: ["clips"],
  additionalProperties: false
};

const screenSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          summary: {type: "string"},
          subjects: {type: "string"},
          shots: {type: "string"},
          camera: {type: "string"},
          timeline: {type: "string"},
          slot_candidates: {type: "array", items: {type: "integer"}},
          notes: {type: "string"}
        },
        required: ["id", "summary", "subjects", "shots", "camera", "timeline", "slot_candidates"],
        additionalProperties: false
      }
    }
  },
  required: ["clips"],
  additionalProperties: false
};

const assignmentSchema = {
  type: "object",
  properties: {
    slots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: {type: "integer"},
          source: {type: "string"},
          most_similar_other: {type: "string"},
          visible_difference: {type: "string"},
          confidence: {type: "string", enum: ["high", "medium", "low"]}
        },
        required: ["slot", "source", "most_similar_other", "visible_difference", "confidence"],
        additionalProperties: false
      }
    }
  },
  required: ["slots"],
  additionalProperties: false
};

const checkSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    source: {type: "string"},
    passed: {type: "boolean"},
    problems: {type: "array", items: {type: "string"}}
  },
  required: ["slot", "source", "passed", "problems"],
  additionalProperties: false
};

const assemblySchema = {
  type: "object",
  properties: {
    video_frames: {type: "integer"},
    audio_frames: {type: "integer"},
    edl_last_picture_end: {type: "integer"},
    segment_frame_counts: {type: "object"},
    files: {type: "array", items: {type: "string"}},
    notes: {type: "string"}
  },
  required: ["video_frames", "audio_frames", "edl_last_picture_end", "files"],
  additionalProperties: false
};

const verdictSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues"],
  additionalProperties: false
};

// ---------- helpers ----------

function normalizeAssignment(a) {
  if (!a || !Array.isArray(a.slots)) return null;
  const map = {};
  for (const s of a.slots) {
    if (!s || !Number.isInteger(s.slot) || s.slot < 1 || s.slot > 6) return null;
    if (!/^\d{2}$/.test(String(s.source)) || !clipIds.includes(String(s.source))) return null;
    map[s.slot] = s;
  }
  for (let i = 1; i <= 6; i++) if (!map[i]) return null;
  const sources = [1, 2, 3, 4, 5, 6].map(i => map[i].source);
  if (new Set(sources).size !== 6) return null;
  return map;
}

function buildSegments(assignMap, frameCounts) {
  let pic = 0;
  let snd = 0;
  const segments = [];
  for (let slot = 1; slot <= 6; slot++) {
    const src = assignMap[slot].source;
    const n = frameCounts[src];
    if (!Number.isFinite(n)) return null;
    if (slot <= 4) {
      segments.push({slot: slot, source: src,
        picture: {output_frames: [pic, pic + n], source_frames: [0, n]},
        sound: {output_frames: [snd, snd + n], source_frames: [0, n]}});
      pic += n; snd += n;
    } else if (slot === 5) {
      // J-cut: slot 6 sound enters 24 frames before its picture and REPLACES
      // the last 24 frames of slot 5's sound. Slot 5 picture stays complete.
      segments.push({slot: slot, source: src,
        picture: {output_frames: [pic, pic + n], source_frames: [0, n]},
        sound: {output_frames: [snd, snd + n - 24], source_frames: [0, n - 24]}});
      pic += n; snd += n - 24;
    } else {
      segments.push({slot: slot, source: src,
        picture: {output_frames: [pic, pic + n - 24], source_frames: [24, n]},
        sound: {output_frames: [snd, snd + n], source_frames: [0, n]}});
      pic += n - 24; snd += n;
    }
  }
  return {segments: segments, pictureTotal: pic, soundTotal: snd};
}

function buildEvidence(assignMap, frameCounts) {
  const evidence = [];
  for (let slot = 1; slot <= 6; slot++) {
    const a = assignMap[slot];
    const n = frameCounts[a.source];
    const span = Number.isFinite(n) ? [0, n] : [0, 48];
    evidence.push({
      slot: slot,
      source: a.source,
      source_frames: span,
      reason: "Versus the most similar other candidate " + a.most_similar_other + ": " + a.visible_difference
    });
  }
  return evidence;
}

// ---------- phase 1: probe ----------

phase("Probe");
log("Probing 42 clips and extracting frames for visual screening");

const probePrompt =
  CONTEXT + "\n\n" +
  "Your job: prepare screening material for all 42 candidate clips. Do not make any editorial choices.\n" +
  "1. For every clip input/NN.mp4 measure the EXACT decoded video frame count with: " +
  "ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of default=nw=1:nk=1 input/NN.mp4. " +
  "Also record container/stream duration, audio stream duration, whether an audio stream exists, and the frame rate. " +
  "Write the full table to work/probe.json as well.\n" +
  "2. For every clip extract sampled frames for visual screening: one JPEG every 12 frames (every 0.5 s) scaled to about 640 pixels wide, " +
  "saved as work/frames/NN/f_0001.jpg, f_0002.jpg, ... (NN is the two-digit clip id). Use quality that keeps faces and creatures recognizable.\n" +
  "3. For every clip also build one labeled contact sheet work/sheets/NN.jpg tiling all sampled frames in time order (add visible time/frame labels if practical).\n" +
  "4. Verify the frame images actually decoded (spot-check a few sheets); if a clip decodes oddly, note it.\n" +
  "Return via the schema: an entry per clip with id (two digits), frames (exact decoded video frame count), duration_sec, audio_duration_sec, has_audio, fps. " +
  "All 42 clips must appear.";

const probe = await agent(probePrompt, {label: "probe-clips", schema: probeSchema});
if (!probe || !Array.isArray(probe.clips)) {
  return {status: "unresolved", reason: "Probe stage failed; no reliable clip inventory available."};
}
const frameCounts = {};
for (const c of probe.clips) {
  if (c && c.id && Number.isFinite(c.frames)) frameCounts[c.id] = c.frames;
}
log("Probe complete: " + Object.keys(frameCounts).length + "/42 clips measured");

// ---------- phase 2: screening ----------

phase("Screen");
const batches = [];
for (let i = 0; i < clipIds.length; i += 6) batches.push(clipIds.slice(i, i + 6));

const screenPrompt = (batch) =>
  CONTEXT + "\n\n" +
  "You are a screening worker. Describe ONLY these clips: " + batch.join(", ") + ".\n" +
  "For each clip: first view its contact sheet work/sheets/NN.jpg, then view individual frames in work/frames/NN/ as needed to resolve motion, " +
  "expression, camera and cut details. If a detail matters and the sampled frames are too sparse (fast action, brief events), " +
  "run ffmpeg yourself to extract denser frames from input/NN.mp4 into work/ (never modify input/). Listen-checking audio is not required.\n" +
  "Describe what is ACTUALLY visible; do not force-fit the slot list. For each clip report:\n" +
  "- summary: what happens, including any internal cuts and what image the clip ends on;\n" +
  "- subjects: which of these appear - young red-haired woman, small winged creature, large dragon, small flying dragons, birds/flock, " +
  "stone pillar, sunset sky, rooftops, cliff edge, snowdrop flowers, tree roots - plus anything else notable;\n" +
  "- shots: shot sizes per internal shot (extreme long / long / full / medium / medium close / close) and number of distinct shots;\n" +
  "- camera: locked off or moving (pan/track), angle (low / eye level / high / over-the-shoulder / ground-level);\n" +
  "- timeline: key events with approximate frame or second positions;\n" +
  "- slot_candidates: which slots 1-6 this clip could plausibly fill (integers 1-6, empty array if none), based on this slot list:\n\n" +
  SLOTS_TEXT + "\n\n" +
  "Return one schema object per clip in your batch, id as two digits. Be precise and concrete; downstream slot assignment depends entirely on your descriptions.";

let screenResults = await parallel(batches.map((b, i) => () =>
  agent(screenPrompt(b), {label: "screen-" + (i + 1), phase: "Screen", schema: screenSchema})));

// retry failed batches once
const retryScreen = await parallel(batches.map((b, i) => () =>
  (screenResults[i] && Array.isArray(screenResults[i].clips))
    ? screenResults[i]
    : agent(screenPrompt(b), {label: "screen-retry-" + (i + 1), phase: "Screen", schema: screenSchema})));

const descriptions = [];
const missingBatches = [];
for (let i = 0; i < batches.length; i++) {
  const r = retryScreen[i];
  if (r && Array.isArray(r.clips)) {
    for (const c of r.clips) if (c && c.id) descriptions.push(c);
  } else {
    missingBatches.push(batches[i]);
  }
}

let screeningComplete = descriptions.length >= 42;
if (!screeningComplete && missingBatches.length > 0) {
  log("Screening gaps, final catch-up for: " + missingBatches.map(b => b.join("/")).join("; "));
  const flat = missingBatches.flat();
  const catchUp = await agent(screenPrompt(flat), {label: "screen-catchup", phase: "Screen", schema: screenSchema});
  if (catchUp && Array.isArray(catchUp.clips)) {
    for (const c of catchUp.clips) if (c && c.id) descriptions.push(c);
    screeningComplete = descriptions.length >= 42;
  }
}
if (!screeningComplete) {
  const seen = new Set(descriptions.map(d => d.id));
  return {
    status: "unresolved",
    reason: "Screening incomplete; no descriptions for clips: " + clipIds.filter(id => !seen.has(id)).join(", "),
    partialDescriptions: descriptions
  };
}
// dedupe by id, keeping the first occurrence
const byId = {};
for (const d of descriptions) if (!byId[d.id]) byId[d.id] = d;
const allDescriptions = clipIds.map(id => byId[id]);
log("Screening complete for all 42 clips");

// ---------- phase 3: assignment + per-slot verification ----------

phase("Assign");
const descJson = JSON.stringify(allDescriptions);

const assignPromptBase =
  CONTEXT + "\n\n" +
  "You are the slot-assignment editor for a six-beat mourning sequence. The six slots are in FIXED order:\n\n" +
  SLOTS_TEXT + "\n\n" +
  "Here are screening descriptions of all 42 candidates (JSON):\n" + descJson + "\n\n" +
  "Choose exactly one candidate per slot, 1 through 6. Rules:\n" +
  "- All six chosen clips must be DIFFERENT candidates.\n" +
  "- Each chosen clip must match EVERY field of its slot: narrative content (including shot order and the image the clip ends on), " +
  "shot size, angle, and camera behavior (locked off vs moving). Internal cuts inside a clip are fine where the slot describes several shots; " +
  "a slot that says 'single shot' needs a clip with no internal cuts.\n" +
  "- The descriptions are second-hand. For your top candidate(s) per slot, VERIFY directly by viewing work/sheets/NN.jpg and frames in work/frames/NN/ " +
  "(or extract fresh frames with ffmpeg). Do not trust a description that conflicts with the frames.\n" +
  "- For each slot also name most_similar_other: the single most similar OTHER candidate for that slot (a real different clip id), " +
  "and visible_difference: one CONCRETE visible difference between the chosen clip and that other candidate " +
  "(something a human can check by looking at the two clips, e.g. a different background element, different final image, different subject action).\n" +
  "Return all six slots via the schema.";

let assignment = await agent(assignPromptBase, {label: "assign-slots", schema: assignmentSchema});
let assignMap = normalizeAssignment(assignment);
if (!assignMap) {
  log("First assignment invalid or failed; retrying with explicit correction request");
  assignment = await agent(assignPromptBase + "\n\nIMPORTANT: a previous attempt returned an invalid result (missing slots, duplicate sources, or bad ids). " +
    "Return exactly six slot objects, slots 1-6, six distinct two-digit source ids.", {label: "assign-slots-retry", schema: assignmentSchema});
  assignMap = normalizeAssignment(assignment);
}
if (!assignMap) {
  return {status: "unresolved", reason: "Slot assignment failed or was invalid.", descriptions: allDescriptions};
}
log("Initial assignment: " + [1, 2, 3, 4, 5, 6].map(s => "slot" + s + "=" + assignMap[s].source).join(", "));

const checkPrompt = (slot, source, alt) =>
  CONTEXT + "\n\n" +
  "You are a slot-match checker. Verify that candidate " + source + " matches Slot " + slot + " on EVERY field.\n\n" +
  "Slot " + slot + " specification:\n" + SLOT_SPECS[slot - 1] + "\n\n" +
  "Method: view work/sheets/" + source + ".jpg and frames in work/frames/" + source + "/; extract denser frames with ffmpeg from input/" + source + ".mp4 " +
  "if needed to judge motion, camera lock-off, gaze direction, internal cuts, and the final image. Check content, shot size, angle, and camera behavior " +
  "field by field. A slot marked 'single shot' must have no internal cuts. The clip must be used in full, so its ending image matters.\n" +
  "Also compare briefly against candidate " + (alt && alt !== source ? alt : "(none given)") +
  " (frames in work/frames/" + (alt && alt !== source ? alt : source) + "/) and confirm there is a concrete visible difference between them " +
  "that supports choosing " + source + ".\n" +
  "Return via the schema: slot, source, passed (true only if EVERY field matches), and problems listing each specific mismatch.";

const checkStatus = {}; // slot -> {passed, problems}
let reassignRounds = 0;
let lastAssignMap = assignMap;

while (true) {
  const toCheck = [];
  for (let slot = 1; slot <= 6; slot++) {
    if (!checkStatus[slot] || checkStatus[slot].source !== lastAssignMap[slot].source) toCheck.push(slot);
  }
  if (toCheck.length === 0) break;
  const checks = await parallel(toCheck.map(slot => () =>
    agent(checkPrompt(slot, lastAssignMap[slot].source, lastAssignMap[slot].most_similar_other),
      {label: "check-slot-" + slot, phase: "Assign", schema: checkSchema})));
  for (let i = 0; i < toCheck.length; i++) {
    const slot = toCheck[i];
    const c = checks[i];
    if (c && c.slot === slot) {
      checkStatus[slot] = {source: lastAssignMap[slot].source, passed: c.passed, problems: c.problems || []};
    } else {
      checkStatus[slot] = {source: lastAssignMap[slot].source, passed: false, problems: ["checker returned no usable verdict"]};
    }
  }
  const failing = [];
  for (let slot = 1; slot <= 6; slot++) {
    if (!checkStatus[slot].passed) failing.push({slot: slot, source: checkStatus[slot].source, problems: checkStatus[slot].problems});
  }
  if (failing.length === 0) break;
  if (reassignRounds >= maxReassignRounds) {
    log("Slot checks still failing after " + reassignRounds + " reassignment rounds; proceeding with best assignment: " +
      JSON.stringify(failing));
    break;
  }
  reassignRounds++;
  log("Reassignment round " + reassignRounds + " for failing slots: " + failing.map(f => f.slot).join(", "));
  const reassignPrompt =
    assignPromptBase + "\n\nCURRENT ASSIGNMENT (some slots failed verification):\n" +
    JSON.stringify([1, 2, 3, 4, 5, 6].map(s => ({slot: s, source: lastAssignMap[s].source, most_similar_other: lastAssignMap[s].most_similar_other}))) + "\n\n" +
    "FAILED SLOT CHECKS with specific problems:\n" + JSON.stringify(failing) + "\n\n" +
    "Produce a REVISED full assignment (all six slots, six distinct sources). Keep slots whose checks passed unless fixing a failure forces a change; " +
    "replace failing slots with better candidates from the descriptions, and VERIFY your new choices directly against the frames before answering.";
  const revised = await agent(reassignPrompt, {label: "reassign-" + reassignRounds, phase: "Assign", schema: assignmentSchema});
  const revisedMap = normalizeAssignment(revised);
  if (!revisedMap) {
    log("Reassignment returned invalid result; keeping previous assignment");
    break;
  }
  lastAssignMap = revisedMap;
}
assignMap = lastAssignMap;

const slotIssues = [];
for (let slot = 1; slot <= 6; slot++) {
  if (!checkStatus[slot] || !checkStatus[slot].passed) {
    slotIssues.push({slot: slot, source: assignMap[slot].source, problems: (checkStatus[slot] && checkStatus[slot].problems) || ["never verified"]});
  }
}
if (slotIssues.length > 0) {
  log("WARNING: unverified/failing slot matches: " + JSON.stringify(slotIssues));
}

// ---------- phase 4: assembly ----------

phase("Assemble");
const selections = [1, 2, 3, 4, 5, 6].map(s => ({slot: s, source: assignMap[s].source}));
const countsKnown = selections.every(sel => Number.isFinite(frameCounts[sel.source]));
const predicted = countsKnown ? buildSegments(assignMap, frameCounts) : null;
const evidence = buildEvidence(assignMap, frameCounts);

const assemblyPrompt =
  CONTEXT + "\n\n" +
  "You are the finishing editor. Build the final deliverables. The six chosen candidates, in fixed slot order:\n" +
  JSON.stringify(selections) + "\n\n" +
  "Measured decoded frame counts from probing (verify them yourself before use):\n" +
  JSON.stringify(frameCounts) + "\n\n" +
  (predicted
    ? "Predicted EDL computed from those counts (half-open 24 fps frame intervals):\n" + JSON.stringify(predicted.segments) + "\n"
    : "Frame counts for some chosen clips are unknown; measure them yourself with ffprobe -count_frames and compute the EDL by the rules below.\n") + "\n" +
  "Rules of the assembly contract (from instruction.md):\n" +
  "- Picture: each chosen clip used IN FULL, 1x speed, original direction, no crop/scale/mirror/grade/titles/transitions, no added or dropped frames. " +
  "EXCEPTION, the J-cut at slot 5 to slot 6: slot 6 PICTURE starts at source frame 24 (frames 24..end); slots 1-5 pictures are complete.\n" +
  "- Sound: only each clip's own production sound, frame-synchronous with its picture. No added sound, no fades, no crossfades. " +
  "J-cut audio: slot 6 sound plays from its source frame 0 to the end and REPLACES the last 24 frames of slot 5's sound; " +
  "so slot 5's sound segment is source frames 0..n5-24 and slot 6's sound is full length, immediately after it. " +
  "All other cuts are straight cuts in picture and sound.\n" +
  "- With n_i = decoded frame count of the clip in slot i: picture output length = n1+n2+n3+n4+n5+(n6-24); " +
  "sound output length = n1+n2+n3+n4+(n5-24)+n6. These are equal by construction.\n\n" +
  "Suggested build (adapt as needed, but keep it frame- and sample-exact):\n" +
  "1. Re-measure each chosen clip's exact decoded video frame count with ffprobe -select_streams v:0 -count_frames. " +
  "Also check each clip's audio stream (48 kHz stereo; 24 fps means 2000 audio samples per frame; 24 frames = 48000 samples exactly).\n" +
  "2. One ffmpeg pass with all six inputs and filter_complex: trim video per segment with the trim filter's start_frame/end_frame " +
  "(slots 1-5: start_frame=0:end_frame=n; slot 6: start_frame=24:end_frame=n), then setpts=PTS-STARTPTS, setsar=1, fps handling to constant 24/1; " +
  "concat the six video streams with the concat filter (n=6:v=1:a=0). For audio use atrim with start_sample/end_sample " +
  "(slots 1-4: end_sample=n*2000; slot 5: end_sample=(n5-24)*2000; slot 6: full), asetpts, then concat (n=6:v=0:a=1). " +
  "Encode video libx264 -crf 18 -pix_fmt yuv420p (1280x544 must be preserved) and audio aac (AAC-LC) -ar 48000 -ac 2. " +
  "Do NOT apply any fade, crossfade, volume change, EQ, speed change, or filter that alters content. Use work/ for intermediates.\n" +
  "3. Measure the finished file: decoded video frame count and decoded audio sample count. Audio duration in frames = round(samples/2000); " +
  "audio and video durations must be equal to within 1 frame. AAC encoder priming/delay can shift things: if the muxed audio is longer than the video, " +
  "fix by trimming (never by padding with silence, and never by touching the video). Re-check after any fix.\n" +
  "4. Write output/edl.json: {\"segments\":[...]} with EXACTLY 6 objects in slot order, each " +
  "{slot, source:\"NN\", picture:{output_frames:[a,b], source_frames:[c,d]}, sound:{output_frames:[a,b], source_frames:[c,d]}}. " +
  "Units are 24 fps frames, intervals half-open. Picture segments run contiguously from frame 0 with no gaps or overlaps; sound segments likewise. " +
  "The last picture end frame MUST equal the actual decoded frame count of your finished sequence.mp4. " +
  "Use the measured (not predicted) counts; if they differ from the predicted EDL above, recompute.\n" +
  "5. Write output/selection-evidence.json: a JSON array of exactly 6 objects {slot, source, source_frames:[a,b], reason} in slot order. " +
  "Draft reasons (you may sharpen wording, but each reason must still name the compared candidate and one concrete visible difference):\n" +
  JSON.stringify(evidence) + "\n" +
  "source_frames must lie inside the chosen clip with b-a at least 12; [0, n] of the clip satisfies this.\n" +
  "6. output/ must contain EXACTLY the three files sequence.mp4, edl.json, selection-evidence.json. Remove anything else from output/.\n" +
  "Return via the schema: video_frames (decoded frame count of sequence.mp4), audio_frames (round(audio samples/2000)), " +
  "edl_last_picture_end, segment_frame_counts (map source id to its measured decoded frame count), files (list of the three output files), notes.";

const assembly = await agent(assemblyPrompt, {label: "assemble-deliverables", schema: assemblySchema});
if (!assembly) {
  return {
    status: "unresolved",
    reason: "Assembly stage failed.",
    selections: selections,
    slotIssues: slotIssues
  };
}
log("Assembly done: video_frames=" + assembly.video_frames + " audio_frames=" + assembly.audio_frames +
  " edl_last_picture_end=" + assembly.edl_last_picture_end);

// ---------- phase 5: verification + repair ----------

phase("Verify");
const verifyPrompt =
  CONTEXT + "\n\n" +
  "You are the deliverables verifier. Check the three files in output/ against instruction.md rigorously, using ffprobe/ffmpeg/Python. " +
  "The chosen candidates in slot order: " + JSON.stringify(selections) + ". The reported build: " + JSON.stringify({
    video_frames: assembly.video_frames, audio_frames: assembly.audio_frames, edl_last_picture_end: assembly.edl_last_picture_end
  }) + ".\n" +
  "Check ALL of the following and report every violation:\n" +
  "1. output/ contains exactly sequence.mp4, edl.json, selection-evidence.json and nothing else.\n" +
  "2. sequence.mp4: video H.264, pix_fmt yuv420p, 1280x544, SAR 1:1, constant 24/1 fps; one audio track, AAC-LC stereo 48000 Hz. " +
  "Decoded audio duration and video duration equal within 1 frame.\n" +
  "3. edl.json: exactly 6 objects in slot order 1-6, correct field names, six distinct sources, all half-open 24 fps frame intervals. " +
  "Picture segments contiguous from frame 0, no gaps/overlaps; sound segments contiguous from frame 0; " +
  "last picture end frame equals the actual decoded frame count of sequence.mp4; every source_frames interval lies inside its clip's decoded frame count. " +
  "J-cut correctness: slot 6 picture source_frames starts at 24 and slot 5 sound source_frames ends 24 frames before that clip's end; " +
  "slot 6 sound is full length; slots 1-4 picture and sound are full length.\n" +
  "4. selection-evidence.json: JSON array of exactly 6 objects in slot order with fields slot, source, source_frames, reason; " +
  "each source_frames lies inside the chosen clip with b-a at least 12; each reason names a concrete visible difference versus another named candidate. " +
  "Open the frames of each chosen clip (work/frames/ or fresh ffmpeg extraction) and confirm the stated difference is actually visible and concrete; " +
  "flag vague, wrong, or difference-free reasons.\n" +
  "5. Frame-level content check: for each of the six segments, compare decoded frames of sequence.mp4 at the segment's output range against the " +
  "corresponding frames of input/NN.mp4 (e.g. ffmpeg framemd5/select on both sides for a few frames including the first and last frame of each segment). " +
  "They must match pixel-for-pixel apart from re-encode noise (if you re-encoded, compare visually and via a low threshold PSNR/SSIM on several frames; " +
  "significant mismatch, wrong frames, mirroring, cropping, scaling, grading, speed change or transition = violation). " +
  "Also confirm the cut boundaries are straight cuts (no fades) and the sequence contains exactly the six segments in slot order with no extra material.\n" +
  "6. Audio content check: verify the audio in each output segment corresponds to the same clip's production sound, that there are no fades/crossfades, " +
  "and that during the last 24 frames of slot 5's picture the audio is slot 6's clip audio from its frame 0 onward (the J-cut), not slot 5's tail.\n" +
  "Return via the schema: passed (true only if everything checks out) and issues (specific, actionable descriptions of every problem found, empty if none).";

const repairPrompt = (issues) =>
  CONTEXT + "\n\n" +
  "You are the finishing editor. The verifier found these problems with the deliverables in output/:\n" +
  JSON.stringify(issues) + "\n\n" +
  "Fix them. Constraints: same six candidates in the same slot order (" + JSON.stringify(selections) + "); " +
  "the assembly contract from instruction.md is unchanged (full clips at 1x, straight cuts, no added/processed sound, " +
  "J-cut with slot 6 audio entering 24 frames early and replacing slot 5's last 24 audio frames, no fades/crossfades, " +
  "H.264/yuv420p 1280x544 SAR 1:1 constant 24/1 fps, one AAC-LC stereo 48 kHz track, audio and video equal within 1 frame, " +
  "CRF <= 18 or lossless concat). edl.json and selection-evidence.json must stay consistent with the actual files. " +
  "output/ must end up containing exactly sequence.mp4, edl.json, selection-evidence.json. " +
  "After fixing, run the relevant checks yourself to confirm the fixes took. Report what you changed.";

let verdict = await agent(verifyPrompt, {label: "verify-1", phase: "Verify", schema: verdictSchema});
let repairs = 0;
while (verdict && !verdict.passed && verdict.issues && verdict.issues.length > 0 && repairs < maxRepairs) {
  repairs++;
  log("Repair round " + repairs + " for issues: " + JSON.stringify(verdict.issues));
  const repair = await agent(repairPrompt(verdict.issues), {label: "repair-" + repairs, phase: "Verify"});
  if (repair === null) {
    log("Repair worker failed; keeping last verdict");
    break;
  }
  verdict = await agent(verifyPrompt, {label: "verify-" + (repairs + 1), phase: "Verify", schema: verdictSchema});
}

const finalSegments = predicted ? predicted.segments : null;
const outcome = {
  status: (verdict && verdict.passed) ? "verified" : "unresolved",
  selections: selections,
  slotIssues: slotIssues,
  assembly: {
    video_frames: assembly.video_frames,
    audio_frames: assembly.audio_frames,
    edl_last_picture_end: assembly.edl_last_picture_end,
    files: assembly.files,
    notes: assembly.notes || ""
  },
  edlSegments: finalSegments,
  selectionEvidence: evidence,
  finalVerdict: verdict,
  repairsAttempted: repairs
};
if (slotIssues.length > 0) {
  outcome.slotMatchWarnings = "These slot matches failed or were never confirmed by frame-level checks: " +
    JSON.stringify(slotIssues) + " - the clip choices themselves may be wrong and need human review.";
}
return outcome;