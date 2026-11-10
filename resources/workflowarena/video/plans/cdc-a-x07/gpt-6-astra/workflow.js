export const meta = {
  name: "coral-narration-picture-workflow",
  description: "Inspect the public coral footage, select six evidence-backed contiguous shots, synchronize the narrated camera event, render the cut, and verify all three deliverables.",
  phases: [
    {title: "Prepare public inputs", detail: "Confirm tools, narration, decoded frame counts, and inspection artifacts."},
    {title: "Inspect every candidate", detail: "Parallel visual cataloguing of all 37 anonymous clips."},
    {title: "Find exact source ranges", detail: "Evaluate each narration window and locate the camera event to a source frame."},
    {title: "Assemble deliverables", detail: "Resolve distinct-source constraints and render an unchanged-pixel hard-cut timeline."},
    {title: "Verify and repair", detail: "Check semantic fit, actual event timing, source traceability, and output specifications."}
  ]
};

const root = "/workspace";
const windows = [
  {window: 1, start: 0, end: 210, lines: [{time: "0.0", frame: 0, text: "A coral reef is one of the most crowded places in the sea: a huge school of fish streams densely past the lens, hugging the reef and almost hiding the rock behind it."}]},
  {window: 2, start: 210, end: 390, lines: [{time: "7.0", frame: 210, text: "Up close by day, the whole frame is tiny round cups packed side by side in neat rows. Each cup holds one polyp, and right now every polyp is pulled in."}]},
  {window: 3, start: 390, end: 630, lines: [{time: "13.0", frame: 390, text: "Night. In frame is an entire brain-coral colony, its surface speckled all over with white grains: the bundles have already been pushed up to the mouths."}]},
  {window: 4, start: 630, end: 870, lines: [
    {time: "21.0", frame: 630, text: "The moment arrives: the bundles leave the coral in clusters, and pink spheres drift past the lens one after another."},
    {time: "24.5", frame: 735, text: "The camera pulls back with them, and the whole releasing colony comes into frame together with its neighbour."}
  ]},
  {window: 5, start: 870, end: 1080, lines: [{time: "29.0", frame: 870, text: "The spheres keep rising and the reef is left below; all that remains in frame is dark water and gametes drifting everywhere."}]},
  {window: 6, start: 1080, end: 1290, lines: [{time: "36.0", frame: 1080, text: "Next morning, on a shallow reef flat: a thicket of interlaced coral branches, with schools of small fish weaving between them. This is the home they are carrying forward."}]}
];
const ids = Array.from({length: 37}, (_, i) => String(i + 1).padStart(2, "0"));
const context = `You are a future execution worker for CDC-A-X07, operating in ${root}. Read instruction.md and applicable workspace instructions using tools actually available to you. All task inputs are local; there is no network. Use only public task inputs; do not seek hidden references or evaluator information. Candidate IDs are random: neither ID, file size, checksum nor ordering indicates content. Never infer clip identities without viewing the footage. The English and Chinese narration files are input/narration.en.txt and input/narration.zh.txt. All 37 candidates are input/clips/01.mp4 through 37.mp4. Sources are nominally silent H.264 1280x720 30 fps, 6–11 s. Discover actual tools rather than assuming specific integrations exist. If visual inspection or decoding is unavailable, report the limitation instead of fabricating observations.

Deliver exactly output/solution.mp4, output/edl.json, output/events.csv. Drafts, code, contact sheets, reports, logs, and temporary renders belong in work/. Use six distinct candidates, exactly one contiguous source interval per narration window, at 1x in original direction. No picture synthesis, crop, scale, mirror, grade, overlays, transitions, freezes, interpolation, frame duplication, or dropped source frames. Only hard cuts between windows. Inspection thumbnails/contact sheets may be derived and labelled in work/; never use those altered previews in the final picture. Final video: H.264, yuv420p, 1280x720, SAR 1:1, constant 30/1 fps, no audio, 43.0 seconds, exactly 1290 decoded frames. EDL is {"segments":[...]} with exactly six ordered objects, each having window, source (two-digit ID), source_frames:[a,b], output_frames:[c,d], all frame indices integers with half-open intervals. Source frames count decoded presentation frames starting from source frame zero, not packet order. The only within-window narration line is 24.5 s, output frame 735; events.csv must have header line_time_s,output_frame and exactly its one event row, grounded in the actual picture event. Merely writing the desired time is not evidence of sync. Keep evidence and uncertainties explicit. Do not send messages externally or modify input files.

The known timeline, to be checked against the actual narration file, is:
${JSON.stringify(windows)}

The hypothetical total execution allowance is 3600 seconds. Favor useful inspection over long prose, batch frame extraction, use moderate encoder concurrency, and reserve time for rendering and verification. Workers share the workspace. Write only your assigned draft/report directory unless assigned ownership of output/.`;

const str = {type: "string"};
const integer = {type: "integer"};
const strings = {type: "array", items: str};
const object = (properties, required = Object.keys(properties)) => ({type: "object", properties, required, additionalProperties: false});
const issueSchema = object({severity: {type: "string", enum: ["blocking", "warning"]}, description: str, evidence: str, suggested_action: str});
const issues = {type: "array", items: issueSchema};
const workerErrors = [];
async function call(label, prompt, schema, group) {
  try {
    const result = await agent(context + "\n\nYOUR ASSIGNMENT:\n" + prompt, {label, phase: group, schema, agentType: "general-purpose"});
    if (result === null) workerErrors.push({label, error: "Worker returned no result"});
    return result;
  } catch (error) {
    workerErrors.push({label, error: String(error)});
    return null;
  }
}
function unresolved(stage, details) {
  return {status: "unresolved", stage, details, worker_errors: workerErrors, note: "No completion claim is made for missing or unverified work."};
}

const prepSchema = object({
  ready: {type: "boolean"},
  task_root: str,
  timeline_matches: {type: "boolean"},
  capabilities: strings,
  inventory_path: str,
  preview_index_path: str,
  clips: {type: "array", items: object({source: str, path: str, frame_count: integer, width: integer, height: integer, fps: str, pixel_format: str, sar: str, notes: str})},
  issues
});
const prep = await call("prepare-inputs", `Own work/prep/. Locate the task under /workspace; report its actual absolute root. Read both narration scripts, confirm the explicit six windows and internal event, and inventory every source. Probe/decode frame counts, frame rates, dimensions, pixel formats, SAR, and streams. Confirm usable video/image inspection tools and encoders. Create a compact machine-readable inventory and a visual preview index in work/prep/. If tools permit, create time-labelled contact sheets at approximately 0.5-second spacing plus first/last decoded frames for ALL candidates. Labels must identify actual decoded source frame numbers. Such sheets are navigation aids, not adequate evidence for exact event timing or entire-window suitability. Avoid producing thousands of full-size frames upfront; preserve original files for detailed review. Record any damaged inputs or mismatches. Do not render deliverables or select shots. Aim to finish preparation within about 4 minutes. Return readiness only if all sources, narration, and a viable way to inspect video are available.`, prepSchema, "Prepare public inputs");
if (!prep || !prep.ready || !prep.timeline_matches) return unresolved("preparation", prep);
const inventory = new Map(prep.clips.map(c => [c.source, c]));
if (ids.some(id => !inventory.has(id)) || prep.clips.length !== 37) return unresolved("preparation", {reason: "Inventory does not cover exactly 37 candidates", prep});
const workspace = prep.task_root;
const shared = `Actual task root: ${workspace}. Preparation: ${JSON.stringify(prep)}.`;

const catalogSchema = object({
  complete: {type: "boolean"},
  report_path: str,
  clips: {type: "array", items: object({
    source: str,
    viewed_full_duration: {type: "boolean"},
    description: str,
    temporal_changes: str,
    possible_windows: {type: "array", items: integer},
    useful_intervals: {type: "array", items: object({start_frame: integer, end_frame: integer, description: str})},
    events: {type: "array", items: object({kind: str, approximate_frame: integer, uncertainty_frames: integer, evidence: str})},
    disqualifiers: strings,
    evidence_paths: strings
  })},
  issues
});
const batches = Array.from({length: 6}, (_, i) => ids.filter((_, j) => j % 6 === i));
const catalogs = await parallel(batches.map((batch, index) => async () => {
  const assignment = `${shared}\nOwn work/catalog/group-${index + 1}/ only. Visually inspect ALL of these candidates: ${batch.join(", ")}. Use the shared previews to orient, then inspect each full clip by playback or sufficiently dense sequential decoded frames. Check full duration, not just its opening. Describe what is actually visible: fish density and reef occlusion; daytime cup morphology and polyp retraction; complete versus partial brain-coral colony, white bundles at mouths versus active release; pink spheres, camera movement and colony/neighbour reveal; dark water with versus without visible reef; branching reef-flat coral and small fish. These are narration distinctions, not assumptions about the footage. Record temporal changes and approximate source frames for camera pullback, reveal, release and scene changes. Identify plausible windows and negative evidence without committing to a final edit. A broad generic coral match is insufficient. Keep clips with uncertain identities or marginal content explicit so later specialists can reconsider them. Return one record per assigned ID, even when unusable. Aim for roughly 5–7 minutes; only inspect your assigned clips deeply at this stage.`;
  let result = await call(`catalog-${index + 1}`, assignment, catalogSchema, "Inspect every candidate");
  const good = r => r && r.complete && batch.every(id => r.clips.some(c => c.source === id && c.viewed_full_duration)) && r.clips.length === batch.length;
  if (!good(result)) result = await call(`catalog-${index + 1}-recover`, assignment + "\nThe first inspection was incomplete. Reuse any existing artifacts, fill only missing visual observations, and explicitly report blocked inspection. Previous result: " + JSON.stringify(result), catalogSchema, "Inspect every candidate");
  return result;
}));
const catalog = [];
for (let i = 0; i < batches.length; i++) {
  const r = catalogs[i];
  if (!r || !r.complete || r.clips.length !== batches[i].length || batches[i].some(id => !r.clips.some(c => c.source === id && c.viewed_full_duration))) {
    return unresolved("catalogue", {failed_batch: batches[i], result: r});
  }
  catalog.push(...r.clips);
}
catalog.sort((a,b) => a.source.localeCompare(b.source));

const choiceSchema = object({
  source: str,
  source_start: integer,
  source_end: integer,
  score: {type: "number", minimum: 0, maximum: 100},
  whole_range_verified: {type: "boolean"},
  fit_reason: str,
  range_reason: str,
  caveats: strings,
  evidence_paths: strings,
  events: {type: "array", items: object({line_time_s: str, source_frame: integer, output_frame: integer, onset_verified: {type: "boolean"}, definition: str, evidence: str})}
});
const windowSchema = object({window: integer, report_path: str, choices: {type: "array", items: choiceSchema}, rejected_alternatives: strings, issues});
const perWindow = await parallel(windows.map(w => () => call(`window-${w.window}`, `${shared}\nFull visual catalogue of all candidates: ${JSON.stringify(catalog)}\nOwn work/windows/${w.window}/ only. Find the best exact source range(s) for window ${w.window}: ${JSON.stringify(w)}. Inspect promising original clips yourself. Review catalogue negatives and thumbnails across all candidates to avoid overlooking a shot; do not treat scouts' guesses as authoritative. Compare visually similar distractors on every descriptive detail. Rewatch proposed ranges from first through final included frame and check that the narration is supported throughout. Use full-resolution frames for small polyps/bundles or morphology. Discard a range if the picture changes to contradictory content, if a transition is embedded, or if necessary duration cannot fit. Return up to four genuinely suitable choices, preferably different candidate IDs; do not fabricate alternatives to fill a quota. Score semantic and timing strength consistently on 0–100 and explain the rank. A candidate must be visually verified to enter choices. Exact source boundaries must be justified by visible content and available handles, not random clip numbering or assumed reference decisions. If several offsets remain equally plausible, disclose that ambiguity and prefer the most sustained and complete visual match, with a defensible start/end. Write detailed evidence to your report path.

For windows without internal events, return an empty events array. Window 4 has length 240 frames and an internal target at output 735, which is offset 105 from its output start 630. Locate the actual first frame of the narrated camera pullback/reveal event, inspect consecutive frames on both sides, and observe how the entire releasing colony and its neighbour come into view. Document both pullback onset and whole-colony/neighbour reveal if these differ; explain which observable onset corresponds to the narration beginning 'The camera pulls back with them'. Do not silently redefine the event as any convenient wide view. Let the observed event source frame be e: the necessary trim start is a=e-105 and end is a+240. Verify a>=0, end<=decoded source count, and all pre/post-event narration content. If multiple internal visual markers are discussed, only the event corresponding to the internal narration line belongs in the choices.events array. Return no suitable choice if the event cannot be established to a specific frame; record ambiguity for targeted follow-up. Do not write output/. Aim for about 7–9 minutes.`, windowSchema, "Find exact source ranges")));

function validChoice(choice, w) {
  if (!choice || !inventory.has(choice.source) || !choice.whole_range_verified) return false;
  if (![choice.source_start, choice.source_end].every(Number.isInteger)) return false;
  if (choice.source_start < 0 || choice.source_end > inventory.get(choice.source).frame_count || choice.source_end - choice.source_start !== w.end - w.start) return false;
  const internal = w.lines.filter(l => l.frame > w.start);
  if (choice.events.length !== internal.length) return false;
  return internal.every(line => choice.events.some(event => event.onset_verified && Number(event.line_time_s) === Number(line.time) && Number.isInteger(event.source_frame) && event.source_frame >= choice.source_start && event.source_frame < choice.source_end && event.output_frame === line.frame && w.start + event.source_frame - choice.source_start === line.frame));
}
function solve(results) {
  const options = windows.map((w, i) => (results[i]?.window === w.window ? results[i].choices : []).filter(c => validChoice(c, w)).sort((a,b) => b.score - a.score));
  let best = null;
  function visit(index, used, selected, score) {
    if (index === windows.length) {
      if (!best || score > best.score) best = {score, selected: selected.slice()};
      return;
    }
    for (const choice of options[index]) {
      if (used.has(choice.source)) continue;
      used.add(choice.source);
      selected.push(choice);
      visit(index + 1, used, selected, score + choice.score);
      selected.pop();
      used.delete(choice.source);
    }
  }
  visit(0, new Set(), [], 0);
  return {best, option_counts: options.map(o => o.length)};
}
let selection = solve(perWindow);
if (!selection.best) {
  const recoverySchema = object({reports: {type: "array", items: windowSchema}, issues});
  const recovery = await call("resolve-shot-constraints", `${shared}\nCatalogue: ${JSON.stringify(catalog)}\nWindow studies: ${JSON.stringify(perWindow)}\nDeterministic constraint result: ${JSON.stringify(selection)}\nOwn work/selection-recovery/. There is no verified combination of six distinct source IDs and correctly sized, synchronized ranges. Resolve missing visual evidence or source conflicts by inspecting original footage and existing reports, concentrating on deficient windows. Return complete replacement reports for all six windows, each retaining useful prior verified choices. Use the same source-frame event equation e-105 for window 4. Do not lower the visual or sync requirements to force a combination. State true blockers if no valid solution can be established. Do not write deliverables. Aim for no more than about 6 minutes.`, recoverySchema, "Find exact source ranges");
  if (recovery) {
    for (let i = 0; i < windows.length; i++) {
      const r = recovery.reports.find(x => x.window === windows[i].window);
      if (r) perWindow[i] = r;
    }
    selection = solve(perWindow);
  }
}
if (!selection.best) return unresolved("shot-selection", {selection, reports: perWindow});

const plan = windows.map((w,i) => ({
  window: w.window,
  source: selection.best.selected[i].source,
  source_frames: [selection.best.selected[i].source_start, selection.best.selected[i].source_end],
  output_frames: [w.start, w.end],
  evidence: selection.best.selected[i]
}));
const renderSchema = object({
  completed: {type: "boolean"},
  files: strings,
  manifest_path: str,
  render_log_path: str,
  segments: {type: "array", items: object({window: integer, source: str, source_frames: {type: "array", items: integer, minItems: 2, maxItems: 2}, output_frames: {type: "array", items: integer, minItems: 2, maxItems: 2}})},
  issues
});
const renderingInstructions = `You own output/ and work/render/. Save the evidence-backed selection, exact commands, and scripts to work/render/. Generate exactly the three requested deliverables. Decode sources in presentation order; trim by integer frame index with half-open [a,b), preserve every included frame once and original frame geometry and color, reset timestamps, and concatenate the six ranges with hard cuts. Do not use keyframe-only stream-copy cutting or approximate time seeks. Prefer lossless H.264/yuv420p encoding if the available encoder supports it, which permits exact decoded-pixel validation against original decoded frames. Use no color-changing conversion, resize, FPS resampling, transitions, or overlays. Set/retain SAR 1:1 and CFR 30/1 with monotonically spaced presentation timestamps; ensure no input audio maps to output. If lossless H.264 is unavailable, report that and choose the least destructive valid H.264 encoding, preserving geometry and timing; retain evidence for quantitative source traceability. Do not add extras to output/. Render to a temporary path under work/, validate it, then publish the three final files. Keep all unrelated existing user files safe; if output/ already contains unrelated files, report that rather than deleting them silently. EDL must contain only the prescribed segment fields. events.csv contains exactly header line_time_s,output_frame and row 24.5,735, but only after checking that the observed source event maps to that output frame. Check decode count and basic stream metadata before claiming completion.`;
let rendered = await call("render-cut", `${shared}\nSelected plan: ${JSON.stringify(plan)}\n${renderingInstructions}\nDo not change selection except to report a concrete rendering blocker. The selection was produced from visually inspected ranges. Aim for 3–5 minutes.`, renderSchema, "Assemble deliverables");
if (!rendered || !rendered.completed) return unresolved("render", rendered);

const verdictSchema = object({passed: {type: "boolean"}, report_path: str, checks: strings, issues});
async function verify(revision, renderResult) {
  return await parallel([
    () => call(`technical-verification-${revision}`, `${shared}\nRead current output/solution.mp4, output/edl.json, output/events.csv and inspect the actual source files. Renderer return: ${JSON.stringify(renderResult)}\nOwn work/qa/technical-${revision}/; do not edit deliverables. Independently verify exact output file set, JSON/CSV schemas, six distinct IDs, window lengths 210/180/240/240/210/210, source bounds, contiguous output coverage 0..1290, and event row mapping. Decode the entire final video and check all 1290 frames, H.264/yuv420p, 1280x720, SAR 1:1, 30/1 CFR via actual timestamp deltas, 43.0 s duration, no audio or other unexpected streams. Trace EVERY output frame to the EDL's source frame in decoded presentation order. Prefer per-frame decoded pixel equality/hash equality for lossless rendering; this simultaneously checks no altered pixels, omissions, duplicates, reversal, wrong crop/scale, or shifted cuts. If a lossy encoder was necessary, perform per-frame quantitative matching to the declared source and nearby source offsets, document tolerances and limitations, and investigate any ambiguity instead of asserting exact equality. Explicitly check frame pairs adjacent to each boundary and event frame 735. Keep mechanical checks reproducible in work/. A CSV row alone does not establish visual event correctness; that is separately reviewed. Record anything unverified as a blocking issue rather than passing it. Aim for about 3–5 minutes.`, verdictSchema, "Verify and repair"),
    () => call(`picture-verification-${revision}`, `${shared}\nWindow research: ${JSON.stringify(perWindow)}\nInitial selection rationale: ${JSON.stringify(plan)}\nCurrent renderer result: ${JSON.stringify(renderResult)}\nOwn work/qa/picture-${revision}/; read actual output files and sources, and do not edit deliverables. Independently watch the final 43-second cut with the public narration timeline. Verify each descriptive clause across its full window, including shot scale, abundance/density, time-of-day evidence, coral morphology, retracted versus extended polyps, bundles already at mouths versus release, neighbour reveal, absence of reef in the dark-water window, and shallow branching coral with fish in the final window. Do not infer unseen facts or reward generic topic similarity. Inspect selected source footage and strong catalogue alternatives if a choice is suspect. For the 24.5-second line, inspect consecutive output/source frames immediately before and after frame 735; independently locate the beginning of the narrated pullback/reveal event. Distinguish first camera motion from first complete view of the colony and neighbour and explain the chosen event definition against the exact narration. Verify actual event onset is 735, rather than trusting CSV or the selector. Check for contradictory frames at starts/ends and hard cuts only. Report concrete wrong or weak choices with source-frame evidence and actionable alternatives where possible. If the exact event or whole-window semantic fit is ambiguous, mark the limitation, not an unsupported pass. Do not claim knowledge of hidden reference choices. Aim for about 4–6 minutes.`, verdictSchema, "Verify and repair")
  ]);
}
let verdicts = await verify(0, rendered);
function passes(v) {
  return v.length === 2 && v.every(r => r && r.passed && !r.issues.some(i => i.severity === "blocking"));
}
const history = [{revision: 0, verdicts}];
for (let repairRound = 1; repairRound <= 2 && !passes(verdicts); repairRound++) {
  const actionable = verdicts.filter(Boolean).flatMap(v => v.issues.filter(i => i.severity === "blocking"));
  if (actionable.length === 0) {
    const missingIndices = verdicts.map((v,i) => (!v || !v.passed) ? i : -1).filter(i => i >= 0);
    if (missingIndices.length === 0) break;
    // Re-run verification for missing or incoherent verdicts; absence is never a pass.
    verdicts = await verify(`retry-${repairRound}`, rendered);
    history.push({revision: `verification-retry-${repairRound}`, verdicts});
    continue;
  }
  const repair = await call(`repair-${repairRound}`, `${shared}\nCatalogue: ${JSON.stringify(catalog)}\nWindow research: ${JSON.stringify(perWindow)}\nInitial plan: ${JSON.stringify(plan)}\nCurrent deliverables: ${JSON.stringify(rendered)}\nVerification findings: ${JSON.stringify(verdicts)}\nYou are the sole editor for this repair, owning output/, work/render/, and work/repair-${repairRound}/. Fix the specific verified blocking issues and their causes. For semantic or event failures, inspect the original candidate footage, compare credible alternatives, determine exact boundaries, and update EDL, picture, and event CSV together. For technical failures, repair only encoding, metadata, or assembly as necessary. Preserve the six-window/six-distinct-source constraints and exact source event equation. Do not shift the narration or fabricate a CSV timestamp to conceal a picture timing error. Reuse prior valid work; do not conduct another full catalogue unless evidence requires it. If the evidence cannot support a compliant cut, explicitly report that the repair is incomplete. ${renderingInstructions}\nReturn the actual revised segments and updated evidence manifest. Aim for about 5 minutes.`, renderSchema, "Verify and repair");
  if (!repair || !repair.completed) return unresolved("repair", {repairRound, repair, rendered, history});
  rendered = repair;
  verdicts = await verify(repairRound, rendered);
  history.push({revision: repairRound, verdicts});
}
return {
  status: passes(verdicts) ? "verified_against_public_requirements" : "unresolved",
  task_root: workspace,
  deliverables: rendered.files,
  segments: rendered.segments,
  evidence_manifest: rendered.manifest_path,
  verification: verdicts,
  repair_history: history,
  worker_errors: workerErrors,
  unresolved_issues: verdicts.flatMap(v => v ? v.issues.filter(i => i.severity === "blocking") : [{severity: "blocking", description: "Required verification worker returned no verdict", evidence: "Missing result", suggested_action: "Complete the missing verification"}]),
  limitations: ["Validation concerns the available public requirements and inspected footage; hidden reference choices are not accessible."]
};