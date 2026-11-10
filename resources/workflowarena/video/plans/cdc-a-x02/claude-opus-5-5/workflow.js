export const meta = {
  name: "cdc-a-x02-mourning-sequence",
  description: "Probe 42 anonymous clips, describe them visually, adjudicate one unique candidate per slot with near-duplicate awareness, assemble the 6-slot sequence with a slot5->slot6 J-cut, write EDL and evidence, then verify and repair.",
  phases: [
    {title: "Probe", detail: "ffprobe specs, frame counts, cut detection, contact sheets, near-duplicate families"},
    {title: "Describe", detail: "Visual description of every clip and preliminary slot fit"},
    {title: "Adjudicate", detail: "Per-slot detailed comparison of shortlisted candidates"},
    {title: "Assemble", detail: "Build sequence.mp4, edl.json, selection-evidence.json"},
    {title: "Verify", detail: "Independent technical and frame/sample-level verification with repair loop"}
  ]
};

const WS = "/workspace";
const IDS = [];
for (let i = 1; i <= 42; i++) IDS.push(String(i).padStart(2, "0"));

const COMMON = `
Context: You are a worker on a video-editing task. The task directory is ${WS}. Read ${WS}/instruction.md first (it contains the full task: 6 fixed slots, assembly contract, J-cut, deliverables).
Inputs: ${WS}/input/01.mp4 .. 42.mp4 (anonymous candidates, random numbering, H.264 1280x544 24fps, AAC 48k stereo, 6-12 s).
Tools: Python 3.11, ffmpeg/ffprobe, no network, no GPU. Put all drafts/scratch files under ${WS}/work/ only. Never write anything into ${WS}/output/ unless your assignment explicitly says so (output/ must finally contain exactly sequence.mp4, edl.json, selection-evidence.json).
To look at pictures, extract JPG/PNG frames with ffmpeg and open them with your file-reading tool (it can display images). Do not guess clip content from file names or sizes; base everything on actually inspected frames.
Distractor warning: candidates likely include near-duplicates of correct clips that differ in one field: mirrored (left/right swapped, e.g. gaze turning to screen LEFT instead of right, creature entering from the right), time-reversed, speed-changed, cropped/scaled/zoomed, colour-graded, trimmed so the clip starts/ends on a different image, an extra or missing internal shot, a different take/angle, or camera movement where it should be locked off. Every field of a slot (content order, first/last image, shot size, angle, camera, direction) must match.
`;

// ---------------- Phase 1: Probe ----------------
phase("Probe");
const probeSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          video_frames: {type: "integer"},
          video_duration_s: {type: "number"},
          audio_duration_s: {type: "number"},
          audio_start_s: {type: "number"},
          video_start_s: {type: "number"},
          spec_notes: {type: "string"},
          cut_frames: {type: "array", items: {type: "integer"}},
          sheet_path: {type: "string"}
        },
        required: ["id", "video_frames", "cut_frames", "sheet_path"]
      }
    },
    families: {
      type: "array",
      items: {
        type: "object",
        properties: {
          members: {type: "array", items: {type: "string"}},
          relation: {type: "string"}
        },
        required: ["members", "relation"]
      }
    },
    notes: {type: "string"}
  },
  required: ["clips", "families"]
};

const probe = await agent(COMMON + `
ASSIGNMENT (probe all 42 clips; technical only, no story judgement):
1. For every clip NN in 01..42: run ffprobe and record exact decoded video frame count (use -count_frames / nb_read_frames), video & audio durations, stream start_time of each stream, codec, size, SAR, fps, audio sample rate/channels. Note any deviation from the stated spec.
2. Detect internal hard cuts per clip (e.g. Python frame-difference on decoded downscaled frames, or ffmpeg select='gt(scene,0.3)' with showinfo). Record cut frame indices (index of first frame of the new shot).
3. Create a contact sheet per clip: ${WS}/work/sheets/NN.jpg — frames every 12 frames (0.5 s) plus the very last frame, tiled in a grid at a size that is still legible (e.g. 320x136 tiles), in temporal order left-to-right, top-to-bottom. Also save ${WS}/work/frames/NN_first.jpg, NN_last.jpg and one frame from each detected shot (NN_shotK.jpg). Write a small text index ${WS}/work/sheets/NN.txt listing which source frame number each tile shows.
4. Near-duplicate families: compute small grayscale signatures (e.g. 32x14 per frame every 3-6 frames) for every clip and compare all pairs, also comparing against horizontally flipped and time-reversed versions and with temporal offsets / speed ratios. Group clips that share substantially the same footage and describe the suspected relation (identical, mirrored, reversed, offset-trimmed, speed x?, cropped/zoomed, graded, extra shot, etc.) and which member looks like the unaltered one if determinable.
5. Save everything to ${WS}/work/probe/summary.json and return the structured result.`, {label: "probe", phase: "Probe", schema: probeSchema});

const probeById = {};
if (probe && probe.clips) for (const c of probe.clips) probeById[c.id] = c;
const families = (probe && probe.families) || [];
const familyOf = (id) => families.filter(f => f.members.includes(id));

// ---------------- Phase 2: Describe ----------------
phase("Describe");
const describeSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          shots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start_frame: {type: "integer"},
                end_frame: {type: "integer"},
                description: {type: "string"},
                shot_size: {type: "string"},
                angle: {type: "string"},
                camera: {type: "string"}
              },
              required: ["start_frame", "end_frame", "description"]
            }
          },
          first_image: {type: "string"},
          last_image: {type: "string"},
          anomalies: {type: "string"},
          summary: {type: "string"},
          slot_fit: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slot: {type: "integer"},
                fit: {type: "string", enum: ["strong", "partial", "none"]},
                notes: {type: "string"}
              },
              required: ["slot", "fit", "notes"]
            }
          }
        },
        required: ["id", "shots", "summary", "slot_fit", "first_image", "last_image"]
      }
    }
  },
  required: ["clips"]
};

const BATCH = 4;
const batches = [];
for (let i = 0; i < IDS.length; i += BATCH) batches.push(IDS.slice(i, i + BATCH));

const descResults = await parallel(batches.map((ids, bi) => () => agent(COMMON + `
ASSIGNMENT (visual description of clips ${ids.join(", ")}):
Probe data for these clips (may be partial; re-probe if missing): ${JSON.stringify(ids.map(id => probeById[id] || {id, missing: true}))}
Contact sheets should exist at ${WS}/work/sheets/NN.jpg with index NN.txt, and frames in ${WS}/work/frames/. If missing, create them yourself (frames every 12 frames + last frame).
For each clip: view its contact sheet and extra frames as needed (especially around cuts and at the first and last frames). Describe each shot with frame ranges: who/what is visible (red-haired young woman, small winged creature, large dragon, flock of birds, snowdrops, cliffs, roots, timber roof...), action and its direction in screen terms (left/right, toward/away from camera), shot size, camera angle, camera movement (locked off vs pan/track/zoom). Describe exactly the first and last images. Note anything suspicious (looks mirrored, reversed motion, speed-change, cropped/zoomed, colour shift, missing/extra shot, unusual start/end).
Then rate fit to each of the 6 slots in instruction.md (strong/partial/none) with a short note on which fields match or fail. Be strict but do not drop plausible near-misses: use "partial" for clips that match most fields.
Return the structured result for all ${ids.length} clips.`, {label: `describe-${bi + 1}`, phase: "Describe", schema: describeSchema})));

const descById = {};
const missingDesc = [];
descResults.forEach((r, bi) => {
  if (r && r.clips) for (const c of r.clips) descById[c.id] = c;
});
for (const id of IDS) if (!descById[id]) missingDesc.push(id);

// Retry missing descriptions once, individually
if (missingDesc.length) {
  log("Retrying descriptions for: " + missingDesc.join(","));
  const retry = await parallel(missingDesc.map(id => () => agent(COMMON + `
ASSIGNMENT (visual description of clip ${id}): Probe data: ${JSON.stringify(probeById[id] || {})}
View its contact sheet ${WS}/work/sheets/${id}.jpg (create it if missing) and frames. Describe shots with frame ranges, first and last images, anomalies, and rate fit to each of the 6 slots in instruction.md.`, {label: `describe-retry-${id}`, phase: "Describe", schema: describeSchema})));
  retry.forEach(r => { if (r && r.clips) for (const c of r.clips) descById[c.id] = c; });
}
const stillMissing = IDS.filter(id => !descById[id]);

const compact = (id) => {
  const d = descById[id];
  if (!d) return {id, missing_description: true};
  return {id, summary: d.summary, first: d.first_image, last: d.last_image, anomalies: d.anomalies || "",
    shots: (d.shots || []).map(s => `[${s.start_frame}-${s.end_frame}] ${s.description} | ${s.shot_size || ""} | ${s.angle || ""} | ${s.camera || ""}`),
    fit: (d.slot_fit || []).map(f => `S${f.slot}:${f.fit}`).join(" ")};
};

// ---------------- Phase 3: Adjudicate ----------------
phase("Adjudicate");
const adjSchema = {
  type: "object",
  properties: {
    slot: {type: "integer"},
    ranking: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          verdict: {type: "string", enum: ["match", "near_miss", "reject"]},
          confidence: {type: "number"},
          mismatches: {type: "array", items: {type: "string"}},
          evidence_source_frames: {type: "array", items: {type: "integer"}},
          most_similar_other: {type: "string"},
          reason: {type: "string"}
        },
        required: ["id", "verdict", "confidence", "mismatches"]
      }
    },
    notes: {type: "string"}
  },
  required: ["slot", "ranking"]
};

function shortlistFor(slot) {
  const set = new Set();
  for (const id of IDS) {
    const d = descById[id];
    if (!d) { set.add(id); continue; }
    const f = (d.slot_fit || []).find(x => x.slot === slot);
    if (f && (f.fit === "strong" || f.fit === "partial")) set.add(id);
  }
  for (const id of Array.from(set)) for (const fam of familyOf(id)) for (const m of fam.members) set.add(m);
  return Array.from(set).sort();
}

const adjudicate = (slot, shortlist, extra) => agent(COMMON + `
ASSIGNMENT (adjudicate slot ${slot}): Decide which candidate exactly matches Slot ${slot} of instruction.md (read the slot's every field carefully: content order, first and last image, shot size, angle, camera, direction of looks/motion).
Shortlisted candidates (from preliminary descriptions + near-duplicate families): ${shortlist.join(", ")}
Their preliminary descriptions: ${JSON.stringify(shortlist.map(compact))}
Near-duplicate families from probing: ${JSON.stringify(families)}
Probe data: ${JSON.stringify(shortlist.map(id => probeById[id] || {id}))}
Brief list of ALL clips (in case the right one was missed in the shortlist; inspect any that looks plausible): ${JSON.stringify(IDS.map(id => ({id, s: descById[id] ? descById[id].summary : "NO DESCRIPTION"})))}
${extra || ""}
Method: for each shortlisted clip, extract dense frames yourself (every 4-6 frames, plus first/last frames, plus frames around cuts) into ${WS}/work/adjudicate/slot${slot}/ and inspect them. Compare near-duplicates side by side at the same moments: check mirroring (screen direction, asymmetrical details, hair parting, which side props are on), reversed motion, speed (frame count of same action), crop/zoom (framing of the edges), colour grade, where the clip starts and ends, presence/absence of each required internal shot, camera movement. Optionally use the audio (production sound continuity) as supporting evidence.
Return a ranking of all shortlisted clips (best first). verdict "match" only if every field fits. confidence 0..1. For each clip ranked match or near_miss, give: evidence_source_frames [a,b] (half-open, inside the clip, b-a >= 12) where the deciding visual feature is visible; most_similar_other = id of the most similar other candidate; reason = one concrete visible difference between this clip and that most similar candidate (e.g. "in 17 she turns her gaze to screen right; in 05 (mirrored) she looks to screen left"). Write your notes to ${WS}/work/adjudicate/slot${slot}.json too.`, {label: `adjudicate-slot${slot}`, phase: "Adjudicate", schema: adjSchema});

const SLOTS = [1, 2, 3, 4, 5, 6];
const shortlists = {};
for (const s of SLOTS) shortlists[s] = shortlistFor(s);
log("Shortlists: " + JSON.stringify(shortlists));

let adj = await parallel(SLOTS.map(s => () => adjudicate(s, shortlists[s].length ? shortlists[s] : IDS.slice())));

// Second opinion where result missing, no match, or close tie between top matches
const needSecond = [];
SLOTS.forEach((s, i) => {
  const r = adj[i];
  if (!r || !r.ranking || !r.ranking.length) { needSecond.push(s); return; }
  const matches = r.ranking.filter(x => x.verdict === "match");
  if (matches.length === 0) needSecond.push(s);
  else if (matches.length > 1 && Math.abs(matches[0].confidence - matches[1].confidence) < 0.15) needSecond.push(s);
  else if (matches[0].confidence < 0.6) needSecond.push(s);
});
if (needSecond.length) {
  log("Second-opinion adjudication for slots: " + needSecond.join(","));
  const second = await parallel(needSecond.map(s => () => {
    const prev = adj[s - 1];
    const ids = new Set(shortlists[s].length ? shortlists[s] : IDS);
    if (prev && prev.ranking) prev.ranking.forEach(x => ids.add(x.id));
    return adjudicate(s, Array.from(ids).sort(),
      "A previous adjudication was inconclusive: " + JSON.stringify(prev || "none") +
      "\nFocus on directly discriminating the top contenders frame-by-frame; widen the search to any other clip if none truly fits.");
  }));
  needSecond.forEach((s, k) => { if (second[k] && second[k].ranking && second[k].ranking.length) adj[s - 1] = second[k]; });
}

// Deterministic unique assignment: choose combination maximizing score
const scoreOf = (x) => (x.verdict === "match" ? 2 : x.verdict === "near_miss" ? 1 : 0) + (x.confidence || 0);
const options = SLOTS.map((s, i) => {
  const r = adj[i];
  const list = (r && r.ranking ? r.ranking : []).filter(x => x.verdict !== "reject").slice(0, 4);
  return list;
});
let best = null;
function search(i, used, acc, score) {
  if (i === SLOTS.length) { if (!best || score > best.score) best = {score, picks: acc.slice()}; return; }
  const opts = options[i];
  let any = false;
  for (const o of opts) {
    if (used.has(o.id)) continue;
    any = true;
    used.add(o.id); acc.push(o);
    search(i + 1, used, acc, score + scoreOf(o));
    acc.pop(); used.delete(o.id);
  }
  if (!any) { acc.push(null); search(i + 1, used, acc, score); acc.pop(); }
}
search(0, new Set(), [], 0);
const picks = best ? best.picks : SLOTS.map(() => null);
const unresolvedSlots = SLOTS.filter((s, i) => !picks[i]);

// Fill unresolved slots with a dedicated worker if needed
if (unresolvedSlots.length) {
  const used = picks.filter(Boolean).map(p => p.id);
  const fill = await parallel(unresolvedSlots.map(s => () => adjudicate(s, IDS.filter(id => !used.includes(id)),
    "No acceptable unique candidate was found earlier. Already assigned to other slots (exclude): " + used.join(",") + ". Search all remaining clips and return the best available, marking honestly.")));
  unresolvedSlots.forEach((s, k) => {
    const r = fill[k];
    if (r && r.ranking) {
      const o = r.ranking.find(x => !used.includes(x.id) && !picks.some(p => p && p.id === x.id));
      if (o) picks[s - 1] = o;
    }
  });
}

const selection = SLOTS.map((s, i) => {
  const p = picks[i];
  if (!p) return {slot: s, source: null};
  return {slot: s, source: p.id, verdict: p.verdict, confidence: p.confidence,
    evidence_source_frames: p.evidence_source_frames || null, most_similar_other: p.most_similar_other || null,
    reason: p.reason || null, mismatches: p.mismatches || [],
    video_frames: probeById[p.id] ? probeById[p.id].video_frames : null};
});
log("Selection: " + JSON.stringify(selection.map(x => `${x.slot}:${x.source}`)));
if (selection.some(x => !x.source)) {
  return {status: "unresolved", reason: "Could not assign a candidate to every slot", selection, adjudications: adj, missing_descriptions: stillMissing};
}

// ---------------- Phase 4: Assemble ----------------
phase("Assemble");
const assembleSchema = {
  type: "object",
  properties: {
    done: {type: "boolean"},
    total_picture_frames: {type: "integer"},
    audio_duration_s: {type: "number"},
    video_duration_s: {type: "number"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["done", "issues"]
};

const ASSEMBLY_SPEC = `
Selection (slot order, final): ${JSON.stringify(selection)}
Build rules (from instruction.md; re-read it):
- Let N_i = exact decoded video frame count of the slot-i source (re-measure with ffprobe -count_frames; do not trust container metadata blindly).
- Picture: slots 1..5 use source frames [0, N_i) in full; slot 6 uses source frames [24, N_6). Output picture positions are cumulative from 0: P_1=0, P_{i+1}=P_i+N_i for i<=5; slot 6 picture occupies [P_6, P_6 + N_6 - 24). Total T = N_1+...+N_5 + N_6 - 24.
- Sound: slots 1..4 use source sound frames [0,N_i) at output [P_i, P_i+N_i). Slot 5 sound uses source [0, N_5-24) at output [P_5, P_6-24). Slot 6 sound uses source [0, N_6) at output [P_6-24, T). Sound segments are thus contiguous and end at T.
- 1 frame = 2000 audio samples at 48 kHz. Cut audio by exact sample counts aligned to each clip's own video timeline (account for any stream start_time offset between audio and video in the source so sound stays frame-synchronous; if a source's audio is slightly shorter than its video, note it and pad minimally with digital silence only to keep sync; if longer, trim). No fades, no crossfades, no extra sound, no resampling beyond what is needed (sources are already 48 kHz).
- Picture: no scaling/cropping/mirroring/grading/frame drops/dups. Recommended: a single ffmpeg filter_complex with trim=start_frame:end_frame,setpts=PTS-STARTPTS per video segment and atrim=start_sample:end_sample,asetpts=N/SR/TB per audio segment, concat, then encode libx264 -crf 16 (<=18) -pix_fmt yuv420p, -r 24 / fps_mode cfr, setsar=1, AAC-LC stereo 48 kHz (-c:a aac -b:a 256k -ar 48000 -ac 2), +faststart. Ensure the encoded audio and video durations are equal within 1 frame (watch AAC priming/padding; check with ffprobe).
- output/sequence.mp4: H.264 yuv420p 1280x544 SAR 1:1 CFR 24/1; one AAC-LC stereo 48 kHz track.
- output/edl.json: {"segments":[6 objects in slot order]} each {"slot":k, "source":"NN", "picture":{"output_frames":[a,b],"source_frames":[c,d]}, "sound":{"output_frames":[a,b],"source_frames":[c,d]}} with half-open 24fps frame intervals as defined above. Last picture end frame must equal the actual decoded frame count of output/sequence.mp4 (measure it).
- output/selection-evidence.json: JSON array of 6 objects {"slot":k,"source":"NN","source_frames":[a,b],"reason":"..."} with 0<=a<b<=N, b-a>=12; reason must name one concrete visible difference between the chosen clip and the most similar OTHER candidate (name that candidate's number). Use the adjudication evidence given in the selection; if missing or weak, inspect frames yourself to write a concrete, verifiable reason (refer to things visible in the given frame range).
- output/ must contain exactly these three files; keep scripts and intermediates in work/.
`;

const assemble = await agent(COMMON + `
ASSIGNMENT (assemble deliverables): Write a reproducible Python build script ${WS}/work/build.py and run it to produce the three deliverables.
${ASSEMBLY_SPEC}
After building, self-check: ffprobe streams, decoded frame count == T, audio duration vs video, EDL contiguity, evidence ranges, output/ file listing. Return the structured result.`, {label: "assemble", phase: "Assemble", schema: assembleSchema});

// ---------------- Phase 5: Verify & repair ----------------
phase("Verify");
const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    measurements: {type: "string"}
  },
  required: ["passed", "issues"]
};

const verify = () => agent(COMMON + `
ASSIGNMENT (independent verification; do NOT modify output/ — only report): Check the deliverables in ${WS}/output against instruction.md and this spec:
${ASSEMBLY_SPEC}
Checks:
1. output/ contains exactly sequence.mp4, edl.json, selection-evidence.json.
2. ffprobe: H.264, yuv420p, 1280x544, SAR 1:1, r_frame_rate and avg_frame_rate 24/1, CFR (check pts deltas), exactly one audio stream AAC LC stereo 48000 Hz; audio and video durations equal within 1 frame (1/24 s).
3. Decoded frame count of sequence.mp4 equals last picture end in edl.json; picture and sound segments each contiguous from 0, no gaps/overlaps, interval lengths consistent between output and source ranges; slot 6 picture source starts at 24; slot 5 sound ends 24 frames before slot 5 picture ends; slot 6 sound source starts at 0 and output sound starts 24 frames before slot 6 picture; sources in edl match the selection and are 6 distinct ids.
4. Frame-level picture check: for every segment, compare output frames against the corresponding source frames (e.g. PSNR/mean abs diff on decoded frames, at least every frame near boundaries and a dense sample elsewhere). Expect high PSNR (>~38 dB) and no offset (check that offset ±1 frame is worse).
5. Sound check: for each sound segment, compare output samples against source samples at the EDL-implied position (correlation near 1 and best lag ~0 samples, within a few ms); confirm no fades at boundaries and that the J-cut region carries slot 6 sound.
6. selection-evidence.json: array of 6, slot order, sources match edl, source_frames inside clip with b-a>=12, reason names a concrete visible difference and the compared other candidate.
Return passed=true only if everything holds; otherwise list each concrete issue with measured values.`, {label: "verify", phase: "Verify", schema: verifySchema});

let verdict = await verify();
const repairs = [];
for (let round = 0; round < 3 && (!verdict || !verdict.passed); round++) {
  const issues = verdict ? verdict.issues : ["Verifier returned no result; re-check all deliverables yourself."];
  const rep = await agent(COMMON + `
ASSIGNMENT (repair deliverables): The verifier reported these issues:
${JSON.stringify(issues)}
Fix them by editing/re-running ${WS}/work/build.py (or a corrected script) and regenerating the affected files in ${WS}/output. Do not change the slot selection unless an issue proves a selected clip is impossible to use.
${ASSEMBLY_SPEC}
Re-run your own self-checks and return the structured result.`, {label: `repair-${round + 1}`, phase: "Verify", schema: assembleSchema});
  repairs.push(rep);
  verdict = await verify();
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  selection,
  low_confidence_slots: selection.filter(x => x.verdict !== "match" || (x.confidence || 0) < 0.6).map(x => x.slot),
  missing_descriptions: stillMissing,
  families,
  assemble,
  repairs,
  verdict
};
