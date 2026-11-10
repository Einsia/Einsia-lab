export const meta = {
  name: "cdc-a-x09-crossing-assembly",
  description: "Assemble the 6-slot crossing sequence from 33 anonymous candidate clips: ffprobe, per-clip visual analysis, similarity clustering, slot assignment with continuity verification, video assembly, and final QC.",
  phases: [
    {title: "Probe inputs", detail: "ffprobe metadata and frame counts for all 33 clips"},
    {title: "Analyze candidates", detail: "Per-clip visual shot analysis and slot fit"},
    {title: "Cluster similar clips", detail: "Detect overlapping / near-duplicate candidates"},
    {title: "Assign slots", detail: "Choose 6 distinct clips matching the ordered shot list"},
    {title: "Verify selection", detail: "Independent check of slot fields and continuity, with repair loop"},
    {title: "Build deliverables", detail: "Concat video and write solution.json / selection-evidence.json"},
    {title: "Final QC", detail: "Format and consistency validation of output/"}
  ]
};

const maxRounds = (args && typeof args.maxRepairRounds === "number" && args.maxRepairRounds >= 0) ? args.maxRepairRounds : 3;

const CLIPS = Array.from({length: 33}, (_, i) => String(i + 1).padStart(2, "0"));

const CONTRACT = [
  "ASSEMBLY CONTRACT (from instruction.md):",
  "- For each of the 6 ordered slots choose 1 candidate; 6 DISTINCT candidates total; each clip used once, complete, 1x speed, as delivered.",
  "- No cropping, mirroring, grading, text, added/dropped frames, transitions or generated content. Hard cuts only. Keep any cuts already inside a clip.",
  "- The result must play as one continuous scene: respect the 180-degree line; the protagonist's direction of travel, eyeline, and position relative to the fence and to its goal must keep continuous screen direction throughout and agree with the direction established in slot 1.",
  "- Input clips: input/01.mp4 .. input/33.mp4, H.264, 1280x720, SAR 1:1, 24 fps, 4-9 s each, silent. Clip numbers are random and carry no story-order information. Several candidates overlap in time, are highly similar, or show the same scene with a different shot treatment.",
  "- Never guess the identity of the source film; judge only what is visible in the frames.",
  "- Drafts go in work/; deliverables go in output/."
].join("\n");

const SLOTS = [
  "Slot 1 - Establishing. Content: an empty wide view of an arid high plateau, a dark boulder and snowy mountains in the background. An orange llama on the left of frame walks toward frame right, then lowers its head to sniff the ground. Shot size: extreme wide, subject small. Camera angle: low, near the ground, level. Lens feel: wide; foreground grass and distant mountains both in frame. Camera movement: locked off.",
  "Slot 2 - First obstacle. Content: while the llama is moving, an extreme close-up of a barbed-wire fence post is inserted; then the llama reaches a barbed-wire fence, leaps over it, lands and stands still. Shot size: mostly full shots with one detail insert. Camera angle: level; the fence runs into depth. Lens feel: normal; the post insert has shallow depth of field. Camera movement: essentially static; motion comes from the subject.",
  "Slot 3 - Spotting the goal. Content: a close-up of the llama's head, a barbed-wire fence in the foreground, staring at something off-screen; cut to a low-angle point-of-view shot of a shrub with small blue flowers. Shot size: head close-up, then a medium shot of the shrub. Camera angle: close-up level to slightly low; shrub shot at ground level. Lens feel: close-up medium focal length; the shrub shot has out-of-focus grass in the foreground. Camera movement: locked off; eyeline match into the POV shot.",
  "Slot 4 - Second obstacle. Content: beside an electric fence with red insulator caps, the llama trots up to the fence, is hit by sparks the moment it touches it, and drops to a stunned sit. Shot size: full shot, fence and distant snowy peaks in one frame. Camera angle: low, level. Lens feel: normal to wide. Camera movement: locked off.",
  "Slot 5 - Assault. Content: opens on a close-up of the llama behind several electric-fence wires, face contorted; cut to a wide shot in which it charges the fence, jumps, is struck by the current and thrown back to the ground. Shot size: close-up, then wide. Camera angle: close-up level; wide shot low. Lens feel: close-up medium-long with wires crossing the foreground; wide shot wide. Camera movement: both shots locked off.",
  "Slot 6 - After the crossing. Content: the scorched, darkened llama has reached the other side of the electric fence and sits on the ground; the camera then leaves it, passes dry branches, sweeps across flowering shrubs and ends on the plateau beneath a rainbow. Shot size: starts full, becomes a shrub close-up, ends wide. Camera angle: low, level. Lens feel: wide; foreground shrubs sweep through frame. Camera movement: continuous lateral move with strong foreground/background parallax."
];
const SLOTS_TEXT = SLOTS.map((s, i) => `${i + 1}. ${s}`).join("\n\n");

// ---------- schemas ----------

const probeSchema = {
  type: "object", additionalProperties: false,
  properties: {
    clips: {type: "array", items: {type: "object", additionalProperties: false, properties: {
      clip: {type: "string"}, frameCount: {type: "integer"}, width: {type: "integer"},
      height: {type: "integer"}, fps: {type: "string"}, hasAudio: {type: "boolean"},
      durationSeconds: {type: "number"}, pixFmt: {type: "string"}, sar: {type: "string"}
    }, required: ["clip", "frameCount", "width", "height", "fps", "hasAudio", "durationSeconds"]}},
    anomalies: {type: "array", items: {type: "string"}}
  },
  required: ["clips", "anomalies"]
};

const clipSchema = {
  type: "object", additionalProperties: false,
  properties: {
    clip: {type: "string"},
    frameCount: {type: "integer"},
    durationSeconds: {type: "number"},
    summary: {type: "string"},
    shots: {type: "array", items: {type: "object", additionalProperties: false, properties: {
      description: {type: "string"}, shotSize: {type: "string"}, cameraAngle: {type: "string"},
      cameraMovement: {type: "string"}, lensFeel: {type: "string"}, approxFrameRange: {type: "string"}
    }, required: ["description", "shotSize", "cameraAngle", "cameraMovement"]}},
    elements: {type: "array", items: {type: "string"}},
    llamaAction: {type: "string"},
    screenDirection: {type: "string"},
    slotFit: {type: "array", items: {type: "object", additionalProperties: false, properties: {
      slot: {type: "integer"}, fit: {type: "string", enum: ["strong", "possible", "weak"]},
      rationale: {type: "string"}
    }, required: ["slot", "fit", "rationale"]}},
    internalCuts: {type: "integer"},
    confidence: {type: "string"}
  },
  required: ["clip", "frameCount", "durationSeconds", "summary", "shots", "elements", "llamaAction", "screenDirection", "slotFit", "internalCuts", "confidence"]
};

const simSchema = {
  type: "object", additionalProperties: false,
  properties: {
    pairs: {type: "array", items: {type: "object", additionalProperties: false, properties: {
      a: {type: "string"}, b: {type: "string"},
      similarity: {type: "string", enum: ["high", "medium", "low"]},
      note: {type: "string"}
    }, required: ["a", "b", "similarity", "note"]}},
    groups: {type: "array", items: {type: "object", additionalProperties: false, properties: {
      clips: {type: "array", items: {type: "string"}}, note: {type: "string"}
    }, required: ["clips", "note"]}},
    notes: {type: "array", items: {type: "string"}}
  },
  required: ["pairs", "groups", "notes"]
};

const assignSchema = {
  type: "object", additionalProperties: false,
  properties: {
    slots: {type: "array", minItems: 6, maxItems: 6, items: {type: "object", additionalProperties: false, properties: {
      slot: {type: "integer"}, source: {type: "string"}, rationale: {type: "string"},
      mostSimilarOther: {type: "string"}, difference: {type: "string"},
      continuityNotes: {type: "string"}
    }, required: ["slot", "source", "rationale", "mostSimilarOther", "difference", "continuityNotes"]}},
    continuityPassed: {type: "boolean"},
    concerns: {type: "array", items: {type: "string"}}
  },
  required: ["slots", "continuityPassed", "concerns"]
};

const verdictSchema = {
  type: "object", additionalProperties: false,
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues"]
};

const buildSchema = {
  type: "object", additionalProperties: false,
  properties: {
    ok: {type: "boolean"},
    method: {type: "string"},
    solutionMp4FrameCount: {type: "integer"},
    filesWritten: {type: "array", items: {type: "string"}},
    notes: {type: "array", items: {type: "string"}}
  },
  required: ["ok", "method", "solutionMp4FrameCount", "filesWritten", "notes"]
};

const qcSchema = {
  type: "object", additionalProperties: false,
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    checks: {type: "array", items: {type: "object", additionalProperties: false, properties: {
      name: {type: "string"}, passed: {type: "boolean"}, detail: {type: "string"}
    }, required: ["name", "passed", "detail"]}}
  },
  required: ["passed", "issues", "checks"]
};

// ---------- helpers ----------

const validSource = (s) => typeof s === "string" && /^(0[1-9]|[12][0-9]|3[0-3])$/.test(s);

function validAssignment(a) {
  if (!a || !Array.isArray(a.slots) || a.slots.length !== 6) return false;
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const s = a.slots[i];
    if (!s || s.slot !== i + 1) return false;
    if (!validSource(s.source) || seen.has(s.source)) return false;
    seen.add(s.source);
    if (!s.rationale || !s.mostSimilarOther || !s.difference || !s.continuityNotes) return false;
    if (!validSource(s.mostSimilarOther) || s.mostSimilarOther === s.source) return false;
  }
  return true;
}

function compactReport(r) {
  if (!r) return null;
  return {
    clip: r.clip, frameCount: r.frameCount, summary: r.summary,
    shots: (r.shots || []).map(s => ({description: s.description, shotSize: s.shotSize, cameraAngle: s.cameraAngle, cameraMovement: s.cameraMovement, lensFeel: s.lensFeel || "", approxFrameRange: s.approxFrameRange || ""})),
    elements: r.elements || [], llamaAction: r.llamaAction || "", screenDirection: r.screenDirection || "",
    slotFit: r.slotFit || [], internalCuts: r.internalCuts, confidence: r.confidence || ""
  };
}

// ---------- prompts ----------

function analysisPrompt(clip) {
  return [
    "You are one worker in a video-editing assembly task. Read instruction.md for full context. Work in the current workspace (/workspace).",
    CONTRACT,
    "",
    "YOUR ASSIGNMENT: deeply analyze exactly ONE candidate clip and report how well it could serve each of the 6 slots.",
    `Clip: input/${clip}.mp4`,
    "",
    "Steps:",
    `1. Run ffprobe on input/${clip}.mp4 to get the exact decoded frame count (ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height,r_frame_rate,pix_fmt,sample_aspect_ratio -of json), duration, and confirm no audio stream.`,
    `2. Extract frames for visual inspection into work/frames/${clip}/: sample the whole clip evenly (aim for roughly 12-20 frames, e.g. ffmpeg -i input/${clip}.mp4 -vf "fps=2,scale=640:-2" work/frames/${clip}/f%02d.jpg, adjusting fps to the clip length). ALSO detect internal cuts with a scene-change select (ffmpeg -i input/${clip}.mp4 -vf "select='gt(scene,0.25)',showinfo" -f null -) and extract 2-3 frames near each detected cut so you can describe every distinct shot inside the clip.`,
    "3. VIEW the extracted frames with your image-viewing tool. Do not guess: report only what you actually see.",
    "4. For each distinct shot in the clip record: description, shot size (extreme wide / wide / full / medium / close-up / extreme close-up), camera angle (level / low / high), camera movement (locked off / pan / lateral tracking / zoom / handheld), lens feel (wide / normal / telephoto, depth of field), and approximate frame range.",
    "5. Record visible elements from this checklist when present: orange llama; llama walking / trotting / leaping / sitting / stunned / scorched-darkened; barbed-wire fence; barbed-wire fence post extreme close-up; electric fence with red insulator caps; sparks; shrub with small blue flowers; flowering shrubs; dry branches; rainbow; dark boulder; snowy mountains; arid plateau; grass foreground.",
    "6. Record the llama's action and its screen direction (which side of frame it is on, which way it moves or looks, its position relative to any fence and any visible goal).",
    "7. Judge fit to EACH of the 6 slots below as strong / possible / weak with a concrete rationale tied to the five slot fields. A clip that only partially matches a slot's content is at best 'possible'.",
    "",
    "ORDERED SHOT LIST:",
    SLOTS_TEXT,
    "",
    "Finally, write your full report as JSON to work/clip-" + clip + ".json and return it in the required schema."
  ].join("\n");
}

const similarityPrompt = [
  "You are one worker in a video-editing assembly task. Read instruction.md for full context. Work in /workspace.",
  CONTRACT,
  "",
  "YOUR ASSIGNMENT: identify which of the 33 candidate clips overlap in time, are highly similar in content, or show the same scene with a different shot treatment. This is needed because the evidence file must name, for each chosen clip, the most similar OTHER candidate and one concrete visible difference.",
  "",
  "Suggested approach (adapt as needed, use only ffmpeg/ffprobe/python3):",
  "1. For each clip extract a small signature: 3 thumbnails (first, middle, last frame) at low resolution into work/sim/ (e.g. ffmpeg -ss and -frames:v 1).",
  "2. Compute cheap perceptual signatures per thumbnail (e.g. Python + PIL-free approach: use ffmpeg to dump raw RGB and compute block-average hashes in Python, or use ffmpeg's psnr/ssim filters between thumbnail pairs).",
  "3. Compare pairs whose signatures are close; for close pairs run a finer check (psnr/ssim on a few aligned frames) or visually inspect their thumbnails yourself to confirm the relationship and characterize HOW they differ (e.g. same action, different shot size; same scene, different camera position; overlapping time range with different start/end).",
  "4. Group clips that depict the same scene/moment. Note for each high-similarity pair what the concrete visible difference is.",
  "Report all high and medium similarity pairs (limit to the meaningful ones, roughly the top 20-40 pairs) and the groups. Also write your findings to work/similarity.json."
].join("\n");

function assignPrompt(reportsJson, simJson, attempt) {
  return [
    "You are the shot-selection coordinator in a video-editing assembly task. Read instruction.md for full context. Work in /workspace.",
    CONTRACT,
    "",
    "YOUR ASSIGNMENT: choose the final assignment of 6 DISTINCT candidate clips to the 6 ordered slots. You may re-inspect any clip (frames may already exist under work/frames/NN/; you can extract more with ffmpeg) but base your decision primarily on the per-clip analysis reports below.",
    "",
    "ORDERED SHOT LIST (every field of a slot must match):",
    SLOTS_TEXT,
    "",
    "PER-CLIP ANALYSIS REPORTS (JSON):",
    reportsJson,
    "",
    "SIMILARITY / OVERLAP FINDINGS (JSON):",
    simJson,
    "",
    "Requirements for your answer:",
    "- Exactly 6 slots in order; slot i must use source \"NN\" (two digits) with all six sources distinct.",
    "- Each chosen clip must match EVERY field of its slot: content beats, shot size(s), camera angle, lens feel, camera movement.",
    "- The sequence must play as one continuous scene: the llama's screen direction of travel, eyeline, and position relative to the fence and its goal must be consistent across all 6 slots and agree with the direction established in slot 1; respect the 180-degree line. State the continuity reasoning per slot.",
    "- For each slot name the most similar OTHER candidate clip (use the similarity findings and the reports) and one concrete VISIBLE difference between your chosen clip and that candidate (this goes into the evidence file).",
    "- If you believe no clip strongly fits a slot, still pick the best available and record the concern in 'concerns'.",
    (attempt > 0 ? "NOTE: this is attempt " + (attempt + 1) + "; previous attempts failed validation, produce a fully valid assignment." : ""),
    "You may also write your reasoning to work/assignment-notes.md. Return the assignment in the required schema."
  ].filter(Boolean).join("\n");
}

function verifySelectionPrompt(assignmentJson, simJson) {
  return [
    "You are an independent verifier in a video-editing assembly task. Read instruction.md for full context. Work in /workspace.",
    CONTRACT,
    "",
    "A proposed slot assignment exists (JSON):",
    assignmentJson,
    "",
    "Similarity/overlap findings (JSON):",
    simJson,
    "",
    "ORDERED SHOT LIST:",
    SLOTS_TEXT,
    "",
    "YOUR ASSIGNMENT: independently verify the proposed selection by INSPECTING THE ACTUAL CLIPS, not just trusting the proposal.",
    "1. For each of the 6 chosen clips, extract a dense frame sample of input/NN.mp4 (existing samples may be in work/frames/NN/; extract more if needed, including around internal cuts) and check EVERY field of its slot: content beats, shot size(s), camera angle, lens feel, camera movement.",
    "2. Check the 6 sources are distinct.",
    "3. Check continuity across the sequence in slot order: llama's direction of travel and eyeline, its screen position relative to the fence and its goal, 180-degree line, agreement with the direction established in slot 1. The clips are excerpts shown out of order; judge continuity from what is visible in each clip's frames.",
    "4. Check that each named mostSimilarOther is plausible (it should be a genuinely similar other candidate per the similarity findings or your own inspection) and that the stated difference is concrete and visible.",
    "5. For any slot that seems wrong, inspect the alternative candidates reported for that slot and say which clip should replace it and why.",
    "Return passed=true only if all slot fields match, sources are distinct, continuity holds, and the evidence claims are sound. Otherwise return passed=false with specific, actionable issues (name slots and candidate clip numbers)."
  ].join("\n");
}

function repairAssignmentPrompt(assignmentJson, issues, reportsJson) {
  return [
    "You are the shot-selection coordinator in a video-editing assembly task. Read instruction.md for full context. Work in /workspace.",
    CONTRACT,
    "",
    "The current assignment is:",
    assignmentJson,
    "",
    "An independent verifier reported these issues:",
    JSON.stringify(issues),
    "",
    "Per-clip analysis reports (JSON):",
    reportsJson,
    "",
    "ORDERED SHOT LIST (every field must match):",
    SLOTS_TEXT,
    "",
    "YOUR ASSIGNMENT: fix the assignment. Re-inspect the relevant clips with ffmpeg frame extraction if the reports are insufficient. Swap clips where a slot field or continuity fails. Keep the parts that were verified as correct. Return the FULL revised assignment (all 6 slots, distinct sources, with mostSimilarOther and a concrete visible difference for each)."
  ].join("\n");
}

function buildPrompt(assignmentJson, probeJson) {
  return [
    "You are the deliverables builder in a video-editing assembly task. Read instruction.md for full context. Work in /workspace.",
    CONTRACT,
    "",
    "FINAL APPROVED ASSIGNMENT (JSON):",
    assignmentJson,
    "",
    "ffprobe metadata (JSON, may be incomplete; re-probe anything you need):",
    probeJson,
    "",
    "YOUR ASSIGNMENT: produce exactly three files in output/ and nothing else.",
    "",
    "1. output/solution.mp4 — the 6 chosen complete clips concatenated in slot order:",
    "   - ffprobe each chosen input/NN.mp4 for codec, pix_fmt, resolution, fps, SAR, exact decoded frame count.",
    "   - If all 6 share identical parameters (expected: h264, yuv420p, 1280x720, 24/1 fps, SAR 1:1, no audio), concatenate losslessly with the ffmpeg concat demuxer (-c copy -an).",
    "   - If any parameter differs or lossless concat produces broken output, re-encode each clip to a common format (libx264 -crf 18 -pix_fmt yuv420p -vf scale=1280:720 -r 24 -an, keep exact frame counts) and concatenate the intermediates; the contract allows re-encode at CRF <= 18.",
    "   - Result must be H.264/yuv420p, 1280x720, SAR 1:1, constant 24/1 fps, no audio, and its decoded frame count must equal the SUM of the 6 source frame counts (verify with ffprobe -count_frames).",
    "2. output/solution.json — {\"segments\":[...]} with exactly 6 objects in slot order, each: slot (1-6), source \"NN\", output_frames [start, end) half-open, source_frames [0, frame_count] where frame_count is the exact decoded frame count of that source clip. Segments must be contiguous from frame 0 with no gaps or overlaps; the last end must equal the decoded frame count of solution.mp4.",
    "3. output/selection-evidence.json — a JSON array of exactly 6 objects in slot order, each: slot, source, source_frames [a, b] with b - a >= 12 and 0 <= a < b <= frame_count (pick a representative window inside the clip, e.g. centered, about 24 frames), and reason: a string stating why the clip fits the slot AND one concrete visible difference from the most similar other candidate (use the assignment's mostSimilarOther and difference fields).",
    "",
    "Validate your own JSON files by parsing them. output/ must contain EXACTLY these three files (remove anything else from output/). Use work/ for intermediates. Report what you built in the required schema."
  ].join("\n");
}

function qcPrompt(assignmentJson) {
  return [
    "You are the final quality-control auditor in a video-editing assembly task. Read instruction.md for full context. Work in /workspace.",
    CONTRACT,
    "",
    "Intended assignment (JSON):",
    assignmentJson,
    "",
    "YOUR ASSIGNMENT: audit the deliverables in output/ against the public format spec. Perform each check and report it by name:",
    "1. output/ contains EXACTLY three files: solution.mp4, solution.json, selection-evidence.json.",
    "2. solution.mp4: ffprobe shows h264, yuv420p, 1280x720, SAR 1:1, constant frame rate 24/1, no audio stream; decoded frame count via ffprobe -count_frames.",
    "3. solution.mp4 frame content: spot-check that the concatenated video actually consists of the 6 declared clips in slot order (extract frames at the boundaries between segments and compare a frame or two against frames extracted from the corresponding input/NN.mp4 at the same offsets; also check total frame count equals the sum of the 6 source decoded frame counts from ffprobe).",
    "4. solution.json: parses as {\"segments\":[...]}, exactly 6 objects in slot order with fields slot, source, output_frames, source_frames; output_frames half-open, contiguous from 0, no gaps/overlaps, last end == decoded frame count of solution.mp4; source_frames == [0, frame_count] of the actual source clip (re-probe each source).",
    "5. selection-evidence.json: parses as an array of exactly 6 objects in slot order with slot, source, source_frames [a,b] where b-a >= 12 and the interval lies inside the source clip's frame range; reason strings mention both slot fit and a visible difference versus a similar other candidate.",
    "6. The 6 sources are distinct and match the intended assignment.",
    "Return passed=true only if every check passes; otherwise passed=false with specific issues (file, field, expected vs actual)."
  ].join("\n");
}

function fixDeliverablesPrompt(issues) {
  return [
    "You are the deliverables builder in a video-editing assembly task. Read instruction.md for full context. Work in /workspace.",
    CONTRACT,
    "",
    "The final QC audit reported these issues with the current deliverables in output/:",
    JSON.stringify(issues),
    "",
    "YOUR ASSIGNMENT: fix these issues directly. You may rebuild output/solution.mp4 (lossless concat with -c copy, or re-encode at CRF <= 18 if needed), and rewrite output/solution.json and output/selection-evidence.json so they satisfy the public format spec exactly (see instruction.md). Do not change which clips are used or their order unless an issue says a segment does not match its declared source. Keep output/ to exactly the three deliverable files. Re-run the failed checks yourself before returning. Report what you fixed in the required schema."
  ].join("\n");
}

// ---------- phase 1: probe ----------

log("Probing input clips with ffprobe");
let probe = null;
try {
  probe = await agent([
    "You are a worker in a video-editing assembly task. Work in /workspace. Read instruction.md for context.",
    "YOUR ASSIGNMENT: run ffprobe on every clip input/01.mp4 .. input/33.mp4 and collect, for each: exact decoded frame count (ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of json), width, height, fps (r_frame_rate), duration, pix_fmt, SAR, and whether an audio stream exists. Note any clip whose parameters deviate from h264 / 1280x720 / yuv420p / 24 fps / SAR 1:1 / no audio. Write the full table to work/probe.json and return it in the required schema (clip as two-digit string like \"01\")."
  ].join("\n"), {label: "probe", phase: "Probe inputs", schema: probeSchema});
} catch (e) {
  log("Probe agent failed: " + e);
}
const probeJson = JSON.stringify(probe && probe.clips ? probe : {note: "probe unavailable; workers must ffprobe individually", anomalies: probe ? probe.anomalies : []});
if (probe && probe.anomalies && probe.anomalies.length) log("Probe anomalies: " + probe.anomalies.join("; "));

// ---------- phase 2 + 3: per-clip analysis and similarity clustering (concurrent) ----------

log("Analyzing 33 candidate clips and clustering similar candidates");
const analysisThunks = CLIPS.map(c => () => agent(analysisPrompt(c), {label: "analyze-" + c, phase: "Analyze candidates", schema: clipSchema}));
const all = await parallel([...analysisThunks, () => agent(similarityPrompt, {label: "similarity", phase: "Cluster similar clips", schema: simSchema})]);
let clipReports = all.slice(0, 33);
let similarity = all[33];

// one retry pass for missing clip reports / similarity
let missing = CLIPS.filter((_, i) => clipReports[i] === null);
if (missing.length) {
  log("Retrying analysis for missing clips: " + missing.join(", "));
  const retryThunks = [];
  const retrySimilarity = similarity === null;
  for (const c of missing) retryThunks.push(() => agent(analysisPrompt(c), {label: "analyze-" + c + "-retry", phase: "Analyze candidates", schema: clipSchema}));
  if (retrySimilarity) retryThunks.push(() => agent(similarityPrompt, {label: "similarity-retry", phase: "Cluster similar clips", schema: simSchema}));
  const retry = await parallel(retryThunks);
  let k = 0;
  for (const c of missing) {
    const idx = CLIPS.indexOf(c);
    if (retry[k] !== null && retry[k] !== undefined) clipReports[idx] = retry[k];
    k++;
  }
  if (retrySimilarity && retry[k]) similarity = retry[k];
}

const reportByClip = {};
const failedClips = [];
CLIPS.forEach((c, i) => {
  if (clipReports[i]) reportByClip[c] = clipReports[i];
  else failedClips.push(c);
});
if (failedClips.length) log("WARNING: analysis missing for clips: " + failedClips.join(", "));
if (Object.keys(reportByClip).length < 6) {
  return {status: "unresolved", reason: "fewer than 6 clip analyses succeeded; cannot assign slots", failedClips, probe};
}

// deterministic per-slot candidate hint
const slotCandidates = SLOTS.map((_, si) => {
  const strong = [], possible = [];
  for (const c of CLIPS) {
    const r = reportByClip[c];
    if (!r) continue;
    for (const f of (r.slotFit || [])) {
      if (f.slot === si + 1 && f.fit === "strong") strong.push(c);
      else if (f.slot === si + 1 && f.fit === "possible") possible.push(c);
    }
  }
  return {slot: si + 1, strong, possible};
});
log("Slot candidate hint: " + JSON.stringify(slotCandidates));

const reportsJson = JSON.stringify(Object.values(reportByClip).map(compactReport));
const simJson = JSON.stringify(similarity || {note: "similarity analysis unavailable", pairs: [], groups: []});

// ---------- phase 4: assignment ----------

log("Assigning clips to slots");
let assignment = null;
for (let attempt = 0; attempt < Math.max(1, maxRounds) && !validAssignment(assignment); attempt++) {
  try {
    assignment = await agent(assignPrompt(reportsJson, simJson, attempt), {label: "assign-" + attempt, phase: "Assign slots", schema: assignSchema});
  } catch (e) {
    log("Assignment attempt " + attempt + " failed: " + e);
  }
}
if (!validAssignment(assignment)) {
  return {status: "unresolved", reason: "could not produce a valid 6-slot assignment with distinct sources", slotCandidates, failedClips, lastAssignment: assignment};
}
const assignmentJson = JSON.stringify(assignment.slots);
log("Assignment: " + assignment.slots.map(s => "slot" + s.slot + "=" + s.source).join(", "));

// ---------- phase 5: verify selection with repair loop ----------

let selVerdict = null;
try {
  selVerdict = await agent(verifySelectionPrompt(assignmentJson, simJson), {label: "verify-selection", phase: "Verify selection", schema: verdictSchema});
} catch (e) {
  log("Selection verification failed: " + e);
}
let selRounds = 0;
let unresolvedSelectionIssues = [];
while (selVerdict && !selVerdict.passed && selVerdict.issues && selVerdict.issues.length && selRounds < maxRounds) {
  unresolvedSelectionIssues = selVerdict.issues;
  log("Selection verification round " + selRounds + " failed; repairing. Issues: " + selVerdict.issues.join(" | "));
  let repair = null;
  try {
    repair = await agent(repairAssignmentPrompt(assignmentJson, selVerdict.issues, reportsJson), {label: "repair-assignment-" + selRounds, phase: "Verify selection", schema: assignSchema});
  } catch (e) {
    log("Repair attempt failed: " + e);
  }
  if (repair && validAssignment(repair)) {
    assignment = repair;
  } else {
    log("Repair did not return a valid assignment; keeping previous assignment");
  }
  try {
    selVerdict = await agent(verifySelectionPrompt(JSON.stringify(assignment.slots), simJson), {label: "verify-selection-" + (selRounds + 1), phase: "Verify selection", schema: verdictSchema});
  } catch (e) {
    log("Re-verification failed: " + e);
    selVerdict = null;
    break;
  }
  selRounds++;
}
const selectionOk = selVerdict ? selVerdict.passed : false;
if (!selectionOk) {
  unresolvedSelectionIssues = (selVerdict && selVerdict.issues) ? selVerdict.issues : ["selection verification did not complete"];
  log("Proceeding to build with unverified selection; issues: " + unresolvedSelectionIssues.join(" | "));
}
const finalAssignmentJson = JSON.stringify(assignment.slots);

// ---------- phase 6: build deliverables ----------

log("Building deliverables");
let build = null;
try {
  build = await agent(buildPrompt(finalAssignmentJson, probeJson), {label: "build", phase: "Build deliverables", schema: buildSchema});
} catch (e) {
  log("Build failed: " + e);
}
if (!build || !build.ok) {
  try {
    build = await agent(buildPrompt(finalAssignmentJson, probeJson), {label: "build-retry", phase: "Build deliverables", schema: buildSchema});
  } catch (e) {
    log("Build retry failed: " + e);
  }
}
if (!build || !build.ok) {
  return {status: "unresolved", reason: "deliverables build failed", assignment: assignment.slots, selectionVerified: selectionOk, unresolvedSelectionIssues, build};
}

// ---------- phase 7: final QC with repair loop ----------

let qc = null;
try {
  qc = await agent(qcPrompt(finalAssignmentJson), {label: "final-qc", phase: "Final QC", schema: qcSchema});
} catch (e) {
  log("QC failed: " + e);
}
let qcRounds = 0;
while (qc && !qc.passed && qc.issues && qc.issues.length && qcRounds < maxRounds) {
  log("QC round " + qcRounds + " failed; fixing. Issues: " + qc.issues.join(" | "));
  let fix = null;
  try {
    fix = await agent(fixDeliverablesPrompt(qc.issues), {label: "fix-deliverables-" + qcRounds, phase: "Final QC", schema: buildSchema});
  } catch (e) {
    log("Fix attempt failed: " + e);
  }
  if (!fix || !fix.ok) break;
  try {
    qc = await agent(qcPrompt(finalAssignmentJson), {label: "final-qc-" + (qcRounds + 1), phase: "Final QC", schema: qcSchema});
  } catch (e) {
    log("Re-audit failed: " + e);
    qc = null;
    break;
  }
  qcRounds++;
}
const qcPassed = qc ? qc.passed : false;

// ---------- final result ----------

return {
  status: qcPassed && selectionOk ? "completed" : (qcPassed ? "completed-with-selection-concerns" : "unresolved"),
  assignment: assignment.slots.map(s => ({slot: s.slot, source: s.source, mostSimilarOther: s.mostSimilarOther})),
  selectionVerified: selectionOk,
  unresolvedSelectionIssues: selectionOk ? [] : unresolvedSelectionIssues,
  deliverables: build.filesWritten,
  solutionMp4FrameCount: build.solutionMp4FrameCount,
  buildMethod: build.method,
  finalQcPassed: qcPassed,
  finalQcChecks: qc ? qc.checks : [],
  finalQcIssues: qc && qc.issues ? qc.issues : ["QC did not complete"],
  failedClipAnalyses: failedClips,
  probeAnomalies: probe && probe.anomalies ? probe.anomalies : []
};