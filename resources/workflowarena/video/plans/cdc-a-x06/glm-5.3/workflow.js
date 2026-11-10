export const meta = {
  name: "cdc-a-x06-dual-trailers",
  description: "Catalog 39 anonymous candidate clips, match and verify the 10 trailer slots, assemble comedy and suspense trailers, and validate all four deliverables",
  phases: [
    {title: "Ingest", detail: "ffprobe exact decoded frame counts and stream parameters for all 39 clips"},
    {title: "Catalog", detail: "Dense frame-by-frame inspection and structured description of every clip"},
    {title: "Shortlist", detail: "Rank candidate clips for each of the 10 slots from the catalog"},
    {title: "Verify", detail: "Close inspection of chosen clips against full slot specs, dedup within versions, fallbacks"},
    {title: "Assemble", detail: "Encode comedy.mp4 and suspense.mp4; write edl.json and selection-evidence.json from script-computed content"},
    {title: "Check", detail: "Validate every deliverable against the public spec; repair loop"}
  ]
};

const CLIPS = Array.from({length: 39}, (_, i) => String(i + 1).padStart(2, "0"));
const VERSIONS = ["comedy", "suspense"];

const SLOTS = {
  A1: {version: "comedy", title: "Entrance with irony", text:
    "Function: a smug little gang makes its entrance. The audience sees a hazard hanging over their heads; they do not.\n" +
    "Film language: the clip opens on a tight close group shot of three small characters, from an eye-level to slightly low camera, as they press toward the lens. It then cuts to a low angle with a heavy object suspended at the top of frame, and a huge arm sweeps past the frame edge. It ends on a medium close shot of the leader holding a small object. The whole clip stays on the gang."},
  A2: {version: "comedy", title: "Peek gag", text:
    "Function: a single-take gag built on timing: a peek, a retreat, and then the bystander pays for it.\n" +
    "Film language: one locked-off camera for the whole clip. A near tree trunk at frame left acts as a foreground screen, and a bird stands on a branch a little further away at frame right. A character peeks out from behind the trunk and ducks back. The bystander is then hit by a small object flying in from off-screen and leaves the frame. The clip ends on the empty branch."},
  A3: {version: "comedy", title: "Chain of close calls", text:
    "Function: an oblivious small character dodges several 'disasters from nowhere' one after another and carries on as if nothing happened. The gag escalates and pays off.\n" +
    "Film language: a wide shot that stays on this small character throughout. The clip opens with a calm hold. Then a first large object rolls in from one side and grazes past, followed by other large objects toppling or dropping. The clip ends with the character alone in frame, unharmed and still absorbed in its own business."},
  A4: {version: "comedy", title: "Deadpan scale contrast", text:
    "Function: a huge figure silently appears behind the small character, who notices nothing. The laugh comes from the difference in size and a long pause.\n" +
    "Film language: one essentially fixed framing. The small character is in the foreground, busy with what is in front of it. The huge character walks in from the frame edge and stops right behind it. The two then share the frame, and the pause holds until the clip ends."},
  A5: {version: "comedy", title: "Closing button", text:
    "Function: the character who thinks it is winning walks straight into the opponent's grip. The captor's sly grin is the button, then the picture starts to fade out.\n" +
    "Film language: a medium shot opens on a small character edging along a branch toward a huge figure at frame right whose back is to camera. A big hand grabs it. The clip cuts to a close two-shot of the two, with the captor grinning. It ends while the picture is fading down toward black."},
  B1: {version: "suspense", title: "Being watched", text:
    "Function: establish the unease that someone in the dark is watching.\n" +
    "Film language: the clip opens on a low-angle wide shot of several small characters walking along a path toward camera. One of them walks right up to the lens and fills the frame, giving a wipe-like transition. The clip cuts to a high-angle subjective view looking down on them through foreground leaves, and a huge dark shape intrudes from the right foreground. It ends back on an eye-level medium shot of them, unaware."},
  B2: {version: "suspense", title: "The threat behind", text:
    "Function: the audience sees the danger; the character does not.\n" +
    "Film language: deep staging in one essentially fixed framing. An unsuspecting small character is in the foreground, head down and busy. A huge silhouette walks in from off-screen and stops behind it, looming over it. The clip stays in this tension without release."},
  B3: {version: "suspense", title: "Watching from cover, then a strike", text:
    "Function: a hidden figure watches from cover, then a strike from off-screen makes the bystander vanish.\n" +
    "Film language: one locked-off camera for the whole clip. A near tree trunk screens the foreground, and a bystander sits on a branch further away. The hidden figure leans out and disappears again. The bystander is suddenly hit by something flying in from off-screen and vanishes from frame, leaving an empty shot."},
  B4: {version: "suspense", title: "Delay and shock", text:
    "Function: hold on an unsuspecting character long enough to make the audience wait. Danger finally breaks in, but the clip cuts away before the outcome; the suspense is left unresolved.\n" +
    "Film language: a wide shot with a static camera. The clip opens with a long, still hold. A huge object then rolls in from off-screen and closes on the character. The clip ends at the most dangerous moment, as the object bears down on the character, without showing what happens."},
  B5: {version: "suspense", title: "Stinger", text:
    "Function: a harmless small object falls and exposes a danger hidden in the ground, leaving an unresolved threat.\n" +
    "Film language: a low-angle wide shot of an empty patch of ground. A small object drops in from the top of frame and bounces. A hard cut to a close insert shows it impaled on something hidden in the ground. The clip ends on a static wide shot of a clearing covered with these hidden things, with no character in frame."}
};

const slotKeys = Object.keys(SLOTS);

const CTX =
  "Workspace: /workspace. Inputs: input/01.mp4 .. input/39.mp4 (anonymous silent candidate clips, H.264, 640x360, 24 fps, 6.7-12 s each; clip numbers carry no story order; many overlap in time or share scenes with different in/out points). " +
  "Use work/ for scratch files and output/ only for the four final deliverables. Python 3.11 and FFmpeg/ffprobe are available. No network, no GPU, no generated imagery. " +
  "The full task specification is in instruction.md — read it first. Workers before you have left shared artifacts in work/ (probe.json, cat/*.json).";

// ---------- schemas ----------

const probeSchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      id: {type: "string"},
      frames: {type: "integer"},
      duration_s: {type: "number"},
      width: {type: "integer"},
      height: {type: "integer"},
      fps: {type: "string"},
      has_audio: {type: "boolean"}
    }, required: ["id", "frames", "duration_s", "width", "height", "fps", "has_audio"], additionalProperties: false}}
  },
  required: ["clips"], additionalProperties: false
};

const catalogSchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      id: {type: "string"},
      frames: {type: "integer"},
      summary: {type: "string"},
      opening: {type: "string"},
      ending: {type: "string"},
      camera: {type: "string"},
      shot_structure: {type: "string"},
      motion_events: {type: "string"},
      slot_hints: {type: "array", items: {type: "string"}}
    }, required: ["id", "frames", "summary", "opening", "ending", "camera", "shot_structure", "motion_events", "slot_hints"], additionalProperties: false}}
  },
  required: ["clips"], additionalProperties: false
};

const shortlistSchema = {
  type: "object",
  properties: {
    candidates: {type: "array", minItems: 1, items: {type: "object", properties: {
      id: {type: "string"},
      fit_notes: {type: "string"}
    }, required: ["id", "fit_notes"], additionalProperties: false}}
  },
  required: ["candidates"], additionalProperties: false
};

const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    opening_check: {type: "string"},
    ending_check: {type: "string"},
    most_similar_other: {type: "string"},
    difference: {type: "string"}
  },
  required: ["passed", "issues", "most_similar_other", "difference"], additionalProperties: false
};

const assembleSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    comedy_frames: {type: "integer"},
    suspense_frames: {type: "integer"},
    files_in_output: {type: "array", items: {type: "string"}},
    notes: {type: "string"}
  },
  required: ["ok", "comedy_frames", "suspense_frames", "files_in_output", "notes"], additionalProperties: false
};

const verdictSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues"], additionalProperties: false
};

const diffSchema = {
  type: "object",
  properties: {
    most_similar_other: {type: "string"},
    difference: {type: "string"}
  },
  required: ["most_similar_other", "difference"], additionalProperties: false
};

// ---------- helpers ----------

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ---------- phase 1: ingest ----------

phase("Ingest");
log("Probing all 39 clips with ffprobe");

const ingestPrompt =
  CTX + "\n\nAssignment (Ingest phase): measure every candidate clip.\n" +
  "For each clip id NN in " + JSON.stringify(CLIPS) + ":\n" +
  "  ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames,avg_frame_rate,width,height,pix_fmt -show_entries format=duration -of json input/NN.mp4\n" +
  "  ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 input/NN.mp4   (to detect any audio stream)\n" +
  "frames MUST be the exact decoded frame count (nb_read_frames), not an estimate. duration_s from format. fps as a string like '24/1'.\n" +
  "Merge all records into work/probe.json and return them. If any clip fails to probe, still return the ones that succeeded.";

const ingest = await agent(ingestPrompt, {label: "probe-clips", schema: probeSchema, phase: "Ingest"});
if (ingest === null || !ingest.clips || !ingest.clips.length) {
  return {status: "unresolved", reason: "Ingest phase failed: no probe data returned"};
}

const framesById = {};
const probeById = {};
for (const c of ingest.clips) {
  if (CLIPS.includes(c.id) && Number.isInteger(c.frames) && c.frames > 0) {
    framesById[c.id] = c.frames;
    probeById[c.id] = c;
  }
}
const unprobed = CLIPS.filter(id => !(id in framesById));
if (unprobed.length) {
  return {status: "unresolved", reason: "Ingest incomplete: missing frame counts", unprobed};
}
log("Ingest complete: " + Object.keys(framesById).length + " clips probed");

// ---------- phase 2: catalog ----------

phase("Catalog");

function catalogPrompt(ids, fileTag) {
  return CTX + "\n\nAssignment (Catalog phase): analyze these clips: " + JSON.stringify(ids) + "\n" +
    "Frame counts are already in work/probe.json; read it first.\n" +
    "For each clip NN:\n" +
    "1) Extract frames densely enough to follow the action, e.g. contact sheets:\n" +
    "   ffmpeg -y -i input/NN.mp4 -vf \"fps=3,scale=320:-1,tile=6x5\" work/cat/NN_sheet_%02d.png\n" +
    "   plus a few full-resolution frames (first frame, last frame, and frames around any internal cut).\n" +
    "2) VIEW the extracted images with your file-reading tool. Never describe a clip from metadata alone.\n" +
    "3) Write one structured record per clip:\n" +
    "   - summary: what is visible (characters, their relative sizes, setting, foreground/background layers);\n" +
    "   - opening: exactly how the clip opens (first shot, framing, camera height/angle, who/what is in frame);\n" +
    "   - ending: exactly how the clip ends (what the final frames show, any fade or hold);\n" +
    "   - camera: locked-off vs moving, any reframing, angle (low/eye-level/high);\n" +
    "   - shot_structure: internal cuts with approximate times, shot sizes;\n" +
    "   - motion_events: notable events (objects/characters entering or leaving frame, things rolling, toppling, dropping, flying in from off-screen, grabbing, peeks, vanishing);\n" +
    "   - slot_hints: which slot keys (A1..A5, B1..B5 from instruction.md) this clip could plausibly serve, with a few words why (possibly several or none).\n" +
    "Clips overlap in time or cover the same scene with different in/out points; describe each clip independently and precisely, including its exact in and out points.\n" +
    "4) Write your records as JSON (same shape as your return schema) to work/cat/" + fileTag + ".json, and return them.";
}

async function catalogBatch(ids, fileTag, label) {
  return agent(catalogPrompt(ids, fileTag), {label, schema: catalogSchema, phase: "Catalog"});
}

const catalogById = {};
async function runCatalogBatches(ids, tagPrefix, labelPrefix) {
  const results = await parallel(chunks(ids, 7).map((batch, i) => async () => {
    let r = await catalogBatch(batch, tagPrefix + "_" + i, labelPrefix + "-" + (i + 1));
    if (r === null) r = await catalogBatch(batch, tagPrefix + "_" + i + "_retry", labelPrefix + "-" + (i + 1) + "-retry");
    return r;
  }));
  for (const r of results) {
    for (const c of ((r && r.clips) || [])) {
      if (CLIPS.includes(c.id) && c.summary && c.summary.length > 20) catalogById[c.id] = c;
    }
  }
}

await runCatalogBatches(CLIPS, "batch", "catalog");

let missing = CLIPS.filter(id => !(id in catalogById));
if (missing.length) {
  log("Catalog missing " + missing.length + " clips; running retry batch(es)");
  await runCatalogBatches(missing, "retry", "catalog-retry");
  missing = CLIPS.filter(id => !(id in catalogById));
}
if (missing.length) {
  return {status: "unresolved", reason: "Catalog incomplete after retries", missing};
}
log("Catalog complete for all 39 clips");

// ---------- phase 3: shortlist ----------

phase("Shortlist");

function shortlistPrompt(slotKey) {
  const def = SLOTS[slotKey];
  return CTX + "\n\nAssignment (Shortlist phase) for slot " + slotKey + " (" + def.title + ") of version " + def.version + ":\n" +
    "Slot specification (the chosen clip must satisfy EVERY part, including how it opens and how it ends; cuts already inside a clip count as part of that clip):\n" +
    def.text + "\n\n" +
    "All 39 clip descriptions are in work/cat/*.json (read every file; they are compact). work/probe.json has frame counts.\n" +
    "Rank the best 3 to 6 candidate clips for this slot, best first. The clip is used IN FULL, at 1x speed, original direction, hard cuts only — so only clips that already contain the described events, opening and ending qualify. " +
    "In fit_notes, name the matching elements AND any mismatches honestly. Candidates must be clip ids like '07'.";
}

const shortlists = await parallel(slotKeys.map(k => () =>
  agent(shortlistPrompt(k), {label: "shortlist-" + k, schema: shortlistSchema, phase: "Shortlist"})
));

function shortlistIds(slotKey) {
  const i = slotKeys.indexOf(slotKey);
  const r = shortlists[i];
  return ((r && r.candidates) || []).map(c => c.id).filter(id => CLIPS.includes(id));
}

// ---------- phase 4: verify ----------

phase("Verify");

function verifyPrompt(slotKey, id) {
  const def = SLOTS[slotKey];
  return CTX + "\n\nAssignment (Verify phase) for slot " + slotKey + " (" + def.title + ", version " + def.version + "):\n" +
    "Slot specification:\n" + def.text + "\n\n" +
    "Candidate clip: input/" + id + ".mp4 (" + framesById[id] + " frames).\n" +
    "1) Inspect this clip closely. Extract frames at fine granularity, e.g.\n" +
    "   ffmpeg -y -i input/" + id + ".mp4 -vf \"fps=6,scale=480:-1\" work/ver/" + slotKey + "_" + id + "/f_%03d.png\n" +
    "   plus full-resolution first and last frames, and VIEW them all.\n" +
    "2) Decide whether this clip, used in full at 1x speed in original direction, satisfies EVERY element of the specification: the opening framing and camera height, the camera behavior (locked-off vs moving), the internal events in the described order, and the exact ending. Internal cuts count, but only if the described cut structure matches what the clip actually shows. Report a concrete issue string for every mismatch.\n" +
    "3) Then read work/cat/*.json and identify the single MOST SIMILAR OTHER candidate clip (one covering the same scene or overlapping material, e.g. a different in/out point of the same moment). Confirm by extracting a comparable frame from that other clip and viewing it. State ONE specific visible difference between this clip and that other clip (something you can actually see in the frames, e.g. different in point, an extra event, a different ending).\n" +
    "Be strict: passed=true only if the whole specification is satisfied. most_similar_other must be a clip id different from " + id + ".";
}

async function verifyAgent(slotKey, id) {
  return agent(verifyPrompt(slotKey, id), {label: "verify-" + slotKey + "-" + id, schema: verifySchema, phase: "Verify"});
}

function escalationPrompt(slotKey, excluded) {
  const def = SLOTS[slotKey];
  return CTX + "\n\nAssignment (widen search) for slot " + slotKey + " (" + def.title + ", version " + def.version + "):\n" +
    "Slot specification:\n" + def.text + "\n\n" +
    "The following clips are excluded (already used elsewhere or already tried and failed): " + JSON.stringify(excluded) + "\n" +
    "Read ALL clip descriptions in work/cat/*.json and rank up to 5 OTHER candidates that could satisfy this slot when used in full at 1x speed in original direction. Partial matches are acceptable as last resort; note the gaps honestly in fit_notes.";
}

async function attemptCandidates(slotKey, initialIds, blockedSet, labelBase) {
  const tried = [];
  const tryIds = async (ids) => {
    for (const id of ids.slice(0, 3)) {
      if (!CLIPS.includes(id) || blockedSet.has(id)) continue;
      const v = await verifyAgent(slotKey, id);
      if (v === null) {
        tried.push({id, passed: false, issues: ["verification call failed"]});
        continue;
      }
      tried.push({id, passed: !!v.passed, issues: v.issues || []});
      if (v.passed) {
        return {slot: slotKey, id, most_similar_other: v.most_similar_other, difference: v.difference, tried};
      }
    }
    return null;
  };
  let hit = await tryIds(initialIds);
  if (hit) return hit;
  const excluded = [...blockedSet, ...tried.map(t => t.id)];
  const esc = await agent(escalationPrompt(slotKey, excluded), {label: labelBase + "-widen", schema: shortlistSchema, phase: "Verify"});
  hit = await tryIds(((esc && esc.candidates) || []).map(c => c.id));
  if (hit) return hit;
  return {slot: slotKey, id: null, tried};
}

const selBySlot = {};
const verifyResults = await parallel(slotKeys.map(k => () =>
  attemptCandidates(k, shortlistIds(k), new Set(), "verify-" + k)
));
slotKeys.forEach((k, i) => { selBySlot[k] = verifyResults[i] || {slot: k, id: null, tried: []}; });

// Dedup within each version: the 5 clips of one version must all differ.
for (const version of VERSIONS) {
  const used = new Set();
  for (const k of slotKeys.filter(k => SLOTS[k].version === version)) {
    const sel = selBySlot[k];
    if (!sel.id) continue;
    if (!used.has(sel.id)) { used.add(sel.id); continue; }
    log("Version " + version + " slot " + k + ": duplicate clip " + sel.id + ", finding replacement");
    const failed = new Set((sel.tried || []).map(t => t.id));
    const blocked = new Set([...used, ...failed]);
    const repl = await attemptCandidates(k, shortlistIds(k), blocked, "dedup-" + k);
    if (repl && repl.id) {
      selBySlot[k] = repl;
      used.add(repl.id);
    } else {
      selBySlot[k] = {slot: k, id: null, tried: (repl && repl.tried) || sel.tried, conflict: true};
    }
  }
}

const unresolvedSlots = slotKeys.filter(k => !selBySlot[k] || !selBySlot[k].id);
if (unresolvedSlots.length) {
  return {
    status: "unresolved",
    reason: "No verified clip found for some slots; not assembling invalid trailers",
    unresolved_slots: unresolvedSlots.map(k => ({slot: k, tried: selBySlot[k].tried})),
    selections: slotKeys.map(k => ({slot: k, id: selBySlot[k] ? selBySlot[k].id : null}))
  };
}

// Evidence fallback: every selection needs a valid most-similar-other id and a difference.
const evidenceIssues = [];
await parallel(slotKeys.map(k => () => (async () => {
  const s = selBySlot[k];
  const otherOk = CLIPS.includes(s.most_similar_other) && s.most_similar_other !== s.id;
  if (otherOk && typeof s.difference === "string" && s.difference.trim().length > 10) return;
  const d = await agent(
    CTX + "\n\nAssignment (evidence diff) for slot " + k + ": chosen clip is input/" + s.id + ".mp4.\n" +
    "Read the clip descriptions in work/cat/*.json, identify the single most similar OTHER candidate clip (same scene or overlapping material), then extract and VIEW a comparable frame from both clips to confirm. " +
    "Return that other clip's id and ONE specific visible difference between the two clips (visible in the frames, not metadata).",
    {label: "diff-" + k, schema: diffSchema, phase: "Verify"}
  );
  if (d && CLIPS.includes(d.most_similar_other) && d.most_similar_other !== s.id && d.difference && d.difference.trim()) {
    s.most_similar_other = d.most_similar_other;
    s.difference = d.difference;
  } else {
    evidenceIssues.push("slot " + k + ": could not establish a valid most-similar-other difference statement");
  }
})()));

log("Selections: " + slotKeys.map(k => k + "=" + selBySlot[k].id).join(", "));

// ---------- deterministic EDL and evidence computation ----------

function buildSegments(version) {
  let cursor = 0;
  return slotKeys.filter(k => SLOTS[k].version === version).map(k => {
    const id = selBySlot[k].id;
    const frames = framesById[id];
    const seg = {
      slot: k,
      source: id,
      output_frames: [cursor, cursor + frames],
      source_frames: [0, frames],
      output: [cursor / 24, (cursor + frames) / 24]
    };
    cursor += frames;
    return seg;
  });
}

const comedySegments = buildSegments("comedy");
const suspenseSegments = buildSegments("suspense");
const comedyTotal = comedySegments[4].output_frames[1];
const suspenseTotal = suspenseSegments[4].output_frames[1];

const edlObject = {comedy: {segments: comedySegments}, suspense: {segments: suspenseSegments}};
const edlJson = JSON.stringify(edlObject, null, 2);

const evidenceArray = slotKeys.map(k => {
  const s = selBySlot[k];
  const frames = framesById[s.id];
  return {
    version: SLOTS[k].version,
    slot: k,
    source: s.id,
    source_frames: [1, frames - 1],
    reason: "Most similar other candidate is " + s.most_similar_other + "; this clip is visibly different: " + s.difference
  };
});
const evidenceJson = JSON.stringify(evidenceArray, null, 2);

// ---------- phase 5: assemble ----------

phase("Assemble");

const assemblePrompt =
  CTX + "\n\nAssignment (Assemble phase). Final verified selections:\n" +
  "comedy (slot order A1..A5): " + comedySegments.map(s => s.slot + "=input/" + s.source + ".mp4 (" + framesById[s.source] + " frames)").join(", ") + "\n" +
  "suspense (slot order B1..B5): " + suspenseSegments.map(s => s.slot + "=input/" + s.source + ".mp4 (" + framesById[s.source] + " frames)").join(", ") + "\n\n" +
  "1) Write output/edl.json with EXACTLY this content (byte-for-byte, valid JSON):\n" + edlJson + "\n\n" +
  "2) Write output/selection-evidence.json with EXACTLY this content (byte-for-byte, valid JSON):\n" + evidenceJson + "\n\n" +
  "3) Build output/comedy.mp4: create work/concat_comedy.txt with one line per clip in slot order, each exactly: file 'input/NN.mp4'\n" +
  "   Then: ffmpeg -y -f concat -safe 0 -i work/concat_comedy.txt -an -c:v libx264 -crf 18 -pix_fmt yuv420p -vf \"scale=640:360,setsar=1\" -r 24 output/comedy.mp4\n" +
  "   (Lossless concat with -c copy is also allowed IF you verify it is frame-exact; otherwise use the CRF 18 re-encode above.)\n" +
  "4) Build output/suspense.mp4 the same way with work/concat_suspense.txt.\n" +
  "5) Do not crop, mirror, grade, speed-change, add text, transitions, audio, or generated content. Use each clip in full, in slot order, hard cuts only.\n" +
  "6) Verify with ffprobe -count_frames: decoded frame count of output/comedy.mp4 must be exactly " + comedyTotal + ", of output/suspense.mp4 exactly " + suspenseTotal + ". Also confirm each output is H.264, yuv420p, 640x360, SAR 1:1, 24/1 fps, with no audio stream. If a count is wrong, rebuild.\n" +
  "7) Ensure output/ contains EXACTLY these 4 files: comedy.mp4, suspense.mp4, edl.json, selection-evidence.json. Delete anything else inside output/.\n" +
  "Return ok, the decoded frame counts, the sorted list of files in output/, and notes.";

const assemble = await agent(assemblePrompt, {label: "assemble-deliverables", schema: assembleSchema, phase: "Assemble"});
if (assemble === null || !assemble.ok) {
  return {
    status: "unresolved",
    reason: "Assembly worker failed",
    assemble_result: assemble,
    selections: slotKeys.map(k => ({slot: k, source: selBySlot[k].id})),
    expected_totals: {comedy: comedyTotal, suspense: suspenseTotal}
  };
}

// ---------- phase 6: check and repair ----------

phase("Check");

function checkPrompt() {
  return CTX + "\n\nAssignment (Check phase): validate the deliverables in output/ against instruction.md.\n" +
    "Expected edl.json content:\n" + edlJson + "\n\n" +
    "Expected selection-evidence.json content:\n" + evidenceJson + "\n\n" +
    "Perform ALL of these checks and report concrete issue strings for every failure:\n" +
    "1) output/ contains exactly comedy.mp4, suspense.mp4, edl.json, selection-evidence.json and nothing else.\n" +
    "2) Each mp4: H.264 video, yuv420p, 640x360, SAR 1:1, 24/1 fps, exactly one video stream, no audio stream. Decoded frame count via ffprobe -count_frames equals " + comedyTotal + " (comedy) and " + suspenseTotal + " (suspense).\n" +
    "3) output/edl.json matches the expected content above: keys comedy and suspense, exactly 5 segments each in slot order; output_frames half-open and contiguous from frame 0 with no gaps or overlaps; each version's final end frame equals the mp4's decoded frame count; source_frames = [0, N] where N equals the exact decoded frame count of input/<source>.mp4; output seconds within 0.001 s of frames/24.\n" +
    "4) output/selection-evidence.json: array of exactly 10 objects with fields version ('comedy'|'suspense'), slot, source, source_frames [a,b] with b-a >= 12 and both values inside the source clip's frame range, and a reason naming one specific visible difference versus the most similar other candidate (the named other clip id must differ from source and exist).\n" +
    "5) Sync spot-check: for the FIRST and LAST segment of each version, extract one frame from the output at (segment output_frames start + 5) and the corresponding frame (5) from the declared source clip, view both, and confirm they match. Also confirm the source clip is used in full: the output segment length equals the source clip length.\n" +
    "Report passed=true only if every check passes.";
}

const maxRepairs = (typeof args === "object" && args !== null && Number.isInteger(args.maxRepairs)) ? args.maxRepairs : 2;

let verdict = await agent(checkPrompt(), {label: "check-deliverables", schema: verdictSchema, phase: "Check"});
let repairLog = [];
for (let round = 0; verdict && !verdict.passed && round < maxRepairs; round++) {
  log("Check failed (round " + (round + 1) + "); repairing: " + JSON.stringify(verdict.issues));
  const repair = await agent(
    CTX + "\n\nAssignment (Repair phase): the deliverables in output/ failed validation. Fix ONLY the technical problems listed below; the clip selections are final and must not change.\n" +
    "Issues reported:\n" + JSON.stringify(verdict.issues) + "\n\n" +
    "Expected edl.json content:\n" + edlJson + "\n\n" +
    "Expected selection-evidence.json content:\n" + evidenceJson + "\n\n" +
    "Expected decoded frame counts: comedy.mp4 = " + comedyTotal + ", suspense.mp4 = " + suspenseTotal + ".\n" +
    "If a video is wrong, rebuild it from the concat lists in work/ (or recreate them: comedy order " + JSON.stringify(comedySegments.map(s => s.source)) + ", suspense order " + JSON.stringify(suspenseSegments.map(s => s.source)) + ") with: ffmpeg -y -f concat -safe 0 -i <list> -an -c:v libx264 -crf 18 -pix_fmt yuv420p -vf \"scale=640:360,setsar=1\" -r 24 output/<name>.mp4. " +
    "If a JSON file is wrong, rewrite it byte-for-byte with the expected content above. Keep output/ to exactly the 4 deliverables. Verify your fixes with ffprobe before returning.",
    {label: "repair-" + (round + 1), phase: "Check"}
  );
  repairLog.push({round: round + 1, issues: verdict.issues, repair_result: repair === null ? "repair call failed" : "repair attempted"});
  verdict = await agent(checkPrompt(), {label: "recheck-" + (round + 1), schema: verdictSchema, phase: "Check"});
}

const selections = slotKeys.map(k => ({
  version: SLOTS[k].version,
  slot: k,
  source: selBySlot[k].id,
  frames: framesById[selBySlot[k].id],
  most_similar_other: selBySlot[k].most_similar_other
}));

const outcome = {
  status: (verdict && verdict.passed) ? "verified" : "unresolved",
  selections,
  totals: {comedy_frames: comedyTotal, suspense_frames: suspenseTotal},
  files_in_output: assemble.files_in_output,
  assemble_notes: assemble.notes,
  evidence_issues: evidenceIssues,
  verification_trail: slotKeys.reduce((acc, k) => { acc[k] = selBySlot[k].tried || []; return acc; }, {}),
  final_verdict: verdict,
  repair_log: repairLog
};
if (verdict && !verdict.passed) {
  outcome.reason = "Deliverables assembled but final validation did not pass";
}
if (!verdict) {
  outcome.status = "unresolved";
  outcome.reason = "Final check returned no result";
}
log("Workflow finished with status: " + outcome.status);
return outcome;
