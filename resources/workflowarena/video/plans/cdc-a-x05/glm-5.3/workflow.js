export const meta = {
  name: "cdc-a-x05-assembly",
  description: "Survey 45 anonymous candidate clips, map them to 7 ordered narrative slots, choose compliant contiguous sub-ranges that total exactly 1248 frames, render output/solution.mp4, and verify the deliverables frame by frame.",
  phases: [
    {title: "Probe", detail: "ffprobe metadata plus internal-cut detection for all 45 candidates"},
    {title: "Survey", detail: "Per-clip visual inspection and slot hypotheses via sampled frames"},
    {title: "Match", detail: "Assign one distinct candidate to each of the 7 slots"},
    {title: "Verify ranges", detail: "Confirm each slot's beats in order and derive compliant min/max sub-ranges"},
    {title: "Allocate", detail: "Fit the 7 segment lengths to exactly 1248 output frames"},
    {title: "Render", detail: "Trim, concatenate, encode, and write solution.mp4 + solution.json"},
    {title: "Verify deliverables", detail: "Spec and frame-by-frame verification with repair rounds"}
  ]
};

// ---------------------------------------------------------------- constants

const TOTAL_FRAMES = 1248;
const ALL_CLIPS = Array.from({length: 45}, (_, i) => String(i + 1).padStart(2, "0"));
const MARGIN = 12; // frames required between segment in/out points and any internal cut

const SHOT_LIST = [
  "Slot 1 - Waking: opening; establish the protagonist and his home, bringing him on stage out of darkness. Content: the mouth of a burrow, at first completely dark inside; the protagonist's face gradually emerges from the darkness and his ears rise. Hard cut to a side wide shot: he crawls out of the hole, stands up and stretches. Camera: medium shot of the burrow at eye level; side wide shot from a slightly low camera; both locked off.",
  "Slot 2 - Greeting the morning: establish his good mood. Content: looking up at the sky, the protagonist rises into frame from the bottom edge and stretches; cut to a medium close-up of him against treetops and sky, smiling contentedly. Camera: low-angle upshot, then an eye-level medium close-up; locked off.",
  "Slot 3 - Absorbed: he is lost in nature, while hinting that someone is watching. Content: white flowers in the foreground; the protagonist walks up from the distance and leans in to smell them; cut to a wide shot of him from behind; then a shot through leaves, past a dark blurred foreground shape, toward the small distant protagonist; finally a close-up of him smelling the flowers, enraptured. Camera: medium shot with foreground occlusion, wide shot, voyeuristic wide shot with foreground occlusion, close-up.",
  "Slot 4 - A tender contact: his gentlest moment, foreshadowing a later loss. Content: the protagonist faces camera; a purple butterfly flies in from off-screen, settles on the tip of his nose, then lifts off and circles him while he breaks into an open-mouthed laugh; cut to his back as he walks toward a large tree in the distance. Camera: medium close-up, locked off; then a full shot from behind.",
  "Slot 5 - The threat gathers: the antagonists appear and gather. Content: behind a fallen tree trunk, at first only one grey, fluffy small animal is present; a red small animal then joins it, and a third climbs out over the top of the trunk; a fruit they were holding drops onto the grass. Camera: low-camera medium shot, a single locked-off shot.",
  "Slot 6 - The strike: the conflict erupts; cause and effect complete within one segment. Content: starts with the throw from behind the trunk, a fruit flying out of frame; cut to a wide shot of the protagonist alone in the meadow, struck by fruit after fruit, the last one - a red fruit - landing squarely on top of his head; cut back behind the trunk, where they keep throwing. Camera: low medium shot behind the trunk, eye-level wide shot, medium shot again.",
  "Slot 7 - Humiliation: ending - the protagonist routed, his tormentors triumphant. Content: a wide shot of an empty meadow and a large tree; the protagonist dashes in from frame left and runs for the trunk through a hail of falling green fruit; cut to beside the trunk, where he hides and peers out, shaken; cut to a wide shot of the three small animals jumping for joy under a tree. Camera: wide shot, medium shot beside the trunk, wide shot."
].join("\n\n");

// ---------------------------------------------------------------- schemas

const probeSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    probeFile: {type: "string"},
    clipsProbed: {type: "integer"},
    problems: {type: "array", items: {type: "string"}}
  },
  required: ["ok", "probeFile", "clipsProbed", "problems"],
  additionalProperties: false
};

const surveySchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clip: {type: "string"},
          frameCount: {type: "integer"},
          summary: {type: "string"},
          shots: {type: "array", items: {type: "string"}},
          subjects: {type: "string"},
          setting: {type: "string"},
          candidateSlots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slot: {type: "integer"},
                confidence: {type: "number"},
                reason: {type: "string"}
              },
              required: ["slot", "confidence", "reason"],
              additionalProperties: false
            }
          },
          notes: {type: "string"}
        },
        required: ["clip", "frameCount", "summary", "shots", "subjects", "setting", "candidateSlots"],
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
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: {type: "integer"},
          source: {type: "string"},
          confidence: {type: "number"},
          alternates: {type: "array", items: {type: "string"}},
          rationale: {type: "string"}
        },
        required: ["slot", "source", "confidence", "alternates", "rationale"],
        additionalProperties: false
      }
    },
    unresolvedSlots: {type: "array", items: {type: "integer"}},
    concerns: {type: "array", items: {type: "string"}}
  },
  required: ["assignments", "unresolvedSlots", "concerns"],
  additionalProperties: false
};

const verifySlotSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    source: {type: "string"},
    feasible: {type: "boolean"},
    beatsConfirmed: {type: "array", items: {type: "string"}},
    missingBeats: {type: "array", items: {type: "string"}},
    maxWindow: {
      type: "object",
      properties: {start: {type: "integer"}, end: {type: "integer"}},
      required: ["start", "end"],
      additionalProperties: false
    },
    minWindow: {
      type: "object",
      properties: {start: {type: "integer"}, end: {type: "integer"}},
      required: ["start", "end"],
      additionalProperties: false
    },
    cutMarginsOk: {type: "boolean"},
    notes: {type: "string"}
  },
  required: ["slot", "source", "feasible", "beatsConfirmed", "missingBeats", "cutMarginsOk", "notes"],
  additionalProperties: false
};

const renderSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    outputFramesTotal: {type: "integer"},
    filesWritten: {type: "array", items: {type: "string"}},
    commands: {type: "array", items: {type: "string"}},
    problems: {type: "array", items: {type: "string"}}
  },
  required: ["ok", "outputFramesTotal", "filesWritten", "commands", "problems"],
  additionalProperties: false
};

const verdictSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    checks: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues", "checks"],
  additionalProperties: false
};

// ---------------------------------------------------------------- helpers

function slotText(slot) {
  return SHOT_LIST.split("\n\n").find(s => s.startsWith("Slot " + slot + " ")) || ("Slot " + slot);
}

// Given per-slot feasible windows, choose segment lengths summing to TOTAL_FRAMES
// and concrete half-open source/output ranges. Returns {ok:true, segments, total}
// or {ok:false, reason, sumMin, sumMax}.
function pickRanges(verifs) {
  const minLens = verifs.map(v => v.minWindow.end - v.minWindow.start);
  const maxLens = verifs.map(v => v.maxWindow.end - v.maxWindow.start);
  const sumMin = minLens.reduce((s, x) => s + x, 0);
  const sumMax = maxLens.reduce((s, x) => s + x, 0);
  if (sumMin > TOTAL_FRAMES) return {ok: false, reason: "minimum required frames " + sumMin + " exceed " + TOTAL_FRAMES, sumMin, sumMax};
  if (sumMax < TOTAL_FRAMES) return {ok: false, reason: "maximum usable frames " + sumMax + " fall short of " + TOTAL_FRAMES, sumMin, sumMax};
  const lens = minLens.slice();
  let rem = TOTAL_FRAMES - sumMin;
  const slacks = maxLens.map((m, i) => m - lens[i]);
  const totalSlack = slacks.reduce((s, x) => s + x, 0);
  if (totalSlack > 0) {
    for (let i = 0; i < verifs.length && rem > 0; i++) {
      if (slacks[i] <= 0) continue;
      const give = Math.min(slacks[i], Math.floor(rem * slacks[i] / totalSlack));
      lens[i] += give;
      rem -= give;
    }
  }
  let guard = 0;
  while (rem > 0 && guard < 20000) {
    let progressed = false;
    for (let i = 0; i < verifs.length && rem > 0; i++) {
      if (lens[i] < maxLens[i]) { lens[i]++; rem--; progressed = true; }
    }
    if (!progressed) break;
    guard++;
  }
  if (rem !== 0) return {ok: false, reason: "could not distribute remaining " + rem + " frames", sumMin, sumMax};
  const segments = [];
  let out = 0;
  for (let i = 0; i < verifs.length; i++) {
    const v = verifs[i];
    const L = lens[i];
    const A = v.maxWindow.start, B = v.maxWindow.end;
    const aMin = v.minWindow.start, bMin = v.minWindow.end;
    if (L < bMin - aMin || L > B - A) {
      return {ok: false, reason: "length " + L + " infeasible for slot " + v.slot + " (window " + A + ".." + B + ", beats " + aMin + ".." + bMin + ")", sumMin, sumMax};
    }
    let s = Math.min(aMin, B - L);
    if (s < A) s = A;
    if (s + L < bMin || s > aMin) {
      return {ok: false, reason: "window placement failed for slot " + v.slot, sumMin, sumMax};
    }
    segments.push({slot: v.slot, source: v.source, source_frames: [s, s + L], output_frames: [out, out + L]});
    out += L;
  }
  return {ok: true, segments, total: out};
}

// ---------------------------------------------------------------- prompts

function probePrompt() {
  return "Task directory: /workspace. Read instruction.md for overall context. Do NOT try to solve the slot matching. " +
    "Your job: build a machine-readable probe of all 45 candidate clips in input/ (01.mp4 .. 45.mp4, H.264 640x360 24fps, 6-12s, silent).\n" +
    "1) mkdir -p work work/frames work/summaries work/verify.\n" +
    "2) For every clip NN in 01..45 run ffprobe to get the exact frame count (nb_frames), duration, and confirm 640x360, SAR 1:1, 24/1 fps. Some clips already contain internal hard cuts; detect them with a scene-change pass, e.g. " +
    "'ffmpeg -i input/NN.mp4 -vf \"select=gt(scene\\,0.30),showinfo\" -f null -' and convert each scene-change pts_time to a 0-based frame index via round(pts_time*24). Treat detected indices as candidate cut frames; also spot-check a few clips by extracting frames around detected cuts to confirm they are real hard cuts (raise or lower the scene threshold per clip if the list looks wrong; report the threshold used).\n" +
    "3) Write work/probe.json: {\"clips\":{\"01\":{\"frameCount\":N,\"width\":640,\"height\":360,\"fps\":\"24/1\",\"cuts\":[c1,c2,...],\"sceneThreshold\":t}, ...}} with entries for all 45 clips. cuts are 0-based frame indices of internal cuts, sorted ascending (do not include frame 0 or the last frame).\n" +
    "4) Return the summary object. If any clip fails to probe, list it in problems.";
}

function surveyPrompt(clipIds) {
  return "Task directory: /workspace. Read instruction.md for context; the ordered 7-slot shot list is:\n\n" + SHOT_LIST +
    "\n\nYour job: visually characterize these candidate clips: " + clipIds.join(", ") + ".\n" +
    "For EACH clip NN in your list:\n" +
    "1) Read its frameCount and detected internal cuts from work/probe.json (if missing, run ffprobe yourself).\n" +
    "2) Extract 8-12 evenly spaced JPEG frames covering the whole clip into work/frames/NN/ (e.g. 'ffmpeg -i input/NN.mp4 -vf \"select=not(mod(n\\,K)),scale=640:-1\" -vsync 0 work/frames/NN/f%03d.jpg' with K chosen to spread across the clip; extract extra frames around each detected internal cut so you can describe every shot inside the clip).\n" +
    "3) VIEW the extracted frames (you can read image files). Describe: setting, camera framing/angle, subjects present (protagonist, small grey/red animals, butterfly, flowers, tree, trunk, fruit), the shot-by-shot breakdown including any internal cuts, and what action occurs in what order.\n" +
    "4) Judge which of the 7 slots this clip could serve. Be honest: several clips overlap in time or show parts of the same event, so the same scene may appear in multiple clips. Give candidateSlots entries with confidence 0.0-1.0 and a concrete reason tied to the slot's required beats. Include weak possibilities (low confidence) rather than guessing firmly. A clip serving a slot must contain ALL of that slot's described beats, in the described order, inside one contiguous sub-range.\n" +
    "5) Also record whether the clip shows the protagonist waking, morning stretch, flowers, butterfly, antagonists gathering behind a trunk, fruit throwing/strikes, or the humiliated finale - these are the key discriminators.\n" +
    "Return one clips[] entry per clip. Do not skip any clip in your list; if a clip fails to open, still return an entry with a note.";
}

function matchPrompt(summariesJson, feedback) {
  let p = "Task directory: /workspace. Read instruction.md. The ordered 7-slot shot list:\n\n" + SHOT_LIST +
    "\n\nBelow are visual summaries of the 45 anonymous candidate clips (JSON). Clips may overlap or show different portions of the same event; numbering is random.\n\n" +
    summariesJson +
    "\n\nChoose ONE distinct candidate clip for each of the 7 slots. Requirements: all 7 sources distinct; each chosen clip must plausibly contain ALL of its slot's described beats in the described order within one contiguous sub-range; a slot described as multiple shots separated by 'cut to' needs a clip containing those internal cuts (per the probe cut lists referenced in the summaries). " +
    "Prefer clips whose summaries match the slot's camera language as well as content. For each slot give the best source, 2-4 alternates, and a rationale. Flag any slot you cannot confidently fill in unresolvedSlots and explain in concerns.\n" +
    "You may extract and view additional frames from any clip (put them in work/frames/NN/) to disambuate close calls before deciding.\n";
  if (feedback) p += "\nPrevious attempt feedback (a prior assignment failed; revise accordingly, you may keep assignments that were not criticized):\n" + feedback;
  return p;
}

function verifySlotPrompt(assignment) {
  return "Task directory: /workspace. Read instruction.md. Verify ONE slot-to-clip assignment in detail and derive compliant frame windows.\n\n" +
    "SLOT SPEC:\n" + slotText(assignment.slot) +
    "\n\nASSIGNED CLIP: input/" + assignment.source + ".mp4" +
    (assignment.priorSummary ? "\n\nPrior survey summary of this clip: " + JSON.stringify(assignment.priorSummary) : "") +
    "\n\nDo a DENSE visual inspection: read work/probe.json for this clip's frameCount and detected cuts; extract frames into work/verify/slot" + assignment.slot + "/ covering the whole clip (step small enough to follow the action, e.g. every 8-24 frames, plus dense frames around each detected cut and around each narrative beat), and VIEW them. " +
    "Determine:\n" +
    "1) feasible: does ONE contiguous sub-range of this clip show EVERY beat the slot describes, in the described order? List each beat in beatsConfirmed (with approximate frame numbers); list any beat that is missing or out of order in missingBeats.\n" +
    "2) minWindow: the smallest half-open [start,end) frame range (0-based, relative to frame 0 of this candidate) that still shows all beats in order.\n" +
    "3) maxWindow: the largest half-open [start,end) range that contains all beats in order AND satisfies the no-flash-frame rule: the range's in-point and out-point must each be at least " + MARGIN + " frames away from any original internal cut that lies INSIDE the range. Internal cuts inside the range are allowed (the slot's own 'cut to' beats) as long as they are >= " + MARGIN + " frames from both the in-point and the out-point. Use the probe cut list, but re-verify each relevant cut by looking at frames around it. Also stay within [0, frameCount].\n" +
    "4) cutMarginsOk: whether the maxWindow you report satisfies the margin rule.\n" +
    "Be precise with frame numbers - these will be used to cut the final video. If the clip cannot serve the slot, set feasible=false and explain in notes (mention what IS present, so a different clip can be chosen). If the assigned clip fails, also briefly check the alternates " + JSON.stringify(assignment.alternates || []) + " the same way and report in notes which alternate works, with its windows.";
}

function renderPrompt(segments) {
  return "Task directory: /workspace. Read instruction.md, especially the Deliverables and Assembly contract sections. Render the final video now.\n\n" +
    "Segments (slot order, half-open frame intervals, source frames relative to frame 0 of each candidate):\n" + JSON.stringify(segments) +
    "\n\nProduce:\n" +
    "1) output/solution.mp4: the 7 segments in slot order, hard cuts only, no transitions, no scaling/cropping/filtering/text, 1x speed original direction, H.264 (libx264, CRF <= 18 or lossless), yuv420p, 640x360, SAR 1:1, constant 24/1 fps, NO audio track, exactly " + TOTAL_FRAMES + " frames.\n" +
    "Suggested approach: for each segment trim by frame numbers, e.g. 'ffmpeg -i input/NN.mp4 -vf \"trim=start_frame=A:end_frame=B,setpts=PTS-STARTPTS\" -an -c:v libx264 -crf 18 -pix_fmt yuv420p -r 24 -video_track_timescale 24 work/segK.mp4', then concatenate the 7 segments (concat demuxer with re-encode, or a single filter_complex with 7 inputs and concat). IMPORTANT: verify the trim produces exactly B-A frames per segment and the final file exactly " + TOTAL_FRAMES + " frames via ffprobe; if a method is off by a frame, switch method (e.g. select='between(n,A,B-1)' or -ss/-t on exact frame boundaries) until exact.\n" +
    "2) output/solution.json: {\"segments\":[{\"slot\":k,\"source\":\"NN\",\"source_frames\":[a,b],\"output_frames\":[c,d]}, ...]} exactly matching the segment table above: 7 objects in slot order, integer frames, half-open, output_frames starting at 0, contiguous, no gaps/overlaps, d-c = b-a, last d = " + TOTAL_FRAMES + ".\n" +
    "3) Ensure output/ contains ONLY solution.mp4 and solution.json (delete anything else you or others put there). Put any scratch files in work/.\n" +
    "Return the summary: ok, total output frame count as measured by ffprobe, files written, the exact commands used, and any problems. Do not declare ok unless ffprobe reports exactly " + TOTAL_FRAMES + " frames and both files exist.";
}

function verifyDeliverablesPrompt() {
  return "Task directory: /workspace. Independently verify the deliverables in output/ against instruction.md. Perform ALL of these checks with ffprobe/ffmpeg/Python (put scratch in work/checks/):\n" +
    "1) output/ contains exactly two files: solution.mp4 and solution.json.\n" +
    "2) solution.mp4: codec h264, 640x360, SAR 1:1, constant 24/1 fps, pix_fmt yuv420p, exactly " + TOTAL_FRAMES + " frames, no audio stream (check with ffprobe -show_streams).\n" +
    "3) solution.json: parses; exactly 7 segment objects in slot order 1..7; sources are 7 DISTINCT clip ids from 01..45; source_frames and output_frames are integer half-open intervals; output_frames start at 0, are contiguous with no gaps or overlaps; d-c = b-a for every segment; the last d equals " + TOTAL_FRAMES + ".\n" +
    "4) Frame-by-frame content check: for each segment, extract the declared source frames [a,b) from input/NN.mp4 and the declared output frames [c,d) from output/solution.mp4, and compare them exactly (e.g. ffmpeg framemd5 with trim filters on both, then diff the frame hashes; or extract both as PNGs and compare hashes). Every output frame must be pixel-identical (allowing only encoder-level differences you can quantify; if you re-encoded at CRF<=18 frames will not be hash-identical, so instead verify structural identity: compare downscaled/blurred-frame hashes or SSIM >= 0.98 per frame pair, and verify the declared mapping order). Report per-segment results in checks.\n" +
    "5) No-flash-frame margins: using work/probe.json cut lists, verify each declared source range's in-point and out-point are at least " + MARGIN + " frames away from every internal cut inside that range, and that the range lies within [0, frameCount] of its source clip.\n" +
    "6) Slot-order sanity: skim sample frames of each output segment and confirm the content plausibly matches its slot in the shot list.\n" +
    "Return passed=true only if every check passes; otherwise list concrete, actionable issues.";
}

function repairPrompt(issues) {
  return "Task directory: /workspace. Read instruction.md. The current deliverables in output/ (solution.mp4, solution.json) failed verification. Fix them IN PLACE so they satisfy the assembly contract and deliverable spec. Issues reported by the verifier:\n" +
    JSON.stringify(issues, null, 2) +
    "\n\nRules to preserve: 7 distinct sources, one contiguous sub-range per source at 1x speed original direction, hard cuts only, in/out points at least " + MARGIN + " frames from any internal cut inside the segment, exactly " + TOTAL_FRAMES + " frames total, H.264 yuv420p 640x360 SAR 1:1 constant 24/1 fps, no audio, CRF <= 18, output/ contains only the two deliverable files. " +
    "If a fix requires changing a segment's source or range (e.g. a margin violation or wrong clip), re-derive that segment's window from the clip (work/probe.json has cut lists; you may extract and view frames), keep the total at exactly " + TOTAL_FRAMES + " frames by adjusting other segments' lengths within their verified windows, and update solution.json to match what you actually rendered. Verify frame counts with ffprobe before finishing.";
}

// ---------------------------------------------------------------- phase 1: probe

phase("Probe");
log("Probing 45 candidate clips (metadata + internal cut detection)");
const probe = await agent(probePrompt(), {label: "probe-clips", phase: "Probe", schema: probeSchema});
if (!probe || !probe.ok) {
  return {
    status: "unresolved",
    reason: "clip probing failed",
    probe: probe || null,
    problems: probe ? probe.problems : ["probe agent returned null"]
  };
}
log("Probe complete: " + probe.clipsProbed + " clips, problems: " + JSON.stringify(probe.problems));

// ---------------------------------------------------------------- phase 2: survey

phase("Survey");
const BATCH_SIZE = 5;
const batches = [];
for (let i = 0; i < ALL_CLIPS.length; i += BATCH_SIZE) batches.push(ALL_CLIPS.slice(i, i + BATCH_SIZE));
log("Surveying " + ALL_CLIPS.length + " clips in " + batches.length + " parallel batches");
const surveyResults = await parallel(batches.map((b, i) => () =>
  agent(surveyPrompt(b), {label: "survey-" + (i + 1), phase: "Survey", schema: surveySchema})
));

const surveyed = {};
for (const r of surveyResults) {
  if (r && Array.isArray(r.clips)) for (const c of r.clips) surveyed[c.clip] = c;
}
let missing = ALL_CLIPS.filter(c => !surveyed[c]);
for (let round = 0; round < 2 && missing.length > 0; round++) {
  log("Re-surveying missing clips: " + missing.join(", "));
  const extra = await parallel(missing.map(c => () =>
    agent(surveyPrompt([c]), {label: "resurvey-" + c, phase: "Survey", schema: surveySchema})
  ));
  for (const r of extra) {
    if (r && Array.isArray(r.clips)) for (const c of r.clips) surveyed[c.clip] = c;
  }
  missing = ALL_CLIPS.filter(c => !surveyed[c]);
}
if (missing.length > 0) {
  return {status: "unresolved", reason: "could not survey all clips", missingClips: missing};
}
const allSummaries = ALL_CLIPS.map(c => surveyed[c]);
log("Survey complete for all 45 clips");

// ---------------------------------------------------------------- phase 3+4: match and verify slot ranges (with re-match loop)

const maxSlotRounds = (args && Number.isInteger(args.maxSlotRounds)) ? args.maxSlotRounds : 2;
const summariesJson = JSON.stringify(allSummaries);

let match = await agent(matchPrompt(summariesJson, null), {label: "match-slots", phase: "Match", schema: matchSchema});
if (!match || !Array.isArray(match.assignments) || match.assignments.length !== 7) {
  return {status: "unresolved", reason: "slot matching failed", match: match || null};
}

let segments = null;
let lastFeedback = null;
let finalVerifs = null;
let matchHistory = [match];

for (let round = 0; round <= maxSlotRounds; round++) {
  // sanity: 7 distinct slots 1..7 with distinct sources
  const bySlot = {};
  const sources = new Set();
  let assignmentOk = true;
  for (const a of match.assignments) {
    if (!a || !(a.slot >= 1 && a.slot <= 7) || !/^\d{2}$/.test(a.source || "") || bySlot[a.slot] || sources.has(a.source)) {
      assignmentOk = false;
      break;
    }
    bySlot[a.slot] = a;
    sources.add(a.source);
  }
  if (!assignmentOk || Object.keys(bySlot).length !== 7) {
    lastFeedback = "Previous assignments invalid (must be exactly slots 1..7, seven DISTINCT clip ids). Revise.";
    match = await agent(matchPrompt(summariesJson, lastFeedback), {label: "rematch-" + round, phase: "Match", schema: matchSchema});
    matchHistory.push(match);
    if (!match) return {status: "unresolved", reason: "re-matching failed", round};
    continue;
  }

  const ordered = [1, 2, 3, 4, 5, 6, 7].map(k => bySlot[k]);
  log("Round " + round + ": verifying slot ranges for sources " + ordered.map(o => o.slot + "->" + o.source).join(", "));
  const verifs = await parallel(ordered.map(a => () =>
    agent(verifySlotPrompt({
      slot: a.slot,
      source: a.source,
      alternates: a.alternates,
      priorSummary: surveyed[a.source] || null
    }), {label: "verify-slot-" + a.slot, phase: "Verify ranges", schema: verifySlotSchema})
  ));

  const badVerifs = verifs.map((v, i) => ({v, a: ordered[i]})).filter(x => !x.v);
  const infeasible = verifs.map((v, i) => ({v, a: ordered[i]})).filter(x => x.v && (!x.v.feasible || !x.v.cutMarginsOk || !x.v.maxWindow || !x.v.minWindow ||
    !(x.v.maxWindow.end > x.v.maxWindow.start) || !(x.v.minWindow.end > x.v.minWindow.start) ||
    x.v.minWindow.start < x.v.maxWindow.start || x.v.minWindow.end > x.v.maxWindow.end ||
    x.v.maxWindow.end > (surveyed[x.a.source] ? surveyed[x.a.source].frameCount : Infinity)));

  if (badVerifs.length === 0 && infeasible.length === 0) {
    finalVerifs = verifs;
    const alloc = pickRanges(verifs);
    if (alloc.ok && alloc.total === TOTAL_FRAMES) {
      segments = alloc.segments;
      break;
    }
    lastFeedback = "All clips verified, but the frame budget does not fit: " + (alloc.reason || "total mismatch") +
      ". Sum of minimum windows vs maximum windows must bracket " + TOTAL_FRAMES + " frames. Prefer slot clips/windows with more usable length (or clips whose beats are shorter). Reassign slots accordingly.";
  } else {
    const parts = [];
    for (const x of badVerifs) parts.push("Slot " + x.a.slot + " (clip " + x.a.source + "): verification agent failed.");
    for (const x of infeasible) parts.push("Slot " + x.a.slot + " (clip " + x.a.source + "): infeasible - missing beats " + JSON.stringify(x.v.missingBeats) + "; notes: " + (x.v.notes || ""));
    lastFeedback = parts.join("\n") + "\nChoose different clips for the failing slots (alternates noted by the verifiers where given).";
  }

  if (round === maxSlotRounds) break;
  match = await agent(matchPrompt(summariesJson, lastFeedback), {label: "rematch-" + round, phase: "Match", schema: matchSchema});
  matchHistory.push(match);
  if (!match) return {status: "unresolved", reason: "re-matching failed", round, feedback: lastFeedback};
}

if (!segments) {
  return {
    status: "unresolved",
    reason: "could not derive a feasible 7-slot assignment and 1248-frame allocation",
    feedback: lastFeedback,
    lastAssignments: match ? match.assignments : null,
    verifications: finalVerifs
  };
}
log("Segment plan derived: " + JSON.stringify(segments));

// ---------------------------------------------------------------- phase 5: render

phase("Render");
const rendered = await agent(renderPrompt(segments), {label: "render-solution", phase: "Render", schema: renderSchema});
if (!rendered || !rendered.ok || rendered.outputFramesTotal !== TOTAL_FRAMES) {
  return {
    status: "unresolved",
    reason: "rendering failed or frame count wrong",
    segments,
    render: rendered || null
  };
}
log("Render complete: " + rendered.outputFramesTotal + " frames, files: " + JSON.stringify(rendered.filesWritten));

// ---------------------------------------------------------------- phase 6: verify deliverables + repair loop

phase("Verify deliverables");
const maxRepairs = (args && Number.isInteger(args.maxRepairs)) ? args.maxRepairs : 3;
const check = () => agent(verifyDeliverablesPrompt(), {label: "verify-deliverables", phase: "Verify deliverables", schema: verdictSchema});

let verdict = await check();
let repairs = [];
for (let round = 0; verdict && !verdict.passed && verdict.issues.length > 0 && round < maxRepairs; round++) {
  log("Verification failed (round " + round + "); repairing. Issues: " + JSON.stringify(verdict.issues));
  const repair = await agent(repairPrompt(verdict.issues), {label: "repair-" + round, phase: "Verify deliverables"});
  repairs.push(repair === null ? "repair agent returned null" : "repair round " + round + " completed");
  if (repair === null) break;
  verdict = await check();
}

const passed = !!(verdict && verdict.passed);
return {
  status: passed ? "verified" : "unresolved",
  segments,
  verdict: verdict || null,
  repairs,
  render: {filesWritten: rendered.filesWritten, totalFrames: rendered.outputFramesTotal},
  matchConcerns: matchHistory[matchHistory.length - 1] ? matchHistory[matchHistory.length - 1].concerns : [],
  slotVerifications: finalVerifs
};
