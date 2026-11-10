export const meta = {
  name: "machine-runaway-frame-accurate-assembly",
  description: "Inspect public footage without assuming clip identities, establish six exact state changes, assemble the fixed beat map, and verify all three deliverables.",
  phases: [
    {title: "Prepare", detail: "Inspect local instructions, public inputs, and available decoding and visual inspection tools."},
    {title: "Catalogue", detail: "Inspect all 44 anonymous clips in disjoint batches."},
    {title: "Identify events", detail: "Resolve source identities and exact decoded change frames, with independent visual checks."},
    {title: "Assemble", detail: "Create the beat-aligned video and declarations from one validated manifest."},
    {title: "Verify", detail: "Audit decoded pictures, timing, metadata, events, and output directory contents."}
  ]
};

const ROOT = "/workspace";
const beats = {
  fps: 30, total_frames: 858,
  slots: [
    {slot: 1, start_frame: 0, end_frame: 150, accent_frame: 72},
    {slot: 2, start_frame: 150, end_frame: 276, accent_frame: 204},
    {slot: 3, start_frame: 276, end_frame: 420, accent_frame: 360},
    {slot: 4, start_frame: 420, end_frame: 534, accent_frame: 480},
    {slot: 5, start_frame: 534, end_frame: 690, accent_frame: 630},
    {slot: 6, start_frame: 690, end_frame: 858, accent_frame: 780}
  ]
};
const story = [
  "Overload: In a pitch-black void, a lanky young man and a bald old man stand side by side on a small floating platform; full-figure long shot, essentially locked camera. A blinding flash changes the surroundings from total black into a bright, heavily motion-blurred grey-white space; both remain standing on the platform.",
  "Power cut: An open square hatch in a green tiled wall has a lamp lit inside; close shot, locked camera. A tiled panel slides down over the hatch and gloved hands press it flat. Change: picture drops to full black. Afterwards a wide engine room slowly emerges from darkness with two figures standing in it.",
  "Intrusion: An empty square bare-walled room in a frontal symmetrical long shot, locked camera; the young man swings his arms in the middle. Change: dark cables pour from the left corner and crawl over the left wall.",
  "Breach: Tilted low-angle close shot hugging a tiled wall with a metal pipe; camera slides along the wall. Change: cables burst through the wall, debris flies, and the warm orange, cable-filled space behind it is fully revealed.",
  "Encirclement: Bald old man alone before a golden curtain of vertically flowing light, clutching his head; medium shot, essentially locked camera. Change: the curtain behind him becomes rows of dark machinery with red indicator lights.",
  "Failure: Old man alone in diagonally falling streaks of light; full-figure long shot, camera settling to rest. Change: the warm orange light of the whole scene drains into a dim, cold green."
];
const brief = {
  task_id: "cdc-a-x04", root: ROOT, beats,
  storyboard: story.map((description, i) => ({...beats.slots[i], description})),
  inputs: "input/clips/01.mp4 through input/clips/44.mp4, anonymous silent H.264, 1280x720, SAR 1:1, 30 fps, 6-12 seconds. Numbering is random. Candidates can contain original cuts.",
  rules: "Exactly six distinct candidates, one contiguous half-open decoded frame range each, slot order, forward at 1x. Preserve original pictures: no crop, mirror, grade, text, transitions, generated content, retiming, dropped or duplicated frames. Hard cuts exactly at beat boundaries. Each event is the FIRST frame at which the specified later state holds, aligned to accent_frame. Before state, change, and after state must appear within the slot. Brief adjacent original shots at the fixed-range heads or tails are allowed.",
  deliverables: "Exactly output/solution.mp4, output/solution.json, output/events.csv. MP4: H.264/yuv420p, 1280x720, SAR 1:1, constant 30/1 fps, no audio, 858 fully decoded frames; lossless concat or re-encode at CRF <=18. JSON: {segments:[{slot,source,source_frames:[a,b],output_frames:[c,d]},...]} exactly six ordered entries, two-digit source strings and half-open integer intervals. CSV header slot,source,source_frame,output_frame and six ordered rows. All frame indices zero-based fully decoded presentation frames. Drafts and evidence only in work/."
};
const base = "You are a future worker executing a previously generated plan. Read /workspace/instruction.md and applicable workspace instructions if present; you do not inherit another worker's conversation. Work offline using only tools actually available to you. Inspect local public inputs; do not seek a hidden key, infer source identities from numbering, hashes, sizes, credits, or film familiarity, or fabricate tool observations. Public task context follows:\n" + JSON.stringify(brief) + "\nUse full sequential decoding and zero-based presentation-order frame indices for all exact positions; avoid keyframe seek offsets and rounded timestamps. Contact sheets may resize and annotate diagnostic images in work/ only, never delivered pictures. External communication is unnecessary. Report unavailable capabilities or ambiguous evidence honestly. Workers share a workspace; write only inside your assigned work directory unless explicitly assigned final output ownership. Read-only sharing is allowed. Prefer reusable evidence and bounded processing so the complete future task can fit the hypothetical 3600-second budget.\n";
const str = {type: "string"};
const int = {type: "integer"};
const bool = {type: "boolean"};
const strings = {type: "array", items: str};
function obj(properties, required = Object.keys(properties)) {
  return {type: "object", properties, required, additionalProperties: false};
}
const pair = {type: "array", items: int, minItems: 2, maxItems: 2};
const candidateSchema = obj({
  slot: {type: "integer", minimum: 1, maximum: 6},
  source: {type: "string", pattern: "^(0[1-9]|[1-3][0-9]|4[0-4])$"},
  decoded_frames: {type: "integer", minimum: 1},
  event_window: pair,
  match: {type: "string", enum: ["strong", "possible"]},
  evidence: str,
  concerns: strings,
  evidence_paths: strings
});
const selectionSchema = obj({
  slot: {type: "integer", minimum: 1, maximum: 6},
  resolved: bool,
  source: str,
  decoded_frames: int,
  event_frame: int,
  source_frames: pair,
  before_frame: int,
  after_frame: int,
  observation: str,
  event_boundary_reason: str,
  alternatives: strings,
  unresolved: strings,
  evidence_paths: strings
});
const reviewSchema = obj({passed: bool, issues: strings, evidence: strings, inspected_frames: strings, recommended_action: str});
const failures = [];
async function call(prompt, label, group, schema) {
  try {
    const value = await agent(base + prompt, {label, phase: group, schema});
    if (value === null) failures.push({label, error: "Worker returned null"});
    return value;
  } catch (e) {
    failures.push({label, error: String(e)});
    return null;
  }
}
function geometryIssue(s, slot) {
  const b = beats.slots[slot - 1];
  if (!s || s.slot !== slot || !s.resolved) return "Missing or unresolved selection for slot " + slot;
  if (!/^(0[1-9]|[1-3][0-9]|4[0-4])$/.test(s.source)) return "Invalid source for slot " + slot;
  const values = [s.decoded_frames, s.event_frame, s.before_frame, s.after_frame, ...(s.source_frames || [])];
  if (values.some(v => !Number.isInteger(v)) || s.source_frames.length !== 2) return "Invalid frame integers for slot " + slot;
  const a = s.event_frame - (b.accent_frame - b.start_frame);
  const z = a + b.end_frame - b.start_frame;
  if (a < 0 || z > s.decoded_frames || s.source_frames[0] !== a || s.source_frames[1] !== z) return "Fixed accent-aligned range is inconsistent or out of bounds for slot " + slot;
  if (!(a <= s.before_frame && s.before_frame < s.event_frame && s.event_frame < s.after_frame && s.after_frame < z)) return "Before/change/after evidence does not fit slot " + slot;
  return null;
}
function manifestFrom(selections) {
  return {
    segments: selections.map(s => ({slot: s.slot, source: s.source, source_frames: s.source_frames, output_frames: [beats.slots[s.slot - 1].start_frame, beats.slots[s.slot - 1].end_frame]})),
    events: selections.map(s => ({slot: s.slot, source: s.source, source_frame: s.event_frame, output_frame: beats.slots[s.slot - 1].accent_frame}))
  };
}

const preparation = await call(
  "Prepare read-only input discovery and shared task metadata. You own work/setup/. Check the actual instruction.md, beats.json, existence of all 44 inputs, applicable instructions, and installed decoding/encoding/image-viewing capabilities. Compare the local beats to the supplied public map exactly. Do not identify clips from metadata. Record actual commands/tools usable by subsequent workers and any limitations. Establish a frame-index convention and reusable lightweight decoding/contact-sheet approach using available tools (ffmpeg/ffprobe/Python only if actually available). Confirm visual inspection of images/video is possible, not merely generation of image files. Do not decode all footage redundantly or create final outputs. Save setup notes under work/setup/. Return ready=false for missing public inputs, conflicting beat map, or missing essential decode/visual/encode capability; explain the blocker.",
  "prepare-public-inputs", "Prepare",
  obj({ready: bool, beats_match: bool, input_count: int, capabilities: strings, notes_path: str, issues: strings})
);
if (!preparation || !preparation.ready || !preparation.beats_match || preparation.input_count !== 44) {
  return {status: "blocked", stage: "prepare", preparation, failures};
}

const ids = Array.from({length: 44}, (_, i) => String(i + 1).padStart(2, "0"));
const batches = Array.from({length: 6}, (_, i) => ids.filter((_, j) => j % 6 === i));
const scanSchema = obj({
  inspected: {type: "array", items: obj({source: str, decoded_frames: int, content_summary: str, coverage: str, evidence_paths: strings})},
  matches: {type: "array", items: candidateSchema},
  unresolved: strings
});
const scans = await parallel(batches.map((sources, i) => () => call(
  "Catalogue ONLY these source IDs: " + JSON.stringify(sources) + ". You own work/catalogue/batch-" + (i + 1) + "/. Setup result: " + JSON.stringify(preparation) + "\nRead shared setup notes. Fully decode/probe each assigned candidate to establish actual frame count. Generate and VISUALLY INSPECT chronological contact sheets covering each clip from first to last frame, initially around every 10-15 decoded frames plus endpoints, using manageable labelled pages. Examine denser frames or playback wherever a state change, internal shot, or possible storyboard match occurs; sparse thumbnails alone cannot rule out a brief relevant shot. Describe every candidate, including nonmatches, so downstream workers can revisit it. For any of the six slots, list strong and plausible matches with a coarse half-open event window and factual visual evidence of framing, characters, before state, transition and after state. Check for lookalike repetitions and partial matches. Do not force one source per slot or pretend coarse windows are exact events. Preserve uncertainty and all useful alternatives. All frame annotations refer to fully decoded source indices, not sheet positions. Do not edit shared setup or outputs.",
  "catalogue-batch-" + (i + 1), "Catalogue", scanSchema
)));
const covered = new Set();
const catalogue = [];
const matches = [];
const scanIssues = [];
for (let i = 0; i < scans.length; i++) {
  const scan = scans[i];
  if (!scan) { scanIssues.push("Missing scan batch " + (i + 1)); continue; }
  for (const row of scan.inspected) {
    if (!batches[i].includes(row.source)) { scanIssues.push("Unexpected source " + row.source + " in batch " + (i + 1)); continue; }
    if (covered.has(row.source)) scanIssues.push("Duplicate catalogue entry " + row.source);
    covered.add(row.source);
    catalogue.push(row);
  }
  matches.push(...scan.matches.filter(m => batches[i].includes(m.source)));
  scanIssues.push(...scan.unresolved);
}
const missing = ids.filter(id => !covered.has(id));
if (missing.length) {
  const recovered = await call(
    "Recover incomplete catalogue coverage for these sources only: " + JSON.stringify(missing) + ". You own work/catalogue/recovery/. Setup: " + JSON.stringify(preparation) + ". Perform the same visual chronological inspection and exact decoded frame counting as the catalogue stage, checking all six storyboard descriptions. Produce summaries and plausible matches with coarse event windows. Existing scan issues: " + JSON.stringify(scanIssues),
    "recover-catalogue", "Catalogue", scanSchema
  );
  if (recovered) {
    for (const row of recovered.inspected) if (missing.includes(row.source) && !covered.has(row.source)) { covered.add(row.source); catalogue.push(row); }
    matches.push(...recovered.matches.filter(m => missing.includes(m.source)));
  }
}
if (ids.some(id => !covered.has(id))) return {status: "unresolved", stage: "catalogue", missing_sources: ids.filter(id => !covered.has(id)), scanIssues, failures};
catalogue.sort((a, b) => a.source.localeCompare(b.source));

function slotPrompt(slot, previous, feedback, suffix, excluded = []) {
  const b = beats.slots[slot - 1];
  return "Resolve slot " + slot + ". You own work/slots/" + slot + "/" + suffix + "/. Read-only catalogue and other slot evidence are available.\n" +
    "Beat geometry: " + JSON.stringify(b) + ". Required length=" + (b.end_frame - b.start_frame) + ", event offset=" + (b.accent_frame - b.start_frame) + ".\n" +
    "Setup: " + JSON.stringify(preparation) + "\nAll inspected source summaries: " + JSON.stringify(catalogue) + "\nSlot shortlist (not a key): " + JSON.stringify(matches.filter(m => m.slot === slot)) + "\n" +
    "Sources excluded because they are assigned elsewhere: " + JSON.stringify(excluded) + "\nPrevious proposal: " + JSON.stringify(previous) + "\nFeedback: " + JSON.stringify(feedback) + "\n" +
    "Visually inspect plausible candidate clips, including entire relevant shot sequences and lookalike alternatives. If shortlist lacks a convincing fit, use catalogue evidence to inspect other candidates; do not assume a scan found every match. Determine the exact FIRST decoded frame e where the storyboard's later state holds. Inspect consecutive full-resolution frames around the transition, especially e-1, e, e+1, and earlier frames across the transition to establish firstness; preserve labelled evidence. For gradual changes inspect every frame in the uncertain interval and explicitly explain the visible criterion. Do not replace the specified event with a maximum difference, brightest frame, arbitrary color threshold, midpoint, first precursor, or a convenient frame that makes the trim fit. Image measurements can locate an interval, but visual semantics decides the frame. Slot 2 means first full-black picture after hatch closure, not hatch movement or emergence; account for compression near black. Slot 4 requires the specified revealed warm cable-filled space, not merely the earliest crack. Slot 6 requires the whole scene's dim cold-green later state, not just an early warm-light fluctuation. For slots 1, 3, and 5 distinguish the described change from unrelated flashes, existing cables, or transitional traces.\n" +
    "Compute a=e-(accent_frame-start_frame), b=a+(end_frame-start_frame). Never shift e to rescue an out-of-bounds range. Verify 0<=a<b<=decoded source count. Inspect the complete proposed [a,b): its main content must match this slot, with before, transition, and after visible; brief adjacent original shots are allowed at ends. Report a representative before_frame in [a,e), and after_frame in (e,b), plus exact boundary reasoning explaining e-1 versus e and competing plausible frames. Use resolved=false with explicit ambiguity if evidence cannot establish a defensible event/source; source may be empty and frame values -1 when unresolved. Do not write output/.";
}
async function auditSlot(selection, suffix) {
  return await call(
    "Independently verify this proposed slot against actual decoded imagery and public instructions. You own work/reviews/slot-" + selection.slot + "/" + suffix + "/. Proposal: " + JSON.stringify(selection) + "\nSetup: " + JSON.stringify(preparation) + "\nDo not accept the producer's interpretation without viewing the frames. Decode from source start, verify the index labels, examine the full proposed range, inspect consecutive frames across the state change including e-1/e/e+1, and examine earlier transition frames to confirm FIRST later-state frame. Check all storyboard specifics, correct subject count and framing, before and after visibility, allowed adjacent shots, range feasibility and exact accent arithmetic. For gradual state changes document the concrete visible criterion and assess alternative boundaries. Inspect plausible lookalikes if the identity is uncertain; available shortlist: " + JSON.stringify(matches.filter(m => m.slot === selection.slot)) + ". A matching numerical trim does not prove a semantic match. Report passed=false for unresolved exact-frame ambiguity, missing visual evidence, or any failed requirement. Give actionable issues and the actually inspected frames/evidence paths. Do not mutate the selection or final outputs.",
    "review-slot-" + selection.slot + "-" + suffix, "Identify events", reviewSchema
  );
}

const slotResults = await pipeline(beats.slots,
  async (_, b) => {
    const selection = await call(slotPrompt(b.slot, null, [], "initial"), "identify-slot-" + b.slot, "Identify events", selectionSchema);
    return {slot: b.slot, selection, review: null};
  },
  async (state) => {
    for (let attempt = 0; attempt <= 2; attempt++) {
      const invalid = geometryIssue(state.selection, state.slot);
      state.review = invalid ? {passed: false, issues: [invalid], evidence: [], inspected_frames: [], recommended_action: "Resolve source and exact event with feasible range."} : await auditSlot(state.selection, "attempt-" + attempt);
      if (state.review && state.review.passed) return state;
      if (attempt === 2) break;
      const revised = await call(slotPrompt(state.slot, state.selection, state.review || {issues: ["Independent review failed to return evidence"]}, "repair-" + (attempt + 1)), "repair-slot-" + state.slot + "-" + (attempt + 1), "Identify events", selectionSchema);
      if (!revised) break;
      state.selection = revised;
    }
    return state;
  }
);
let states = beats.slots.map((b, i) => slotResults[i] || {slot: b.slot, selection: null, review: null});
let selections = states.map(s => s.selection);
const initiallyUnresolved = states.filter(s => geometryIssue(s.selection, s.slot) || !s.review || !s.review.passed);
if (initiallyUnresolved.length) return {status: "unresolved", stage: "identify-events", slots: states, scanIssues, failures};

function duplicateSources(rows) {
  return [...new Set(rows.map(s => s.source))].filter(source => rows.filter(s => s.source === source).length > 1);
}
if (duplicateSources(selections).length) {
  const adjudicated = await call(
    "Resolve a global distinct-source conflict. You own work/adjudication/. All six slots must use different candidates. Current independently reviewed proposals: " + JSON.stringify(states) + "\nDuplicates: " + JSON.stringify(duplicateSources(selections)) + "\nCatalogue: " + JSON.stringify(catalogue) + "\nMatches: " + JSON.stringify(matches) + "\nInspect source footage and alternate candidates as necessary. Preserve valid nonconflicting choices wherever possible. Return a complete six-slot assignment in slot order using the same exact event, range, before/after evidence standards as the original task. Do not choose a weaker semantic match simply to enforce distinctness. Report unresolved selections if no supported assignment exists. All revised choices will receive independent visual review. Do not create final outputs.",
    "resolve-distinct-source-conflict", "Identify events", obj({selections: {type: "array", items: selectionSchema, minItems: 6, maxItems: 6}, explanation: str})
  );
  if (!adjudicated) return {status: "unresolved", stage: "distinct-source-assignment", slots: states, failures};
  selections = adjudicated.selections;
  const errors = selections.map((s, i) => geometryIssue(s, i + 1)).filter(Boolean);
  if (errors.length || duplicateSources(selections).length) return {status: "unresolved", stage: "distinct-source-assignment", errors, duplicates: duplicateSources(selections), adjudicated, failures};
  const rechecks = await parallel(selections.map((s, i) => () => JSON.stringify(s) === JSON.stringify(states[i].selection) ? Promise.resolve(states[i].review) : auditSlot(s, "after-adjudication")));
  states = selections.map((selection, i) => ({slot: i + 1, selection, review: rechecks[i]}));
  if (states.some(s => !s.review || !s.review.passed)) return {status: "unresolved", stage: "adjudication-review", slots: states, failures};
}
const manifest = manifestFrom(selections);
const manifestErrors = [];
for (let i = 0; i < manifest.segments.length; i++) {
  const s = manifest.segments[i];
  const e = manifest.events[i];
  if (s.source_frames[1] - s.source_frames[0] !== s.output_frames[1] - s.output_frames[0]) manifestErrors.push("Duration mismatch in slot " + s.slot);
  if (s.output_frames[0] + e.source_frame - s.source_frames[0] !== e.output_frame) manifestErrors.push("Event mapping mismatch in slot " + s.slot);
  if (i && manifest.segments[i - 1].output_frames[1] !== s.output_frames[0]) manifestErrors.push("Output gap/overlap before slot " + s.slot);
}
if (manifest.segments[0].output_frames[0] !== 0 || manifest.segments[5].output_frames[1] !== beats.total_frames) manifestErrors.push("Total output range mismatch");
if (manifestErrors.length) return {status: "unresolved", stage: "manifest-validation", manifestErrors, manifest, failures};

const renderSchema = obj({completed: bool, outputs: strings, manifest_path: str, encoding: str, verification_notes: strings, issues: strings});
function renderPrompt(feedback, attempt) {
  return "You are the ONLY writer of output/ and work/assembly/. Build or repair the exact deliverables from this validated manifest: " + JSON.stringify(manifest) + "\nSemantic source evidence: " + JSON.stringify(selections) + "\nSetup: " + JSON.stringify(preparation) + "\nAttempt " + attempt + ", prior verification feedback: " + JSON.stringify(feedback) + "\nRead the actual beats and recheck all lengths/range bounds. Persist a machine-readable manifest and reproducible assembly commands under work/assembly/. Use frame-index trimming after full source decoding, preserving presentation order and every selected picture. Reset timestamps per segment and concatenate six ranges in order, assigning output PTS n/(30*TB) without a frame-rate conversion or interpolation. Do not rely on input-side -ss, duration rounding, stream-copy at non-keyframe boundaries, or keyframe-aligned cuts. No audio. Prefer a single H.264 libx264 yuv420p lossless encode at CRF 0 if supported: it satisfies CRF <=18 and permits decoded-plane equality. Otherwise use CRF <=18 and record settings and why lossless was unavailable. Preserve 1280x720 and SAR 1:1 with no pixel transforms, color correction, or unnecessary pixel format conversions; discover and retain relevant color metadata. Source clips are already 30fps; avoid fps filters or output options that silently drop/duplicate frames. Prove the encode retains the expected 858 frames. Use available tools; do not assume ffmpeg filter/option support without checking.\nWrite solution.json with ONLY the segments array and exactly the requested per-segment keys; write events.csv with the exact header and six rows using two-digit IDs. Both must derive from the supplied manifest, not hand-transcribed independent calculations. Keep logs, scripts, PNGs, intermediate media and reports in work/. Output/ must contain exactly the three requested files. Inspect existing output contents before publishing; move pre-existing unrelated artifacts into a work/ backup rather than delete user data. Encode to work/assembly/ temporary files, check basic validity, and publish complete outputs. Do not change semantic selections or events to address technical issues; report any semantic conflict for further handling. Record actual commands, encoder settings, version information, decoded counts and output paths. Do not claim completion if encoding or basic checks fail.";
}
let rendered = await call(renderPrompt(null, 0), "assemble-deliverables", "Assemble", renderSchema);
if (!rendered || !rendered.completed) return {status: "unresolved", stage: "assembly", manifest, rendered, slots: states, failures};
const technicalSchema = obj({
  passed: bool,
  issues: strings,
  semantic_issues: strings,
  metadata_checks: strings,
  frame_comparison: str,
  observed_frame_count: int,
  report_path: str,
  output_paths: strings
});
async function verifyOutputs(attempt) {
  return await call(
    "Independently audit actual final files, read-only output access. You own work/verification/attempt-" + attempt + "/. Expected manifest: " + JSON.stringify(manifest) + "\nSource/change evidence: " + JSON.stringify(selections) + "\nAssembler report: " + JSON.stringify(rendered) + "\nUse actual tools and file contents, not assembler assertions. Check output/ contains exactly solution.mp4, solution.json, events.csv. Parse JSON/CSV strictly: six ordered distinct two-digit source IDs, integer half-open ranges, no extra schema fields, exact header, matching ranges/events/beat boundaries, event mapping and source bounds. Independently decode all six selected source ranges and all output frames. Verify H.264, yuv420p, dimensions 1280x720, SAR 1:1, no audio, actual decoded frame count 858, and every consecutive presentation timestamp at 1/30 second (stream frame-rate labels alone are insufficient). Inspect encode evidence to establish CRF <=18 or lossless eligibility; do not infer CRF from bitrate.\nCompare EVERY output decoded frame to the corresponding expected source picture using canonical planar YUV decoding with identical pixel format and no scaling or color conversion. For lossless encoding require exact decoded pixel-plane equality or equivalent per-frame hashes in sequence. For lossy encoding calculate and save per-frame pixel differences/PSNR or comparable metrics, inspect outliers and adjacent source-frame comparisons to expose temporal shifts; do not require byte equality of a lossy encode or blindly accept an aggregate score. Confirm no dropped/duplicated/invented frames, no unauthorized transforms, and no extra transitions at joins. Repeated identical source frames are legitimate if the declared source sequence itself repeats. Inspect all five hard-cut boundaries, each accent frame and neighboring frames visually against expected source frames. Check CSV event assertions retain the actual semantic first later-state frames and that before/change/after remain visible. Reuse prior visual evidence where sound but view the final accent neighborhoods. Store full per-frame audit data outside output/.\nReport passed only when all mandatory checks have actual evidence. Separate semantic_issues requiring source/event reassessment from technical repair issues. Missing capabilities or unverifiable claims are failures, not passes. Report actual output paths and a detailed audit report path.",
    "verify-deliverables-" + attempt, "Verify", technicalSchema
  );
}
let verification = await verifyOutputs(0);
for (let round = 1; round <= 2 && (!verification || !verification.passed); round++) {
  if (verification && verification.semantic_issues.length) break;
  rendered = await call(renderPrompt(verification || {issues: ["Independent audit returned no result; inspect deliverables and audit capability before repairing."]}, round), "repair-deliverables-" + round, "Assemble", renderSchema);
  if (!rendered || !rendered.completed) break;
  verification = await verifyOutputs(round);
}
const verified = Boolean(rendered && rendered.completed && verification && verification.passed && verification.semantic_issues.length === 0 && verification.observed_frame_count === beats.total_frames);
return {
  status: verified ? "verified" : "unresolved",
  deliverables: verified ? [ROOT + "/output/solution.mp4", ROOT + "/output/solution.json", ROOT + "/output/events.csv"] : [],
  candidate_outputs: rendered ? rendered.outputs : [],
  manifest,
  slot_evidence: states,
  verification,
  unresolved: verified ? [] : (verification ? [...verification.issues, ...verification.semantic_issues] : ["Final verification unavailable"]),
  failures,
  note: "Completion is supported only by actual future worker observations and the final audit, never by this script merely returning. No hidden key is accessed."
};