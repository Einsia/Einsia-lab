export const meta = {
  name: "cdc-a-x01-assembly",
  description: "Screen 40 anonymous clips, match 7 ordered shot-list slots, plan contiguous frame ranges summing to 1650 frames, assemble output/assembly.mp4 and selection.json, then verify and repair",
  phases: [
    {title: "Screen clips", detail: "Probe and visually analyze every candidate clip: content, shots, camera motion"},
    {title: "Match slots", detail: "Assign each of the 7 slot descriptions to one clip after direct inspection"},
    {title: "Plan ranges", detail: "Deterministically allocate contiguous frame ranges that sum to exactly 1650 frames"},
    {title: "Assemble", detail: "Cut exact segments and join with hard cuts into output/assembly.mp4 + output/selection.json"},
    {title: "Verify and repair", detail: "Independent contract verification and bounded repair loop"}
  ]
};

const WORK = "/workspace";
const TOTAL_FRAMES = 1650;
const maxRepairs = (typeof args !== "undefined" && Number.isInteger(args.maxRepairs)) ? args.maxRepairs : 2;

const clipIds = [];
for (let i = 1; i <= 40; i++) clipIds.push(String(i).padStart(2, "0"));

// ---------- Schemas ----------

const screenSchema = {
  type: "object",
  properties: {
    clip: {type: "string"},
    frame_count: {type: "integer"},
    fps: {type: "number"},
    duration_seconds: {type: "number"},
    shot_count: {type: "integer"},
    cut_frames: {type: "array", items: {type: "integer"}},
    subject_summary: {type: "string"},
    setting_summary: {type: "string"},
    camera_summary: {type: "string"},
    motion_tags: {type: "array", items: {type: "string"}},
    notable: {type: "string"}
  },
  required: ["clip", "frame_count", "shot_count", "subject_summary", "setting_summary", "camera_summary", "motion_tags"],
  additionalProperties: false
};

const matchSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    source: {type: "string", pattern: "^[0-9]{2}$"},
    clip_frame_count: {type: "integer"},
    content_start_frame: {type: "integer"},
    content_end_frame: {type: "integer"},
    earliest_start_frame: {type: "integer"},
    latest_end_frame: {type: "integer"},
    closest_alternative: {type: "string", pattern: "^[0-9]{2}$"},
    reason: {type: "string"},
    confidence: {type: "string", enum: ["high", "medium", "low"]},
    evidence: {type: "string"},
    alternatives_considered: {type: "array", items: {type: "string", pattern: "^[0-9]{2}$"}}
  },
  required: ["slot", "source", "clip_frame_count", "content_start_frame", "content_end_frame",
             "earliest_start_frame", "latest_end_frame", "closest_alternative", "reason", "confidence", "evidence"],
  additionalProperties: false
};

const refineSchema = {
  type: "object",
  properties: {matches: {type: "array", items: matchSchema}},
  required: ["matches"],
  additionalProperties: false
};

const assembleSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    assembly_frames: {type: "integer"},
    selection_json_written: {type: "boolean"},
    output_files: {type: "array", items: {type: "string"}},
    notes: {type: "string"}
  },
  required: ["ok", "assembly_frames", "selection_json_written", "output_files", "notes"],
  additionalProperties: false
};

const verdictSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    details: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues"],
  additionalProperties: false
};

const repairSchema = {
  type: "object",
  properties: {
    fixed: {type: "boolean"},
    selection: {
      type: "object",
      properties: {
        slots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slot: {type: "integer"},
              source: {type: "string", pattern: "^[0-9]{2}$"},
              source_frames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
              output_frames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
              closest_alternative: {type: "string", pattern: "^[0-9]{2}$"},
              reason: {type: "string"}
            },
            required: ["slot", "source", "source_frames", "output_frames", "closest_alternative", "reason"],
            additionalProperties: false
          }
        }
      },
      required: ["slots"],
      additionalProperties: false
    },
    notes: {type: "string"}
  },
  required: ["fixed", "notes"],
  additionalProperties: false
};

// ---------- Prompts ----------

const screenPrompt = (id) =>
`You are a worker on task CDC-A-X01. Workspace: ${WORK}. First read ${WORK}/instruction.md for full context. Never write to output/.

Your assignment: analyze exactly ONE candidate clip: ${WORK}/input/${id}.mp4 (silent, 1280x720, 30fps, 6-12s, may contain internal cuts). Do not guess which film it comes from; describe only what is visible. Do not use the network.

Steps:
1. mkdir -p ${WORK}/work/screen. Run ffprobe (with -count_frames) to get the exact decoded frame count, fps, duration, resolution, pixel format.
2. Create contact sheets you actually look at, e.g. ffmpeg tile montages sampling the whole clip (scale=320:180, tile=5x4) saved under ${WORK}/work/screen/${id}-*.png, plus full-resolution single frames near the start, middle and end.
3. Describe visible content: setting (snowfield / crags / city rooftops / alley / sunlit wall / dim interior / other), characters and subjects (e.g. red-haired woman, short-red-haired girl, small winged creature, tiny distant walker), hair color, clothing, objects, lighting, time of day.
4. Estimate the number of distinct shots (hard cuts) and approximate 0-based cut frame indices. Use ffmpeg scene detection (select='gt(scene,0.3)' with metadata=print into a null muxer) or a short Python/OpenCV frame-difference script.
5. Characterize the camera in each shot: locked-off (framing essentially unchanged) vs pan/tilt, lateral tracking, push-in/pull-back, aerial movement, handheld feel, accelerating motion. Compare frames across each shot (e.g. OpenCV phase correlation or block matching between sampled frames) rather than guessing.
6. Also write the exact JSON you return to ${WORK}/work/screen/${id}.json.

Return JSON: clip ("${id}"), frame_count, fps, duration_seconds, shot_count, cut_frames (0-based frame indices of hard cuts, [] if single shot), subject_summary, setting_summary, camera_summary (per-shot camera behavior), motion_tags (short tags such as "aerial", "fly-forward", "push-in", "pull-back", "lateral-tracking", "locked-off", "fade-from-black", "high-overhead", "turbulent", "handheld"), notable (anything distinctive).`;

const slotTexts = {
  1: `Slot 1 - Establishing: the endless snowfield. Aerial. Snow-covered crags and blue ice in the foreground; past them an open snowfield, one tiny walker and a winding line of footprints behind them. Single shot. Camera: a steady aerial fly-forward with a continuous lateral drift, at an even speed.`,
  2: `Slot 2 - Collapse: the searcher gives out. Close-up of a red-haired woman's face as she lies on her side in the snow; tilted, ground-level framing, snow drifting past. Single shot. Camera: a slow push-in on her face with a slight drift, continuing to the end of the shot.`,
  3: `Slot 3 - Transition: the remembered city. A city panorama fading up from black (dense rooftops, a tower in the distance), cut to a high-angle shot looking down a narrow alley. Two shots. Camera: both shots locked off; the framing does not change within either shot.`,
  4: `Slot 4 - Searching along the wall. The frame opens almost entirely covered by a large dark foreground mass; it sweeps away to reveal a short-red-haired girl against a sunlit wall; she leans out to look and moves along the wall, and the framing ends behind her shoulder. Single shot. Camera: a lateral tracking move travelling with her, with a slight handheld feel.`,
  5: `Slot 5 - The chase. Close shot of the short-red-haired girl turning away; wide shot of her running down a narrow alley; she climbs over the edge of a roof; an injured small winged creature on the roof tiles. Camera: in both the running shot and the creature shot the camera pushes forward. (Note: the slot may be covered by fewer cuts than listed actions if the clip shows them within its shots; the chosen clip must show these actions and the described push-forward camera.)`,
  6: `Slot 6 - Discovery and approach. Close-up of the girl's gaze; a hand reaching toward the small winged creature on the tiles; close-up of the girl breaking into a smile. Three shots. Camera: the two face close-ups are locked off; the middle shot pulls back while trucking sideways, gradually opening up the hand-creature relationship.`,
  7: `Slot 7 - Losing control. High overhead view of a dim interior, papers and clutter strewn on the floor; the image becomes turbulent later in the shot. Single shot. Camera: completely static at first, then it starts to push forward and keeps accelerating.`
};

const matchPrompt = (slot, indexLines) =>
`You are a worker on task CDC-A-X01. Workspace: ${WORK}. First read ${WORK}/instruction.md for full context. Never write to output/. Do not use the network.

All 40 candidate clips (input/01.mp4 .. input/40.mp4) were pre-screened; per-clip JSON reports are in ${WORK}/work/screen/NN.json. Screening index (clip | frames | shots | subjects | camera):
${indexLines}

Your assignment: fill SLOT ${slot} of the ordered shot list. Slot description:
${slotTexts[slot]}

Procedure:
1. Read the screening JSONs of plausible candidates and shortlist up to about 6 clips whose subjects, setting, shot count and camera behavior could match. Do not fixate on a single keyword; consider both subject and camera-motion requirements.
2. For EVERY shortlisted clip, inspect it DIRECTLY: extract frames/contact sheets across the whole clip with ffmpeg, verify the shot count and cut positions, and verify the camera behavior per shot (Python/OpenCV phase correlation or block matching between sampled frames to distinguish locked-off vs moving, push-in vs pull-back, tracking vs zoom, constant vs accelerating motion). The chosen clip must match EVERY part of the slot description.
3. Choose the single best match. Then choose the closest_alternative: the OTHER candidate you consider most similar to your pick but not right for this slot, and write a reason naming one concrete visible difference between the two (one sentence).
4. Determine the content window [content_start_frame, content_end_frame) (half-open, 0-based frame indices) that keeps every shot and the whole camera move described for this slot. Place boundaries precisely using your frame inspection. The final assembly segment for this slot must contain this window.
5. Also give padding bounds earliest_start_frame and latest_end_frame: the widest range around the content window within this clip that could be included without adding clearly unrelated content (0 and the clip frame count are acceptable when the whole clip is on-topic).
6. Save your full findings to ${WORK}/work/match/slot${slot}.json and return the JSON.

Return JSON: slot (${slot}), source (two-digit string), clip_frame_count, content_start_frame, content_end_frame, earliest_start_frame, latest_end_frame, closest_alternative (two-digit string, different from source), reason (one sentence, concrete visible difference), confidence ("high"|"medium"|"low"), evidence (what you verified and how), alternatives_considered (two-digit strings you inspected).`;

const refinePrompt = (problems, matches) =>
`You are a worker on task CDC-A-X01. Workspace: ${WORK}. Read ${WORK}/instruction.md. Never write to output/. Do not use the network.

The seven slot matches were made, but frame-range planning failed:
${JSON.stringify(problems, null, 2)}

Current matches (JSON):
${JSON.stringify(matches, null, 2)}

Slot descriptions are in instruction.md. Re-inspect the involved clips directly (ffmpeg frame extraction, OpenCV motion analysis) and correct the problem:
- If content windows are too long in total, tighten the windows of the slots that have slack, but every window must STILL contain every shot and the complete camera move described for its slot.
- If padding slack is insufficient, widen earliest_start_frame/latest_end_frame where the surrounding clip content is still on-topic (bounded by 0 and the clip's frame count).
- Only change the chosen source clips if direct evidence shows a match is wrong; if you change one, keep all 7 sources distinct and re-derive its windows and closest_alternative.
- clip_frame_count values must be exact decoded frame counts (verify with ffprobe -count_frames if unsure).

Return JSON: {matches: [updated match objects for ALL 7 slots]} using the same per-slot fields as before.`;

const assemblePrompt = (segments, selectionJson) =>
`You are a worker on task CDC-A-X01. Workspace: ${WORK}. Read ${WORK}/instruction.md, especially the Assembly contract and Deliverables. Do not use the network.

The 7 slot selections and exact frame ranges are FINAL (do not change them):
${JSON.stringify(segments, null, 2)}

Build the deliverables:
1. mkdir -p ${WORK}/work/seg and ${WORK}/output. For each segment cut input/${"<SS>"}.mp4 frames [a,b) EXACTLY, e.g.:
   ffmpeg -i input/SS.mp4 -vf "trim=start_frame=A:end_frame=B,setpts=PTS-STARTPTS,setsar=1" -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -fps_mode cfr work/seg/SS.mp4
   After each cut, verify with ffprobe -count_frames that the segment has exactly b-a decoded frames. If not, fix your command before proceeding.
2. Join the 7 segments in slot order with hard cuts (no transitions, no black). Concat demuxer with -c copy is acceptable if all intermediates share identical codec parameters; otherwise re-encode the concatenation. Final file: output/assembly.mp4 with: H.264, yuv420p, 1280x720, SAR 1:1, constant 30/1 fps, no audio stream, EXACTLY 1650 decoded frames.
3. Verify output/assembly.mp4 yourself with ffprobe -count_frames: frame count must be 1650; one video stream, no audio; correct codec/pix_fmt/resolution/SAR/frame rate.
4. Write output/selection.json with EXACTLY this content (verbatim, valid JSON):
${selectionJson}
5. Ensure output/ contains ONLY assembly.mp4 and selection.json (remove anything else that is not one of these two files).

Return JSON: ok (true only if every check above passed), assembly_frames (decoded frame count you measured), selection_json_written, output_files (listing of output/), notes (commands used, any deviations).`;

const verifyPrompt = (selection) =>
`You are an INDEPENDENT verifier for task CDC-A-X01. Workspace: ${WORK}. Read ${WORK}/instruction.md, especially the Assembly contract and Deliverables. Do not modify anything in output/; write scratch files only under ${WORK}/work/verify/. Do not use the network.

The intended plan (segments as source_frames/output_frames) and the expected selection.json content:
${JSON.stringify(selection, null, 2)}

Check ALL of the following; report each check and any issue precisely (slot number, frame indices):
1. output/ contains exactly two files: assembly.mp4 and selection.json.
2. ffprobe -count_frames on output/assembly.mp4: exactly 1650 decoded video frames; codec h264; pix_fmt yuv420p; 1280x720; sample_aspect_ratio 1:1; avg_frame_rate 30/1; exactly one stream and it is video (no audio stream).
3. output/selection.json parses and matches the expected content: exactly 7 objects in slot order 1..7; source is a two-digit string; source_frames [a,b] half-open 0-based; output_frames [c,d] with segments abutting from 0, last d = 1650 = decoded frame count; b-a = d-c for every slot; closest_alternative differs from source; reason is one sentence naming a concrete visible difference.
4. Frame correspondence: for each segment, compare frames decoded from output/assembly.mp4 at output positions c, (c+d)/2, d-1 against frames a, (a+b)/2, b-1 of input/SS.mp4 (Python/OpenCV absolute difference or PSNR). Small encoder differences are fine; a gross mismatch (different content) is a failure.
5. Content coverage: inspect frames spread across each segment and confirm it contains every shot and the whole camera move required by that slot's description in instruction.md.
6. Hard cuts: inspect frames around each of the 6 segment boundaries; there must be no black frames, fades or transition frames between segments.

Return JSON: passed (true only if ALL checks pass), issues (empty if passed; otherwise specific, actionable issues), details (one line per check performed).`;

const repairPrompt = (issues, currentSelection) =>
`You are a worker on task CDC-A-X01 repairing failed verification. Workspace: ${WORK}. Read ${WORK}/instruction.md. Do not use the network.

Current intended selection.json content:
${JSON.stringify(currentSelection, null, 2)}

Verification reported these issues:
${JSON.stringify(issues, null, 2)}

Fix the deliverables so every requirement of instruction.md is met:
- If the problem is encoding/container/format or frame count, re-cut and re-assemble output/assembly.mp4 correctly (keep the same segment plan).
- If a segment's source range is wrong (wrong frames, missing described content), adjust source_frames for that slot within its clip; the range must still cover the slot's whole described content, all 7 segments must stay distinct-source, half-open, abut in slot order, and sum to exactly 1650 frames.
- If a slot's chosen clip itself is wrong, you may re-select, but re-derive closest_alternative and reason, and keep the total at exactly 1650 frames.
- Update output/selection.json so it exactly matches what output/assembly.mp4 actually contains. Keep output/ to exactly the two deliverable files.
- Verify your own result with ffprobe -count_frames and frame comparisons before returning.

Return JSON: fixed (true if you believe all issues are resolved), selection (the final selection.json object {slots:[...]} with slot, source, source_frames, output_frames, closest_alternative, reason for all 7 slots in order), notes (what you changed).`;

// ---------- Phase 1: screening ----------

phase("Screen clips");
log("Screening 40 candidate clips");

const screened = await parallel(clipIds.map(id => () =>
  agent(screenPrompt(id), {label: `screen-${id}`, phase: "Screen clips", schema: screenSchema})
));

// One retry for missing screenings; matchers can also screen leftovers themselves.
const missingScreens = clipIds.filter((id, i) => screened[i] === null || !screened[i] || screened[i].clip !== id && screened[i].clip !== id);
const retryIdx = clipIds.map((id, i) => i).filter(i => screened[i] === null);
if (retryIdx.length > 0) {
  log(`Retrying screening for ${retryIdx.length} clips`);
  const retried = await parallel(retryIdx.map(i => () =>
    agent(screenPrompt(clipIds[i]), {label: `screen-retry-${clipIds[i]}`, phase: "Screen clips", schema: screenSchema})
  ));
  retried.forEach((r, j) => { screened[retryIdx[j]] = r; });
}

const screenIndex = clipIds.map((id, i) => {
  const s = screened[i];
  if (!s) return `${id} | SCREENING MISSING - inspect this clip yourself`;
  return `${id} | frames=${s.frame_count} | shots=${s.shot_count} | cuts=${JSON.stringify(s.cut_frames || [])} | subjects: ${s.subject_summary} | setting: ${s.setting_summary} | camera: ${s.camera_summary} | tags: ${(s.motion_tags || []).join(",")}`;
}).join("\n");
const indexLines = screenIndex;

// ---------- Phase 2: slot matching ----------

phase("Match slots");
log("Matching 7 slots to clips");

const slotNums = [1, 2, 3, 4, 5, 6, 7];
let matches = await parallel(slotNums.map(n => () =>
  agent(matchPrompt(n, indexLines), {label: `match-slot-${n}`, phase: "Match slots", schema: matchSchema})
));

const missingMatches = slotNums.filter((n, i) => matches[i] === null);
if (missingMatches.length > 0) {
  log(`Retrying matching for slots ${missingMatches.join(", ")}`);
  const retried = await parallel(missingMatches.map(n => () =>
    agent(matchPrompt(n, indexLines), {label: `match-retry-slot-${n}`, phase: "Match slots", schema: matchSchema})
  ));
  retried.forEach((r, j) => { matches[slotNums.indexOf(missingMatches[j])] = r; });
}
matches = slotNums.map((n, i) => (matches[i] && matches[i].slot === n) ? matches[i] : null);

if (matches.some(m => m === null)) {
  return {
    status: "unresolved",
    reason: "Slot matching failed for some slots after retry",
    missing_slots: slotNums.filter((n, i) => matches[i] === null),
    missing_screens: clipIds.filter((id, i) => screened[i] === null)
  };
}

// ---------- Phase 3: deterministic range planning ----------

phase("Plan ranges");

function planSegments(ms, total) {
  const problems = [];
  const seen = new Set();
  for (const m of ms) {
    if (seen.has(m.source)) problems.push(`slot ${m.slot}: source ${m.source} used more than once`);
    seen.add(m.source);
    if (!(Number.isInteger(m.content_start_frame) && Number.isInteger(m.content_end_frame) && m.content_start_frame < m.content_end_frame))
      problems.push(`slot ${m.slot}: invalid content window [${m.content_start_frame},${m.content_end_frame})`);
    if (m.earliest_start_frame > m.content_start_frame || m.content_end_frame > m.latest_end_frame)
      problems.push(`slot ${m.slot}: content window outside padding bounds`);
    if (m.earliest_start_frame < 0 || m.latest_end_frame > m.clip_frame_count)
      problems.push(`slot ${m.slot}: padding bounds outside clip (0..${m.clip_frame_count})`);
    if (m.closest_alternative === m.source || !m.reason || !m.reason.trim())
      problems.push(`slot ${m.slot}: closest_alternative equals source or empty reason`);
  }
  if (problems.length) return {problems};

  const baseTotal = ms.reduce((s, m) => s + (m.content_end_frame - m.content_start_frame), 0);
  const avail = ms.map(m => (m.content_start_frame - m.earliest_start_frame) + (m.latest_end_frame - m.content_end_frame));
  const availTotal = avail.reduce((a, b) => a + b, 0);
  const extra = total - baseTotal;
  if (extra < 0) {
    return {problems: [`content windows total ${baseTotal} frames, exceeding the ${total}-frame target by ${-extra}; windows must be tightened`]};
  }
  if (extra > availTotal) {
    return {problems: [`need ${extra} padding frames but only ${availTotal} available within padding bounds; bounds must be widened or windows adjusted`]};
  }

  // Distribute extra frames one at a time, alternating end/start padding across slots.
  const addEnd = ms.map(() => 0);
  const addStart = ms.map(() => 0);
  let remaining = extra, side = 0, fails = 0, guard = 0;
  while (remaining > 0 && guard < 20000) {
    let progressed = false;
    for (let i = 0; i < ms.length && remaining > 0; i++) {
      const m = ms[i];
      if (side === 0 && addEnd[i] < m.latest_end_frame - m.content_end_frame) { addEnd[i]++; remaining--; progressed = true; }
      else if (side === 1 && addStart[i] < m.content_start_frame - m.earliest_start_frame) { addStart[i]++; remaining--; progressed = true; }
    }
    if (progressed) fails = 0; else fails++;
    if (fails >= 2) break;
    side = 1 - side;
    guard++;
  }
  if (remaining > 0) return {problems: ["frame allocation arithmetic failed"]};

  let cursor = 0;
  const segments = ms.map((m, i) => {
    const a = m.content_start_frame - addStart[i];
    const b = m.content_end_frame + addEnd[i];
    const c = cursor;
    const d = c + (b - a);
    cursor = d;
    return {
      slot: m.slot, source: m.source, source_frames: [a, b], output_frames: [c, d],
      closest_alternative: m.closest_alternative, reason: m.reason,
      content_window: [m.content_start_frame, m.content_end_frame], clip_frame_count: m.clip_frame_count,
      confidence: m.confidence
    };
  });
  if (cursor !== total) return {problems: [`assembled length ${cursor} != ${total}`]};
  return {segments};
}

let plan = planSegments(matches, TOTAL_FRAMES);
let refineRounds = 0;
while (plan.problems && refineRounds < 2) {
  log(`Range planning failed; refinement round ${refineRounds + 1}`);
  const refined = await agent(refinePrompt(plan.problems, matches),
    {label: `refine-ranges-${refineRounds + 1}`, phase: "Plan ranges", schema: refineSchema});
  if (refined === null || !Array.isArray(refined.matches) || refined.matches.length !== 7) {
    return {status: "unresolved", reason: "range refinement failed", problems: plan.problems};
  }
  const ok = refined.matches.every((m, i) => m && m.slot === slotNums[i]);
  if (!ok) {
    return {status: "unresolved", reason: "range refinement returned malformed matches", problems: plan.problems};
  }
  matches = refined.matches;
  plan = planSegments(matches, TOTAL_FRAMES);
  refineRounds++;
}
if (plan.problems) {
  return {status: "unresolved", reason: "could not plan frame ranges summing to 1650", problems: plan.problems, matches};
}
const segments = plan.segments;
log(`Plan: ${segments.map(s => `slot${s.slot}=${s.source}[${s.source_frames[0]},${s.source_frames[1]}) -> [${s.output_frames[0]},${s.output_frames[1]})`).join("  ")}`);

let currentSelection = {
  slots: segments.map(s => ({
    slot: s.slot, source: s.source, source_frames: s.source_frames, output_frames: s.output_frames,
    closest_alternative: s.closest_alternative, reason: s.reason
  }))
};
const expectedSelectionJson = JSON.stringify(currentSelection, null, 2);

// ---------- Phase 4: assembly ----------

phase("Assemble");
const assembled = await agent(assemblePrompt(segments, expectedSelectionJson),
  {label: "assemble", phase: "Assemble", schema: assembleSchema});

if (assembled === null || !assembled.ok || assembled.assembly_frames !== TOTAL_FRAMES) {
  return {
    status: "unresolved",
    reason: "assembly failed or frame count incorrect",
    assembler_result: assembled,
    selection: currentSelection
  };
}

// ---------- Phase 5: verification and bounded repair ----------

phase("Verify and repair");
const verify = () => agent(verifyPrompt(currentSelection),
  {label: "verify", phase: "Verify and repair", schema: verdictSchema});

function validSelection(sel, clipFrameCounts) {
  if (!sel || !Array.isArray(sel.slots) || sel.slots.length !== 7) return false;
  let cursor = 0;
  const seen = new Set();
  for (let i = 0; i < 7; i++) {
    const s = sel.slots[i];
    if (!s || s.slot !== i + 1) return false;
    if (!/^\d{2}$/.test(s.source) || seen.has(s.source)) return false;
    seen.add(s.source);
    const [a, b] = s.source_frames, [c, d] = s.output_frames;
    if (![a, b, c, d].every(Number.isInteger)) return false;
    if (!(a >= 0 && b > a)) return false;
    const fc = clipFrameCounts[s.source];
    if (fc !== undefined && b > fc) return false;
    if (!(c === cursor && d === c + (b - a))) return false;
    if (s.closest_alternative === s.source || !s.reason || !s.reason.trim()) return false;
    cursor = d;
  }
  return cursor === TOTAL_FRAMES;
}

const clipFrameCounts = {};
matches.forEach(m => { clipFrameCounts[m.source] = m.clip_frame_count; });

let verdict = await verify();
let repairs = 0;
while (verdict && !verdict.passed && repairs < maxRepairs) {
  log(`Verification failed; repair round ${repairs + 1}: ${verdict.issues.join("; ")}`);
  const repaired = await agent(repairPrompt(verdict.issues, currentSelection),
    {label: `repair-${repairs + 1}`, phase: "Verify and repair", schema: repairSchema});
  if (repaired === null || !repaired.fixed) {
    return {status: "unresolved", reason: "repair failed", verdict, selection: currentSelection, segments};
  }
  if (validSelection(repaired.selection, clipFrameCounts)) {
    currentSelection = repaired.selection;
  } else {
    log("Repair returned an invalid selection object; keeping previous plan");
  }
  verdict = await verify();
  repairs++;
}

return {
  status: (verdict && verdict.passed) ? "verified" : "unresolved",
  selection: currentSelection,
  segments,
  verdict,
  repairs_attempted: repairs,
  missing_screens: clipIds.filter((id, i) => screened[i] === null),
  match_confidence: matches.map(m => ({slot: m.slot, source: m.source, confidence: m.confidence}))
};