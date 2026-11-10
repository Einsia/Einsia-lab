export const meta = {
  name: "cdc-a-x08-reef-intercut",
  description: "Catalog 46 anonymous underwater clips (frames + optical-flow motion metrics), describe them visually, match one distinct clip per beat (A1-A4, B1-B3), assemble the intercut A1 B1 A2 B2 A3 B3 A4 video with JSON timing and selection evidence, then validate and repair.",
  phases: [
    {title: "Prepare", detail: "ffprobe, frame extraction, contact sheets, motion metrics"},
    {title: "Describe", detail: "visual description of every candidate"},
    {title: "Match", detail: "per-beat candidate ranking"},
    {title: "Assign", detail: "distinct assignment and adjudication"},
    {title: "Assemble", detail: "render solution.mp4 and JSON deliverables"},
    {title: "Validate", detail: "format checks and repair"}
  ]
};

const ROOT = "/workspace";
const CLIPS = [];
for (let i = 1; i <= 46; i++) CLIPS.push(String(i).padStart(2, "0"));
const ORDER = ["A1", "B1", "A2", "B2", "A3", "B3", "A4"];

const BEATS = {
  A1: "THREAD A. description: A shallow reef mound with the moving, glinting water surface visible at the top of frame; a mound of yellow-brown plate coral fills most of the right side, distant sand and scattered rocks on the left. shot_size: Wide, tightening to medium-wide. camera_angle: Level from just below the mound top, tilted slightly up toward the surface. lens_size: Wide, strong near/far size difference. camera_movement: Continuous forward swim toward the mound throughout; the mound grows steadily and stays in frame.",
  A2: "THREAD A. description: Opens close along the rim of a large pinkish-brown table coral whose fine branches fill the lower frame; the camera then clears the table top, revealing pale sand ahead and another table coral in the distance. shot_size: Close, widening to wide. camera_angle: From roughly table-top height rising to a slightly high angle above the table. lens_size: Wide. camera_movement: Continuous forward travel with a rise, passing over the coral top and continuing on.",
  A3: "THREAD A. description: Open, pale, cracked limestone seabed; a dark hollow and reef lip on the left of frame; a black long-spined sea urchin mid-frame that keeps growing larger during the clip. shot_size: Wide, tightening to a close shot of the urchin. camera_angle: Oblique high angle just above the seabed. lens_size: Wide. camera_movement: Dolly-in toward the urchin, with clear parallax between the near seabed and the distant reef lip.",
  A4: "THREAD A. description: A layered table-coral reef under deep blue water with many small fish above it; near the end several white, orange-banded butterflyfish swim into the foreground. shot_size: Wide. camera_angle: Level, slightly downward. lens_size: Wide. camera_movement: Hovering locked-off frame; the framing stays essentially still, with no push, pull, pan or drift.",
  B1: "THREAD B. description: A large school of yellow-green surgeonfish with black vertical bars feeds over the reef; several fish pass extremely close to the lens as large defocused foreground masses; midway a large dark fish moves through the school. shot_size: Medium to close on fish bodies, reef as background. camera_angle: Level, close to the reef surface. lens_size: Wide; near fish heavily out of focus. camera_movement: Handheld hover inside the school with only small shake.",
  B2: "THREAD B. description: Low over a flat coral platform with a low reef overhang ahead; the shadow beneath it is at first almost unreadable, and as the camera nears, schools of small yellow fish and red fish shapes appear. shot_size: Wide, tightening to medium. camera_angle: Low, level, close to the bottom. lens_size: Medium-wide; near platform texture sharp. camera_movement: Slow low push toward the overhang, settling to a stop at the end.",
  B3: "THREAD B. description: Several whitetip reef sharks cruise low over sand and coral rubble; first distant and small, they come closer and fill a large part of the frame, ending over a patch of white coral rubble and table corals. shot_size: Wide, tightening to medium. camera_angle: Oblique high angle slightly above the sharks. lens_size: Wide. camera_movement: Lateral tracking: the camera moves toward frame-left with the sharks, so sand and reef stream continuously from the left side of frame to the right."
};
const BEAT_TEXT = ORDER.map(b => b + ": " + BEATS[b]).join("\n");

const CONTEXT =
  "You are a worker on task CDC-A-X08 (see " + ROOT + "/instruction.md; read it first). Task dir: " + ROOT + ". " +
  "Inputs: 46 anonymous silent clips input/01.mp4..input/46.mp4 (1280x720, 30 fps, 6-12 s). Scratch: work/. Deliverables only in output/. " +
  "Tools available in the environment: Python 3.11, FFmpeg/ffprobe, OpenCV, numpy; no GPU, no network. You can view JPG/PNG images with your file-reading tool. " +
  "Never guess a clip's identity from its number; decide only from what is visible in frames and measured motion. " +
  "The seven beats (each clip must match ALL five fields: description, shot_size, camera_angle, lens_size, camera_movement over the WHOLE clip):\n" + BEAT_TEXT + "\n" +
  "Final output order is A1, B1, A2, B2, A3, B3, A4. Many candidates are deliberate near-duplicates (same scene, different camera movement, mirrored, reversed, different subject, etc.), so look carefully at motion direction, motion type and specific details.";

// ---------------- Phase 1: Prepare ----------------
phase("Prepare");
const prepSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    catalog_path: {type: "string"},
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          frame_count: {type: "integer"},
          duration: {type: "number"},
          fps: {type: "string"},
          width: {type: "integer"},
          height: {type: "integer"},
          motion_summary: {type: "string"}
        },
        required: ["clip", "frame_count", "motion_summary"]
      }
    },
    notes: {type: "string"}
  },
  required: ["ok", "clips", "notes"]
};

const prep = await agent(
  CONTEXT + "\n\nYOUR ASSIGNMENT: build an analysis catalog of all 46 clips. Do not choose clips for beats.\n" +
  "1. Write a Python script work/tools/analyze.py and run it with multiprocessing (4-8 workers) over all 46 clips.\n" +
  "2. For each clip NN: ffprobe width/height/SAR/r_frame_rate/pix_fmt/codec and the exact decoded frame count (ffprobe -count_frames -select_streams v:0 -show_entries stream=nb_read_frames, cross-check with OpenCV read loop). Record duration = frame_count/30.\n" +
  "3. Extract 8 evenly spaced frames (include first and last frame) to work/frames/NN_k.jpg (k=0..7, full 1280x720 or 960x540) and build a contact sheet work/sheets/NN.jpg (4x2 grid of 480x270 thumbnails, label each tile with clip and frame index). Also save work/sheets/NN_firstlast.jpg showing first and last frame side by side at larger size.\n" +
  "4. Motion metrics: on downscaled grayscale (e.g. 320x180) compute dense optical flow (Farneback) between frames every ~3 frames over the whole clip. Per pair, fit a similarity/affine model (or use mean flow + divergence): mean dx, mean dy (pixels/frame, sign convention: positive dx = image content moving to the RIGHT), divergence/zoom factor (>0 = content expanding = forward push/dolly-in), rotation, residual magnitude (parallax), and jitter (std of dx/dy). Aggregate per clip: overall mean and per-third (start/middle/end) values of dx, dy, zoom, plus total magnitude, fraction of near-static pairs, and end-of-clip motion (does it settle to a stop?). Also compute mean brightness/hue stats per third and top-of-frame brightness flicker (water surface glints).\n" +
  "5. Write work/catalog.json: list of objects per clip with all probe data, metrics, and a short machine-derived motion_summary string such as 'content flows L->R steadily (lateral track toward frame-left); slight zoom-in' or 'near-static, small jitter' or 'strong expansion throughout (forward push)'. Interpret: content streaming left->right means camera moves toward frame-left; expanding content means camera moving forward; content moving down means camera rising/tilting up.\n" +
  "6. Sanity-check: verify a couple of sheets render and the catalog has 46 entries.\n" +
  "Return ok=true if catalog and sheets exist for all 46 clips, the per-clip summary list, and notes (including any anomalies such as non-30fps clips, odd frame counts, VFR timestamps).",
  {label: "prepare-catalog", schema: prepSchema, phase: "Prepare"}
);
if (!prep || !prep.ok) {
  return {status: "unresolved", reason: "Preparation/catalog step failed", prep};
}
const meta_by_clip = {};
for (const c of prep.clips) meta_by_clip[c.clip] = c;

// ---------------- Phase 2: Describe ----------------
phase("Describe");
const descSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          content: {type: "string", description: "What is visible: setting, coral types/colors, animals, water surface, sand, layout left/right/top"},
          start_vs_end: {type: "string", description: "How the first frame differs from the last frame"},
          camera_movement: {type: "string", description: "Visually confirmed movement over the whole clip, with direction"},
          shot_angle_lens: {type: "string"},
          plausible_beats: {type: "array", items: {type: "string"}, description: "Beat ids this clip could plausibly match (may be empty)"},
          mismatch_notes: {type: "string", description: "For plausible beats, which fields might NOT match and why"}
        },
        required: ["clip", "content", "start_vs_end", "camera_movement", "shot_angle_lens", "plausible_beats", "mismatch_notes"]
      }
    }
  },
  required: ["clips"]
};

const batches = [];
for (let i = 0; i < CLIPS.length; i += 6) batches.push(CLIPS.slice(i, i + 6));

const descResults = await parallel(batches.map((batch, bi) => () => agent(
  CONTEXT + "\n\nYOUR ASSIGNMENT: carefully describe these candidate clips: " + batch.join(", ") + ".\n" +
  "Catalog with motion metrics: work/catalog.json (from preparation). Prep notes: " + prep.notes + "\n" +
  "Machine motion summaries for your clips: " + JSON.stringify(batch.map(c => ({clip: c, frames: meta_by_clip[c] ? meta_by_clip[c].frame_count : null, motion: meta_by_clip[c] ? meta_by_clip[c].motion_summary : null}))) + "\n" +
  "For each clip view work/sheets/NN.jpg and work/sheets/NN_firstlast.jpg, and individual frames work/frames/NN_k.jpg where details matter. If the motion is ambiguous, extract extra frames yourself (ffmpeg into work/extra/NN_*.jpg) and compare. Check direction of motion against the metrics (a mirrored or time-reversed near-duplicate must be distinguished: e.g. which side the coral mound is on, whether a subject grows or shrinks, which way the scenery streams).\n" +
  "Be concrete and specific (species, colors, positions in frame, presence of water surface, what grows/shrinks). Do not select final clips; just list plausible beats with mismatch notes. Also write your result to work/descriptions/batch_" + bi + ".json.",
  {label: "describe-" + bi, schema: descSchema, phase: "Describe"}
)));

const descriptions = {};
const missingDesc = [];
descResults.forEach((r, bi) => {
  if (!r) { missingDesc.push(...batches[bi]); return; }
  for (const c of r.clips) descriptions[c.clip] = c;
});
for (const c of CLIPS) if (!descriptions[c] && !missingDesc.includes(c)) missingDesc.push(c);
if (missingDesc.length) {
  log("Retrying descriptions for: " + missingDesc.join(","));
  const retry = await agent(
    CONTEXT + "\n\nYOUR ASSIGNMENT: describe these clips (a previous worker failed): " + missingDesc.join(", ") +
    ". Use work/catalog.json, work/sheets/NN.jpg, work/sheets/NN_firstlast.jpg, work/frames/NN_k.jpg. Be concrete about content, first-vs-last difference, motion direction and plausible beats.",
    {label: "describe-retry", schema: descSchema, phase: "Describe"}
  );
  if (retry) for (const c of retry.clips) descriptions[c.clip] = c;
}

const compactCatalog = CLIPS.map(c => ({
  clip: c,
  frames: meta_by_clip[c] ? meta_by_clip[c].frame_count : null,
  motion_metrics: meta_by_clip[c] ? meta_by_clip[c].motion_summary : null,
  desc: descriptions[c] || "MISSING - inspect directly"
}));

// ---------------- Phase 3: Match per beat ----------------
phase("Match");
const matchSchema = {
  type: "object",
  properties: {
    beat: {type: "string"},
    candidates: {
      type: "array",
      description: "Ranked best first; include every clip with any real chance (up to 6)",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          score: {type: "number", description: "0-100 confidence that this clip matches ALL five fields"},
          field_check: {type: "string", description: "Per-field pass/fail notes: description, shot_size, camera_angle, lens_size, camera_movement"},
          evidence_frames: {type: "array", items: {type: "integer"}, description: "[a,b] source frame range (b-a>=12, inside clip) where the decisive feature is visible"}
        },
        required: ["clip", "score", "field_check", "evidence_frames"]
      }
    },
    most_similar_rival: {type: "string", description: "The most similar non-chosen candidate to the top pick"},
    visible_difference: {type: "string", description: "Concrete visible difference between the top pick and the rival"}
  },
  required: ["beat", "candidates", "most_similar_rival", "visible_difference"]
};

const matchBeat = (beat) => agent(
  CONTEXT + "\n\nYOUR ASSIGNMENT: find the clip that matches beat " + beat + ":\n" + BEATS[beat] + "\n\n" +
  "Preliminary descriptions and motion summaries of all 46 clips (from other workers; may contain errors):\n" + JSON.stringify(compactCatalog) + "\n\n" +
  "Steps: (1) shortlist every clip whose content could fit beat " + beat + " (be generous: near-duplicates often share scenery). (2) For each shortlisted clip, inspect frames directly (work/sheets, work/frames, and extract extra frames into work/match_" + beat + "/ as needed, e.g. every 1 s), and check work/catalog.json motion metrics per third of the clip. (3) Verify ALL five fields over the whole clip: description details (positions left/right/top, colors, species, what appears when), shot size progression, angle, lens feel, and especially camera movement type AND direction AND whether it is continuous/settles/static. Reject mirrored layouts (subject on wrong side), time-reversed motion (subject shrinking instead of growing, pulling back instead of pushing), wrong movement type (pan vs track, static vs drift), or wrong subject. (4) Rank candidates with scores, give a source frame range [a,b] (b-a>=12, within 0..frame_count) for the top pick showing the decisive feature, name the most similar rival and a concrete visible difference (e.g. 'in 17 the mound is on the left and the camera pulls back; in 05 the mound is on the right and grows').\n" +
  "Write your findings to work/match_" + beat + ".json too.",
  {label: "match-" + beat, schema: matchSchema, phase: "Match"}
);

const matchResults = await parallel(ORDER.map(b => () => matchBeat(b)));
const matches = {};
ORDER.forEach((b, i) => { matches[b] = matchResults[i]; });
for (const b of ORDER) {
  if (!matches[b] || !matches[b].candidates || matches[b].candidates.length === 0) {
    log("Retrying match for " + b);
    matches[b] = await matchBeat(b);
  }
}
const unmatched = ORDER.filter(b => !matches[b] || !matches[b].candidates || !matches[b].candidates.length);
if (unmatched.length) {
  return {status: "unresolved", reason: "No candidates for beats: " + unmatched.join(","), matches};
}

// ---------------- Phase 4: Assignment ----------------
phase("Assign");
function bestAssignment(m) {
  const lists = ORDER.map(b => m[b].candidates.slice(0, 6).map(c => ({clip: String(c.clip).padStart(2, "0"), score: Number(c.score) || 0})));
  let best = null, bestScore = -1;
  const used = new Set();
  const cur = [];
  function rec(i, total) {
    if (i === ORDER.length) {
      if (total > bestScore) { bestScore = total; best = cur.slice(); }
      return;
    }
    for (const c of lists[i]) {
      if (used.has(c.clip)) continue;
      used.add(c.clip); cur.push(c);
      rec(i + 1, total + c.score);
      cur.pop(); used.delete(c.clip);
    }
  }
  rec(0, 0);
  return best ? {assign: Object.fromEntries(ORDER.map((b, i) => [b, best[i]])), total: bestScore} : null;
}

let assignment = bestAssignment(matches);
const concerns = [];
if (!assignment) concerns.push("No conflict-free assignment among top candidates");
else {
  for (const b of ORDER) {
    const top = matches[b].candidates[0];
    const got = assignment.assign[b];
    const second = matches[b].candidates[1];
    if (String(top.clip).padStart(2, "0") !== got.clip) concerns.push(b + ": top pick " + top.clip + " displaced by conflict; assigned " + got.clip);
    if (got.score < 60) concerns.push(b + ": low confidence " + got.score + " for " + got.clip);
    if (second && got.clip === String(top.clip).padStart(2, "0") && (Number(top.score) - Number(second.score)) < 15) concerns.push(b + ": narrow margin between " + top.clip + " and " + second.clip);
  }
}

const adjSchema = {
  type: "object",
  properties: {
    final: {
      type: "array",
      items: {
        type: "object",
        properties: {
          beat: {type: "string"},
          source: {type: "string"},
          evidence_frames: {type: "array", items: {type: "integer"}},
          rival: {type: "string"},
          reason: {type: "string"}
        },
        required: ["beat", "source", "evidence_frames", "rival", "reason"]
      }
    },
    notes: {type: "string"}
  },
  required: ["final", "notes"]
};

let finalSel = null;
if (concerns.length) {
  log("Adjudicating: " + concerns.join(" | "));
  const adj = await agent(
    CONTEXT + "\n\nYOUR ASSIGNMENT: adjudicate the final selection of seven DIFFERENT clips, one per beat.\n" +
    "Per-beat ranking results from independent matchers:\n" + JSON.stringify(matches) + "\n" +
    "Tentative score-maximizing distinct assignment: " + JSON.stringify(assignment) + "\n" +
    "Concerns to resolve: " + JSON.stringify(concerns) + "\n" +
    "For each concerned beat, directly re-inspect the contested clips (extract frames every 0.5-1 s into work/adjudicate/, compare first/middle/last, check work/catalog.json motion per third) against all five fields. A clip can serve only one beat; decide which beat each contested clip truly fits best, and pick the correct alternative for the other. Return all seven beats (unconcerned beats keep their assignment unless you find a clear error). For each: source (two-digit), evidence_frames [a,b] with b-a>=12 within the clip, most similar rival clip, and a reason naming a concrete visible difference between chosen clip and rival. Also write work/final_selection.json.",
    {label: "adjudicate", schema: adjSchema, phase: "Assign"}
  );
  if (adj && adj.final && adj.final.length === 7) finalSel = adj.final;
}
if (!finalSel) {
  if (!assignment) return {status: "unresolved", reason: "Assignment failed", matches, concerns};
  finalSel = ORDER.map(b => {
    const got = assignment.assign[b];
    const cand = matches[b].candidates.find(c => String(c.clip).padStart(2, "0") === got.clip) || {};
    const isTop = String(matches[b].candidates[0].clip).padStart(2, "0") === got.clip;
    return {
      beat: b,
      source: got.clip,
      evidence_frames: cand.evidence_frames || [],
      rival: isTop ? matches[b].most_similar_rival : String(matches[b].candidates[0].clip),
      reason: isTop ? matches[b].visible_difference : (cand.field_check || "")
    };
  });
}
// normalize & distinctness check
finalSel = ORDER.map(b => {
  const f = finalSel.find(x => x.beat === b);
  return f ? Object.assign({}, f, {source: String(f.source).padStart(2, "0")}) : null;
});
const srcs = finalSel.filter(Boolean).map(f => f.source);
if (finalSel.includes(null) || new Set(srcs).size !== 7) {
  return {status: "unresolved", reason: "Final selection incomplete or not distinct", finalSel, matches, concerns};
}

// ---------------- Phase 5: Assemble ----------------
phase("Assemble");
const plan = finalSel.map(f => ({
  beat: f.beat,
  thread: f.beat[0],
  source: f.source,
  frame_count_from_catalog: meta_by_clip[f.source] ? meta_by_clip[f.source].frame_count : null,
  evidence_frames: f.evidence_frames,
  rival: f.rival,
  reason: f.reason
}));

const assembleTask = (extra) => agent(
  CONTEXT + "\n\nYOUR ASSIGNMENT: produce the three deliverables in output/ for this FINAL selection (already decided; do not change clips):\n" + JSON.stringify(plan) + "\n" +
  "Output order: A1, B1, A2, B2, A3, B3, A4 (the plan is already in that order).\n" +
  "1. Re-verify each source's exact decoded frame count (ffprobe -count_frames) and stream params. Render output/solution.mp4: every source complete, 1x, original direction, no filters except what is needed to normalize format; hard cuts. Recommended: ffmpeg with the 7 inputs and the concat filter ([0:v][1:v]...concat=n=7:v=1:a=0, with setsar=1 and format=yuv420p, settb/setpts if needed), -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -r 30 -fps_mode cfr (or -vsync cfr) -an, -movflags +faststart. Ensure 1280x720, SAR 1:1, r_frame_rate 30/1, no audio stream. Only if all sources share identical codec params, lossless concat demuxer with -c copy is acceptable, but verify timestamps are contiguous.\n" +
  "2. Verify the decoded frame count of solution.mp4 equals the sum of the source frame counts exactly (no dropped/duplicated frames). Additionally verify content: for each segment compare a few output frames (first, middle, last of the segment) with the corresponding source frames (PSNR > ~35 dB or small mean abs diff) to confirm alignment.\n" +
  "3. Write output/solution.json: {\"segments\":[...7 objects in output order...]}, each {thread, beat, source:\"NN\", output:[start,end] seconds, source_range:[0,duration], output_frames:[first,last_exclusive], source_frames:[0,frame_count]}. Frames contiguous from 0; seconds = frames/30 rounded to 3+ decimals; final output_frames end = decoded frame count of solution.mp4; duration = frame_count/30.\n" +
  "4. Write output/selection-evidence.json: JSON array of 7 objects in output order {beat, source, source_frames:[a,b], reason}. b-a >= 12, 0 <= a < b <= frame_count. The reason must name a concrete visible difference between the chosen clip and the most similar other candidate (name that rival clip number), e.g. motion direction, which side a subject is on, presence of a specific animal. Use the plan's evidence/rival/reason; if a frame range is missing or invalid, open the frames and pick a valid range showing the feature; tighten vague reasons by inspecting the rival clip frames yourself.\n" +
  "5. Ensure output/ contains EXACTLY these three files (delete anything else; keep scratch in work/).\n" +
  (extra ? "\nADDITIONAL ISSUES TO FIX FROM VALIDATION:\n" + extra + "\n" : "") +
  "Return a short report with the frame counts and checks performed.",
  {label: extra ? "assemble-repair" : "assemble", phase: "Assemble"}
);

const asm = await assembleTask(null);
if (asm === null) log("Assembly worker returned null; validation will reveal state");

// ---------------- Phase 6: Validate ----------------
phase("Validate");
const valSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    output_frame_count: {type: "integer"}
  },
  required: ["passed", "issues"]
};
const validate = () => agent(
  CONTEXT + "\n\nYOUR ASSIGNMENT: independently validate the deliverables in output/ (do not modify them). Expected selection in order: " + JSON.stringify(plan.map(p => ({beat: p.beat, source: p.source}))) + "\n" +
  "Write and run a Python checker (work/tools/validate.py) that checks: output/ has exactly solution.mp4, solution.json, selection-evidence.json; solution.mp4 is h264, yuv420p, 1280x720, SAR 1:1 (or unset equivalent 1:1), r_frame_rate 30/1, constant frame rate, no audio stream; decoded frame count equals sum of source frame counts and equals the last output_frames end; solution.json has 7 segments in order A1,B1,A2,B2,A3,B3,A4 with threads A,B alternating, sources match the expected selection, all distinct, output_frames contiguous from 0, source_frames [0,frame_count] matching each source's decoded count, seconds = frames/30 within 0.001; every output frame of each segment matches the corresponding source frame (compute per-frame mean abs difference or PSNR over all frames or at least every 5th frame plus segment boundaries; flag any misalignment, off-by-one, or PSNR < 30 dB); selection-evidence.json is an array of 7 objects with beat, source, source_frames [a,b] with b-a>=12 and within the clip, and a reason that names a concrete visible difference vs a named rival clip.\n" +
  "Return passed=true only if every check passes; list each failing check precisely in issues.",
  {label: "validate", schema: valSchema, phase: "Validate"}
);

let verdict = await validate();
let repairs = 0;
while ((!verdict || !verdict.passed) && repairs < 2) {
  const issues = verdict ? verdict.issues.join("\n") : "Validator returned no result; re-check everything and ensure all deliverables are present and correct.";
  await assembleTask(issues);
  repairs++;
  verdict = await validate();
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  selection: plan.map(p => ({beat: p.beat, source: p.source, rival: p.rival})),
  concerns,
  repairs,
  verdict,
  assembly_report: asm
};
