export const meta = {
  name: "cdc-a-x05-frame-accurate-assembly",
  description: "Inspect 45 anonymous clips without guessing identities, establish complete slot matches and safe trim ranges, solve a seven-source 1248-frame edit, and render and verify the two required deliverables.",
  phases: [
    {title: "Inspect public inputs", detail: "Probe media and visually catalogue all 45 candidates."},
    {title: "Establish slot evidence", detail: "Locate complete ordered actions, original cuts, and admissible endpoints."},
    {title: "Choose exact trims", detail: "Solve distinct-source and exact-frame constraints using inspected evidence."},
    {title: "Render and verify", detail: "Encode the selected frames and independently check media, manifest, and narrative."}
  ]
};

const root = "/workspace";
const slots = [
  {slot: 1, title: "Waking", description: "Opening: establish protagonist and home, emerging out of darkness. Eye-level locked medium shot of burrow mouth, at first completely dark inside; face gradually emerges and ears rise. Original hard cut to slightly low locked side wide shot: he crawls out of hole, stands up, and stretches."},
  {slot: 2, title: "Greeting the morning", description: "Good mood. Locked low-angle upshot: looking toward sky, protagonist rises into frame from bottom edge and stretches. Original cut to locked eye-level medium close-up against treetops and sky, smiling contentedly."},
  {slot: 3, title: "Absorbed", description: "Lost in nature, hint of watcher. White flowers foreground: protagonist walks up from distance and leans in to smell them. Original cut to wide shot from behind; then shot through leaves past a dark blurred foreground shape toward small distant protagonist; finally close-up smelling flowers, enraptured. Ordered camera language: medium with foreground occlusion, wide, voyeuristic wide with foreground occlusion, close-up."},
  {slot: 4, title: "A tender contact", description: "Gentlest moment, foreshadowing loss. Locked medium close-up facing camera: purple butterfly enters from off-screen, settles on tip of nose, lifts off and circles him while he breaks into open-mouthed laughter. Original cut to full shot from behind walking toward a large distant tree."},
  {slot: 5, title: "The threat gathers", description: "Antagonists gather. One locked low-camera medium shot behind fallen tree trunk. Initially only one grey fluffy small animal is present; red small animal joins; a third climbs out over top of trunk; fruit they held drops onto grass. Preserve the initial lone animal state, all entrances, and the completed fruit drop."},
  {slot: 6, title: "The strike", description: "Complete cause and effect. Starts with throw from behind trunk and fruit flying out of frame, low medium shot. Original cut to eye-level wide shot of protagonist alone in meadow struck by fruit after fruit; last fruit is red and lands squarely on top of his head. Original cut back behind trunk to medium shot where antagonists keep throwing."},
  {slot: 7, title: "Humiliation", description: "Ending: protagonist routed and tormentors triumphant. Wide shot initially empty meadow and large tree; protagonist dashes in from frame left and runs for trunk through hail of falling green fruit. Original cut beside trunk, medium shot hiding and peering out shaken. Original cut to wide shot of three small animals jumping for joy under tree."}
];
const contract = `Task CDC-A-X05. Work only from public files in ${root}, instruction.md, and direct inspection of input/01.mp4 through input/45.mp4. No network, hidden key, film identification, or guessing from filenames, byte sizes, or hashes. Numbers are random; candidates overlap. Python 3.11 and FFmpeg/ffprobe are available, CPU only; discover other tools rather than assuming them. All scratch and evidence belongs in work/. Only final solution.mp4 and solution.json belong in output/. Seven ordered slots, one distinct candidate each, exactly one contiguous source subrange per candidate, 1x forward, all original internal cuts retained. No scaling, cropping, mirroring, visual filtering, text, interpolation, frame duplication or dropping, generated imagery, audio, transitions, or inserted frames. Hard cuts between segments. Every selected segment must retain all described events in order. Both endpoints must be at least 12 frames from original cuts within the retained segment. Exactly 1248 frames, 52.000 seconds, H.264, yuv420p, 640x360, SAR 1:1, CFR 24/1, lossless or CRF <=18, no audio. Manifest is exactly {"segments":[{"slot":k,"source":"NN","source_frames":[a,b],"output_frames":[c,d]},...]}, seven objects, integer zero-based half-open ranges, lengths equal, contiguous output starting at 0 and ending at 1248. Public credits deliberately withhold film identity. Do not seek the withheld attribution. Read applicable workspace instructions using your actual tools. Never equate successful commands with verified content. Report evidence or concrete blockers.`;
const shotList = JSON.stringify(slots);
const str = {type: "string"};
const integer = {type: "integer"};
const strings = {type: "array", items: str};
const obj = (properties, required = Object.keys(properties)) => ({type: "object", properties, required, additionalProperties: false});
const arr = items => ({type: "array", items});
const pair = {type: "array", items: integer, minItems: 2, maxItems: 2};
const errors = [];
async function call(prompt, options) {
  try {
    const value = await agent(contract + "\n\n" + prompt, options);
    if (value === null) errors.push({label: options.label, error: "Worker returned null; required work is unverified."});
    return value;
  } catch (e) {
    errors.push({label: options.label, error: String(e)});
    return null;
  }
}
function unresolved(reason, detail) {
  return {status: "unresolved", reason, detail, invocationErrors: errors, deliverablesVerified: false};
}

const prepSchema = obj({
  ready: {type: "boolean"},
  inventoryPath: str,
  viewingMethod: str,
  evidenceRoot: str,
  clips: arr(obj({source: str, path: str, frameCount: integer, pixelFormat: str})),
  issues: strings
});
const prep = await call(`Prepare inspection, not an edit. Read instruction.md and applicable local instructions. Confirm task root; inspect installed tools and whether decoded video frames can actually be viewed. Probe all 45 files for exact decoded frame count, dimensions, SAR, frame rate/timebase, pixel format, timestamps, and audio streams. Write a compact machine-readable inventory under work/inventory.json and reusable inspection helpers under work/tools/. Decode source frames sequentially when establishing zero-based indexes; avoid approximate keyframe seeking. Prepare labelled temporal contact sheets (roughly 2-4 samples/second, with first and last frames) per candidate in work/inspection/NN/, and machine scene-change proposals if useful. Include source number and frame index in inspection evidence only. A proposal from scene scores is not a confirmed cut. Never put labels or resized inspection images into a deliverable. Keep original source files untouched. Avoid unnecessary full-resolution frame dumps of all files; extract detailed regions on demand. Discover an available visual inspection tool; do not pretend ffprobe or scene statistics reveal narrative. If no visual capability is available, report that as a blocker. Do not install from network. Return all 45 inventory entries and exact paths others can read.`, {label: "prepare-public-inspection", phase: "Inspect public inputs", schema: prepSchema});
if (!prep || !prep.ready) return unresolved("Public input preparation or visual access failed.", prep);
const expectedSources = Array.from({length: 45}, (_, i) => String(i + 1).padStart(2, "0"));
if (prep.clips.length !== 45 || new Set(prep.clips.map(x => x.source)).size !== 45 || expectedSources.some(s => !prep.clips.some(x => x.source === s && x.frameCount > 0))) {
  return unresolved("Inventory does not account for all 45 candidates.", prep);
}
const frameCounts = Object.fromEntries(prep.clips.map(x => [x.source, x.frameCount]));
const catalogSchema = obj({
  complete: {type: "boolean"},
  reportPath: str,
  clips: arr(obj({source: str, observedSequence: str, possibleSlots: arr(integer), fullMatchSlots: arr(integer), missingOrAmbiguousEvents: strings, evidencePaths: strings})),
  issues: strings
});
const batches = Array.from({length: 5}, (_, i) => expectedSources.slice(i * 9, i * 9 + 9));
const catalogResults = await parallel(batches.map((sources, i) => async () => {
  const assignment = `Catalogue candidates ${sources.join(", ")} by directly viewing their decoded imagery. All seven slot descriptions: ${shotList}. Preparation: ${JSON.stringify(prep)}. You own only work/catalog-${i + 1}/ and may read all prepared evidence. Inspect each assigned clip across its full duration; use contact sheets for routing and dense frames or playback to resolve actions. Describe the actual sequence and original shot changes. Mark every plausible slot, even if only partial. Separately identify apparently complete matches, and explicitly record missing initial states, entrances, exits, gestures, final impacts, or terminal shots. Do not select a clip just because one recognisable frame matches. Similar overlapping candidates must be distinguished by what they include. If a sheet is unclear, inspect more frames before rejecting. Record evidence paths and approximate frame locations in your report. Return one entry for EVERY assigned source, including unrelated or uncertain ones. No output edits.`;
  let r = await call(assignment, {label: `catalog-${i + 1}`, phase: "Inspect public inputs", schema: catalogSchema});
  if (!r || !r.complete || sources.some(s => !r.clips.some(x => x.source === s))) {
    r = await call(assignment + "\nThe initial catalogue was incomplete or missing. Recover existing evidence in your owned directory and finish only the missing inspection. Prior result: " + JSON.stringify(r), {label: `recover-catalog-${i + 1}`, phase: "Inspect public inputs", schema: catalogSchema});
  }
  return r;
}));
if (catalogResults.some((r, i) => !r || !r.complete || batches[i].some(s => !r.clips.some(x => x.source === s)))) {
  return unresolved("Not all candidates were visually catalogued.", catalogResults);
}
const catalog = catalogResults.flatMap(x => x.clips);

const candidateSchema = obj({
  source: str,
  frameCount: integer,
  eventEvidence: arr(obj({event: str, frames: pair, observation: str, evidencePath: str})),
  cuts: arr(integer),
  requiredFrames: pair,
  startWindows: arr(pair),
  endWindows: arr(pair),
  preferredRange: pair,
  confidence: {type: "string", enum: ["confirmed", "uncertain"]},
  rationale: str
});
const slotSchema = obj({slot: integer, complete: {type: "boolean"}, reportPath: str, candidates: arr(candidateSchema), rejectedAlternatives: strings, issues: strings});
async function inspectSlot(slot, prior, extra) {
  const suggested = catalog.filter(c => c.possibleSlots.includes(slot.slot) || c.fullMatchSlots.includes(slot.slot));
  return await call(`Establish frame-accurate admissible edits for slot ${slot.slot}: ${JSON.stringify(slot)}. Inventory: ${prep.inventoryPath}. Viewing method: ${prep.viewingMethod}. Full catalogue reports: ${JSON.stringify(catalogResults.map(x => x.reportPath))}. Suggested candidates: ${JSON.stringify(suggested)}. These are routing suggestions, not authoritative selections; consult the full catalogue and investigate plausible ambiguous entries or omissions. You own work/slot-${slot.slot}/ only. Compare all plausible overlaps and preserve alternatives when they genuinely meet the entire slot. View frame sequences densely enough to locate each required action's true beginning and completion, especially initial empty/dark/single-animal states and terminal actions. Inspect original cut boundaries using adjacent full-resolution frames; validate machine proposals and do not infer cuts solely from thresholds. Record ALL actual original cuts of each qualified source, with cut t meaning the first frame of the new shot. Evidence frames are zero-based half-open intervals. requiredFrames [r0,r1) must conservatively contain the entire required ordered content, including enough establishing and ending footage to make each action legible. startWindows and endWindows are arrays of inclusive integer ranges [lo,hi] for admissible a and b respectively; b itself is exclusive in the resulting segment. Certify that any listed a/b combination containing requiredFrames and satisfying cut margins retains the complete described sequence and has sensible opening/closing shots without extra unrelated shots. Use separate windows if necessary; do not broaden merely to hit a target duration. preferredRange records a well-paced admissible choice. Check endpoint safety conservatively: for every original cut t with a<t<b require t-a>=12 and (b-1)-t>=12, leaving at least twelve frame-index steps to the retained final frame. Original cuts outside the retained interval do not impose a new restriction. Do not assume 52 seconds can be met by equal durations. Return only source-backed candidate bounds; uncertain candidates may be reported but cannot be used until confirmed. If no full match exists, explain the missing event and search relevant catalogue alternatives before concluding. Prior analysis: ${JSON.stringify(prior)}. Additional instruction: ${extra || "Initial detailed inspection."}`, {label: `${prior ? "reassess" : "inspect"}-slot-${slot.slot}`, phase: "Establish slot evidence", schema: slotSchema});
}
let slotResults = await parallel(slots.map(s => () => inspectSlot(s, null, "")));
const retrySlots = slots.filter((s, i) => !slotResults[i] || !slotResults[i].complete || !slotResults[i].candidates.some(c => c.confidence === "confirmed"));
if (retrySlots.length) {
  const recovered = await parallel(retrySlots.map(s => () => inspectSlot(s, slotResults[s.slot - 1], "Resolve the missing complete match or incomplete inspection using the full 45-source catalogue; report a concrete blocker if visual tools or inputs are unavailable.")));
  retrySlots.forEach((s, i) => {slotResults[s.slot - 1] = recovered[i];});
}
if (slotResults.some((r, i) => !r || !r.complete || r.slot !== i + 1)) return unresolved("Frame-accurate slot inspection is incomplete.", slotResults);

// Enumerate only worker-certified endpoint windows. Source identities come exclusively from inspection.
function enumerate(result) {
  const bySource = new Map();
  const problems = [];
  const validPair = p => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger) && p[0] <= p[1];
  for (const c of result.candidates) {
    if (c.confidence !== "confirmed") continue;
    if (!(c.source in frameCounts) || c.frameCount !== frameCounts[c.source] || !validPair(c.requiredFrames) || c.requiredFrames[0] < 0 || c.requiredFrames[1] > c.frameCount || c.requiredFrames[0] === c.requiredFrames[1] || !validPair(c.preferredRange) || !c.startWindows.every(validPair) || !c.endWindows.every(validPair) || !c.cuts.every(t => Number.isInteger(t) && t > 0 && t < c.frameCount)) {
      problems.push(`Invalid bounds for slot ${result.slot}, source ${c.source}`);
      continue;
    }
    let group = bySource.get(c.source);
    if (!group) {group = {source: c.source, lengths: new Map()}; bySource.set(c.source, group);}
    for (const sw of c.startWindows) for (const ew of c.endWindows) {
      for (let a = Math.max(0, sw[0]); a <= Math.min(sw[1], c.requiredFrames[0], c.frameCount - 1); a++) {
        for (let b = Math.max(a + 1, ew[0], c.requiredFrames[1]); b <= Math.min(ew[1], c.frameCount); b++) {
          if (c.cuts.some(t => a < t && t < b && (t - a < 12 || b - 1 - t < 12))) continue;
          const length = b - a;
          const cost = Math.abs(a - c.preferredRange[0]) + Math.abs(b - c.preferredRange[1]);
          const old = group.lengths.get(length);
          if (!old || cost < old.cost) group.lengths.set(length, {source: c.source, a, b, length, cost});
        }
      }
    }
  }
  const groups = [...bySource.values()].filter(g => g.lengths.size).map(g => ({source: g.source, options: [...g.lengths.values()].sort((a,b) => a.cost-b.cost || a.a-b.a || a.b-b.b)}));
  groups.sort((a,b) => a.options[0].cost-b.options[0].cost || a.source.localeCompare(b.source));
  return {groups, problems};
}
function solve(results) {
  const tables = results.map(enumerate);
  const problems = tables.flatMap(t => t.problems);
  // Suffix sum reachability ignores distinctness only for pruning; search enforces distinctness.
  const suffix = Array.from({length: 8}, () => new Set());
  suffix[7].add(0);
  for (let i = 6; i >= 0; i--) {
    const lengths = new Set(tables[i].groups.flatMap(g => g.options.map(o => o.length)));
    for (const n of lengths) for (const rest of suffix[i + 1]) if (n + rest <= 1248) suffix[i].add(n + rest);
  }
  const failed = new Set();
  function search(i, remaining, used) {
    if (i === 7) return remaining === 0 ? [] : null;
    if (!suffix[i].has(remaining)) return null;
    const key = i + ":" + remaining + ":" + [...used].sort().join(",");
    if (failed.has(key)) return null;
    for (const g of tables[i].groups) {
      if (used.has(g.source)) continue;
      used.add(g.source);
      for (const o of g.options) {
        if (!suffix[i + 1].has(remaining - o.length)) continue;
        const tail = search(i + 1, remaining - o.length, used);
        if (tail) {used.delete(g.source); return [o, ...tail];}
      }
      used.delete(g.source);
    }
    failed.add(key);
    return null;
  }
  const selected = search(0, 1248, new Set());
  let cursor = 0;
  const segments = selected && selected.map((s, i) => {
    const out = {slot: i + 1, source: s.source, source_frames: [s.a, s.b], output_frames: [cursor, cursor + s.length]};
    cursor += s.length;
    return out;
  });
  return {segments, problems, admissible: tables.map((t, i) => ({slot: i + 1, sources: t.groups.map(g => ({source: g.source, minLength: Math.min(...g.options.map(o => o.length)), maxLength: Math.max(...g.options.map(o => o.length)), lengthCount: g.options.length}))}))};
}
let edit = solve(slotResults);
if (!edit.segments) {
  log("No exact distinct-source 1248-frame edit fits the inspected bounds; reassessing evidence and overlooked alternatives once.");
  const revised = await parallel(slots.map((s, i) => () => inspectSlot(s, slotResults[i], "The exact-length constraint solver found no solution. Solver diagnostics: " + JSON.stringify(edit) + ". Reinspect actual frames for unnecessarily narrow bounds and overlooked complete alternate candidates. Never omit events, invent footage, or relax the 12-frame rule to force feasibility. Return a complete replacement of your candidate list.")));
  if (revised.some((r, i) => !r || !r.complete || r.slot !== i + 1)) return unresolved("Reassessment could not establish a complete feasible set.", {edit, revised});
  slotResults = revised;
  edit = solve(slotResults);
}
if (!edit.segments) return unresolved("No certified seven-distinct-source edit totals exactly 1248 frames; no render was claimed.", {edit, slotReports: slotResults.map(r => r.reportPath)});

const reviewSchema = obj({passed: {type: "boolean"}, reportPath: str, issues: arr(obj({slot: integer, category: str, description: str, evidence: str})), checkedSlots: arr(integer)});
async function reviewPlan(editToReview, label) {
  return await call(`Read-only independent editorial check before rendering. You own work/plan-review/. Full ordered shot list: ${shotList}. Proposed manifest: ${JSON.stringify({segments: editToReview.segments})}. Evidence reports: ${JSON.stringify(slotResults.map(r => r.reportPath))}. Directly view the exact proposed subranges and necessary surrounding source frames, not just previous workers' assertions. Confirm all seven full ordered action chains, starting states, camera sequences, distinct candidate identities, every internal cut, safe endpoints, and an intelligible 52-second progression. Compare plausible overlapping candidates when a required event seems truncated. In particular check dark burrow before emergence, complete stretches, all four flower shots, butterfly arriving/landing/departing/circling/laughter and walk-away, lone grey animal and all gathering/drop actions, first throw plus final red head impact plus renewed throwing, initially empty meadow plus dash/hiding/peering/celebration. A missing visual check is a failure, not a pass. Report exact offending slot and frame evidence. Do not edit output or other workers' evidence.`, {label, phase: "Choose exact trims", schema: reviewSchema});
}
let editorial = await reviewPlan(edit, "review-selected-trims");
if (!editorial) return unresolved("Selected trim review did not return evidence.", edit);
if (!editorial.passed) {
  let affected = [...new Set(editorial.issues.map(x => x.slot).filter(s => s >= 1 && s <= 7))];
  if (!affected.length) return unresolved("Editorial review failed without actionable slot evidence.", editorial);
  const corrected = await parallel(affected.map(k => () => inspectSlot(slots[k - 1], slotResults[k - 1], "Independent review found problems in proposed edit " + JSON.stringify(edit.segments) + ". Issues: " + JSON.stringify(editorial.issues.filter(x => x.slot === k || x.slot === 0)) + ". Inspect and correct the certified candidate bounds, removing false matches. Return the entire corrected candidate list.")));
  if (corrected.some((r, i) => !r || !r.complete || r.slot !== affected[i])) return unresolved("Editorial correction was incomplete.", corrected);
  affected.forEach((k, i) => {slotResults[k - 1] = corrected[i];});
  edit = solve(slotResults);
  if (!edit.segments) return unresolved("Corrected semantic bounds do not permit the exact required length.", edit);
  editorial = await reviewPlan(edit, "review-corrected-trims");
}
if (!editorial || !editorial.passed || new Set(editorial.checkedSlots.filter(k => k >= 1 && k <= 7)).size !== 7) return unresolved("Complete selected-range editorial verification was not obtained.", editorial);

const renderSchema = obj({complete: {type: "boolean"}, videoPath: str, jsonPath: str, buildReportPath: str, issues: strings});
const manifest = {segments: edit.segments};
let render = await call(`Build the two public deliverables from this EXACT inspected and approved manifest: ${JSON.stringify(manifest)}. You are the only output writer. Store reproducible assembly code, commands, logs, and intermediate media under work/render/. Write solution.json with exactly this manifest, no extra keys. For pixel-exact verification prefer lossless libx264 CRF 0 and preserve decoded source yuv420p samples. A robust approach is sequentially decode each source once, slice exactly [a,b) decoded frame buffers, stream those unchanged raw frames in slot order into one 24/1 rawvideo input, and encode losslessly at 640x360 SAR 1:1 with no audio. Check source pixel formats in ${prep.inventoryPath}; do not silently transform pixels. Alternatively use exact frame-index trim and timestamp/concat plumbing only, no visual processing, with lossless encoding. Avoid timestamp seeking, stream-copy non-keyframe trims, fps conversion filters, or output options that silently duplicate/drop frames. Retain every original internal cut. Do not add padding, repeat frames, or shorten an action to meet length. Enforce 1248 supplied frames, monotonic CFR timestamps and duration. Decode the completed encode and compare every raw frame in order to the selected source frames; CRF 0 should make byte equality possible for yuv420p. If a required format conversion prevents exact equality, explicitly report it and retain a rigorous per-frame source correspondence check rather than claiming equality. Probe actual output codec/pixel format/dimensions/SAR/frame count/rate/duration/audio, not just command arguments. Stage output in work/ and publish output/solution.mp4 and output/solution.json only after successful build checks. Keep output/ limited to those two files; move incidental files you created into work/. Preserve unrelated pre-existing user material and report any conflict. Return actual paths and build report.`, {label: "render-exact-assembly", phase: "Render and verify", schema: renderSchema});
if (!render || !render.complete) return unresolved("Rendering did not complete successfully.", {manifest, render});

const auditSchema = obj({
  passed: {type: "boolean"},
  technicalPassed: {type: "boolean"},
  semanticPassed: {type: "boolean"},
  frameCorrespondencePassed: {type: "boolean"},
  reportPath: str,
  measurements: str,
  issues: strings
});
async function audit(label) {
  return await call(`Independently audit the FINAL on-disk output/solution.mp4 and output/solution.json. You own work/final-audit/ and are read-only elsewhere. Required manifest: ${JSON.stringify(manifest)}. Slot list: ${shotList}. Inventory: ${prep.inventoryPath}. Selected-range review: ${editorial.reportPath}. Build report: ${render.buildReportPath}. Do not substitute either report for checking actual files. Parse manifest, ensure exact public structure, seven unique zero-padded sources, slots 1..7, integer valid half-open source bounds, contiguous output ranges, equal segment lengths and final frame 1248. Decode video to count frames and inspect all timestamps; check H.264, yuv420p, 640x360, SAR 1:1, CFR 24/1, duration 52.000s, no audio, and lossless/CRF <=18 encoding evidence. Compare every rendered frame to its declared source frame using freshly decoded raw frames, frame order and per-frame hashes; for lossless yuv420p require exact equality. If source format conversion was necessary, inspect the disclosed conversion and measure pixel differences and exact ordered frame correspondence without assuming identical hashes. Independently view final segments and edit boundaries, including initial dark/empty/single-animal states and brief butterfly/fruit actions, and confirm all ordered content and camera changes. Verify original cut positions against source evidence and both endpoint margins. Check output directory contains exactly the two required files. Missing, unreadable, uninspected or ambiguous requirements must not pass. Write a concise report under work/ with actual measurements, commands/check scripts and offending frame indexes.`, {label, phase: "Render and verify", schema: auditSchema});
}
let finalAudit = await audit("audit-final-deliverables");
// One technical repair is justified by an observed failure. A semantic failure requires renewed inspection, not undocumented edits.
if (finalAudit && !finalAudit.passed && finalAudit.semanticPassed) {
  const repaired = await call(`Repair ONLY the reported rendering, encoding, manifest, or directory problems while preserving exactly this approved manifest and source content: ${JSON.stringify(manifest)}. Independent audit: ${JSON.stringify(finalAudit)}. Previous build: ${JSON.stringify(render)}. Use work/render/; you are sole output writer. Rebuild losslessly if necessary and rerun source-frame correspondence checks. Do not change selected sources or intervals, introduce processing, duplicate/drop frames, or claim a semantic issue is resolved by reencoding. Return the updated actual artifact paths and build report, or explicit unresolved blockers.`, {label: "repair-rendering", phase: "Render and verify", schema: renderSchema});
  if (!repaired || !repaired.complete) return unresolved("Observed technical failures could not be repaired.", {manifest, finalAudit, repaired});
  render = repaired;
  finalAudit = await audit("audit-repaired-deliverables");
}
const verified = !!finalAudit && finalAudit.passed && finalAudit.technicalPassed && finalAudit.semanticPassed && finalAudit.frameCorrespondencePassed;
return {
  status: verified ? "verified" : "unresolved",
  deliverablesVerified: verified,
  deliverables: {video: render.videoPath, manifest: render.jsonPath},
  segments: manifest.segments,
  totalFrames: 1248,
  intendedDurationSeconds: 52,
  evidence: {inventory: prep.inventoryPath, catalogues: catalogResults.map(r => r.reportPath), slotReports: slotResults.map(r => r.reportPath), editorialReview: editorial.reportPath, build: render.buildReportPath, finalAudit: finalAudit ? finalAudit.reportPath : null},
  verification: finalAudit,
  unresolvedIssues: verified ? [] : finalAudit ? finalAudit.issues : ["Final audit returned no result; deliverables are not verified."],
  invocationErrors: errors
};