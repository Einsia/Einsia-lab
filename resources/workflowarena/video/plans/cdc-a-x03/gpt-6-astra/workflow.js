export const meta = {
  name: "cdc-a-x03-evidence-based-assembly",
  description: "Inspect all 45 anonymous videos, choose seven complete clips using visible shot and continuity evidence, assemble them, and verify the exact deliverables.",
  phases: [
    {title: "Prepare visual inspection", detail: "Discover available tools and decode public inputs into indexed inspection materials."},
    {title: "Inventory candidates", detail: "Inspect every candidate in five independent batches without assigning identities from metadata."},
    {title: "Resolve seven slots", detail: "Compare close alternatives and reconcile the complete sequence against the established axis."},
    {title: "Assemble and verify", detail: "Build the three deliverables, audit visible selections and decoded frames, and repair concrete failures."}
  ]
};

const ROOT = "/workspace";
const ids = Array.from({length: 45}, (_, i) => String(i + 1).padStart(2, "0"));
const slots = [
  {slot: 1, title: "Establishing: two people in danger", requirements: "Establish the space and initial danger. Cold cyan mechanical space; suspended grated platform across frame, tall button wall and mist behind. Thin boy sprawled and struggling on FRAME LEFT; bald old man in dark coat on FRAME RIGHT, bending and looking toward him. Extreme wide with both small full figures. Side-on eye level, platform roughly parallel to bottom of frame. ONE continuous LOCKED-OFF shot."},
  {slot: 2, title: "First exchange: shot/reverse shot", requirements: "The two speak face to face for the first time. MOST of clip is profile CLOSE-UP of boy against PALE RIVETED METAL WALL, looking up and speaking several lines. THEN cut to SINGLE close-up of old man leaning forward and replying. Two near-eye-level profile / three-quarter singles forming shot/reverse shot, soft background, locked off. Match the established axis; these clips are silent, so infer speech only from visible performance."},
  {slot: 3, title: "Standoff in a closed room", requirements: "Dark-red room, silent tension through alternating singles. Exact shot order: opens MEDIUM CLOSE SINGLE OLD MAN, then MEDIUM SINGLE BOY, then CLOSE-UP OLD CANDLESTICK TELEPHONE, then BRIEF HIGH-ANGLE view down on OLD MAN, ending CLOSE SINGLE OLD MAN. Singles near-eye-level frontal three-quarters except specified high-angle. Essentially static."},
  {slot: 4, title: "Escalation: the receiver", requirements: "Opens DIRECTLY on boy WALKING toward old telephone in foreground and REACHING OUT. Then CUT to OVER-THE-SHOULDER past BACK OF BOY'S HEAD as old man reaches across, SNATCHES RECEIVER, holds it up TOWARD LENS. Medium-full boy then over-the-shoulder close. Low camera with telephone a large foreground block, then OTS reverse. Mostly static; action and cut supply change."},
  {slot: 5, title: "Restaging", requirements: "Warm brown hall with HUGE ARCHED GRILLE DOOR behind. Old man STARTS BACK TO CAMERA, then TURNS TO FACE IT. Boy WALKS INTO FRAME and STOPS BESIDE AND BEHIND him, forming foreground/background two-shot while they keep talking. Medium two-shot, old man foreground. Eye level, ONE CONTINUOUS LOCKED-OFF shot."},
  {slot: 6, title: "The escape begins: through the doorway", requirements: "Inside a door, HEAVY BLACK CURTAIN on one side and BRIGHT DOORWAY on other. Old man SQUEEZES IN FROM LIGHT and LOOKS AROUND WARILY; boy FOLLOWS CLOSE BEHIND. Medium to medium close as they come toward lens. Eye level from DARK INTERIOR FACING DOORWAY, STRONG BACKLIGHT. ONE CONTINUOUS LOCKED-OFF shot."},
  {slot: 7, title: "Escape: leaving the other behind", requirements: "Dim space with GREEN SHAFTS OF LIGHT. ONE CONTINUOUS shot OPENS with BOY STANDING AT EDGE OF PLATFORM and OLD MAN ALREADY ON NEARBY THIN TALL POST. Old man then HOPS POST TO POST AWAY FROM BOY, boy GRADUALLY LEAVES FRAME. FULL SHOT, eye level slightly low. Camera TRUCKS with old man IN DIRECTION OF HOPS."}
];
const contract = `Task CDC-A-X03. Future execution workspace: ${ROOT}. Read instruction.md and applicable local instructions using available worker tools. Public inputs are input/01.mp4 through input/45.mp4: anonymous silent H.264, 1280x720, SAR 1:1, 24fps, 6–12 seconds. Numbers are random; overlapping excerpts and similar pictures are deliberate. No network, GPU, video generation, hidden reference, or outside film lookup. CREDITS.md withholds attribution. Never infer identity or story order from filenames, hashes, size, credits, or film recognition. Inspect actual visible content. Only available worker tools may be used; do not assume a named image viewer, shell API, or package exists. Python 3.11, ffmpeg and ffprobe are advertised. If you cannot actually view video or decoded images with available tools, report the blocker instead of pretending visual inspection happened.
Choose seven DISTINCT candidates, one for each ordered slot, satisfying EVERY field. Use complete clips once at 1x, original orientation, no cropping/mirroring/visual filters/text/transitions/generated content/added or dropped frames. Preserve cuts inside sources; join only by hard cuts. Scratch and reports in work/. Only the three specified files belong in output/. Axis: slot 1 establishes boy frame-left / old man frame-right and the line between them. All later two-person relations, single-shot eyelines, and movement directions must remain consistent with that line. Evaluate actual staging and camera side, including restaging and depth, rather than mechanically equating any motion with an axis crossing. Record exact observations and uncertainty; never fix a wrong choice by editing or flipping it.
Deliverables: output/solution.mp4, H.264/yuv420p, 1280x720, SAR1:1, constant 24/1fps, no audio. Lossless concat or encode CRF <=18. output/solution.json exactly {"segments":[...]} with seven objects {slot,source:"NN",output_frames:[integerStart,integerEndExclusive],source_frames:[0,decodedFrameCount],output:[startSeconds,endSeconds]}. Contiguous integer half-open intervals from zero; seconds = frames/24 within .001; final end equals actual decoded output count. output/selection-evidence.json is seven objects {slot,source,frames:[a,b],reason}, with two valid zero-based frame numbers inside selected source. Each reason must name a concrete VISIBLE difference from the MOST SIMILAR OTHER candidate; explicitly identify that rival and substantiate the difference by inspecting it. Do not pad final evidence with unsupported claims. output/ must contain exactly these three files. Preserve inputs. Keep all logs, contact sheets, reports, temporary output and scripts in work/.
Ordered slot requirements:
${JSON.stringify(slots)}
`;

const str = {type: "string"};
const strings = {type: "array", items: str};
const int = {type: "integer"};
function obj(properties, required = Object.keys(properties)) {
  return {type: "object", properties, required, additionalProperties: false};
}
const sourceId = {type: "string", pattern: "^(0[1-9]|[1-3][0-9]|4[0-5])$"};
const framePair = {type: "array", items: {type: "integer", minimum: 0}, minItems: 2, maxItems: 2};
const preparedSchema = obj({
  ready: {type: "boolean"},
  root: str,
  manifest: str,
  inspectionGuide: str,
  viewingMethod: str,
  clips: {type: "array", items: obj({source: sourceId, frameCount: {type: "integer", minimum: 1}, contactSheets: strings, cutFrames: {type: "array", items: int}})},
  blockers: strings
});
const inventorySchema = obj({
  complete: {type: "boolean"},
  report: str,
  clips: {type: "array", items: obj({
    source: sourceId,
    inspected: {type: "boolean"},
    likelySlots: {type: "array", items: {type: "integer", minimum: 1, maximum: 7}},
    description: str,
    shotOrder: strings,
    axisObservations: str,
    discriminators: strings,
    uncertainties: strings
  })},
  blockers: strings
});
const matchSchema = obj({
  slot: {type: "integer", minimum: 1, maximum: 7},
  report: str,
  candidates: {type: "array", items: obj({
    source: sourceId,
    allSlotFieldsMatch: {type: "boolean"},
    observations: strings,
    mismatches: strings,
    axisObservations: str,
    frames: framePair,
    closestRival: sourceId,
    visibleDifference: str
  })},
  uncertainties: strings,
  blockers: strings
});
const selectionItem = obj({
  slot: {type: "integer", minimum: 1, maximum: 7},
  source: sourceId,
  frameCount: {type: "integer", minimum: 1},
  frames: framePair,
  reason: str,
  closestRival: sourceId,
  axisEvidence: str,
  fieldEvidence: strings
});
const selectionSchema = obj({
  ready: {type: "boolean"},
  selection: {type: "array", items: selectionItem},
  report: str,
  axisReport: str,
  unresolved: strings
});
const buildSchema = obj({
  built: {type: "boolean"},
  files: strings,
  report: str,
  encodingMethod: str,
  decodedFrames: {type: "integer", minimum: 0},
  blockers: strings
});
const issueSchema = obj({
  kind: {type: "string", enum: ["selection", "axis", "evidence", "encoding", "manifest", "packaging", "verification"]},
  slot: {type: "integer", minimum: 0, maximum: 7},
  detail: str,
  requiredAction: str
});
const auditSchema = obj({
  passed: {type: "boolean"},
  report: str,
  checks: strings,
  issues: {type: "array", items: issueSchema},
  blockers: strings
});
const events = [];
async function call(prompt, label, stage, schema) {
  try {
    const value = await agent(contract + "\nYOUR ASSIGNMENT:\n" + prompt, {label, phase: stage, schema});
    if (value === null) events.push({label, problem: "Worker returned null"});
    return value;
  } catch (error) {
    events.push({label, problem: String(error)});
    return null;
  }
}
function stop(reason, details = {}) {
  return {status: "unresolved", reason, ...details, events};
}

const prep = await call(
  `Prepare inspection materials ONLY; do not select clips or write deliverables. Locate task directory under ${ROOT}; inspect applicable instructions and tool capabilities. Confirm all 45 inputs and get actual decoded frame counts using ffprobe count_frames or an equivalent full decode, as well as dimensions, pixel format, SAR, frame rate, time base, durations, rotation metadata and codec information. Never substitute rounded duration*24 for decoded count. Save a machine-readable manifest in work/prep/. Investigate deviations rather than silently correcting source geometry.
Create indexed contact sheets covering EVERY source through the end, typically at 12-frame intervals plus exact first and last frame. Retain human-readable source ID and exact zero-based frame numbers on SCRATCH sheets only. Split sheets to keep subjects readable. Add cut-boundary samples for brief internal shots: scene-change detection can guide this but cannot establish shot identity or absence of cuts. Keep original full-resolution frames available on demand, with a documented extraction procedure that selects decoded frame indices without rotation, mirroring, or timestamp guesswork. Provide an index linking all source IDs to sheets and manifest. Check that a supported tool can actually expose decoded images to a worker; report that method. Avoid dumping thousands of frames or enormous logs. No internet or extra installed dependencies are needed. An observed visual-access blocker is fatal to content selection. Write an inspection guide documenting frame indexing and how workers can view finer temporal samples. Report ready only when input inventory and visual-inspection access are usable.`,
  "prepare-inputs", "Prepare visual inspection", preparedSchema
);
if (!prep || !prep.ready) return stop("Input preparation or visual access failed", {preparation: prep});
const prepById = new Map(prep.clips.map(c => [c.source, c]));
if (prep.clips.length !== 45 || prepById.size !== 45 || ids.some(id => !prepById.has(id))) {
  return stop("Preparation did not account for exactly all 45 sources", {preparation: prep});
}

const groups = Array.from({length: 5}, (_, i) => ids.slice(i * 9, (i + 1) * 9));
const inventories = await parallel(groups.map((group, index) => () => call(
  `Inspect these nine candidates visually: ${JSON.stringify(group)}. You own work/inventory/batch-${index + 1}/ only; prep materials are read-only. Preparation: ${JSON.stringify(prep)}.
Read the inspection guide and view contact sheets for EACH assigned source across its complete duration. Inspect denser frame sequences and full-resolution details where needed. Characterize each actual clip without forcing a slot match: room, opening and closing actions, exact internal shot order and approximate cut frame indices, shot sizes, angles, camera motion, character positions, gaze direction, direction of entry/exit/motion. Distinguish camera truck from character movement using stationary background landmarks across time. A single frame is insufficient evidence for locked-off motion or action order. For each likely slot, record all disqualifying details, such as wrong opening beat, wrong shot size, extra cut, missing brief insert, opposite orientation, different duration coverage or wrong pan/truck. Clips with no likely slot must still be inspected and described. Do not infer narrative order from input numbers. Save detailed observations with frame references to your report. Return exactly one entry for every assigned source, including explicit uninspected status if tools fail. No final output writes.`,
  `inventory-${index + 1}`, "Inventory candidates", inventorySchema
)));

let coverage = new Map();
for (let i = 0; i < inventories.length; i++) {
  const result = inventories[i];
  if (!result) continue;
  for (const clip of result.clips) if (groups[i].includes(clip.source) && clip.inspected) coverage.set(clip.source, clip);
}
const missing = ids.filter(id => !coverage.has(id));
if (missing.length) {
  const recovery = await call(
    `Recover missing visual inventory ONLY for ${JSON.stringify(missing)}. Prior workers have completed, so no concurrent edits. Read preparation ${JSON.stringify(prep)}. Inspect complete temporal sheets and refine as needed; use the same inventory obligations: actual setting, first/last beats, internal shot order, shot sizes, angles, camera motion, character positions/eyelines/movement, likely slots, concrete disqualifiers and uncertainties. Save work/inventory/recovery/. Do not label a clip inspected unless you saw it with available tools. Return one record per requested ID.`,
    "recover-inventory", "Inventory candidates", inventorySchema
  );
  inventories.push(recovery);
  if (recovery) for (const clip of recovery.clips) if (missing.includes(clip.source) && clip.inspected) coverage.set(clip.source, clip);
}
if (ids.some(id => !coverage.has(id))) return stop("Some candidates remain visually uninspected", {missing: ids.filter(id => !coverage.has(id)), inventories});
const catalog = ids.map(id => coverage.get(id));

const matches = await parallel(slots.map(slot => () => call(
  `Resolve the candidate set for SLOT ${slot.slot}: ${JSON.stringify(slot)}. Read-only inputs/prep/inventories, and write only work/slots/slot-${slot.slot}/. Preparation: ${JSON.stringify(prep)}. Complete visual inventory of all 45: ${JSON.stringify(catalog)}. Inventory reports: ${JSON.stringify(inventories.filter(Boolean).map(x => x.report))}.
Use the inventory as navigation, not proof. Review the global contact-sheet index to catch a relevant candidate that an inventory worker missed. Inspect all plausible matches and their lookalikes from actual frames, including opening/closing portions and every internal cut. For continuous-shot slots, use temporal image sequences or available playback to check camera behavior and absence of cuts; for multi-shot slots check the full exact shot order. Compare the closest alternatives SIDE BY SIDE at meaningful frames. Beware nearly identical overlapping excerpts that begin or end differently and mirrored or opposing-axis lookalikes. Record every slot field, any mismatch, exact zero-based evidence frame pair inside each serious proposed source, and concrete axis observations. For the strongest candidate identify the MOST SIMILAR OTHER source from all candidates, give its ID, and state a concrete visible difference with inspected frame references in your report. Do not claim uniqueness without inspecting close rivals. Return ranked serious candidates including rejected nearest alternatives, with allSlotFieldsMatch true only if every field was actually verified. Axis is provisional until the actual slot-1 choice is known. If no candidate fits, document the conflict instead of inventing a selection. Do not render or write output/.`,
  `resolve-slot-${slot.slot}`, "Resolve seven slots", matchSchema
)));

function selectionErrors(value) {
  if (!value || !value.ready) return ["Selection worker did not establish a ready selection"];
  const errors = [];
  if (value.selection.length !== 7) errors.push("Selection does not have seven items");
  const ordered = [...value.selection].sort((a, b) => a.slot - b.slot);
  if (new Set(ordered.map(x => x.source)).size !== 7) errors.push("Sources are not seven distinct candidates");
  ordered.forEach((x, i) => {
    if (x.slot !== i + 1) errors.push("Slot coverage/order invalid");
    const p = prepById.get(x.source);
    if (!p || p.frameCount !== x.frameCount) errors.push(`Slot ${x.slot}: source frame count differs from preparation`);
    if (x.closestRival === x.source) errors.push(`Slot ${x.slot}: rival equals chosen source`);
    if (x.frames[0] === x.frames[1] || x.frames.some(f => f < 0 || f >= x.frameCount)) errors.push(`Slot ${x.slot}: evidence frames invalid or identical`);
    if (!x.reason.trim() || !x.axisEvidence.trim() || !x.fieldEvidence.length) errors.push(`Slot ${x.slot}: evidence incomplete`);
  });
  if (value.unresolved.length) errors.push("Selection has unresolved issues");
  return errors;
}

async function resolveSelection(prior, feedback, label) {
  return await call(
    `Act as the sequence editor responsible for an evidence-supported COMPLETE selection. All other workers are finished with their inspection writes. You own work/selection/; no output writes. Preparation: ${JSON.stringify(prep)}. Catalog of every input: ${JSON.stringify(catalog)}. Slot research: ${JSON.stringify(matches)}. Prior proposed selection: ${JSON.stringify(prior)}. Feedback to resolve: ${JSON.stringify(feedback)}.
Read the reports, view the actual proposed clips and closest alternatives. Missing slot-research results are NOT an automatic veto: perform that slot's inspection yourself using the complete catalog and actual media, or explicitly report unresolved. Choose slot 1 first, confirming actual boy-left/old-man-right in the wide continuous mechanical-space shot. Establish an axis ledger from that concrete source. Then reconcile all remaining slots against that axis using actual left/right relations, single-shot eyelines, entry/exit and travel vectors, depth and lawful visible restaging. Inspect all internal cuts for crossings. Do not redefine the established axis to excuse a wrong candidate. If orientation is ambiguous, inspect more frames and corresponding rivals. Do not mirror, trim or otherwise repair a source.
Require seven distinct full candidates and every shot-list field. Resolve disagreements through observed footage, not voting. Independently compare each final choice with its most similar OTHER candidate across the whole pool; validate two distinct chosen-source frame indices and a reason naming that rival and a concrete visible difference. The reason must describe content, staging, motion, framing, orientation or actual opening/closing beats, rather than only filenames, metadata or duration. Save detailed slot-field and global-axis evidence, including relevant rival frames, in work/selection/. Return exactly seven entries in slot order when ready. frameCount must be actual decoded count from preparation, unless a documented recount corrects it; if preparation is wrong report the conflict rather than quietly changing the return. Unresolved visual contradictions must be reported explicitly; do not assert readiness to satisfy the schema.`,
    label, "Resolve seven slots", selectionSchema
  );
}
let selection = await resolveSelection(null, [], "reconcile-selection");
let selectionProblems = selectionErrors(selection);
if (selectionProblems.length) {
  selection = await resolveSelection(selection, selectionProblems, "resolve-selection-gaps");
  selectionProblems = selectionErrors(selection);
}
if (selectionProblems.length) return stop("A complete evidence-supported selection could not be established", {selection, issues: selectionProblems, slotResearch: matches});
selection.selection.sort((a, b) => a.slot - b.slot);

async function build(chosen, priorIssues, label) {
  const segments = [];
  let end = 0;
  for (const s of chosen.selection) {
    const start = end;
    end += s.frameCount;
    segments.push({slot: s.slot, source: s.source, output_frames: [start, end], source_frames: [0, s.frameCount], output: [start / 24, end / 24]});
  }
  const evidence = chosen.selection.map(s => ({slot: s.slot, source: s.source, frames: s.frames, reason: s.reason}));
  return await call(
    `Build the deliverables for the LOCKED selection below. You are sole output writer. Read preparation ${JSON.stringify(prep)} and selection reports ${JSON.stringify({report: chosen.report, axisReport: chosen.axisReport})}. Exact solution.json payload: ${JSON.stringify({segments})}. Exact selection-evidence.json payload: ${JSON.stringify(evidence)}. Prior technical issues to address: ${JSON.stringify(priorIssues)}.
Do not change the selected sources or evidence. Preserve every decoded source frame exactly once, in source order and slot order, at 24fps. Prefer a reliable lossless route. A stream-copy concat is acceptable only if codec configuration and timestamps are compatible and complete decoded-frame equality and timing verify. Otherwise encode using libx264 at CRF 0 with yuv420p (which satisfies CRF <=18). A robust fallback is sequentially decoding complete selected videos to native yuv420p raw frames, feeding those frames in order to one H.264 encoder at input rate 24/1, setting SAR1:1 metadata without altering image content. Use this only after checking native decoded format and geometry. Do not apply scale, fps, trim, setpts tricks that add/drop frames, orientation transforms, or visual filters. Disable implicit autorotation if needed to retain original orientation. Restrict mapping to video, no audio, and avoid accidental subtitle/data streams. Do not rely on MP4 duration fields to compute counts or boundaries.
Write temporary renders and logs under work/build/, then publish completed files under output/. Reuse existing correct output if a prior attempt succeeded; repair actual defects. Use deterministic Python JSON writing for supplied payloads. Fully decode the finished MP4 and check frame count, continuous timestamps starting from zero with 1/24 steps, H.264, yuv420p, width/height, SAR, no audio. Save the exact command/script used, encoder settings and verification logs under work/build/. Compare decoded frame hashes of the concatenated selected sources and output whenever encoding is lossless; if stream copy fails equality or timing, use verified CRF0 encoding. No silent duplicates or omissions, especially around internal and inter-clip boundaries. Keep output/ exactly the three required files; relocate incidental scratch files from this task into work/ rather than removing unrelated user material blindly. Report incomplete or unavailable operations honestly.`,
    label, "Assemble and verify", buildSchema
  );
}

async function auditVisual(chosen, buildResult, label) {
  return await call(
    `Perform a READ-ONLY visual acceptance review of the current selection AND assembled output. You own work/review/visual/ only. Do not edit output or preparation. Inspect instruction.md and actual footage with available visual tools. Preparation: ${JSON.stringify(prep)}. All-source inventory: ${JSON.stringify(catalog)}. Selection and justifications (claims to verify): ${JSON.stringify(chosen)}. Build: ${JSON.stringify(buildResult)}.
Check all seven slots field by field against the actual complete sources, including first/last beats, each internal shot and camera motion over time. Inspect enough complete temporal material to verify continuity, not only the two submitted evidence frames. Check the global 180-degree axis established by boy-left/old-man-right in slot1; track singles' eyelines, two-person staging and movement, including restaging, depth and every cut. Compare all plausible close rivals, using inventory only to navigate; challenge any wrong most-similar-rival claim and any unsupported evidence reason. View the two submitted evidence frames for each slot and relevant rival frames. Check that the output visually follows the proposed order, shows whole clips at boundaries, and has no added graphics/transforms/transitions. Mechanical frame equality is separately audited, so focus on content, action, camera language and axis. Record observations with exact source and frame references. passed=true requires all requested visible requirements actually checked, not merely agreement with earlier workers. Report every unresolved ambiguity and access failure as an issue or blocker. Classify issues as selection, axis, evidence, encoding, manifest, packaging or verification; slot 0 denotes a global issue.`,
    label, "Assemble and verify", auditSchema
  );
}
async function auditTechnical(chosen, buildResult, label) {
  return await call(
    `Perform a READ-ONLY independent technical verification of current output/. You own work/review/technical/ only. Selection: ${JSON.stringify(chosen)}. Build report to VERIFY independently: ${JSON.stringify(buildResult)}. Preparation: ${JSON.stringify(prep)}.
Check output contains EXACTLY solution.mp4, solution.json, selection-evidence.json, all regular usable files. Parse JSON and assert exact deliverable shapes/types, seven ordered slots 1..7, seven distinct valid two-digit sources, agreement with locked selection, contiguous integer half-open output frames from zero, source_frames [0,ACTUAL fully decoded source count], seconds within .001 of frames/24, final end equal actual fully decoded output count. Check each evidence pair has two in-range source indices, source/slot consistency, and reason exists; visual truth is separately audited. Independently decode whole output and verify H.264/yuv420p, 1280x720, SAR1:1, no audio or extraneous media streams, 24/1 constant presentation cadence, correct duration and normal playback speed, no decode errors, no rotation transform. Use presentation-order decoded frames and timestamps, not packet order or an unverified nb_frames metadata value.
Verify EVERY decoded output frame against the declared corresponding source frame. For lossless copy/CRF0 use pixel hashes of native yuv420p decoded planes, ignoring irrelevant container metadata. Require exact sequence equality and counts, which also detects drops, duplicates, reordered frames, unwanted transforms and partial clips. If a lossy CRF<=18 render was used, inspect actual encoder command/settings and perform aligned full-frame comparisons with a documented justified tolerance and boundary inspection; never accept weak aggregate similarity alone or compare encoded packet hashes. Prefer requesting a CRF0 rebuild for an ambiguous mismatch, since that permits an exact audit. Record separately all verified properties and actual counts, timing evidence, equality result, first failing frame if any, and commands used. Do not infer success from a worker's built flag. passed=true requires all checks performed and passing.`,
    label, "Assemble and verify", auditSchema
  );
}

let rendered = await build(selection, [], "build-deliverables");
if (!rendered || !rendered.built) {
  rendered = await build(selection, [{detail: "Prior build failed or returned missing data", prior: rendered}], "recover-build");
}
if (!rendered || !rendered.built) return stop("Rendering or deliverable writing failed", {selection, build: rendered});

let reviews = await parallel([
  () => auditVisual(selection, rendered, "visual-acceptance"),
  () => auditTechnical(selection, rendered, "technical-acceptance")
]);
function goodReview(r) { return !!r && r.passed && r.issues.length === 0 && r.blockers.length === 0; }
const auditHistory = [{round: 0, reviews}];
// Two targeted repair rounds bound expenditure within the hypothetical one-hour task budget.
// A repair is dispatched only for observed defects or missing verification, never to fill a stage count.
for (let round = 1; round <= 2 && !reviews.every(goodReview); round++) {
  const issues = reviews.filter(Boolean).flatMap(r => r.issues);
  const contentIssues = issues.filter(i => ["selection", "axis", "evidence"].includes(i.kind));
  let changedSelection = false;
  if (contentIssues.length) {
    const revised = await resolveSelection(selection, {issues: contentIssues, reviews}, `repair-selection-${round}`);
    const problems = selectionErrors(revised);
    if (problems.length) return stop("Visual review found unresolved selection or continuity problems", {selection: revised, problems, reviews, auditHistory, build: rendered});
    revised.selection.sort((a, b) => a.slot - b.slot);
    changedSelection = JSON.stringify(selection.selection) !== JSON.stringify(revised.selection);
    selection = revised;
  }
  const technicalIssues = issues.filter(i => ["encoding", "manifest", "packaging"].includes(i.kind));
  if (changedSelection || technicalIssues.length) {
    rendered = await build(selection, technicalIssues, `repair-deliverables-${round}`);
    if (!rendered || !rendered.built) return stop("Deliverable repair failed", {selection, build: rendered, reviews, auditHistory});
    // Any output rewrite invalidates both prior reviews, even if the source IDs stayed the same.
    reviews = await parallel([
      () => auditVisual(selection, rendered, `visual-recheck-${round}`),
      () => auditTechnical(selection, rendered, `technical-recheck-${round}`)
    ]);
  } else {
    // A missing or inconclusive review is not a pass. Reinspect only the unsuccessful side.
    const previous = reviews;
    reviews = await parallel([
      () => goodReview(previous[0]) ? Promise.resolve(previous[0]) : auditVisual(selection, rendered, `visual-evidence-recovery-${round}`),
      () => goodReview(previous[1]) ? Promise.resolve(previous[1]) : auditTechnical(selection, rendered, `technical-evidence-recovery-${round}`)
    ]);
  }
  auditHistory.push({round, reviews});
}
if (!reviews.every(goodReview)) return stop("Deliverables exist but required acceptance checks remain unresolved", {files: rendered.files, selection, build: rendered, reviews, auditHistory});
return {
  status: "verified",
  files: ["output/solution.mp4", "output/solution.json", "output/selection-evidence.json"],
  selectedSources: selection.selection.map(s => ({slot: s.slot, source: s.source})),
  decodedFrames: selection.selection.reduce((sum, s) => sum + s.frameCount, 0),
  verification: {visual: reviews[0], technical: reviews[1]},
  reports: {selection: selection.report, axis: selection.axisReport, build: rendered.report},
  unresolved: [],
  events
};