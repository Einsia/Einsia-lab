export const meta = {
  name: "cdc-a-x04-machine-runaway-cut",
  description: "Match 44 anonymous clips to 6 storyboard slots, align frame-precise change points to accent frames, assemble and verify the 6-slot cut",
  phases: [
    {title: "Screen candidates", detail: "Batch-inspect all 44 clips: frame counts, shots, change events, plausible slots"},
    {title: "Match slots", detail: "Assign one clip and a frame-precise change point to each of the 6 slots; adjudicate conflicts"},
    {title: "Validate plan", detail: "Distinctness, accent-frame arithmetic, feasibility, independent per-slot change-point review"},
    {title: "Assemble deliverables", detail: "Frame-exact trim, concat, encode solution.mp4; write solution.json and events.csv"},
    {title: "Verify and repair", detail: "Frame-level verification of output against declared source ranges; bounded repair loop"}
  ]
};

const maxRepairs = (args && Number.isFinite(args.maxRepairs)) ? args.maxRepairs : 2;

// Public beat map (input/beats.json) — also confirmed on disk by workers.
const BEATS = {
  fps: 30,
  total_frames: 858,
  slots: [
    {slot: 1, start_frame: 0,   end_frame: 150, accent_frame: 72},
    {slot: 2, start_frame: 150, end_frame: 276, accent_frame: 204},
    {slot: 3, start_frame: 276, end_frame: 420, accent_frame: 360},
    {slot: 4, start_frame: 420, end_frame: 534, accent_frame: 480},
    {slot: 5, start_frame: 534, end_frame: 690, accent_frame: 630},
    {slot: 6, start_frame: 690, end_frame: 858, accent_frame: 780}
  ]
};

const SLOTS = [
  {slot: 1, title: "Overload", text: "In a pitch-black void, a lanky young man and a bald old man stand side by side on a small floating platform; full-figure long shot, camera essentially locked. Change: a blinding flash, and the surroundings turn from total black into a bright, heavily motion-blurred grey-white space, the two still standing on the platform."},
  {slot: 2, title: "Power cut", text: "An open square hatch in a green tiled wall with a lamp lit inside it; close shot, locked camera. A tiled panel slides down over the hatch and a pair of gloved hands presses it flat. Change: the picture drops to full black; afterwards a wide engine room slowly emerges from the dark with two figures standing in it."},
  {slot: 3, title: "Intrusion", text: "An empty square room with bare walls; frontal symmetrical long shot, locked camera; the young man swings his arms in the middle of the room. Change: dark cables pour out of the left corner and crawl over the left wall."},
  {slot: 4, title: "Breach", text: "A tilted low-angle close shot hugging a tiled wall with a metal pipe running along it; the camera slides along the wall. Change: cables burst through the wall, debris flies, and the warm orange, cable-filled space behind it is fully revealed."},
  {slot: 5, title: "Encirclement", text: "The bald old man stands alone before a golden curtain of vertically flowing light, hands clutching his head; medium shot, camera essentially locked. Change: the curtain behind him turns into rows of dark machinery studded with red indicator lights."},
  {slot: 6, title: "Failure", text: "The old man stands alone in diagonally falling streaks of light; full-figure long shot, the camera settling to rest. Change: the warm orange light of the whole scene drains away into a dim, cold green."}
];
const STORYBOARD = SLOTS.map(s => "Slot " + s.slot + " | " + s.title + ". " + s.text).join("\n");

const clips = [];
for (let i = 1; i <= 44; i++) clips.push(String(i).padStart(2, "0"));
const batches = [];
for (let i = 0; i < clips.length; i += 8) batches.push(clips.slice(i, i + 8));

// ---------- schemas ----------
const shotItem = {
  type: "object",
  properties: {start: {type: "integer"}, end: {type: "integer"}, description: {type: "string"}},
  required: ["start", "end", "description"], additionalProperties: false
};
const eventItem = {
  type: "object",
  properties: {frame: {type: "integer"}, description: {type: "string"}},
  required: ["frame", "description"], additionalProperties: false
};
const screenSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          frames: {type: "integer"},
          summary: {type: "string"},
          shots: {type: "array", items: shotItem},
          change_events: {type: "array", items: eventItem},
          possible_slots: {type: "array", items: {type: "integer"}}
        },
        required: ["clip", "frames", "summary", "shots", "change_events", "possible_slots"],
        additionalProperties: false
      }
    }
  },
  required: ["clips"], additionalProperties: false
};
const altItem = {
  type: "object",
  properties: {source: {type: "string"}, change_frame: {type: "integer"}, reason: {type: "string"}},
  required: ["source", "change_frame", "reason"], additionalProperties: false
};
const assignmentItem = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    source: {type: "string", pattern: "^[0-9]{2}$"},
    change_frame: {type: "integer", minimum: 0},
    source_frames_total: {type: "integer"},
    confidence: {type: "string", enum: ["high", "medium", "low"]},
    evidence: {type: "string"},
    alternatives: {type: "array", items: altItem}
  },
  required: ["slot", "source", "change_frame", "source_frames_total", "confidence", "evidence", "alternatives"],
  additionalProperties: false
};
const matchSchema = assignmentItem;
const adjudicateSchema = {
  type: "object",
  properties: {assignments: {type: "array", items: assignmentItem}},
  required: ["assignments"], additionalProperties: false
};
const reviewSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    verdict: {type: "string", enum: ["ok", "correct_frame", "wrong_clip"]},
    corrected_change_frame: {type: ["integer", "null"]},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["slot", "verdict", "corrected_change_frame", "issues"],
  additionalProperties: false
};
const segItem = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    source: {type: "string"},
    source_frames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
    output_frames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
    change_source_frame: {type: "integer"},
    accent_frame: {type: "integer"}
  },
  required: ["slot", "source", "source_frames", "output_frames", "change_source_frame", "accent_frame"],
  additionalProperties: false
};
const buildSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    frame_count: {type: "integer"},
    files: {type: "array", items: {type: "string"}},
    issues: {type: "array", items: {type: "string"}},
    segments: {type: "array", items: segItem}
  },
  required: ["ok", "frame_count", "files", "issues"],
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

// ---------- helpers ----------
function segFor(beat, changeFrame) {
  const len = beat.end_frame - beat.start_frame;
  const a = changeFrame - (beat.accent_frame - beat.start_frame);
  return {a: a, b: a + len};
}
let clipData = {};
let assignments = [null, null, null, null, null, null];
function framesOf(src) {
  const d = clipData[src];
  if (d && Number.isInteger(d.frames) && d.frames > 0) return d.frames;
  const a = assignments.find(x => x && x.source === src);
  if (a && Number.isInteger(a.source_frames_total) && a.source_frames_total > 0) return a.source_frames_total;
  return null;
}
function segEntry(a) {
  const beat = BEATS.slots[a.slot - 1];
  const seg = segFor(beat, a.change_frame);
  return {
    slot: a.slot,
    source: a.source,
    source_frames: [seg.a, seg.b],
    output_frames: [beat.start_frame, beat.end_frame],
    change_source_frame: a.change_frame,
    accent_frame: beat.accent_frame
  };
}
function digest() {
  return JSON.stringify(clips.map(c => clipData[c] ? {
    clip: c,
    frames: clipData[c].frames,
    summary: clipData[c].summary,
    shots: clipData[c].shots,
    change_events: clipData[c].change_events,
    possible_slots: clipData[c].possible_slots
  } : {clip: c, unscreened: true}));
}
function assignmentProblems(as) {
  const probs = [];
  for (let i = 0; i < 6; i++) {
    const a = as[i];
    if (!a) { probs.push("slot " + (i + 1) + ": no assignment"); continue; }
    if (a.slot !== i + 1) probs.push("slot " + (i + 1) + ": mismatched slot id " + a.slot);
    if (!/^[0-9]{2}$/.test(a.source)) probs.push("slot " + (i + 1) + ": invalid source id " + a.source);
    const beat = BEATS.slots[i];
    const seg = segFor(beat, a.change_frame);
    const fr = framesOf(a.source);
    if (seg.a < 0) probs.push("slot " + (i + 1) + ": source " + a.source + " change_frame " + a.change_frame + " infeasible (sub-range would start at " + seg.a + " < 0)");
    if (fr != null && seg.b > fr) probs.push("slot " + (i + 1) + ": source " + a.source + " change_frame " + a.change_frame + " infeasible (sub-range ends at " + seg.b + " > " + fr + " frames)");
  }
  const srcs = as.filter(Boolean).map(a => a.source);
  if (srcs.length !== 6 || new Set(srcs).size !== srcs.length) {
    const dup = [...new Set(srcs.filter((s, j) => srcs.indexOf(s) !== j))];
    probs.push("sources are not 6 distinct clips (duplicates: " + (dup.join(", ") || "unknown") + ")");
  }
  return probs;
}

// ---------- prompts ----------
function screenPrompt(batch) {
  return `You are screening candidate video clips for a 6-slot film-edit task. First read instruction.md in the workspace for full context. Use bash with ffmpeg/ffprobe; view extracted PNG frames with your image-viewing tool. Do NOT modify anything under input/. Put intermediates under work/ (create it if needed).

Clips to screen (under input/clips/): ${batch.map(c => c + ".mp4").join(", ")}

For EACH clip in the batch:
1. Get the exact decoded frame count:
   ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1 input/clips/XX.mp4
   Also confirm 1280x720 and 30 fps.
2. Extract viewable frames at a workable density, e.g.:
   mkdir -p work/screen/XX && ffmpeg -v error -i input/clips/XX.mp4 -vf fps=3 work/screen/XX/f%04d.png
   Increase density (up to every frame) around interesting moments.
3. Find internal cuts (a clip may contain several shots from the original film):
   ffmpeg -v info -i input/clips/XX.mp4 -vf "select='gt(scene,0.3)',showinfo" -f null - 2>&1 | grep showinfo
   (multiply pts_time by 30 to get frame numbers).
4. Get a per-frame average-luma series to spot flashes, cut-to-black, and color drains:
   ffmpeg -v info -i input/clips/XX.mp4 -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -f null -
5. Look at the frames and describe every shot: setting, characters (e.g. lanky young man, bald old man, gloved hands), camera behavior (locked / sliding along a wall / settling to rest), and any state change.

Report for each clip: exact decoded frame count; a one-paragraph summary; a shot list with approximate 0-based half-open frame ranges; change_events with best frame estimates (blinding flash to grey-white, tiled panel sliding over a hatch then cut to full black, cables pouring from a corner and crawling a wall, cables bursting through a wall with debris revealing a warm orange cable-filled space, a golden light curtain turning into dark machinery with red indicator lights, warm orange light draining to dim cold green, etc.); and which storyboard slots (1-6) the clip could plausibly serve (possibly none).

The 6 storyboard slots:
${STORYBOARD}

All frame numbers are 0-based decoded frame indices. Be concrete and quantitative. Return strictly via the JSON schema, one entry per clip in your batch.`;
}

function matchPrompt(beat, exclude) {
  const sb = SLOTS[beat.slot - 1];
  const len = beat.end_frame - beat.start_frame;
  const lead = beat.accent_frame - beat.start_frame;
  return `You are assigning one candidate clip to one storyboard slot of a film-edit task. First read instruction.md for full context. Use bash with ffmpeg/ffprobe; view extracted frames with your image-viewing tool. Do NOT modify input/ or output/.

YOUR SLOT — Slot ${beat.slot} | ${sb.title}: ${sb.text}

Slot timing in the final cut: output frames [${beat.start_frame}, ${beat.end_frame}) (length ${len} frames); accent_frame = ${beat.accent_frame}. The slot's change point MUST land exactly on output frame ${beat.accent_frame}.

Screening digest of all 44 candidate clips (JSON; treat it as a lead, not proof — verify by inspecting the actual clips):
${digest()}

${exclude.length ? "The following clip(s) were already tried and rejected for this slot and MUST NOT be chosen: " + exclude.join(", ") + "\n\n" : ""}Procedure:
1. Shortlist clips whose content matches this slot's description (setting, characters, camera behavior, and the specific change). Verify each shortlisted clip directly: extract dense frame sequences (e.g. ffmpeg -v error -i input/clips/XX.mp4 -vf "select='between(n,A,B)'" -vsync 0 work/match${beat.slot}/f%03d.png) and view them; use the signalstats luma series for flash / blackout / color-drain changes.
2. Choose the single best candidate. The slot's change must be the MAIN content of your sub-range: the state before the change, the change itself, and the state after it must all appear inside the sub-range. Because slot lengths are fixed, brief adjacent shots at the very head or tail of the sub-range (from the candidate's internal cuts) are allowed, but nothing more.
3. Pin down the change point frame s with frame precision: s is the FIRST 0-based decoded frame at which the later state of the slot's change holds (frame s-1 still shows the earlier state). Inspect consecutive frames s-2..s+3 individually to confirm. For a gradual change, s is the first frame at which the later state is fully established as described. The slot description above tells you exactly what the "later state" is.
4. Check alignment feasibility. The source sub-range will be [a, a+${len}) with a = s - ${lead}. You need 0 <= a and a + ${len} <= clip decoded frame count. If the best clip is infeasible at its TRUE change frame, it cannot serve this slot: pick a different clip. Never shift s just to make the arithmetic fit.
5. Report the clip's exact decoded frame count, your confidence, concrete visual evidence (what you saw at which frames), and runner-up alternatives with their change frames.

Return strictly via the JSON schema. source is the two-digit clip stem like "07"; change_frame is the 0-based source frame of the change point; slot must be ${beat.slot}.`;
}

function adjudicatePrompt(as, probs) {
  return `Resolve assignment conflicts in a 6-slot film-edit task. First read instruction.md for full context. Use bash with ffmpeg/ffprobe; view frames with your image-viewing tool. Do NOT modify input/ or output/.

Requirement: exactly 6 DISTINCT candidate clips, one per slot, each with a frame-precise change point, such that the accent alignment is feasible.

Current assignments (slot, source, change_frame, confidence, evidence):
${JSON.stringify(as.filter(Boolean).map(a => ({slot: a.slot, source: a.source, change_frame: a.change_frame, confidence: a.confidence, evidence: a.evidence})), null, 1)}

Problems to fix:
${probs.map(p => "- " + p).join("\n")}

Screening digest of all 44 clips:
${digest()}

Slot descriptions:
${STORYBOARD}

Inspect the actual clips with ffmpeg (extract and view frames; luma series via signalstats) as needed. Change only what must change: keep assignments that are fine, and reassign the conflicting slots to OTHER clips that genuinely match their slot descriptions. For every slot you (re)assign, determine the change point frame s = the first 0-based decoded frame at which the later state holds, and check feasibility: a = s - (accent_frame - start_frame) must be >= 0 and a + (end_frame - start_frame) <= clip decoded frame count. Slot beats: ${JSON.stringify(BEATS.slots)}.

Return assignments for ALL 6 slots strictly via the JSON schema.`;
}

function reviewPrompt(seg) {
  const beat = BEATS.slots[seg.slot - 1];
  const sb = SLOTS[seg.slot - 1];
  const fr = framesOf(seg.source);
  return `Independent verification of ONE slot assignment in a film-edit task. First read instruction.md for context. Use bash with ffmpeg/ffprobe; view frames with your image-viewing tool. Do NOT modify input/ or output/ — you are a checker only.

Slot ${seg.slot} | ${sb.title}: ${sb.text}

Current assignment: source clip input/clips/${seg.source}.mp4 (about ${fr == null ? "unknown" : fr} decoded frames); change point at source frame s = ${seg.change_source_frame}; proposed source sub-range [${seg.source_frames[0]}, ${seg.source_frames[1]}); output sub-range [${beat.start_frame}, ${beat.end_frame}); accent frame ${beat.accent_frame} (the change lands there by construction: output frame = ${beat.start_frame} + (n - ${seg.source_frames[0]})). Slot beat: ${JSON.stringify(beat)}.

Verify by inspecting the actual clip:
1. Does the clip's content match the slot description (setting, characters, camera behavior, and the specific change)?
2. Extract and individually view consecutive frames around s (at least s-3..s+3, e.g. ffmpeg -v error -i input/clips/${seg.source}.mp4 -vf "select='between(n,${Math.max(0, seg.change_source_frame - 3)},${seg.change_source_frame + 3}')'" -vsync 0 work/rev${seg.slot}/f%02d.png): is s the FIRST frame at which the later state holds, with s-1 still in the earlier state? For a gradual change, is s the first frame where the later state is fully established as described?
3. Sample frames inside the proposed sub-range before and after the change: are the before-state, the change, and the after-state the main content of [${seg.source_frames[0]}, ${seg.source_frames[1]})? (Brief adjacent shots at the very head/tail are acceptable.)

Verdicts:
- "ok": everything checks out.
- "correct_frame": the clip is right but the change point is at a different source frame; give corrected_change_frame as the 0-based source frame you judge correct.
- "wrong_clip": this clip does not fit this slot; explain precisely in issues.

Return strictly via the JSON schema with slot = ${seg.slot}.`;
}

function buildPrompt(segments) {
  return `Assemble the final deliverables of a film-edit task. First read instruction.md for the full spec. Use bash with ffmpeg/ffprobe. Put intermediates in work/ and deliverables in output/ (create the dirs; output/ must end up containing EXACTLY the 3 files solution.mp4, solution.json, events.csv — nothing else).

Segment plan (all ranges half-open, 0-based decoded frame indices):
${JSON.stringify(segments, null, 1)}

The 6 slots tile [0, 858) in slot order with hard cuts at the slot boundaries; total_frames = 858; each change point lands on its slot's accent frame by construction.

Steps:
1. For each slot, cut the source sub-range frame-exactly, e.g. for slot k with source SS and range [A,B):
   ffmpeg -v error -i input/clips/SS.mp4 -vf "trim(start_frame=A:end_frame=B),setpts=PTS-STARTPTS" -an -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p work/segk.mp4
   Verify each segment's decoded frame count equals its slot length:
   ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1 work/segk.mp4
   If a count is off by one or more, fix the trim (do NOT pad, drop, duplicate or retime frames).
2. Concatenate the segments in slot order into output/solution.mp4 (concat demuxer with -c copy if all segments share codec parameters, otherwise re-encode at CRF <= 16). Requirements: H.264, yuv420p, 1280x720, SAR 1:1 (add setsar=1 if needed), constant 30/1 fps, NO audio stream, exactly 858 decoded frames. Verify with ffprobe -count_frames.
3. Write output/solution.json exactly as {"segments":[...]} with 6 objects in slot order, each {"slot":k,"source":"SS","source_frames":[a,b],"output_frames":[c,d]} taken from the plan above.
4. Write output/events.csv: header line "slot,source,source_frame,output_frame" then exactly one row per slot: slot k, source SS, source_frame = that segment's change_source_frame from the plan, output_frame = that segment's accent_frame.
5. Final self-check: output/ contains exactly the 3 files; solution.mp4 has exactly 858 decoded frames, no audio, correct codec/pixel format/SAR/fps.

Return strictly via the JSON schema: ok, the measured decoded frame count of output/solution.mp4, the files present in output/, any issues, and (only if you had to deviate from the plan) an updated segments array in the same format.`;
}

function verifyPrompt(segments) {
  return `Verify the deliverables of a film-edit task against instruction.md and the declared plan. Use bash with ffmpeg/ffprobe; view frames with your image-viewing tool. Do NOT modify output/ or input/ — you are a checker only.

Declared plan:
${JSON.stringify(segments, null, 1)}

Slot beats from input/beats.json: ${JSON.stringify(BEATS.slots)} (total_frames 858, fps 30).

Checks:
1. output/ contains exactly solution.mp4, solution.json, events.csv and nothing else.
2. ffprobe output/solution.mp4 (use -count_frames): codec h264, pix_fmt yuv420p, 1280x720, sample_aspect_ratio 1:1, avg_frame_rate 30/1, no audio streams, nb_read_frames exactly 858.
3. solution.json parses and has exactly 6 segment objects in slot order with keys slot/source/source_frames/output_frames; output_frames tile [0,858) exactly at the beat boundaries (0-150, 150-276, 276-420, 420-534, 534-690, 690-858); each segment length equals its slot length; the 6 sources are distinct two-digit stems that exist as input/clips/SS.mp4; each source range lies within that clip's decoded frame count (measure with ffprobe -count_frames).
4. events.csv: header "slot,source,source_frame,output_frame"; exactly 6 rows in slot order; each row's output_frame equals that slot's accent_frame (72, 204, 360, 480, 630, 780) and source_frame equals source_frames[0] + (accent_frame - output_frames[0]).
5. Frame-level correspondence per slot: compare output frames [c,d) against source clip frames [a,b), e.g.:
   ffmpeg -v error -i output/solution.mp4 -i input/clips/SS.mp4 -filter_complex "[0:v]trim(start_frame=C:end_frame=D),setpts=PTS-STARTPTS[o];[1:v]trim(start_frame=A:end_frame=B),setpts=PTS-STARTPTS[s];[o][s]psnr" -f null -
   A CRF<=18 re-encode should still yield very high PSNR; also visually spot-check the first, middle and last frame of each slot by extracting PNGs from both output and source and viewing them side by side.
6. Change-point plausibility: for each slot, view source frames around the declared source_frame (s-2..s+2): s should be the first frame at which the slot's later state holds, and s-1 should still show the earlier state.

Report passed=true ONLY if all checks pass. Otherwise list precise, actionable issues (file, slot, what is wrong, how to fix). Return strictly via the JSON schema.`;
}

function repairPrompt(segments, issues) {
  return `Repair the deliverables of a film-edit task in the workspace. First read instruction.md for the full spec. Use bash with ffmpeg/ffprobe; view frames with your image-viewing tool.

Current segment plan:
${JSON.stringify(segments, null, 1)}

Issues found by verification:
${issues.map(i => "- " + i).join("\n")}

Fix the issues directly in output/ (and work/ as needed). Keep the same segment plan unless an issue requires changing it; if you change any source clip or change point, the new plan must still use 6 distinct clips, keep each change point on its slot's accent_frame (a = change_frame - (accent_frame - start_frame) must be >= 0 and a + slot_length <= clip frames), and you must rebuild solution.mp4, solution.json and events.csv consistently. output/ must end up containing exactly solution.mp4, solution.json, events.csv, with solution.mp4 = H.264, yuv420p, 1280x720, SAR 1:1, constant 30/1 fps, no audio, exactly 858 decoded frames.

Return strictly via the JSON schema: ok, measured decoded frame count of output/solution.mp4, files present in output/, remaining issues, and (if the plan changed) the updated segments array in the same format.`;
}

// ---------- Phase 1: screening ----------
phase("Screen candidates");
log("Screening 44 candidate clips in " + batches.length + " batches");
const screenResults = await parallel(batches.map(b => () =>
  agent(screenPrompt(b), {label: "screen-" + b[0] + "-" + b[b.length - 1], phase: "Screen candidates", schema: screenSchema})
));
for (const r of screenResults) {
  if (r && Array.isArray(r.clips)) for (const c of r.clips) if (c && c.clip) clipData[c.clip] = c;
}
let unscreened = clips.filter(c => !clipData[c]);
if (unscreened.length) {
  log("Re-screening missed clips: " + unscreened.join(","));
  const chunks = [];
  for (let i = 0; i < unscreened.length; i += 8) chunks.push(unscreened.slice(i, i + 8));
  const redo = await parallel(chunks.map(b => () =>
    agent(screenPrompt(b), {label: "rescreen-" + b[0] + "-" + b[b.length - 1], phase: "Screen candidates", schema: screenSchema})
  ));
  for (const r of redo) {
    if (r && Array.isArray(r.clips)) for (const c of r.clips) if (c && c.clip) clipData[c.clip] = c;
  }
  unscreened = clips.filter(c => !clipData[c]);
}
if (unscreened.length) log("WARNING: clips never screened (match workers must consider them directly): " + unscreened.join(","));

// ---------- Phase 2: slot matching ----------
phase("Match slots");
const firstMatch = await parallel(BEATS.slots.map(beat => () =>
  agent(matchPrompt(beat, []), {label: "match-slot-" + beat.slot, phase: "Match slots", schema: matchSchema})
));
assignments = firstMatch.map((r, i) => (r && r.slot >= 1 && r.slot <= 6 && /^[0-9]{2}$/.test(r.source)) ? r : null);
const matchMissing = assignments.map((a, i) => a ? null : (i + 1)).filter(x => x);
if (matchMissing.length) {
  log("Re-running match for failed slots: " + matchMissing.join(","));
  const redo = await parallel(matchMissing.map(k => () =>
    agent(matchPrompt(BEATS.slots[k - 1], []), {label: "rematch-slot-" + k, phase: "Match slots", schema: matchSchema})
  ));
  for (let j = 0; j < matchMissing.length; j++) {
    const r = redo[j];
    if (r && r.slot >= 1 && r.slot <= 6 && /^[0-9]{2}$/.test(r.source)) assignments[matchMissing[j] - 1] = r;
  }
}

let probs = assignmentProblems(assignments);
for (let round = 0; probs.length && round < 2; round++) {
  log("Assignment problems (adjudication round " + (round + 1) + "): " + probs.join(" | "));
  const adj = await agent(adjudicatePrompt(assignments, probs), {label: "adjudicate-" + (round + 1), phase: "Match slots", schema: adjudicateSchema});
  if (adj && Array.isArray(adj.assignments)) {
    const bySlot = {};
    for (const a of adj.assignments) {
      if (a && a.slot >= 1 && a.slot <= 6 && /^[0-9]{2}$/.test(a.source)) bySlot[a.slot] = a;
    }
    assignments = BEATS.slots.map((b, i) => bySlot[i + 1] || assignments[i]);
  }
  probs = assignmentProblems(assignments);
}
if (probs.length) {
  return {status: "unresolved", stage: "assignment", problems: probs, assignments: assignments, unscreenedClips: unscreened};
}

// ---------- Phase 3: independent per-slot review ----------
phase("Validate plan");
const excluded = {1: [], 2: [], 3: [], 4: [], 5: [], 6: []};
const reviewNotes = [];
for (let round = 0; round < 2; round++) {
  const reviews = await parallel(assignments.map((a, i) => () =>
    agent(reviewPrompt(segEntry(a)), {label: "review-slot-" + (i + 1) + "-r" + (round + 1), phase: "Validate plan", schema: reviewSchema})
  ));
  let changed = false;
  const wrongSlots = [];
  for (let i = 0; i < 6; i++) {
    const rv = reviews[i];
    const a = assignments[i];
    if (!rv) { reviewNotes.push("slot " + (i + 1) + ": review worker failed; assignment kept unreviewed"); continue; }
    if (rv.verdict === "correct_frame" && Number.isInteger(rv.corrected_change_frame)) {
      const beat = BEATS.slots[i];
      const seg = segFor(beat, rv.corrected_change_frame);
      const fr = framesOf(a.source);
      if (seg.a >= 0 && (fr == null || seg.b <= fr)) {
        if (rv.corrected_change_frame !== a.change_frame) {
          reviewNotes.push("slot " + (i + 1) + ": change point corrected " + a.change_frame + " -> " + rv.corrected_change_frame + " (source " + a.source + ")");
          changed = true;
        }
        a.change_frame = rv.corrected_change_frame;
      } else {
        reviewNotes.push("slot " + (i + 1) + ": corrected change frame infeasible for source " + a.source + "; re-matching");
        excluded[i + 1].push(a.source);
        wrongSlots.push(i);
      }
    } else if (rv.verdict === "wrong_clip") {
      reviewNotes.push("slot " + (i + 1) + ": reviewer rejected source " + a.source + ": " + (rv.issues || []).join("; "));
      excluded[i + 1].push(a.source);
      wrongSlots.push(i);
    }
  }
  if (wrongSlots.length) {
    const rematch = await parallel(wrongSlots.map(i => () =>
      agent(matchPrompt(BEATS.slots[i], excluded[i + 1]), {label: "rematch-slot-" + (i + 1), phase: "Validate plan", schema: matchSchema})
    ));
    for (let j = 0; j < wrongSlots.length; j++) {
      const r = rematch[j];
      if (r && r.slot >= 1 && r.slot <= 6 && /^[0-9]{2}$/.test(r.source)) assignments[wrongSlots[j]] = r;
    }
    probs = assignmentProblems(assignments);
    if (probs.length) {
      const adj = await agent(adjudicatePrompt(assignments, probs), {label: "adjudicate-post-review", phase: "Validate plan", schema: adjudicateSchema});
      if (adj && Array.isArray(adj.assignments)) {
        const bySlot = {};
        for (const a of adj.assignments) {
          if (a && a.slot >= 1 && a.slot <= 6 && /^[0-9]{2}$/.test(a.source)) bySlot[a.slot] = a;
        }
        assignments = BEATS.slots.map((b, i) => bySlot[i + 1] || assignments[i]);
      }
      probs = assignmentProblems(assignments);
    }
    changed = true;
  }
  if (!changed) break;
}

probs = assignmentProblems(assignments);
if (probs.length) {
  return {status: "unresolved", stage: "review", problems: probs, assignments: assignments, reviewNotes: reviewNotes, unscreenedClips: unscreened};
}

// ---------- Phase 4: assembly ----------
let segments = assignments.map(a => segEntry(a));
log("Final plan: " + JSON.stringify(segments));
phase("Assemble deliverables");
let built = await agent(buildPrompt(segments), {label: "assemble", phase: "Assemble deliverables", schema: buildSchema});
if (built === null) {
  return {status: "unresolved", stage: "assembly", reason: "assembly worker failed", segments: segments, reviewNotes: reviewNotes};
}
if (Array.isArray(built.segments) && built.segments.length === 6) {
  const okPlan = built.segments.every(s =>
    s && s.slot >= 1 && s.slot <= 6 && /^[0-9]{2}$/.test(s.source) &&
    Array.isArray(s.source_frames) && Array.isArray(s.output_frames)
  );
  const outs = built.segments.map(s => s.output_frames);
  const tiles = outs.every((o, i) => o[0] === BEATS.slots[i].start_frame && o[1] === BEATS.slots[i].end_frame);
  const distinct = new Set(built.segments.map(s => s.source)).size === 6;
  if (okPlan && tiles && distinct) {
    segments = built.segments.map(s => ({
      slot: s.slot, source: s.source,
      source_frames: [s.source_frames[0], s.source_frames[1]],
      output_frames: [s.output_frames[0], s.output_frames[1]],
      change_source_frame: s.change_source_frame != null ? s.change_source_frame : s.source_frames[0] + (BEATS.slots[s.slot - 1].accent_frame - s.output_frames[0]),
      accent_frame: BEATS.slots[s.slot - 1].accent_frame
    }));
    log("Assembly worker revised the segment plan; adopted: " + JSON.stringify(segments));
  } else {
    reviewNotes.push("assembly worker proposed an invalid revised plan; kept original plan");
  }
}

// ---------- Phase 5: verification and repair ----------
phase("Verify and repair");
const verify = () => agent(verifyPrompt(segments), {label: "verify", phase: "Verify and repair", schema: verdictSchema});
let verdict = await verify();
for (let r = 0; verdict && !verdict.passed && verdict.issues && verdict.issues.length && r < maxRepairs; r++) {
  log("Verification failed (round " + (r + 1) + "): " + verdict.issues.join(" | "));
  const rep = await agent(repairPrompt(segments, verdict.issues), {label: "repair-" + (r + 1), phase: "Verify and repair", schema: buildSchema});
  if (rep === null) break;
  if (Array.isArray(rep.segments) && rep.segments.length === 6) {
    const okPlan = rep.segments.every(s =>
      s && s.slot >= 1 && s.slot <= 6 && /^[0-9]{2}$/.test(s.source) &&
      Array.isArray(s.source_frames) && Array.isArray(s.output_frames)
    );
    const tiles = rep.segments.every((s, i) => s.output_frames[0] === BEATS.slots[i].start_frame && s.output_frames[1] === BEATS.slots[i].end_frame);
    const distinct = new Set(rep.segments.map(s => s.source)).size === 6;
    if (okPlan && tiles && distinct) {
      segments = rep.segments.map(s => ({
        slot: s.slot, source: s.source,
        source_frames: [s.source_frames[0], s.source_frames[1]],
        output_frames: [s.output_frames[0], s.output_frames[1]],
        change_source_frame: s.change_source_frame != null ? s.change_source_frame : s.source_frames[0] + (BEATS.slots[s.slot - 1].accent_frame - s.output_frames[0]),
        accent_frame: BEATS.slots[s.slot - 1].accent_frame
      }));
    }
  }
  verdict = await verify();
}

const events = segments.map(s => ({
  slot: s.slot, source: s.source,
  source_frame: s.change_source_frame, output_frame: s.accent_frame
}));

if (!verdict) {
  return {status: "unresolved", stage: "verification", reason: "verifier returned no result", segments: segments, events: events, reviewNotes: reviewNotes, unscreenedClips: unscreened};
}
return {
  status: verdict.passed ? "verified" : "unresolved",
  segments: segments,
  events: events,
  build: {ok: built.ok, frame_count: built.frame_count, files: built.files, issues: built.issues},
  verdict: verdict,
  reviewNotes: reviewNotes,
  unscreenedClips: unscreened
};