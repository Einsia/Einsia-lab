export const meta = {
  name: "cdc-a-x01-pursuit-search-assembly",
  description: "Plan for inspecting 40 anonymous clips, selecting 7 slot matches, assembling exactly 1650 frames, and verifying deliverables.",
  phases: [
    {title: "inventory", detail: "Probe inputs and build contact sheets/shot metadata"},
    {title: "census", detail: "Visually annotate all candidates in parallel"},
    {title: "matching", detail: "Shortlist candidates per slot and resolve conflicts"},
    {title: "verification", detail: "Verify finalists clause-by-clause and collect feasible frame ranges"},
    {title: "planning", detail: "Search for distinct sources and contiguous ranges summing to 1650"},
    {title: "assembly", detail: "Build output/assembly.mp4 and output/selection.json"},
    {title: "qa", detail: "Independently verify specs and semantics, repair if needed"}
  ]
};

const TARGET = 1650;
const N_CLIPS = 40;
const MAX_REPAIRS = typeof args.maxRepairs === "number" ? args.maxRepairs : 3;
const CENSUS_GROUPS = Math.max(1, Math.min(8, typeof args.censusGroups === "number" ? args.censusGroups : 5));
const MAX_RANGES = Math.max(4, Math.min(24, typeof args.maxAcceptableRangesPerSlot === "number" ? args.maxAcceptableRangesPerSlot : 12));

function ids() {
  return Array.from({length: N_CLIPS}, (_, i) => String(i + 1).padStart(2, "0"));
}

function clipPath(id) { return `input/${id}.mp4`; }

const SLOT_TEXT = {
  1: "Establishing: endless snowfield. Aerial. Snow-covered crags and blue ice foreground; past them open snowfield, one tiny walker and winding footprints behind. Single shot. Camera: steady aerial fly-forward with continuous lateral drift, even speed.",
  2: "Collapse: searcher gives out. Close-up of red-haired woman's face lying on her side in snow; tilted ground-level framing, snow drifting past. Single shot. Camera: slow push-in on face with slight drift, continuing to end.",
  3: "Transition: remembered city. City panorama fading up from black (dense rooftops, distant tower), cut to high-angle shot looking down narrow alley. Two shots. Camera: both locked off; framing does not change within either shot.",
  4: "Searching along wall. Frame opens almost entirely covered by large dark foreground mass; it sweeps away to reveal short-red-haired girl against sunlit wall; she leans out to look and moves along wall; framing ends behind her shoulder. Single shot. Camera: lateral tracking move travelling with her, slight handheld feel.",
  5: "The chase. Close shot of short-red-haired girl turning away; wide shot of her running down narrow alley; she climbs over edge of roof; injured small winged creature on roof tiles. Camera: in both running shot and creature shot camera pushes forward.",
  6: "Discovery and approach. Close-up of girl's gaze; hand reaching toward small winged creature on tiles; close-up of girl breaking into a smile. Three shots. Camera: two face close-ups locked off; middle shot pulls back while trucking sideways, gradually opening hand-creature relationship.",
  7: "Losing control. High overhead view of dim interior, papers and clutter strewn on floor; image becomes turbulent later in shot. Single shot. Camera: completely static at first, then starts to push forward and keeps accelerating."
};

const inventorySchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    probe_path: {type: "string"},
    sheets_dir: {type: "string"},
    shots_dir: {type: "string"},
    notes: {type: "array", items: {type: "string"}}
  },
  required: ["ok", "probe_path", "sheets_dir", "shots_dir", "notes"],
  additionalProperties: false
};

const clipAnnotationSchema = {
  type: "object",
  properties: {
    source: {type: "string", pattern: "^[0-9]{2}$"},
    duration_frames: {type: "integer", minimum: 0},
    summary: {type: "string"},
    setting: {type: "string"},
    characters: {type: "string"},
    action: {type: "string"},
    shot_count: {type: "integer", minimum: 1},
    cut_frames: {type: "array", items: {type: "integer", minimum: 0}},
    camera: {type: "string"},
    slot_matches: {type: "array", items: {
      type: "object",
      properties: {
        slot: {type: "integer", minimum: 1, maximum: 7},
        confidence: {type: "string", enum: ["high", "medium", "low"]},
        evidence: {type: "string"},
        concerns: {type: "string"}
      },
      required: ["slot", "confidence", "evidence", "concerns"],
      additionalProperties: false
    }},
    closest_confusors: {type: "array", items: {type: "string"}}
  },
  required: ["source", "duration_frames", "summary", "setting", "characters", "action", "shot_count", "cut_frames", "camera", "slot_matches", "closest_confusors"],
  additionalProperties: false
};

const censusSchema = {
  type: "object",
  properties: {
    group: {type: "integer"},
    annotations: {type: "array", items: clipAnnotationSchema},
    unreadable: {type: "array", items: {type: "string"}}
  },
  required: ["group", "annotations", "unreadable"],
  additionalProperties: false
};

const shortlistSchema = {
  type: "object",
  properties: {
    slot: {type: "integer", minimum: 1, maximum: 7},
    shortlist: {type: "array", minItems: 1, maxItems: 8, items: {
      type: "object",
      properties: {
        source: {type: "string", pattern: "^[0-9]{2}$"},
        confidence: {type: "string", enum: ["high", "medium", "low"]},
        evidence: {type: "string"},
        concerns: {type: "string"},
        likely_shot_count: {type: "integer", minimum: 1}
      },
      required: ["source", "confidence", "evidence", "concerns", "likely_shot_count"],
      additionalProperties: false
    }},
    rejected_examples: {type: "array", items: {
      type: "object",
      properties: {
        source: {type: "string", pattern: "^[0-9]{2}$"},
        why_not: {type: "string"}
      },
      required: ["source", "why_not"],
      additionalProperties: false
    }}
  },
  required: ["slot", "shortlist", "rejected_examples"],
  additionalProperties: false
};

const rangeSchema = {
  type: "object",
  properties: {
    a: {type: "integer", minimum: 0},
    b: {type: "integer", minimum: 1},
    notes: {type: "string"}
  },
  required: ["a", "b", "notes"],
  additionalProperties: false
};

const finalistSchema = {
  type: "object",
  properties: {
    slot: {type: "integer", minimum: 1, maximum: 7},
    evaluations: {type: "array", minItems: 1, items: {
      type: "object",
      properties: {
        source: {type: "string", pattern: "^[0-9]{2}$"},
        passes_all_parts: {type: "boolean"},
        evidence: {type: "string"},
        failing_parts: {type: "array", items: {type: "string"}},
        canonical: rangeSchema,
        acceptable_ranges: {type: "array", maxItems: 24, items: rangeSchema},
        closest_alternative: {type: "string", pattern: "^[0-9]{2}$"},
        closest_alternative_difference: {type: "string"}
      },
      required: ["source", "passes_all_parts", "evidence", "failing_parts", "canonical", "acceptable_ranges", "closest_alternative", "closest_alternative_difference"],
      additionalProperties: false
    }}
  },
  required: ["slot", "evaluations"],
  additionalProperties: false
};

const plannerSchema = {
  type: "object",
  properties: {
    found: {type: "boolean"},
    deficit_frames: {type: "integer"},
    suggested_range_changes: {type: "array", items: {
      type: "object",
      properties: {
        slot: {type: "integer", minimum: 1, maximum: 7},
        source: {type: "string", pattern: "^[0-9]{2}$"},
        a: {type: "integer", minimum: 0},
        b: {type: "integer", minimum: 1},
        why_still_valid: {type: "string"}
      },
      required: ["slot", "source", "a", "b", "why_still_valid"],
      additionalProperties: false
    }},
    notes: {type: "string"}
  },
  required: ["found", "deficit_frames", "suggested_range_changes", "notes"],
  additionalProperties: false
};

const buildSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    assembly_path: {type: "string"},
    selection_path: {type: "string"},
    build_log: {type: "string"},
    output_dir_listing: {type: "array", items: {type: "string"}},
    probe_summary: {type: "string"}
  },
  required: ["ok", "assembly_path", "selection_path", "build_log", "output_dir_listing", "probe_summary"],
  additionalProperties: false
};

const qaSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    spec_passed: {type: "boolean"},
    semantic_passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    evidence: {type: "string"}
  },
  required: ["passed", "spec_passed", "semantic_passed", "issues", "evidence"],
  additionalProperties: false
};

async function call(label, prompt, schema, phase) {
  const fullPrompt = [
    "You are working on CDC-A-X01 in the current workspace. Read instruction.md first and obey it.",
    "No network. Inputs are anonymous; do not guess film identities or attribution. Use only visible evidence from frames/clips plus ffprobe/OpenCV metadata.",
    "Keep drafts under work/; final deliverables only under output/ when explicitly asked.",
    "Assignment:",
    prompt
  ].join("\n\n");
  try {
    return await agent(fullPrompt, {label, schema, phase});
  } catch (e) {
    return null;
  }
}

function validRange(r) {
  return r && Number.isInteger(r.a) && Number.isInteger(r.b) && r.b > r.a && (r.b - r.a) > 0;
}

function computeOutputFrames(plan) {
  let c = 0;
  return plan.map(p => {
    const len = p.b - p.a;
    const out = {slot: p.slot, source: p.source, source_frames: [p.a, p.b], output_frames: [c, c + len], closest_alternative: p.closest_alternative, reason: p.reason};
    c += len;
    return out;
  });
}

function searchPlan(verifiedBySlot) {
  const slots = [1, 2, 3, 4, 5, 6, 7];
  const optionSets = slots.map(slot => {
    const evals = (verifiedBySlot[slot] && verifiedBySlot[slot].evaluations) || [];
    const opts = [];
    for (const ev of evals) {
      if (!ev || !ev.passes_all_parts) continue;
      const seen = new Set();
      const ranges = [];
      if (validRange(ev.canonical)) ranges.push(ev.canonical);
      for (const r of ev.acceptable_ranges || []) if (validRange(r)) ranges.push(r);
      for (const r of ranges) {
        const key = `${ev.source}:${r.a}:${r.b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        opts.push({slot, source: ev.source, a: r.a, b: r.b, len: r.b - r.a, closest_alternative: ev.closest_alternative, reason: ev.closest_alternative_difference, notes: r.notes || ""});
      }
    }
    opts.sort((x, y) => (x.source + String(x.a).padStart(5, "0") + String(x.b).padStart(5, "0")).localeCompare(y.source + String(y.a).padStart(5, "0") + String(y.b).padStart(5, "0")));
    return opts.slice(0, MAX_RANGES);
  });
  if (optionSets.some(o => o.length === 0)) return {found: false, reason: "A slot has no passing candidate with valid ranges", optionCounts: optionSets.map(o => o.length)};
  const mins = optionSets.map(o => Math.min(...o.map(x => x.len)));
  const maxs = optionSets.map(o => Math.max(...o.map(x => x.len)));
  const suffixMin = Array(slots.length + 1).fill(0), suffixMax = Array(slots.length + 1).fill(0);
  for (let i = slots.length - 1; i >= 0; i--) {
    suffixMin[i] = suffixMin[i + 1] + mins[i];
    suffixMax[i] = suffixMax[i + 1] + maxs[i];
  }
  let best = null;
  function rec(i, used, sum, chosen) {
    if (best) return;
    if (sum + suffixMin[i] > TARGET || sum + suffixMax[i] < TARGET) return;
    if (i === slots.length) {
      if (sum === TARGET) best = chosen.slice();
      return;
    }
    for (const opt of optionSets[i]) {
      if (used.has(opt.source)) continue;
      const ns = sum + opt.len;
      if (ns + suffixMin[i + 1] > TARGET || ns + suffixMax[i + 1] < TARGET) continue;
      used.add(opt.source);
      chosen.push(opt);
      rec(i + 1, used, ns, chosen);
      chosen.pop();
      used.delete(opt.source);
      if (best) return;
    }
  }
  rec(0, new Set(), 0, []);
  if (!best) return {found: false, reason: "No combination of acceptable ranges sums to 1650 with distinct sources", optionCounts: optionSets.map(o => o.length), mins, maxs};
  return {found: true, plan: best.map(o => ({slot: o.slot, source: o.source, a: o.a, b: o.b, closest_alternative: o.closest_alternative, reason: o.reason, notes: o.notes}))};
}

function buildSelectionJson(plan) {
  return {slots: computeOutputFrames(plan)};
}

log("Phase: inventory");
const inventory = await call("inventory", [
  "Create work/probe.json with ffprobe data for all input/01.mp4..input/40.mp4: decoded frame count (count_frames), avg_frame_rate, r_frame_rate, width, height, sample_aspect_ratio, pix_fmt, codec, duration, has_audio.",
  "Create work/sheets/NN.jpg contact sheets for every clip: enough tiled frames to judge content and camera movement (for example 4x5 or 5x6 across the clip), labeled with clip id and frame indices/timecodes if practical.",
  "Create work/shots/NN.json with approximate shot boundaries/cut frames using ffmpeg scene detection and/or OpenCV histogram differences; mark ambiguous boundaries.",
  "Do not modify input/. Return paths and anomalies. This is evidence collection, not final selection."
].join("\n"), inventorySchema, "inventory");
if (!inventory || !inventory.ok) return {status: "unresolved", stage: "inventory", inventory};

log("Phase: census");
const allIds = ids();
const groups = Array.from({length: CENSUS_GROUPS}, () => []);
allIds.forEach((id, i) => groups[i % CENSUS_GROUPS.length].push(id));
const censusResults = await parallel(groups.map((g, gi) => () => call(`census-${gi + 1}`, [
  `Visually inspect clips ${g.map(clipPath).join(", ")} using ${inventory.sheets_dir}/NN.jpg, ${inventory.shots_dir}/NN.json, ${inventory.probe_path}, and extract extra frames with ffmpeg/OpenCV when needed.`,
  "For each clip return one annotation. Describe concrete visible content: setting, characters (hair color/length, creatures, objects), actions, shot count and approximate cut frames, camera movement (static/locked, push-in, pull-back, truck/track, aerial drift, handheld feel), and any fade from black or turbulence.",
  "For slot_matches, only list slots where the clip could plausibly satisfy every clause; cite evidence and concerns. For closest_confusors list visually similar anonymous clip ids.",
  `Slot text for reference:\n${Object.entries(SLOT_TEXT).map(([k, v]) => `Slot ${k}: ${v}`).join("\n")}`,
  "Be conservative: do not force a match; unknown is better than guessing. Do not identify source films."
].join("\n"), censusSchema, "census")));
const census = [];
const unreadable = [];
for (let i = 0; i < censusResults.length; i++) {
  const r = censusResults[i];
  if (!r) { unreadable.push(...groups[i]); continue; }
  census.push(...(r.annotations || []));
  unreadable.push(...(r.unreadable || []));
}
if (census.length === 0) return {status: "unresolved", stage: "census", inventory, unreadable};

log("Phase: matching");
const censusJson = JSON.stringify(census);
const matchResults = await parallel([1, 2, 3, 4, 5, 6, 7].map(slot => () => call(`match-slot-${slot}`, [
  `Find the best anonymous candidates for Slot ${slot}. Slot requirement: ${SLOT_TEXT[slot]}`,
  `Use ${inventory.probe_path}, ${inventory.sheets_dir}, ${inventory.shots_dir}, and these census annotations: ${censusJson}`,
  "Inspect actual frames for any promising clip before shortlisting. Match every clause: subject/action, shot count and internal cuts, and the complete camera move.",
  "Return a ranked shortlist with concrete evidence and concerns, plus rejected_examples showing near misses and why they fail. Do not worry about overlap with other slots here."
].join("\n"), shortlistSchema, "matching")));
const shortlists = {};
for (let i = 0; i < matchResults.length; i++) {
  const r = matchResults[i];
  if (r) shortlists[r.slot || i + 1] = r;
}
const missingSlots = [1, 2, 3, 4, 5, 6, 7].filter(s => !shortlists[s] || !shortlists[s].shortlist || shortlists[s].shortlist.length === 0);
if (missingSlots.length) return {status: "unresolved", stage: "matching", inventory, unreadable, shortlists, missingSlots};

log("Phase: verification");
const verifyTasks = [];
for (let slot = 1; slot <= 7; slot++) {
  const sl = shortlists[slot];
  const candidates = sl.shortlist.slice(0, 5).map(x => x.source);
  verifyTasks.push(() => call(`verify-slot-${slot}`, [
    `Independently verify finalists for Slot ${slot}: candidates ${candidates.map(clipPath).join(", ")}.`,
    `Slot requirement: ${SLOT_TEXT[slot]}`,
    `Context: ${inventory.probe_path}; sheets ${inventory.sheets_dir}; shot boundaries ${inventory.shots_dir}; shortlist ${JSON.stringify(sl)}.`,
    "For each candidate, decode/extract dense frames around all detected shots and check every clause literally: exact subjects/actions, required number of shots and internal cuts, whether framing changes within locked-off shots, and whether the entire named camera move is present from start to end.",
    "If it passes, provide canonical half-open 0-based source frame range [a,b] that contains exactly the required material and whole camera move, plus up to 12 alternative acceptable contiguous ranges from the SAME clip that still satisfy the slot (e.g. slightly different in/out points that do not cut off a shot or move). Clearly mark ranges that would truncate required content as invalid by omission.",
    "If it fails, list failing_parts precisely. Always name closest_alternative (the other anonymous candidate most similar but not right) and one sentence stating a concrete visible difference.",
    "Use ffprobe frame counts to keep ranges in bounds. Do not assemble output."
  ].join("\n"), finalistSchema, "verification"));
}
const verifiedResults = await parallel(verifyTasks);
const verifiedBySlot = {};
const failedVerifySlots = [];
for (let slot = 1; slot <= 7; slot++) {
  const r = verifiedResults[slot - 1];
  if (!r || !r.evaluations || !r.evaluations.some(e => e.passes_all_parts)) failedVerifySlots.push(slot);
  else verifiedBySlot[slot] = r;
}
if (failedVerifySlots.length) return {status: "unresolved", stage: "verification", inventory, unreadable, shortlists, verifiedBySlot, failedVerifySlots};

log("Phase: planning");
let planSearch = searchPlan(verifiedBySlot);
let plannerNote = null;
if (!planSearch.found) {
  plannerNote = await call("range-planner", [
    "The deterministic range search failed to find 7 distinct sources whose acceptable contiguous ranges sum to exactly 1650 frames.",
    `Search diagnostic: ${JSON.stringify(planSearch)}`,
    `Verified slot data: ${JSON.stringify(verifiedBySlot)}`,
    "Re-inspect only as needed. Suggest concrete adjusted half-open ranges that still preserve every required shot and complete camera move, or state if impossible. Return suggested_range_changes even if found=false."
  ].join("\n"), plannerSchema, "planning");
  if (plannerNote && plannerNote.suggested_range_changes) {
    for (const ch of plannerNote.suggested_range_changes) {
      const slot = verifiedBySlot[ch.slot];
      if (!slot) continue;
      let ev = slot.evaluations.find(e => e.source === ch.source && e.passes_all_parts);
      if (!ev) {
        ev = {source: ch.source, passes_all_parts: true, evidence: "planner-added range; requires re-verification if used", failing_parts: [], canonical: {a: ch.a, b: ch.b, notes: ch.why_still_valid}, acceptable_ranges: [], closest_alternative: "00", closest_alternative_difference: "planner fallback; must be replaced before final if possible"};
        slot.evaluations.push(ev);
      }
      ev.acceptable_ranges = ev.acceptable_ranges || [];
      ev.acceptable_ranges.push({a: ch.a, b: ch.b, notes: "planner: " + ch.why_still_valid});
    }
    planSearch = searchPlan(verifiedBySlot);
  }
}
if (!planSearch.found) return {status: "unresolved", stage: "planning", inventory, unreadable, shortlists, verifiedBySlot, planSearch, plannerNote};

const finalSelection = buildSelectionJson(planSearch.plan);
const selectionJsonText = JSON.stringify(finalSelection, null, 2);

log("Phase: assembly");
const assemblyPrompt = [
  "Build the final deliverables now from this approved selection plan:",
  selectionJsonText,
  "Requirements: output/ must contain only output/assembly.mp4 and output/selection.json. Move/remove any other output files. selection.json must be exactly the approved JSON object above (same slots, order, ranges, closest_alternative, reason).",
  "For each segment, decode the chosen input clip and take exactly source frames [a,b), half-open, 0-based, at 1x forward speed with no scaling/cropping/mirroring/filters/text/interpolation/generated content. Because sources are 30 fps, use accurate seek with input before -ss (example form: ffmpeg -i input/NN.mp4 -ss a/30 -frames:v (b-a) -an -c:v libx264 -pix_fmt yuv420p -r 30 -video_track_timescale 30 work/seg_slotX.mp4). Do not use select/trim filters.",
  "Concatenate the 7 segments in slot order with hard cuts only; no transitions and no black frames. Produce H.264/yuv420p, 1280x720, SAR 1:1, constant 30/1 fps, no audio, exactly 1650 decoded frames. Prefer concat demuxer after uniform segment encodes; verify with ffprobe count_frames.",
  "Create a quick contact sheet work/assembly_check.jpg from the final assembly with segment boundary frame labels if practical.",
  "Run ffprobe verification and return build_log plus output_dir_listing. If anything mismatches, fix it before returning; do not return ok=true unless output specs pass."
].join("\n");
let build = await call("assembly", assemblyPrompt, buildSchema, "assembly");
if (!build || !build.ok) return {status: "unresolved", stage: "assembly", inventory, shortlists, verifiedBySlot, finalSelection, build};

log("Phase: qa");
const qaPrompt = [
  "Independently QA the finished deliverables in output/. Do not edit them in this pass.",
  "Check output/ contains exactly assembly.mp4 and selection.json. Probe assembly.mp4: H.264, yuv420p, 1280x720, SAR 1:1, constant 30/1 fps, no audio streams, decoded frame count exactly 1650.",
  "Validate selection.json schema and arithmetic: 7 slots in order; distinct two-digit sources; source_frames/output_frames half-open 0-based; b-a=d-c; segments start at 0 and abut; final d=1650.",
  "Visually verify semantics by extracting frames around each segment and boundaries: each segment matches its slot description including shot count/internal cuts and complete camera move; joins are hard cuts with no transition/black; no obvious scaling/crop/mirroring/filters/text.",
  `Slot requirements:\n${Object.entries(SLOT_TEXT).map(([k, v]) => `Slot ${k}: ${v}`).join("\n")}`,
  "Return passed only if both spec and semantic checks pass; otherwise list actionable issues."
].join("\n");
let verdict = await call("qa-1", qaPrompt, qaSchema, "qa");
let repairRound = 0;
while (verdict && !verdict.passed && repairRound < MAX_REPAIRS) {
  repairRound++;
  log(`Repair round ${repairRound}`);
  const repair = await call(`repair-${repairRound}`, [
    "Repair the current final deliverables in output/ based on QA issues, preserving the approved selection unless QA proves a semantic selection/range error.",
    `Approved selection: ${selectionJsonText}`,
    `QA issues: ${JSON.stringify(verdict.issues)}`,
    "If only encoding/spec arithmetic is wrong, rebuild assembly/selection to exactly the approved plan. If a semantic range is wrong, adjust only within the verified acceptable ranges and update selection.json consistently (distinct sources, abutting frames, total 1650). Keep output/ to exactly two files and re-probe before returning."
  ].join("\n"), buildSchema, "qa");
  if (!repair || !repair.ok) return {status: "unresolved", stage: "repair", round: repairRound, build, verdict, repair};
  build = repair;
  verdict = await call(`qa-${repairRound + 1}`, qaPrompt, qaSchema, "qa");
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  inventory,
  unreadable,
  shortlists,
  verifiedBySlot,
  planSearch: {found: planSearch.found, reason: planSearch.reason, optionCounts: planSearch.optionCounts},
  finalSelection,
  build,
  qa: verdict,
  repairRounds: repairRound,
  remainingBudget: budget.remaining()
};