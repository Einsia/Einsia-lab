export const meta = {
  name: "cdc-a-x02-evidence-led-edit",
  description: "Inspect all 42 anonymous candidates, select six exact visual matches, assemble the specified J-cut, and verify the three deliverables against decoded sources.",
  phases: [
    {title: "Inspect public inputs", detail: "Inventory media and inspect every candidate without inferring identities from filenames or metadata."},
    {title: "Select and distinguish", detail: "Match every slot criterion and compare each choice with its closest alternative."},
    {title: "Assemble", detail: "Build independent frame-exact picture and sound timelines and render once to the required formats."},
    {title: "Verify and repair", detail: "Check visual selection, all decoded picture frames, audio timing, EDL, and evidence; repair concrete defects."}
  ]
};

const ROOT = "/workspace";
const ids = Array.from({length: 42}, (_, i) => String(i + 1).padStart(2, "0"));
const slots = [
  {slot: 1, narrative: "The starting point of grief; sunk in loss", criteria: ["Single shot of a young red-haired woman against tangled tree roots", "At the start her head is bowed and her hair hides her face", "She slowly lifts her face; her gaze first falls downward, then turns to SCREEN RIGHT and remains there until the end", "Close shot, head and shoulders", "Front three-quarter, slightly above eye level", "Locked camera; all change comes from the character"]},
  {slot: 2, narrative: "Memory: warmth of meeting", criteria: ["Low-angle medium shot: a small winged creature stands on a wooden beam, opens its wings, then folds them", "Cut to a smiling close shot of the woman, eye level, against a bright timber-roof background", "Cut back to the creature CROUCHED QUIETLY on the beam while a flock of birds crosses the sky; ends on this image", "Locked camera"]},
  {slot: 3, narrative: "Memory: peak of joy", criteria: ["High ground at sunset: woman starts walking from beside a stone pillar TOWARD the camera", "Once close, she cups her hands around her mouth and calls out", "Cut to a RUN of hard-backlit images of her silhouette with small flying dragons circling around her; ends inside the backlit images", "Full shot walking into medium close-up; full and medium backlit shots", "Eye level or slightly below", "Calling shot locked; camera moves with her in backlit images"]},
  {slot: 4, narrative: "Memory: loss", criteria: ["Small winged creature glides ALONE in a pink-orange sky", "Huge dragon's head dives into frame FROM THE TOP", "Cut wider: dragon sweeps over rooftops", "Over woman's back: she reaches out, dragon's claws seize small creature, then her horrified face", "Cut to small creature carried off in dragon's grip with woman's OPEN HAND IN FOREGROUND reaching after it; ends on this image", "Medium sky shot, long roof shot, over-shoulder medium, foreground-hand close shot", "Mostly low angle, including over-shoulder view", "Pans and tracks following flyers; fast pacing"]},
  {slot: 5, narrative: "Return to present: stillness of grief", criteria: ["One single extreme long shot of a barren high cliff throughout", "Woman sits ALONE at the edge, small in frame, misty mountains behind", "Eye level and SIDE-ON", "Locked camera, almost no movement in frame"]},
  {slot: 6, narrative: "Release and departure; J-cut entry", criteria: ["One single locked ground-level low shot; white SNOWDROP flowers in RIGHT foreground", "Starts with ONLY foreground flowers and small distant woman WALKING AWAY", "Midway small winged creature flies in LOW FROM LEFT, lands, pauses, turns its BACK to camera, and CRAWLS AWAY into distance", "Ends while creature is STILL CRAWLING AWAY", "Long shot with foreground flowers in close shot"]}
];
const context = `Task CDC-A-X02. Read instruction.md and applicable workspace instructions using available tools. The task directory is /workspace; inputs are input/01.mp4 through input/42.mp4. No network. Python 3.11 and FFmpeg/ffprobe are described as available, CPU only; discover actual worker tools rather than assuming an integration. All drafts, scripts, extracted images, logs and reports belong under work/. Only final sequence.mp4, edl.json, and selection-evidence.json belong in output/. Preserve original inputs. Numbering is random. Neither filenames, byte sizes, credits nor memory of a film identifies a correct candidate. All selections and distinctions must be based on observed candidate imagery. Do not look for hidden reference selections or evaluator data. No generative content. If no tool can view actual video or extracted images, explicitly report that limitation; pixel statistics alone cannot establish narrative content. Workers share files; write only assigned paths and read other workers' completed artifacts. Original task: six distinct candidates in fixed slot order, every criterion must match. Use each full clip at original resolution, direction and 1x speed, preserving internal cuts; only slot 6 picture omits source frames [0,24). No crop, scale, mirror, grade, titles, transitions, frame additions or frame drops in final media. Straight cuts. Only original frame-synchronous production sound, no fades/crossfades. Slot 6 sound from source frame 0 replaces last 24 frames of slot 5 sound; slot 5 picture stays complete, slot 6 picture begins at source frame 24. All other sound cuts straight. Output H.264/yuv420p 1280x544 SAR1:1 CFR24/1, CRF<=18 or lossless concatenation; one AAC-LC stereo 48000Hz track. A/V duration discrepancy <=1 frame. EDL intervals are half-open integer 24fps frames. Evidence has six {slot,source,source_frames:[a,b],reason} objects; each interval inside its source and >=12 frames, and reason names a concrete visible difference from the most similar other candidate. No unsupported claims of successful inspection or verification.\nOrdered slot criteria:\n` + JSON.stringify(slots);

const obj = (properties, required = Object.keys(properties)) => ({type: "object", properties, required, additionalProperties: false});
const str = {type: "string"};
const integer = {type: "integer"};
const bool = {type: "boolean"};
const strings = {type: "array", items: str};
const pair = {type: "array", items: {type: "integer", minimum: 0}, minItems: 2, maxItems: 2};
const sourceId = {type: "string", enum: ids};
const candidateSchema = obj({source: sourceId, path: str, decodedFrames: {type: "integer", minimum: 1}, probePath: str, inspectionIndexPath: str, mediaIssues: strings});
const inventorySchema = obj({ready: bool, taskRoot: str, candidates: {type: "array", items: candidateSchema}, manifestPath: str, availableViewingMethod: str, issues: strings});
const catalogEntrySchema = obj({source: sourceId, inspected: bool, observationPath: str, likelySlots: {type: "array", items: {type: "integer", minimum: 1, maximum: 6}}, opening: str, orderedEvents: strings, ending: str, framingAngleCamera: str, discriminatingDetails: strings, uncertainDetails: strings});
const catalogSchema = obj({complete: bool, entries: {type: "array", items: catalogEntrySchema}, issues: strings});
const selectionSchema = obj({slot: {type: "integer", minimum: 1, maximum: 6}, source: sourceId, allCriteriaMatched: bool, criteriaEvidence: {type: "array", items: obj({criterion: str, observed: str, sourceFrames: pair, matched: bool})}, closestAlternative: sourceId, alternativeComparison: str, evidenceFrames: pair, evidenceReason: str, observationPath: str, unresolved: strings});
const choicesSchema = obj({ready: bool, selections: {type: "array", items: selectionSchema, minItems: 6, maxItems: 6}, issues: strings});
const renderSchema = obj({completed: bool, paths: strings, renderLogPath: str, buildReportPath: str, decodedOutputFrames: {type: "integer", minimum: 0}, issues: strings});
const reviewSchema = obj({passed: bool, checks: {type: "array", items: obj({name: str, passed: bool, evidence: str})}, issues: strings, reportPath: str});

async function call(prompt, options) {
  try {
    const value = await agent(context + "\n\nASSIGNMENT:\n" + prompt, options);
    if (value === null || value === undefined) return {ok: false, error: "Worker returned no result", label: options.label};
    return {ok: true, value};
  } catch (error) {
    return {ok: false, error: String(error), label: options.label};
  }
}
function stop(stage, issues, artifacts = {}) { return {status: "unresolved", stage, issues, ...artifacts}; }
function usableReview(result) {
  return !!(result && result.ok && result.value.passed && result.value.issues.length === 0 && result.value.checks.length > 0 && result.value.checks.every(c => c.passed));
}

const inventoryResult = await call(
  `Discover the task workspace and public instructions. Inventory all 42 inputs; do not choose clips. Use ffprobe plus actual decoding to obtain exact video frame counts and inspect time bases, PTS, dimensions, pixel format, fps, SAR, audio format, start times, decoded sample availability and AAC skip/padding behavior. Do not rely on rounded container duration to infer frame count. Save machine-readable manifest to work/inventory/manifest.json and individual probes under work/inventory/. Report any source anomalies and whether source frame 0 and decoded audio time 0 share an origin. Establish an available visual viewing method. Make efficient, labeled inspection assets under work/inspection/NN/: chronological contact sheets sampling the entire clip every 12 frames, explicitly including first/last frames, plus a manifest mapping each thumbnail to exact original frame index. Extra cut-adjacent samples are useful if cheap. Thumbnails may be resized solely for inspection; the output video may not. Keep each sheet legible and split sheets as needed. These assets support later observers; sparse samples alone do not establish motion direction or brief events. Record links/paths so observers can fetch native-resolution frames, dense strips or play original clips when necessary. Prepare directories only; do not render output. Confirm all 42 files are present and decodable. If visual tools are missing, say so without pretending to have viewed images. Return ready only when all inputs can be inspected and media facts are available.`,
  {label: "inventory-and-inspection-assets", phase: "Inspect public inputs", schema: inventorySchema}
);
if (!inventoryResult.ok) return stop("inventory", [inventoryResult.error]);
const inventory = inventoryResult.value;
const inventoryIds = inventory.candidates.map(c => c.source);
if (!inventory.ready || inventory.taskRoot !== ROOT || ids.some(id => !inventoryIds.includes(id)) || new Set(inventoryIds).size !== 42 || inventoryIds.length !== 42) {
  return stop("inventory", inventory.issues.concat(["Require a complete inspectable inventory of exactly 42 candidates at /workspace"]), {inventory});
}
const frameCounts = Object.fromEntries(inventory.candidates.map(c => [c.source, c.decodedFrames]));
const groups = Array.from({length: 6}, (_, i) => ids.slice(i * 7, i * 7 + 7));
const catalogs = await parallel(groups.map((group, index) => () => call(
  `Inspect every candidate in this assigned group: ${JSON.stringify(group)}. Read work/inventory/manifest.json and corresponding inspection indexes. You own only work/catalog/batch-${index + 1}/. For each clip view chronological imagery over its entire span, first/last states, and all internal cuts. Use full playback if available, otherwise sufficiently dense sequential frames; inspect native-resolution detail when small subjects, gaze, flowers or gesture are ambiguous. Explicitly verify movement order/direction, camera motion versus character motion, entry/exit states, and final held image. For near matches, refine to every frame or dense short strips around decisive action. Produce a factual catalog of observations, likely slots, and explicit mismatches/uncertainties. Include candidates that fit no slot. Do not pick one candidate solely because it resembles the story. Do not infer direction from a single still. Map each observation to frame intervals in your saved report; image paths should be usable by later selectors. Return one entry for each of your seven inputs.\nInventory records:\n` + JSON.stringify(inventory.candidates.filter(c => group.includes(c.source))),
  {label: `catalog-${index + 1}`, phase: "Inspect public inputs", schema: catalogSchema}
)));
const catalogFailures = [];
const catalog = [];
for (let i = 0; i < catalogs.length; i++) {
  const result = catalogs[i];
  if (!result || !result.ok) { catalogFailures.push({group: groups[i], issue: result?.error || "Missing catalog result"}); continue; }
  const entries = result.value.entries;
  if (!result.value.complete || entries.length !== groups[i].length || new Set(entries.map(e => e.source)).size !== groups[i].length || groups[i].some(id => !entries.some(e => e.source === id && e.inspected))) {
    catalogFailures.push({group: groups[i], issue: "Incomplete actual inspection", details: result.value.issues});
  }
  catalog.push(...entries);
}
if (catalogFailures.length) return stop("candidate-inspection", catalogFailures, {inventoryPath: inventory.manifestPath, catalog});
catalog.sort((a, b) => a.source.localeCompare(b.source));

const selectionResults = await parallel(slots.map(slot => () => call(
  `Select the exact match for SLOT ${slot.slot}. Own only work/selection/slot-${slot.slot}/. Consult the complete 42-candidate catalog below, including entries with uncertain or no likely-slot assignments, then directly view the viable candidates; catalog conclusions are leads, not proof. Compare all near alternatives, choosing the most visually similar rejected candidate by observed content, not by number or file size. Rewatch the chosen source in full and inspect exact start/end states, internal cuts and movement. Verify every criterion individually with a source frame interval; unresolved or contradicted criteria mean allCriteriaMatched=false. Record the closest alternative's concrete differing visible action, direction, framing or endpoint and its supporting frames in the saved report. The evidenceReason must explicitly name alternative NN and one concrete visible difference, with evidenceFrames an in-bounds half-open interval of >=12 frames in the CHOSEN source showing that distinction. The reason may cite additional precise chosen/alternative frame ranges in prose. For slot 6, establish the original full-clip opening too; assembly will later omit its first 24 picture frames. Do not trim sources to make a candidate fit. If two candidates cannot be distinguished, state that rather than guessing.\nTarget:\n${JSON.stringify(slot)}\nComplete catalog:\n${JSON.stringify(catalog)}\nInventory:\n${JSON.stringify(inventory)}`,
  {label: `select-slot-${slot.slot}`, phase: "Select and distinguish", schema: selectionSchema}
)));
if (selectionResults.some(r => !r || !r.ok)) return stop("slot-selection", selectionResults.filter(r => !r || !r.ok), {catalog});
let choices = selectionResults.map(r => r.value).sort((a, b) => a.slot - b.slot);
function selectionIssues(items) {
  const issues = [];
  if (items.length !== 6) issues.push("Exactly six selections required");
  if (new Set(items.map(s => s.source)).size !== 6) issues.push("Chosen sources must all be distinct");
  for (let i = 0; i < 6; i++) {
    const choice = items.find(c => c.slot === i + 1);
    if (!choice) { issues.push(`Missing slot ${i + 1}`); continue; }
    const n = frameCounts[choice.source];
    if (!choice.allCriteriaMatched || choice.unresolved.length || choice.criteriaEvidence.length < slots[i].criteria.length || choice.criteriaEvidence.some(e => !e.matched || e.sourceFrames[0] >= e.sourceFrames[1] || e.sourceFrames[1] > n)) issues.push(`Slot ${i + 1} has incomplete or uncertain criterion evidence`);
    if (choice.source === choice.closestAlternative) issues.push(`Slot ${i + 1} lacks a distinct closest alternative`);
    if (!choice.evidenceReason.trim() || !choice.alternativeComparison.trim() || choice.evidenceFrames[1] - choice.evidenceFrames[0] < 12 || choice.evidenceFrames[1] > n) issues.push(`Slot ${i + 1} evidence is invalid`);
    if ((i === 4 || i === 5) && n <= 24) issues.push(`Slot ${i + 1} cannot support the 24-frame J-cut`);
  }
  return issues;
}
let choiceIssues = selectionIssues(choices);
async function adjudicate(currentChoices, issues, label) {
  return call(
    `Resolve only the concrete selection/evidence issues below by direct visual comparison of original candidates. You own work/selection/adjudication/ and must not edit output/. Read existing observation reports and inspect additional frames/full clips as necessary. Check all six choices remain distinct and each slot meets every criterion. Do not mechanically force uniqueness or invent distinctions. Return all six complete selections in slot order, retaining sound findings. Return ready=false with unresolved issues if no evidence-based resolution is possible.\nIssues:\n${JSON.stringify(issues)}\nExisting choices:\n${JSON.stringify(currentChoices)}\nComplete catalog:\n${JSON.stringify(catalog)}\nInventory:\n${JSON.stringify(inventory)}`,
    {label, phase: "Select and distinguish", schema: choicesSchema}
  );
}
if (choiceIssues.length) {
  const resolution = await adjudicate(choices, choiceIssues, "resolve-selection-ambiguities");
  if (!resolution.ok || !resolution.value.ready) return stop("selection-resolution", resolution.ok ? resolution.value.issues : [resolution.error], {choices, choiceIssues});
  choices = resolution.value.selections.sort((a, b) => a.slot - b.slot);
  choiceIssues = selectionIssues(choices);
  if (choiceIssues.length) return stop("selection-resolution", choiceIssues, {choices});
}

function buildPlan(selections) {
  let p = 0;
  const segments = selections.map((choice, i) => {
    const n = frameCounts[choice.source];
    const pictureStart = i === 5 ? 24 : 0;
    const pictureEnd = p + n - pictureStart;
    const segment = {slot: i + 1, source: choice.source, picture: {output_frames: [p, pictureEnd], source_frames: [pictureStart, n]}, sound: {output_frames: i === 5 ? [p - 24, pictureEnd] : [p, pictureEnd - (i === 4 ? 24 : 0)], source_frames: [0, n - (i === 4 ? 24 : 0)]}};
    p = pictureEnd;
    return segment;
  });
  for (const track of ["picture", "sound"]) {
    let end = 0;
    for (const s of segments) {
      const part = s[track];
      if (part.output_frames[0] !== end || part.output_frames[1] <= end || part.output_frames[1] - part.output_frames[0] !== part.source_frames[1] - part.source_frames[0]) throw new Error(`Invalid ${track} timeline`);
      end = part.output_frames[1];
    }
    if (end !== p) throw new Error("Unequal track lengths");
  }
  return {edl: {segments}, evidence: selections.map(c => ({slot: c.slot, source: c.source, source_frames: c.evidenceFrames, reason: c.evidenceReason})), totalFrames: p, totalSamples: p * 2000};
}
let plan = buildPlan(choices);
async function render(planToBuild, revision, technicalIssues) {
  return call(
    `You are the sole deliverable writer. Build the three final files from the exact approved plan below, using original inputs and frame-exact trims. You own work/build/ and output/. First inspect existing output contents; preserve unrelated existing material outside output rather than silently deleting it. Write temporary renders and scripts under work/build/, and publish only valid completed files. Write edl.json and selection-evidence.json with exactly the supplied payloads; do not add metadata fields. Use decoded source frame counts, not duration rounding. Assemble video independently from audio: pictures are full sources in slots 1-5 and source [24,N6) for slot 6. Video trim=start_frame/end_frame and normalized timestamps (e.g. setpts=N/(24*TB)) should preserve every intended decoded frame. No image-changing filters; no automatic frame duplication/dropping. Do not use keyframe seeking or stream-copy cuts that could retain/drop wrong frames. Prefer one libx264 CRF 16-18 re-encode, yuv420p, original 1280x544 and SAR1:1, CFR24. Keep CPU thread usage reasonable.\nAudio is a separate sample-exact timeline at 48kHz stereo: 2000 samples per video frame. Decode source AAC respecting codec priming, edit lists, time origin and skip/discard metadata. Slots 1-4 use production PCM aligned to source frame 0 through Ni*2000; slot 5 uses [0,(N5-24)*2000); slot 6 uses [0,N6*2000). Concatenate these PCM portions WITHOUT gaps, overlap, fades or mixing; reset timestamps as appropriate, encode AAC-LC ONCE. This makes slot 6 source [0,24) audible over slot 5's last 24 picture frames; when its picture begins at frame 24 its audio is also at source frame 24. Do not merely shift all slot 6 audio while keeping its picture from source 0. Avoid concat filter's implicit longest-stream audio padding by constructing video and audio separately. Do not use -shortest to hide timing errors, synthesize silence or time-stretch. If source decoded audio cannot cover a required source interval, investigate timestamp/codec padding before claiming a solution; report a genuine incompatibility rather than silently adding audio. Account for final AAC encoder delay/padding in MP4 presentation metadata. Preserve original sound levels and channels.\nRun basic decode and structural checks before publishing: expected video frames, PTS spacing, dimensions, SAR, profile, sample rate and channels, exactly one video/one audio stream, both timeline ends within one frame. Save full reproducible command/script, selected sources/counts, PCM construction provenance and logs under work/build/. No extras in output/. On repairs, inspect the named issues and correct their cause; do not weaken validation.\nRevision: ${revision}\nTechnical issues from prior validation: ${JSON.stringify(technicalIssues)}\nInventory: ${JSON.stringify(inventory)}\nCanonical plan: ${JSON.stringify(planToBuild)}`,
    {label: `render-${revision}`, phase: "Assemble", schema: renderSchema}
  );
}

async function verify(planToCheck, currentChoices, revision, renderInfo) {
  return parallel([
    () => call(
      `Independently verify the actual three deliverables, read-only for output/. Own work/verification/technical-${revision}/. Do not trust renderer's success flag. Use original sources, supplied canonical plan and independent decoding. Required checks: (1) output contains exactly sequence.mp4, edl.json, selection-evidence.json; schemas and exact required keys/order/source strings, distinct candidates, in-range half-open intervals, evidence >=12 frames. Compare both JSONs to plan. (2) Derive frame counts independently and check full source use in slots 1-5, slot6 picture [24,N6), sound slot5 [0,N5-24), sound slot6 [0,N6), all interval lengths equal and each track contiguous from zero. (3) Decode entire output, check actual frame count equals final picture end, every frame timestamp progresses by 1/24, H264 yuv420p1280x544 SAR1:1 constant24/1; exactly one AAC-LC stereo48kHz audio stream. Inspect presentation duration and decoded audio with codec delay/padding accounted for; difference <=1 frame. (4) Compare EVERY decoded output video frame against the source frame mapped by EDL. Lossy encoding means hashes cannot match; use per-frame pixel error/PSNR/SSIM or available equivalent and inspect outliers and boundaries. Check whether neighboring source indices match better where meaningful to detect off-by-one, duplicate or dropped frames; static identical frames need timestamp/count evidence. Verify no scaling/crop/flip/grade and internal cuts unchanged. (5) Reconstruct expected PCM directly from originals using independent sample indices and compare decoded output audio window-by-window with codec-appropriate metrics, correlation and lag. Require zero unintended delay after correcting documented codec priming; examine all boundaries and especially J-cut start, picture handoff and tail, with granular windows sufficient to detect a frame shift. Listen to the J-cut with an audio tool if available; never claim listening if unavailable. Compare against a controlled AAC encode if needed to distinguish codec effects from edits; do not use broad tolerances to hide timing errors. No unexpected silence, other sounds, fades, overlaps or level changes. Verify build command/log really used CRF<=18 or lossless. Save quantitative results, mapping and boundary evidence. Return passed only if all required checks have evidence; report checks you could not perform as unresolved.\nPlan: ${JSON.stringify(planToCheck)}\nRender report: ${JSON.stringify(renderInfo)}`,
      {label: `technical-verification-${revision}`, phase: "Verify and repair", schema: reviewSchema}
    ),
    () => call(
      `Independently verify the editorial selection and evidence by viewing original candidates AND rendered sequence. Own work/verification/editorial-${revision}/ and do not modify output. Read full slot requirements. Directly inspect all selected clips throughout, including original source frame0 for slot6 and the actually retained frame24 start. Check every specified event, order, direction, camera behavior, shot size/angle, start and endpoint. Review complete 42-candidate catalog to ensure closest alternatives were not overlooked. Compare each chosen clip with its claimed closest alternative and any more plausible contender. Evidence reasons must identify a real concrete visible difference, and the chosen in-bounds >=12-frame interval must support it. Narrative plausibility alone is insufficient; do not accept wrong gaze direction, creature starting pose, final action, camera motion or similar near misses. Confirm final picture ordering, full use and straight cuts visually where possible; temporal technical validation is performed separately. Save per-slot pass/fail with decisive source/alternative frames and specific correction candidates only when observed. Return passed only when all six exact choices and all six evidence objects are substantiated; uncertain visual access or ambiguity is a failure with a clear issue.\nChoices: ${JSON.stringify(currentChoices)}\nPlan: ${JSON.stringify(planToCheck)}\nCatalog: ${JSON.stringify(catalog)}`,
      {label: `editorial-verification-${revision}`, phase: "Verify and repair", schema: reviewSchema}
    )
  ]);
}

let renderResult = await render(plan, 0, []);
if (!renderResult.ok || !renderResult.value.completed || renderResult.value.decodedOutputFrames !== plan.totalFrames) return stop("assembly", renderResult.ok ? renderResult.value.issues.concat(["Assembly incomplete or frame count differs from plan"]) : [renderResult.error], {choices, plan, renderResult});
let reviews = await verify(plan, choices, 0, renderResult.value);
const history = [];
let previousProblemSignature = "";
for (let repairRound = 1; repairRound <= 2 && !reviews.every(usableReview); repairRound++) {
  const missingReviews = reviews.filter(r => !r || !r.ok);
  if (missingReviews.length) return stop("verification", missingReviews.map(r => r?.error || "Missing required reviewer result"), {choices, plan, renderResult, reviews, history});
  const problems = reviews.map((r, index) => ({area: index === 0 ? "technical" : "editorial", issues: r.value.issues, failedChecks: r.value.checks.filter(c => !c.passed), passed: usableReview(r)}));
  const signature = JSON.stringify(problems);
  if (signature === previousProblemSignature) return stop("repair", ["The same verification defects remain after repair; no further blind retry"], {choices, plan, reviews, history});
  previousProblemSignature = signature;
  history.push({round: repairRound, problems});
  if (!usableReview(reviews[1])) {
    const resolution = await adjudicate(choices, problems[1], `repair-editorial-${repairRound}`);
    if (!resolution.ok || !resolution.value.ready) return stop("editorial-repair", resolution.ok ? resolution.value.issues : [resolution.error], {choices, plan, reviews, history});
    choices = resolution.value.selections.sort((a, b) => a.slot - b.slot);
    choiceIssues = selectionIssues(choices);
    if (choiceIssues.length) return stop("editorial-repair", choiceIssues, {choices, reviews, history});
    plan = buildPlan(choices);
  }
  renderResult = await render(plan, repairRound, problems);
  if (!renderResult.ok || !renderResult.value.completed || renderResult.value.decodedOutputFrames !== plan.totalFrames) return stop("assembly-repair", renderResult.ok ? renderResult.value.issues.concat(["Repair did not produce expected frame count"]) : [renderResult.error], {choices, plan, renderResult, history});
  reviews = await verify(plan, choices, repairRound, renderResult.value);
}
if (!reviews.every(usableReview)) return stop("final-verification", ["Required verification has unresolved defects or missing results after targeted repair"], {choices, plan, renderResult, reviews, history});
return {
  status: "verified",
  deliverables: [ROOT + "/output/sequence.mp4", ROOT + "/output/edl.json", ROOT + "/output/selection-evidence.json"],
  selection: choices.map(c => ({slot: c.slot, source: c.source, closestAlternative: c.closestAlternative, evidenceFrames: c.evidenceFrames})),
  totalFrames: plan.totalFrames,
  durationSeconds: plan.totalFrames / 24,
  verificationReports: reviews.map(r => r.value.reportPath),
  buildReportPath: renderResult.value.buildReportPath,
  repairs: history,
  unresolved: []
};