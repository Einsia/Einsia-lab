export const meta = {
  name: "reef-seven-beat-evidence-first",
  description: "Inspect all 46 anonymous clips, resolve seven content-and-motion matches, assemble complete alternating clips, and verify the three deliverables against decoded sources.",
  phases: [
    {title: "Prepare public inputs", detail: "Inventory and decode the available clips; make frame-indexed inspection assets."},
    {title: "Inspect every candidate", detail: "Catalog visible content and temporal behavior without inferring identity from metadata."},
    {title: "Resolve seven beats", detail: "Compare all five fields, inspect near matches over their full duration, and record discriminating evidence."},
    {title: "Assemble and verify", detail: "Create the three deliverables and independently check semantic choices and frame-level integrity."}
  ]
};

const root = "/workspace";
const ids = Array.from({length: 46}, (_, i) => String(i + 1).padStart(2, "0"));
const order = ["A1", "B1", "A2", "B2", "A3", "B3", "A4"];
const beats = {
  A1: {
    description: "A shallow reef mound with the moving, glinting water surface visible at the top of frame; a mound of yellow-brown plate coral fills most of the right side, distant sand and scattered rocks on the left.",
    shot_size: "Wide, tightening to medium-wide.",
    camera_angle: "Level from just below the mound top, tilted slightly up toward the surface.",
    lens_size: "Wide, strong near/far size difference.",
    camera_movement: "Continuous forward swim toward the mound throughout; the mound grows steadily and stays in frame."
  },
  A2: {
    description: "Opens close along the rim of a large pinkish-brown table coral whose fine branches fill the lower frame; the camera then clears the table top, revealing pale sand ahead and another table coral in the distance.",
    shot_size: "Close, widening to wide.",
    camera_angle: "From roughly table-top height rising to a slightly high angle above the table.",
    lens_size: "Wide.",
    camera_movement: "Continuous forward travel with a rise, passing over the coral top and continuing on."
  },
  A3: {
    description: "Open, pale, cracked limestone seabed; a dark hollow and reef lip on the left of frame; a black long-spined sea urchin mid-frame that keeps growing larger during the clip.",
    shot_size: "Wide, tightening to a close shot of the urchin.",
    camera_angle: "Oblique high angle just above the seabed.",
    lens_size: "Wide.",
    camera_movement: "Dolly-in toward the urchin, with clear parallax between the near seabed and the distant reef lip."
  },
  A4: {
    description: "A layered table-coral reef under deep blue water with many small fish above it; near the end several white, orange-banded butterflyfish swim into the foreground.",
    shot_size: "Wide.",
    camera_angle: "Level, slightly downward.",
    lens_size: "Wide.",
    camera_movement: "Hovering locked-off frame; the framing stays essentially still, with no push, pull, pan or drift."
  },
  B1: {
    description: "A large school of yellow-green surgeonfish with black vertical bars feeds over the reef; several fish pass extremely close to the lens as large defocused foreground masses; midway a large dark fish moves through the school.",
    shot_size: "Medium to close on fish bodies, reef as background.",
    camera_angle: "Level, close to the reef surface.",
    lens_size: "Wide; near fish heavily out of focus.",
    camera_movement: "Handheld hover inside the school with only small shake."
  },
  B2: {
    description: "Low over a flat coral platform with a low reef overhang ahead; the shadow beneath it is at first almost unreadable, and as the camera nears, schools of small yellow fish and red fish shapes appear.",
    shot_size: "Wide, tightening to medium.",
    camera_angle: "Low, level, close to the bottom.",
    lens_size: "Medium-wide; near platform texture sharp.",
    camera_movement: "Slow low push toward the overhang, settling to a stop at the end."
  },
  B3: {
    description: "Several whitetip reef sharks cruise low over sand and coral rubble; first distant and small, they come closer and fill a large part of the frame, ending over a patch of white coral rubble and table corals.",
    shot_size: "Wide, tightening to medium.",
    camera_angle: "Oblique high angle slightly above the sharks.",
    lens_size: "Wide.",
    camera_movement: "Lateral tracking: the camera moves toward frame-left with the sharks, so sand and reef stream continuously from the left side of frame to the right."
  }
};
const contract = `Task CDC-A-X08. Work under /workspace; read instruction.md and applicable workspace instructions with available tools. No network. The public inputs are input/01.mp4 through input/46.mp4, anonymous silent H.264, 1280x720, square pixels, 30 fps, 6-12 seconds. Available baseline: Python 3.11, FFmpeg/ffprobe, OpenCV, 4-8 CPU cores, no GPU or video generation. Discover your actual tools; do not claim image/video observations from unviewed files. Credits only establish public-domain US federal underwater footage and withhold attribution. Clip numbers, sizes, hashes, and metadata cannot identify a beat. Use visible footage and temporal evidence. Keep source files untouched. Scratch and reports go under work/; only the final three deliverables belong under output/. Do not search for hidden references, evaluator files, or external originals.
Choose seven DIFFERENT original clips. Required output order A1,B1,A2,B2,A3,B3,A4. Each selected clip must satisfy all FIVE fields over the WHOLE clip. Each occurs once, complete, 1x, original direction, hard cuts, no crop/mirror/filter/text/transitions/generated content and no added or dropped frames. Output H.264/yuv420p 1280x720 SAR 1:1 constant 30/1 fps, no audio, lossless concatenation or CRF<=18.
output/solution.json is exactly an object with segments: seven objects in output order containing thread, beat, source as two digits, output:[start,end] in seconds, source_range:[0,duration] in seconds, output_frames:[first,last_exclusive], source_frames:[0,frame_count]. Ranges are half-open, full length, contiguous from zero, and seconds equal corresponding frame indices/30 within .001 s. Final output frame endpoint equals decoded solution frame count; final seconds endpoint equals that count/30.
output/selection-evidence.json is an array of seven objects {beat,source,source_frames:[a,b],reason}. Use integer frame indices with b-a>=12 and both endpoints inside the chosen clip (choose b<frame_count). Each reason names the actual most similar other candidate by NN and a concrete visible difference, grounded in inspection; an interval is supporting evidence, not a trim. output/ must contain exactly solution.mp4, solution.json, selection-evidence.json.
There is a hypothetical 3600-second overall runtime budget. Use efficient batched decoding and bounded FFmpeg/OpenCV threading; avoid exhaustive high-resolution dumps, repeated full probes, or expensive video models. Inspection proxies, annotations, flow diagnostics and sheets are scratch only and must never enter the final video.`;
const fullContext = contract + "\nALL BEATS:\n" + JSON.stringify(beats);
const str = {type: "string"};
const strings = {type: "array", items: str};
function obj(properties, required) {
  return {type: "object", properties, required: required || Object.keys(properties), additionalProperties: false};
}
const pair = {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2};
const observationSchema = obj({
  source: str,
  full_timeline_inspected: {type: "boolean"},
  content: str,
  opening_middle_ending: str,
  camera_motion: str,
  framing_angle_lens: str,
  plausible_beats: strings,
  exclusions_or_uncertainties: strings,
  evidence_assets: strings
});
const inventorySchema = obj({
  ready: {type: "boolean"},
  manifest_path: str,
  viewing_method: str,
  clips: {type: "array", items: obj({source: str, frame_count: {type: "integer"}, fps: str, sheet_paths: strings, timeline_asset: str})},
  utilities: strings,
  issues: strings
});
const catalogSchema = obj({complete: {type: "boolean"}, report_path: str, clips: {type: "array", items: observationSchema}, issues: strings});
const matchSchema = obj({
  beat: str,
  resolved: {type: "boolean"},
  source: str,
  inspected_candidates: strings,
  closest_alternative: str,
  field_findings: obj({description: str, shot_size: str, camera_angle: str, lens_size: str, camera_movement: str}),
  whole_clip_evidence: str,
  source_frames: pair,
  reason: str,
  comparison_report: str,
  uncertainties: strings
});
const buildSchema = obj({
  complete: {type: "boolean"},
  files: strings,
  decoded_frames: {type: "integer"},
  segment_counts: {type: "array", items: {type: "integer"}},
  encoding_method: str,
  report_path: str,
  issues: strings
});
const reviewSchema = obj({
  passed: {type: "boolean"},
  report_path: str,
  checks: strings,
  issues: {type: "array", items: obj({kind: {type: "string", enum: ["selection", "evidence", "media", "manifest", "environment"]}, beat: str, detail: str, suggested_action: str})}
});
async function call(label, phaseName, prompt, schema) {
  try {
    const result = await agent(prompt, {label, phase: phaseName, schema});
    if (result === null) log(label + " returned no result.");
    return result;
  } catch (error) {
    log(label + " failed: " + String(error));
    return null;
  }
}
function unresolved(stage, issues, data) {
  return {status: "unresolved", stage, issues, details: data || null, deliverables_verified: false};
}

const prepPrompt = fullContext + `\nASSIGNMENT: Prepare shared inspection assets, not selections or deliverables. You are the sole writer to work/prep/. Locate inputs and confirm all 46 expected files. Decode each video to count actual frames, record codec/pixel format/dimensions/SAR, frame timestamps, nominal and average rate, duration from frame_count/30, and decode errors in work/prep/manifest.json. Do not trust container duration or nb_frames alone. Create legible contact sheets for every clip with source ID and exact frame indices, covering first, middle, final frames and at least 12 uniformly spaced frames. Create lightweight chronological inspection assets covering the entire duration at about 5 fps, or an efficient helper to view ordered batches of frames; preserve original frame-index mapping and direction. A single shared extraction pass per clip is preferred. Provide a helper that extracts native-size original frames or dense temporal windows on demand for motion and small animal details. If available, test the image/video viewing tool and say how later workers can actually open these assets. Playback availability is optional if chronological frame viewing is possible. Treat an inability to view imagery as a real blocker. Small thumbnails alone are not sufficient for all final judgments. Do not infer beat identities. Probe and extraction parallelism should fit 4-8 cores; at most two concurrent decoders, few threads each. Return all 46 records and reusable helper paths. Save intermediate checks under work/prep/. If prior partial preparation exists, inspect and finish it rather than regenerating valid assets. Report unsupported media properties instead of silently normalizing them.`;
let prep = await call("prepare-clips", "Prepare public inputs", prepPrompt, inventorySchema);
if (!prep || !prep.ready) {
  prep = await call("recover-preparation", "Prepare public inputs", prepPrompt + "\nPrevious preparation result: " + JSON.stringify(prep) + "\nOne recovery attempt: inspect partial work and repair only actionable local/tool issues. Report any remaining blocker truthfully.", inventorySchema);
}
if (!prep || !prep.ready) return unresolved("preparation", ["Public inputs or usable visual inspection assets are unavailable."], prep);
const clipMap = {};
for (const clip of prep.clips) clipMap[clip.source] = clip;
const inventoryProblems = ids.filter(id => !clipMap[id] || !Number.isInteger(clipMap[id].frame_count) || clipMap[id].frame_count < 13);
if (inventoryProblems.length || prep.clips.length !== 46 || Object.keys(clipMap).length !== 46) {
  return unresolved("preparation", ["Inventory must contain exactly the 46 distinct expected clips with decoded frame counts.", ...inventoryProblems], prep);
}

const shards = [];
for (let i = 0; i < ids.length; i += 8) shards.push(ids.slice(i, i + 8));
function catalogPrompt(shard, index) {
  return fullContext + "\nPREPARATION:\n" + JSON.stringify(prep) + `\nASSIGNMENT: Inspect exactly these candidates: ${shard.join(", ")}. Own only work/catalog/shard-${index}/. Read/view shared preparation assets; never change them. Catalog every assigned clip from beginning through end. Inspect the chronological sequence, not just a representative still. If native playback is unavailable, view chronological frames spanning the full clip and denser windows around motion changes; use original-size frames for identifying fine details. Record subject, left/right layout, opening/middle/ending, shot-size evolution, camera height/angle, visible wide/medium-wide perspective, direction and persistence of camera travel, hover, drift, or stop. Identify background movement separately from swimming animals and surface shimmer. Give plausible beats broadly; keep near misses and ambiguity visible rather than forcing a match. For reef pushes distinguish actual parallax from zoom or subject movement; for shark scenes describe static terrain movement in frame coordinates; for table reef scenes assess fixed reef anchors rather than fish. Note any apparent reversal, partial stop, rise, pan, or ending that contradicts a beat. Do not choose based on numbers or metadata. Save a concise report with exact frame references and return one record for EVERY assigned ID. Set full_timeline_inspected true only when the complete timeline was actually inspected at useful temporal sampling. Keep all writes inside your shard directory; lightweight diagnostics may use one CPU thread. This is candidate cataloging; final specialists will compare near matches.`;
}
let catalogs = await parallel(shards.map((shard, i) => () => call("catalog-" + (i + 1), "Inspect every candidate", catalogPrompt(shard, i), catalogSchema)));
function catalogValid(value, shard) {
  if (!value || !value.complete || value.clips.length !== shard.length) return false;
  const returned = value.clips.map(c => c.source);
  return new Set(returned).size === shard.length && shard.every(id => value.clips.some(c => c.source === id && c.full_timeline_inspected));
}
const failedShards = shards.map((shard, i) => i).filter(i => !catalogValid(catalogs[i], shards[i]));
if (failedShards.length) {
  const recovered = await parallel(failedShards.map(i => () => call("recover-catalog-" + (i + 1), "Inspect every candidate", catalogPrompt(shards[i], i) + "\nRecover missing or incomplete inspections from this prior result; reuse valid work: " + JSON.stringify(catalogs[i]), catalogSchema)));
  recovered.forEach((value, j) => { catalogs[failedShards[j]] = value; });
}
const stillMissing = shards.flatMap((shard, i) => catalogValid(catalogs[i], shard) ? [] : shard);
if (stillMissing.length) return unresolved("candidate inspection", ["Full candidate coverage is incomplete: " + stillMissing.join(", ")], catalogs);
const catalog = catalogs.flatMap(c => c.clips).sort((a, b) => a.source.localeCompare(b.source));
const sharedEvidence = "\nPREPARATION:\n" + JSON.stringify(prep) + "\nALL CANDIDATE OBSERVATIONS:\n" + JSON.stringify(catalog);
function matchPrompt(beat) {
  return fullContext + sharedEvidence + `\nASSIGNMENT: Resolve beat ${beat}; your required five fields are ${JSON.stringify(beats[beat])}. Own only work/beats/${beat}/. Read all 46 observations and visually scan all candidate contact sheets so that catalog omissions cannot silently hide a match. Build the plausible family for this beat, including all similar-looking clips. Inspect each serious contender's entire original-direction timeline, with dense chronological windows or native playback where needed. Compare opening, middle, ending and motion over the whole clip. Short stills cannot establish continuous travel, a final stop, locked-off framing, or tracking direction. Reuse shared proxies and helpers; obtain original-resolution frames as needed. If motion is uncertain, examine static background landmarks in multiple temporal windows and optionally use inexpensive OpenCV feature tracks/robust affine or optical-flow diagnostics on static terrain, masking fish and water shimmer. Flow is supporting evidence, not a substitute for seeing the scene. Do not confuse a digital scale change with a parallax-based push, nor shark swimming with camera tracking. Do not infer focal length numerically: justify the requested visible perspective.
For A1 check glinting surface and right mound staying in view/growing throughout. For A2 check close rim, upward clearance over the top, distant table and continued forward motion. For A3 check sustained urchin growth and near/far parallax by the left hollow. For A4 ensure the reef remains essentially fixed throughout and the specified butterflyfish enter near the end. For B1 confirm both defocused close fish and the mid-clip dark fish, with only small camera shake. For B2 verify the initial unreadable shadow, emergence of yellow/red fish and end settling to a stop. For B3 verify background flows left-to-right continuously while the camera tracks left, sharks grow in frame, and the correct ending terrain.
Choose a source only if all five fields fit. Compare the winner against the actual most similar nonselected candidate, naming that source ID and the decisive visible discrepancy. Save work/beats/${beat}/comparison.json with contender ranking, observations, exact frame windows for both chosen and alternative clips, five-field checks and rejected differences. Return source_frames=[a,b] with integers, b-a>=12, 0<=a<b<chosen frame_count, exhibiting the decisive difference; the written whole_clip_evidence must additionally establish whole-duration behavior. Reason must be directly usable in selection-evidence.json, identify the competitor NN, and say what can actually be seen. Return resolved=false and concrete uncertainties if ambiguity remains. No writes to output/.`;
}
let matches = await parallel(order.map(beat => () => call("match-" + beat, "Resolve seven beats", matchPrompt(beat), matchSchema)));
function matchProblems(match, beat) {
  const issues = [];
  if (!match) return ["No result for " + beat];
  if (match.beat !== beat) issues.push("Wrong beat identifier for " + beat);
  if (!match.resolved) issues.push("Unresolved identification for " + beat);
  if (!ids.includes(match.source)) issues.push("Invalid source for " + beat);
  if (!ids.includes(match.closest_alternative) || match.closest_alternative === match.source) issues.push("Missing distinct closest alternative for " + beat);
  if (!match.inspected_candidates.includes(match.source) || !match.inspected_candidates.includes(match.closest_alternative)) issues.push("Winner and alternative must both have been inspected for " + beat);
  const [a, b] = match.source_frames || [];
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b - a < 12 || !clipMap[match.source] || b >= clipMap[match.source].frame_count) issues.push("Invalid evidence interval for " + beat);
  if (!match.reason || !match.whole_clip_evidence || !match.comparison_report) issues.push("Missing visible evidence for " + beat);
  return issues;
}
function selectionProblems(values) {
  const issues = values.flatMap((m, i) => matchProblems(m, order[i]));
  const selected = values.filter(m => m && ids.includes(m.source)).map(m => m.source);
  if (new Set(selected).size !== selected.length) issues.push("Selections reuse a candidate; seven distinct sources are mandatory.");
  return issues;
}
let selectionIssues = selectionProblems(matches);
if (selectionIssues.length) {
  const resolutionSchema = obj({resolved: {type: "boolean"}, selections: {type: "array", items: matchSchema}, issues: strings});
  const resolution = await call("resolve-selection-conflicts", "Resolve seven beats", fullContext + sharedEvidence + "\nPRELIMINARY MATCHES:\n" + JSON.stringify(matches) + "\nPROBLEMS:\n" + JSON.stringify(selectionIssues) + `\nASSIGNMENT: Resolve only the incomplete or conflicting selections, using original footage, prior comparison reports and unexamined plausible alternatives. Own work/resolution/. Preserve already supported decisions unless direct evidence contradicts them. Reused candidates must be resolved by all five fields, never by assigning the next available number. Perform actual visual/temporal comparisons and provide corrected comparison reports and valid evidence windows. Return exactly seven selections in order ${order.join(",")}. Set resolved=false if the public inputs/tools cannot settle a match; do not invent certainty.`, resolutionSchema);
  if (!resolution || !resolution.resolved) return unresolved("selection", selectionIssues, resolution || matches);
  matches = order.map(beat => resolution.selections.find(m => m.beat === beat) || null);
  selectionIssues = selectionProblems(matches);
}
if (selectionIssues.length) return unresolved("selection", selectionIssues, matches);

function makeManifest(values) {
  let cursor = 0;
  const segments = values.map((match, i) => {
    const count = clipMap[match.source].frame_count;
    const first = cursor;
    cursor += count;
    return {thread: order[i][0], beat: order[i], source: match.source, output: [first / 30, cursor / 30], source_range: [0, count / 30], output_frames: [first, cursor], source_frames: [0, count]};
  });
  return {segments};
}
let manifest = makeManifest(matches);
let evidence = matches.map(m => ({beat: m.beat, source: m.source, source_frames: m.source_frames, reason: m.reason}));
const buildPrompt = () => fullContext + "\nPREPARATION:\n" + JSON.stringify(prep) + "\nLOCKED SELECTIONS:\n" + JSON.stringify(matches) + "\nEXACT MANIFEST TO WRITE:\n" + JSON.stringify(manifest) + "\nEXACT EVIDENCE TO WRITE:\n" + JSON.stringify(evidence) + `\nASSIGNMENT: Sole assembly writer to output/ and work/build/. Materialize and verify the three deliverables. Do not change the chosen clips or evidence on your own. Use complete decoded frame sequences in manifest order. Prefer a simple reliable CRF 16 or 18 H.264 encode at original dimensions, yuv420p and SAR 1:1. One robust method is sequential FFmpeg native yuv420p decoding of each source, continuously piping all decoded raw frames to one FFmpeg rawvideo encoder input explicitly specified 1280x720 at 30 fps; count bytes/frames per source, handle pipe failures, preserve frame order, and check every decoder/encoder exit status. Use this only if source pixel formats fit or a necessary yuv420p conversion is documented. Avoid RGB round trips. Alternatively use a validated concatenation path that demonstrably preserves every frame and constant timestamps. Stream copy is acceptable only if actual stream compatibility, boundaries and frame equality are proven. Do not use an fps filter, interpolation, padding, cropping, scaling, speed changes, transitions or timestamp heuristics that duplicate/drop frames. Setting output timing from exact frame indices is permitted. Limit encode threading to the available CPU budget. Put scripts, logs, temporary media and concat lists in work/build/, then atomically install final files under output/. Preserve any preexisting unrelated files by moving them to a scratch backup if needed to satisfy the exactly-three-files rule; never delete inputs.
Write solution.json and selection-evidence.json exactly from supplied objects. Independently reconcile counts against actual input decodes before encoding; report disagreement instead of silently changing ranges. Decode the final MP4, check its actual frame count equals the sum, verify constant 30/1 timeline, 1280x720, SAR1:1, yuv420p, H.264 and absence of audio. Save commands, exit statuses and encoding CRF evidence in work/build/report.json. A successful FFmpeg exit alone is not completion. Return complete only when the files exist and these basic checks pass.`;
let build = await call("assemble-deliverables", "Assemble and verify", buildPrompt(), buildSchema);
if (!build || !build.complete) {
  build = await call("recover-assembly", "Assemble and verify", buildPrompt() + "\nPrevious assembly result: " + JSON.stringify(build) + "\nRecover partial work and repair the identified construction failure once; do not rerun valid work without need.", buildSchema);
}
if (!build || !build.complete) return unresolved("assembly", ["Assembly did not establish valid final files."], build);

function technicalPrompt() {
  return fullContext + "\nEXPECTED MANIFEST:\n" + JSON.stringify(manifest) + "\nEXPECTED EVIDENCE:\n" + JSON.stringify(evidence) + "\nBUILD RESULT:\n" + JSON.stringify(build) + `\nASSIGNMENT: Independently audit actual files. Read-only access to input/ and output/; own work/verify/technical/. Write an executable validation script/report there using FFmpeg/ffprobe/Python as available. Do not trust builder summaries. Check exact directory membership and JSON shape/types; order A1,B1,A2,B2,A3,B3,A4, distinct sources, full source ranges from actual decodes, cumulative half-open endpoints and seconds tolerance. Ensure evidence interval integers have length>=12 and both endpoints inside each source, beats/source IDs agree, and reasons name a distinct existing competitor. Fully decode every selected original and output, proving no decoder errors and exact total count. Check H.264/yuv420p/dimensions/SAR/no audio; verify display-order timestamps advance by 1/30 throughout and stream rates agree, including joins. Verify lossless stream-copy provenance or documented CRF<=18 encoder command/settings.
Perform a frame-by-frame comparison of every output frame with the named original frame at the same source-relative index, including the first/last frame and both sides of each boundary. For stream copy compare decoded hashes. For lossy encode record per-frame native-plane error/PSNR or similarly justified pixel similarity plus alignment checks; exact hashes are not expected. Assess unexpected errors and abrupt outliers using actual images. For suspected shift/duplication compare neighboring source indices and investigate static-scene ties instead of using arbitrary thresholds as proof. Check directly for transforms or changed direction if mismatch patterns suggest them. Save per-frame numeric diagnostics in scratch, summarize minimum/quantile quality and any anomalous indices. A sample-only check is insufficient for frame-preservation. Return passed=false for any unverified required property or missing comparison. In issues use beat='' for global issues. No mutations to deliverables.`;
}
function semanticPrompt() {
  return fullContext + sharedEvidence + "\nSELECTED MATCHES AND COMPARISONS:\n" + JSON.stringify(matches) + "\nEVIDENCE FILE EXPECTED:\n" + JSON.stringify(evidence) + `\nASSIGNMENT: Independently verify the seven semantic choices and human-readable evidence from actual imagery. Read-only input/output/shared assets; own work/verify/semantic/. Read actual final JSON files. For each beat inspect the whole selected clip and its closest alternative's timeline, reopening original-size frames and dense temporal windows when needed. Check all five fields and correct motion direction across beginning/middle/end, especially end stops, rises, drift, continuous pushes and static background movement versus animals. Use all-candidate catalog/sheets to challenge whether the named alternative is truly the closest plausible alternative; investigate another candidate if it appears closer. Verify each evidence interval actually shows the claimed visible distinction, and each reason names the competitor and describes an observed difference rather than restating the desired beat or citing metadata. Cross-reference the actual output around cuts and the final images to ensure the semantic review corresponds to the files delivered. Do not accept earlier claims without inspecting. Save per-beat findings, inspected frame windows and any counterexamples in work/verify/semantic/report.json. Report specific actionable issues with kind selection or evidence, beat and direct frame evidence; give no unsupported replacement ID. If tools cannot support the necessary observations, report an environment issue and passed=false. No changes to deliverables.`;
}
async function reviews(suffix) {
  return await parallel([
    () => call("verify-frames" + suffix, "Assemble and verify", technicalPrompt(), reviewSchema),
    () => call("verify-choices" + suffix, "Assemble and verify", semanticPrompt(), reviewSchema)
  ]);
}
let checks = await reviews("");
const checksPass = values => values.length === 2 && values.every(v => v && v.passed && v.issues.length === 0);
if (!checksPass(checks)) {
  const failures = checks.flatMap((c, i) => c ? c.issues : [{kind: "environment", beat: "", detail: (i === 0 ? "Technical" : "Semantic") + " review returned no result.", suggested_action: "Recover the missing independent inspection; absence is not a pass."}]);
  const substantive = failures.filter(issue => issue.kind !== "environment");
  if (substantive.length) {
    const repairSchema = obj({repaired: {type: "boolean"}, selections: {type: "array", items: matchSchema}, changed_files: strings, report_path: str, issues: strings});
    const repair = await call("repair-supported-findings", "Assemble and verify", fullContext + sharedEvidence + "\nCURRENT SELECTIONS:\n" + JSON.stringify(matches) + "\nCURRENT MANIFEST:\n" + JSON.stringify(manifest) + "\nINDEPENDENT REVIEW RESULTS:\n" + JSON.stringify(checks) + `\nASSIGNMENT: One targeted repair pass for concrete review failures. You are the sole mutable worker now; own work/repair/ and may update output/. Inspect evidence before changing anything. Resolve semantic selection problems by comparing originals across full durations, not by guessing another ID. Preserve correct selections. Supply seven complete updated match records in required order even if unchanged. For evidence-only faults, choose a valid observed interval and rewrite the competitor comparison based on actual footage. For media/manifest faults, repair assembly using exact complete sources and regenerate cumulative ranges from decoded counts. If a selection changes, update all three deliverables consistently. Re-encode only if the video changes or encoding is faulty, preserving CRF<=18 and every frame. Reuse work/build scripts after reviewing them. Reconcile JSON seconds with frames/30. Keep output exactly the three requested files. Save repair provenance and run the necessary local checks. If a blocker remains, state it and repaired=false; do not mark incomplete review work as passed.`, repairSchema);
    if (!repair || !repair.repaired) return unresolved("repair", failures, {repair, checks, build});
    const updated = order.map(beat => repair.selections.find(m => m.beat === beat) || null);
    const updatedProblems = selectionProblems(updated);
    if (updatedProblems.length) return unresolved("repair", updatedProblems, repair);
    matches = updated;
    manifest = makeManifest(matches);
    evidence = matches.map(m => ({beat: m.beat, source: m.source, source_frames: m.source_frames, reason: m.reason}));
    build = {...build, report_path: repair.report_path, issues: repair.issues};
    checks = await reviews("-after-repair");
  } else {
    // Missing reports are retried once without changing artifacts. A reported environmental blocker remains explicit if it persists.
    const reruns = await parallel(checks.map((check, i) => () => check && check.passed && check.issues.length === 0
      ? Promise.resolve(check)
      : call(i === 0 ? "recover-frame-review" : "recover-choice-review", "Assemble and verify", (i === 0 ? technicalPrompt() : semanticPrompt()) + "\nRecover this failed/missing check once using existing scratch evidence where valid: " + JSON.stringify(check), reviewSchema)));
    checks = reruns;
  }
}
if (!checksPass(checks)) return unresolved("final verification", ["At least one independent required check failed, was incomplete, or returned no result. See reports; no verified-completion claim is warranted."], {checks, selections: matches, manifest, build});
return {
  status: "verified",
  deliverables_verified: true,
  files: [root + "/output/solution.mp4", root + "/output/solution.json", root + "/output/selection-evidence.json"],
  order: manifest.segments.map(s => ({beat: s.beat, source: s.source, output_frames: s.output_frames})),
  total_frames: manifest.segments[6].output_frames[1],
  duration_seconds: manifest.segments[6].output[1],
  verification_reports: checks.map(c => c.report_path),
  unresolved_issues: []
};