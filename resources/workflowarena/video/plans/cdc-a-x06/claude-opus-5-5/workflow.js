export const meta = {
  name: "cdc-a-x06-two-trailers",
  description: "Catalog 39 anonymous clips (probe, cut detection, overlap mapping, visual descriptions), rank candidates per slot for comedy and suspense trailers with visual verification, assign distinct clips per version, assemble frame-exact outputs + EDL + evidence, then verify and repair.",
  phases: [
    {title: "Probe", detail: "ffprobe, frame counts, scene cuts, frame extraction, overlap mapping between clips"},
    {title: "Describe", detail: "Per-clip visual shot-by-shot descriptions from extracted frames"},
    {title: "Rank", detail: "Per-slot candidate ranking with direct frame inspection and tie-breaks"},
    {title: "Assemble", detail: "Distinct assignment, encoding, edl.json, selection-evidence.json"},
    {title: "Verify", detail: "Contract checks and repair"}
  ]
};

const ROOT = "/workspace";
const CLIPS = [];
for (let i = 1; i <= 39; i++) CLIPS.push(String(i).padStart(2, "0"));

const SLOTS = {
  A1: "A1 Entrance with irony (comedy). Function: a smug little gang makes its entrance; the audience sees a hazard hanging over their heads, they do not. Film language: opens on a tight close group shot of three small characters, eye-level to slightly low camera, pressing toward the lens. Then cuts to a low angle with a heavy object suspended at top of frame, and a huge arm sweeps past the frame edge. Ends on a medium close shot of the leader holding a small object. The whole clip stays on the gang.",
  A2: "A2 Peek gag (comedy). Single-take gag: a peek, a retreat, then the bystander pays. Film language: one locked-off camera for the whole clip. A near tree trunk at frame LEFT is a foreground screen; a bird stands on a branch a little further away at frame RIGHT. A character peeks out from behind the trunk and ducks back. The bystander is then hit by a small object flying in from off-screen and leaves the frame. Clip ENDS on the empty branch.",
  A3: "A3 Chain of close calls (comedy). An oblivious small character dodges several 'disasters from nowhere' one after another and carries on as if nothing happened; escalates and pays off. Film language: wide shot staying on this small character throughout. Opens with a calm hold. Then a first large object rolls in from one side and grazes past, followed by other large objects toppling or dropping. Ends with the character alone in frame, unharmed and still absorbed in its own business.",
  A4: "A4 Deadpan scale contrast (comedy). A huge figure silently appears behind the small character, who notices nothing; laugh from size difference and a long pause. Film language: one essentially fixed framing. Small character in the foreground busy with what is in front of it. Huge character walks in from frame edge and stops right behind it. The two then share the frame, and the pause holds until the clip ends.",
  A5: "A5 Closing button (comedy). Character who thinks it is winning walks straight into the opponent's grip; captor's sly grin is the button, then picture starts to fade out. Film language: medium shot opens on a small character edging along a branch toward a huge figure at frame right whose back is to camera. A big hand grabs it. Cut to a close two-shot of the two, captor grinning. ENDS while the picture is fading down toward black.",
  B1: "B1 Being watched (suspense). Establish unease that someone in the dark is watching. Film language: opens on a low-angle wide shot of several small characters walking along a path toward camera. One walks right up to the lens and fills the frame (wipe-like transition). Cut to a high-angle subjective view looking down on them through foreground leaves, and a huge dark shape intrudes from the right foreground. Ends back on an eye-level medium shot of them, unaware.",
  B2: "B2 The threat behind (suspense). Audience sees the danger; the character does not. Film language: deep staging in one essentially fixed framing. Unsuspecting small character in foreground, head down and busy. Huge silhouette walks in from off-screen and stops behind it, looming. The clip stays in this tension WITHOUT release (no reaction/turn/resolution inside the clip).",
  B3: "B3 Watching from cover, then a strike (suspense). Hidden figure watches from cover, then a strike from off-screen makes the bystander vanish. Film language: one locked-off camera for the whole clip. Near tree trunk screens the foreground; a bystander sits on a branch further away. Hidden figure leans out and disappears again. Bystander suddenly hit by something flying in from off-screen and vanishes from frame, leaving an empty shot.",
  B4: "B4 Delay and shock (suspense). Hold on an unsuspecting character long enough to make the audience wait; danger breaks in but the clip cuts away before the outcome. Film language: wide shot, static camera. Opens with a LONG still hold. A huge object then rolls in from off-screen and closes on the character. Clip ENDS at the most dangerous moment as the object bears down on the character, WITHOUT showing what happens (no dodge, no aftermath).",
  B5: "B5 Stinger (suspense). A harmless small object falls and exposes a danger hidden in the ground; unresolved threat. Film language: low-angle wide shot of an empty patch of ground. A small object drops in from top of frame and bounces. Hard cut to a close insert showing it impaled on something hidden in the ground. Ends on a static wide shot of a clearing covered with these hidden things, with no character in frame."
};
const COMEDY = ["A1", "A2", "A3", "A4", "A5"];
const SUSPENSE = ["B1", "B2", "B3", "B4", "B5"];

const CONTEXT = `You are working in ${ROOT} on the task described in ${ROOT}/instruction.md (read it first). ` +
  `Inputs: ${ROOT}/input/01.mp4..39.mp4 (silent, 640x360, 24fps, 6.7-12s). Scratch: ${ROOT}/work/. Deliverables: ${ROOT}/output/. ` +
  `Python 3.11 and ffmpeg/ffprobe are available; no network, no GPU. You can view extracted PNG/JPG frames with your file-reading tool to see image content. ` +
  `Never guess clip content from numbers or file sizes; base every claim on frames you actually looked at.`;

// ---------------- Phase 1: Probe ----------------
phase("Probe");
const probeSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    clips: {type: "array", items: {type: "object", properties: {
      source: {type: "string"}, frame_count: {type: "integer"}, fps: {type: "string"},
      width: {type: "integer"}, height: {type: "integer"}, pix_fmt: {type: "string"}, has_audio: {type: "boolean"},
      cut_frames: {type: "array", items: {type: "integer"}}
    }, required: ["source", "frame_count", "cut_frames"]}},
    overlap_groups: {type: "array", items: {type: "object", properties: {
      members: {type: "array", items: {type: "string"}},
      note: {type: "string"}
    }, required: ["members"]}},
    notes: {type: "string"}
  },
  required: ["ok", "clips", "overlap_groups"]
};

const probe = await agent(
  CONTEXT + `\n\nYOUR JOB: build a technical catalog of all 39 clips. Do not choose slots.\n` +
  `1. For every clip, ffprobe: exact decoded frame count (use -count_frames or decode with ffmpeg and count), r_frame_rate, size, pix_fmt, SAR, audio presence. Save ${ROOT}/work/probe.json.\n` +
  `2. Detect internal hard cuts per clip (e.g. ffmpeg select='gt(scene,0.3)' with showinfo, or a Python per-frame difference on downscaled grayscale frames; ALSO record fades: per-frame mean luma so fade-outs to black and fade-ins are detectable). Record cut frame indices (0-based frame index of first frame of new shot). Save mean-luma per frame of the first/last 24 frames.\n` +
  `3. Extract frames to ${ROOT}/work/frames/NN/: frame 0, last frame, one frame every 12 frames (0.5 s), and the frames immediately before and after each detected cut. Name files with the 0-based frame index, e.g. f0000.jpg. Also build one contact sheet per clip ${ROOT}/work/sheets/NN.jpg (tile of ~every 12th frame, each thumbnail labelled with frame index if feasible via drawtext, else note order in a sidecar txt) so later workers can review a clip at a glance.\n` +
  `4. Overlap mapping: many clips cover the same footage with different in/out points. Compute small per-frame fingerprints (e.g. 16x9 grayscale) for every frame of every clip and find pairs of clips that share footage; for each overlapping pair record offset (frame i of clip X == frame j of clip Y) and the shared frame range. Group clips into overlap groups (connected components). For each group, describe how members differ in start/end coverage (in frames). Save ${ROOT}/work/overlaps.json (pairs with offsets and ranges) and include groups in your answer.\n` +
  `5. Write a short README at ${ROOT}/work/CATALOG.md explaining file layout.\n` +
  `Write reusable scripts in ${ROOT}/work/scripts/. Return the structured summary (clips array for all 39 sources with frame_count and cut_frames; overlap_groups).`,
  {label: "probe-catalog", phase: "Probe", schema: probeSchema}
);
if (!probe) log("Probe worker failed; describers will extract frames themselves.");

const probeById = {};
if (probe && probe.clips) for (const c of probe.clips) probeById[String(c.source).padStart(2, "0")] = c;
const groupOf = {};
if (probe && probe.overlap_groups) probe.overlap_groups.forEach((g, gi) => (g.members || []).forEach(m => { groupOf[String(m).padStart(2, "0")] = gi; }));

// ---------------- Phase 2: Describe ----------------
phase("Describe");
const descSchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      source: {type: "string"},
      frame_count: {type: "integer"},
      shots: {type: "array", items: {type: "object", properties: {
        start_frame: {type: "integer"}, end_frame: {type: "integer"},
        shot_size: {type: "string"}, angle: {type: "string"}, camera: {type: "string"},
        content: {type: "string"}
      }, required: ["start_frame", "end_frame", "shot_size", "angle", "camera", "content"]}},
      opening: {type: "string"},
      ending: {type: "string"},
      characters: {type: "string"},
      key_events: {type: "array", items: {type: "string"}},
      fade: {type: "string"},
      possible_slots: {type: "array", items: {type: "string"}},
      distinguishing_details: {type: "string"}
    }, required: ["source", "shots", "opening", "ending", "key_events", "possible_slots", "distinguishing_details"]}}
  },
  required: ["clips"]
};

const BATCH = 4;
const batches = [];
for (let i = 0; i < CLIPS.length; i += BATCH) batches.push(CLIPS.slice(i, i + BATCH));

const slotBrief = Object.keys(SLOTS).map(k => "- " + SLOTS[k]).join("\n");

const descResults = await parallel(batches.map((batch, bi) => () => agent(
  CONTEXT + `\n\nYOUR JOB: produce precise visual descriptions of clips ${batch.join(", ")}. Do not assemble anything.\n` +
  `Technical catalog (may be partial): ${JSON.stringify(batch.map(s => probeById[s] || {source: s, note: "not probed"}))}\n` +
  `Frames should exist in ${ROOT}/work/frames/NN/ and contact sheets in ${ROOT}/work/sheets/NN.jpg (see ${ROOT}/work/CATALOG.md). If missing, extract them yourself into ${ROOT}/work/frames/NN/ (frame 0, every 12th frame, last frame, around cuts).\n` +
  `For EACH clip, actually look at the frames: the very first frame, the last frame, frames around each cut, and enough intermediate frames (every 6-12 frames where action happens) to understand motion. Extract extra frames if needed.\n` +
  `Describe shot by shot (frame ranges): shot size (extreme wide/wide/medium/medium close/close/insert), camera angle (low/eye/high, subjective?), camera motion (locked-off / pan / moving), composition (what is in foreground, frame left/right, tree trunk, branch, etc.), characters (small vs huge, how many), and what moves in from where (rolls in, drops, flies in from off-screen, walks in from edge). ` +
  `Be explicit about HOW THE CLIP OPENS (first ~1s) and HOW IT ENDS (last ~1s: who/what is in frame, empty frame?, fading to black?, still in danger or resolved?). Note fades with mean luma trend.\n` +
  `Trailer slots the pool is used for (for tagging only):\n${slotBrief}\n` +
  `In possible_slots list slot ids the clip might plausibly fit (empty if none). In distinguishing_details note concrete visible features that would distinguish this clip from overlapping alternatives (exact opening/ending content, extra shots included/excluded).\n` +
  `Also save each clip description as ${ROOT}/work/desc/NN.json.`,
  {label: `describe-${batch[0]}-${batch[batch.length - 1]}`, phase: "Describe", schema: descSchema}
)));

const descriptions = {};
const missingDesc = [];
descResults.forEach((r, bi) => {
  if (!r || !r.clips) { batches[bi].forEach(s => missingDesc.push(s)); return; }
  for (const c of r.clips) descriptions[String(c.source).padStart(2, "0")] = c;
});
for (const s of CLIPS) if (!descriptions[s] && !missingDesc.includes(s)) missingDesc.push(s);

if (missingDesc.length) {
  log("Retrying descriptions for: " + missingDesc.join(","));
  const retry = await parallel(missingDesc.map(s => () => agent(
    CONTEXT + `\n\nYOUR JOB: produce a precise visual description of clip ${s} only (same requirements as a shot-by-shot catalog: shots with frame ranges, size, angle, camera motion, content; explicit opening and ending; key events; fades; possible slots; distinguishing details). Extract and view frames yourself if ${ROOT}/work/frames/${s}/ is missing. Slots:\n${slotBrief}\nSave to ${ROOT}/work/desc/${s}.json.`,
    {label: `describe-retry-${s}`, phase: "Describe", schema: descSchema}
  )));
  retry.forEach(r => { if (r && r.clips) for (const c of r.clips) descriptions[String(c.source).padStart(2, "0")] = c; });
}

const compactDesc = CLIPS.map(s => {
  const d = descriptions[s];
  const p = probeById[s];
  if (!d) return {source: s, frame_count: p ? p.frame_count : null, missing: true};
  return {
    source: s, frame_count: (p && p.frame_count) || d.frame_count, overlap_group: groupOf[s] ?? null,
    shots: d.shots, opening: d.opening, ending: d.ending, key_events: d.key_events,
    fade: d.fade, possible_slots: d.possible_slots, distinguishing: d.distinguishing_details
  };
});
const overlapInfo = probe ? probe.overlap_groups : "unavailable; see work/overlaps.json if present";

// ---------------- Phase 3: Rank per slot ----------------
phase("Rank");
const rankSchema = {
  type: "object",
  properties: {
    slot: {type: "string"},
    candidates: {type: "array", items: {type: "object", properties: {
      source: {type: "string"},
      score: {type: "number", description: "0-100 fit to EVERY clause of the slot incl. opening and ending"},
      meets_all_clauses: {type: "boolean"},
      failed_clauses: {type: "array", items: {type: "string"}},
      evidence_frames: {type: "array", items: {type: "integer"}, description: "[a,b] frame range (b-a>=12) inside the clip that best shows its fit / its distinguishing feature"},
      notes: {type: "string"}
    }, required: ["source", "score", "meets_all_clauses", "failed_clauses", "evidence_frames", "notes"]}},
    most_similar_rival: {type: "string"},
    distinguishing_difference: {type: "string"}
  },
  required: ["slot", "candidates", "distinguishing_difference"]
};
const cmpSchema = {
  type: "object",
  properties: {
    winner: {type: "string"},
    ranking: {type: "array", items: {type: "object", properties: {
      source: {type: "string"}, score: {type: "number"}, meets_all_clauses: {type: "boolean"}, reason: {type: "string"}
    }, required: ["source", "score", "meets_all_clauses", "reason"]}},
    evidence_frames: {type: "array", items: {type: "integer"}},
    distinguishing_difference: {type: "string"}
  },
  required: ["winner", "ranking", "distinguishing_difference"]
};

const ALL_SLOTS = COMEDY.concat(SUSPENSE);
const slotResults = await pipeline(ALL_SLOTS,
  (slot) => agent(
    CONTEXT + `\n\nYOUR JOB: rank candidate clips for slot ${slot}.\nSLOT SPEC (every clause matters, including how the clip opens and ends; internal cuts count as part of the clip):\n${SLOTS[slot]}\n\n` +
    `Catalog descriptions of all clips (made by other workers; may contain errors):\n${JSON.stringify(compactDesc)}\n\nOverlap groups (clips sharing footage with different in/out points):\n${JSON.stringify(overlapInfo)}\nDetailed offsets in ${ROOT}/work/overlaps.json; frames in ${ROOT}/work/frames/NN/, sheets in ${ROOT}/work/sheets/.\n\n` +
    `Procedure: (1) shortlist every clip that plausibly matches, including ALL members of the relevant overlap group(s) — near-duplicates differ mainly in where they start and end, so the decisive check is the opening and ending clauses and whether extra/missing shots are included. (2) For each shortlisted clip, personally view the first frame, last frame, frames around each internal cut and the key action frames (extract more with ffmpeg as needed; check last ~24 frames for fades/empty frame). (3) Score 0-100 against each clause; mark meets_all_clauses only if every clause holds; list failed clauses. Penalize clips that start late (missing the opening hold / opening shot) or run long (include resolution, extra shot, character re-entering) or end early. ` +
    `Return up to 6 candidates sorted best first, with evidence_frames [a,b] (b-a>=12, inside clip) showing the decisive feature, plus the most similar rival to the best and one specific visible difference between them.`,
    {label: `rank-${slot}`, phase: "Rank", schema: rankSchema}
  ),
  async (rank, slot) => {
    if (!rank || !rank.candidates || rank.candidates.length === 0) return rank;
    const sorted = rank.candidates.slice().sort((a, b) => b.score - a.score);
    rank.candidates = sorted;
    const close = sorted.length > 1 && (sorted[0].score - sorted[1].score) < 12;
    const weak = !sorted[0].meets_all_clauses;
    if (!close && !weak) return rank;
    const contenders = sorted.slice(0, Math.min(4, sorted.length)).map(c => c.source);
    const cmp = await agent(
      CONTEXT + `\n\nYOUR JOB: independent tie-break for slot ${slot}. SLOT SPEC:\n${SLOTS[slot]}\n\nContenders: ${contenders.join(", ")}. A previous ranker said: ${JSON.stringify(sorted.slice(0, 4))}.\n` +
      `Relevant catalog entries: ${JSON.stringify(compactDesc.filter(d => contenders.includes(d.source)))}\nOverlap info: ${JSON.stringify(overlapInfo)} (offsets in ${ROOT}/work/overlaps.json).\n` +
      `Do not trust the prior ranking. View each contender frame by frame around its first 1-2 s, its last 1-2 s, and every internal cut (extract frames with ffmpeg into ${ROOT}/work/tiebreak/${slot}/). Check each clause literally: opening shot, sequence of events, camera behaviour, final frame content (e.g. empty branch, fade, unresolved danger, no character). If other clips not listed look like better fits, you may include them. Return a full ranking with scores, the winner, evidence_frames [a,b] (b-a>=12) for the winner, and one specific visible difference between the winner and its most similar rival.`,
      {label: `tiebreak-${slot}`, phase: "Rank", schema: cmpSchema}
    );
    if (!cmp || !cmp.ranking) return rank;
    const prior = {};
    for (const c of sorted) prior[c.source] = c;
    const merged = cmp.ranking.map(r => ({
      source: String(r.source).padStart(2, "0"),
      score: r.score,
      meets_all_clauses: r.meets_all_clauses,
      failed_clauses: (prior[r.source] && prior[r.source].failed_clauses) || [],
      evidence_frames: (String(r.source) === String(cmp.winner) && cmp.evidence_frames && cmp.evidence_frames.length === 2) ? cmp.evidence_frames : ((prior[r.source] && prior[r.source].evidence_frames) || []),
      notes: r.reason
    }));
    for (const c of sorted) if (!merged.find(m => m.source === c.source)) merged.push(Object.assign({}, c, {score: Math.min(c.score, 10)}));
    merged.sort((a, b) => b.score - a.score);
    // ensure winner first
    const wi = merged.findIndex(m => m.source === String(cmp.winner).padStart(2, "0"));
    if (wi > 0) { const [w] = merged.splice(wi, 1); merged.unshift(w); }
    return {slot, candidates: merged, most_similar_rival: rank.most_similar_rival, distinguishing_difference: cmp.distinguishing_difference, tiebreak: true};
  }
);

const rankBySlot = {};
const unresolvedSlots = [];
ALL_SLOTS.forEach((s, i) => {
  const r = slotResults[i];
  if (!r || !r.candidates || r.candidates.length === 0) unresolvedSlots.push(s);
  else rankBySlot[s] = r;
});

// ---------------- Assignment (deterministic) ----------------
function assign(slots) {
  const lists = slots.map(s => (rankBySlot[s] ? rankBySlot[s].candidates.slice(0, 5) : []).map((c, idx) => ({
    source: String(c.source).padStart(2, "0"),
    // primary by score; tiny rank-order bonus preserves tie-break winner ordering
    value: (c.score || 0) + (c.meets_all_clauses ? 20 : 0) + (idx === 0 ? 0.5 : 0)
  })));
  let best = null, bestVal = -Infinity;
  const pick = new Array(slots.length).fill(null);
  function rec(i, used, val) {
    if (i === slots.length) { if (val > bestVal) { bestVal = val; best = pick.slice(); } return; }
    if (lists[i].length === 0) { pick[i] = null; rec(i + 1, used, val - 200); return; }
    for (const c of lists[i]) {
      if (used.has(c.source)) continue;
      pick[i] = c.source; used.add(c.source);
      rec(i + 1, used, val + c.value);
      used.delete(c.source);
    }
    pick[i] = null; rec(i + 1, used, val - 200);
  }
  rec(0, new Set(), 0);
  return slots.map((s, i) => ({slot: s, source: best ? best[i] : null}));
}

let comedyPick = assign(COMEDY);
let suspensePick = assign(SUSPENSE);
log("Comedy: " + JSON.stringify(comedyPick) + " Suspense: " + JSON.stringify(suspensePick));

function evidenceFor(slot, source) {
  const r = rankBySlot[slot];
  if (!r) return null;
  const c = r.candidates.find(x => String(x.source).padStart(2, "0") === source);
  return {
    slot, source,
    frame_count: probeById[source] ? probeById[source].frame_count : null,
    evidence_frames: c ? c.evidence_frames : null,
    score: c ? c.score : null,
    notes: c ? c.notes : null,
    rival: r.most_similar_rival || null,
    difference: (r.candidates[0] && String(r.candidates[0].source).padStart(2, "0") === source) ? r.distinguishing_difference : null,
    other_candidates: r.candidates.filter(x => String(x.source).padStart(2, "0") !== source).slice(0, 3).map(x => ({source: x.source, score: x.score, notes: x.notes}))
  };
}

// ---------------- Phase 4: Assemble ----------------
phase("Assemble");
const assembleSchema = {
  type: "object",
  properties: {
    done: {type: "boolean"},
    comedy_frames: {type: "integer"},
    suspense_frames: {type: "integer"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["done", "issues"]
};

function assemblyPrompt(extra) {
  const plan = {
    comedy: comedyPick.map(p => evidenceFor(p.slot, p.source) || p),
    suspense: suspensePick.map(p => evidenceFor(p.slot, p.source) || p)
  };
  return CONTEXT + `\n\nYOUR JOB: build the 4 deliverables in ${ROOT}/output/ exactly per instruction.md, using this selection (slot order):\n${JSON.stringify(plan, null, 1)}\n` +
    (extra || "") +
    `\nRequirements:\n` +
    `- If any slot source is null, pick the best remaining candidate from ${ROOT}/work/desc/ that is not already used in that version, and report it in issues.\n` +
    `- Each version: concatenate the 5 full clips in slot order, every frame, 1x, no crop/scale/grade/text/transitions, hard cuts. Recommended: ffmpeg with 5 inputs and concat filter (n=5:v=1:a=0), then -an -c:v libx264 -crf 12 -preset medium -pix_fmt yuv420p -r 24 with setsar=1 and -fps_mode passthrough/-vsync cfr ensuring constant 24/1 and no dropped/duplicated frames; or lossless concat demuxer if streams are compatible. Write ${ROOT}/output/comedy.mp4 and ${ROOT}/output/suspense.mp4.\n` +
    `- Verify with ffprobe -count_frames: decoded frame count == sum of source frame counts, 640x360, SAR 1:1, 24/1, yuv420p, h264, no audio stream.\n` +
    `- Write ${ROOT}/output/edl.json: {"comedy":{"segments":[...]},"suspense":{"segments":[...]}}, each with 5 objects {slot, source:"NN", output_frames:[start,end), source_frames:[0,frame_count], output:[start_s,end_s]} contiguous from 0, seconds = frames/24 (round to 6 decimals), final end frame == decoded frame count of that mp4.\n` +
    `- Write ${ROOT}/output/selection-evidence.json: array of 10 objects {version:"comedy"|"suspense", slot, source, source_frames:[a,b], reason}, with 0<=a<b<=frame_count and b-a>=12. Open the frames in [a,b] yourself to confirm they show the decisive feature. reason must name the most similar other candidate by number and one specific VISIBLE difference (e.g. "unlike 17, which starts after the bird has already landed, 05 opens on the empty trunk hold" — use real observations, not this example). Use the rank notes above and check frames with overlaps (${ROOT}/work/overlaps.json) to make the difference concrete.\n` +
    `- Frame-by-frame check: decode each output and compare each segment against its source clip (e.g. PSNR per frame > 40 dB, or identical md5 for lossless); fix any mismatch.\n` +
    `- ${ROOT}/output/ must contain exactly these 4 files: remove anything else (put scratch in ${ROOT}/work/).\n` +
    `Report frame counts and any issues.`;
}

let assembly = await agent(assemblyPrompt(""), {label: "assemble", phase: "Assemble", schema: assembleSchema});

// ---------------- Phase 5: Verify / repair ----------------
phase("Verify");
const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    selection_concerns: {type: "array", items: {type: "object", properties: {
      slot: {type: "string"}, source: {type: "string"}, concern: {type: "string"}, better_source: {type: "string"}
    }, required: ["slot", "source", "concern"]}}
  },
  required: ["passed", "issues", "selection_concerns"]
};

const verify = () => agent(
  CONTEXT + `\n\nYOUR JOB: independently verify the deliverables in ${ROOT}/output/ against instruction.md. Do not edit output files.\n` +
  `Technical checks (write a Python checker in ${ROOT}/work/scripts/verify.py and run it): exactly 4 files in output/; both mp4 are h264, yuv420p, 640x360, SAR 1:1, r_frame_rate and avg_frame_rate 24/1, no audio; decoded frame counts; edl.json schema, slot order A1..A5/B1..B5, 5 distinct sources per version, source_frames [0,N] with N == actual frame count of input/NN.mp4, contiguous half-open output_frames from 0, seconds within 0.001 of frames/24, final end == decoded count; per-frame comparison of each output segment against its declared source (PSNR or pixel diff — every frame must match, no offset); selection-evidence.json has 10 entries matching edl sources, b-a>=12, inside clip, reasons naming a specific visible difference vs another candidate number.\n` +
  `Selection sanity check: for each of the 10 chosen clips, view its first frame, last frame and frames around internal cuts and compare with the slot spec below; flag only concrete clause violations (with better_source if you can verify one from the catalog in ${ROOT}/work/desc/ and frames).\nSlot specs:\n${slotBrief}`,
  {label: "verify", phase: "Verify", schema: verifySchema}
);

let verdict = await verify();
const repairs = [];
for (let round = 0; round < 2; round++) {
  if (verdict && verdict.passed && (!verdict.selection_concerns || verdict.selection_concerns.length === 0)) break;
  if (!verdict) { verdict = await verify(); if (!verdict) break; continue; }
  // Evaluate selection concerns that propose swaps: confirm with a focused adjudicator before changing picks.
  let changed = false;
  const concerns = (verdict.selection_concerns || []).filter(c => c.better_source);
  if (concerns.length) {
    const adj = await parallel(concerns.map(c => () => agent(
      CONTEXT + `\n\nYOUR JOB: adjudicate a proposed swap for slot ${c.slot}. Current choice ${c.source}; proposed ${c.better_source}. Concern: ${c.concern}.\nSLOT SPEC:\n${SLOTS[c.slot]}\nPrior ranking: ${JSON.stringify(rankBySlot[c.slot] ? rankBySlot[c.slot].candidates.slice(0, 5) : null)}\nView first/last frames, cuts and key action of both clips (and any overlap-group siblings, see ${ROOT}/work/overlaps.json). Return the better clip under every clause.`,
      {label: `adjudicate-${c.slot}`, phase: "Verify", schema: cmpSchema}
    )));
    concerns.forEach((c, i) => {
      const a = adj[i];
      if (!a || !a.winner) return;
      const win = String(a.winner).padStart(2, "0");
      const list = COMEDY.includes(c.slot) ? comedyPick : suspensePick;
      const entry = list.find(p => p.slot === c.slot);
      if (entry && win !== entry.source && !list.some(p => p.source === win)) {
        entry.source = win;
        if (rankBySlot[c.slot]) {
          const cand = rankBySlot[c.slot].candidates;
          const ex = cand.find(x => String(x.source).padStart(2, "0") === win);
          const evf = a.evidence_frames && a.evidence_frames.length === 2 ? a.evidence_frames : (ex ? ex.evidence_frames : []);
          rankBySlot[c.slot].candidates = [{source: win, score: 100, meets_all_clauses: true, failed_clauses: [], evidence_frames: evf, notes: a.distinguishing_difference}].concat(cand.filter(x => String(x.source).padStart(2, "0") !== win));
          rankBySlot[c.slot].distinguishing_difference = a.distinguishing_difference;
        }
        changed = true;
        log(`Swap ${c.slot}: ${c.source} -> ${win}`);
      }
    });
  }
  const techIssues = verdict.issues || [];
  if (!changed && techIssues.length === 0) break;
  const rep = await agent(assemblyPrompt(
    `\nThis is a REPAIR pass (round ${round + 1}). Rebuild any affected outputs so they match the selection above exactly (selection may have changed). Verifier issues to fix:\n${JSON.stringify(techIssues)}\n`
  ), {label: `repair-${round + 1}`, phase: "Verify", schema: assembleSchema});
  repairs.push(rep);
  if (rep) assembly = rep;
  verdict = await verify();
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  comedy: comedyPick,
  suspense: suspensePick,
  unresolved_slots: unresolvedSlots,
  missing_descriptions: CLIPS.filter(s => !descriptions[s]),
  rankings: Object.fromEntries(Object.entries(rankBySlot).map(([k, v]) => [k, v.candidates.slice(0, 4).map(c => ({source: c.source, score: c.score, ok: c.meets_all_clauses}))])),
  assembly,
  repairs: repairs.length,
  verdict
};
