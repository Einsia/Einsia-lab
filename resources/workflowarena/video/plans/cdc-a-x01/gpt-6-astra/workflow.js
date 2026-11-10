export const meta = {
  name: "cdc-a-x01-pursuit-assembly",
  description: "Inspect forty anonymous clips, identify seven scene and camera-motion matches, assemble exactly 1650 frames, and verify the public deliverables.",
  phases: [
    { title: "Inspect inputs", detail: "Discover available tools, decode inventory, and survey every candidate." },
    { title: "Resolve seven slots", detail: "Compare scene content, shot boundaries, camera motion, and closest alternatives." },
    { title: "Plan exact ranges", detail: "Choose distinct sources and preserve complete described actions within 1650 frames." },
    { title: "Assemble", detail: "Encode a contiguous, unaltered frame sequence and write the selection manifest." },
    { title: "Verify and repair", detail: "Check decoded frames, media properties, scene matches, and camera moves." }
  ]
};

const task = `CDC-A-X01 — Pursuit and Search.
Future workspace: /workspace. Read instruction.md and applicable workspace instructions using tools actually available to you. Locate the task directory under /workspace; do not assume unprovided tools or installed Python packages. Public inputs are input/01.mp4 through input/40.mp4, anonymous silent H.264 clips, 1280x720, square pixels, letterboxed 16:9 canvas, 30 fps, about 6–12 seconds. Numbering is random. No network. Python 3.11, FFmpeg/ffprobe, and OpenCV are provided. No GPU or generated content. CREDITS.md only says attribution is withheld until evaluation ends; it supplies no clip identification. Infer identities only from decoded visual and temporal evidence, never filenames, file sizes, hashes, or film recognition.
Ordered requirements:
1. Aerial: snow-covered crags and blue ice foreground, beyond them an open snowfield, one tiny walker and winding footprints. ONE shot. Steady aerial fly-forward with continuous lateral drift at even speed.
2. Close-up of a red-haired woman's face, lying on her side in snow, tilted ground-level framing and drifting snow. ONE shot. Slow push-in with slight drift, continuing to the shot end.
3. City panorama fades up from black: dense rooftops and a distant tower, then CUT to high-angle view down a narrow alley. TWO shots. BOTH cameras locked off, framing unchanged within each shot.
4. Starts almost entirely obscured by a large dark foreground mass that sweeps away, revealing a short-red-haired girl against a sunlit wall. She leans out, looks, and moves along the wall, ending with framing behind her shoulder. ONE shot. Lateral tracking with her and slight handheld feel.
5. Close shot of the short-red-haired girl turning away; wide shot running down a narrow alley; she climbs over a roof edge; injured small winged creature on roof tiles. Preserve all described shots/events and their order. BOTH running shot and creature shot push forward.
6. Close-up of girl's gaze; hand reaches toward the small winged creature on tiles; close-up of girl breaking into a smile. THREE shots. BOTH face close-ups locked off. Middle shot pulls back while trucking sideways, gradually opening the hand–creature relationship.
7. High overhead dim interior, papers and clutter on floor; image becomes turbulent later. ONE shot. Completely static initially, then starts pushing forward and keeps accelerating.
Assembly contract: seven DISTINCT candidates in slot order. One contiguous half-open, zero-based frame range [a,b) per chosen source; 1x forward. Preserve every required shot and the WHOLE described camera move. No scaling, cropping, mirroring, image filters, overlays/text, interpolation, invented frames, freeze frames, retiming, or generated content. Hard cuts between segments, no added transitions or inserted black. Preserve the expressly required source fade-up from black in slot 3; do not manufacture black padding or remove that required fade. Exactly 1650 decoded frames = 55.0 seconds.
Deliver ONLY output/assembly.mp4 (H.264/yuv420p,1280x720,SAR1:1,CFR30/1,no audio,1650 frames) and output/selection.json. JSON root is {"slots":[...]} with exactly seven entries in order. Each entry has slot (1–7), source (two-digit ID), source_frames:[a,b], output_frames:[c,d], closest_alternative (another two-digit candidate ID), reason (one sentence naming a concrete visible difference between selected and closest alternative). Segment output intervals abut from 0 through 1650, and b-a=d-c. Closest alternative means the most similar actual other candidate, not an arbitrary clip; a subtle visible camera-motion difference can be decisive. All drafts, scripts, evidence, logs, contact sheets, and validation reports belong in work/, never output/.`;

const stringList = { type: "array", items: { type: "string" } };
const sourceId = { type: "string", pattern: "^(0[1-9]|[1-3][0-9]|40)$" };
const integerPair = { type: "array", items: { type: "integer", minimum: 0 }, minItems: 2, maxItems: 2 };
const objectSchema = (properties, required = Object.keys(properties)) => ({ type: "object", properties, required, additionalProperties: false });
const inventorySchema = objectSchema({
  ready: { type: "boolean" }, root: { type: "string" }, inventoryPath: { type: "string" },
  evidenceIndexPath: { type: "string" }, visualInspectionAvailable: { type: "boolean" },
  clips: { type: "array", items: objectSchema({ source: sourceId, frames: { type: "integer", minimum: 1 } }) },
  availableTools: stringList, issues: stringList
});
const surveySchema = objectSchema({
  complete: { type: "boolean" }, reportPath: { type: "string" },
  clips: { type: "array", items: objectSchema({
    source: sourceId, description: { type: "string" },
    possibleSlots: { type: "array", items: { type: "integer", minimum: 1, maximum: 7 } },
    shotIntervals: { type: "array", items: integerPair },
    motionNotes: { type: "string" }, evidencePaths: stringList, uncertainties: stringList
  }) }, issues: stringList
});
const rangeSchema = objectSchema({
  startWindow: integerPair, endWindow: integerPair, justification: { type: "string" }
});
const slotSchema = objectSchema({
  slot: { type: "integer", minimum: 1, maximum: 7 }, complete: { type: "boolean" },
  reportPath: { type: "string" },
  rankedCandidates: { type: "array", items: objectSchema({
    source: sourceId, meetsAllRequirements: { type: "boolean" },
    sceneEvidence: { type: "string" }, cameraEvidence: { type: "string" },
    shotIntervals: { type: "array", items: integerPair },
    rangeOptions: { type: "array", items: rangeSchema }, concerns: stringList
  }) },
  closestAlternative: { anyOf: [sourceId, { type: "null" }] },
  comparisonReason: { type: "string" }, evidencePaths: stringList, unresolved: stringList
});
const selectionEntrySchema = objectSchema({
  slot: { type: "integer", minimum: 1, maximum: 7 }, source: sourceId,
  source_frames: integerPair, output_frames: integerPair,
  closest_alternative: sourceId, reason: { type: "string" }
});
const planSchema = objectSchema({
  ready: { type: "boolean" }, planPath: { type: "string" }, evidencePath: { type: "string" },
  slots: { type: "array", items: selectionEntrySchema }, issues: stringList
});
const renderSchema = objectSchema({
  completed: { type: "boolean" }, assemblyPath: { type: "string" }, selectionPath: { type: "string" },
  renderReportPath: { type: "string" }, decodedFrames: { type: "integer", minimum: 0 }, issues: stringList
});
const reviewSchema = objectSchema({
  passed: { type: "boolean" }, technicalPassed: { type: "boolean" }, visualPassed: { type: "boolean" },
  reportPath: { type: "string" },
  issues: { type: "array", items: objectSchema({
    category: { type: "string", enum: ["semantic", "range", "alternative", "manifest", "encoding", "verification"] },
    slots: { type: "array", items: { type: "integer", minimum: 1, maximum: 7 } },
    detail: { type: "string" }, evidence: { type: "string" }, remedy: { type: "string" }
  }) }, checks: stringList, limitations: stringList
});

const invocationFailures = [];
async function call(label, progressPhase, prompt, schema) {
  try {
    const result = await agent(task + "\n\nASSIGNMENT:\n" + prompt, {
      label, phase: progressPhase, agentType: "general-purpose", schema
    });
    if (result === null || result === undefined) {
      invocationFailures.push({ label, error: "Worker returned no result; no success inferred." });
      return null;
    }
    return result;
  } catch (error) {
    invocationFailures.push({ label, error: String(error) });
    return null;
  }
}
function unresolved(stage, detail, evidence = {}) {
  return { status: "unresolved", stage, detail, ...evidence, invocationFailures };
}

const inventory = await call("inventory-and-viewing-setup", "Inspect inputs", `You own work/catalog/ and shared preparation only; do not select clips or write deliverables.
Locate the task and read its public instructions. Confirm all forty inputs are accessible. Discover the tools you can actually use for viewing frames or video. Decode/count every clip with ffprobe/FFmpeg; save exact counts and stream metadata (frame rate and timebase, dimensions, SAR, pixel format, duration, audio streams) in work/catalog/inventory.json. Check actual frame timestamps if nominal rates are ambiguous. Record anomalies, do not silently normalize source motion.
Create modest labeled chronological contact sheets with frame indices across each whole clip, including first/last frames, and an index in work/catalog/. Analysis-only thumbnails may be resized or annotated; the assembly must not be. Include dense enough samples to route scenes, but explicitly note that still sheets do not prove motion or locked cameras. Avoid extracting forty videos into enormous full-frame image collections. Confirm that you can actually open/view representative decoded images through an available visual tool. If visual evidence cannot be inspected, report that limitation and do not invent descriptions.
Return root, inventoryPath, evidenceIndexPath, all forty source IDs and actual decoded frame counts, available tools, issues, and readiness. Ready means the inputs and tools permit the remaining task; it does not claim the content matches. Do not use file metadata as a proxy for visual identity.`, inventorySchema);
if (!inventory || !inventory.ready || !inventory.visualInspectionAvailable) {
  return unresolved("Inspect inputs", "Accessible inputs and actual visual inspection are prerequisites.", { inventory });
}
const expectedIds = Array.from({ length: 40 }, (_, i) => String(i + 1).padStart(2, "0"));
const counts = {};
for (const clip of inventory.clips) counts[clip.source] = clip.frames;
if (inventory.clips.length !== 40 || new Set(inventory.clips.map(c => c.source)).size !== 40 || expectedIds.some(id => !Number.isInteger(counts[id]) || counts[id] <= 0)) {
  return unresolved("Inspect inputs", "Inventory does not account for all forty unique source clips.", { inventory });
}
const locationContext = "Task root: " + inventory.root + "\nInventory: " + inventory.inventoryPath + "\nEvidence index: " + inventory.evidenceIndexPath;
const batches = Array.from({ length: 4 }, (_, i) => expectedIds.slice(i * 10, i * 10 + 10));
let surveys = await parallel(batches.map((ids, batch) => () => call(
  "survey-" + (batch + 1), "Inspect inputs",
  locationContext + "\nYou own work/survey-" + (batch + 1) + "/ only. Inspect these sources: " + ids.join(", ") + `.
Read the prepared evidence, then inspect chronological frames/video across EVERY assigned clip. Identify visible subjects/events, possible slots, shot boundaries, and preliminary motion. Look at beginning and end as well as the middle. Do not reject visually similar variants merely because a few thumbnails look alike. Preserve uncertain possible-slot labels so the detailed slot specialist can compare them. In particular distinguish camera motion from character movement, snowfall, foreground occlusion, and later turbulence. Record frame-index evidence and uncertainties. Use additional targeted frame views where a sheet is unclear. Return one entry per assigned source and write a detailed report in your directory. This is complete coverage and routing, not final certification of camera motion. Do not edit shared inventory or output/.`, surveySchema
)));
function surveyValid(result, ids) {
  return !!result && result.complete && result.clips.length === ids.length &&
    new Set(result.clips.map(c => c.source)).size === ids.length && ids.every(id => result.clips.some(c => c.source === id));
}
for (let i = 0; i < surveys.length; i++) {
  if (!surveyValid(surveys[i], batches[i])) {
    surveys[i] = await call("recover-survey-" + (i + 1), "Inspect inputs",
      locationContext + "\nRecover the incomplete survey for sources " + batches[i].join(", ") + ". Own work/survey-" + (i + 1) + "/. Read any existing report and inspect all missing or uncertain sources visually. Return a complete source-by-source survey with possible slots, chronological shot intervals, preliminary camera observations, and evidence paths. Do not infer any unviewed content. Prior result: " + JSON.stringify(surveys[i]), surveySchema);
  }
}
const incompleteSurveys = batches.map((ids, i) => ({ batch: i + 1, sources: ids, result: surveys[i] })).filter((entry, i) => !surveyValid(entry.result, batches[i]));
if (incompleteSurveys.length) return unresolved("Inspect inputs", "Candidate coverage is incomplete; closest alternatives cannot yet be established.", { incompleteSurveys });
const catalog = surveys.flatMap(s => s.clips).sort((a, b) => a.source.localeCompare(b.source));
const catalogContext = "\nComplete public-input survey (routing evidence, not final motion proof):\n" + JSON.stringify(catalog);
const specificFocus = [
  "Verify the walker and winding footprints beyond crags/blue ice, and distinguish even fly-forward PLUS persistent lateral drift from a locked shot, pure push, orbit, or accelerating move. Check the entire move, including both ends.",
  "Check the woman on her side in tilted ground-level snow framing. Background/face perspective must support a slow push with slight drift, still continuing at the ending; distinguish pauses, pullback, and subject-only movement.",
  "Inspect the fade-up and city-to-alley cut. Establish TWO locked-off shots by comparing static scene landmarks throughout each, with exposure/fade handled separately from geometry. Small pan/zoom variants must not pass as locked.",
  "Verify the opening foreground occluder, its reveal, the girl's lean and movement, and final behind-shoulder framing. Distinguish a lateral tracking camera with slight handheld feel from a fixed camera observing her or another type of move.",
  "Verify every described event and shot in order: turning away, running alley, climbing roof, injured creature. Independently establish camera push-forward in BOTH running and creature shots. A match in only one shot is insufficient.",
  "Verify exactly THREE required shots and their order. Both face close-ups must remain locked despite facial movement. The hand/creature middle shot must pull BACK and truck sideways, opening their spatial relationship; distinguish push-in, pure pan, and subject motion.",
  "Verify high overhead dim cluttered interior, later turbulence, and a genuinely static initial phase followed by a push-forward whose speed continues to increase. Do not mistake papers/scene turbulence for camera acceleration. Compare stable geometry before and after onset with equal frame intervals."
];
let slotReports = await parallel(specificFocus.map((focus, i) => () => call(
  "slot-" + (i + 1) + "-motion-and-match", "Resolve seven slots",
  locationContext + catalogContext + "\nYou own work/slot-" + (i + 1) + "/. Resolve slot " + (i + 1) + ". " + focus + `
Review all forty survey entries and inspect every plausible candidate for this slot, including uncertain entries. Reopen original source frames/video; survey text alone cannot certify a match. Compare near-duplicates directly, across their entire duration, with dense temporal sampling around shot boundaries and motion onset/end. Use short frame strips, available playback, or robust feature tracking on static scene geometry. OpenCV optical flow/homography or affine fits can corroborate camera motion, but mask/exclude letterbox bars, moving subjects, occluders, and moving particles as appropriate. Report tracking uncertainty; a noisy fit is not proof. Do not use movement of a character, snow, or turbulence as a substitute for camera movement. Interpret parallax and perspective, not just bounding-box size. Cite specific frame intervals and visible landmarks.
Return rankedCandidates ordered by visual/temporal match, including every credible full match and the strongest near-misses. Mark meetsAllRequirements true only with affirmative evidence for every slot clause. For each full match propose frame-exact safe rangeOptions preserving ALL required shots and the WHOLE specified camera trajectory. A range option has startWindow [minStart,maxStart] and endWindow [minEnd,maxEnd], BOTH inclusive endpoint windows; choosing any integer a in the first and b in the second must preserve the entire described content and motion in the half-open source range [a,b). Default to fixed endpoints [a,a] and [b,b]; never invent trim flexibility. Flexible windows are allowed only for visually verified dispensable handles outside the full required move/events, with maxStart < minEnd. If movement continues to the source end, retain that end. Include justification and exact evidence. For wrong candidates rangeOptions may be empty.
Identify the closest actual alternative and one sentence stating its concrete visible difference from the leading full match. If no defensible full match or alternative exists, state why instead of forcing a pick. Write a detailed report with evidence paths in your directory. complete means the comparison is finished; unresolved should name substantive gaps. Do not allocate the 55-second global duration or write output/.`, slotSchema
)));
for (let i = 0; i < slotReports.length; i++) {
  const report = slotReports[i];
  if (!report || !report.complete || report.slot !== i + 1) {
    slotReports[i] = await call("recover-slot-" + (i + 1), "Resolve seven slots",
      locationContext + catalogContext + "\nRecover slot " + (i + 1) + " analysis in work/slot-" + (i + 1) + "/. " + specificFocus[i] + " Read existing evidence, inspect original video and plausible near-matches, and return the required complete structured report. Safe range options use inclusive endpoint windows; every allowed endpoint combination must preserve the whole required move and events. Default to fixed full required ranges. Do not guess missing evidence. Prior result: " + JSON.stringify(report), slotSchema);
  }
}
if (slotReports.some((r, i) => !r || !r.complete || r.slot !== i + 1)) {
  return unresolved("Resolve seven slots", "At least one slot lacks a completed visual comparison.", { slotReports });
}

function planProblems(plan) {
  const problems = [];
  if (!plan || !plan.ready) return ["No ready edit plan was returned."];
  if (!Array.isArray(plan.slots) || plan.slots.length !== 7) return ["Plan must contain exactly seven slots."];
  let cursor = 0;
  const used = new Set();
  for (let i = 0; i < 7; i++) {
    const s = plan.slots[i];
    if (s.slot !== i + 1) problems.push("Incorrect slot order at entry " + (i + 1));
    if (!(s.source in counts)) problems.push("Unknown source at slot " + (i + 1));
    if (used.has(s.source)) problems.push("Repeated selected source " + s.source);
    used.add(s.source);
    const [a, b] = s.source_frames;
    const [c, d] = s.output_frames;
    if (![a, b, c, d].every(Number.isInteger) || a < 0 || b <= a || b > counts[s.source]) problems.push("Invalid source interval at slot " + (i + 1));
    if (c !== cursor || d <= c || b - a !== d - c) problems.push("Nonabutting or unequal interval at slot " + (i + 1));
    cursor = d;
    if (!(s.closest_alternative in counts) || s.closest_alternative === s.source) problems.push("Invalid alternative at slot " + (i + 1));
    if (!s.reason || !s.reason.trim()) problems.push("Missing visible comparison reason at slot " + (i + 1));
  }
  if (cursor !== 1650) problems.push("Total is " + cursor + " frames, not 1650.");
  return problems;
}
const analysisContext = locationContext + "\nActual source frame counts: " + JSON.stringify(counts) + "\nSlot reports:\n" + JSON.stringify(slotReports);
async function makePlan(label, prior, feedback) {
  return await call(label, "Plan exact ranges", analysisContext + `
You are the only edit-plan writer. Own work/edit/. Read all seven detailed slot reports and their frame evidence. Resolve any conflicting/uncertain full matches or source collisions by viewing the original candidates and near-misses. If reports omit a plausible match, consult the full survey at the paths below. Source selection must satisfy scene AND camera requirements; duration alone cannot identify a source.
Create a concrete seven-source edit plan and write work/edit/selection-draft.json plus work/edit/plan-evidence.json. The draft must have exactly the final selection.json structure. Preserve all required internal shots, whole camera trajectories, and slot 3's original fade. Prefer the complete verified ranges. Achieve exactly 1650 frames using only demonstrated optional handles. Use integer interval arithmetic/dynamic programming or a small exact search over certified ranges and distinct-source assignments; calculate every range and output boundary explicitly. For inclusive safe endpoint windows [s0,s1] and [e0,e1] with s1<e0, achievable lengths are the integers e0-s1 through e1-s0, but this arithmetic is valid only if all those endpoints have visual evidence. If useful, reconstruct a length L by choosing a in [max(s0,e0-L), min(s1,e1-L)] and b=a+L.
When certified ranges cannot total 1650, recheck shot/move boundaries, source ends, and near-match classifications visually. Do not shave the beginning/end of a continuous move, omit a required shot, add black or frozen frames, change speed, or accept a wrong camera variant to force duration. Explain any revised evidence and certified endpoint windows in plan-evidence.json. If no valid exact solution is supported, return ready:false with explicit issues rather than manufacturing compliance.
For each source compare its closest alternative, and ensure reason is one factual sentence describing a visible distinction. Recheck reasons if your chosen source differs from the slot specialist's leading match. plan-evidence.json must tie the final endpoints and every slot clause to actual frame observations, identify the closest alternative, and explain any departure from specialist proposals. Do not write output/ yet.
Return ready, absolute plan/evidence paths, all seven final manifest entries, and unresolved issues. The workflow will independently validate arithmetic.\nSurvey paths: ` + JSON.stringify(surveys.map(s => s.reportPath)) + "\nPrevious plan: " + JSON.stringify(prior) + "\nFeedback requiring attention: " + JSON.stringify(feedback), planSchema);
}
let editPlan = await makePlan("build-frame-exact-plan", null, []);
let arithmeticIssues = planProblems(editPlan);
if (arithmeticIssues.length) {
  editPlan = await makePlan("resolve-plan-gaps", editPlan, arithmeticIssues);
  arithmeticIssues = planProblems(editPlan);
}
if (arithmeticIssues.length) return unresolved("Plan exact ranges", "No validated exact edit plan is available.", { editPlan, arithmeticIssues, slotReports });

async function render(plan, label, feedback) {
  return await call(label, "Assemble", locationContext + "\nAPPROVED FRAME PLAN:\n" + JSON.stringify(plan) + `
You are the sole writer of output/. Use work/render/ for scripts, temporary files, logs, and candidate encodes. Read the approved evidence and draft. The structured slots supplied above are authoritative; reconcile the draft if it differs and do not silently alter any source or endpoint. Build output/selection.json with EXACTLY the specified root and entry fields. Encode the seven exact source ranges in order.
Preferred frame-exact method: decode each selected source sequentially with FFmpeg into native-resolution planar yuv420p raw frames, discard frames before a, and stream exactly [a,b) into ONE encoder fed raw frames at 30/1 fps. Read/write complete frame buffers and check subprocess return codes, avoiding pipe deadlocks. No RGB round trip through OpenCV for rendering, no timestamp seeking as a substitute for exact frame selection, no visual filters, no geometry changes. No extra frames at joins, no duplicate/drop resampling, no audio. Use CPU libx264 in lossless mode (for example CRF 0 with a practical fast preset) so decoded yuv420p frames can be compared exactly to the selected decoded source frames; H.264 profile is not constrained by the task. Retain the original letterbox pixels. Configure encoded sample aspect ratio to 1:1 and verify it; metadata configuration must not rescale pixels. An equivalent frame-accurate method is acceptable if it preserves the same pixels and exact mapping, but do not rely on keyframe-only stream-copy cuts.
Write temporary assembly under work/, fully decode it, check 1650 frames and nominal 55 seconds, inspect stream properties, then place the final two files in output/. No support files there. Preserve unrelated preexisting files by moving them to a clearly documented work/ backup if necessary; do not delete source assets. Save the render command/script, range-to-frame accounting, source/output hashes or validation details, and tool errors under work/render/. Report success only after both files actually exist and can be read.\nRepair feedback: ` + JSON.stringify(feedback), renderSchema);
}
async function review(plan, rendered, round) {
  return await call("verify-deliverables-" + round, "Verify and repair", locationContext + "\nEdit plan:\n" + JSON.stringify(plan) + "\nRender result:\n" + JSON.stringify(rendered) + "\nSpecialist reports:\n" + JSON.stringify(slotReports) + `
Independently verify the CURRENT files, not just reported intentions. You are read-only for input/, output/, and edit/render artifacts; own work/verify-` + round + `/ for reports and analysis. Your work must cover both mechanical and visual requirements because correct metadata cannot prove the shot selection.
1. Parse the actual selection.json; require exactly root slots and exactly seven entries with the six requested fields, ordered slots 1..7, seven distinct valid source IDs, integer in-bounds half-open ranges, one contiguous range per source, equal source/output lengths, abutting output from 0 to 1650, and other-source alternatives with a single concrete factual sentence. Compare with the supplied plan.
2. Fully decode assembly.mp4, independently count 1650 frames, and check H.264, yuv420p, 1280x720, SAR1:1, CFR30/1, exactly 55.0s, valid monotonically spaced frame timestamps, and absence of audio. Ensure output/ contains only assembly.mp4 and selection.json. Do not rely on container nb_frames alone.
3. Compare EVERY decoded output frame with its manifest-mapped source frame in the same native yuv420p decoding domain, preferably byte hashes (lossless encoding was requested). This verifies order, contiguity, no extra/missing/duplicated processing frames, intact canvas/letterboxing, no visual processing, and cut boundaries. If a nonlossless encode was used, do not demand impossible byte equality; diagnose it, establish frame mapping robustly, and prefer repairing to the requested lossless validation path. Distinguish legitimate identical consecutive source frames from duplicated processing frames. Check seven joins and all source-internal cuts. The native slot-3 fade is required, not an inserted transition.
4. Actually VIEW each selected segment over time, including its start and end and all internal cuts. Recheck every scene and camera clause in the public task. Revisit each closest alternative and verify the stated visible difference and that no more similar plausible candidate in the survey was ignored. Use source originals to assess small camera movements; review temporal landmarks rather than trusting specialist prose or noisy optical flow. Check continuous drift/even speed in slot 1; slot 2 push continuing through end; BOTH locked views in slot 3; foreground reveal/tracking/end shoulder in slot 4; BOTH pushes in slot 5; two locked faces and backward-plus-sideways middle shot in slot 6; static onset then accelerating push through turbulence in slot 7. Verify trims retain the WHOLE described moves and events.
Save explicit checks, frame references, comparison evidence, and any inability to verify in your report. passed can be true only if technicalPassed AND visualPassed are true, issues is empty, and no material verification limitation remains. Categorize failures so repairs can target encoding/manifest versus semantic/range/alternative problems. A missing visual tool or uninspected subtle move is a verification failure, not a pass. Do not modify deliverables.`, reviewSchema);
}
let rendered = await render(editPlan, "render-approved-plan", []);
if (!rendered || !rendered.completed) {
  rendered = await render(editPlan, "recover-render", [{ detail: "Previous renderer did not finish. Inspect work/render/ logs, diagnose and repair, then render the same approved plan.", prior: rendered }]);
}
if (!rendered || !rendered.completed) return unresolved("Assemble", "Rendering did not produce confirmed deliverables.", { editPlan, rendered });
let verdict = await review(editPlan, rendered, 0);
function verified(v) {
  return !!v && v.passed && v.technicalPassed && v.visualPassed && v.issues.length === 0 && v.limitations.length === 0;
}
for (let round = 1; round <= 2 && !verified(verdict); round++) {
  if (!verdict) {
    // Missing review is not evidence of a bad render; retry verification without changing files.
    verdict = await review(editPlan, rendered, round);
    continue;
  }
  const needsNewPlan = verdict.issues.some(issue => ["semantic", "range", "alternative"].includes(issue.category));
  if (needsNewPlan) {
    const revised = await makePlan("repair-edit-plan-" + round, editPlan, verdict);
    const problems = planProblems(revised);
    if (problems.length) return unresolved("Verify and repair", "Visual/range feedback could not be resolved into a valid plan.", { editPlan, revised, problems, verdict });
    editPlan = revised;
  }
  const needsRender = needsNewPlan || verdict.issues.some(issue => ["manifest", "encoding"].includes(issue.category));
  if (needsRender) {
    rendered = await render(editPlan, "repair-render-" + round, verdict);
    if (!rendered || !rendered.completed) return unresolved("Verify and repair", "Repair rendering failed.", { editPlan, rendered, verdict });
  }
  // Verification limitations call for additional evidence, not arbitrary modifications.
  verdict = await call("recheck-and-close-" + round, "Verify and repair", locationContext + "\nPrevious verification:\n" + JSON.stringify(verdict) + "\nReview its saved report and resolve the specific outstanding evidence gaps using available tools. You own work/recheck-" + round + "/ and must not edit output/. Do not claim an unavailable observation. Return the same verification schema. Recheck the current actual files against the full task: all media properties, exact 1650-frame source mapping, manifest arithmetic, all seven visual/camera requirements, whole retained moves, alternatives and reasons, and the two-file output directory. Inspect the current plan/render and prior evidence for unchanged passing checks, but invalidate any checks affected by repairs. Current plan: " + JSON.stringify(editPlan) + "\nCurrent render: " + JSON.stringify(rendered) + "\nOriginal specialist evidence: " + JSON.stringify(slotReports) + "\nOnly pass if both technical and visual verification are affirmative with empty issues and limitations. Include specific evidence and a saved report path.", reviewSchema);
}
if (!verified(verdict)) return unresolved("Verify and repair", "The deliverables are not fully verified after targeted repairs; do not represent the task as complete.", { editPlan, rendered, verdict });
return {
  status: "verified",
  deliverables: { assembly: rendered.assemblyPath, selection: rendered.selectionPath },
  decodedFrames: 1650,
  durationSeconds: 55,
  slots: editPlan.slots,
  evidence: { inventory: inventory.inventoryPath, plan: editPlan.evidencePath, render: rendered.renderReportPath, verification: verdict.reportPath },
  unresolvedIssues: [],
  invocationFailures
};