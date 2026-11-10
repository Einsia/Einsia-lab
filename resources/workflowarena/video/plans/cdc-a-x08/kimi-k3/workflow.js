export const meta = {
  name: "cdc-a-x08-reef-assembly",
  description: "Inventory 46 anonymous reef clips, match seven beat definitions, intercut threads A/B, assemble solution.mp4/json/evidence, and verify",
  phases: [
    {title: "inventory", detail: "ffprobe all clips; extract frame grids and camera-motion profiles to work/"},
    {title: "describe", detail: "batched visual description of every clip from extracted frames"},
    {title: "shortlist", detail: "rank top candidate clips per beat from the description catalog"},
    {title: "deep-dive", detail: "per-beat frame-level comparison of shortlisted candidates"},
    {title: "resolve", detail: "enforce exactly one distinct clip per beat"},
    {title: "assemble", detail: "concat chosen clips, write solution.mp4, solution.json, selection-evidence.json"},
    {title: "qa", detail: "verify deliverables frame-by-frame and repair if needed"}
  ]
};

// ---------- static task data ----------
const BEATS = [
  {id: "A1", thread: "A", text: "Shallow reef mound with moving glinting water surface visible at top of frame; a mound of yellow-brown plate coral fills most of the right side, distant sand and scattered rocks on the left. Shot size: wide tightening to medium-wide. Camera angle: level from just below the mound top, tilted slightly up toward the surface. Lens: wide, strong near/far size difference. Movement: continuous forward swim toward the mound throughout; the mound grows steadily and stays in frame."},
  {id: "A2", thread: "A", text: "Opens close along the rim of a large pinkish-brown table coral whose fine branches fill the lower frame; camera then clears the table top, revealing pale sand ahead and another table coral in the distance. Shot size: close widening to wide. Camera angle: from roughly table-top height rising to a slightly high angle above the table. Lens: wide. Movement: continuous forward travel with a rise, passing over the coral top and continuing on."},
  {id: "A3", thread: "A", text: "Open, pale, cracked limestone seabed; a dark hollow and reef lip on the left of frame; a black long-spined sea urchin mid-frame that keeps growing larger during the clip. Shot size: wide tightening to a close shot of the urchin. Camera angle: oblique high angle just above the seabed. Lens: wide. Movement: dolly-in toward the urchin, with clear parallax between near seabed and distant reef lip."},
  {id: "A4", thread: "A", text: "Layered table-coral reef under deep blue water with many small fish above it; near the end several white, orange-banded butterflyfish swim into the foreground. Shot size: wide. Camera angle: level, slightly downward. Lens: wide. Movement: hovering locked-off frame; framing stays essentially still, no push, pull, pan or drift."},
  {id: "B1", thread: "B", text: "Large school of yellow-green surgeonfish with black vertical bars feeding over the reef; several fish pass extremely close to the lens as large defocused foreground masses; midway a large dark fish moves through the school. Shot size: medium to close on fish bodies, reef as background. Camera angle: level, close to the reef surface. Lens: wide; near fish heavily out of focus. Movement: handheld hover inside the school with only small shake."},
  {id: "B2", thread: "B", text: "Low over a flat coral platform with a low reef overhang ahead; the shadow beneath it is at first almost unreadable, and as the camera nears, schools of small yellow fish and red fish shapes appear. Shot size: wide tightening to medium. Camera angle: low, level, close to the bottom. Lens: medium-wide; near platform texture sharp. Movement: slow low push toward the overhang, settling to a stop at the end."},
  {id: "B3", thread: "B", text: "Several whitetip reef sharks cruise low over sand and coral rubble; first distant and small, they come closer and fill a large part of the frame, ending over a patch of white coral rubble and table corals. Shot size: wide tightening to medium. Camera angle: oblique high angle slightly above the sharks. Lens: wide. Movement: lateral tracking: camera moves toward frame-left with the sharks, so sand and reef stream continuously from left side of frame to right."}
];
const OUTPUT_ORDER = ["A1", "B1", "A2", "B2", "A3", "B3", "A4"];
const CLIP_IDS = [];
for (let i = 1; i <= 46; i++) CLIP_IDS.push(i < 10 ? "0" + i : "" + i);

const COMMON = "Workspace is /workspace. Task details are in instruction.md (read it). Inputs: input/01.mp4 .. input/46.mp4 (H.264, 1280x720, 30 fps, 6-12 s, silent). Use work/ for scratch and output/ for deliverables. Tools available: Python 3.11, FFmpeg/ffprobe, OpenCV; no GPU, no network. ";

// ---------- helpers ----------
function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function buildSolutionJson(selection, frameCounts) {
  const segs = [];
  let f0 = 0;
  for (const beat of OUTPUT_ORDER) {
    const src = selection[beat];
    const n = frameCounts[src];
    segs.push({
      thread: beat.charAt(0),
      beat: beat,
      source: src,
      output: [f0 / 30, (f0 + n) / 30],
      source_range: [0, n / 30],
      output_frames: [f0, f0 + n],
      source_frames: [0, n]
    });
    f0 += n;
  }
  return {segments: segs};
}

// ---------- phase 1: inventory ----------
phase("inventory");
log("Probing all 46 clips and extracting frames/motion profiles");
const inventory = await agent(
  COMMON +
  "Do a complete technical inventory of all 46 clips. Steps:\n" +
  "1. Run ffprobe on every input/NN.mp4 and record exact decoded video frame count (count frames with ffprobe -count_frames or decode), container duration, width/height, fps, SAR, pix_fmt, and whether an audio stream exists.\n" +
  "2. For each clip, extract 12 frames evenly spaced across its full duration (including first and last) at 640x360 JPEG into work/frames/NN/f00.jpg..f11.jpg, plus full-resolution first and last frames work/frames/NN/full_first.png and full_last.png.\n" +
  "3. For each clip, compute a coarse camera-motion profile with OpenCV (e.g. per-second global translation/scale estimate from feature matching or dense flow between sampled frames) and save as work/motion/NN.json with fields like dx_per_s, dy_per_s, scale_per_s, jitter. This helps distinguish dolly-in / forward swim / lateral track / locked-off hover.\n" +
  "4. Write work/probe.json mapping clip id -> {frames, duration_s, width, height, fps, sar, pix_fmt, has_audio}.\n" +
  "Return the probe data for all 46 clips. Frame counts must come from actual decoding (count_frames), not container metadata guesses.",
  {
    label: "inventory",
    schema: {
      type: "object",
      properties: {
        clips: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {type: "string"},
              frames: {type: "integer"},
              duration_s: {type: "number"},
              width: {type: "integer"},
              height: {type: "integer"},
              fps: {type: "number"},
              has_audio: {type: "boolean"}
            },
            required: ["id", "frames", "duration_s", "width", "height", "fps", "has_audio"],
            additionalProperties: false
          }
        },
        notes: {type: "string"}
      },
      required: ["clips", "notes"],
      additionalProperties: false
    }
  }
);
if (inventory === null || !inventory.clips || inventory.clips.length !== 46) {
  return {status: "unresolved", stage: "inventory", reason: "Inventory worker failed or returned incomplete data", inventory};
}
const frameCounts = {};
for (const c of inventory.clips) frameCounts[c.id] = c.frames;
log("Inventory complete for 46 clips");

// ---------- phase 2: batched descriptions ----------
phase("describe");
const descSchema = {
  type: "object",
  properties: {
    descriptions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          subjects: {type: "string", description: "animals/subjects visible, species-level where possible, and how they behave over time"},
          terrain: {type: "string", description: "reef terrain, coral types, colors, sand, water surface visibility"},
          shot_size: {type: "string"},
          camera_angle: {type: "string"},
          lens_cues: {type: "string", description: "wide vs medium, distortion, near/far size difference, defocused foreground"},
          camera_movement: {type: "string", description: "direction and character of motion and how it evolves over the whole clip"},
          motion_profile: {type: "string", description: "summary of work/motion/NN.json numbers"},
          distinctive: {type: "string", description: "anything that uniquely identifies this clip vs similar ones"}
        },
        required: ["clip", "subjects", "terrain", "shot_size", "camera_angle", "lens_cues", "camera_movement", "motion_profile", "distinctive"],
        additionalProperties: false
      }
    }
  },
  required: ["descriptions"],
  additionalProperties: false
};

function describePrompt(batch) {
  return COMMON +
    "Visually describe these clips: " + batch.join(", ") + ".\n" +
    "For each clip NN: view all extracted frames work/frames/NN/f00.jpg..f11.jpg in order (they are evenly spaced across the whole clip) plus the full-resolution first/last frames, and read work/motion/NN.json. " +
    "If the extracted frames are insufficient to judge content or motion, extract additional frames yourself with ffmpeg into work/frames/NN/ and view them. " +
    "Describe what is actually visible; do not guess beyond the evidence. Pay attention to: coral types and colors, fish species and schooling behavior, sharks/urchins, whether the water surface is visible, camera height and angle, and especially how framing and camera motion evolve from the first frame to the last. " +
    "Return one description object per clip, clip field as the two-digit id.";
}

const batches = chunks(CLIP_IDS, 4);
let descResults = await parallel(batches.map((batch, i) => () =>
  agent(describePrompt(batch), {label: "describe-" + i, phase: "describe", schema: descSchema})
));
// retry failed batches once, sequentially
for (let i = 0; i < batches.length; i++) {
  if (descResults[i] === null || !descResults[i].descriptions) {
    log("Retrying description batch " + i);
    descResults[i] = await agent(describePrompt(batches[i]), {label: "describe-retry-" + i, phase: "describe", schema: descSchema});
  }
}
const catalog = {};
const missingDesc = [];
for (let i = 0; i < batches.length; i++) {
  const r = descResults[i];
  if (r === null || !r.descriptions) {
    for (const id of batches[i]) missingDesc.push(id);
    continue;
  }
  for (const d of r.descriptions) if (d && d.clip) catalog[d.clip] = d;
}
for (const id of CLIP_IDS) if (!catalog[id] && !missingDesc.includes(id)) missingDesc.push(id);
if (missingDesc.length > 0) {
  log("Missing descriptions for: " + missingDesc.join(","));
}
// persist catalog for later workers
await agent(
  COMMON + "Write the following JSON verbatim to work/catalog.json (pretty-printed). Do not change any content.\n" + JSON.stringify(catalog),
  {label: "save-catalog", phase: "describe"}
);
log("Catalog built with " + Object.keys(catalog).length + " clip descriptions");

// ---------- phase 3: shortlist per beat ----------
phase("shortlist");
const shortlist = await agent(
  COMMON +
  "You are matching anonymous underwater clips to beat definitions for a reef-exploration edit. Below is the description catalog for all 46 clips (also saved at work/catalog.json), followed by the seven beat definitions. " +
  "For EACH beat, rank the top 4 candidate clip ids (two-digit strings) whose description, shot size, camera angle, lens cues and camera movement over the whole clip best match ALL five fields of the beat. The same clip may appear in several beats' lists at this stage; that is resolved later. " +
  "Clips missing from the catalog (" + (missingDesc.length ? missingDesc.join(",") : "none") + ") may still be listed if you have reason to, but prefer described clips.\n\n" +
  "BEAT DEFINITIONS:\n" + BEATS.map(b => b.id + " [" + b.thread + "]: " + b.text).join("\n\n") +
  "\n\nCATALOG:\n" + JSON.stringify(catalog),
  {
    label: "shortlist",
    phase: "shortlist",
    schema: {
      type: "object",
      properties: {
        rankings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              beat: {type: "string"},
              candidates: {type: "array", items: {type: "string"}, minItems: 2, maxItems: 4}
            },
            required: ["beat", "candidates"],
            additionalProperties: false
          }
        }
      },
      required: ["rankings"],
      additionalProperties: false
    }
  }
);
if (shortlist === null || !shortlist.rankings) {
  return {status: "unresolved", stage: "shortlist", reason: "Shortlist worker failed"};
}
const candByBeat = {};
for (const r of shortlist.rankings) candByBeat[r.beat] = r.candidates;
for (const b of BEATS) {
  if (!candByBeat[b.id] || candByBeat[b.id].length < 2) {
    return {status: "unresolved", stage: "shortlist", reason: "No shortlist for beat " + b.id, shortlist};
  }
}

// ---------- phase 4: per-beat deep dive on frames ----------
phase("deep-dive");
const deepSchema = {
  type: "object",
  properties: {
    beat: {type: "string"},
    chosen: {type: "string"},
    runner_up: {type: "string"},
    reason: {type: "string", description: "concrete visible difference between the chosen clip and the most similar other candidate"},
    evidence_frames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2, description: "[a,b] frame indices inside the chosen clip, b-a>=12, bracketing a decisive moment"},
    confidence: {type: "string", enum: ["high", "medium", "low", "none-fit"]}
  },
  required: ["beat", "chosen", "runner_up", "reason", "evidence_frames", "confidence"],
  additionalProperties: false
};

const deepResults = await parallel(BEATS.map(b => () => agent(
  COMMON +
  "Decide which single candidate clip best matches beat " + b.id + ". Candidates: " + candByBeat[b.id].join(", ") + ".\n" +
  "BEAT " + b.id + " DEFINITION:\n" + b.text + "\n\n" +
  "Method: view the extracted frame sequences work/frames/NN/ for every candidate, read work/motion/NN.json, and read their catalog entries in work/catalog.json. Extract and view additional frames (e.g. every 15-30 frames, or the exact moments where the beat says something changes, such as fish entering near the end) with ffmpeg into work/deepdive/" + b.id + "/ whenever the existing frames cannot settle a field of the beat. " +
  "Check ALL five fields (description content, shot size, camera angle, lens size, camera movement over the whole clip). A candidate that matches content but not camera movement is wrong. " +
  "Choose the best clip (two-digit id). runner_up is the most similar other candidate. reason must name a concrete visible difference between the chosen clip and the runner-up (something a reviewer could verify in the frames). evidence_frames [a,b] must be integer frame indices inside the chosen clip with b-a>=12 that bracket a moment proving the match. " +
  "If none of the candidates fits, set confidence to none-fit and chosen to the least-bad one.",
  {label: "deep-" + b.id, phase: "deep-dive", schema: deepSchema}
)));

const deepByBeat = {};
const deepFailed = [];
for (let i = 0; i < BEATS.length; i++) {
  const r = deepResults[i];
  if (r === null) deepFailed.push(BEATS[i].id); else deepByBeat[BEATS[i].id] = r;
}
if (deepFailed.length > 0) {
  return {status: "unresolved", stage: "deep-dive", reason: "Deep-dive failed for beats: " + deepFailed.join(","), candByBeat};
}

// ---------- phase 5: resolve distinctness and none-fit ----------
phase("resolve");
let selection = {};
for (const b of BEATS) selection[b.id] = deepByBeat[b.id].chosen;

const noneFit = BEATS.filter(b => deepByBeat[b.id].confidence === "none-fit").map(b => b.id);
if (noneFit.length > 0) {
  log("Re-searching beats with no fitting candidate: " + noneFit.join(","));
  const research = await agent(
    COMMON +
    "These beats had no good match among their shortlists: " + noneFit.join(", ") + ". Search the ENTIRE catalog (work/catalog.json, 46 clips) for better candidates, excluding clips already confidently chosen for other beats: " + JSON.stringify(selection) + ". " +
    "View frames in work/frames/NN/ (extract more with ffmpeg if needed) for any catalog entry that could plausibly match each beat definition below. Return the best clip id per beat plus reason and evidence frames [a,b] (b-a>=12).\n\n" +
    BEATS.filter(b => noneFit.includes(b.id)).map(b => b.id + ": " + b.text).join("\n\n"),
    {
      label: "research",
      phase: "resolve",
      schema: {
        type: "object",
        properties: {
          picks: {type: "array", items: deepSchema}
        },
        required: ["picks"],
        additionalProperties: false
      }
    }
  );
  if (research !== null && research.picks) {
    for (const p of research.picks) {
      if (p && p.beat && noneFit.includes(p.beat) && p.confidence !== "none-fit") {
        deepByBeat[p.beat] = p;
        selection[p.beat] = p.chosen;
      }
    }
  }
}

// duplicate resolution
const chosenList = BEATS.map(b => selection[b.id]);
const dupes = chosenList.filter((v, i) => chosenList.indexOf(v) !== i);
if (dupes.length > 0) {
  log("Resolving duplicate clip assignments: " + dupes.join(","));
  const resolver = await agent(
    COMMON +
    "Seven beats must use seven DIFFERENT clips, but the current assignment reuses clips: " + JSON.stringify(selection) + ". " +
    "Per-beat decisions with runner-ups and reasons: " + JSON.stringify(Object.values(deepByBeat)) + ". " +
    "Shortlists: " + JSON.stringify(candByBeat) + ". Catalog: work/catalog.json; frames: work/frames/NN/. " +
    "Produce a final conflict-free assignment of one distinct two-digit clip id per beat (A1,A2,A3,A4,B1,B2,B3), minimizing total mismatch against the beat definitions. For every beat where you change the pick, view the frames of both options first, and supply a new reason plus evidence_frames [a,b] (b-a>=12, inside the new clip). Keep unchanged picks' reasons and evidence frames verbatim.",
    {
      label: "resolve-dupes",
      phase: "resolve",
      schema: {
        type: "object",
        properties: {picks: {type: "array", items: deepSchema, minItems: 7, maxItems: 7}},
        required: ["picks"],
        additionalProperties: false
      }
    }
  );
  if (resolver === null || !resolver.picks || resolver.picks.length !== 7) {
    return {status: "unresolved", stage: "resolve", reason: "Duplicate resolver failed", selection};
  }
  for (const p of resolver.picks) {
    deepByBeat[p.beat] = p;
    selection[p.beat] = p.chosen;
  }
  const l2 = BEATS.map(b => selection[b.id]);
  if (new Set(l2).size !== 7) {
    return {status: "unresolved", stage: "resolve", reason: "Resolver still returned duplicate clips", selection};
  }
}

// validate evidence frames against clip frame counts
for (const b of BEATS) {
  const d = deepByBeat[b.id];
  const n = frameCounts[selection[b.id]];
  if (!d.evidence_frames || d.evidence_frames.length !== 2 ||
      d.evidence_frames[1] - d.evidence_frames[0] < 12 ||
      d.evidence_frames[0] < 0 || d.evidence_frames[1] > n) {
    log("Fixing evidence frames for beat " + b.id);
    d.evidence_frames = [0, Math.min(n, Math.max(12, Math.floor(n / 2)))];
  }
}

const solutionJson = buildSolutionJson(selection, frameCounts);
log("Final selection: " + JSON.stringify(selection));

// ---------- phase 6: assemble ----------
phase("assemble");
const assemble = await agent(
  COMMON +
  "Assemble the final deliverables. Final beat->clip assignment: " + JSON.stringify(selection) + ".\n" +
  "Output order (threads strictly alternate, opening and closing on A): " + OUTPUT_ORDER.join(", ") + ".\n\n" +
  "1. Create output/solution.mp4: concatenate the seven COMPLETE source clips (input/NN.mp4, each used once, entire duration, 1x speed, original direction, no crop/mirror/filter/text/transitions, no added or dropped frames) with hard cuts. " +
  "All inputs are H.264 1280x720 30fps yuv420p, so PREFER lossless stream-copy concatenation (ffmpeg concat demuxer with -c copy). Verify each input's exact parameters with ffprobe first; if stream copy would be invalid due to parameter mismatch, re-encode with libx264 CRF<=18, yuv420p, 1280x720, SAR 1:1, exactly 30/1 fps, no audio (-an). The result must be H.264/yuv420p, 1280x720, SAR 1:1, constant 30 fps, no audio stream.\n" +
  "2. Write output/solution.json EXACTLY with this content (computed from decoded frame counts):\n" + JSON.stringify(solutionJson, null, 2) + "\n" +
  "Before writing, verify with ffprobe -count_frames that each source clip's decoded frame count equals the source_frames value used here; if any differs, recompute all fields consistently (half-open seconds = frames/30, contiguous from frame 0, no gaps) and note the correction.\n" +
  "3. Write output/selection-evidence.json: an array of exactly seven objects, one per beat, {beat, source, source_frames:[a,b], reason}, using these per-beat decisions (reasons name a concrete visible difference from the most similar other candidate; keep them accurate, rewrite only for clarity):\n" +
  JSON.stringify(BEATS.map(b => ({beat: b.id, source: selection[b.id], source_frames: deepByBeat[b.id].evidence_frames, reason: deepByBeat[b.id].reason})), null, 2) + "\n" +
  "4. Ensure output/ contains EXACTLY these three files (solution.mp4, solution.json, selection-evidence.json); remove anything else from output/.\n" +
  "5. Sanity-check: decode solution.mp4 and confirm total decoded frame count equals the sum of the seven source frame counts and equals the final segment end*30 in solution.json. Report per-clip frame counts, total frames, encoding method used (copy vs re-encode+CRF), and any corrections made.",
  {label: "assemble", phase: "assemble"}
);
if (assemble === null) {
  return {status: "unresolved", stage: "assemble", reason: "Assembly worker failed", selection};
}

// ---------- phase 7: QA + repair loop ----------
phase("qa");
const qaSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues"],
  additionalProperties: false
};
const qaPrompt =
  COMMON +
  "Independently verify the deliverables for this task (do not trust prior reports). Assignment: " + JSON.stringify(selection) + ", output order " + OUTPUT_ORDER.join(",") + ".\n" +
  "Check, using ffprobe/ffmpeg/OpenCV as needed:\n" +
  "1. output/ contains exactly solution.mp4, solution.json, selection-evidence.json.\n" +
  "2. solution.mp4 is H.264/yuv420p, 1280x720, SAR 1:1, constant 30/1 fps, no audio stream.\n" +
  "3. solution.json has exactly 7 segments in the required order with correct thread/beat labels; seconds are half-open, contiguous from 0, no gaps/overlaps; seconds equal frames/30 within 0.001 s; source_range=[0,duration] and source_frames=[0,frame_count] match each named input clip's actual decoded frame count; the final output end equals the decoded frame count of solution.mp4 (end*30 == frames).\n" +
  "4. Frame-by-frame: for each segment, decode the corresponding output frame range and the named source clip and confirm the frames match (exact match for stream copy; if a CRF<=18 re-encode was used, confirm with a strict perceptual comparison such as per-frame SSIM/PSNR thresholds and identical frame counts). Any dropped/duplicated/reordered frame or wrong source is a failure.\n" +
  "5. selection-evidence.json is an array of 7 objects with keys beat, source, source_frames [a,b] (b-a>=12, both inside the named clip's frame count), and a reason that names a concrete visible difference from another candidate (not vague praise).\n" +
  "6. Spot-check by viewing a few frames around each cut boundary in solution.mp4 to confirm hard cuts and correct clip identity.\n" +
  "Report passed only if every check succeeds; list concrete issues otherwise.";

let verdict = await agent(qaPrompt, {label: "qa-0", phase: "qa", schema: qaSchema});
let repairs = 0;
const maxRepairs = 3;
while (verdict !== null && !verdict.passed && repairs < maxRepairs) {
  repairs++;
  log("QA found issues, repair round " + repairs + ": " + JSON.stringify(verdict.issues));
  const repair = await agent(
    COMMON +
    "Fix the following verified problems with the deliverables in output/ (assignment " + JSON.stringify(selection) + ", order " + OUTPUT_ORDER.join(",") + "). Rebuild or edit files as needed so every requirement in instruction.md is met. Issues:\n" +
    JSON.stringify(verdict.issues, null, 2) +
    "\nAfter fixing, re-run your own ffprobe/decoder checks and report what you changed.",
    {label: "repair-" + repairs, phase: "qa"}
  );
  if (repair === null) {
    return {status: "unresolved", stage: "repair", reason: "Repair worker failed", issues: verdict.issues, selection};
  }
  verdict = await agent(qaPrompt, {label: "qa-" + repairs, phase: "qa", schema: qaSchema});
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  selection,
  outputOrder: OUTPUT_ORDER,
  frameCounts: Object.fromEntries(BEATS.map(b => [b.id, frameCounts[selection[b.id]]])),
  evidence: BEATS.map(b => ({beat: b.id, source: selection[b.id], source_frames: deepByBeat[b.id].evidence_frames, reason: deepByBeat[b.id].reason, confidence: deepByBeat[b.id].confidence})),
  missingDescriptions: missingDesc,
  repairsUsed: repairs,
  qa: verdict,
  inventoryNotes: inventory.notes
};
