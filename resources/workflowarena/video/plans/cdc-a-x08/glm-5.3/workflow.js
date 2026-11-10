export const meta = {
  name: "cdc-a-x08-intercut-assembly",
  description: "Screen 46 anonymous underwater clips, match 7 to beats A1-B3, assemble intercut solution.mp4 with JSON manifests, and verify deliverables",
  phases: [
    {title: "Probe inputs", detail: "ffprobe frame counts and stream parameters for all 46 clips"},
    {title: "Screen clips", detail: "Contact sheets + motion analysis + structured descriptions for every candidate"},
    {title: "Match beats", detail: "Rank candidates per beat against all five beat fields"},
    {title: "Verify beats", detail: "Deep per-beat comparison of top candidate vs. nearest other candidate"},
    {title: "Finalize selection", detail: "Resolve duplicates and produce evidence reasons"},
    {title: "Assemble output", detail: "Lossless concat and write the three deliverables"},
    {title: "Verify and repair", detail: "Independent check of all deliverables with repair loop"}
  ]
};

// ---------------------------------------------------------------- context

const BEATS = {
  A1: {
    thread: "A",
    description: "A shallow reef mound with the moving, glinting water surface visible at the top of frame; a mound of yellow-brown plate coral fills most of the right side, distant sand and scattered rocks on the left.",
    shot_size: "Wide, tightening to medium-wide.",
    camera_angle: "Level from just below the mound top, tilted slightly up toward the surface.",
    lens_size: "Wide, strong near/far size difference.",
    camera_movement: "Continuous forward swim toward the mound throughout; the mound grows steadily and stays in frame."
  },
  A2: {
    thread: "A",
    description: "Opens close along the rim of a large pinkish-brown table coral whose fine branches fill the lower frame; the camera then clears the table top, revealing pale sand ahead and another table coral in the distance.",
    shot_size: "Close, widening to wide.",
    camera_angle: "From roughly table-top height rising to a slightly high angle above the table.",
    lens_size: "Wide.",
    camera_movement: "Continuous forward travel with a rise, passing over the coral top and continuing on."
  },
  A3: {
    thread: "A",
    description: "Open, pale, cracked limestone seabed; a dark hollow and reef lip on the left of frame; a black long-spined sea urchin mid-frame that keeps growing larger during the clip.",
    shot_size: "Wide, tightening to a close shot of the urchin.",
    camera_angle: "Oblique high angle just above the seabed.",
    lens_size: "Wide.",
    camera_movement: "Dolly-in toward the urchin, with clear parallax between the near seabed and the distant reef lip."
  },
  A4: {
    thread: "A",
    description: "A layered table-coral reef under deep blue water with many small fish above it; near the end several white, orange-banded butterflyfish swim into the foreground.",
    shot_size: "Wide.",
    camera_angle: "Level, slightly downward.",
    lens_size: "Wide.",
    camera_movement: "Hovering locked-off frame; the framing stays essentially still, with no push, pull, pan or drift."
  },
  B1: {
    thread: "B",
    description: "A large school of yellow-green surgeonfish with black vertical bars feeds over the reef; several fish pass extremely close to the lens as large defocused foreground masses; midway a large dark fish moves through the school.",
    shot_size: "Medium to close on fish bodies, reef as background.",
    camera_angle: "Level, close to the reef surface.",
    lens_size: "Wide; near fish heavily out of focus.",
    camera_movement: "Handheld hover inside the school with only small shake."
  },
  B2: {
    thread: "B",
    description: "Low over a flat coral platform with a low reef overhang ahead; the shadow beneath it is at first almost unreadable, and as the camera nears, schools of small yellow fish and red fish shapes appear.",
    shot_size: "Wide, tightening to medium.",
    camera_angle: "Low, level, close to the bottom.",
    lens_size: "Medium-wide; near platform texture sharp.",
    camera_movement: "Slow low push toward the overhang, settling to a stop at the end."
  },
  B3: {
    thread: "B",
    description: "Several whitetip reef sharks cruise low over sand and coral rubble; first distant and small, they come closer and fill a large part of the frame, ending over a patch of white coral rubble and table corals.",
    shot_size: "Wide, tightening to medium.",
    camera_angle: "Oblique high angle slightly above the sharks.",
    lens_size: "Wide.",
    camera_movement: "Lateral tracking: the camera moves toward frame-left with the sharks, so sand and reef stream continuously from the left side of frame to the right."
  }
};

const ORDER = ["A1", "B1", "A2", "B2", "A3", "B3", "A4"]; // A opens and closes; strict alternation
const ALL_CLIPS = Array.from({length: 46}, (_, i) => String(i + 1).padStart(2, "0"));

const maxRepairs = (args && typeof args.maxRepairs === "number" && args.maxRepairs >= 0) ? args.maxRepairs : 2;

function beatSpecText(beat) {
  const b = BEATS[beat];
  return `Beat ${beat} (thread ${b.thread}):
- description: ${b.description}
- shot_size: ${b.shot_size}
- camera_angle: ${b.camera_angle}
- lens_size: ${b.lens_size}
- camera_movement: ${b.camera_movement}`;
}
const ALL_BEAT_SPECS = ORDER.map(beatSpecText).join("\n\n");

// ---------------------------------------------------------------- schemas

const probeSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          duration_s: {type: "number"},
          frame_count: {type: "integer"},
          fps: {type: "string"},
          width: {type: "integer"},
          height: {type: "integer"},
          pix_fmt: {type: "string"},
          has_audio: {type: "boolean"}
        },
        required: ["clip", "duration_s", "frame_count", "fps", "width", "height", "pix_fmt", "has_audio"],
        additionalProperties: false
      }
    },
    anomalies: {type: "array", items: {type: "string"}}
  },
  required: ["clips", "anomalies"],
  additionalProperties: false
};

const screeningSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          summary: {type: "string"},
          subjects: {type: "array", items: {type: "string"}},
          scene: {type: "string"},
          colors: {type: "string"},
          motion: {type: "string"},
          motion_confidence: {type: "string"},
          notes: {type: "string"}
        },
        required: ["clip", "summary", "subjects", "scene", "colors", "motion", "motion_confidence", "notes"],
        additionalProperties: false
      }
    }
  },
  required: ["clips"],
  additionalProperties: false
};

const matchSchema = {
  type: "object",
  properties: {
    beats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          beat: {type: "string"},
          ranked: {
            type: "array",
            items: {
              type: "object",
              properties: {
                clip: {type: "string"},
                score: {type: "number"},
                fit: {type: "string"},
                mismatches: {type: "string"}
              },
              required: ["clip", "score", "fit", "mismatches"],
              additionalProperties: false
            }
          }
        },
        required: ["beat", "ranked"],
        additionalProperties: false
      }
    }
  },
  required: ["beats"],
  additionalProperties: false
};

const verifySchema = {
  type: "object",
  properties: {
    beat: {type: "string"},
    chosen: {type: "string"},
    runner_up: {type: "string"},
    confirmed: {type: "boolean"},
    reason: {type: "string"},
    concerns: {type: "string"}
  },
  required: ["beat", "chosen", "runner_up", "confirmed", "reason", "concerns"],
  additionalProperties: false
};

const selectionSchema = {
  type: "object",
  properties: {
    selection: {
      type: "array",
      items: {
        type: "object",
        properties: {
          beat: {type: "string"},
          source: {type: "string"},
          runner_up: {type: "string"},
          reason: {type: "string"}
        },
        required: ["beat", "source", "runner_up", "reason"],
        additionalProperties: false
      }
    },
    notes: {type: "string"}
  },
  required: ["selection", "notes"],
  additionalProperties: false
};

const assemblySchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    total_frames: {type: "integer"},
    method: {type: "string"},
    files: {type: "array", items: {type: "string"}},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["ok", "total_frames", "method", "files", "issues"],
  additionalProperties: false
};

const verdictSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues"],
  additionalProperties: false
};

// ---------------------------------------------------------------- phase 1: probe

phase("Probe inputs");

const probePrompt =
  "You are working on task CDC-A-X08 (see instruction.md). The workspace contains 46 anonymous silent candidate clips: " +
  "input/01.mp4 through input/46.mp4 (H.264, expected 1280x720, square pixels, 30 fps, 6.0-12.0 s each). " +
  "Use ffprobe (e.g. `ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames,avg_frame_rate,width,height,pix_fmt,sample_aspect_ratio,r_frame_rate -of json input/NN.mp4`) " +
  "to obtain, for EVERY one of the 46 clips, the exact decoded frame count, average frame rate, width, height, pixel format, SAR, duration, and whether any audio stream exists. " +
  "Also create the scratch directory work/ and save a JSON file work/probe.json with one record per clip (clip id \"01\"..\"46\", frame_count, duration_s, fps, width, height, pix_fmt, has_audio). " +
  "Do NOT modify anything in input/ or output/. Report every clip's data in the structured result, and flag any clip whose parameters deviate from the expected spec (wrong resolution, non-30fps, audio present, odd frame count, etc.) in `anomalies`. " +
  "Be exact: the frame counts you report will be used to build the output manifests.";

const probe = await agent(probePrompt, {label: "probe-clips", phase: "Probe inputs", schema: probeSchema});

let probeByClip = {};
if (probe && Array.isArray(probe.clips)) {
  for (const c of probe.clips) probeByClip[c.clip] = c;
}
const probeSummary = Object.keys(probeByClip).length === 46
  ? JSON.stringify(probe.clips)
  : JSON.stringify({available: Object.keys(probeByClip), anomalies: probe ? probe.anomalies : ["probe worker returned no data"]});
log(`Probe complete: ${Object.keys(probeByClip).length}/46 clips measured`);

// ---------------------------------------------------------------- phase 2: screening

phase("Screen clips");

const batches = [];
const per = 6;
for (let i = 0; i < ALL_CLIPS.length; i += per) batches.push(ALL_CLIPS.slice(i, i + per));

const screeningPrompt = (batch) =>
  "You are one of several screening workers on task CDC-A-X08 (see instruction.md). Your job: produce an accurate, content-focused description of each of these candidate underwater clips: " +
  batch.join(", ") + " (files input/NN.mp4 in the workspace). These are anonymous licensed underwater documentary excerpts; clip numbers are random and attribution is withheld — do NOT try to identify the source production, just describe what is visibly in the footage.\n\n" +
  "For EACH clip do all of the following:\n" +
  "1. Extract contact-sheet frames so the content can be inspected: e.g. `mkdir -p work/frames/NN && ffmpeg -i input/NN.mp4 -vf \"select='not(mod(n,15))',scale=640:-1,tile=5x4\" -vsync vfr work/frames/NN/sheet_%02d.png` and/or evenly spaced single frames `ffmpeg -i input/NN.mp4 -vf fps=2,scale=960:-1 work/frames/NN/f_%03d.jpg`. View the extracted images yourself if you can.\n" +
  "2. Compute a quantitative global-motion summary with Python 3.11 + OpenCV: dense optical flow (cv2.calcOpticalFlowFarneback) or frame-to-frame feature tracking between sampled frames. Estimate per-frame global translation (dx, dy in px/frame), a zoom/scale factor, and overall magnitude. Save per-clip stats to work/motion/NN.json and summarize in words, e.g. 'steady forward push-in, ~2 px/frame expansion of central subject, negligible lateral drift' or 'essentially static framing, jitter < 0.3 px/frame' or 'lateral track toward frame-left, background streams right-to-left'.\n" +
  "3. Describe the CONTENT precisely: main visible subjects (coral types, fish species/colors/shapes, urchins, sharks, seabed type), scene layout (left/right/top/bottom of frame), dominant colors, water tone, lighting, foreground/background structure, sharpness/defocus of near objects, and how the framing changes from the first to the last frame (shot size start and end, angle).\n\n" +
  "Later matching stages will compare your descriptions against these required beats:\n\n" + ALL_BEAT_SPECS + "\n\n" +
  "So capture exactly the kind of detail those beats name: water surface glints, plate/table coral mounds, pale cracked limestone, sea urchins, butterflyfish with orange bands, surgeonfish schools with black bars, dark overhangs with yellow/red fish, whitetip reef sharks over rubble, forward swims, dolly-ins, low pushes, lateral tracking, locked-off hovers, parallax between near seabed and distant reef.\n" +
  "In the structured result return one object per clip with: clip (\"NN\"), summary (2-5 sentences of content), subjects (list of visible subjects/features), scene (layout: what is on left/right/foreground/background), colors (dominant colors and water tone), motion (camera movement in words, with quantitative estimates), motion_confidence (how certain the motion classification is and why), notes (anything distinctive: defocused near fish, mid-clip events like a dark fish crossing, end-of-clip foreground entries, stillness vs drift). " +
  "Describe only what you can actually verify from the frames and motion data — do not guess. Cover all " + batch.length + " clips.";

const screeningResults = await parallel(batches.map((batch, i) => () =>
  agent(screeningPrompt(batch), {label: `screen-${batch[0]}-${batch[batch.length - 1]}`, phase: "Screen clips", schema: screeningSchema})
));

const descriptions = [];
const screeningGaps = [];
screeningResults.forEach((res, i) => {
  if (res && Array.isArray(res.clips)) {
    for (const c of res.clips) {
      if (c && c.clip && typeof c.summary === "string") descriptions.push(c);
      else screeningGaps.push(batches[i]);
    }
  } else {
    screeningGaps.push(batches[i]);
  }
});
log(`Screening complete: ${descriptions.length} clip descriptions collected; failed batches: ${screeningGaps.length}`);

// Retry any failed screening batch once, split into halves for reliability.
const retryBatches = [];
for (const b of screeningGaps) {
  const mid = Math.ceil(b.length / 2);
  retryBatches.push(b.slice(0, mid), b.slice(mid));
}
const retried = retryBatches.length ? await parallel(retryBatches.map((batch, i) => () =>
  agent(screeningPrompt(batch) + "\n\nNOTE: a previous attempt to describe these clips failed or returned nothing. Be careful to complete the work and return the structured result for every clip.",
    {label: `rescreen-${batch[0] || "x"}-${batch[batch.length - 1] || "x"}`, phase: "Screen clips", schema: screeningSchema})
)) : [];
const covered = new Set(descriptions.map(d => d.clip));
retried.forEach(res => {
  if (res && Array.isArray(res.clips)) for (const c of res.clips) {
    if (c && c.clip && !covered.has(c.clip)) { descriptions.push(c); covered.add(c.clip); }
  }
});

if (descriptions.length < 46) {
  log(`Warning: only ${descriptions.length}/46 clips described after retry`);
}
const describedIds = descriptions.map(d => d.clip);
const missingIds = ALL_CLIPS.filter(id => !covered.has(id));
const descriptionsJson = JSON.stringify(descriptions);

// ---------------------------------------------------------------- phase 3: beat matching

phase("Match beats");

const matchPrompt =
  "You are the beat-matching worker for task CDC-A-X08 (see instruction.md). Below are structured descriptions (content + camera motion) of the candidate clips:\n\n" +
  descriptionsJson + "\n\n" +
  (missingIds.length ? "WARNING: these clips could not be screened and have no description (treat as last resort, or inspect input/" + missingIds.join(", input/") + " yourself if you need them): " + missingIds.join(", ") + "\n\n" : "") +
  "The piece needs exactly seven DIFFERENT clips, one per beat. Match each clip against ALL FIVE fields of its beat (description/content, shot_size, camera_angle, lens_size, camera_movement). The camera movement over the WHOLE clip matters as much as the content:\n\n" + ALL_BEAT_SPECS + "\n\n" +
  "For each of the seven beats, rank the top 3 candidate clips (from the descriptions above) by fit. Give each a score from 0 to 1 reflecting how well it matches all five fields, a `fit` sentence naming which fields match, and a `mismatches` sentence naming any field that does NOT match or is uncertain (be honest — later workers will re-verify your top pick against the runner-up). " +
  "If two beats seem to point at the same clip, say so explicitly in the fit/mismatches text so the conflict can be resolved. Return exactly seven beat objects (A1, B1, A2, B2, A3, B3, A4), each with a ranked list of 3 candidates.";

const match = await agent(matchPrompt, {label: "match-beats", phase: "Match beats", schema: matchSchema});

let rankedByBeat = {};
if (match && Array.isArray(match.beats)) {
  for (const b of match.beats) {
    if (b && b.beat && Array.isArray(b.ranked)) rankedByBeat[b.beat] = b.ranked.filter(r => r && r.clip && ALL_CLIPS.includes(r.clip));
  }
}
const missingBeats = ORDER.filter(b => !rankedByBeat[b] || rankedByBeat[b].length === 0);
if (missingBeats.length) {
  log(`Matcher missing beats: ${missingBeats.join(", ")} — running salvage matcher`);
  const salvage = await agent(
    matchPrompt + "\n\nNOTE: a previous matching attempt failed to cover all beats. Ensure you return ranked candidates for every one of the seven beats, especially: " + missingBeats.join(", ") + ".",
    {label: "match-salvage", phase: "Match beats", schema: matchSchema}
  );
  if (salvage && Array.isArray(salvage.beats)) {
    for (const b of salvage.beats) {
      if (b && b.beat && Array.isArray(b.ranked)) {
        const list = b.ranked.filter(r => r && r.clip && ALL_CLIPS.includes(r.clip));
        if (list.length && (!rankedByBeat[b.beat] || rankedByBeat[b.beat].length === 0)) rankedByBeat[b.beat] = list;
      }
    }
  }
}
const stillMissing = ORDER.filter(b => !rankedByBeat[b] || rankedByBeat[b].length === 0);
if (stillMissing.length) {
  return {
    status: "unresolved",
    reason: "Beat matching could not produce candidates for: " + stillMissing.join(", "),
    describedClips: describedIds,
    missingClipDescriptions: missingIds
  };
}
log("Beat matching complete for all 7 beats");

// ---------------------------------------------------------------- phase 4: per-beat verification

phase("Verify beats");

const verifyPrompt = (beat, top, runnerUp, descOf) =>
  "You are a verification worker for task CDC-A-X08 (see instruction.md). Your beat:\n\n" + beatSpecText(beat) + "\n\n" +
  "The current top candidate is clip " + top + " (input/" + top + ".mp4), with runner-up clip " + runnerUp + " (input/" + runnerUp + ".mp4).\n" +
  "Screening notes said of " + top + ": " + JSON.stringify(descOf(top)) + "\n" +
  "Screening notes said of " + runnerUp + ": " + JSON.stringify(descOf(runnerUp)) + "\n\n" +
  "Your job: independently and rigorously check whether clip " + top + " truly matches ALL FIVE beat fields (description/content, shot_size, camera_angle, lens_size, camera_movement) over the WHOLE clip, and how the most-similar other candidate " + runnerUp + " concretely differs from it.\n" +
  "Method (do this yourself, do not trust the screening notes):\n" +
  "1. Extract dense frame samples from both clips, e.g. `ffmpeg -i input/" + top + ".mp4 -vf fps=3,scale=960:-1 work/verify/" + beat + "_" + top + "_f_%03d.jpg` (same for the runner-up), and inspect the frames.\n" +
  "2. Quantify camera movement in both clips with Python 3.11 + OpenCV dense optical flow (Farneback) or good-feature tracking: global translation per frame, zoom/expansion, lateral direction, and whether motion is continuous, settling to a stop, or essentially static. Check start vs end framing (shot size change, angle change, subject growth).\n" +
  "3. Check content details named in the beat: e.g. water-surface glints at top of frame, plate/table coral positions, pale cracked limestone, sea urchin growing, butterflyfish entering foreground near the end, surgeonfish with black bars and defocused near-fish masses, dark fish crossing mid-clip, overhang shadow revealing yellow and red fish, whitetip sharks with lateral leftward tracking and rubble at the end, locked-off stillness for A4.\n" +
  "4. If your check shows the runner-up (or any other clip you have reason to inspect) fits the beat BETTER than " + top + ", choose that clip instead and name it in `chosen` — you are not obligated to keep the proposed top candidate.\n\n" +
  "Return: beat (\"" + beat + "\"), chosen (the clip id \"NN\" you conclude is the best match), runner_up (the id of the most similar OTHER candidate you compared against), confirmed (true if you are confident chosen matches all five fields), reason (a CONCRETE visible difference between the chosen clip and the runner_up — this will be published as selection evidence, so name specific on-screen features and motion differences, not generic statements), concerns (any remaining uncertainty).";

const descOf = (id) => descriptions.find(d => d.clip === id) || {summary: "no screening description available"};

const verifyTasks = ORDER.map(beat => {
  const ranked = rankedByBeat[beat];
  const top = ranked[0].clip;
  const runnerUp = ranked[1] ? ranked[1].clip : ranked.filter(r => r.clip !== top)[0]?.clip || ALL_CLIPS.filter(c => c !== top)[0];
  return {beat, top, runnerUp};
});

const verifyResults = await parallel(verifyTasks.map(t => () =>
  agent(verifyPrompt(t.beat, t.top, t.runnerUp, descOf), {label: `verify-${t.beat}`, phase: "Verify beats", schema: verifySchema})
));

const verifies = [];
const verifyGaps = [];
verifyResults.forEach((res, i) => {
  if (res && res.beat && res.chosen && ALL_CLIPS.includes(res.chosen)) verifies.push(res);
  else verifyGaps.push(verifyTasks[i]);
});
if (verifyGaps.length) {
  log(`Verification failed for: ${verifyGaps.map(g => g.beat).join(", ")} — retrying`);
  const retriedVerify = await parallel(verifyGaps.map(t => () =>
    agent(verifyPrompt(t.beat, t.top, t.runnerUp, descOf) + "\n\nNOTE: a previous verification attempt for this beat failed; complete the check and return the structured result.",
      {label: `verify-retry-${t.beat}`, phase: "Verify beats", schema: verifySchema})
  ));
  retriedVerify.forEach(res => { if (res && res.beat && res.chosen && ALL_CLIPS.includes(res.chosen)) verifies.push(res); });
}

const verifiedByBeat = {};
for (const v of verifies) if (!verifiedByBeat[v.beat]) verifiedByBeat[v.beat] = v;
const unverifiedBeats = ORDER.filter(b => !verifiedByBeat[b]);
if (unverifiedBeats.length) {
  // Fall back to matcher's top pick for unverified beats, flagged as unverified.
  for (const b of unverifiedBeats) {
    const ranked = rankedByBeat[b];
    verifiedByBeat[b] = {
      beat: b, chosen: ranked[0].clip,
      runner_up: ranked[1] ? ranked[1].clip : "??",
      confirmed: false,
      reason: "UNVERIFIED (verification worker failed): matcher fit note — " + (ranked[0].fit || ""),
      concerns: "no independent verification was performed for this beat"
    };
  }
}
log(`Verification complete: ${verifies.length}/7 beats independently verified`);

// ---------------------------------------------------------------- phase 5: final selection

phase("Finalize selection");

const conflict = ORDER.filter(b => verifiedByBeat[b]).map(b => verifiedByBeat[b].chosen)
  .some((c, i, arr) => arr.indexOf(c) !== i);

const selectionPrompt =
  "You are the final-selection arbiter for task CDC-A-X08 (see instruction.md). Seven beats must each get exactly one DIFFERENT clip:\n\n" + ALL_BEAT_SPECS + "\n\n" +
  "Per-beat verification results (each `chosen` was checked against its `runner_up`; `reason` records the concrete visible difference):\n\n" +
  JSON.stringify(ORDER.map(b => verifiedByBeat[b])) + "\n\n" +
  "Full screening descriptions of all candidates:\n\n" + descriptionsJson + "\n\n" +
  (conflict ? "IMPORTANT: the same clip was chosen for more than one beat — you MUST resolve this conflict. Use each verifier's runner_up or re-inspect clips yourself (input/NN.mp4, work/frames/, work/motion/, work/verify/) to find the best distinct assignment. Prefer keeping confirmed verifications; when un-assigning a clip from a beat, substitute that beat's runner_up only if it genuinely fits, otherwise inspect other candidates yourself.\n" : "") +
  "Produce the FINAL assignment: one object per beat in order A1, B1, A2, B2, A3, B3, A4 with: beat, source (clip id \"NN\"), runner_up (the most similar other candidate for that beat), reason (a concrete visible difference between source and runner_up — specific on-screen content and camera-motion differences; this is published as human-reviewed evidence, so it must be verifiable by looking at the two clips). " +
  "Rules: the seven sources must be seven DIFFERENT clip ids; each source must genuinely match all five fields of its beat; if you change any assignment away from a verified choice, re-check the replacement clip yourself (frames + optical flow) before committing. If you are not confident about a beat, inspect the clips directly — do not guess.";

let selection = null;
for (let attempt = 0; attempt < 3 && !selection; attempt++) {
  const s = await agent(
    selectionPrompt + (attempt > 0 ? "\n\nNOTE: your previous answer was invalid (wrong beats, duplicate sources, or missing fields). Fix it and return a valid selection of exactly seven distinct clips, one per beat A1,B1,A2,B2,A3,B3,A4." : ""),
    {label: `final-selection${attempt ? "-retry" + attempt : ""}`, phase: "Finalize selection", schema: selectionSchema}
  );
  if (!s || !Array.isArray(s.selection)) continue;
  const sel = s.selection.filter(x => x && ORDER.includes(x.beat) && ALL_CLIPS.includes(x.source));
  const beatsOk = ORDER.every(b => sel.filter(x => x.beat === b).length === 1);
  const sources = ORDER.map(b => sel.find(x => x.beat === b)?.source);
  const distinct = new Set(sources.filter(Boolean)).size === 7;
  if (beatsOk && distinct && sel.length === 7) selection = s;
}

if (!selection) {
  return {
    status: "unresolved",
    reason: "Could not finalize a conflict-free selection of seven distinct clips",
    verifications: ORDER.map(b => verifiedByBeat[b]),
    describedClips: describedIds
  };
}

const finalSel = ORDER.map(b => selection.selection.find(x => x.beat === b));
log(`Final selection: ${finalSel.map(x => x.beat + "=" + x.source).join(", ")}`);

// ---------------------------------------------------------------- phase 6: assembly

phase("Assemble output");

const intercutPlan = ORDER.map(b => {
  const x = finalSel.find(y => y.beat === b);
  return {beat: b, thread: BEATS[b].thread, source: x.source, reason: x.reason, runner_up: x.runner_up};
});
const expectedFrames = intercutPlan.map(p => (probeByClip[p.source] && probeByClip[p.source].frame_count) || null);
const expectedTotal = expectedFrames.every(f => typeof f === "number") ? expectedFrames.reduce((a, b) => a + b, 0) : null;

const assemblyPrompt =
  "You are the assembly worker for task CDC-A-X08 (see instruction.md). Finalize the deliverables in output/.\n\n" +
  "Final selection (output order is exactly this intercut order — thread A opens and closes, strict A/B alternation):\n" +
  intercutPlan.map(p => `${p.beat} (thread ${p.thread}): input/${p.source}.mp4`).join("\n") + "\n\n" +
  (probeSummary ? "Probe data (frame counts etc.):\n" + probeSummary + "\n\n" : "") +
  "Requirements:\n" +
  "1. output/solution.mp4: the seven complete clips joined by hard cuts, each used once, complete, 1x speed, original direction, no crop/mirror/filter/text/transitions/generated content, no added or dropped frames. H.264/yuv420p, 1280x720, SAR 1:1, 30/1 fps, no audio. Preferred: lossless concat — first verify all seven inputs share codec parameters (ffprobe), then `printf \"file 'input/NN.mp4'\\n\" ... > work/concat.txt` (absolute or correctly relative paths, -safe 0) and `ffmpeg -f concat -safe 0 -i work/concat.txt -c copy -an output/solution.mp4`. If -c copy yields wrong parameters or A/V sync/timebase issues, fall back to a CRF<=18 re-encode (`ffmpeg -f concat ... -c:v libx264 -crf 18 -pix_fmt yuv420p -an -r 30000/1001` is NOT acceptable — keep exactly 30/1 fps; use `-r 30` only if needed and verify no frame duplication). Verify with `ffprobe -count_frames` that the decoded frame count of output/solution.mp4 equals the SUM of the seven source decoded frame counts exactly.\n" +
  "2. output/solution.json: `{\"segments\":[...]}` with exactly seven objects in output order. Each: thread (\"A\"|\"B\"), beat (\"A1\"..\"B3\"), source (\"NN\"), output:[start,end], source_range:[0,duration], output_frames:[first,last_exclusive], source_frames:[0,frame_count]. Half-open seconds, contiguous from frame 0, no gaps/overlaps; seconds equal frames/30 within 0.001 s; the final end must equal the decoded frame count of solution.mp4 divided by 30. Use the exact per-clip decoded frame counts from the probe (re-count with ffprobe -count_frames yourself if unsure).\n" +
  "3. output/selection-evidence.json: an array of seven objects {beat, source, source_frames:[a,b], reason} in output order, where b-a >= 12 and both a and b are inside the clip (e.g. [0, frame_count] of that clip is fine if frame_count >= 12). The reason must name a concrete visible difference between the chosen clip and its most similar other candidate. Use these verified reasons:\n" +
  intercutPlan.map(p => `${p.beat} / source ${p.source} / runner-up ${p.runner_up}: ${p.reason}`).join("\n") + "\n\n" +
  "4. output/ must contain EXACTLY these three files — remove anything else from output/. Do not modify input/.\n" +
  "Work carefully with Python (json module) to generate the two JSON files so they are valid JSON. After writing, self-check: re-read the JSONs, re-probe the mp4, confirm frame arithmetic (cumulative frames, seconds=frames/30, final end = total frames/30), confirm the mp4 has no audio stream and correct codec/resolution/fps/SAR. " +
  "Return: ok, total_frames (decoded frame count of solution.mp4), method (\"copy-concat\" or \"reencode\" with details), files (the three output paths), issues (any problems you could not fully resolve — empty array if none).";

const assembly = await agent(assemblyPrompt, {label: "assemble-output", phase: "Assemble output", schema: assemblySchema});

if (!assembly || !assembly.ok) {
  return {
    status: "unresolved",
    reason: "Assembly worker failed or reported ok=false",
    assembly: assembly || null,
    selection: intercutPlan
  };
}
log(`Assembly done: ${assembly.method}, ${assembly.total_frames} frames; issues: ${JSON.stringify(assembly.issues)}`);

// ---------------------------------------------------------------- phase 7: verify and repair

phase("Verify and repair");

const checkPrompt =
  "You are an independent verification worker for task CDC-A-X08 (see instruction.md). The deliverables have been written to output/ (solution.mp4, solution.json, selection-evidence.json). Verify EVERYTHING yourself from scratch, without trusting the assembly worker:\n" +
  "1. output/ contains exactly the three required files and nothing else.\n" +
  "2. solution.mp4: ffprobe confirms H.264, yuv420p, 1280x720, SAR 1:1, exactly 30/1 fps, no audio stream; `ffprobe -count_frames` decoded frame count N.\n" +
  "3. solution.json: valid JSON, {\"segments\":[...]} with exactly 7 objects; thread/beat values form the order A1,B1,A2,B2,A3,B3,A4 with threads A,B,A,B,A,B,A; source values are 7 DISTINCT clip ids; output ranges are contiguous half-open seconds starting at 0 with no gaps/overlaps; seconds equal frames/30 within 0.001 s; source_frames are [0, frame_count] matching the actual decoded frame counts of the named input clips (recount with ffprobe -count_frames); output_frames are contiguous from 0 and the final end equals N (frames) and N/30 (seconds).\n" +
  "4. Frame-accurate content check: decode the first, middle and last frames of each segment from solution.mp4 (e.g. with ffmpeg select filters or Python/OpenCV seeking to exact frame indices) and confirm each matches the corresponding input clip at the same frame index (compare with the input clip's frames at those indices; near-identical if copy-concat, visually identical content if re-encoded). Also confirm no frames were dropped, duplicated, mirrored, cropped or re-timed at segment boundaries.\n" +
  "5. selection-evidence.json: valid JSON array of exactly 7 objects in output order; each has beat, source (matching solution.json), source_frames [a,b] with b-a >= 12 and both inside that clip's frame range, and a reason that names a concrete visible difference versus another candidate (not generic filler).\n" +
  "Report passed=true only if ALL checks pass. Otherwise passed=false with specific, actionable issues (name the file, the field, the expected vs actual value). Do not fix anything yourself — only report.";

const check = () => agent(checkPrompt, {label: "verify-deliverables", phase: "Verify and repair", schema: verdictSchema});

let verdict = await check();
let repairNotes = [];
for (let round = 0; verdict && !verdict.passed && verdict.issues && verdict.issues.length && round < maxRepairs; round++) {
  log(`Check failed (round ${round + 1}): ${JSON.stringify(verdict.issues)} — repairing`);
  const repair = await agent(
    "You are the repair worker for task CDC-A-X08 (see instruction.md). The deliverables in output/ failed verification. Issues reported by the independent checker:\n" +
    JSON.stringify(verdict.issues) + "\n\n" +
    "Fix the deliverables so they fully satisfy the task contract. Context: the intended intercut order is A1,B1,A2,B2,A3,B3,A4 using these clips:\n" +
    intercutPlan.map(p => `${p.beat}: input/${p.source}.mp4`).join("\n") + "\n\n" +
    "Rules from the contract: seven complete clips, hard cuts, 1x speed, original direction, no crop/mirror/filter/text/transitions, H.264/yuv420p 1280x720 SAR 1:1 exactly 30/1 fps, no audio; solution.json segments contiguous from frame 0 with seconds=frames/30 within 0.001 s and final end equal to the decoded frame count of solution.mp4; selection-evidence.json with 7 objects whose source_frames have b-a>=12 inside the clip; output/ contains exactly the three files. " +
    "If a JSON is wrong, rewrite it with Python's json module. If the mp4 is wrong, rebuild it (prefer lossless concat; CRF<=18 re-encode with EXACTLY 30/1 fps is acceptable). If the checker found a content/frame mismatch, investigate the actual files before changing anything. Re-verify your fix yourself before finishing. Return a short summary of what you fixed.",
    {label: `repair-${round + 1}`, phase: "Verify and repair"}
  );
  repairNotes.push({round: round + 1, summary: repair, issues: verdict.issues});
  verdict = await check();
}

const finalStatus = verdict && verdict.passed ? "verified" : "unresolved";

return {
  status: finalStatus,
  selection: intercutPlan.map(p => ({beat: p.beat, source: p.source, runner_up: p.runner_up})),
  assembly: {method: assembly.method, total_frames: assembly.total_frames, issues: assembly.issues},
  verification: verdict,
  repairs: repairNotes,
  process: {
    clipsDescribed: describedIds.length,
    clipsNeverDescribed: missingIds,
    beatsIndependentlyVerified: verifies.map(v => v.beat),
    beatsUnverified: unverifiedBeats,
    duplicateConflictResolved: conflict
  }
};