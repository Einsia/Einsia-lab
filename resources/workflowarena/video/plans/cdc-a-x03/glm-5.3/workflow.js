export const meta = {
  name: "cdc-a-x03-sequence-assembly",
  description: "Inspect 45 anonymous candidate clips, select 7 distinct slot-matched clips, assemble solution.mp4 and the two JSON deliverables, and verify them frame by frame",
  phases: [
    {title: "Inventory and frame sheets", detail: "ffprobe every clip and extract evenly spaced preview frames into work/sheets/"},
    {title: "Visual triage", detail: "Describe every clip's setting, characters, screen layout, shot size, camera movement and cut structure"},
    {title: "Slot selection", detail: "Per-slot deep inspection of shortlisted candidates and final clip choice with evidence"},
    {title: "Assignment resolution and axis continuity", detail: "Enforce 7 distinct clips and review 180-degree-rule consistency"},
    {title: "Assembly", detail: "Concatenate clips in slot order and write output/solution.mp4, output/solution.json, output/selection-evidence.json"},
    {title: "Verification and repair", detail: "Format/JSON checks plus frame-level comparison of solution.mp4 against declared sources; repair loop"}
  ]
};

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

const maxRepairs = (args && typeof args.maxRepairs === "number" && args.maxRepairs >= 0) ? args.maxRepairs : 3;

const clipIds = [];
for (let i = 1; i <= 45; i++) clipIds.push(String(i).padStart(2, "0"));

const SLOT_SPECS = [
  {
    slot: 1,
    spec: "Slot 1 — Establishing: two people in danger. Narrative function: establish the space and the two characters' initial situation. Content: a cold cyan mechanical space; a suspended grated platform runs across the frame, a tall wall of buttons and mist behind it. The thin boy is sprawled and struggling on the platform on FRAME LEFT; the bald old man stands on FRAME RIGHT, bending and looking toward the boy. Shot size: extreme wide; both characters are small full figures. Angle/lens: side-on, eye level; platform roughly parallel to the bottom of frame. Camera: a single continuous locked-off shot."
  },
  {
    slot: 2,
    spec: "Slot 2 — First exchange: shot/reverse shot. Narrative function: the two speak face to face for the first time. Content: most of the clip is a profile close-up of the boy against a pale riveted metal wall; he looks up and speaks several lines; then a cut to a single close-up of the old man, leaning forward and replying. Shot size: close-up against close-up. Angle/lens: two near-eye-level profile / three-quarter singles forming a shot/reverse shot; soft background. Camera: locked off."
  },
  {
    slot: 3,
    spec: "Slot 3 — Standoff in a closed room. Narrative function: build silent tension through alternating singles. Content: a dark-red room. The clip opens on a medium close single of the old man, then a medium single of the boy, then a close-up of an old candlestick telephone, then a brief high-angle view down on the old man, ending back on a close single of the old man. Shot size: alternating medium close, medium and close-up. Angle/lens: singles are near-eye-level frontal three-quarters, with one high-angle shot between them. Camera: essentially static."
  },
  {
    slot: 4,
    spec: "Slot 4 — Escalation: the receiver. Narrative function: the standoff turns physical. Content: the clip opens directly on the boy walking toward the old telephone in the foreground and reaching out; cut to an over-the-shoulder shot past the back of the boy's head as the old man reaches across, snatches the receiver and holds it up toward the lens. Shot size: medium-full of the boy, then over-the-shoulder close. Angle/lens: low camera with the telephone filling a large foreground block; then an over-the-shoulder reverse. Camera: mostly static; change comes from action and the cut."
  },
  {
    slot: 5,
    spec: "Slot 5 — Restaging. Narrative function: a change of positions within the confrontation that sets up a new two-shot. Content: a warm brown hall with a huge arched grille door behind. The old man starts with his back to camera, then turns to face it; the boy walks into frame and stops beside and behind him, forming a foreground/background two-shot as they keep talking. Shot size: medium two-shot, old man in the foreground. Angle/lens: eye level, one continuous shot. Camera: locked off."
  },
  {
    slot: 6,
    spec: "Slot 6 — The escape begins: through the doorway. Narrative function: the two leave the light for unknown darkness. Content: inside a door, a heavy black curtain on one side and a bright doorway on the other. The old man squeezes in from the light and looks around warily; the boy follows close behind him. Shot size: medium to medium close as the characters come toward the lens. Angle/lens: eye level from the dark interior facing the doorway, strong backlight; one continuous shot. Camera: locked off."
  },
  {
    slot: 7,
    spec: "Slot 7 — Escape: leaving the other behind. Narrative function: the old man goes ahead and the boy is left behind. Content: a dim space with green shafts of light. One continuous shot: it opens with the boy standing at the edge of a platform and the old man already on a nearby thin tall post; the old man then hops from post to post away from him, and the boy gradually leaves frame. Shot size: full shot. Angle/lens: eye level, slightly low. Camera: the camera TRUCKS with the old man in the direction of his hops (this is the only slot that requires camera movement)."
  }
];

const CHARACTERS = "The two recurring characters are: (a) a THIN BOY and (b) a BALD OLD MAN in a dark coat. Learn their appearance from the clips themselves; several candidates overlap in time or show the same scene with similar pictures, so look for fine differences.";

function batches(ids, size) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

const j = (x) => JSON.stringify(x);

function findDuplicates(picks) {
  const seen = {};
  const dupSources = new Set();
  for (const p of picks) {
    if (!p || !p.source) continue;
    if (seen[p.source]) dupSources.add(p.source);
    seen[p.source] = true;
  }
  return [...dupSources];
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const inventorySchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          frames: {type: "integer"},
          duration_s: {type: "number"},
          width: {type: "integer"},
          height: {type: "integer"},
          fps: {type: "number"},
          sheets_written: {type: "integer"},
          ok: {type: "boolean"},
          notes: {type: "string"}
        },
        required: ["clip", "frames", "duration_s", "width", "height", "fps", "sheets_written", "ok"],
        additionalProperties: false
      }
    }
  },
  required: ["clips"],
  additionalProperties: false
};

const triageSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          setting: {type: "string"},
          characters: {type: "string", enum: ["boy_only", "old_man_only", "both", "neither", "unclear"]},
          boy_position: {type: "string"},
          old_man_position: {type: "string"},
          shot_size: {type: "string"},
          camera_movement: {type: "string"},
          cut_structure: {type: "string"},
          color_palette: {type: "string"},
          distinctive_features: {type: "string"},
          eyeline_or_movement: {type: "string"}
        },
        required: ["clip", "setting", "characters", "boy_position", "old_man_position", "shot_size", "camera_movement", "cut_structure", "color_palette", "distinctive_features", "eyeline_or_movement"],
        additionalProperties: false
      }
    }
  },
  required: ["clips"],
  additionalProperties: false
};

const slotPickSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    source: {type: "string"},
    matched_all_fields: {type: "boolean"},
    field_notes: {type: "string"},
    considered: {type: "array", items: {type: "string"}},
    most_similar_other: {type: "string"},
    visible_difference: {type: "string"},
    evidence_frames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
    confidence: {type: "string", enum: ["high", "medium", "low"]}
  },
  required: ["slot", "source", "matched_all_fields", "field_notes", "considered", "most_similar_other", "visible_difference", "evidence_frames", "confidence"],
  additionalProperties: false
};

const verdictSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    details: {type: "string"}
  },
  required: ["passed", "issues", "details"],
  additionalProperties: false
};

const reassignSchema = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: {type: "integer"},
          source: {type: "string"},
          note: {type: "string"}
        },
        required: ["slot", "source", "note"],
        additionalProperties: false
      }
    },
    rationale: {type: "string"}
  },
  required: ["assignments", "rationale"],
  additionalProperties: false
};

const assemblySchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    method: {type: "string"},
    total_frames: {type: "integer"},
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: {type: "integer"},
          source: {type: "string"},
          frames: {type: "integer"}
        },
        required: ["slot", "source", "frames"],
        additionalProperties: false
      }
    },
    notes: {type: "string"}
  },
  required: ["ok", "method", "total_frames", "segments", "notes"],
  additionalProperties: false
};

// ---------------------------------------------------------------------------
// Phase 1 — inventory + preview frame sheets (5 parallel batches)
// ---------------------------------------------------------------------------

phase("Inventory and frame sheets");

const probeBatches = batches(clipIds, 9);

const inventoryResults = await parallel(probeBatches.map((ids, bi) => () => agent(
  "You are a worker on task CDC-A-X03 (full task in instruction.md in the workspace). " +
  "Do NOT try to solve the slot selection. Your job is only to inventory and extract preview frames.\n\n" +
  "Clips: " + ids.join(", ") + "\n\n" +
  "For EACH clip NN in the list:\n" +
  "1. Run ffprobe on input/NN.mp4 to obtain width, height, avg_frame_rate (as fps), duration, and the decoded frame count " +
  "(use `ffprobe -count_frames -select_streams v:0 -show_entries stream=nb_read_frames` if nb_frames is missing or suspicious).\n" +
  "2. Extract evenly spaced preview frames into work/sheets/NN/ as PNG files named frame_001.png, frame_002.png, ... " +
  "Use at least 6 frames and at most 12 per clip, spread across the whole clip (e.g. " +
  "`ffmpeg -i input/NN.mp4 -vf \"select='not(mod(n,ROUND))'\" -vsync 0 work/sheets/NN/frame_%03d.png` with ROUND chosen to " +
  "yield 6-12 frames, or extract at a low fps). Keep full resolution. Never modify files in input/.\n" +
  "3. All scratch work stays under work/. Do not create anything in output/.\n\n" +
  "Expected baseline: 1280x720, SAR 1:1, 24 fps, 6-12 s. Report any deviation in notes.\n" +
  "Return the structured metadata for every clip; ok=false if probing or extraction failed for that clip.",
  {label: "probe-batch-" + (bi + 1), phase: "Inventory and frame sheets", schema: inventorySchema}
)));

// Flatten, retry any failed clip once
let inventory = [];
const missingAfterFirst = [];
for (const r of inventoryResults) {
  if (r && Array.isArray(r.clips)) inventory = inventory.concat(r.clips);
}
const covered = new Set(inventory.map(c => c.clip).filter(Boolean));
for (const id of clipIds) if (!covered.has(id)) missingAfterFirst.push(id);

if (missingAfterFirst.length) {
  log("Retrying inventory for clips: " + missingAfterFirst.join(", "));
  const retry = await agent(
    "You are a worker on task CDC-A-X03. These clips failed an earlier inventory pass: " + missingAfterFirst.join(", ") + "\n" +
    "For each: ffprobe input/NN.mp4 for width/height/fps/duration/decoded frame count (use -count_frames if needed), and extract " +
    "6-12 evenly spaced full-resolution PNG preview frames into work/sheets/NN/frame_%03d.png. Do not modify input/. Nothing in output/.\n" +
    "Return structured metadata; ok=false on failure.",
    {label: "probe-retry", phase: "Inventory and frame sheets", schema: inventorySchema}
  );
  if (retry && Array.isArray(retry.clips)) inventory = inventory.concat(retry.clips);
}

const clipInfo = {};
for (const c of inventory) if (c && c.clip) clipInfo[c.clip] = c;
const unresolvedClips = clipIds.filter(id => !clipInfo[id] || !clipInfo[id].ok);
if (unresolvedClips.length === clipIds.length) {
  return {status: "unresolved", reason: "Inventory failed for all clips", unresolvedClips};
}
if (unresolvedClips.length) {
  log("WARNING: clips without usable inventory/sheets: " + unresolvedClips.join(", "));
}

// ---------------------------------------------------------------------------
// Phase 2 — visual triage (5 parallel batches, 9 clips each)
// ---------------------------------------------------------------------------

phase("Visual triage");

function triagePrompt(ids, attemptNote) {
  return "You are a worker on task CDC-A-X03 (full task in instruction.md). Do NOT pick clips for slots yet. " +
    "Your job: describe candidate clips so a later stage can match them against a shot list.\n\n" +
    CHARACTERS + "\n\n" +
    "Clips to describe: " + ids.join(", ") + "\n\n" +
    "For each clip NN, READ the preview frame images in work/sheets/NN/ (frame_001.png, ...). Compare early vs late frames to " +
    "detect camera movement and internal cuts. If the sheets are missing or too sparse for a judgement, extract more frames with " +
    "ffmpeg into work/sheets/NN/ and read them (never modify input/, nothing in output/).\n\n" +
    "For each clip report:\n" +
    "- setting: what the space looks like (color, machinery, walls, doors, curtains, platform, posts, light shafts, props such as telephones)\n" +
    "- characters: boy_only / old_man_only / both / neither / unclear\n" +
    "- boy_position / old_man_position: screen position when visible (frame_left / frame_right / center / foreground / background / not_visible / unknown)\n" +
    "- shot_size: extreme wide / wide / full / medium-full / medium / medium close / close-up / mixed (describe per internal shot if mixed)\n" +
    "- camera_movement: locked_off / pan / tilt / truck / dolly / zoom / mixed / unknown, with evidence from frame comparison\n" +
    "- cut_structure: how many internal cuts, and a short description of each internal shot in order\n" +
    "- color_palette: dominant colors (e.g. cold cyan, dark red, warm brown, green shafts)\n" +
    "- distinctive_features: fine details that distinguish this clip from other clips of the same scene (props, character pose, " +
    "background elements, framing differences) — be concrete\n" +
    "- eyeline_or_movement: which way characters look or move on screen (screen_left / screen_right / toward lens / away / unknown)\n" +
    (attemptNote || "") + "\n" +
    "Be factual and concrete; distinguish near-duplicate scenes by real visible differences.";
}

async function runTriageBatch(ids, bi) {
  const first = await agent(triagePrompt(ids), {label: "triage-batch-" + (bi + 1), phase: "Visual triage", schema: triageSchema});
  if (first && Array.isArray(first.clips) && first.clips.length === ids.length) return first;
  log("Triage batch " + (bi + 1) + " incomplete; retrying once");
  const second = await agent(
    triagePrompt(ids, "This is a RETRY: a previous attempt returned incomplete results. Be thorough and return exactly one entry per clip."),
    {label: "triage-retry-" + (bi + 1), phase: "Visual triage", schema: triageSchema}
  );
  return (second && Array.isArray(second.clips)) ? second : first;
}

const triageResults = await parallel(probeBatches.map((ids, bi) => () => runTriageBatch(ids, bi)));

let triageEntries = [];
for (const r of triageResults) {
  if (r && Array.isArray(r.clips)) triageEntries = triageEntries.concat(r.clips);
}
const triageByClip = {};
for (const t of triageEntries) if (t && t.clip) triageByClip[t.clip] = t;
const undescribed = clipIds.filter(id => !triageByClip[id]);
if (undescribed.length) {
  log("Clips without triage descriptions: " + undescribed.join(", "));
  if (undescribed.length === clipIds.length) {
    return {status: "unresolved", reason: "Visual triage failed for all clips"};
  }
}

const triageTable = clipIds.filter(id => triageByClip[id]).map(id => Object.assign({clip: id, frames: clipInfo[id] ? clipInfo[id].frames : null}, triageByClip[id]));
log("Triage complete: " + triageTable.length + "/45 clips described");

// ---------------------------------------------------------------------------
// Phase 3 — per-slot selection (7 parallel deep-inspection workers)
// ---------------------------------------------------------------------------

phase("Slot selection");

function slotPickPrompt(slotSpec, attemptNote) {
  return "You are a worker on task CDC-A-X03 (full task in instruction.md). Your job: choose the single best candidate clip " +
    "for ONE slot of a 7-slot sequence, and produce selection evidence.\n\n" +
    "SLOT TO FILL:\n" + slotSpec.spec + "\n\n" +
    "The clip must match EVERY field of the slot: content (setting, props, character actions and screen positions), narrative " +
    "function, shot size, angle/lens language, and camera movement. Cuts already inside a candidate clip stay as they are, so a " +
    "clip with the described internal cut structure is fine.\n\n" +
    "Triage descriptions of all candidates (clip numbers are random, they carry no order information):\n" +
    j(triageTable) + "\n\n" +
    "Procedure:\n" +
    "1. From the triage table, shortlist the 2-5 most plausible candidates.\n" +
    "2. For each shortlisted clip, deep-inspect it: extract a denser frame sequence into work/inspect/slot" + slotSpec.slot + "/NN/ " +
    "(e.g. `ffmpeg -i input/NN.mp4 -vf \"select='not(mod(n,8))'\" -vsync 0 work/inspect/slot" + slotSpec.slot + "/NN/f_%04d.png`) " +
    "and READ enough frames to verify every slot field, including internal cut order, character screen sides, eyelines, shot sizes " +
    "and camera movement. You may also re-read work/sheets/NN/. Never modify input/. Do not write to output/.\n" +
    "3. Choose exactly one winner. Other slots are being filled in parallel by other workers, so do not worry about clashes; " +
    "pick the clip that best matches THIS slot.\n" +
    "4. Identify the most similar OTHER candidate (a different clip number, e.g. a near-duplicate of the same scene) and state one " +
    "CONCRETE visible difference between the chosen clip and that other candidate (a specific object, pose, background element, " +
    "framing or timing difference you actually saw in the frames — not a generic statement).\n" +
    "5. Give evidence_frames: two integer frame numbers inside the chosen clip (0-based or 1-based, just be within the clip) where " +
    "the slot-defining content and the distinguishing difference are visible.\n" +
    "6. Set matched_all_fields honestly; if no candidate matches every field, pick the closest and explain the mismatch in field_notes.\n" +
    (attemptNote || "") + "\n" +
    "Return the structured result.";
}

async function pickSlot(slotSpec) {
  const first = await agent(slotPickPrompt(slotSpec), {label: "select-slot-" + slotSpec.slot, phase: "Slot selection", schema: slotPickSchema});
  const valid = (r) => r && typeof r.source === "string" && /^\d{2}$/.test(r.source) && r.source !== "00" && clipInfo[r.source] !== undefined || (r && r.source && Number(r.source) >= 1 && Number(r.source) <= 45);
  if (valid(first)) return first;
  log("Slot " + slotSpec.slot + " pick invalid or missing; retrying once");
  const second = await agent(
    slotPickPrompt(slotSpec, "This is a RETRY: a previous attempt failed or returned an invalid clip number. Re-examine the frames and return a valid result."),
    {label: "select-slot-" + slotSpec.slot + "-retry", phase: "Slot selection", schema: slotPickSchema}
  );
  return valid(second) ? second : first;
}

const slotPicksRaw = await parallel(SLOT_SPECS.map(s => () => pickSlot(s)));

let picks = [];
for (let i = 0; i < SLOT_SPECS.length; i++) {
  const r = slotPicksRaw[i];
  picks.push({
    slot: SLOT_SPECS[i].slot,
    spec: SLOT_SPECS[i].spec,
    source: r && r.source ? r.source : null,
    matched_all_fields: r ? !!r.matched_all_fields : null,
    field_notes: r ? r.field_notes : null,
    most_similar_other: r ? r.most_similar_other : null,
    visible_difference: r ? r.visible_difference : null,
    evidence_frames: r && Array.isArray(r.evidence_frames) ? r.evidence_frames : null,
    confidence: r ? r.confidence : null,
    raw: r || null
  });
}

const missingPicks = picks.filter(p => !p.source);
if (missingPicks.length) {
  return {
    status: "unresolved",
    reason: "No valid clip could be selected for slots: " + missingPicks.map(p => p.slot).join(", "),
    triageTable,
    picks
  };
}

// ---------------------------------------------------------------------------
// Phase 4a — enforce 7 distinct sources
// ---------------------------------------------------------------------------

phase("Assignment resolution and axis continuity");

function duplicatesOf(currentPicks) {
  return findDuplicates(currentPicks);
}

let dupSources = duplicatesOf(picks);
for (let round = 0; dupSources.length > 0 && round < maxRepairs; round++) {
  const conflictedSlots = picks.filter(p => dupSources.includes(p.source)).map(p => p.slot);
  log("Duplicate sources " + dupSources.join(", ") + " in slots " + conflictedSlots.join(", ") + " — resolving (round " + (round + 1) + ")");
  const res = await agent(
    "You are a worker on task CDC-A-X03 (full task in instruction.md). Two or more slots were assigned the SAME clip, which is " +
    "forbidden (7 distinct clips required). Reassign ONLY the conflicted slots to other candidates so that every slot still matches " +
    "its spec and all 7 sources become distinct.\n\n" +
    "Conflicted slots: " + j(conflictedSlots) + "\n\n" +
    "Current assignment (slot, source, field notes):\n" +
    j(picks.map(p => ({slot: p.slot, source: p.source, field_notes: p.field_notes}))) + "\n\n" +
    "Slot specs:\n" + j(SLOT_SPECS) + "\n\n" +
    "Triage table:\n" + j(triageTable) + "\n\n" +
    "You may deep-inspect any candidate by extracting frames into work/inspect/resolve/ (never modify input/, nothing in output/) " +
    "and reading them, and you may reuse frames already in work/inspect/slot*/ and work/sheets/. For each conflicted slot choose a " +
    "replacement (or keep the current clip if it is the better match and the OTHER conflicted slot should move). Return one " +
    "assignment per conflicted slot with a short justification note.",
    {label: "resolve-duplicates-" + (round + 1), phase: "Assignment resolution and axis continuity", schema: reassignSchema}
  );
  if (!res || !Array.isArray(res.assignments)) {
    return {status: "unresolved", reason: "Duplicate-resolution worker failed", dupSources, picks};
  }
  for (const a of res.assignments) {
    const p = picks.find(x => x.slot === a.slot);
    if (p && a.source && Number(a.source) >= 1 && Number(a.source) <= 45) {
      p.source = a.source;
      p.field_notes = (p.field_notes ? p.field_notes + " | " : "") + "reassigned: " + a.note;
    }
  }
  dupSources = duplicatesOf(picks);
}

if (dupSources.length > 0) {
  return {
    status: "unresolved",
    reason: "Could not make the 7 sources distinct",
    dupSources,
    triageTable,
    picks
  };
}
log("Distinct sources confirmed: " + picks.map(p => p.slot + "->" + p.source).join(", "));

// ---------------------------------------------------------------------------
// Phase 4b — axis continuity (180° rule) review + repair
// ---------------------------------------------------------------------------

function continuityPrompt() {
  return "You are a reviewer on task CDC-A-X03 (full task in instruction.md). Verify AXIS CONTINUITY (the 180° rule) for the " +
    "chosen 7-clip sequence.\n\n" +
    "Ordered picks (slot, clip, field notes):\n" +
    j(picks.map(p => ({slot: p.slot, source: p.source, field_notes: p.field_notes}))) + "\n\n" +
    "Slot specs:\n" + j(SLOT_SPECS) + "\n\n" +
    "Rules: slot 1 establishes the line of action between the thin boy and the bald old man (boy frame LEFT, old man frame RIGHT). " +
    "In every later slot the characters' left/right screen relationship, the eyeline direction of singles, and the characters' " +
    "screen direction of movement must stay consistent with that axis — no line crossing. Note that slots 5 and 6 explicitly " +
    "restage positions; check whether those restagings remain on the same side of the axis in a coherent way (e.g. a justified " +
    "cutaway/restaging is acceptable only if screen relationships stay internally coherent with the established line).\n\n" +
    "Method: read the existing frames in work/inspect/slot*/ and work/sheets/<NN>/ for the chosen clips; extract more frames into " +
    "work/inspect/continuity/ if needed (never modify input/, nothing in output/). For each slot state the boy's and the old man's " +
    "screen side, eyelines and movement direction, and judge consistency.\n\n" +
    "Return passed=true only if the whole sequence plausibly obeys the 180° rule; otherwise passed=false with concrete, per-slot " +
    "issues (say which slot crosses the line and what is seen in which frames).";
}

let continuity = await agent(continuityPrompt(), {label: "axis-continuity-review", phase: "Assignment resolution and axis continuity", schema: verdictSchema});
let continuityRounds = 0;
while (continuity && !continuity.passed && continuityRounds < maxRepairs) {
  continuityRounds++;
  log("Axis continuity issues reported; repair round " + continuityRounds);
  const repair = await agent(
    "You are a worker on task CDC-A-X03 (full task in instruction.md). An axis-continuity (180° rule) review found problems in " +
    "the 7-clip selection. Propose a revised assignment for any slots that need a different clip. All 7 sources must remain " +
    "DISTINCT, and each slot must still match its spec.\n\n" +
    "Current picks:\n" + j(picks.map(p => ({slot: p.slot, source: p.source, field_notes: p.field_notes}))) + "\n\n" +
    "Reported issues:\n" + j(continuity.issues) + "\n\n" +
    "Slot specs:\n" + j(SLOT_SPECS) + "\n\n" +
    "Triage table:\n" + j(triageTable) + "\n\n" +
    "You may extract frames into work/inspect/repair/ and read them (never modify input/, nothing in output/). If you believe the " +
    "review is wrong and the current clip is actually correct, you may return the same source for that slot with a justification " +
    "note explaining why the axis is not crossed. Return an assignment for EVERY slot you want to change (or every conflicted slot), " +
    "each with a justification.",
    {label: "axis-repair-" + continuityRounds, phase: "Assignment resolution and axis continuity", schema: reassignSchema}
  );
  if (!repair || !Array.isArray(repair.assignments)) {
    return {status: "unresolved", reason: "Axis repair worker failed", continuity, picks};
  }
  for (const a of repair.assignments) {
    const p = picks.find(x => x.slot === a.slot);
    if (p && a.source && Number(a.source) >= 1 && Number(a.source) <= 45) {
      p.source = a.source;
      p.field_notes = (p.field_notes ? p.field_notes + " | " : "") + "axis repair: " + a.note;
    }
  }
  const dups = duplicatesOf(picks);
  if (dups.length) {
    return {status: "unresolved", reason: "Axis repair introduced duplicate sources", dups, continuity, picks};
  }
  continuity = await agent(
    continuityPrompt() + "\n\nThis is a RE-CHECK after a repair. Previous issues were:\n" + j(continuity.issues),
    {label: "axis-continuity-recheck-" + continuityRounds, phase: "Assignment resolution and axis continuity", schema: verdictSchema}
  );
}

// ---------------------------------------------------------------------------
// Phase 5 — assembly
// ---------------------------------------------------------------------------

phase("Assembly");

const evidenceForAssembly = picks.map(p => ({
  slot: p.slot,
  source: p.source,
  frames: clipInfo[p.source] ? clipInfo[p.source].frames : null,
  most_similar_other: p.most_similar_other,
  visible_difference: p.visible_difference,
  evidence_frames: p.evidence_frames,
  field_notes: p.field_notes
}));

const assembly = await agent(
  "You are the assembly worker on task CDC-A-X03 (full task in instruction.md). Build the three deliverables in output/ from the " +
  "final, verified selection. output/ must contain EXACTLY three files at the end: solution.mp4, solution.json, " +
  "selection-evidence.json (delete anything else you find there).\n\n" +
  "FINAL SELECTION (slot order):\n" + j(picks.map(p => ({slot: p.slot, source: p.source}))) + "\n\n" +
  "Per-clip metadata and selection evidence:\n" + j(evidenceForAssembly) + "\n\n" +
  "Requirements:\n" +
  "1. solution.mp4: the 7 complete clips in slot order, hard cuts, each clip used once, complete, 1x speed, original orientation, " +
  "no cropping/mirroring/filters/text/transitions/generated content, no audio. Output H.264/yuv420p, 1280x720, SAR 1:1, 24/1 fps.\n" +
  "   Preferred: lossless concat if all inputs share codec parameters (e.g. re-encode nothing and use the concat demuxer with " +
  "-c copy, after confirming with ffprobe that all 7 inputs have identical codec, resolution, pixel format, SAR and timebase). " +
  "   Otherwise re-encode uniformly at CRF <= 18 (e.g. one ffmpeg pass with filter_complex concat=n=7:v=1:a=0, libx264, crf 18, " +
  "   pix_fmt yuv420p, -r 24, -an). Never change frame content: no scaling, no fps conversion if the input is already 24 fps.\n" +
  "2. solution.json: {\"segments\":[...]} with exactly 7 objects in slot order, each: slot (1-7), source \"NN\", " +
  "   output_frames [start, end) cumulative and contiguous from 0 with no gaps or overlaps, source_frames [0, decodedFrameCount] " +
  "   of that input clip, output [startSeconds, endSeconds] where seconds differ from frames/24 by at most 0.001 s. The final end " +
  "   frame MUST equal the actual decoded frame count of solution.mp4 — verify with ffprobe -count_frames on your output.\n" +
  "   Get per-clip decoded frame counts with ffprobe -count_frames on each input; double-check that the sum equals the decoded " +
  "   frame count of solution.mp4.\n" +
  "3. selection-evidence.json: an array of exactly 7 objects {slot, source, frames:[a,b], reason} in slot order. frames are two " +
  "   frame numbers inside the chosen clip (use the evidence_frames provided, clipped into the valid range 0..decodedFrameCount-1). " +
  "   reason must name one CONCRETE visible difference between the chosen clip and the most similar other candidate — use the " +
  "   provided visible_difference text, and verify it is concrete (mentions a specific visible object/pose/background/framing " +
  "   difference); if it is too generic, extract the relevant frames from the chosen clip and the other candidate " +
  "   (work/inspect/verify_evidence/) and write a concrete difference you actually see.\n" +
  "Validate both JSON files parse (python3 -m json.tool or jq) before finishing. Return the structured summary with per-segment " +
  "frame counts and the total decoded frame count of solution.mp4.",
  {label: "assembly", phase: "Assembly", schema: assemblySchema}
);

if (!assembly || !assembly.ok) {
  return {
    status: "unresolved",
    reason: "Assembly failed",
    assembly: assembly || null,
    picks
  };
}
log("Assembly done: method=" + assembly.method + ", total_frames=" + assembly.total_frames);

// ---------------------------------------------------------------------------
// Phase 6 — verification (format/JSON + frame-level content) and repair loop
// ---------------------------------------------------------------------------

phase("Verification and repair");

function formatVerifyPrompt(extra) {
  return "You are a verifier on task CDC-A-X03 (full task in instruction.md). Check the DELIVERABLE FORMATS only (not the " +
    "storyline choices). output/ must contain exactly solution.mp4, solution.json, selection-evidence.json.\n\n" +
    "Declared selection:\n" + j(assembly) + "\n\n" +
    "Checks:\n" +
    "1. output/ contains exactly the three required files.\n" +
    "2. ffprobe solution.mp4: codec h264, pix_fmt yuv420p, 1280x720, SAR 1:1, fps exactly 24/1, no audio stream; decoded frame " +
    "   count (ffprobe -count_frames) equals the declared total_frames and equals the sum of per-clip decoded frame counts.\n" +
    "3. solution.json parses; has segments: exactly 7 objects in slot order 1..7; sources are 7 DISTINCT valid clip ids " +
    "(\"01\"..\"45\"); output_frames are integer half-open intervals, contiguous from 0, no gaps/overlaps, last end == decoded " +
    "frame count of solution.mp4; each source_frames == [0, decoded frame count of that input clip]; each output seconds pair " +
    "matches its frame interval / 24 within 0.001 s.\n" +
    "4. selection-evidence.json parses; array of exactly 7 objects in slot order; each has slot, source matching solution.json, " +
    "frames: two integers inside the chosen clip's frame range; reason is non-empty and names a concrete visible difference " +
    "against another candidate (flag vague reasons like 'different framing' with no specific object/pose/background detail).\n" +
    "Use ffprobe, ffmpeg and python3/jq freely. Do NOT edit any files — report only.\n" +
    "Return passed=false with specific, actionable issues otherwise." + (extra || "");
}

function contentVerifyPrompt(extra) {
  return "You are a verifier on task CDC-A-X03 (full task in instruction.md). Check the FRAME CONTENT of output/solution.mp4 " +
    "against the declared sources (not the storyline choices).\n\n" +
    "Declared segments:\n" + j(assembly) + "\n\n" +
    "Checks:\n" +
    "1. Read output/solution.json and, for each of the 7 segments, compare the corresponding frame range of solution.mp4 with " +
    "input/<source>.mp4 frame by frame. Method: if the video was assembled losslessly, compare raw frame hashes (e.g. extract " +
    "raw frames from both with ffmpeg -f rawvideo or as PNGs and md5sum them in order, at least every frame if feasible, else a " +
    "dense sample plus the first/last frames of each segment). If it was re-encoded, use ffmpeg PSNR/SSIM per segment " +
    "(e.g. trim both to the segment and run ffmpeg -i a -i b -lavfi psnr/ssim) and require very high similarity (no dropped, " +
    "added, duplicated, reordered or mirrored frames; no crops: verify the frame dimensions match and border content aligns).\n" +
    "2. Verify segment ORDER: segment k of solution.mp4 corresponds to the k-th declared source, in slot order 1..7.\n" +
    "3. Verify each source clip is used COMPLETE: the segment length equals the source's decoded frame count, i.e. source_frames " +
    "is [0, N] and the segment covers all N frames at 1x speed.\n" +
    "4. Verify no audio track in solution.mp4 and that the visual content shows no added text, transitions or generated frames " +
    "(spot-check frames around each cut boundary).\n" +
    "Scratch comparisons go in work/verify/. Do NOT edit deliverables — report only.\n" +
    "Return passed=false with specific, actionable issues otherwise." + (extra || "");
}

async function runVerification(round) {
  const suffix = round === 0 ? "" : "-" + round;
  return parallel([
    () => agent(formatVerifyPrompt(), {label: "verify-format" + suffix, phase: "Verification and repair", schema: verdictSchema}),
    () => agent(contentVerifyPrompt(), {label: "verify-content" + suffix, phase: "Verification and repair", schema: verdictSchema})
  ]);
}

let [fmtVerdict, cntVerdict] = await runVerification(0);

let repairRound = 0;
while (
  ((fmtVerdict && !fmtVerdict.passed) || (cntVerdict && !cntVerdict.passed)) &&
  repairRound < maxRepairs
) {
  repairRound++;
  const issues = []
    .concat(fmtVerdict && !fmtVerdict.passed ? fmtVerdict.issues : [])
    .concat(cntVerdict && !cntVerdict.passed ? cntVerdict.issues : []);
  log("Verification issues: " + j(issues) + " — repair round " + repairRound);
  const repair = await agent(
    "You are a repair worker on task CDC-A-X03 (full task in instruction.md). The deliverables in output/ have verification " +
    "failures. Fix them so all checks pass, keeping the declared selection (slot -> source) unchanged UNLESS an issue proves a " +
    "clip is wrong for its slot; in that case you may change that slot's clip, but then you must keep all 7 sources distinct, " +
    "still match the slot spec, re-extract evidence for it, and rebuild everything. Do not change assembly requirements: " +
    "H.264/yuv420p, 1280x720, SAR 1:1, 24/1 fps, no audio, hard cuts, complete clips at 1x speed, output/ containing exactly " +
    "solution.mp4, solution.json, selection-evidence.json.\n\n" +
    "Current assembly summary:\n" + j(assembly) + "\n\n" +
    "Issues reported by verifiers:\n" + j(issues) + "\n\n" +
    "Rebuild or patch the deliverables as needed, re-run the relevant ffprobe/JSON checks yourself, and report what you changed. " +
    "If you changed any slot's source, say so explicitly in notes.",
    {label: "repair-" + repairRound, phase: "Verification and repair", schema: assemblySchema}
  );
  if (repair && repair.ok) {
    if (repair.segments && repair.segments.length === 7) {
      for (const seg of repair.segments) {
        const p = picks.find(x => x.slot === seg.slot);
        if (p && seg.source && p.source !== seg.source) {
          log("Slot " + seg.slot + " source changed during repair: " + p.source + " -> " + seg.source);
          p.source = seg.source;
        }
      }
      const dups = duplicatesOf(picks);
      if (dups.length) {
        return {status: "unresolved", reason: "Repair introduced duplicate sources", dups, picks, repair};
      }
      assembly.method = repair.method;
      assembly.total_frames = repair.total_frames;
      assembly.segments = repair.segments;
      assembly.notes = repair.notes;
    }
  } else {
    log("Repair round " + repairRound + " reported failure; continuing to verification anyway");
  }
  const [f2, c2] = await runVerification(repairRound);
  fmtVerdict = f2 !== undefined ? f2 : fmtVerdict;
  cntVerdict = c2 !== undefined ? c2 : cntVerdict;
}

const verified = (fmtVerdict && fmtVerdict.passed && cntVerdict && cntVerdict.passed);
const openIssues = []
  .concat(fmtVerdict && !fmtVerdict.passed ? fmtVerdict.issues : [])
  .concat(cntVerdict && !cntVerdict.passed ? cntVerdict.issues : [])
  .concat(continuity && !continuity.passed ? continuity.issues : []);

return {
  status: verified && (!continuity || continuity.passed) ? "verified" : (openIssues.length ? "unresolved" : "verified-with-caveats"),
  selection: picks.map(p => ({slot: p.slot, source: p.source, confidence: p.confidence, most_similar_other: p.most_similar_other, visible_difference: p.visible_difference, evidence_frames: p.evidence_frames})),
  assembly: {method: assembly.method, total_frames: assembly.total_frames, segments: assembly.segments, notes: assembly.notes},
  axisContinuity: continuity,
  formatVerification: fmtVerdict,
  contentVerification: cntVerdict,
  openIssues: openIssues,
  notes: "7 distinct clips required; distinctness enforced: " + (duplicatesOf(picks).length === 0) +
    ". Clips without usable inventory/triage (excluded from consideration): " + (unresolvedClips.concat(undescribed.filter(id => !unresolvedClips.includes(id))).join(", ") || "none")
};
