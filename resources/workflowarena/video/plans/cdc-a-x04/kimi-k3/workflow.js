export const meta = {
  name: "cdc-a-x04-machine-runaway",
  description: "Scout 44 candidate clips, match them to 6 storyboard slots, localize exact change-point frames, assemble the beat-mapped hard-cut video, and verify frame-accurately with a repair loop",
  phases: [
    { title: "inventory", detail: "Probe decoded frame counts and build contact sheets for all 44 clips" },
    { title: "scout", detail: "Describe every clip's shots and visual state changes in parallel batches" },
    { title: "match", detail: "Shortlist candidate clips per storyboard slot" },
    { title: "localize", detail: "Pinpoint the exact 0-based change frame per slot and validate range feasibility" },
    { title: "resolve", detail: "Guarantee six distinct sources" },
    { title: "assemble", detail: "Trim, concat, and write solution.mp4 / solution.json / events.csv" },
    { title: "verify", detail: "Frame-accurate verification of all deliverables, with repair rounds" }
  ]
};

// ---------------------------------------------------------------------------
// Public task data (from instruction.md and input/beats.json) baked in so the
// script can do all deterministic arithmetic and workers get exact specs.
// ---------------------------------------------------------------------------
const BEATS = {
  fps: 30,
  total_frames: 858,
  slots: [
    { slot: 1, start_frame: 0,   end_frame: 150, accent_frame: 72  },
    { slot: 2, start_frame: 150, end_frame: 276, accent_frame: 204 },
    { slot: 3, start_frame: 276, end_frame: 420, accent_frame: 360 },
    { slot: 4, start_frame: 420, end_frame: 534, accent_frame: 480 },
    { slot: 5, start_frame: 534, end_frame: 690, accent_frame: 630 },
    { slot: 6, start_frame: 690, end_frame: 858, accent_frame: 780 }
  ]
};
const SLOTS = BEATS.slots.map(s => ({
  ...s,
  length: s.end_frame - s.start_frame,          // 150,126,144,114,156,168
  accent_offset: s.accent_frame - s.start_frame // 72,54,84,60,96,90
}));
const CLIPS = Array.from({ length: 44 }, (_, i) => String(i + 1).padStart(2, "0"));

const STORYBOARD = [
  "Slot 1 | Overload. In a pitch-black void, a lanky young man and a bald old man stand side by side on a small floating platform; full-figure long shot, camera essentially locked. Change: a blinding flash, and the surroundings turn from total black into a bright, heavily motion-blurred grey-white space, the two still standing on the platform.",
  "Slot 2 | Power cut. An open square hatch in a green tiled wall with a lamp lit inside it; close shot, locked camera. A tiled panel slides down over the hatch and a pair of gloved hands presses it flat. Change: the picture drops to full black; afterwards a wide engine room slowly emerges from the dark with two figures standing in it.",
  "Slot 3 | Intrusion. An empty square room with bare walls; frontal symmetrical long shot, locked camera; the young man swings his arms in the middle of the room. Change: dark cables pour out of the left corner and crawl over the left wall.",
  "Slot 4 | Breach. A tilted low-angle close shot hugging a tiled wall with a metal pipe running along it; the camera slides along the wall. Change: cables burst through the wall, debris flies, and the warm orange, cable-filled space behind it is fully revealed.",
  "Slot 5 | Encirclement. The bald old man stands alone before a golden curtain of vertically flowing light, hands clutching his head; medium shot, camera essentially locked. Change: the curtain behind him turns into rows of dark machinery studded with red indicator lights.",
  "Slot 6 | Failure. The old man stands alone in diagonally falling streaks of light; full-figure long shot, the camera settling to rest. Change: the warm orange light of the whole scene drains away into a dim, cold green."
].join("\n");

const FRAME_GUIDE = [
  "Frame-numbering rules (critical — the judge counts decoded frames):",
  "- All frame indices are 0-based over fully decoded frames at 30 fps.",
  "- Get the exact decoded frame count with: ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 <file>",
  "- Extract a single decoded frame K as PNG: ffmpeg -y -v error -i <file> -vf \"select=eq(n\\,K)\" -frames:v 1 out.png",
  "- Extract a window of frames K0..K1: ffmpeg -y -v error -i <file> -vf \"select='between(n\\,K0\\,K1)'\" -vsync 0 out_%03d.png",
  "- Do NOT trust container duration or nb_frames metadata alone; always count decoded frames."
].join("\n");

const CHANGE_DEF = [
  "Definition of a slot's change point: the FIRST decoded frame at which the later state of the slot's described change holds.",
  "Examples: for a flash that turns black void into bright grey-white space, it is the first bright frame after the flash onset; for a drop to full black, the first fully black frame; for cables bursting through a wall, the first frame where the breach/debris is visible; for a colour drain, the first frame where the cold green grade is fully established (use judgment for gradual drains and state your criterion)."
].join("\n");

// ---------------------------------------------------------------------------
// Phase 1 — inventory: decoded frame counts + contact sheets
// ---------------------------------------------------------------------------
phase("inventory");
log("Inventory: probing 44 clips and building contact sheets");

const inventorySchema = {
  type: "object",
  properties: {
    frame_counts: { type: "object" },
    notes: { type: "string" }
  },
  required: ["frame_counts", "notes"],
  additionalProperties: false
};

const inventory = await agent([
  "You are preparing inputs for a video-assembly task. Read instruction.md for context. The workspace has input/clips/01.mp4 .. input/clips/44.mp4 (silent H.264, 1280x720, SAR 1:1, 30 fps). Everything is offline; use only ffmpeg/ffprobe and shell tools.",
  "",
  FRAME_GUIDE,
  "",
  "Do ALL of the following:",
  "1. Create directories: work/, work/reports/, work/sheets/, work/tmp/, output/.",
  "2. For EVERY clip 01..44, measure the exact DECODED frame count with ffprobe -count_frames (nb_read_frames). Do not skip any clip.",
  "3. Write the results to work/clip_meta.json as a single JSON object mapping two-digit clip id strings to decoded frame counts, e.g. {\"01\": 273, ...}.",
  "4. For EVERY clip, build a contact sheet at work/sheets/NN.png, e.g.: ffmpeg -y -v error -i input/clips/NN.mp4 -vf \"fps=2,scale=320:180,tile=8x5\" -frames:v 1 work/sheets/NN.png  (each tile then spans ~0.5 s = 15 frames).",
  "5. Sanity-check that every contact sheet exists and is non-empty, and that counts look consistent with 6-12 s clips (180-360 frames). Re-measure any anomalies.",
  "",
  "Return the full clip->frame_count map in the frame_counts field and any anomalies in notes."
].join("\n"), { label: "inventory", phase: "inventory", schema: inventorySchema });

if (inventory === null) {
  return { status: "unresolved", reason: "Inventory worker failed; no frame counts or contact sheets available." };
}
const FRAME_COUNTS = {};
for (const c of CLIPS) {
  const v = Number(inventory.frame_counts?.[c]);
  FRAME_COUNTS[c] = Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
}
const missingCounts = CLIPS.filter(c => FRAME_COUNTS[c] === null);
if (missingCounts.length > 0) {
  log("Inventory missing counts for: " + missingCounts.join(","));
}

// ---------------------------------------------------------------------------
// Phase 2 — scout: describe all clips in parallel batches
// ---------------------------------------------------------------------------
const batchSize = (args && args.batchSize) || 4;
const batches = [];
for (let i = 0; i < CLIPS.length; i += batchSize) batches.push(CLIPS.slice(i, i + batchSize));

const clipReportSchema = {
  type: "object",
  properties: {
    clip: { type: "string" },
    frame_count: { type: "integer" },
    summary: { type: "string" },
    shots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          approx_range: { type: "array", items: { type: "integer" } },
          description: { type: "string" }
        },
        required: ["approx_range", "description"],
        additionalProperties: false
      }
    },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          approx_frame: { type: "integer" },
          kind: { type: "string" },
          before: { type: "string" },
          after: { type: "string" }
        },
        required: ["approx_frame", "kind", "before", "after"],
        additionalProperties: false
      }
    },
    motifs: { type: "array", items: { type: "string" } }
  },
  required: ["clip", "frame_count", "summary", "shots", "changes", "motifs"],
  additionalProperties: false
};
const batchReportSchema = {
  type: "object",
  properties: { reports: { type: "array", items: clipReportSchema } },
  required: ["reports"],
  additionalProperties: false
};

const scoutPrompt = (batch) => [
  "You are scouting candidate clips for a video-assembly task. Read instruction.md for the full task. The workspace has input/clips/01.mp4 .. input/clips/44.mp4 (silent, 1280x720, 30 fps), decoded frame counts in work/clip_meta.json, and contact sheets in work/sheets/NN.png (each tile ~15 frames).",
  "",
  FRAME_GUIDE,
  "",
  "Your batch of clips: " + batch.join(", ") + ".",
  "For EACH clip in your batch:",
  "1. Get its decoded frame count (work/clip_meta.json, or re-measure).",
  "2. View its contact sheet, then extract and view additional single frames (roughly every 15-30 frames, and densely around any abrupt visual change) into work/tmp/ so you can describe the actual content accurately.",
  "3. Describe: setting and colour palette, characters present (e.g. lanky young man, bald old man), camera behaviour (locked vs moving, framing: close/medium/long), each distinct shot with its approximate decoded frame range, and EVERY abrupt visual state change (cut, flash, blackout/fade, environment or lighting transformation) with the approximate 0-based decoded frame where the later state first holds, plus what is before and after it.",
  "4. Flag any of these motifs if present: pitch-black void with two men on a floating platform; green tiled wall with a square hatch and lamp; bare square room with arm-swinging man; tiled wall with a metal pipe, sliding camera; golden curtain of vertically flowing light; dark cables crawling or bursting; rows of dark machinery with red indicator lights; diagonally falling light streaks; warm orange palette draining to cold green; wide engine room emerging from darkness.",
  "5. Write each clip's report to work/reports/NN.json (same JSON shape as the report object you return).",
  "",
  "Be factual: describe only what you actually see in extracted frames. Approximate frames are fine here; exact localization happens later.",
  "Return one report object per clip in your batch."
].join("\n");

log("Scouting " + CLIPS.length + " clips in " + batches.length + " batches");
const scoutBranches = batches.map((batch, bi) => async () => {
  let r = await agent(scoutPrompt(batch), { label: "scout-" + bi, phase: "scout", schema: batchReportSchema });
  if (r === null) {
    r = await agent(scoutPrompt(batch) + "\n\nA previous attempt to produce this batch's reports failed or was malformed; redo the work and return the reports.", { label: "scout-" + bi + "-retry", phase: "scout", schema: batchReportSchema });
  }
  return r;
});
const scoutResults = await parallel(scoutBranches.map(f => () => f()));

const reportsByClip = {};
scoutResults.forEach((res, bi) => {
  if (res && Array.isArray(res.reports)) {
    for (const rep of res.reports) {
      const id = String(rep.clip || "").padStart(2, "0");
      if (CLIPS.includes(id)) reportsByClip[id] = rep;
    }
  }
});
let missingReports = CLIPS.filter(c => !reportsByClip[c]);
// One mop-up pass for clips whose batch failed entirely.
if (missingReports.length > 0) {
  log("Mop-up scouting for clips: " + missingReports.join(","));
  const mop = await agent(scoutPrompt(missingReports), { label: "scout-mopup", phase: "scout", schema: batchReportSchema });
  if (mop && Array.isArray(mop.reports)) {
    for (const rep of mop.reports) {
      const id = String(rep.clip || "").padStart(2, "0");
      if (CLIPS.includes(id)) reportsByClip[id] = rep;
    }
  }
  missingReports = CLIPS.filter(c => !reportsByClip[c]);
}

// ---------------------------------------------------------------------------
// Phase 3 — match: shortlist candidates per slot
// ---------------------------------------------------------------------------
phase("match");
log("Matching storyboard slots to candidate clips");

const matchSchema = {
  type: "object",
  properties: {
    shortlists: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: { type: "integer" },
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source: { type: "string" },
                rationale: { type: "string" },
                approx_change_frame: { type: "integer" }
              },
              required: ["source", "rationale"],
              additionalProperties: false
            }
          },
          notes: { type: "string" }
        },
        required: ["slot", "candidates"],
        additionalProperties: false
      }
    }
  },
  required: ["shortlists"],
  additionalProperties: false
};

const match = await agent([
  "You are matching storyboard slots to candidate clips for a video-assembly task. Read instruction.md for the full task.",
  "",
  "STORYBOARD (6 ordered slots; each slot needs ONE distinct candidate clip, one contiguous sub-range, and its change point must exist inside that sub-range):",
  STORYBOARD,
  "",
  "Scout reports for the 44 candidate clips have been written to work/reports/01.json .. work/reports/44.json (some may be missing). Contact sheets are in work/sheets/NN.png; decoded frame counts in work/clip_meta.json.",
  "",
  "Here is the collected digest of scout reports as JSON (may be incomplete; prefer the files when present):",
  JSON.stringify(reportsByClip),
  "",
  "Task: for each of the 6 slots, produce a ranked shortlist of 2-4 candidate clips that could contain the slot's described sub-range. Judge by: setting, palette, characters, framing, camera behaviour, and the presence of the slot's specific change (before-state and after-state both visible in ONE shot of the candidate, since a candidate may itself contain original film cuts).",
  "If a shortlist feels uncertain, inspect the actual clips yourself: extract frames per the guide below and view them before deciding.",
  "",
  FRAME_GUIDE,
  "",
  "Give an approx_change_frame (best current guess, 0-based decoded frame) when the scout data supports one. Note explicitly any slot for which no candidate fits well."
].join("\n"), { label: "match", phase: "match", schema: matchSchema });

if (match === null) {
  return { status: "unresolved", reason: "Matcher failed", reports_collected: Object.keys(reportsByClip).length, missing_reports: missingReports };
}

const shortlistBySlot = {};
for (const s of SLOTS) {
  const entry = (match.shortlists || []).find(x => x.slot === s.slot);
  const seen = new Set();
  const cands = [];
  for (const c of (entry?.candidates || [])) {
    const id = String(c.source || "").padStart(2, "0");
    if (CLIPS.includes(id) && !seen.has(id)) { seen.add(id); cands.push({ ...c, source: id }); }
  }
  shortlistBySlot[s.slot] = { candidates: cands, notes: entry?.notes || "" };
}

// ---------------------------------------------------------------------------
// Phase 4 — localize: exact change frame per slot (parallel), with feasibility
// ---------------------------------------------------------------------------
const locSchema = {
  type: "object",
  properties: {
    slot: { type: "integer" },
    chosen_source: { type: "string" },
    change_frame: { type: "integer" },
    clip_frame_count: { type: "integer" },
    confidence: { type: "string" },
    change_description: { type: "string" },
    alternates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          change_frame: { type: "integer" },
          clip_frame_count: { type: "integer" },
          note: { type: "string" }
        },
        required: ["source", "change_frame", "clip_frame_count"],
        additionalProperties: false
      }
    }
  },
  required: ["slot", "chosen_source", "change_frame", "clip_frame_count", "confidence", "alternates"],
  additionalProperties: false
};

const feasible = (slotSpec, changeFrame, clipFrames) => {
  const a = changeFrame - slotSpec.accent_offset;
  return a >= 0 && (a + slotSpec.length) <= clipFrames;
};

const localizePrompt = (slotSpec, extra) => {
  const sl = shortlistBySlot[slotSpec.slot];
  const candLines = sl.candidates.map(c =>
    `- clip ${c.source} (${FRAME_COUNTS[c.source] ?? "unknown"} decoded frames): ${c.rationale}` +
    (Number.isInteger(c.approx_change_frame) ? ` [scout approx change ~frame ${c.approx_change_frame}]` : "")
  ).join("\n");
  return [
    "You are localizing the exact change-point frame for ONE slot of a video-assembly task. Read instruction.md for the full task.",
    "",
    "SLOT SPEC:",
    `- slot ${slotSpec.slot}: output frames [${slotSpec.start_frame}, ${slotSpec.end_frame}), length ${slotSpec.length} frames, accent (change point) must land at output frame ${slotSpec.accent_frame}, i.e. at offset ${slotSpec.accent_offset} within the slot.`,
    `- slot description: ${SLOTS_DESC[slotSpec.slot - 1]}`,
    "",
    CHANGE_DEF,
    "",
    FRAME_GUIDE,
    "",
    "SHORTLISTED CANDIDATES (ranked):",
    candLines || "(none — search on your own)",
    sl.notes ? "Matcher notes: " + sl.notes : "",
    "",
    "Do ALL of the following:",
    "1. For each shortlisted candidate, measure/confirm its decoded frame count, then inspect it densely around the suspected change: extract frames in windows (e.g. K-6..K+6) with ffmpeg select filters into work/tmp/slot" + slotSpec.slot + "/ and VIEW them to find the exact first decoded frame where the later state holds.",
    "2. Confirm the chosen clip really shows the slot's before-state, the change, and the after-state within one shot of the candidate (adjacent shots at the sub-range head/tail are acceptable).",
    "3. Feasibility (mandatory): with change frame p you must have p - " + slotSpec.accent_offset + " >= 0 and p - " + slotSpec.accent_offset + " + " + slotSpec.length + " <= clip_frame_count, so the full slot sub-range exists inside the candidate. If your best change frame violates this, adjust ONLY if the true change frame genuinely differs; otherwise mark lower confidence and explain.",
    "4. If none of the shortlisted candidates fits, review work/reports/*.json and inspect other clips (contact sheets in work/sheets/) to find a better one — do not force a bad match.",
    "5. Record up to 2 alternates (other fitting clips with their exact change frames) in case of conflicts with other slots.",
    (extra ? "\nADDITIONAL CONSTRAINT FROM PREVIOUS ATTEMPT:\n" + extra : ""),
    "",
    "Return the structured result. change_frame is the exact 0-based decoded frame in the chosen candidate where the later state first holds. clip_frame_count is the chosen clip's exact decoded frame count."
  ].join("\n");
};

const SLOTS_DESC = [
  "Slot 1 | Overload. In a pitch-black void, a lanky young man and a bald old man stand side by side on a small floating platform; full-figure long shot, camera essentially locked. Change: a blinding flash, and the surroundings turn from total black into a bright, heavily motion-blurred grey-white space, the two still standing on the platform.",
  "Slot 2 | Power cut. An open square hatch in a green tiled wall with a lamp lit inside it; close shot, locked camera. A tiled panel slides down over the hatch and a pair of gloved hands presses it flat. Change: the picture drops to full black; afterwards a wide engine room slowly emerges from the dark with two figures standing in it.",
  "Slot 3 | Intrusion. An empty square room with bare walls; frontal symmetrical long shot, locked camera; the young man swings his arms in the middle of the room. Change: dark cables pour out of the left corner and crawl over the left wall.",
  "Slot 4 | Breach. A tilted low-angle close shot hugging a tiled wall with a metal pipe running along it; the camera slides along the wall. Change: cables burst through the wall, debris flies, and the warm orange, cable-filled space behind it is fully revealed.",
  "Slot 5 | Encirclement. The bald old man stands alone before a golden curtain of vertically flowing light, hands clutching his head; medium shot, camera essentially locked. Change: the curtain behind him turns into rows of dark machinery studded with red indicator lights.",
  "Slot 6 | Failure. The old man stands alone in diagonally falling streaks of light; full-figure long shot, the camera settling to rest. Change: the warm orange light of the whole scene drains away into a dim, cold green."
];

log("Localizing change frames for 6 slots");
const locResults = await parallel(SLOTS.map(slotSpec => async () => {
  let r = await agent(localizePrompt(slotSpec, ""), { label: "localize-" + slotSpec.slot, phase: "localize", schema: locSchema });
  if (r === null) {
    r = await agent(localizePrompt(slotSpec, "A previous attempt failed or returned malformed data; redo the localization."), { label: "localize-" + slotSpec.slot + "-retry", phase: "localize", schema: locSchema });
  }
  if (r !== null) {
    r.chosen_source = String(r.chosen_source || "").padStart(2, "0");
    // Feasibility re-attempt: give the worker one chance to fix an infeasible range.
    const clipFrames = FRAME_COUNTS[r.chosen_source] ?? r.clip_frame_count;
    if (!CLIPS.includes(r.chosen_source) || !feasible(slotSpec, r.change_frame, clipFrames)) {
      const constraint = `Your previous answer (clip ${r.chosen_source}, change frame ${r.change_frame}, clip length ${clipFrames}) is INFEASIBLE or invalid: the sub-range [p - ${slotSpec.accent_offset}, p - ${slotSpec.accent_offset} + ${slotSpec.length}) must lie fully inside the candidate's decoded frames and the candidate id must be one of 01..44. Re-examine the footage; either find the correct change frame that satisfies this, or choose a different candidate (from the shortlist, its alternates, or any other clip after inspection).`;
      const r2 = await agent(localizePrompt(slotSpec, constraint), { label: "localize-" + slotSpec.slot + "-fix", phase: "localize", schema: locSchema });
      if (r2 !== null) {
        r2.chosen_source = String(r2.chosen_source || "").padStart(2, "0");
        const cf2 = FRAME_COUNTS[r2.chosen_source] ?? r2.clip_frame_count;
        if (CLIPS.includes(r2.chosen_source) && feasible(slotSpec, r2.change_frame, cf2)) r = r2;
        else r.feasibility_problem = `change ${r.change_frame} in clip ${r.chosen_source} (len ${clipFrames}) cannot host slot length ${slotSpec.length} at accent offset ${slotSpec.accent_offset}`;
      } else {
        r.feasibility_problem = "feasibility re-attempt failed";
      }
    }
  }
  return { slot: slotSpec.slot, loc: r };
}).map(f => () => f()));

// ---------------------------------------------------------------------------
// Phase 5 — resolve: distinct sources across slots
// ---------------------------------------------------------------------------
phase("resolve");

const buildAssignmentCheck = (entries) => {
  const problems = [];
  const seen = new Map();
  for (const e of entries) {
    const slotSpec = SLOTS[e.slot - 1];
    if (!slotSpec) { problems.push("unknown slot " + e.slot); continue; }
    if (!CLIPS.includes(e.source)) { problems.push(`slot ${e.slot}: invalid source ${e.source}`); continue; }
    const cf = FRAME_COUNTS[e.source] ?? e.clip_frame_count;
    if (!feasible(slotSpec, e.change_frame, cf)) {
      problems.push(`slot ${e.slot}: change frame ${e.change_frame} in clip ${e.source} (len ${cf}) infeasible for slot length ${slotSpec.length} at accent offset ${slotSpec.accent_offset}`);
    }
    if (seen.has(e.source)) problems.push(`clips ${e.source} chosen by both slot ${seen.get(e.source)} and slot ${e.slot}`);
    else seen.set(e.source, e.slot);
  }
  return problems;
};

let assignment = locResults.map(r => r.loc ? {
  slot: r.slot,
  source: r.loc.chosen_source,
  change_frame: r.loc.change_frame,
  clip_frame_count: FRAME_COUNTS[r.loc.chosen_source] ?? r.loc.clip_frame_count,
  confidence: r.loc.confidence,
  alternates: r.loc.alternates || []
} : null);

const resolveSchema = {
  type: "object",
  properties: {
    assignment: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: { type: "integer" },
          source: { type: "string" },
          change_frame: { type: "integer" },
          clip_frame_count: { type: "integer" },
          confidence: { type: "string" }
        },
        required: ["slot", "source", "change_frame", "clip_frame_count"],
        additionalProperties: false
      }
    },
    rationale: { type: "string" }
  },
  required: ["assignment", "rationale"],
  additionalProperties: false
};

const localizationDigest = locResults.map(r => ({
  slot: r.slot,
  failed: r.loc === null,
  chosen: r.loc ? { source: r.loc.chosen_source, change_frame: r.loc.change_frame, clip_frame_count: r.loc.clip_frame_count, confidence: r.loc.confidence, feasibility_problem: r.loc.feasibility_problem || null } : null,
  alternates: r.loc ? r.loc.alternates : []
}));

let resolveProblems = assignment.some(a => a === null)
  ? ["slots with failed localization: " + locResults.filter(r => r.loc === null).map(r => r.slot).join(",")]
  : buildAssignmentCheck(assignment.map(a => ({ slot: a.slot, source: a.source, change_frame: a.change_frame, clip_frame_count: a.clip_frame_count })));

let resolveRound = 0;
while (resolveProblems.length > 0 && resolveRound < 2) {
  resolveRound++;
  log("Resolving assignment conflicts (round " + resolveRound + "): " + resolveProblems.join(" | "));
  const resolver = await agent([
    "You are finalizing the clip assignment for a 6-slot video-assembly task. Read instruction.md. Each slot needs ONE DISTINCT candidate clip (01..44) and an exact 0-based change frame; the sub-range [change - accent_offset, change - accent_offset + slot_length) must fit inside the candidate's decoded frames.",
    "",
    "Slot lengths/accent offsets: " + SLOTS.map(s => `slot ${s.slot}: len ${s.length}, accent offset ${s.accent_offset}`).join("; ") + ".",
    "",
    "Current per-slot localization results (with alternates):",
    JSON.stringify(localizationDigest, null, 1),
    "",
    "PROBLEMS TO FIX:",
    resolveProblems.map(p => "- " + p).join("\n"),
    "",
    "You may re-inspect any clip (contact sheets work/sheets/NN.png, frame extraction per below, decoded counts in work/clip_meta.json) and read work/reports/*.json. Prefer each slot's primary choice; use its alternates or a newly inspected clip only to remove conflicts or infeasibility, and re-verify the exact change frame for any slot you change.",
    "",
    FRAME_GUIDE,
    "",
    CHANGE_DEF,
    "",
    "Return the complete 6-entry assignment (every slot 1..6 exactly once, distinct sources)."
  ].join("\n"), { label: "resolve-" + resolveRound, phase: "resolve", schema: resolveSchema });

  if (resolver === null) break;
  const normalized = (resolver.assignment || []).map(e => ({
    slot: e.slot,
    source: String(e.source || "").padStart(2, "0"),
    change_frame: e.change_frame,
    clip_frame_count: FRAME_COUNTS[String(e.source || "").padStart(2, "0")] ?? e.clip_frame_count,
    confidence: e.confidence || "resolver"
  }));
  const slotsOk = SLOTS.every(s => normalized.filter(e => e.slot === s.slot).length === 1) && normalized.length === 6;
  if (!slotsOk) { resolveProblems = ["resolver did not return exactly one entry per slot 1..6"]; continue; }
  assignment = normalized;
  resolveProblems = buildAssignmentCheck(assignment);
}

if (resolveProblems.length > 0) {
  return {
    status: "unresolved",
    reason: "Could not produce a feasible, conflict-free 6-clip assignment",
    problems: resolveProblems,
    localization: localizationDigest,
    missing_reports: missingReports
  };
}

// ---------------------------------------------------------------------------
// Deterministic assembly plan
// ---------------------------------------------------------------------------
const segments = SLOTS.map(slotSpec => {
  const a = assignment.find(e => e.slot === slotSpec.slot);
  const start = a.change_frame - slotSpec.accent_offset;
  return {
    slot: slotSpec.slot,
    source: a.source,
    source_frames: [start, start + slotSpec.length],
    output_frames: [slotSpec.start_frame, slotSpec.end_frame],
    change_frame: a.change_frame
  };
});

const solutionJsonText = JSON.stringify({
  segments: segments.map(g => ({ slot: g.slot, source: g.source, source_frames: g.source_frames, output_frames: g.output_frames }))
}, null, 1) + "\n";

const eventsCsvText = "slot,source,source_frame,output_frame\n" +
  segments.map(g => `${g.slot},${g.source},${g.change_frame},${SLOTS[g.slot - 1].accent_frame}`).join("\n") + "\n";

const ffmpegInputs = segments.map(g => `-i input/clips/${g.source}.mp4`).join(" ");
const ffmpegFilters = segments.map((g, i) => `[${i}:v]trim=start_frame=${g.source_frames[0]}:end_frame=${g.source_frames[1]},setpts=PTS-STARTPTS[v${i}]`).join(";");
const ffmpegConcat = segments.map((_, i) => `[v${i}]`).join("") + "concat=n=6:v=1:a=0[vout]";
const ffmpegCmd = `ffmpeg -y ${ffmpegInputs} -filter_complex "${ffmpegFilters};${ffmpegConcat}" -map "[vout]" -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -r 30 -an output/solution.mp4`;

// ---------------------------------------------------------------------------
// Phase 6 — assemble
// ---------------------------------------------------------------------------
phase("assemble");
log("Assembling solution.mp4 and metadata files");

const assemblePrompt = (extra) => [
  "You are executing the final assembly for a video-assembly task. Read instruction.md for deliverable specs. Work in the task workspace; deliverables go to output/.",
  "",
  "The cut plan is FINAL and frame-exact (0-based decoded frames, half-open ranges):",
  JSON.stringify(segments, null, 1),
  "",
  "Do ALL of the following:",
  "1. Create output/ if needed. Build the video with EXACTLY this command (it trims each source by decoded frame index and concatenates; all inputs are 1280x720, 30 fps, so the concat filter is valid):",
  "",
  ffmpegCmd,
  "",
  "2. Verify the command produced 858 frames (ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 output/solution.mp4). If it did not, diagnose (e.g. re-check trim indices) and rebuild until the decoded frame count is exactly 858. Do not pad, duplicate, or drop frames.",
  "3. Write output/solution.json with EXACTLY this content:",
  solutionJsonText,
  "4. Write output/events.csv with EXACTLY this content:",
  eventsCsvText,
  "5. Confirm the three files exist: output/solution.mp4, output/solution.json, output/events.csv.",
  (extra ? "\nISSUES FROM VERIFICATION TO FIX (redo whatever is needed, keeping the cut plan unless an issue says it is wrong):\n" + extra : ""),
  "",
  "Return a concise report of what you did and the measured frame count."
].join("\n");

let assembly = await agent(assemblePrompt(""), { label: "assemble", phase: "assemble" });
if (assembly === null) {
  assembly = await agent(assemblePrompt("The previous assembly attempt failed entirely; perform all steps now."), { label: "assemble-retry", phase: "assemble" });
  if (assembly === null) {
    return { status: "unresolved", reason: "Assembly failed twice", segments };
  }
}

// ---------------------------------------------------------------------------
// Phase 7 — verify (+ repair loop)
// ---------------------------------------------------------------------------
phase("verify");

const verdictSchema = {
  type: "object",
  properties: {
    passed: { type: "boolean" },
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          ok: { type: "boolean" },
          detail: { type: "string" }
        },
        required: ["name", "ok", "detail"],
        additionalProperties: false
      }
    },
    issues: { type: "array", items: { type: "string" } }
  },
  required: ["passed", "checks", "issues"],
  additionalProperties: false
};

const verifyPrompt = [
  "You are the independent verifier for a video-assembly task. Read instruction.md for the deliverable specs and judging criteria. Do NOT trust prior workers; measure everything yourself.",
  "",
  "Expected cut plan (0-based decoded frames, half-open):",
  JSON.stringify(segments, null, 1),
  "",
  "Expected output/solution.json content:",
  solutionJsonText,
  "Expected output/events.csv content:",
  eventsCsvText,
  "",
  FRAME_GUIDE,
  "",
  "Run EVERY check:",
  "A. Files: output/solution.mp4, output/solution.json, output/events.csv all exist; exactly these deliverables are required (extra files in output/ are not required, but the three must be present).",
  "B. Container: solution.mp4 is H.264 video, yuv420p, 1280x720, SAR 1:1, constant 30/1 fps (r_frame_rate and avg_frame_rate both 30/1), NO audio stream, decoded frame count exactly 858 (use ffprobe -count_frames).",
  "C. solution.json parses and matches the expected content EXACTLY (same slot order, same source ids as two-digit strings, same frame numbers).",
  "D. events.csv has header 'slot,source,source_frame,output_frame' and 6 rows matching the expected content EXACTLY.",
  "E. Frame-accurate content: for each slot, extract from output/solution.mp4 the frames at output_frames[0], accent frame, and output_frames[1]-1; extract from the source candidate input/clips/SS.mp4 the frames at source_frames[0], source_frame (change frame), and source_frames[1]-1. Compare corresponding frames VISUALLY (the output was re-encoded at CRF 16, so compare by viewing / by SSIM via 'ffmpeg -i a.png -i b.png -lavfi ssim -f null -', expecting SSIM very close to 1), and confirm they match. Also confirm cut boundaries: output frames 0, 150, 276, 420, 534, 690 start the correct source content, and frame 857 is the last frame of slot 6's sub-range.",
  "F. Change-point plausibility: for each slot, view the frames around the accent in the OUTPUT (accent-2..accent+2) and confirm the described change's later state first holds exactly at the accent frame (see slot descriptions in instruction.md; earlier frames show the before-state).",
  "G. No manipulation: confirm slot content is a plain 1x-speed forward excerpt (no transitions, text, crop, mirroring) by viewing a few mid-slot frames.",
  "",
  "Report each check with ok=true/false and a short detail. passed=true only if every check passed. Put concrete, actionable descriptions of any failure into issues (name the slot, the frame numbers, and what you observed)."
].join("\n");

let verdict = await agent(verifyPrompt, { label: "verify-0", phase: "verify", schema: verdictSchema });
const maxRepairs = (args && Number.isInteger(args.maxRepairs)) ? args.maxRepairs : 3;
for (let round = 0; verdict && !verdict.passed && round < maxRepairs; round++) {
  log("Verification failed; repair round " + (round + 1) + ": " + verdict.issues.join(" | "));
  const repair = await agent(assemblePrompt(
    verdict.issues.map(i => "- " + i).join("\n") +
    "\n\nIf an issue says the cut plan itself (clip choice or change frame) is wrong, investigate the footage first (extract and view frames per the frame guide), correct the plan, and rebuild ALL three deliverables consistently (solution.mp4 via the same ffmpeg filter pattern with corrected trim indices, solution.json, events.csv). Report any plan change explicitly."
  ), { label: "repair-" + (round + 1), phase: "verify" });
  if (repair === null) {
    return { status: "unresolved", reason: "Repair worker failed", last_verdict: verdict, segments };
  }
  verdict = await agent(verifyPrompt + "\n\nNote: a repair round just ran; re-measure everything from scratch. If the repair reported a plan change, first read output/solution.json and output/events.csv and verify the NEW declared plan (including checking the corrected change frames against the footage), then verify the video against the declared plan in the files rather than the old plan above.", { label: "verify-" + (round + 1), phase: "verify", schema: verdictSchema });
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  assignment: segments.map(g => ({
    slot: g.slot,
    source: g.source,
    source_frames: g.source_frames,
    output_frames: g.output_frames,
    change_frame: g.change_frame,
    confidence: (assignment.find(a => a.slot === g.slot) || {}).confidence || null
  })),
  deliverables: ["output/solution.mp4", "output/solution.json", "output/events.csv"],
  verification: verdict,
  unresolved_issues: verdict && !verdict.passed ? verdict.issues : [],
  missing_scout_reports: missingReports
};
