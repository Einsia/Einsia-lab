export const meta = {
  name: "cdc-a-x09-crossing-sequence",
  description: "Plan: inventory 33 anonymous clips, describe them visually, match 6 distinct clips to the ordered slot list with continuity checks, assemble solution.mp4/json plus evidence, and verify with a bounded repair loop.",
  phases: [
    {title: "inventory", detail: "Probe all clips and extract review frames"},
    {title: "describe", detail: "Visual description of every candidate clip"},
    {title: "match", detail: "Select and critique 6 distinct slot assignments"},
    {title: "assemble", detail: "Build solution.mp4, solution.json, selection-evidence.json"},
    {title: "verify", detail: "Independent verification and bounded repair"}
  ]
};

// ---------- shared context ----------
const CTX = [
  "Task directory: /workspace. The full task statement is in /workspace/instruction.md — read it first.",
  "Inputs: /workspace/input/01.mp4 .. /workspace/input/33.mp4 (H.264, 1280x720, SAR 1:1, 24 fps, 4-9 s, silent).",
  "Put intermediate drafts in /workspace/work/ and final deliverables only in /workspace/output/.",
  "Python 3.11 and ffmpeg/ffprobe are available; no network, no GPU.",
  "Assembly contract summary: choose 6 DISTINCT clips, one per ordered slot (1 Establishing, 2 First obstacle (barbed wire leap), 3 Spotting the goal (head close-up + POV shrub), 4 Second obstacle (electric fence spark + stunned sit), 5 Assault (close-up behind wires + wide charge/thrown back), 6 After the crossing (scorched llama, camera leaves past shrubs to rainbow)).",
  "Each clip used complete, uncut, 1x speed, no transforms; hard cuts; continuous screen direction (180-degree line) agreeing with slot 1's established left-to-right travel.",
  "Deliverables: output/solution.mp4 (H.264/yuv420p, 1280x720, SAR 1:1, 24/1 fps CFR, no audio; lossless concat or CRF<=18), output/solution.json ({\"segments\":[6 objects: slot, source:\"NN\", output_frames:[start,end), source_frames:[0,frame_count]]}, contiguous from 0, last end = decoded frame count of solution.mp4), output/selection-evidence.json (array of 6 objects {slot, source, source_frames:[a,b] with b-a>=12 inside the clip, reason stating fit + one concrete visible difference from the most similar other candidate}). output/ must contain exactly these three files.",
  "Clip numbers are random and carry no story order. Several candidates overlap in time or show the same scene with a different shot treatment — never guess clip identity from filenames; decide only from decoded visual evidence."
].join("\n");

// ---------- phase 1: inventory ----------
phase("inventory");
const inventory = await agent(
  CTX + "\n\nYOUR ASSIGNMENT (inventory):\n" +
  "1. Create /workspace/work/frames/ and /workspace/work/montage/.\n" +
  "2. For every input/NN.mp4 (NN = 01..33): use ffprobe to record exact decoded video frame count (e.g. ffprobe -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height,r_frame_rate,sample_aspect_ratio,pix_fmt), duration, and confirm codec/geometry.\n" +
  "3. Extract 12 evenly spaced frames per clip as JPEGs into work/frames/NN/ (f01.jpg..f12.jpg), including the true first and last decoded frames; also build one labeled 3x4 contact-sheet montage per clip in work/montage/NN.jpg (tile labels f01..f12). Use ffmpeg tile filter or ImageMagick if present, else Python/Pillow.\n" +
  "4. Write work/inventory.json: an object keyed by \"NN\" with {frames, duration_s, width, height, sar, pix_fmt}.\n" +
  "5. Report back a compact text table: NN, frames, duration, and any anomaly (unexpected size/fps/SAR). Do not delete or modify inputs.",
  {label: "inventory", phase: "inventory"}
);
if (inventory === null) return {status: "unresolved", reason: "inventory worker failed"};

// ---------- phase 2: per-clip visual description ----------
phase("describe");
const descSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          summary: {type: "string"},
          shot_sizes: {type: "string"},
          camera_angle: {type: "string"},
          camera_movement: {type: "string"},
          lens_feel: {type: "string"},
          setting: {type: "string"},
          action_beats: {type: "string"},
          llama_state: {type: "string"},
          screen_direction: {type: "string"},
          fence_type: {type: "string"},
          distinctive_details: {type: "string"},
          possible_slots: {type: "array", items: {type: "integer"}}
        },
        required: ["id","summary","shot_sizes","camera_angle","camera_movement","lens_feel","setting","action_beats","llama_state","screen_direction","fence_type","distinctive_details","possible_slots"],
        additionalProperties: false
      }
    }
  },
  required: ["clips"],
  additionalProperties: false
};

const ids = [];
for (let n = 1; n <= 33; n++) ids.push(String(n).padStart(2, "0"));
const batches = [];
for (let i = 0; i < ids.length; i += 3) batches.push(ids.slice(i, i + 3));

const descriptions = await parallel(batches.map((batch, bi) => () => agent(
  CTX + "\n\nYOUR ASSIGNMENT (describe clips " + batch.join(", ") + "):\n" +
  "The frames and montages already exist under /workspace/work/frames/NN/ (f01..f12.jpg, in clip time order) and /workspace/work/montage/NN.jpg. Inventory data is in /workspace/work/inventory.json.\n" +
  "For each assigned clip, VIEW every extracted frame (read the JPEG images directly). If 12 frames leave an action beat ambiguous, you may extract 2-4 additional frames at specific timestamps with ffmpeg into work/frames/NN/extra/ and view those too.\n" +
  "Describe strictly what is VISIBLE: environment (plateau/boulders/snowy peaks/rainbow/shrubs with blue flowers/dry branches), the orange llama and its state (normal vs scorched/darkened, walking/trotting/leaping/stunned-sitting/sniffing/charging/thrown back), fence presence and TYPE (barbed wire with wooden post vs electric fence with red insulator caps) and its screen position, shot sizes, camera angle (low/level/high), camera movement (locked off vs lateral move with parallax), lens feel (wide vs normal vs medium-long, depth of field), and SCREEN DIRECTION of the llama's travel/eyeline (left-to-right or right-to-left, toward/away from the fence).\n" +
  "Also note which of the 6 slots this clip could plausibly fill (possible_slots), and any internal cuts (some clips contain two shots).\n" +
  "Return ONLY the structured object; base every field on frames you actually viewed, never on the filename.",
  {label: "describe-" + batch[0] + "-" + batch[batch.length - 1], phase: "describe", schema: descSchema}
)));

const clipIndex = {};
const describeFailures = [];
descriptions.forEach((d, i) => {
  if (d === null || !Array.isArray(d.clips)) { describeFailures.push(batches[i].join(",")); return; }
  for (const c of d.clips) clipIndex[c.id] = c;
});
const missingDesc = ids.filter(id => !clipIndex[id]);
log("described " + Object.keys(clipIndex).length + "/33 clips; missing: " + missingDesc.join(","));

// Retry missing clips once, individually.
if (missingDesc.length > 0) {
  const retry = await parallel(missingDesc.map(id => () => agent(
    CTX + "\n\nYOUR ASSIGNMENT (describe clip " + id + " only): Same instructions as the batched description task: view /workspace/work/frames/" + id + "/f01..f12.jpg (extract extra frames if needed) and return the structured description for this one clip in the clips array. Base everything on visible evidence.",
    {label: "describe-retry-" + id, phase: "describe", schema: descSchema}
  )));
  retry.forEach((d, i) => {
    if (d && Array.isArray(d.clips)) for (const c of d.clips) clipIndex[c.id] = c;
  });
}
const stillMissing = ids.filter(id => !clipIndex[id]);
if (stillMissing.length > 0) {
  return {status: "unresolved", reason: "no visual description for clips: " + stillMissing.join(","), inventory: inventory};
}

// ---------- phase 3: selection with critique loop ----------
phase("match");
const selectSchema = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: {type: "integer"},
          source: {type: "string"},
          fit_reason: {type: "string"},
          most_similar_other: {type: "string"},
          visible_difference: {type: "string"},
          screen_direction_ok: {type: "boolean"}
        },
        required: ["slot","source","fit_reason","most_similar_other","visible_difference","screen_direction_ok"],
        additionalProperties: false
      }
    }
  },
  required: ["assignments"],
  additionalProperties: false
};
const critiqueSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    per_slot_notes: {type: "array", items: {type: "string"}}
  },
  required: ["passed","issues","per_slot_notes"],
  additionalProperties: false
};

const descBlob = JSON.stringify(Object.values(clipIndex));
const slotText = "Slot definitions (five fields each — content, shot size, camera angle, lens feel, camera movement) are in /workspace/instruction.md; re-read them before deciding.";

async function select(feedback) {
  return agent(
    CTX + "\n\nYOUR ASSIGNMENT (select 6 clips):\n" + slotText + "\n" +
    "Structured visual descriptions of all 33 candidates (from frame inspection):\n" + descBlob + "\n\n" +
    (feedback ? "Feedback from the previous critique round that your new selection MUST address:\n" + feedback + "\n\n" : "") +
    "Procedure: (1) shortlist candidates per slot from the descriptions; (2) VIEW the montages /workspace/work/montage/NN.jpg (and individual frames in /workspace/work/frames/NN/ when needed) for every shortlisted candidate — do not rely on text descriptions alone; (3) disambiguate near-duplicates and alternate shot treatments by checking ALL five slot fields; (4) choose exactly 6 DISTINCT sources; (5) verify global continuity: the llama's travel direction, eyeline, and position relative to fence and goal must keep one consistent screen direction across slots 1-6, anchored to slot 1 (empty plateau, llama on the LEFT walking toward frame RIGHT, then sniffing).\n" +
    "For each slot give: fit_reason (why it matches every field), most_similar_other (the runner-up candidate), visible_difference (one concrete thing visible in frames that distinguishes your pick from that runner-up), and screen_direction_ok.",
    {label: "select", phase: "match", schema: selectSchema}
  );
}
async function critique(selection) {
  return agent(
    CTX + "\n\nYOUR ASSIGNMENT (critique a proposed selection):\n" + slotText + "\n" +
    "Proposed assignment:\n" + JSON.stringify(selection) + "\n\n" +
    "Independently VIEW the montages and frames under /workspace/work/montage/ and /workspace/work/frames/ for the six chosen clips AND for any other candidate whose description suggests the same slot (candidates overlap or repeat scenes with different treatments). Descriptions:\n" + descBlob + "\n\n" +
    "Check: (a) each chosen clip matches ALL five fields of its slot; (b) all six sources are distinct; (c) slot-1 clip really is the empty establishing wide with llama entering on the left moving right and sniffing (not a similar-looking alternate take or later-beat clip); (d) slots 2/3 show barbed wire and slots 4/5/6 the electric fence with red insulators — do not swap fence types; (e) slot 3 contains the head close-up AND the cut to the low POV shrub shot; slot 5 the close-up behind wires AND the wide charge/thrown-back; slot 6 the scorched llama seated past the fence AND the continuous lateral camera move ending on plateau + rainbow; (f) screen direction/eyeline continuity across the six clips consistent with slot 1's left-to-right travel.\n" +
    "If a different candidate fits a slot better, say so explicitly with the clip id and the visible evidence. Report passed=true only if every slot's choice is defensible from the frames.",
    {label: "critique", phase: "match", schema: critiqueSchema}
  );
}

let selection = await select(null);
if (selection === null) return {status: "unresolved", reason: "selection worker failed", inventory: inventory};
const maxSelectRounds = (typeof args === "object" && args && Number.isInteger(args.maxSelectRounds)) ? args.maxSelectRounds : 3;
let verdict = await critique(selection);
for (let round = 0; verdict && !verdict.passed && round < maxSelectRounds; round++) {
  const feedback = JSON.stringify({issues: verdict.issues, per_slot_notes: verdict.per_slot_notes});
  const next = await select(feedback);
  if (next === null) break;
  selection = next;
  verdict = await critique(selection);
}

// Deterministic sanity checks on the final selection.
const selProblems = [];
const bySlot = {};
if (!selection || !Array.isArray(selection.assignments) || selection.assignments.length !== 6) {
  selProblems.push("selection does not contain exactly 6 assignments");
} else {
  const seen = new Set();
  for (const a of selection.assignments) {
    if (!(a.slot >= 1 && a.slot <= 6)) selProblems.push("bad slot number " + a.slot);
    if (bySlot[a.slot]) selProblems.push("duplicate slot " + a.slot);
    bySlot[a.slot] = a;
    if (seen.has(a.source)) selProblems.push("source " + a.source + " used more than once");
    seen.add(a.source);
    if (!/^\d{2}$/.test(a.source) || Number(a.source) < 1 || Number(a.source) > 33) selProblems.push("invalid source id " + a.source);
  }
  for (let s = 1; s <= 6; s++) if (!bySlot[s]) selProblems.push("slot " + s + " unassigned");
}
if (selProblems.length > 0) {
  return {status: "unresolved", reason: "final selection invalid", problems: selProblems, selection: selection, critique: verdict};
}

// ---------- phase 4: assembly ----------
phase("assemble");
const assembly = await agent(
  CTX + "\n\nYOUR ASSIGNMENT (assemble deliverables):\n" +
  "Final approved selection (slot -> source):\n" + JSON.stringify(selection.assignments) + "\n\n" +
  "1. Create /workspace/output/ if missing. It must end up containing EXACTLY three files: solution.mp4, solution.json, selection-evidence.json. Remove anything else there.\n" +
  "2. Build output/solution.mp4 as the 6 chosen clips concatenated in slot order, each clip COMPLETE and untouched (no cropping, grading, speed change, added/dropped frames, no audio). All sources share H.264 1280x720 SAR 1:1 24 fps, so first attempt the concat demuxer with stream copy (re-encode audio out / strip audio). If stream-copy concat fails validation (e.g. timestamp anomalies), re-encode with libx264 CRF 18 or lower, yuv420p, -r 24 CFR, -an, keeping 1280x720 SAR 1:1.\n" +
  "3. Determine each source's exact decoded frame count from work/inventory.json and confirm with ffprobe -count_frames. Write output/solution.json as {\"segments\":[...]} with exactly 6 objects in slot order: slot (int), source (\"NN\"), output_frames [start, end) half-open and contiguous from 0, source_frames [0, frame_count]. The last end must equal the decoded frame count of output/solution.mp4 — verify by counting the output's frames with ffprobe and fix any mismatch (e.g. re-encode path) before finishing.\n" +
  "4. Write output/selection-evidence.json: array of 6 objects {slot, source, source_frames:[a,b], reason}. Choose [a,b] with b-a >= 12, 0-indexed, fully inside the clip, covering the most characteristic action beat of that slot; verify the interval by viewing the corresponding frames in /workspace/work/frames/NN/. The reason must state why the clip fits all five slot fields AND one concrete visible difference from the most similar other candidate (use the selection data above).\n" +
  "5. Self-check before returning: solution.mp4 is H.264/yuv420p, 1280x720, SAR 1:1, 24/1 fps CFR, no audio stream; output/ holds exactly 3 files. Report the per-slot frame ranges and total output frames.",
  {label: "assemble", phase: "assemble"}
);
if (assembly === null) return {status: "unresolved", reason: "assembly worker failed", selection: selection, critique: verdict};

// ---------- phase 5: independent verification with bounded repair ----------
phase("verify");
const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["passed","issues"],
  additionalProperties: false
};
const verifyPrompt =
  CTX + "\n\nYOUR ASSIGNMENT (verify deliverables independently):\n" +
  "The declared selection is:\n" + JSON.stringify(selection.assignments) + "\n\n" +
  "Do NOT trust the assembler's report; check everything yourself:\n" +
  "(a) output/ contains exactly solution.mp4, solution.json, selection-evidence.json.\n" +
  "(b) solution.mp4: ffprobe confirms H.264, yuv420p, 1280x720, SAR 1:1, avg_frame_rate 24/1 (CFR), no audio stream.\n" +
  "(c) Frame-exactness: for each segment, decode the output frame range [start,end) and the declared source clip's full range and confirm they are identical, e.g. via ffmpeg framemd5/md5 hashing of rawvideo for the source clip and for the output trimmed to each segment (use -ss/-frames or select filter on DECODED frames, then compare hashes count-for-count). The concat must introduce no dropped/duplicated/reordered frames.\n" +
  "(d) solution.json: 6 objects, slot order 1..6, sources distinct and matching the declared selection, output_frames half-open contiguous from 0, source_frames [0, frame_count] equal to each input's true decoded frame count (verify with ffprobe -count_frames on inputs), last end equals the decoded frame count of solution.mp4.\n" +
  "(e) selection-evidence.json: 6 objects; each [a,b] has b-a >= 12 and lies inside the clip's frame count; decode/view the frames in that interval (extract with ffmpeg if needed) and confirm the reason matches what is visible and names a concrete difference from a similar candidate; slot order 1..6.\n" +
  "(f) Spot-check content: view a few frames of each output segment boundary to confirm the cuts land between the intended clips in slot order.\n" +
  "Return passed=true only if every check succeeds; list concrete issues otherwise.";
const repairMax = (typeof args === "object" && args && Number.isInteger(args.maxRepairs)) ? args.maxRepairs : 2;
let v = await agent(verifyPrompt, {label: "verify-0", phase: "verify", schema: verifySchema});
for (let round = 0; v && !v.passed && round < repairMax; round++) {
  const fix = await agent(
    CTX + "\n\nYOUR ASSIGNMENT (repair deliverables):\nThe verifier reported these issues with output/:\n" + JSON.stringify(v.issues) + "\n\n" +
    "Fix ONLY the reported problems in output/solution.mp4, output/solution.json, and/or output/selection-evidence.json, keeping the approved selection unchanged:\n" + JSON.stringify(selection.assignments) + "\n" +
    "Re-run the relevant self-checks afterwards and report what changed.",
    {label: "repair-" + round, phase: "verify"}
  );
  if (fix === null) return {status: "unresolved", reason: "repair worker failed at round " + round, last_verification: v, selection: selection};
  v = await agent(verifyPrompt, {label: "verify-" + (round + 1), phase: "verify", schema: verifySchema});
}

return {
  status: v && v.passed ? "verified" : "unresolved",
  selection_critique: verdict,
  selection: selection.assignments,
  assembly_report: assembly,
  final_verification: v,
  notes: (v && v.passed) ? "All deliverables verified frame-exact against declared sources." : "Verification did not pass; see issues and repair budget."
};
