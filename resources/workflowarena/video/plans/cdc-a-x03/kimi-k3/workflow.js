export const meta = {
  name: "cdc-a-x03-confrontation-escape-assembly",
  description: "Select 7 distinct clips from 45 anonymous candidates matching the ordered slot list, enforce 180-degree axis continuity, assemble solution.mp4 plus JSON deliverables, and validate with bounded repair.",
  phases: [
    { title: "Probe", detail: "ffprobe inventory of all 45 clips and frame extraction for visual review" },
    { title: "Analyze", detail: "Parallel structured visual description of every clip" },
    { title: "Match", detail: "Per-slot ranked candidate selection from the merged catalog" },
    { title: "Resolve", detail: "Distinct 7-clip assignment plus independent content/axis verification" },
    { title: "Assemble", detail: "Concat chosen clips and write solution.mp4, solution.json, selection-evidence.json" },
    { title: "Validate", detail: "Independent deliverable verification and bounded repair loop" }
  ]
};

// ---------------------------------------------------------------------------
// Constants and shared context
// ---------------------------------------------------------------------------

const CLIP_COUNT = 45;
const clipIds = Array.from({ length: CLIP_COUNT }, (_, i) => String(i + 1).padStart(2, "0"));

const maxRepairs = (args && typeof args.maxRepairs === "number" && args.maxRepairs >= 0)
  ? Math.floor(args.maxRepairs) : 2;

const TASK_CONTEXT = [
  "You are working on task CDC-A-X03. First read instruction.md in the task directory for the full contract.",
  "Inputs: 45 anonymous silent clips input/01.mp4 ... input/45.mp4 (H.264, 1280x720, SAR 1:1, 24 fps, 6-12 s each).",
  "Clip numbers are random and carry no story order. Several candidates overlap in time or show the same scene in similar pictures.",
  "Two characters run through the sequence: a thin boy and a bald old man in a dark coat.",
  "There is no network. Python 3.11 and FFmpeg/ffprobe are available; no GPU. Put scratch work in work/ and deliverables in output/.",
  "Never guess a clip's identity from memory of any film; judge only from the actual decoded frames you extract and view.",
  "Do not modify anything under input/. Do not create or change files under output/ unless your assignment explicitly says so."
].join("\n");

const SLOT_SPECS = [
  {
    slot: 1,
    title: "Establishing: two people in danger",
    text: "Content: a cold cyan mechanical space; a suspended grated platform runs across the frame, a tall wall of buttons and mist behind it. The thin boy is sprawled and struggling on the platform on FRAME LEFT; the bald old man stands on FRAME RIGHT, bending and looking toward the boy. Shot size: extreme wide, both characters small full figures. Angle: side-on, eye level, platform roughly parallel to the bottom of frame. Camera: a single continuous locked-off shot. This slot establishes the line of action (boy left, old man right) for the whole sequence."
  },
  {
    slot: 2,
    title: "First exchange: shot/reverse shot",
    text: "Content: most of the clip is a profile close-up of the boy against a pale riveted metal wall; he looks up and speaks several lines. Then a cut to a single close-up of the old man, leaning forward and replying. Shot size: close-up against close-up. Angle: two near-eye-level profile / three-quarter singles forming a shot/reverse shot; soft background. Camera: locked off."
  },
  {
    slot: 3,
    title: "Standoff in a closed room",
    text: "Content: a dark-red room. The clip opens on a medium close single of the old man, then a medium single of the boy, then a close-up of an old candlestick telephone, then a brief high-angle view down on the old man, ending back on a close single of the old man. Shot size: alternating medium close, medium and close-up. Angle: singles are near-eye-level frontal three-quarters, with one high-angle shot between them. Camera: essentially static."
  },
  {
    slot: 4,
    title: "Escalation: the receiver",
    text: "Content: the clip opens directly on the boy walking toward the old telephone in the foreground and reaching out; cut to an over-the-shoulder shot past the back of the boy's head as the old man reaches across, snatches the receiver and holds it up toward the lens. Shot size: medium-full of the boy, then over-the-shoulder close. Angle: low camera with the telephone filling a large foreground block; then an over-the-shoulder reverse. Camera: mostly static; change comes from action and the cut."
  },
  {
    slot: 5,
    title: "Restaging",
    text: "Content: a warm brown hall with a huge arched grille door behind. The old man starts with his back to camera, then turns to face it; the boy walks into frame and stops beside and behind him, forming a foreground/background two-shot as they keep talking. Shot size: medium two-shot, old man in the foreground. Angle: eye level, one continuous shot. Camera: locked off."
  },
  {
    slot: 6,
    title: "The escape begins: through the doorway",
    text: "Content: inside a door, a heavy black curtain on one side and a bright doorway on the other. The old man squeezes in from the light and looks around warily; the boy follows close behind him. Shot size: medium to medium close as the characters come toward the lens. Angle: eye level from the dark interior facing the doorway, strong backlight; one continuous shot. Camera: locked off."
  },
  {
    slot: 7,
    title: "Escape: leaving the other behind",
    text: "Content: a dim space with green shafts of light. One continuous shot: it opens with the boy standing at the edge of a platform and the old man already on a nearby thin tall post; the old man then hops from post to post away from him, and the boy gradually leaves frame. Shot size: full shot. Angle: eye level, slightly low. Camera: the camera trucks with the old man in the direction of his hops."
  }
];

const slotSpecsText = SLOT_SPECS.map(s =>
  `Slot ${s.slot} — ${s.title}\n${s.text}`
).join("\n\n");

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const probeSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    clipCount: { type: "integer" },
    totalFrames: { type: "integer" },
    issues: { type: "array", items: { type: "string" } }
  },
  required: ["ok", "clipCount", "totalFrames", "issues"],
  additionalProperties: false
};

const clipDescriptionSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    frameCount: { type: "integer" },
    setting: { type: "string", description: "Location and key set elements, e.g. cyan mechanical space with grated platform and wall of buttons; dark-red room with candlestick telephone; warm brown hall with arched grille door; black curtain and bright doorway; dim space with green light shafts and tall posts." },
    palette: { type: "string", description: "Dominant colors and lighting, e.g. cold cyan, dark red, warm brown, strong backlight, green shafts." },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          who: { type: "string", description: "boy, old man, both, or none" },
          screenSide: { type: "string", description: "left / right / center / moves-from-X-to-Y, per character if both" },
          action: { type: "string" }
        },
        required: ["who", "screenSide", "action"],
        additionalProperties: false
      }
    },
    shots: {
      type: "array",
      description: "One entry per shot inside the clip, in order. A clip may contain internal cuts; those stay as they are.",
      items: {
        type: "object",
        properties: {
          range: { type: "string", description: "approx frame range, e.g. 0-120" },
          size: { type: "string", description: "extreme wide / full / medium-full / medium / medium close / close-up / over-the-shoulder" },
          angle: { type: "string", description: "eye level / slightly low / low / high-angle; profile, three-quarter, frontal, back-to-camera" },
          subject: { type: "string" },
          camera: { type: "string", description: "locked off / static / trucking (and direction) / panning / other" }
        },
        required: ["range", "size", "angle", "subject", "camera"],
        additionalProperties: false
      }
    },
    movementDirection: { type: "string", description: "Screen direction of any character movement (left-to-right, right-to-left, toward lens, none)." },
    eyelines: { type: "string", description: "Direction each character looks in singles (screen left/right/up/down), if visible." },
    distinctiveDetails: { type: "string", description: "Concrete visible details that distinguish this clip from near-duplicates (props, poses, background elements, exact action beats)." },
    slotGuesses: { type: "array", items: { type: "integer" }, description: "Slot numbers 1-7 this clip could plausibly fill, best first; empty if none." }
  },
  required: ["id", "frameCount", "setting", "palette", "characters", "shots", "movementDirection", "eyelines", "distinctiveDetails", "slotGuesses"],
  additionalProperties: false
};

const analysisSchema = {
  type: "object",
  properties: {
    clips: { type: "array", items: clipDescriptionSchema }
  },
  required: ["clips"],
  additionalProperties: false
};

const matchSchema = {
  type: "object",
  properties: {
    slot: { type: "integer" },
    ranked: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          source: { type: "string", description: "two-digit clip id, e.g. \"17\"" },
          reason: { type: "string", description: "Why this clip matches every field of the slot spec." },
          axis: { type: "string", description: "Observed character screen sides, eyeline directions and movement directions relevant to the 180-degree rule (slot 1 establishes boy left, old man right)." },
          evidenceFrames: { type: "array", items: { type: "integer" }, minItems: 2, maxItems: 2, description: "Two frame numbers inside this clip that best prove the match." },
          confidence: { type: "string", description: "high / medium / low" }
        },
        required: ["source", "reason", "axis", "evidenceFrames", "confidence"],
        additionalProperties: false
      }
    },
    mostSimilarOther: { type: "string", description: "Clip id of the most similar candidate that was rejected." },
    differentiator: { type: "string", description: "One concrete visible difference between the top choice and the most similar rejected candidate." }
  },
  required: ["slot", "ranked", "mostSimilarOther", "differentiator"],
  additionalProperties: false
};

const verifySchema = {
  type: "object",
  properties: {
    passed: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
    suggestedSwaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: { type: "integer" },
          replaceWith: { type: "string" },
          reason: { type: "string" }
        },
        required: ["slot", "replaceWith", "reason"],
        additionalProperties: false
      }
    }
  },
  required: ["passed", "issues", "suggestedSwaps"],
  additionalProperties: false
};

const assembleSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean" },
    method: { type: "string", description: "stream-copy concat or re-encode (with CRF used)" },
    decodedFrames: { type: "integer" },
    expectedFrames: { type: "integer" },
    issues: { type: "array", items: { type: "string" } }
  },
  required: ["ok", "method", "decodedFrames", "expectedFrames", "issues"],
  additionalProperties: false
};

const validateSchema = {
  type: "object",
  properties: {
    passed: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } }
  },
  required: ["passed", "issues"],
  additionalProperties: false
};

// ---------------------------------------------------------------------------
// Phase 1 — Probe: inventory + frame extraction
// ---------------------------------------------------------------------------

phase("Probe");
log("Probing all 45 clips and extracting review frames.");

const probePrompt = `${TASK_CONTEXT}

Assignment: build a complete technical inventory of the 45 clips and extract frames so that later workers can review the footage visually.

Do exactly this:
1. Create directories work/ and work/frames/.
2. For every input/NN.mp4 (NN = 01..45), run ffprobe and record: nb_frames (use -count_frames and nb_read_frames for an exact decoded count), duration, avg_frame_rate, r_frame_rate, width, height, pix_fmt, codec_name, sample_aspect_ratio, and whether any audio stream exists.
3. Write the full inventory as JSON to work/probe.json, keyed by the two-digit clip id.
4. For each clip, extract review frames into work/frames/NN/ :
   - ffmpeg -i input/NN.mp4 -vf fps=2 -q:v 3 work/frames/NN/f_%03d.jpg   (about 2 frames per second)
   - also extract the exact first and last frames as work/frames/NN/first.jpg and work/frames/NN/last.jpg (use -vf select or -ss/-frames:v as appropriate).
   - If a clip contains visible internal cuts, additionally extract one frame right after each cut (detect with ffmpeg scene scoring, e.g. select='gt(scene,0.3)', showinfo) into work/frames/NN/cut_%02d.jpg.
5. Do not analyze or interpret content; just build the inventory and frames. Do not touch output/.

Return a summary: ok=true only if all 45 clips were probed and frame extraction completed for all of them; report clipCount, totalFrames (sum of exact decoded frame counts) and any issues encountered.`;

const probe = await agent(probePrompt, { label: "probe", schema: probeSchema });
if (probe === null || !probe.ok) {
  return {
    status: "unresolved",
    reason: "Probe/inventory worker failed; no reliable frame inventory exists.",
    probe
  };
}
log(`Probe complete: ${probe.clipCount} clips, ${probe.totalFrames} total frames.`);

// ---------------------------------------------------------------------------
// Phase 2 — Analyze: parallel structured description of every clip
// ---------------------------------------------------------------------------

phase("Analyze");
const GROUP_SIZE = 5;
const groups = [];
for (let i = 0; i < clipIds.length; i += GROUP_SIZE) groups.push(clipIds.slice(i, i + GROUP_SIZE));
log(`Analyzing ${clipIds.length} clips in ${groups.length} parallel groups.`);

function analyzeGroupPrompt(ids) {
  return `${TASK_CONTEXT}

Assignment: produce a precise visual description of these clips ONLY: ${ids.map(id => "input/" + id + ".mp4").join(", ")}.

The sequence being built is a 7-slot "confrontation then escape" story between a thin boy and a bald old man in a dark coat. The ordered slot list (for your slotGuesses field) is:

${slotSpecsText}

Method:
1. work/probe.json already holds technical data, and work/frames/NN/ already holds extracted frames at ~2 fps plus first/last frames (and possibly cut frames). VIEW these images for each assigned clip. If the extracted frames are insufficient to judge action, screen direction, eyelines or camera movement, extract more frames yourself (e.g. fps=4, or targeted -ss timestamps) into work/frames/NN/ and view those.
2. For each clip determine: setting and palette; which characters appear, on which screen side, doing what; the ordered list of shots inside the clip with size, angle, subject and camera movement (note internal cuts explicitly); screen direction of any character movement; eyeline directions in singles; and concrete distinctive details.
3. Be literal and evidence-based: describe only what is visible in frames you actually viewed. Note near-duplicate confusion risks (other clips may show the same scene).
4. Also write your per-clip descriptions to work/analysis/NN.json (one file per clip, the same object you return).

Return an object with a "clips" array containing one description object per assigned clip, matching the required schema exactly. ids must be two-digit strings (${ids.join(", ")}).`;
}

async function analyzeGroup(ids, index) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await agent(analyzeGroupPrompt(ids), {
      label: `analyze-${ids[0]}-${ids[ids.length - 1]}`,
      phase: "Analyze",
      schema: analysisSchema
    });
    if (result !== null && Array.isArray(result.clips) && result.clips.length > 0) return result;
    log(`Analysis group ${index} attempt ${attempt + 1} failed; ${attempt === 0 ? "retrying" : "giving up"}.`);
  }
  return null;
}

const analysisResults = await parallel(
  groups.map((ids, index) => () => analyzeGroup(ids, index))
);

// Merge catalog in deterministic clip order; track any clips still undescribed.
const catalog = {};
const missingClips = [];
for (let g = 0; g < groups.length; g++) {
  const res = analysisResults[g];
  if (res === null) {
    for (const id of groups[g]) missingClips.push(id);
    continue;
  }
  for (const clip of res.clips) {
    if (clip && typeof clip.id === "string") catalog[clip.id.padStart(2, "0")] = clip;
  }
  for (const id of groups[g]) {
    if (!catalog[id]) missingClips.push(id);
  }
}

// One recovery pass for clips missing descriptions (sequential, small count).
for (const id of missingClips.slice()) {
  log(`Recovering missing analysis for clip ${id}.`);
  const res = await agent(analyzeGroupPrompt([id]), { label: `analyze-recover-${id}`, phase: "Analyze", schema: analysisSchema });
  if (res !== null && Array.isArray(res.clips)) {
    for (const clip of res.clips) {
      if (clip && typeof clip.id === "string") catalog[clip.id.padStart(2, "0")] = clip;
    }
  }
}
const stillMissing = clipIds.filter(id => !catalog[id]);
if (stillMissing.length > 0) {
  log(`WARNING: no description for clips: ${stillMissing.join(", ")} — matchers must inspect these directly.`);
}

const catalogText = JSON.stringify(
  clipIds.filter(id => catalog[id]).map(id => catalog[id])
);

// ---------------------------------------------------------------------------
// Phase 3 — Match: per-slot ranked candidate lists, in parallel
// ---------------------------------------------------------------------------

phase("Match");
log("Matching candidates to the 7 slots in parallel.");

function matchPrompt(spec) {
  return `${TASK_CONTEXT}

Assignment: rank the best candidate clips for SLOT ${spec.slot} of a 7-slot sequence.

Slot ${spec.slot} — ${spec.title}
${spec.text}

The full ordered slot list, for context on what OTHER slots will claim (avoid stealing an obvious better fit for another slot):

${slotSpecsText}

Axis rule: Slot 1 establishes the line of action with the boy on FRAME LEFT and the old man on FRAME RIGHT. Every later slot must keep the characters' left/right relationship, eyeline directions in singles, and screen direction of movement consistent with that axis (no line crossing).

Here is the visual catalog of all analyzed clips (JSON array, one object per clip, built from actually viewed frames):
${catalogText}
${stillMissing.length > 0 ? `\nThese clips have NO catalog entry; if the slot might plausibly match them, inspect their frames directly under work/frames/ before deciding: ${stillMissing.join(", ")}.` : ""}

Method:
1. Shortlist from the catalog every clip whose setting, content, shot sizes, angles and camera movement could match this slot's spec. A clip must match EVERY field of the slot spec to be rankable.
2. For each shortlisted clip, VIEW the extracted frames under work/frames/NN/ yourself to confirm; extract more frames with ffmpeg if the match hinges on action, eyelines, movement direction or shot order. Also view frames of the most similar rejected candidate so you can name a concrete visible difference.
3. Check the axis information: record each candidate's character screen sides, eyelines and movement directions.
4. Rank up to 5 candidates, best first. For the top candidate give two evidence frame numbers inside the clip that best prove the match. Name the most similar rejected candidate and one concrete visible difference (a specific prop, pose, background element, shot order or action beat — not a vague quality judgement).

Return exactly one object matching the schema, with "slot": ${spec.slot}.`;
}

const matchResults = await parallel(
  SLOT_SPECS.map(spec => () => agent(matchPrompt(spec), {
    label: `match-slot-${spec.slot}`,
    phase: "Match",
    schema: matchSchema
  }))
);

const failedSlots = SLOT_SPECS.filter((s, i) => matchResults[i] === null).map(s => s.slot);
if (failedSlots.length > 0) {
  return {
    status: "unresolved",
    reason: `Matcher workers failed for slots: ${failedSlots.join(", ")}`,
    matchResults
  };
}

// ---------------------------------------------------------------------------
// Phase 4 — Resolve: distinct assignment by deterministic search + axis verify
// ---------------------------------------------------------------------------

phase("Resolve");

const confidenceWeight = { high: 3, medium: 2, low: 1 };

function scoreEntry(entry, rankIndex) {
  const rankScore = 5 - rankIndex; // rank 0 -> 5
  return rankScore * (confidenceWeight[entry.confidence] || 1);
}

// Deterministic exhaustive search over ranked lists (<= 5^7) with distinctness.
function bestAssignment(matches) {
  let best = null;
  const chosen = new Array(matches.length).fill(null);
  function dfs(i, used, score) {
    if (i === matches.length) {
      if (best === null || score > best.score) best = { score, chosen: chosen.slice() };
      return;
    }
    const ranked = matches[i].ranked;
    for (let r = 0; r < ranked.length; r++) {
      const src = String(ranked[r].source).padStart(2, "0");
      if (used.has(src)) continue;
      chosen[i] = { entry: ranked[r], rank: r, source: src };
      used.add(src);
      dfs(i + 1, used, score + scoreEntry(ranked[r], r));
      used.delete(src);
      chosen[i] = null;
    }
  }
  dfs(0, new Set(), 0);
  return best;
}

let assignment = bestAssignment(matchResults);
if (assignment === null) {
  return {
    status: "unresolved",
    reason: "No distinct 7-clip assignment exists within the matchers' ranked lists.",
    matchResults
  };
}

function assignmentSummary() {
  return SLOT_SPECS.map((s, i) => {
    const c = assignment.chosen[i];
    return {
      slot: s.slot,
      source: c.source,
      rank: c.rank + 1,
      confidence: c.entry.confidence,
      reason: c.entry.reason,
      axis: c.entry.axis,
      evidenceFrames: c.entry.evidenceFrames,
      mostSimilarOther: matchResults[i].mostSimilarOther,
      differentiator: matchResults[i].differentiator
    };
  });
}

// Independent content + axis verification, with bounded swap repair.
let verification = null;
for (let round = 0; round <= 2; round++) {
  const summary = assignmentSummary();
  verification = await agent(`${TASK_CONTEXT}

Assignment: independently verify this proposed 7-slot assignment. You did not make it; be skeptical.

Proposed assignment (slot, chosen clip, match reason, axis observations, evidence frames):
${JSON.stringify(summary, null, 2)}

Slot specifications:
${slotSpecsText}

Axis rule: Slot 1 establishes boy FRAME LEFT / old man FRAME RIGHT. All later slots must preserve that left/right relationship, eyeline directions in singles and screen direction of movement — no line crossing.

Method:
1. For each slot, VIEW the frames of the chosen clip under work/frames/NN/ (extract more frames with ffmpeg at specific timestamps if needed) and check the clip against EVERY field of its slot spec: content, shot size, angle/lens language, camera movement, and required shot order where the spec lists one.
2. Check axis continuity across the whole sequence: for each slot note the characters' screen sides, look directions and movement directions, and confirm consistency with the slot 1 axis. Pay special attention to slot boundaries (slot 1->2, 4->5, 6->7) and to movement directions in slots 5, 6 and 7.
3. If a chosen clip fails its slot spec or breaks the axis, look through work/frames/ for a better candidate among the 45 clips (including the matcher's rejected alternates) and propose a concrete swap. Swaps must keep all 7 chosen clips distinct.

Return passed=true only if every slot matches every spec field AND the axis is consistent across the whole sequence. Otherwise list concrete issues and any suggestedSwaps (slot, replaceWith clip id, reason).`,
    { label: `verify-assignment-${round}`, phase: "Resolve", schema: verifySchema }
  );

  if (verification === null) {
    log("Verification worker failed; keeping current assignment and continuing to assembly.");
    verification = { passed: false, issues: ["verification worker failed"], suggestedSwaps: [] };
    break;
  }
  if (verification.passed) break;
  log(`Verification round ${round} reported ${verification.issues.length} issue(s); attempting swaps.`);

  // Apply non-conflicting suggested swaps deterministically, then re-search.
  const swapNotes = [];
  for (const swap of verification.suggestedSwaps || []) {
    const idx = SLOT_SPECS.findIndex(s => s.slot === swap.slot);
    const src = String(swap.replaceWith || "").padStart(2, "0");
    if (idx < 0 || !/^\d{2}$/.test(src) || Number(src) < 1 || Number(src) > 45) continue;
    const ranked = matchResults[idx].ranked;
    if (!ranked.some(e => String(e.source).padStart(2, "0") === src)) {
      ranked.unshift({
        source: src,
        reason: "Verifier-suggested swap: " + swap.reason,
        axis: "re-check by verifier",
        evidenceFrames: (ranked[0] && ranked[0].evidenceFrames) || [0, 1],
        confidence: "medium"
      });
      if (ranked.length > 5) ranked.pop();
      swapNotes.push(`slot ${swap.slot} -> ${src}`);
    }
  }
  const next = bestAssignment(matchResults);
  if (next !== null) assignment = next;
  if (swapNotes.length === 0) {
    log("No applicable swaps; proceeding with best available assignment.");
    break;
  }
  log(`Applied swap candidates: ${swapNotes.join("; ")}`);
}

const finalAssignment = assignmentSummary();
log("Final assignment: " + finalAssignment.map(a => `slot${a.slot}=clip${a.source}`).join(", "));

// ---------------------------------------------------------------------------
// Phase 5 — Assemble: build solution.mp4 and the two JSON deliverables
// ---------------------------------------------------------------------------

phase("Assemble");

const assemblePrompt = `${TASK_CONTEXT}

Assignment: build all three deliverables in output/ from the verified 7-slot assignment below. Follow the public format spec in instruction.md EXACTLY.

Final assignment (slot order 1..7, each clip used once, complete, 1x speed, original orientation, hard cuts):
${JSON.stringify(finalAssignment, null, 2)}

Requirements:

A) output/solution.mp4
- The 7 complete clips concatenated in slot order with hard cuts: ${finalAssignment.map(a => "input/" + a.source + ".mp4").join(" , ")}.
- No cropping, mirroring, filters, text, added or dropped frames, transitions or generated content; cuts already inside a clip stay. No audio.
- Output: H.264 / yuv420p, 1280x720, SAR 1:1, exactly 24/1 fps constant frame rate.
- Preferred: lossless stream copy via the concat demuxer (work/concat.txt with the seven file lines, ffmpeg -f concat -safe 0 -i work/concat.txt -c copy -an -movflags +faststart output/solution.mp4). Afterward, VERIFY with ffprobe -count_frames that the decoded frame count of output/solution.mp4 equals the SUM of the seven exact source frame counts (from work/probe.json nb_read_frames; recompute with ffprobe if unsure).
- If stream copy fails, produces wrong timestamps, or the decoded frame count mismatches the sum, re-encode instead: ffmpeg -f concat -safe 0 -i work/concat.txt -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -r 24 -an output/solution.mp4 (CRF must be <= 18). If that re-encode still yields a frame count mismatch, re-encode each clip separately to an intermediate with identical parameters, then concat those intermediates with -c copy, and re-verify. Do not finish until the decoded frame count of output/solution.mp4 exactly equals the sum of the seven source frame counts, and resolution/SAR/fps/pix_fmt/codec/no-audio all check out.

B) output/solution.json
- {"segments":[ ... ]} with exactly 7 objects in slot order, each: slot (1-7), source:"NN" (two-digit string), output_frames:[start, endExclusive] (integers, half-open, contiguous from frame 0, no gaps or overlaps), source_frames:[0, frameCountOfThatClip], output:[startSeconds, endSeconds] where seconds equal frames/24 within 0.001 s (write e.g. 4-decimal values of frames/24).
- The final segment's end frame must equal the actual decoded frame count of output/solution.mp4.

C) output/selection-evidence.json
- An array of exactly 7 objects, one per slot, in slot order: {"slot":N, "source":"NN", "frames":[a,b], "reason":"..."}.
- frames a and b are two frame numbers inside the chosen clip: use the evidenceFrames from the assignment (validate they are within [0, frameCount) for that clip; clamp/fix if needed).
- reason must name ONE concrete visible difference between the chosen clip and the most similar other candidate. Build it from the "differentiator" and "reason" fields in the assignment (e.g. "Unlike clip 34, this clip opens on a medium close single of the old man and includes the close-up of the candlestick telephone before the high-angle shot."). Each reason must reference the specific other clip and the visible difference.

D) output/ must contain EXACTLY these three files when you finish: solution.mp4, solution.json, selection-evidence.json. Remove anything else from output/. Scratch files belong in work/.

Return: ok (true only if all checks above pass), method (how solution.mp4 was produced, including CRF if re-encoded), decodedFrames (actual decoded frame count of solution.mp4), expectedFrames (sum of the seven source frame counts), issues (anything noteworthy, empty if clean).`;

let assembly = await agent(assemblePrompt, { label: "assemble", phase: "Assemble", schema: assembleSchema });
if (assembly === null) {
  return { status: "unresolved", reason: "Assembly worker failed; deliverables may not exist.", assignment: finalAssignment };
}
if (!assembly.ok || assembly.decodedFrames !== assembly.expectedFrames) {
  log("First assembly attempt reported problems; running one corrective assembly pass.");
  const fixPrompt = `${TASK_CONTEXT}

The previous assembly attempt reported these issues:
${JSON.stringify(assembly, null, 2)}

Redo the assembly from scratch and fix every reported problem. The original assembly instructions follow verbatim:

${assemblePrompt}`;
  assembly = await agent(fixPrompt, { label: "assemble-fix", phase: "Assemble", schema: assembleSchema });
  if (assembly === null) {
    return { status: "unresolved", reason: "Corrective assembly worker failed.", assignment: finalAssignment };
  }
}

// ---------------------------------------------------------------------------
// Phase 6 — Validate: independent deliverable verification + bounded repair
// ---------------------------------------------------------------------------

phase("Validate");

const validatePrompt = `${TASK_CONTEXT}

Assignment: independently validate the finished deliverables against the public format spec in instruction.md. You did not build them; check everything yourself.

Declared assignment: ${JSON.stringify(finalAssignment.map(a => ({ slot: a.slot, source: a.source })), null, 2)}

Checks:
1. output/ contains EXACTLY solution.mp4, solution.json, selection-evidence.json — nothing else.
2. ffprobe output/solution.mp4: H.264 video, yuv420p, 1280x720, SAR 1:1, avg frame rate exactly 24/1, no audio stream. Count decoded frames exactly (-count_frames).
3. Parse output/solution.json: exactly 7 segments in slot order 1..7; sources are the declared clips and all distinct; output_frames are integer half-open intervals, first start is 0, contiguous with no gaps/overlaps; source_frames[i] = [0, exact frame count of input/NN.mp4] (recompute each with ffprobe); output seconds match frames/24 within 0.001 s; the final end frame equals the decoded frame count you measured in check 2.
4. Frame-content spot check: for each slot, extract at least 3 frames from output/solution.mp4 at frame numbers inside that slot's declared output range, and the corresponding frames from the declared source clip (source frame = output frame - slot output start). VIEW them side by side and confirm identical content (allowing for re-encode compression differences, not content differences). Also confirm the chosen clips' content still matches each slot's spec at the checked points.
5. Parse output/selection-evidence.json: exactly 7 entries in slot order; sources match solution.json; both frame numbers lie inside [0, frameCount) of the declared clip; each reason names a concrete visible difference versus a specific other candidate clip (reject vague reasons like "better framing").
6. Axis sanity: extract one frame near the start of each slot from solution.mp4, view them, and confirm no obvious left/right line crossing relative to slot 1 (boy left / old man right established axis).

Return passed=true only if ALL checks pass; otherwise list every concrete issue.`;

let validation = null;
for (let round = 0; round <= maxRepairs; round++) {
  validation = await agent(validatePrompt, {
    label: `validate-${round}`,
    phase: "Validate",
    schema: validateSchema
  });
  if (validation === null) {
    return {
      status: "unresolved",
      reason: "Validation worker failed; deliverable state unknown.",
      assignment: finalAssignment,
      assembly
    };
  }
  if (validation.passed) break;
  if (round === maxRepairs) break;
  log(`Validation round ${round} failed with ${validation.issues.length} issue(s); requesting repair.`);

  const repair = await agent(`${TASK_CONTEXT}

Assignment: repair the deliverables in output/. Independent validation found these issues:
${JSON.stringify(validation.issues, null, 2)}

Context — declared slot assignment:
${JSON.stringify(finalAssignment, null, 2)}

Fix every listed issue while honoring the full contract in instruction.md (7 distinct complete clips at 1x speed, hard cuts, no filters/transitions/audio; H.264 yuv420p 1280x720 SAR 1:1 24 fps; solution.json frame math exact and contiguous ending at the true decoded frame count; selection-evidence.json reasons naming concrete visible differences; output/ holds exactly the three deliverables). If an issue concerns clip selection or axis continuity, say so explicitly in your reply instead of silently changing the selection — selection changes require re-derivation you must describe. Rebuild files from the sources under input/ as needed; scratch in work/. Verify your own fixes with ffprobe and by viewing frames before returning.

Return a short report of what you changed and the verification you ran.`,
    { label: `repair-${round}`, phase: "Validate" }
  );
  if (repair === null) {
    return {
      status: "unresolved",
      reason: "Repair worker failed.",
      assignment: finalAssignment,
      lastValidation: validation
    };
  }
}

return {
  status: validation && validation.passed ? "verified" : "unresolved",
  assignment: finalAssignment,
  axisVerification: verification,
  assembly,
  validation,
  notes: validation && validation.passed
    ? "All deliverables validated: output/solution.mp4, output/solution.json, output/selection-evidence.json."
    : "Deliverables did not pass final validation; see validation.issues."
};
