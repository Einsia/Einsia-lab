export const meta = {
  name: "cdc-a-x09-crossing-assembly",
  description: "Catalog 33 anonymous clips, adjudicate one distinct clip per slot of the 6-slot llama 'crossing' shot list with continuity checks, then assemble and verify output/solution.mp4, solution.json and selection-evidence.json.",
  phases: [
    {title: "Probe", detail: "ffprobe metadata, frame counts, scene cuts, contact sheets"},
    {title: "Describe", detail: "Visual description of every clip in batches"},
    {title: "Adjudicate", detail: "Per-slot deep comparison of shortlisted near-duplicates"},
    {title: "Continuity", detail: "Screen-direction / 180-degree check of the chosen sequence"},
    {title: "Assemble", detail: "Build the deliverables"},
    {title: "Verify", detail: "Independent check and repair"}
  ]
};

const WS = "/workspace";
const CLIPS = [];
for (let i = 1; i <= 33; i++) CLIPS.push(String(i).padStart(2, "0"));

const SLOTS = [
  {slot: 1, name: "Establishing", spec: "Content: an empty wide view of an arid high plateau, a dark boulder and snowy mountains in the background. An orange llama on the LEFT of frame walks toward frame RIGHT, then lowers its head to sniff the ground. Shot size: extreme wide, subject small. Angle: low, near the ground, level. Lens: wide; foreground grass and distant mountains both in frame. Movement: locked off."},
  {slot: 2, name: "First obstacle", spec: "Content: while the llama is moving, an extreme close-up of a barbed-wire fence post is INSERTED (internal cut); then the llama reaches a barbed-wire fence, leaps over it, lands and stands still. Shot size: mostly full shots with one detail insert. Angle: level; the fence runs into depth. Lens: normal; the post insert has shallow depth of field. Movement: essentially static; motion comes from the subject."},
  {slot: 3, name: "Spotting the goal", spec: "Content: a close-up of the llama's head, a barbed-wire fence in the foreground, staring at something off-screen; CUT to a low-angle point-of-view shot of a shrub with small blue flowers. Shot size: head close-up, then a medium shot of the shrub. Angle: close-up level to slightly low; shrub shot at ground level. Lens: close-up medium focal length; shrub shot has out-of-focus grass in the foreground. Movement: locked off; eyeline match into the POV shot."},
  {slot: 4, name: "Second obstacle", spec: "Content: beside an electric fence with RED insulator caps, the llama trots up to the fence, is hit by sparks the moment it touches it, and drops to a stunned sit. Shot size: full shot, fence and distant snowy peaks in one frame. Angle: low, level. Lens: normal to wide. Movement: locked off."},
  {slot: 5, name: "Assault", spec: "Content: opens on a close-up of the llama behind several electric-fence wires, face contorted; CUT to a wide shot in which it charges the fence, jumps, is struck by the current and thrown back to the ground. Shot size: close-up, then wide. Angle: close-up level; wide shot low. Lens: close-up medium-long with wires crossing the foreground; wide shot wide. Movement: both shots locked off."},
  {slot: 6, name: "After the crossing", spec: "Content: the scorched, darkened llama has reached the other side of the electric fence and sits on the ground; the camera then leaves it, passes dry branches, sweeps across flowering shrubs and ends on the plateau beneath a rainbow. Shot size: starts full, becomes a shrub close-up, ends wide. Angle: low, level. Lens: wide; foreground shrubs sweep through frame. Movement: continuous lateral move with strong foreground/background parallax."}
];

const CONTEXT = `You are a worker on task CDC-A-X09 (see ${WS}/instruction.md; read it first). Workspace: ${WS}. 33 silent candidate clips ${WS}/input/01.mp4..33.mp4 (H.264 1280x720, 24 fps, 4-9 s). Clip numbers are random. Many candidates are decoys: overlapping time ranges, near-identical content, or the same scene with a different shot treatment (e.g. mirrored/flipped so travel direction reverses, cropped/zoomed, panning or zooming instead of locked off, missing or extra internal cut/insert, different speed, graded colors, reversed playback, trimmed so a required beat is missing, different angle). The final sequence must keep continuous screen direction established in slot 1 (llama on frame left walking toward frame RIGHT) and respect the 180-degree line. Python 3.11, ffmpeg, ffprobe available; no network, no GPU. Put drafts only in ${WS}/work/. Never write anything to ${WS}/output/ unless your assignment says so. You can look at images (PNG/JPG) you extract with ffmpeg by reading them with your file-viewing tool; do so — judgments must be based on actually viewed frames, not guesses from file names or sizes.

Full ordered shot list:
${SLOTS.map(s => `Slot ${s.slot} (${s.name}): ${s.spec}`).join("\n")}
`;

// ---------------- Phase 1: Probe ----------------
phase("Probe");
const probeSchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    catalog_path: {type: "string"},
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          frame_count: {type: "integer"},
          width: {type: "integer"},
          height: {type: "integer"},
          fps: {type: "string"},
          pix_fmt: {type: "string"},
          sar: {type: "string"},
          scene_cuts: {type: "array", items: {type: "integer"}},
          sheet_dir: {type: "string"}
        },
        required: ["id", "frame_count", "scene_cuts", "sheet_dir"]
      }
    },
    notes: {type: "string"}
  },
  required: ["ok", "clips", "notes"]
};

const probe = await agent(`${CONTEXT}
ASSIGNMENT (probe, no visual judgments yet): For every clip 01..33:
1. ffprobe: width, height, SAR, pix_fmt, r_frame_rate, codec; and the exact DECODED frame count (ffprobe -count_frames -select_streams v:0 -show_entries stream=nb_read_frames). Note any clip whose params deviate (non-24fps, SAR != 1:1, audio present, VFR timestamps).
2. Detect internal hard cuts: use ffmpeg scene detection (e.g. select='gt(scene,0.3)',showinfo) and/or a Python frame-difference pass; report frame indices (0-based) where a new shot starts. Be conservative but don't miss obvious cuts.
3. Make visual aids in ${WS}/work/sheets/NN/: a contact sheet (tile) of ~12 evenly spaced frames with frame numbers drawn (drawtext with frame number is fine for drafts) as sheet.png, plus individual full-size frames at first frame, last frame, and the first and last frame of every detected shot (f_XXXX.png). Also save a low-res motion strip (e.g. every 6th frame, scaled to 320 px wide, tiled) as motion.png to help judge camera movement and travel direction.
4. Write all of this to ${WS}/work/catalog.json (array of objects per clip) and return it.
Write a reusable Python script at ${WS}/work/probe.py so others can re-run it. Do not view/describe content in depth; that's for later workers.`, {label: "probe", schema: probeSchema, phase: "Probe"});

const probeById = {};
if (probe && Array.isArray(probe.clips)) for (const c of probe.clips) probeById[c.id] = c;

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
          id: {type: "string"},
          frame_count: {type: "integer"},
          shots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                start_frame: {type: "integer"},
                end_frame_exclusive: {type: "integer"},
                content: {type: "string"},
                shot_size: {type: "string"},
                angle: {type: "string"},
                lens: {type: "string"},
                movement: {type: "string"},
                llama_screen_position_and_direction: {type: "string"}
              },
              required: ["start_frame", "end_frame_exclusive", "content", "shot_size", "angle", "movement", "llama_screen_position_and_direction"]
            }
          },
          suspicious_treatment: {type: "string", description: "signs of mirroring, crop/zoom, speed change, grading, reversal, letterbox, overlays, frozen/duplicated frames, or none"},
          candidate_slots: {type: "array", items: {type: "integer"}},
          fit_notes: {type: "string", description: "per candidate slot: which fields match or fail"}
        },
        required: ["id", "shots", "suspicious_treatment", "candidate_slots", "fit_notes"]
      }
    }
  },
  required: ["clips"]
};

const BATCH = 3;
const batches = [];
for (let i = 0; i < CLIPS.length; i += BATCH) batches.push(CLIPS.slice(i, i + BATCH));

const describeBatch = (ids) => agent(`${CONTEXT}
Probe data (may be partial; re-derive anything missing yourself with ffprobe/ffmpeg): ${JSON.stringify(ids.map(id => probeById[id] || {id, note: "missing from probe"}))}
Visual aids may exist in ${WS}/work/sheets/NN/ (sheet.png, motion.png, f_XXXX.png). If missing, extract your own frames into ${WS}/work/desc/NN/.
ASSIGNMENT: Carefully describe clips ${ids.join(", ")}. For each clip, VIEW enough frames (at least first/middle/last of every shot, more when motion matters) to describe each internal shot: content, shot size, camera angle, lens feel, camera movement (locked / pan / zoom / tracking — compare background positions across frames), and the llama's screen position and direction of travel/eyeline (left->right or right->left), fence orientation. Verify internal cut positions. Look for altered treatments: mirrored image (llama travelling right->left in a scene where others go left->right, mirrored landscape features), crop/zoom-in (softer image, tighter framing than a twin), speed change (frame-duplicate patterns, very slow/fast motion), reversed playback, color grading, black bars, overlays. Then list which slot(s) 1-6 the clip could plausibly fill and why, noting each slot field that matches or fails. Return structured data only for the requested clips.`, {label: `describe-${ids.join("-")}`, schema: descSchema, phase: "Describe"});

const descResults = await parallel(batches.map(ids => () => describeBatch(ids)));
let descriptions = [];
const missingDesc = [];
descResults.forEach((r, i) => {
  if (r && Array.isArray(r.clips)) descriptions.push(...r.clips);
  else missingDesc.push(...batches[i]);
});
// retry missing batches once, one clip per worker
if (missingDesc.length) {
  log("Retrying description for: " + missingDesc.join(","));
  const retry = await parallel(missingDesc.map(id => () => describeBatch([id])));
  retry.forEach(r => { if (r && Array.isArray(r.clips)) descriptions.push(...r.clips); });
}
const seen = new Set();
descriptions = descriptions.filter(d => d && d.id && !seen.has(d.id) && seen.add(d.id));
const undescribed = CLIPS.filter(id => !seen.has(id));

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
          source: {type: "string"},
          confidence: {type: "number", description: "0..1"},
          matches_all_fields: {type: "boolean"},
          failed_fields: {type: "array", items: {type: "string"}},
          llama_direction: {type: "string"},
          notes: {type: "string"}
        },
        required: ["source", "confidence", "matches_all_fields", "failed_fields", "notes"]
      }
    },
    most_similar_rival: {type: "string"},
    visible_difference_vs_rival: {type: "string"},
    evidence_frames: {type: "array", items: {type: "integer"}, description: "[a,b] half-open range inside the top clip, b-a>=12, where the decisive features are visible"},
    reason: {type: "string"}
  },
  required: ["slot", "ranking", "most_similar_rival", "visible_difference_vs_rival", "evidence_frames", "reason"]
};

const descJSON = JSON.stringify(descriptions);
const adjudicate = (s, extra) => agent(`${CONTEXT}
Catalog of all clip descriptions from earlier workers (may contain errors — verify visually): ${descJSON}
${undescribed.length ? "Clips with NO description (inspect them yourself if relevant): " + undescribed.join(",") : ""}
Probe frame counts: ${JSON.stringify(Object.fromEntries(Object.entries(probeById).map(([k, v]) => [k, v.frame_count])))}
${extra || ""}
ASSIGNMENT: Adjudicate SLOT ${s.slot} (${s.name}) ONLY: ${s.spec}
1. Shortlist every clip that could plausibly fit (be generous: include anything sharing the scene, even if listed for other slots; also skim contact sheets in ${WS}/work/sheets/ of clips whose description is vague).
2. Compare the shortlisted clips side by side at the frame level: extract matched frames into ${WS}/work/adj/slot${s.slot}/, build side-by-side/difference images, check framing (crop/zoom), mirroring (llama travel direction must be continuous with slot 1: llama goes LEFT->RIGHT; for later slots the goal/fence must stay on the consistent side), camera movement (locked vs pan/zoom), presence of every required beat and internal cut (e.g. insert, POV cut, close-up opening), shot sizes, angle, lens feel, speed (motion per frame vs twin), color grading. A clip must match EVERY field; one wrong field disqualifies it.
3. Rank all shortlisted clips; top = best full match. Give confidence. Name the most similar rival and one concrete VISIBLE difference (e.g. "in NN the llama travels right-to-left (mirrored)", "NN lacks the fence-post insert", "NN slowly pans right").
4. Give evidence_frames [a,b] (half-open, b-a>=12, within 0..frame_count of the top clip) where the decisive features are visible.
Do NOT write to output/. Save your notes to ${WS}/work/adj/slot${s.slot}/notes.md.`, {label: `adjudicate-slot${s.slot}`, schema: adjSchema, phase: "Adjudicate"});

let adj = await parallel(SLOTS.map(s => () => adjudicate(s)));
// retry failed slots once
for (let i = 0; i < SLOTS.length; i++) {
  if (!adj[i] || !Array.isArray(adj[i].ranking) || adj[i].ranking.length === 0) {
    log(`Retrying adjudication slot ${SLOTS[i].slot}`);
    adj[i] = await adjudicate(SLOTS[i]);
  }
}

// Resolve distinct assignment deterministically: maximize total confidence over full-match candidates (6 slots, small search).
function resolveAssignment(adjResults) {
  const options = adjResults.map(r => {
    if (!r || !Array.isArray(r.ranking)) return [];
    const list = r.ranking.filter(x => x && x.source).map(x => ({
      source: String(x.source).padStart(2, "0"),
      score: (x.matches_all_fields ? 1 : 0.2) * (typeof x.confidence === "number" ? x.confidence : 0.5)
    }));
    return list.slice(0, 6);
  });
  let best = null;
  const cur = [];
  const used = new Set();
  function rec(i, total) {
    if (i === options.length) {
      if (!best || total > best.total) best = {total, picks: cur.slice()};
      return;
    }
    const opts = options[i].length ? options[i] : [{source: null, score: 0}];
    let any = false;
    for (const o of opts) {
      if (o.source && used.has(o.source)) continue;
      any = true;
      cur.push(o); if (o.source) used.add(o.source);
      rec(i + 1, total + o.score);
      cur.pop(); if (o.source) used.delete(o.source);
    }
    if (!any) { cur.push({source: null, score: 0}); rec(i + 1, total); cur.pop(); }
  }
  rec(0, 0);
  return best ? best.picks.map(p => p.source) : options.map(() => null);
}

let picks = resolveAssignment(adj);
log("Initial picks: " + JSON.stringify(picks));

// ---------------- Phase 4: Continuity ----------------
phase("Continuity");
const contSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    problem_slots: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: {type: "integer"},
          issue: {type: "string"},
          suggested_alternative: {type: "string"}
        },
        required: ["slot", "issue"]
      }
    },
    direction_summary: {type: "string"}
  },
  required: ["passed", "problem_slots", "direction_summary"]
};

const continuityCheck = (p) => agent(`${CONTEXT}
Proposed selection (slot -> clip): ${JSON.stringify(p.map((src, i) => ({slot: i + 1, source: src})))}
Adjudication details: ${JSON.stringify(adj)}
ASSIGNMENT: Independently verify this sequence plays as ONE continuous scene. Extract first/middle/last frames of each chosen clip (and each internal shot) into ${WS}/work/continuity/ and view them in order. Check: all 6 distinct and non-null; each clip matches every field of its slot; llama travel direction and eyeline consistent with slot 1 (left->right), fence and goal stay on consistent screen sides, 180-degree line respected; slot 3's close-up eyeline matches the POV shrub cut; slot 6 shows the llama already beyond the electric fence. For any problem slot, inspect the alternatives (especially mirrored/other-treatment twins of the same scene) and suggest a specific alternative clip if one fits better. Report passed=true only if no problems remain.`, {label: "continuity", schema: contSchema, phase: "Continuity"});

let continuity = await continuityCheck(picks);
for (let round = 0; round < 2 && continuity && !continuity.passed && continuity.problem_slots.length; round++) {
  const toRedo = [...new Set(continuity.problem_slots.map(p => p.slot).filter(n => n >= 1 && n <= 6))];
  if (!toRedo.length) break;
  log(`Continuity round ${round}: re-adjudicating slots ${toRedo.join(",")}`);
  const redo = await parallel(toRedo.map(n => () => adjudicate(SLOTS[n - 1],
    `A continuity reviewer flagged this slot. Current full selection: ${JSON.stringify(picks)}. Reviewer findings: ${JSON.stringify(continuity.problem_slots.filter(p => p.slot === n))}. Direction summary: ${continuity.direction_summary}. Re-examine carefully; the reviewer may be wrong — decide on visual evidence. Clips already chosen for OTHER slots should not be re-used unless you are confident they belong here instead.`)));
  redo.forEach((r, k) => { if (r && Array.isArray(r.ranking) && r.ranking.length) adj[toRedo[k] - 1] = r; });
  const newPicks = resolveAssignment(adj);
  const changed = JSON.stringify(newPicks) !== JSON.stringify(picks);
  picks = newPicks;
  if (!changed && round > 0) break;
  continuity = await continuityCheck(picks);
}
log("Final picks: " + JSON.stringify(picks));

// ---------------- Phase 5: Assemble ----------------
phase("Assemble");
const evidencePlan = picks.map((src, i) => {
  const r = adj[i] || {};
  const top = r.ranking && r.ranking[0] && String(r.ranking[0].source).padStart(2, "0") === src;
  return {
    slot: i + 1,
    source: src,
    adjudicated_top_matches_pick: !!top,
    evidence_frames_hint: top ? r.evidence_frames : null,
    reason_hint: top ? r.reason : null,
    rival_hint: top ? r.most_similar_rival : null,
    difference_hint: top ? r.visible_difference_vs_rival : null,
    ranking_notes: r.ranking ? r.ranking.filter(x => String(x.source).padStart(2, "0") === src) : []
  };
});

const assembleSchema = {
  type: "object",
  properties: {
    done: {type: "boolean"},
    total_frames: {type: "integer"},
    segments: {type: "array", items: {type: "object"}},
    problems: {type: "array", items: {type: "string"}}
  },
  required: ["done", "total_frames", "problems"]
};

const assemblePrompt = (extra) => `${CONTEXT}
FINAL SELECTION (slot order): ${JSON.stringify(picks.map((s, i) => ({slot: i + 1, source: s})))}
Evidence plan from adjudicators: ${JSON.stringify(evidencePlan)}
${extra || ""}
ASSIGNMENT: Produce the deliverables in ${WS}/output/ (create the dir). If any selection is null, inspect and pick the best remaining distinct candidate yourself and report it in problems.
1. Re-measure each chosen clip's decoded frame count with ffprobe -count_frames.
2. Build ${WS}/output/solution.mp4: the 6 complete clips in slot order, hard cuts, no trimming, 1x speed, no filters except format normalization. Recommended: ffmpeg -i each clip, concat filter (v=1:a=0) with setsar=1, then -c:v libx264 -crf 16 -preset medium -pix_fmt yuv420p -r 24 -fps_mode cfr (or -vsync cfr) -an -movflags +faststart; ensure 1280x720, SAR 1:1, 24/1 fps. Write drafts in work/ first, then move the final file.
3. Verify decoded frame count of solution.mp4 == sum of clip frame counts; verify per-segment frames match the sources (e.g. compare PSNR of a few frames per segment at the boundaries — first and last frame of each segment vs the source's frame 0 and frame_count-1; PSNR should be high, >35 dB). Fix any off-by-one / dropped / duplicated frames.
4. Write ${WS}/output/solution.json: {"segments":[{"slot":1,"source":"NN","output_frames":[start,end],"source_frames":[0,frame_count]}, ...]} — 6 objects in slot order, contiguous half-open intervals starting at 0, last end == decoded frame count of solution.mp4. source is a two-digit string.
5. Write ${WS}/output/selection-evidence.json: an array of 6 objects {slot, source:"NN", source_frames:[a,b], reason}. source_frames inside [0, frame_count] of that clip with b-a >= 12, covering frames where the fit is visible (VIEW those frames to confirm). reason: why the clip fits each field of the slot AND one concrete visible difference from the most similar other candidate (name that candidate by number). Use the adjudicator hints but verify.
6. ${WS}/output/ must contain exactly these three files — delete anything else there.
Return the segments and total frame count.`;

let assembled = await agent(assemblePrompt(), {label: "assemble", schema: assembleSchema, phase: "Assemble"});

// ---------------- Phase 6: Verify ----------------
phase("Verify");
const verifySchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    checks: {type: "string"}
  },
  required: ["passed", "issues", "checks"]
};
const verify = () => agent(`${CONTEXT}
Expected selection (slot order): ${JSON.stringify(picks)}
ASSIGNMENT: Independently verify the deliverables in ${WS}/output/ with scripts (write checkers in ${WS}/work/verify/). Check: exactly 3 files (solution.mp4, solution.json, selection-evidence.json); solution.mp4 is H.264, yuv420p, 1280x720, SAR 1:1 (or unset-equivalent 1:1), 24/1 fps CFR, no audio stream; decoded frame count equals the last output_frames end; solution.json has exactly 6 segments in slot order 1..6, distinct two-digit sources, contiguous half-open intervals from 0, source_frames == [0, decoded frame count of that source], output length == source length; frame-by-frame (or dense sampling, at least every 4th frame plus all boundaries) PSNR between each output segment and its source is high (>35 dB) with no offset; selection-evidence.json is an array of 6 objects with slot, source matching solution.json, source_frames inside the clip with b-a>=12, and a reason containing both a fit justification and a concrete visible difference vs a named rival candidate. Also sanity-view the boundary frames to confirm order matches slots. Do NOT modify output/. Report passed and concrete issues.`, {label: "verify", schema: verifySchema, phase: "Verify"});

let verdict = await verify();
for (let round = 0; round < 2 && (!verdict || !verdict.passed); round++) {
  const issues = verdict ? verdict.issues : ["verifier returned no result; re-check all deliverables yourself"];
  log(`Repair round ${round}: ${JSON.stringify(issues)}`);
  assembled = await agent(assemblePrompt(`A verifier found these issues with the current output — fix them (keep the same selection unless an issue proves a selection is invalid): ${JSON.stringify(issues)}`),
    {label: `repair-${round}`, schema: assembleSchema, phase: "Verify"});
  verdict = await verify();
}

return {
  status: verdict && verdict.passed ? "verified" : "unresolved",
  picks: picks.map((s, i) => ({slot: i + 1, source: s, confidence: adj[i] && adj[i].ranking && adj[i].ranking[0] ? adj[i].ranking[0].confidence : null})),
  continuity: continuity ? {passed: continuity.passed, problems: continuity.problem_slots, direction: continuity.direction_summary} : "continuity check missing",
  undescribed_clips: undescribed,
  assembled,
  verdict
};
