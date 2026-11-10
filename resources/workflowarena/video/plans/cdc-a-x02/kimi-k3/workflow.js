export const meta = {
  name: "cdc-a-x02-mourning-sequence",
  description: "Identify 6 of 42 anonymous clips matching the ordered slot list, assemble sequence.mp4 with the slot5->slot6 J-cut, and emit edl.json plus selection-evidence.json.",
  phases: [
    {title: "probe", detail: "ffprobe all 42 candidates for exact frame counts and stream specs"},
    {title: "describe", detail: "parallel visual content analysis of candidate batches via extracted thumbnails"},
    {title: "match", detail: "map slot requirements to candidate descriptions"},
    {title: "confirm", detail: "per-slot dense re-inspection of chosen clip vs closest alternatives"},
    {title: "evidence", detail: "write selection-evidence.json with concrete visual differences"},
    {title: "assemble", detail: "compute EDL deterministically; worker renders sequence.mp4 with J-cut"},
    {title: "verify", detail: "validate container, EDL math, frame-level content, J-cut boundary; bounded repair loop"}
  ]
};

const MAX_REPAIRS = (typeof args.maxRepairs === "number" && args.maxRepairs >= 0) ? args.maxRepairs : 3;
const BATCH = 6;

const SLOT_SPECS = [
  {
    slot: 1,
    narrative: "the starting point of grief; the character is sunk in loss",
    content: "Single shot. A close shot of a young red-haired woman against a background of tangled tree roots. At the start her head is bowed and her hair hides her face. She slowly lifts her face. Her gaze first falls downward, then turns to screen right and stays there until the clip ends.",
    shotSize: "close shot (head and shoulders)",
    angle: "front three-quarter, slightly above eye level",
    camera: "locked off; all change in frame comes from the character"
  },
  {
    slot: 2,
    narrative: "memory, the warmth of meeting",
    content: "Low angle: a small winged creature stands on a wooden beam, opens its wings, then folds them. Cut to a smiling close shot of the woman against a bright timber-roof background. Cut back to the creature crouched quietly on the beam while a flock of birds crosses the sky. The clip stays on this image.",
    shotSize: "medium on the creature, close on the woman",
    angle: "low angle on the creature, eye level on the woman",
    camera: "locked off"
  },
  {
    slot: 3,
    narrative: "memory, the peak of joy",
    content: "High ground at sunset. The woman starts walking from beside a stone pillar toward the camera. Once she is close, she cups her hands around her mouth and calls out. Cut to a run of hard-backlit images: her silhouette, with small flying dragons circling around her. The clip ends inside the backlit images.",
    shotSize: "full shot, walking into a medium close-up; backlit images are full and medium shots",
    angle: "eye level or slightly below",
    camera: "calling shot locked off; in the backlit images the camera moves with her"
  },
  {
    slot: 4,
    narrative: "memory, the loss",
    content: "A small winged creature glides alone in a pink-orange sky. A huge dragon's head dives into frame from the top. Cut to a wider image: the dragon sweeps over the rooftops. Over the woman's back: she reaches out, the dragon's claws seize the small creature, then her horrified face. Cut to the small creature being carried off in the dragon's grip, with the woman's open hand in the foreground reaching after it. The clip ends on this foreground-hand image.",
    shotSize: "medium in the sky, long shot over the roofs, over-the-shoulder medium, foreground hand close shot",
    angle: "mostly low angle, including an over-the-shoulder view",
    camera: "pans and tracks that follow the flyers; fast pacing"
  },
  {
    slot: 5,
    narrative: "back to the present, the stillness of grief",
    content: "Single shot. An extreme long shot of a barren high cliff. The woman sits alone at the edge, small in frame, with misty mountains behind her. The clip stays on this image throughout.",
    shotSize: "extreme long shot",
    angle: "eye level, side-on",
    camera: "locked off, with almost no movement in frame"
  },
  {
    slot: 6,
    narrative: "release and departure (J-cut entry)",
    content: "Single shot. Ground-level low camera, with white snowdrop flowers in the right foreground. At the start the frame holds only the foreground flowers and the small figure of the woman walking away in the distance. Midway through the clip, a small winged creature flies in low from the left, lands, pauses for a moment, then turns its back to the camera and crawls away into the distance. The clip ends while it is still crawling away.",
    shotSize: "long shot, with foreground flowers in close shot",
    angle: "ground-level low angle",
    camera: "locked off"
  }
];

const slotSpecText = SLOT_SPECS.map(s =>
  "SLOT " + s.slot + "\n  Narrative: " + s.narrative + "\n  Content: " + s.content +
  "\n  Shot size: " + s.shotSize + "\n  Angle: " + s.angle + "\n  Camera: " + s.camera
).join("\n\n");

const COMMON_CONTEXT =
  "Task context (from instruction.md, which you should also read): the directory input/ holds 42 anonymous candidate clips " +
  "(input/01.mp4 .. input/42.mp4), excerpts from one licensed open animated film, H.264 1280x544 SAR 1:1, 24 fps CFR, " +
  "AAC stereo 48 kHz, 6-12 s each. Numbering is random and carries no story order. The film features a young red-haired " +
  "woman and a small winged creature. We must pick one distinct clip per slot for a 6-slot mourning sequence and assemble it. " +
  "Put drafts/intermediates in work/ and only the three final deliverables in output/. Environment: Python 3.11, FFmpeg/ffprobe, no network, no GPU.\n\n";

// ---------- Phase 1: probe ----------
phase("probe");
log("Probing all 42 candidate clips for exact frame counts and stream specs.");

const probeSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string", description: "two-digit clip id, e.g. \"07\""},
          frames: {type: "integer", description: "exact decoded video frame count (nb_frames, verified)"},
          durationSec: {type: "number"},
          width: {type: "integer"},
          height: {type: "integer"},
          fps: {type: "string"},
          audio: {type: "boolean"}
        },
        required: ["id", "frames", "durationSec", "width", "height", "fps", "audio"],
        additionalProperties: false
      }
    },
    notes: {type: "string"}
  },
  required: ["clips", "notes"],
  additionalProperties: false
};

const probe = await agent(
  COMMON_CONTEXT +
  "STEP: Probe every clip input/01.mp4 .. input/42.mp4 with ffprobe. For each, report the EXACT video frame count " +
  "(use ffprobe -select_streams v:0 -count_frames -show_entries stream=nb_read_frames, or an equivalent reliable method; " +
  "do not trust container nb_frames alone if it disagrees with counted frames - report the counted value), duration in seconds, " +
  "width, height, frame rate, and whether it has an audio stream. Also sanity-check that every clip is 1280x544, SAR 1:1, 24/1 fps, " +
  "AAC 48 kHz stereo, and report any deviation in notes. Return the structured result.",
  {label: "probe-all", phase: "probe", schema: probeSchema}
);

if (probe === null || !Array.isArray(probe.clips) || probe.clips.length !== 42) {
  return {status: "unresolved", reason: "Probe stage failed or returned incomplete data", probe};
}
const framesOf = {};
for (const c of probe.clips) framesOf[c.id] = c.frames;
log("Probed 42 clips. Frame counts: " + JSON.stringify(framesOf));

// ---------- Phase 2: describe (parallel batches) ----------
phase("describe");
const ids = [];
for (let i = 1; i <= 42; i++) ids.push(String(i).padStart(2, "0"));
const batches = [];
for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));

const describeSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          shotCount: {type: "integer", description: "number of distinct shots (internal cuts) in the clip"},
          description: {type: "string", description: "detailed chronological visual description, beat by beat"},
          characters: {type: "string", description: "who/what appears (woman, small winged creature, large dragon, etc.) and what they do"},
          setting: {type: "string", description: "location, background elements, time of day, palette"},
          shotSizes: {type: "string", description: "shot size(s) used, e.g. close, medium, full, long, extreme long"},
          angle: {type: "string", description: "camera height/angle, e.g. low angle, eye level, high"},
          camera: {type: "string", description: "locked off vs pans/tracks/handheld; describe any movement"},
          motion: {type: "string", description: "key character/creature motion across the clip"},
          ending: {type: "string", description: "what the final image of the clip is"},
          distinctive: {type: "string", description: "distinctive visual details that distinguish this clip from similar ones"}
        },
        required: ["id", "shotCount", "description", "characters", "setting", "shotSizes", "angle", "camera", "motion", "ending", "distinctive"],
        additionalProperties: false
      }
    }
  },
  required: ["clips"],
  additionalProperties: false
};

log("Describing 42 clips in " + batches.length + " parallel batches.");
const describeResults = await parallel(batches.map((batch, bi) => () => agent(
  COMMON_CONTEXT +
  "STEP: Visually analyze these candidate clips: " + batch.map(b => "input/" + b + ".mp4").join(", ") + ".\n" +
  "Known frame counts: " + batch.map(b => b + "=" + framesOf[b] + " frames").join(", ") + ".\n" +
  "Method: for EACH clip, use ffmpeg to extract a grid of thumbnails into work/thumbs/<id>/ " +
  "(e.g. 10-16 frames evenly spaced across the whole clip: fps-based or select filters; PNG, full 1280x544), " +
  "plus 2-3 extra frames near the very start and very end. Then VIEW the thumbnails and describe what you actually see. " +
  "If a clip seems to contain internal cuts, sample more densely around the transitions so you can describe every shot.\n" +
  "For each clip report all schema fields precisely: number of internal shots, chronological content, characters, setting, " +
  "shot sizes, angle, camera movement, motion, the exact final image, and distinctive details.\n" +
  "Be concrete and factual: mention things like tree roots, wooden beams, timber roofs, stone pillars, sunset, pink-orange sky, " +
  "rooftops, cliffs, misty mountains, snow/flowers, hair color, winged creature size, large dragon, only if actually visible. " +
  "Do NOT guess which slot a clip belongs to; just describe it.",
  {label: "describe-" + bi, phase: "describe", schema: describeSchema}
)));

const descriptions = [];
const describeMissing = [];
describeResults.forEach((r, bi) => {
  if (r && Array.isArray(r.clips)) descriptions.push(...r.clips);
  else describeMissing.push(batches[bi].join(","));
});
if (describeMissing.length > 0) {
  log("Re-running failed describe batches: " + describeMissing.join(" | "));
  for (const group of describeMissing) {
    const batch = group.split(",");
    const retry = await agent(
      COMMON_CONTEXT +
      "STEP: Visually analyze these candidate clips: " + batch.map(b => "input/" + b + ".mp4").join(", ") + ".\n" +
      "Known frame counts: " + batch.map(b => b + "=" + framesOf[b] + " frames").join(", ") + ".\n" +
      "Method: extract 10-16 evenly spaced thumbnails per clip (PNG, full size) into work/thumbs/<id>/, plus frames near start/end, " +
      "VIEW them, and describe each clip per the schema. Be concrete and factual. Do not guess slot identities.",
      {label: "describe-retry-" + batch[0], phase: "describe", schema: describeSchema}
    );
    if (retry && Array.isArray(retry.clips)) descriptions.push(...retry.clips);
  }
}
if (descriptions.length !== 42) {
  return {status: "unresolved", reason: "Could not obtain descriptions for all 42 clips", got: descriptions.length, descriptions};
}
log("Collected descriptions for all 42 clips.");

// ---------- Phase 3: match ----------
phase("match");
const matchSchema = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: {type: "integer"},
          source: {type: "string", description: "two-digit clip id"},
          confidence: {type: "string", enum: ["high", "medium", "low"]},
          reasoning: {type: "string", description: "how the clip description matches EVERY field of the slot"},
          mostSimilarOther: {type: "string", description: "id of the runner-up candidate that is most similar for this slot"},
          alternatives: {type: "array", items: {type: "string"}, description: "up to 3 other plausible candidate ids, best first"}
        },
        required: ["slot", "source", "confidence", "reasoning", "mostSimilarOther", "alternatives"],
        additionalProperties: false
      }
    },
    globalNotes: {type: "string"}
  },
  required: ["assignments", "globalNotes"],
  additionalProperties: false
};

const descDigest = descriptions
  .slice()
  .sort((a, b) => a.id.localeCompare(b.id))
  .map(d => "CLIP " + d.id + " (" + framesOf[d.id] + " frames, " + d.shotCount + " shot(s))\n" +
    "  content: " + d.description + "\n  characters: " + d.characters + "\n  setting: " + d.setting +
    "\n  shot sizes: " + d.shotSizes + "\n  angle: " + d.angle + "\n  camera: " + d.camera +
    "\n  motion: " + d.motion + "\n  ending: " + d.ending + "\n  distinctive: " + d.distinctive)
  .join("\n\n");

const match = await agent(
  COMMON_CONTEXT +
  "STEP: You are given visual descriptions of all 42 candidate clips and 6 ordered slot specifications. " +
  "Choose exactly one DISTINCT clip per slot. Each chosen clip must match EVERY field of its slot: content beats, " +
  "shot size, angle, and camera behavior. The six choices must all be different clips.\n\n" +
  "SLOT SPECIFICATIONS (fixed order):\n" + slotSpecText + "\n\n" +
  "CANDIDATE DESCRIPTIONS:\n" + descDigest + "\n\n" +
  "For each slot give your chosen source id, confidence, reasoning that checks the choice against every slot field, " +
  "the single most similar other candidate, and up to 3 alternatives. If no candidate fits a slot well, pick the closest " +
  "and say so explicitly in reasoning.",
  {label: "match-slots", phase: "match", schema: matchSchema}
);

if (match === null || !Array.isArray(match.assignments) || match.assignments.length !== 6) {
  return {status: "unresolved", reason: "Matching stage failed", match};
}
match.assignments.sort((a, b) => a.slot - b.slot);
log("Tentative assignment: " + match.assignments.map(a => "slot" + a.slot + "=clip" + a.source).join(", "));

// ---------- Phase 4: per-slot confirmation (parallel) ----------
phase("confirm");
const confirmSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    finalSource: {type: "string"},
    changed: {type: "boolean"},
    confidence: {type: "string", enum: ["high", "medium", "low"]},
    fieldCheck: {type: "string", description: "explicit confirmation of content, shot size, angle, camera against the slot spec, based on viewed frames"},
    mostSimilarOther: {type: "string"},
    concreteDifference: {type: "string", description: "one concrete visible difference between the final choice and the most similar other candidate"},
    evidenceFrames: {
      type: "array",
      items: {type: "integer"},
      description: "two source frame numbers [a,b) inside the chosen clip (b-a>=12) that best show the matching content"
    }
  },
  required: ["slot", "finalSource", "changed", "confidence", "fieldCheck", "mostSimilarOther", "concreteDifference", "evidenceFrames"],
  additionalProperties: false
};

const confirms = await parallel(match.assignments.map(a => () => {
  const slotSpec = SLOT_SPECS[a.slot - 1];
  const candidateIds = [...new Set([a.source, a.mostSimilarOther, ...(a.alternatives || [])])].filter(Boolean);
  return agent(
    COMMON_CONTEXT +
    "STEP: Confirm or correct the candidate choice for slot " + a.slot + " of a 6-slot mourning sequence.\n\n" +
    "SLOT " + a.slot + " SPECIFICATION:\n  Narrative: " + slotSpec.narrative + "\n  Content: " + slotSpec.content +
    "\n  Shot size: " + slotSpec.shotSize + "\n  Angle: " + slotSpec.angle + "\n  Camera: " + slotSpec.camera + "\n\n" +
    "Tentative choice: clip " + a.source + " (reasoning from earlier stage: " + a.reasoning + ")\n" +
    "Candidates to inspect: " + candidateIds.map(c => "input/" + c + ".mp4 (" + framesOf[c] + " frames)").join(", ") + ".\n\n" +
    "Method: for EACH listed candidate extract dense thumbnails (at least every ~12 frames, i.e. 2 per second, full 1280x544 PNG) " +
    "into work/confirm/slot" + a.slot + "/<id>/ and VIEW them carefully. Verify every field of the slot spec against what you see: " +
    "the exact content beats and their order, the shot size, the camera angle, and the camera movement (or locked-off stillness). " +
    "Pay special attention to the first and last images of each clip, since slot specs pin them down.\n" +
    "Then decide: keep clip " + a.source + " or switch to one of the other inspected candidates if it matches the spec better. " +
    "Report the final source id, whether you changed it, your confidence, an explicit per-field check, the most similar other " +
    "candidate, ONE concrete visible difference between your final choice and that most similar other (something a human reviewer " +
    "could verify in the frames, e.g. a specific background element, color, action, or composition difference), and a source frame " +
    "interval [a,b) inside the chosen clip (0-based, half-open, b-a>=12, b <= " + "frame count) that shows the matching content.",
    {label: "confirm-slot-" + a.slot, phase: "confirm", schema: confirmSchema}
  );
}));

const confirmed = [];
const confirmFailed = [];
confirms.forEach((c, i) => {
  if (c && typeof c.finalSource === "string") confirmed.push(c);
  else confirmFailed.push(match.assignments[i]);
});
for (const a of confirmFailed) {
  log("Confirmation failed for slot " + a.slot + "; keeping tentative choice clip " + a.source);
  confirmed.push({
    slot: a.slot, finalSource: a.source, changed: false, confidence: "low",
    fieldCheck: "confirmation worker failed; tentative choice retained",
    mostSimilarOther: a.mostSimilarOther, concreteDifference: "",
    evidenceFrames: [0, Math.min(24, framesOf[a.source])]
  });
}
confirmed.sort((a, b) => a.slot - b.slot);

// Resolve duplicate sources if confirmation created any.
let sources = confirmed.map(c => c.finalSource);
const dupes = sources.filter((s, i) => sources.indexOf(s) !== i);
if (dupes.length > 0) {
  log("Duplicate sources after confirmation: " + JSON.stringify(dupes) + "; reconciling.");
  const reconcileSchema = {
    type: "object",
    properties: {
      final: {
        type: "array",
        items: {
          type: "object",
          properties: {slot: {type: "integer"}, source: {type: "string"}},
          required: ["slot", "source"],
          additionalProperties: false
        }
      },
      notes: {type: "string"}
    },
    required: ["final", "notes"],
    additionalProperties: false
  };
  const recon = await agent(
    COMMON_CONTEXT +
    "STEP: Two or more slots were assigned the same clip. Current per-slot confirmation results:\n" +
    JSON.stringify(confirmed, null, 1) + "\n\nTentative alternatives from the matching stage:\n" +
    JSON.stringify(match.assignments.map(a => ({slot: a.slot, source: a.source, alternatives: a.alternatives, mostSimilarOther: a.mostSimilarOther})), null, 1) +
    "\n\nSLOT SPECIFICATIONS:\n" + slotSpecText +
    "\n\nProduce a final assignment of 6 DISTINCT clip ids, one per slot, honoring the confirmations where possible and using the " +
    "listed alternatives where needed. If you are unsure between two candidates for a slot, extract and view dense thumbnails of " +
    "both clips before deciding. Every final (slot, source) pair must satisfy its slot spec.",
    {label: "reconcile", phase: "confirm", schema: reconcileSchema}
  );
  if (recon && Array.isArray(recon.final) && recon.final.length === 6) {
    recon.final.sort((a, b) => a.slot - b.slot);
    const newSources = recon.final.map(f => f.source);
    if (new Set(newSources).size === 6 && newSources.every(s => framesOf[s] > 0)) {
      for (const c of confirmed) {
        const f = recon.final.find(x => x.slot === c.slot);
        if (f && f.source !== c.finalSource) {
          c.finalSource = f.source;
          c.changed = true;
          c.concreteDifference = "";
          c.fieldCheck += " [reassigned during duplicate reconciliation]";
        }
      }
      sources = newSources;
    } else {
      return {status: "unresolved", reason: "Reconciliation returned an invalid assignment", recon, confirmed};
    }
  } else {
    return {status: "unresolved", reason: "Duplicate sources and reconciliation failed", confirmed, recon};
  }
}
log("Final selection: " + confirmed.map(c => "slot" + c.slot + "=clip" + c.finalSource).join(", "));

// ---------- Phase 5: selection evidence ----------
phase("evidence");
const evidence = await agent(
  COMMON_CONTEXT +
  "STEP: Write output/selection-evidence.json for the final selection below. The file must be a JSON array of exactly 6 objects " +
  "in slot order, each {\"slot\": <int>, \"source\": \"<two-digit id>\", \"source_frames\": [a, b], \"reason\": \"<string>\"}.\n" +
  "Rules: source_frames is 0-based half-open inside the chosen clip (b <= frame count) with b-a >= 12; pick frames that show the " +
  "slot-matching content. The reason must name ONE concrete visible difference between the chosen clip and the most similar other " +
  "candidate (verifiable in the frames; a human will review this).\n\n" +
  "Final selection and per-slot confirmation notes:\n" + JSON.stringify(confirmed.map(c => ({
    slot: c.slot, source: c.finalSource, frames: framesOf[c.finalSource],
    mostSimilarOther: c.mostSimilarOther, concreteDifference: c.concreteDifference,
    suggestedEvidenceFrames: c.evidenceFrames, fieldCheck: c.fieldCheck
  })), null, 1) +
  "\n\nFor any slot where concreteDifference is empty (e.g. after reconciliation) or weak, extract and view thumbnails of both the " +
  "chosen clip and its most similar other, and determine a real concrete visible difference yourself. Validate the JSON parses and " +
  "meets every rule before finishing. Create output/ if needed. Do not create any other files in output/.",
  {label: "evidence", phase: "evidence"}
);
if (evidence === null) {
  return {status: "unresolved", reason: "Evidence writer failed", confirmed};
}

// ---------- Phase 6: deterministic EDL + assembly ----------
phase("assemble");
const n = confirmed.map(c => framesOf[c.finalSource]);
if (n.some(x => !(x > 48))) {
  return {status: "unresolved", reason: "A selected clip is too short for the J-cut arithmetic", confirmed, frameCounts: n};
}
const segments = [];
{
  let pic = 0, snd = 0;
  for (let i = 0; i < 5; i++) {
    const len = n[i];
    const soundLen = (i === 4) ? len - 24 : len;
    segments.push({
      slot: i + 1,
      source: confirmed[i].finalSource,
      picture: {output_frames: [pic, pic + len], source_frames: [0, len]},
      sound: {output_frames: [snd, snd + soundLen], source_frames: [0, soundLen]}
    });
    pic += len;
    snd += soundLen;
  }
  segments.push({
    slot: 6,
    source: confirmed[5].finalSource,
    picture: {output_frames: [pic, pic + n[5] - 24], source_frames: [24, n[5]]},
    sound: {output_frames: [snd, snd + n[5]], source_frames: [0, n[5]]}
  });
}
const totalFrames = segments[5].picture.output_frames[1];
const soundTotal = segments[5].sound.output_frames[1];
if (soundTotal !== totalFrames) {
  return {status: "unresolved", reason: "Internal EDL arithmetic error: picture and sound totals differ", segments};
}
const edl = {segments};
log("EDL computed. Total output frames: " + totalFrames + " (" + (totalFrames / 24).toFixed(3) + " s).");

const srcList = confirmed.map(c => c.finalSource);
const audioTrimSamplesSlot5 = (n[4] - 24) * 2000; // 48000/24 = 2000 samples per frame, exact
const assemblyPrompt =
  COMMON_CONTEXT +
  "STEP: Assemble the final deliverables output/sequence.mp4 and output/edl.json.\n\n" +
  "Selected sources in slot order: " + srcList.map((s, i) => "slot" + (i + 1) + "=input/" + s + ".mp4 (" + n[i] + " frames)").join(", ") + ".\n\n" +
  "ASSEMBLY CONTRACT:\n" +
  "- Slots 1-5: use each clip IN FULL, picture and sound, 1x speed, original direction, straight cuts, no transitions/fades, " +
  "no cropping/scaling/grading/titles, no added or dropped frames.\n" +
  "- Slot 6 J-cut: slot 6 SOUND plays from candidate frame 0 to end; slot 6 PICTURE plays from candidate frame 24 to end " +
  "(drop its first 24 picture frames). Slot 6's sound therefore starts exactly 24 output frames (1.0 s) before its picture and " +
  "replaces the LAST 24 frames of slot 5's sound. Slot 5's picture stays complete. All other cuts are straight cuts in both " +
  "picture and sound.\n" +
  "- Output specs: H.264 yuv420p, 1280x544, SAR 1:1, constant 24/1 fps; exactly one AAC-LC stereo 48 kHz track; audio and video " +
  "durations equal to within 1 frame; CRF <= 18 re-encode (or lossless concat).\n\n" +
  "Exact expected result (this EDL has already been validated for contiguity; use it verbatim):\n" +
  JSON.stringify(edl, null, 1) + "\nTotal output frames: " + totalFrames + ".\n\n" +
  "SUGGESTED METHOD (you may use another method if it satisfies the contract exactly):\n" +
  "One ffmpeg command with all six inputs and filter_complex:\n" +
  "  video: pass slots 1-5 through (with setpts=PTS-STARTPTS for safety); for slot 6 use " +
  "select='gte(n\\,24)',setpts=PTS-STARTPTS; then concat=n=6:v=1:a=0, format=yuv420p.\n" +
  "  audio: slots 1-4 pass through (asetpts=PTS-STARTPTS); slot 5 use atrim=end_sample=" + audioTrimSamplesSlot5 +
  ",asetpts=PTS-STARTPTS (exactly (N5-24)*2000 samples = (N5-24) frames at 48 kHz); slot 6 pass through in full; " +
  "then concat=n=6:v=0:a=1, aresample=48000:first_pts=0, encode aac (LC) stereo 48 kHz.\n" +
  "  Encode video libx264 crf 17 (<=18), preset medium or slow, -r 24 -vsync cfr, -video_track_timescale 24 if available, " +
  "setsar=1:1, -map the two filter outputs only (exactly one video and one audio stream), faststart optional.\n" +
  "Build intermediates in work/ if you prefer a two-pass segment approach, but every segment must be cut on exact frame/sample " +
  "boundaries and the final file must meet the specs.\n\n" +
  "THEN: write output/edl.json containing EXACTLY the EDL JSON given above (the {\"segments\":[...]} object, verbatim). " +
  "Ensure output/ contains only sequence.mp4, edl.json, and selection-evidence.json (remove anything else you created there). " +
  "Finally run ffprobe on output/sequence.mp4 and report: video codec/pix fmt/size/SAR/fps, counted video frames (must equal " +
  totalFrames + "), audio codec/profile/channels/sample rate, stream count, and video vs audio duration difference in frames. " +
  "Report what you did and the probe results.";

const assembly = await agent(assemblyPrompt, {label: "assemble", phase: "assemble"});
if (assembly === null) {
  return {status: "unresolved", reason: "Assembly worker failed", edl, confirmed};
}

// ---------- Phase 7: verify + bounded repair ----------
phase("verify");
const verdictSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    checks: {
      type: "object",
      properties: {
        outputDirExactlyThreeFiles: {type: "boolean"},
        containerSpecs: {type: "boolean"},
        frameCountMatchesEdl: {type: "boolean"},
        edlSchemaAndContiguity: {type: "boolean"},
        pictureContentMatchesSources: {type: "boolean"},
        audioMatchesSources: {type: "boolean"},
        jcutBoundaryCorrect: {type: "boolean"},
        evidenceFileValid: {type: "boolean"}
      },
      required: ["outputDirExactlyThreeFiles", "containerSpecs", "frameCountMatchesEdl", "edlSchemaAndContiguity",
        "pictureContentMatchesSources", "audioMatchesSources", "jcutBoundaryCorrect", "evidenceFileValid"],
      additionalProperties: false
    }
  },
  required: ["passed", "issues", "checks"],
  additionalProperties: false
};

const verifyPrompt =
  COMMON_CONTEXT +
  "STEP: Independently verify the deliverables in output/ against the task contract. Do NOT trust prior stages; check everything " +
  "yourself with ffprobe/ffmpeg/python. The expected EDL is:\n" + JSON.stringify(edl) +
  "\nSelected sources in slot order: " + srcList.join(", ") + ". Expected total output frames: " + totalFrames + ".\n\n" +
  "CHECKS:\n" +
  "1. output/ contains EXACTLY sequence.mp4, edl.json, selection-evidence.json.\n" +
  "2. sequence.mp4: H.264 yuv420p, 1280x544, SAR 1:1, constant 24/1 fps (r_frame_rate and avg_frame_rate both 24/1), exactly one " +
  "video and one audio stream; audio AAC-LC stereo 48000 Hz; audio and video durations equal within 1 frame.\n" +
  "3. Counted decoded video frames (ffprobe -count_frames) equals the last picture output_frames end value (" + totalFrames + ").\n" +
  "4. edl.json: parses; exactly 6 segment objects in slot order; each has slot, source (two-digit string matching the selection), " +
  "picture{output_frames,source_frames}, sound{output_frames,source_frames}; picture intervals contiguous from 0 with no gaps/" +
  "overlaps; sound intervals contiguous from 0; source intervals within the probed clip lengths " + JSON.stringify(framesOf) +
  "; half-open intervals; last picture end equals the decoded frame count.\n" +
  "5. Picture content: for each of the 6 segments, decode at least the first, middle, and last output frame of the segment " +
  "(ffmpeg select filter on output/sequence.mp4) and the corresponding source frames from the source clip (same source_frames " +
  "offset), and confirm they depict the same content (re-encode is lossy, so compare visually / via SSIM-like metrics, not exact " +
  "hashes). Also confirm cut boundaries: the frame right before each segment boundary belongs to the previous segment's content.\n" +
  "6. Audio content: extract the output audio as PCM (s16le 48 kHz stereo). Reconstruct the EXPECTED audio independently from the " +
  "sources per the EDL (slots 1-4 full; slot 5 only its first (N5-24) frames = " + audioTrimSamplesSlot5 +
  " samples; slot 6 full) and compare against the output audio (sample-exact alignment; allow codec-level noise, e.g. high " +
  "correlation per segment, but the SEGMENT BOUNDARIES must be at the exact sample positions " +
  "implied by the EDL: each frame = 2000 samples).\n" +
  "7. J-cut boundary: verify that at output frame " + segments[4].sound.output_frames[1] + " the audio switches from slot 5 to " +
  "slot 6 content while the picture still shows slot 5 for another 24 frames, and that slot 6's picture starts at output frame " +
  segments[5].picture.output_frames[0] + " showing source frame 24 of clip " + srcList[5] + " (not frame 0).\n" +
  "8. selection-evidence.json: parses; array of 6 objects in slot order with slot, source matching the selection, source_frames " +
  "inside the clip with b-a>=12, and a reason string naming a concrete visible difference.\n\n" +
  "Report pass/fail per check and list every concrete issue found. Be strict; do not fix anything yourself.";

let verdict = await agent(verifyPrompt, {label: "verify-0", phase: "verify", schema: verdictSchema});
let rounds = 0;
while (verdict && !verdict.passed && rounds < MAX_REPAIRS) {
  rounds++;
  log("Verification round " + (rounds - 1) + " found issues; requesting repair: " + JSON.stringify(verdict.issues));
  const repair = await agent(
    COMMON_CONTEXT +
    "STEP: The deliverables in output/ failed verification. Fix ALL of the following issues while keeping every part of the " +
    "assembly contract intact (full clips for slots 1-5 picture, slot 5 sound minus its last 24 frames, slot 6 sound full from " +
    "frame 0, slot 6 picture from frame 24; straight cuts; H.264 yuv420p 1280x544 SAR 1:1 CFR 24; one AAC-LC stereo 48 kHz " +
    "track; CRF<=18; audio/video durations within 1 frame; output/ holds exactly sequence.mp4, edl.json, selection-evidence.json).\n\n" +
    "The authoritative EDL (do not change the selection or the math):\n" + JSON.stringify(edl) +
    "\nTotal output frames: " + totalFrames + ".\n\nISSUES TO FIX:\n" + JSON.stringify(verdict.issues, null, 1) +
    "\n\nIf the video must be rebuilt, rebuild it from input/ sources exactly per the EDL. After fixing, re-probe the outputs and " +
    "report what changed.",
    {label: "repair-" + rounds, phase: "verify"}
  );
  if (repair === null) {
    return {status: "unresolved", reason: "Repair worker failed", round: rounds, verdict, edl, confirmed};
  }
  verdict = await agent(verifyPrompt, {label: "verify-" + rounds, phase: "verify", schema: verdictSchema});
}

if (verdict === null) {
  return {status: "unresolved", reason: "Verification worker failed", edl, confirmed};
}

return {
  status: verdict.passed ? "verified" : "unresolved",
  selection: confirmed.map(c => ({slot: c.slot, source: c.finalSource, confidence: c.confidence, changedDuringConfirmation: c.changed})),
  totalFrames,
  edl,
  finalVerdict: verdict,
  unresolvedIssues: verdict.passed ? [] : verdict.issues
};
