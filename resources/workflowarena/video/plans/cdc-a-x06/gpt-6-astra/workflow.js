export const meta = {
  name: "two-trailers-evidence-first",
  description: "Inspect the anonymous public candidate pool, distinguish overlapping excerpts by their actual openings and endings, assemble both full-clip trailers, and verify all four deliverables.",
  phases: [
    {title: "Inventory and viewing material", detail: "Discover available tools, decode public inputs, and prepare source-derived inspection material."},
    {title: "Inspect the pool", detail: "Cover all 39 candidates without inferring identities from metadata."},
    {title: "Resolve slot selections", detail: "Compare related candidates against every narrative and film-language condition."},
    {title: "Assemble deliverables", detail: "Create both videos and their exact frame-based records."},
    {title: "Verify and repair", detail: "Check visual choices, evidence, frame correspondence, and packaging."}
  ]
};

// This initial workflow is submitted for planning only. Its body describes work
// future workers would perform if execution were enabled by a different host.
const ROOT = "/workspace";
const failures = [];
const sourceIds = Array.from({length: 39}, (_, i) => String(i + 1).padStart(2, "0"));
const expectedFiles = ["output/comedy.mp4", "output/suspense.mp4", "output/edl.json", "output/selection-evidence.json"];
const str = {type: "string"};
const int = {type: "integer"};
const bool = {type: "boolean"};
const strings = {type: "array", items: str};
const interval = {type: "array", items: int, minItems: 2, maxItems: 2};
function object(properties, required = Object.keys(properties)) {
  return {type: "object", properties, required, additionalProperties: false};
}
function array(items) { return {type: "array", items}; }
function json(value) { return JSON.stringify(value); }
async function call(label, progressPhase, prompt, schema) {
  try {
    const result = await agent(prompt, {label, phase: progressPhase, agentType: "general-purpose", schema});
    if (result === null) failures.push({label, reason: "Worker returned null"});
    return result;
  } catch (error) {
    failures.push({label, reason: String(error)});
    return null;
  }
}
function unresolved(stage, issues, details = {}) {
  return {status: "unresolved", stage, issues, ...details, workerFailures: failures};
}

const slots = [
  {version: "comedy", slot: "A1", title: "Entrance with irony", conditions: [
    "A smug gang enters; the audience sees an overhead hazard the gang does not notice.",
    "Opens on a tight close group shot of THREE small characters, eye-level to slightly low camera, pressing toward the lens.",
    "Then cuts to a LOW ANGLE with a heavy object suspended at the TOP of frame and a huge arm sweeping past the frame edge.",
    "Ends on a MEDIUM CLOSE shot of the leader holding a small object.",
    "The entire clip stays on the gang; all internal cuts are part of the selected full clip."
  ]},
  {version: "comedy", slot: "A2", title: "Peek gag", conditions: [
    "A single-take timing gag: peek, retreat, then the bystander pays for it.",
    "ONE LOCKED-OFF camera throughout; near tree trunk at FRAME LEFT screens the foreground, bird on a more distant branch at FRAME RIGHT.",
    "A character peeks from behind the trunk and ducks back.",
    "A small object flies in from OFF-SCREEN, hits the bird, and the bird leaves the frame.",
    "Ends on the EMPTY BRANCH."
  ]},
  {version: "comedy", slot: "A3", title: "Chain of close calls", conditions: [
    "An oblivious small character avoids several disasters from nowhere, with escalation and a completed payoff.",
    "WIDE shot stays on the small character throughout and opens with a CALM HOLD.",
    "First a large object ROLLS in from one side and grazes past; OTHER large objects then topple or drop.",
    "Ends with the character ALONE, UNHARMED, still absorbed in its own business."
  ]},
  {version: "comedy", slot: "A4", title: "Deadpan scale contrast", conditions: [
    "Huge figure silently appears behind an oblivious small character; size difference and a long pause create the gag.",
    "ONE essentially FIXED framing; small character in FOREGROUND busy with what is in front of it.",
    "Huge character WALKS IN from a FRAME EDGE and STOPS immediately behind the small character.",
    "Both remain in the shared frame; the PAUSE HOLDS UNTIL THE END without the small character noticing."
  ]},
  {version: "comedy", slot: "A5", title: "Closing button", conditions: [
    "The character that thinks it is winning walks into the opponent's grip; captor's sly grin is the button.",
    "Opens on a MEDIUM shot of a small character edging along a BRANCH toward a huge figure at FRAME RIGHT, whose BACK IS TO CAMERA.",
    "A big hand GRABS the small character.",
    "Cuts to a CLOSE TWO-SHOT with the captor GRINNING.",
    "Ends WHILE THE PICTURE IS FADING DOWN toward black; the fade must already exist in the source."
  ]},
  {version: "suspense", slot: "B1", title: "Being watched", conditions: [
    "Establishes that someone in the dark watches unaware small characters.",
    "Opens LOW-ANGLE WIDE on several small characters walking along a path TOWARD CAMERA.",
    "One walks up to the lens and FILLS THE FRAME, creating a wipe-like transition.",
    "Cuts to a HIGH-ANGLE SUBJECTIVE view down through FOREGROUND LEAVES; a huge DARK SHAPE intrudes from RIGHT FOREGROUND.",
    "Ends BACK on an EYE-LEVEL MEDIUM shot of the unaware characters."
  ]},
  {version: "suspense", slot: "B2", title: "The threat behind", conditions: [
    "Audience sees danger the character does not; tension remains without release.",
    "DEEP STAGING in ONE essentially FIXED framing, unsuspecting small character FOREGROUND, head down and busy.",
    "Huge SILHOUETTE WALKS IN from OFF-SCREEN and STOPS behind, LOOMING over it.",
    "Clip STAYS IN THIS TENSION WITHOUT RELEASE until its end."
  ]},
  {version: "suspense", slot: "B3", title: "Watching from cover, then a strike", conditions: [
    "Hidden figure watches from cover, then an off-screen strike makes the bystander vanish.",
    "ONE LOCKED-OFF camera throughout, near trunk screening the FOREGROUND, bystander on a more distant branch.",
    "Hidden figure LEANS OUT and DISAPPEARS again.",
    "An object flies from OFF-SCREEN and hits the bystander, which VANISHES from frame.",
    "Ends with the EMPTY shot held."
  ]},
  {version: "suspense", slot: "B4", title: "Delay and shock", conditions: [
    "An unsuspecting character is held long enough to create anticipation; danger interrupts but the outcome remains unresolved.",
    "WIDE shot, STATIC camera; opens with a LONG, STILL HOLD.",
    "A HUGE object ROLLS in from OFF-SCREEN and CLOSES on the character.",
    "Ends at the MOST DANGEROUS MOMENT as the object bears down, BEFORE showing what happens. Do not choose a clip that continues into the escape or payoff."
  ]},
  {version: "suspense", slot: "B5", title: "Stinger", conditions: [
    "A harmless small object falls and reveals hidden ground danger; threat remains unresolved.",
    "Opens LOW-ANGLE WIDE on an EMPTY patch of ground.",
    "Small object DROPS FROM TOP of frame and BOUNCES.",
    "HARD CUT to CLOSE INSERT showing the object IMPALED on something hidden in the ground.",
    "Ends STATIC WIDE on a CLEARING COVERED with these hidden things, with NO CHARACTER in frame."
  ]}
];
const slotMap = Object.fromEntries(slots.map(s => [s.slot, s]));
const common = `You are a future worker completing CDC-A-X06 in ${ROOT}. Read instruction.md and applicable actual workspace instructions using tools that are available to you. All needed task inputs are local; there is no network. The public inputs are input/01.mp4 through input/39.mp4, silent H.264, nominally 640x360 square pixels, 24 fps, about 6.7-12 seconds each. Numbers are randomized, and clips can overlap or contain different openings/endings of the same scene. Never infer identity from filename, byte size, checksums, presumed film identity, or story order. Never seek hidden evaluation/reference selections. Only inspected public visual evidence supports a choice.
Python 3.11 and FFmpeg/ffprobe are available to future workers. Discover any actual visual-viewing tools instead of assuming a tool name. If you cannot inspect images/video, report that limitation explicitly; metadata or invented visual descriptions cannot substitute for seeing the frames. Source-derived contact sheets and extracted frames are allowed inspection material; generated imagery is forbidden. Preserve original inputs. Use work/ for all temporary files, scripts, logs and inspection artifacts. Only the designated assembly or repair worker writes output/; other workers are read-only there. Do not send messages externally or use network services. Shared workspace requires exclusive ownership of assigned scratch paths. Bound FFmpeg concurrency and thread counts for CPU-only execution.
The final trailers each contain five DIFFERENT full candidates in exact slot order, at original direction and 1x speed, with hard cuts only. Reuse ACROSS versions is allowed and must not be discouraged. No trimming, cropping, mirroring, grading, added text, frame insertion/deletion, generated material, audio, or added transitions. Internal source cuts/fades are retained. Source selection must match EVERY slot condition, including the literal opening and ending. Do not choose a merely similar action with the wrong endpoint.
`;
const contract = `Deliver exactly four files in output/: comedy.mp4, suspense.mp4, edl.json, selection-evidence.json. MP4s: H.264/yuv420p, 640x360, SAR 1:1, constant 24/1 fps, no audio. Stream-copy concatenation is allowed if valid; re-encoding must use CRF <=18. Lossless x264 CRF 0 is an allowed preference for verifiable pixel preservation.
edl.json is {"comedy":{"segments":[...]},"suspense":{"segments":[...]}}. Exactly five segment objects per version, in A1..A5 or B1..B5 order. Each object contains slot, source as a two-digit string NN, output_frames:[start,endExclusive], source_frames:[0,actualDecodedSourceFrameCount], and output:[start/24,end/24] in seconds. Intervals begin at 0 and are contiguous. Seconds differ from frames/24 by no more than 0.001. Final end equals actual decoded output frame count.
selection-evidence.json is an array of EXACTLY ten objects, each with version, slot, source, source_frames:[a,b], reason. Each interval spans at least 12 source frames with endpoints inside that candidate. Use integer 0<=a<b<decodedFrameCount conservatively so both endpoints are valid frame indices. Each reason identifies the most similar OTHER candidate by its two-digit ID and names a SPECIFIC VISIBLE DIFFERENCE, rather than only repeating the slot or claiming a mood difference. Evidence intervals are short supporting excerpts, NOT edit trims; the actual video always uses each selected clip in full. Keep comparison evidence and expanded rationales in work/, not extra fields/files in output/.`;

const inventorySchema = object({
  status: {type: "string", enum: ["ready", "blocked"]},
  taskRoot: str,
  visualInspectionAvailable: bool,
  visualMethod: str,
  manifestPath: str,
  overviewPath: str,
  clips: array(object({source: str, path: str, frameCount: int, width: int, height: int, fps: str, sar: str, pixelFormat: str, contactSheets: strings, firstFramePath: str, lastFramePath: str})),
  issues: strings
});
const prepPrompt = common + `
Your assignment is INVENTORY AND INSPECTION PREPARATION, not clip selection. Own work/inventory/ only, plus creation of work/ if necessary. Locate the actual task root under /workspace if instruction.md indicates a nested root. Confirm all 39 files and available tools. Read public CREDITS.md if relevant but do not infer clip contents from it. Probe each source and count ACTUALLY DECODED frames, checking timing, dimensions, SAR, pixel format, and decode errors. Save a machine-readable inventory with paths, exact counts, timestamps/time-base information, stream properties, and any anomalies to work/inventory/manifest.json. Do not accept duration*24 or an unverified container nb_frames as exact counts.
Create readable, source-derived contact sheets for ALL 39 clips, including exact first/last frames, several early/late frames, and regular temporal samples spanning the whole clip (roughly one per second, denser at endpoints). Label sheets with source ID and zero-based SOURCE FRAME INDEX in the scratch sheet margin, never alter source pixels or final media. Keep extracted image counts modest and sheet cells large enough to see camera framing and small characters. Save an overview/index mapping IDs to sheets and first/last frame files. A sheet is only triage; later workers will inspect dense sequences for timing and cuts. Where feasible record simple frame-difference cut candidates or perceptual matches to help find overlapping excerpts, but do not treat such scores as semantic evidence.
Test the actual ability to VIEW a sample sheet through available tools and report the method. If visual access is unavailable, report blocked. Limit decoding to at most two concurrent FFmpeg processes and modest thread counts. Return the structured inventory; do not write output/ or make selections.`;
let inventory = await call("inventory", "Inventory and viewing material", prepPrompt, inventorySchema);
if (!inventory) inventory = await call("inventory-recover", "Inventory and viewing material", prepPrompt + "\nA previous worker did not return a usable result. Inspect and reuse any valid existing work/inventory artifacts; finish only missing work.", inventorySchema);
if (!inventory) return unresolved("inventory", ["No usable inventory returned."]);
const inventoryIssues = [];
if (inventory.status !== "ready") inventoryIssues.push(...inventory.issues, "Inventory worker did not report ready.");
if (!inventory.visualInspectionAvailable) inventoryIssues.push("Actual visual inspection is unavailable.");
if (inventory.clips.length !== 39 || new Set(inventory.clips.map(c => c.source)).size !== 39) inventoryIssues.push("Inventory does not contain exactly 39 distinct clips.");
for (const id of sourceIds) {
  const c = inventory.clips.find(c => c.source === id);
  if (!c || !Number.isInteger(c.frameCount) || c.frameCount < 13) inventoryIssues.push("Missing or invalid decoded count for " + id);
  else if (c.width !== 640 || c.height !== 360 || !["24/1", "24"].includes(c.fps) || !["1:1", "1/1"].includes(c.sar)) inventoryIssues.push("Input format anomaly requires resolution: " + id);
}
if (inventoryIssues.length) return unresolved("inventory", inventoryIssues, {inventory});
const clipsById = Object.fromEntries(inventory.clips.map(c => [c.source, c]));
const context = common + "\nConfirmed task root and inventory:\n" + json(inventory) + "\nAll slot requirements:\n" + json(slots);

const scoutRecordSchema = object({
  source: str,
  opening: str,
  eventsAndCuts: str,
  ending: str,
  framingAndMotion: str,
  possibleSlots: strings,
  exclusionsAndUncertainties: strings,
  inspectedFrames: interval,
  observationPath: str
});
const scoutSchema = object({status: {type: "string", enum: ["complete", "blocked"]}, records: array(scoutRecordSchema), reportPath: str, issues: strings});
const batches = [sourceIds.slice(0, 13), sourceIds.slice(13, 26), sourceIds.slice(26)];
function scoutPrompt(ids, i) {
  return context + `\nInspect candidate batch ${i + 1}: ${json(ids)}. Own work/scout-${i + 1}/ only. This is exhaustive visual cataloging, not a final vote. Review the prepared sheets for every assigned source, then inspect additional frames or full playback with actual tools as needed to identify each full clip's opening, ordered events/internal cuts, camera angle/scale/movement, and literal ending. Include all assigned IDs even if irrelevant to all slots. Record concrete actions with source frame indices, especially whether the rolling-threat outcome is withheld or completed, a looming entrance starts off-screen and holds to the end, a branch is empty at the end, and a fade is already underway. Never claim to have watched unsampled frames. The inspectedFrames interval describes the inspected temporal extent, not a claim that every frame was viewed. Explicitly report ambiguity and coarse sampling. A candidate can serve more than one slot or version; retain all plausible matches, and do not eliminate variants without checking endpoints. Save detailed notes and additional source-derived frames in your owned directory; return concise observations for every source. All other scratch is read-only. Do not modify output/.`;
}
let scoutResults = await parallel(batches.map((ids, i) => () => call("pool-scout-" + (i + 1), "Inspect the pool", scoutPrompt(ids, i), scoutSchema)));
for (let i = 0; i < batches.length; i++) {
  const valid = r => r && r.status === "complete" && r.records.length === batches[i].length && new Set(r.records.map(x => x.source)).size === batches[i].length && batches[i].every(id => r.records.some(x => x.source === id));
  if (!valid(scoutResults[i])) scoutResults[i] = await call("pool-scout-recover-" + (i + 1), "Inspect the pool", scoutPrompt(batches[i], i) + "\nPrevious result was missing, blocked or incomplete: " + json(scoutResults[i]) + ". Reuse existing scratch, directly resolve gaps, and return all assigned records.", scoutSchema);
  if (!valid(scoutResults[i])) return unresolved("pool inspection", ["Visual coverage failed for batch " + (i + 1)], {inventoryPath: inventory.manifestPath, scoutResults});
}
const catalog = scoutResults.flatMap(r => r.records).sort((a, b) => a.source.localeCompare(b.source));
const catalogContext = context + "\nComplete preliminary visual catalog (observations, not ground truth):\n" + json(catalog) + "\nCatalog detail paths:\n" + json(scoutResults.map(r => r.reportPath));

const conditionSchema = object({conditionIndex: int, satisfied: bool, observed: str, sourceFrames: interval});
const choiceSchema = object({
  version: {type: "string", enum: ["comedy", "suspense"]},
  slot: str,
  source: str,
  source_frames: interval,
  reason: str,
  runnerUpSource: str,
  runnerUpFrames: interval,
  openingObservation: str,
  endingObservation: str,
  conditionChecks: array(conditionSchema),
  comparisonPath: str,
  uncertainties: strings
});
const selectionSchema = object({status: {type: "string", enum: ["ready", "needs_review", "blocked"]}, selections: array(choiceSchema), issues: strings, reportPath: str});
const families = [
  {name: "entrances", slots: ["A1", "B1"], focus: "Distinguish the tight gang/overhead hazard/leader ending from low wide approach/lens wipe/high subjective foliage/right dark shape/medium ending. Inspect actual shot order and both endpoints."},
  {name: "peek-and-strike", slots: ["A2", "B3"], focus: "Check the whole locked-off take, foreground trunk and branch layout, visible peek and retreat, off-screen projectile, bystander exit, and final empty hold. Same source may legitimately serve both versions. Compare variants' pre-peek and post-strike durations and missing actions."},
  {name: "rolling-danger", slots: ["A3", "B4"], focus: "Precisely distinguish the completed escalating chain of several close calls and unharmed ending from a long still hold ending at the first imminent impact before outcome. Measure calm hold and event/end frames. A partial overlap is not enough."},
  {name: "looming-figure", slots: ["A4", "B2"], focus: "Check fixed deep staging, foreground activity, the huge figure walking in from off-screen, its stop behind the unaware character, and the sustained shared-frame hold without release. Same source may be correct in both versions; do not manufacture a difference solely because tone differs."},
  {name: "comedy-button", slots: ["A5"], focus: "Verify initial medium branch approach, captor on right with back to camera, actual grab, cut to close two-shot grin, and final frames already fading. A grin without a source fade or a clip opening after the grab is insufficient."},
  {name: "ground-stinger", slots: ["B5"], focus: "Verify empty low wide ground at opening, object entering from top and bouncing, hard cut to impalement insert, and final static wide clearing of hidden hazards with no character. Inspect every shot boundary and actual last frame."}
];
function choiceProblems(choices, requestedSlots, requireCertain) {
  const issues = [];
  if (!Array.isArray(choices) || choices.length !== requestedSlots.length) return ["Incorrect number of slot choices."];
  for (const slot of requestedSlots) {
    const matches = choices.filter(c => c.slot === slot);
    if (matches.length !== 1) { issues.push("Expected one choice for " + slot); continue; }
    const c = matches[0];
    const specification = slotMap[slot];
    if (c.version !== specification.version) issues.push(slot + ": version mismatch");
    const src = clipsById[c.source];
    const other = clipsById[c.runnerUpSource];
    if (!src) { issues.push(slot + ": unknown source"); continue; }
    if (!other || c.runnerUpSource === c.source) issues.push(slot + ": missing distinct inspected comparator");
    const validRange = (range, n) => range && range.length === 2 && range.every(Number.isInteger) && range[0] >= 0 && range[1] < n && range[1] - range[0] >= 12;
    if (!validRange(c.source_frames, src.frameCount)) issues.push(slot + ": invalid supporting interval");
    if (other && !validRange(c.runnerUpFrames, other.frameCount)) issues.push(slot + ": invalid comparison interval");
    if (!c.reason.trim() || !c.reason.includes(c.runnerUpSource)) issues.push(slot + ": reason must explicitly identify the similar other candidate");
    if (!c.openingObservation.trim() || !c.endingObservation.trim()) issues.push(slot + ": missing endpoint observations");
    if (c.conditionChecks.length !== specification.conditions.length || new Set(c.conditionChecks.map(x => x.conditionIndex)).size !== specification.conditions.length) issues.push(slot + ": incomplete condition checklist");
    for (let i = 0; i < specification.conditions.length; i++) {
      const check = c.conditionChecks.find(x => x.conditionIndex === i);
      if (!check || (requireCertain && !check.satisfied)) issues.push(slot + ": condition " + i + " is not verified");
      if (check && (!check.observed.trim() || check.sourceFrames.length !== 2 || !check.sourceFrames.every(Number.isInteger) || check.sourceFrames[0] < 0 || check.sourceFrames[1] <= check.sourceFrames[0] || check.sourceFrames[1] > src.frameCount)) issues.push(slot + ": invalid condition evidence " + i);
    }
    if (requireCertain && c.uncertainties.length) issues.push(slot + ": unresolved visual uncertainty");
  }
  for (const version of ["comedy", "suspense"]) {
    const ids = choices.filter(c => c.version === version).map(c => c.source);
    if (new Set(ids).size !== ids.length) issues.push("Repeated source within " + version);
  }
  return issues;
}
function familyPrompt(family) {
  const requested = family.slots.map(id => slotMap[id]);
  return catalogContext + "\n" + contract + `\nYou own work/compare-${family.name}/. Resolve only these slots: ${json(requested)}. Focus: ${family.focus}
Use the ENTIRE 39-source catalog and overview to find every plausible scene variant; scout possibleSlots are only hints. Check the global overview yourself for potentially missed variants. Inspect each plausible candidate's exact first and last decoded frames, all internal cuts, full event order and any decisive timing using dense frame sequences or playback. For close alternatives, compare corresponding visible frames and offset/overlap, preserving each clip's independent start and end. Automated image similarity can locate overlap, but the final inference must come from visible content. Do not infer that a choice is correct because a thumbnail merely shows the right scene.
Return a proposed selection for each assigned slot, every zero-based conditionIndex checked with concrete observations and source-frame intervals [start,endExclusive]. Identify the MOST SIMILAR OTHER candidate after examining relevant alternatives, with a >=12-frame comparison interval whose endpoints are valid source indices. Explain specifically why the chosen full clip matches and the nearest variant does not (e.g. different first shot, missing retreat, already-resolved danger, no final fade, shorter or absent ending hold). Do not use encoding or file-size differences as evidence. The reason must explicitly include the rival's two-digit ID and a visible contrast supported by the selected >=12-frame source_frames interval. The evidence interval is not a trim. Retain expanded comparisons, including rejected candidate IDs, examined frame indices and artifacts, in comparisonPath under your directory. If two candidates remain indistinguishable, densely inspect endpoints and event boundaries; do not assert certainty without resolution. Return needs_review with specific remaining questions if necessary. Output/ stays untouched. Limit your own FFmpeg jobs to one at a time with modest threads.`;
}
let familyResults = await parallel(families.map(family => () => call("compare-" + family.name, "Resolve slot selections", familyPrompt(family), selectionSchema)));
for (let i = 0; i < families.length; i++) {
  if (!familyResults[i]) familyResults[i] = await call("compare-recover-" + families[i].name, "Resolve slot selections", familyPrompt(families[i]) + "\nThe earlier worker returned no result. Recover any usable work in the owned directory and complete the comparisons.", selectionSchema);
  if (!familyResults[i]) return unresolved("candidate comparison", ["Comparison worker failed for " + families[i].name], {familyResults});
}
let proposed = familyResults.flatMap(r => r.selections);
const allSlotIds = slots.map(s => s.slot);
const initialProblems = choiceProblems(proposed, allSlotIds, false);

const resolverPrompt = catalogContext + "\n" + contract + `\nYou are the selection editor and independent visual reviewer. Own work/selection/ only. Review and resolve the proposals below into a single authoritative ten-slot selection. No editing or encoding yet. These proposals are untrusted working judgments, and needs_review/blocked is data requiring investigation, not evidence of success.
Inspect selected candidates and their closest rivals directly using real visual tools; consult all family comparison artifacts. Check exact opening/ending, shot order, camera framing, entrances/exits, threat release vs withholding, and timing against every condition. Challenge overlaps especially A3/B4, A1/B1, and A5's fade. Cross-version reuse is allowed, and A2/B3 or A4/B2 should not be forced apart. Resolve within-version duplicate conflicts by finding choices that genuinely meet all relevant slots, not arbitrary swapping. If a choice changes, reconsider its nearest rival and the evidence interval/reason. For uncertain families, expand to all relevant sources in the catalog and inspect dense boundary sequences. Do not select by number or metadata. Return ready only when all ten slots have direct evidence and no unresolved material question; otherwise return specific blockers with the best supported proposals.
Save authoritative selections and a human-readable comparison report under work/selection/, including source frame counts, condition checks, alternate comparisons, and actual viewed frame indices. Never claim a hidden reference match. The output evidence must later contain only the public fields, but your return retains review metadata.
Family results:\n` + json(familyResults) + "\nStructural problems to resolve:\n" + json(initialProblems);
let resolved = await call("resolve-selections", "Resolve slot selections", resolverPrompt, selectionSchema);
if (!resolved) resolved = await call("resolve-selections-recover", "Resolve slot selections", resolverPrompt + "\nEarlier resolution returned no usable result. Reuse any saved selection work and finish the verification.", selectionSchema);
if (!resolved) return unresolved("selection resolution", ["No authoritative selection returned."], {familyResults});
let selectionProblems = choiceProblems(resolved.selections, allSlotIds, true);
if (resolved.status !== "ready" || selectionProblems.length) {
  resolved = await call("resolve-specific-gaps", "Resolve slot selections", resolverPrompt + "\nPrevious resolution:\n" + json(resolved) + "\nRemaining structural/verification problems:\n" + json(selectionProblems) + "\nPerform a targeted second pass only on outstanding questions, preserving already verified choices unless new evidence contradicts them. This is the final pre-assembly resolution pass. If actual tools or public evidence cannot resolve a requirement, report it plainly.", selectionSchema);
  if (!resolved) return unresolved("selection resolution", ["Targeted resolution failed."]);
  selectionProblems = choiceProblems(resolved.selections, allSlotIds, true);
}
if (resolved.status !== "ready" || selectionProblems.length) return unresolved("selection resolution", [...resolved.issues, ...selectionProblems], {selection: resolved});
let selected = allSlotIds.map(id => resolved.selections.find(c => c.slot === id));

function buildPlan(choices) {
  const edl = {};
  for (const version of ["comedy", "suspense"]) {
    let cursor = 0;
    const segments = slots.filter(s => s.version === version).map(spec => {
      const c = choices.find(c => c.slot === spec.slot);
      const n = clipsById[c.source].frameCount;
      const segment = {slot: c.slot, source: c.source, output_frames: [cursor, cursor + n], source_frames: [0, n], output: [cursor / 24, (cursor + n) / 24]};
      cursor += n;
      return segment;
    });
    edl[version] = {segments};
  }
  const evidence = choices.map(c => ({version: c.version, slot: c.slot, source: c.source, source_frames: c.source_frames, reason: c.reason}));
  return {edl, evidence};
}
let plan = buildPlan(selected);
const assemblySchema = object({status: {type: "string", enum: ["complete", "blocked"]}, files: strings, reportPath: str, decodedOutputCounts: object({comedy: int, suspense: int}), commandsPath: str, issues: strings});
const assemblyPrompt = context + "\n" + contract + `\nYou are the sole ASSEMBLY worker. Own output/ and work/assembly/. Use this authoritative plan without making new selections:\n${json(plan)}\nExpanded source-selection evidence is at ${resolved.reportPath}.
Write the two JSON deliverables exactly to the public shape and values in the plan. Before rendering, independently confirm the input decoded counts agree with the inventory; if they differ, report blocked instead of silently changing the EDL.
Create each movie from the five FULL decoded sources in declared order. Prefer a deterministic lossless x264 CRF 0 encode of the concatenated source frame stream, keeping yuv420p pixels if inputs are yuv420p. A robust path is sequentially decode every source to raw yuv420p with FFmpeg passthrough frame handling, pipe their exact complete raw frame sequences to one encoder with explicit rawvideo dimensions 640x360 and input rate 24, encode libx264 CRF 0, SAR 1:1, no audio, and MP4 container. Use Python subprocess argument arrays and streaming writes, not shell interpolation; propagate each decoder/encoder exit code. Do not hold all uncompressed video in memory. Avoid fps conversion filters, input seeking, trims, shortest, interpolation, looping, and timestamp-driven duplication/drop. Keep source frame order and set the output timeline from sequential frame indices at 24 fps. Preserve source color metadata consistently where applicable without applying a grade. Use modest CPU thread counts and sequential encoding if necessary.
Alternatively stream-copy only if stream compatibility and packet timing are sound and final decoded frame sequences and constant frame timestamps verify; lossless re-encode is the fallback when concatenation timestamps fail. Container duration alone is not proof of frame preservation. All transforms must comply with the contract; do not add any title, fade, transition, audio, or image. An existing source fade must remain intact.
Stage media in work/assembly/ and publish completed outputs after basic decode/count checks. If output/ already has unrelated files, preserve them in work/assembly/prior-output/ instead of destroying them; finish with exactly the four required deliverables. Save scripts, commands, exit results, and basic media/JSON checks in work/assembly/. Check output frame counts against the final EDL endpoints, no audio, correct dimensions/SAR/fps/pixel format, and exact directory membership. Return actual file paths and counts, not just an intention.`;
let assembled = await call("assemble-trailers", "Assemble deliverables", assemblyPrompt, assemblySchema);
if (!assembled) assembled = await call("assemble-recover", "Assemble deliverables", assemblyPrompt + "\nAn earlier assembly worker returned no usable result. Inspect existing scripts and staged/output files, verify before reusing, and complete missing work. Do not assume partial files are valid.", assemblySchema);
if (!assembled || assembled.status !== "complete") return unresolved("assembly", assembled ? assembled.issues : ["Assembly worker failed."], {selection: selected, plan, assembly: assembled});

const issueSchema = object({category: {type: "string", enum: ["selection", "evidence", "media", "edl", "packaging", "inspection_access"]}, slots: strings, description: str, observedEvidence: str, suggestedAction: str});
const checkSchema = object({
  passed: bool,
  allRequirementsChecked: bool,
  frameCorrespondence: {type: "string", enum: ["exact", "lossy-validated", "failed", "unverified"]},
  reportPath: str,
  issues: array(issueSchema),
  outputs: array(object({version: str, file: str, actualDecodedFrames: int, declaredFrames: int, metadataValid: bool, frameTimingValid: bool, sourceOrderVerified: bool})),
  visualSlotsVerified: strings,
  evidenceSlotsVerified: strings
});
function verifyPrompt(round, currentPlan, currentSelected, assembly) {
  return catalogContext + "\n" + contract + `\nIndependent final verification, round ${round}. Own work/verify-${round}/ only. output/ and other scratch are read-only. Inspect ACTUAL FILES, not just worker statements. Authoritative expected plan:\n${json(currentPlan)}\nExpanded selections:\n${json(currentSelected)}\nAssembly report:\n${json(assembly)}
Perform these checks and save executable validation code/results in your owned directory:
1. Exactly four specified files in output/. Parse both JSON documents, enforce exact public fields, ten distinct expected (version,slot) entries, five unique sources within each version, valid zero-padded IDs, slot order, full source intervals, contiguous half-open output frames from zero, seconds within 0.001 of frames/24, and output endpoint equals independently decoded frame count. Validate evidence ranges span >=12 frames with endpoints inside each source and sources match EDL.
2. Independently ffprobe and decode both videos fully. Verify H.264, yuv420p, 640x360, SAR 1:1, no audio, nominal and actual constant 24/1 presentation cadence, no decode errors. Check presentation timestamps advance at 1/24 within container-time-base precision; do not confuse coded B-frame order with presentation order. Validate first/last frames of every segment and every concatenation boundary.
3. Check EVERY output frame against its declared source frame, not merely totals or sampled pictures. For the preferred lossless encode, stream normalized decoded yuv420p frame hashes from each original candidate and the output, compare the entire sequence according to EDL, and require exact equality when source pixels are already yuv420p. Record the first mismatch indices if any, including boundary shifts, duplicated or missing frames. If assembly used lossy CRF<=18, inspect the actual encoding settings and run full frame-aligned error/similarity comparisons plus sequence/neighbor alignment checks and direct review of suspicious frames; report the quantitative evidence and limitations rather than declaring byte identity. Prefer lossless repair when correspondence is ambiguous. Handle legitimate static repeated source frames without falsely claiming inserted frames. Do not accept matching durations alone.
4. Independently VIEW every selected source, its relevant closest rival, and output boundary frames against every slot condition. Verify literal beginning/ending, internal cuts, fixed camera vs movement, object entry/exit, unresolved vs completed action, held pauses, and source fade. Review the closest-alternative comparisons against the complete public catalog so an obviously more similar variant is not overlooked. For evidence, view the declared source interval and comparator frames; verify each reason is true, specific, names the actual most similar other candidate and expresses a visible difference. Tone labels alone do not suffice. A/B reuse is explicitly legal.
Return passed only if every deliverable requirement and all ten visual slot/evidence checks are actually established. Missing visual access or failed comparisons are failures, not caveats to a pass. Keep issues concrete, with affected slots, observed frame numbers, and a repair direction. Do not modify deliverables. Do not claim knowledge of hidden selections.`;
}
function verificationProblems(v, expectedPlan) {
  const problems = [];
  if (!v) return ["No verification result returned."];
  if (!v.passed || !v.allRequirementsChecked || v.issues.length) problems.push("Verifier reported failed or incomplete checks.");
  if (!["exact", "lossy-validated"].includes(v.frameCorrespondence)) problems.push("Frame correspondence is not verified.");
  for (const field of ["visualSlotsVerified", "evidenceSlotsVerified"]) {
    if (v[field].length !== 10 || new Set(v[field]).size !== 10 || !allSlotIds.every(id => v[field].includes(id))) problems.push("Incomplete " + field);
  }
  if (v.outputs.length !== 2 || new Set(v.outputs.map(o => o.version)).size !== 2) problems.push("Incomplete output video checks.");
  for (const version of ["comedy", "suspense"]) {
    const o = v.outputs.find(x => x.version === version);
    const n = expectedPlan.edl[version].segments[4].output_frames[1];
    if (!o || !o.metadataValid || !o.frameTimingValid || !o.sourceOrderVerified || o.actualDecodedFrames !== n || o.declaredFrames !== n) problems.push("Failed media checks for " + version);
  }
  return problems;
}
let verdict = await call("verify-deliverables-0", "Verify and repair", verifyPrompt(0, plan, selected, assembled), checkSchema);
if (!verdict) verdict = await call("verify-deliverables-recover", "Verify and repair", verifyPrompt(0, plan, selected, assembled) + "\nPrior verification returned no usable result. Inspect work/verify-0/ and complete missing checks; absence is not a pass.", checkSchema);
let problems = verificationProblems(verdict, plan);

// At most two evidence-driven repair passes: one can correct a discovered
// selection/encoding problem, and a second can address a concrete regression.
// No additional workers run after all requirements pass.
for (let round = 1; problems.length && round <= 2; round++) {
  if (!verdict) break;
  if (verdict.issues.some(i => i.category === "inspection_access")) break;
  const needsSelectionRepair = verdict.issues.some(i => i.category === "selection" || i.category === "evidence");
  if (needsSelectionRepair) {
    const correction = await call("correct-selection-" + round, "Verify and repair", catalogContext + "\n" + contract + `\nOwn work/selection-repair-${round}/. Repair only actual selection/evidence problems raised by independent verification, rechecking related choices when necessary. Inspect public sources and nearest alternatives directly; fix reasons and intervals only when visually supported. Do not change clips merely to evade a failing check. Return the complete authoritative ten-slot selection and save its report. Do not edit output/. Current choices:\n${json(selected)}\nVerification:\n${json(verdict)}\nAll slot conditions and full-clip contract remain mandatory. Retain already correct choices. Resolve duplicate conflicts within each version.`, selectionSchema);
    if (!correction) return unresolved("selection repair", ["Selection repair failed."], {verdict});
    const cp = choiceProblems(correction.selections, allSlotIds, true);
    if (correction.status !== "ready" || cp.length) return unresolved("selection repair", [...correction.issues, ...cp], {correction, verdict});
    selected = allSlotIds.map(id => correction.selections.find(c => c.slot === id));
    plan = buildPlan(selected);
  }
  const repairPrompt = context + "\n" + contract + `\nYou are the sole deliverable repair worker for round ${round}; own output/ and work/assembly-repair-${round}/. Correct concrete verification problems and implement this complete authoritative plan:\n${json(plan)}\nPrevious assembly:\n${json(assembled)}\nVerification findings:\n${json(verdict)}\nWorkflow structural verification concerns:\n${json(problems)}
Inspect prior work/assembly/ code and work/verify-* reports. Preserve all source files. Re-render only affected movies if selection or media changes require it; if only evidence JSON changes, do not re-encode. For pixel/timing mismatch use a full-frame sequential rawvideo decode-to-lossless-x264 CRF0 pipeline at input rate24, SAR1:1, yuv420p, no audio, modest threads; preserve every decoded source frame and all native internal cuts/fades. Confirm decoder and encoder exits, exact counts and per-frame correspondence. Write JSON from the authoritative plan with exact public fields, validate it, and keep output/ at exactly four files. If a reported issue is a verifier/tool limitation, establish actual evidence rather than altering correct outputs. Save scripts and command logs in the owned work directory. Return complete only for actual finished deliverables; otherwise report blockers.`;
  assembled = await call("repair-deliverables-" + round, "Verify and repair", repairPrompt, assemblySchema);
  if (!assembled || assembled.status !== "complete") return unresolved("deliverable repair", assembled ? assembled.issues : ["Repair worker failed."], {verdict, assembly: assembled});
  verdict = await call("verify-deliverables-" + round, "Verify and repair", verifyPrompt(round, plan, selected, assembled), checkSchema);
  problems = verificationProblems(verdict, plan);
}
if (problems.length) return unresolved("final verification", problems, {verdict, plan, files: assembled ? assembled.files : expectedFiles});
return {
  status: "verified",
  taskRoot: inventory.taskRoot,
  files: expectedFiles.map(path => inventory.taskRoot.replace(/\/$/, "") + "/" + path),
  selections: selected.map(c => ({version: c.version, slot: c.slot, source: c.source})),
  decodedFrameCounts: Object.fromEntries(verdict.outputs.map(o => [o.version, o.actualDecodedFrames])),
  verification: {frameCorrespondence: verdict.frameCorrespondence, reportPath: verdict.reportPath, allRequirementsChecked: verdict.allRequirementsChecked},
  unresolvedIssues: [],
  workerFailures: failures
};