export const meta = {
  name: "cdc-a-x07-narration-cut",
  description: "Cut a 43 s coral-spawning science short to a locked narration: survey 37 anonymous clips, describe them visually, pick one clip + exact range per window (with in-window sync at 24.5 s), render, write EDL/events, verify and repair.",
  phases: [
    {title: "Survey", detail: "Probe clips, extract frames, contact sheets, motion profiles"},
    {title: "Describe", detail: "Visual description of every candidate clip"},
    {title: "Windows", detail: "Per-window deep dive: valid intervals, ranges, sync event"},
    {title: "Assign", detail: "Distinct clip assignment in code"},
    {title: "Render", detail: "Build solution.mp4, edl.json, events.csv"},
    {title: "Verify", detail: "Independent checks and repair"}
  ]
};

const ROOT = (args && args.root) || "/workspace";
const FPS = 30;
const WINDOWS = [
  {window: 1, start_s: 0.0, end_s: 7.0, lines: [{t: 0.0, text: "A coral reef is one of the most crowded places in the sea: a huge school of fish streams densely past the lens, hugging the reef and almost hiding the rock behind it."}]},
  {window: 2, start_s: 7.0, end_s: 13.0, lines: [{t: 7.0, text: "Up close by day, the whole frame is tiny round cups packed side by side in neat rows. Each cup holds one polyp, and right now every polyp is pulled in."}]},
  {window: 3, start_s: 13.0, end_s: 21.0, lines: [{t: 13.0, text: "Night. In frame is an entire brain-coral colony, its surface speckled all over with white grains: the bundles have already been pushed up to the mouths."}]},
  {window: 4, start_s: 21.0, end_s: 29.0, lines: [
    {t: 21.0, text: "The moment arrives: the bundles leave the coral in clusters, and pink spheres drift past the lens one after another."},
    {t: 24.5, text: "The camera pulls back with them, and the whole releasing colony comes into frame together with its neighbour."}]},
  {window: 5, start_s: 29.0, end_s: 36.0, lines: [{t: 29.0, text: "The spheres keep rising and the reef is left below; all that remains in frame is dark water and gametes drifting everywhere."}]},
  {window: 6, start_s: 36.0, end_s: 43.0, lines: [{t: 36.0, text: "Next morning, on a shallow reef flat: a thicket of interlaced coral branches, with schools of small fish weaving between them. This is the home they are carrying forward."}]}
].map(w => {
  const c = Math.round(w.start_s * FPS), d = Math.round(w.end_s * FPS);
  return {...w, out_start: c, out_end: d, length: d - c,
    sync_lines: w.lines.filter(l => l.t > w.start_s).map(l => ({t: l.t, output_frame: Math.round(l.t * FPS), offset_in_window: Math.round(l.t * FPS) - c}))};
});
const CLIPS = Array.from({length: 37}, (_, i) => String(i + 1).padStart(2, "0"));

const CONTEXT = `
You are working on task CDC-A-X07 (see ${ROOT}/instruction.md if present; the full brief is summarized here).
Task directory: ${ROOT}. Inputs: ${ROOT}/input/narration.en.txt (and .zh.txt), ${ROOT}/input/clips/01.mp4 ... 37.mp4
(37 anonymous silent underwater documentary clips, H.264 1280x720 30fps, 6-11 s each; numbering is random).
Drafts go in ${ROOT}/work/, deliverables in ${ROOT}/output/ (exactly solution.mp4, edl.json, events.csv). No network.
Generating/synthesising picture is forbidden. Do NOT guess clip content from numbers or file sizes; only use what you actually see in frames/measure.

Narration windows (programme time; output frames are half-open, 30 fps):
${WINDOWS.map(w => `Window ${w.window}: ${w.start_s.toFixed(1)}-${w.end_s.toFixed(1)} s = output frames [${w.out_start},${w.out_end}) length ${w.length} frames\n` + w.lines.map(l => `   ${l.t.toFixed(1)}s: ${l.text}`).join("\n")).join("\n")}

Rules: one distinct clip per window (6 distinct clips); one contiguous source range exactly the window length; 1x speed, forward;
no crop/scale/mirror/grade/text/transition; hard cuts. Picture must match the narration for the WHOLE window (every frame of the range).
In-window sync: Window 4's second line starts at 24.5 s = output frame 735 = 105 frames after the window start (630). The picture event it describes
(the camera starting to pull back so the whole releasing colony + its neighbour come into frame) must begin exactly at output frame 735,
i.e. source start a = (source frame where pullback begins) - 105, and the range is [a, a+240).
Watch for distractor clips that resemble the description but contradict a detail (e.g. day vs night, polyps extended vs retracted,
partial vs entire colony, white grains vs released pink spheres, fish in open water vs hugging the reef, reef still visible vs only dark water,
massive vs branching coral, sparse vs dense fish, clips containing internal cuts or content changes part-way through).
Frame indices are always 0-based decoded-frame indices counted from each clip's first decoded frame.
`;

// ---------------- Survey ----------------
phase("Survey");
const surveySchema = {
  type: "object",
  properties: {
    ok: {type: "boolean"},
    tools: {type: "string"},
    clips: {type: "array", items: {type: "object", properties: {
      clip: {type: "string"}, frames: {type: "integer"}, duration_s: {type: "number"},
      fps: {type: "string"}, width: {type: "integer"}, height: {type: "integer"},
      start_pts_nonzero: {type: "boolean"}, internal_cuts: {type: "array", items: {type: "integer"}}, notes: {type: "string"}
    }, required: ["clip", "frames"]}},
    frames_dir_pattern: {type: "string"},
    contact_sheet_pattern: {type: "string"},
    motion_pattern: {type: "string"},
    notes: {type: "string"}
  },
  required: ["ok", "clips", "frames_dir_pattern", "contact_sheet_pattern"]
};
const survey = await agent(CONTEXT + `
YOUR JOB (survey, no editorial decisions):
1. Check available tools (ffmpeg, ffprobe, python3, numpy, opencv-python, PIL). Record versions in ${ROOT}/work/env.txt.
2. For every clip 01..37: ffprobe stream info, and the exact DECODED frame count (ffprobe -count_frames or decode with ffmpeg -f null and count).
   Note any nonzero start_time / edit lists / VFR. Save ${ROOT}/work/probe.json.
3. Extract downscaled JPEG frames (e.g. 480x270) every 10 frames to ${ROOT}/work/frames/NN/f_XXXX.jpg where XXXX is the 0-based decoded frame index
   (use select by frame number n, e.g. -vf "select='not(mod(n\\,10))'" -vsync 0 and rename by index; verify naming = true frame index).
4. Build one contact sheet per clip at ${ROOT}/work/sheets/NN.jpg (tiles in time order, sampled every 15 frames, with the frame index
   drawn on each tile if drawtext/PIL fonts work; otherwise write a sidecar NN.txt listing tile order -> frame index).
5. Compute per-frame motion profiles with python (mean abs luma difference between consecutive frames; if OpenCV available also a global
   zoom/scale + translation estimate per frame via feature matching or phase correlation, which helps detect camera pull-backs/zooms).
   Save ${ROOT}/work/motion/NN.csv (frame, diff, scale, dx, dy). Flag likely internal hard cuts (diff spikes).
Write a short summary to ${ROOT}/work/survey.md. Return the structured result (paths as patterns using NN for clip id).`,
  {label: "survey", phase: "Survey", schema: surveySchema});
if (!survey) return {status: "unresolved", reason: "survey failed"};
const clipInfo = {};
for (const c of (survey.clips || [])) clipInfo[String(c.clip).padStart(2, "0")] = c;

// ---------------- Describe ----------------
phase("Describe");
const fitSchema = {type: "object", properties: {
  window: {type: "integer"}, score: {type: "number"},
  valid_source_frames: {type: "array", items: {type: "integer"}},
  reason: {type: "string"}
}, required: ["window", "score", "reason"]};
const describeSchema = {
  type: "object",
  properties: {
    clips: {type: "array", items: {type: "object", properties: {
      clip: {type: "string"},
      frames: {type: "integer"},
      lighting: {type: "string"},
      summary: {type: "string"},
      segments: {type: "array", items: {type: "object", properties: {
        start_frame: {type: "integer"}, end_frame: {type: "integer"}, description: {type: "string"}, camera_motion: {type: "string"}
      }, required: ["start_frame", "end_frame", "description"]}},
      events: {type: "array", items: {type: "object", properties: {frame: {type: "integer"}, description: {type: "string"}}, required: ["frame", "description"]}},
      window_fit: {type: "array", items: fitSchema}
    }, required: ["clip", "summary", "window_fit"]}}
  },
  required: ["clips"]
};
const batches = [];
for (let i = 0; i < CLIPS.length; i += 4) batches.push(CLIPS.slice(i, i + 4));
const descResults = await parallel(batches.map((batch, bi) => () => agent(CONTEXT + `
Survey results: ${JSON.stringify({frames_dir_pattern: survey.frames_dir_pattern, contact_sheet_pattern: survey.contact_sheet_pattern, motion_pattern: survey.motion_pattern, notes: survey.notes})}
Clip metadata: ${JSON.stringify(batch.map(c => clipInfo[c] || {clip: c}))}

YOUR JOB: visually describe clips ${batch.join(", ")} ONLY. For each clip, LOOK at its contact sheet and extracted frames (open the image files);
extract more frames yourself with ffmpeg if needed (write into ${ROOT}/work/frames/ only). Use the motion CSV to locate camera moves / cuts.
For each clip report: lighting (day/night), what the subject is (coral type: brain/massive vs branching vs close-up of polyp cups; polyps retracted or extended;
white grains on surface vs pink spheres released; fish density and whether they hug the reef; whether reef is visible), camera motion with frame numbers,
time-ordered segments covering the whole clip, and key events with exact-ish frame numbers (e.g. pull-back start, reef leaving frame, content changes).
Then window_fit: for every window this clip could plausibly serve, a score 0-10 (10 = matches every detail for a whole window-length range),
the valid_source_frames [first,last_exclusive] interval in which every frame matches that window's narration, and the reason including any contradicting detail.
Be strict and honest; report distractor-like mismatches. Also save your notes to ${ROOT}/work/desc_batch_${bi}.json.`,
  {label: `describe-${batch.join("-")}`, phase: "Describe", schema: describeSchema})));

const descriptions = {};
const missingDesc = [];
descResults.forEach((r, bi) => {
  const got = new Set();
  if (r && Array.isArray(r.clips)) for (const c of r.clips) { const id = String(c.clip).padStart(2, "0"); descriptions[id] = c; got.add(id); }
  for (const id of batches[bi]) if (!got.has(id)) missingDesc.push(id);
});
// retry missing clips once, individually
if (missingDesc.length) {
  log("Retrying descriptions for " + missingDesc.join(","));
  const retry = await parallel(missingDesc.map(id => () => agent(CONTEXT + `
Survey results: ${JSON.stringify({frames_dir_pattern: survey.frames_dir_pattern, contact_sheet_pattern: survey.contact_sheet_pattern, motion_pattern: survey.motion_pattern})}
Clip metadata: ${JSON.stringify(clipInfo[id] || {clip: id})}
YOUR JOB: visually describe clip ${id} only (look at frames; extract more with ffmpeg if needed). Report lighting, subject details, camera motion,
segments, events with frame numbers, and window_fit (score 0-10, valid_source_frames interval, reason) for any plausible window. Be strict.`,
    {label: `describe-retry-${id}`, phase: "Describe", schema: describeSchema})));
  retry.forEach((r, i) => { if (r && r.clips) for (const c of r.clips) descriptions[String(c.clip).padStart(2, "0")] = c; });
}
const stillMissing = CLIPS.filter(c => !descriptions[c]);

// ---------------- Windows ----------------
phase("Windows");
function shortlistFor(w) {
  const cands = [];
  for (const id of Object.keys(descriptions)) {
    const fit = (descriptions[id].window_fit || []).find(f => f.window === w.window);
    if (fit) cands.push({clip: id, score: fit.score, fit});
  }
  cands.sort((a, b) => b.score - a.score);
  let list = cands.filter(c => c.score >= 3).slice(0, 6);
  if (list.length < 3) list = cands.slice(0, 6);
  return list.map(c => c.clip);
}
const compactDesc = id => {
  const d = descriptions[id]; if (!d) return {clip: id, missing: true};
  return {clip: id, frames: (clipInfo[id] || {}).frames ?? d.frames, lighting: d.lighting, summary: d.summary, segments: d.segments, events: d.events, window_fit: d.window_fit};
};
const optionSchema = {
  type: "object",
  properties: {
    options: {type: "array", items: {type: "object", properties: {
      clip: {type: "string"},
      score: {type: "number"},
      clip_frames: {type: "integer"},
      valid_interval: {type: "array", items: {type: "integer"}},
      source_start: {type: "integer"},
      event_source_frame: {type: ["integer", "null"]},
      rationale: {type: "string"}
    }, required: ["clip", "score", "source_start", "rationale"]}},
    rejected: {type: "array", items: {type: "object", properties: {clip: {type: "string"}, reason: {type: "string"}}, required: ["clip", "reason"]}},
    notes: {type: "string"}
  },
  required: ["options"]
};
function windowPrompt(w, shortlist, extra) {
  const others = CLIPS.filter(c => !shortlist.includes(c)).map(c => ({clip: c, summary: descriptions[c] ? descriptions[c].summary : "(no description)", lighting: descriptions[c] ? descriptions[c].lighting : ""}));
  return CONTEXT + `
YOUR JOB: decide candidates and exact source ranges for WINDOW ${w.window} only (${w.start_s}-${w.end_s} s, length ${w.length} frames).
Narration: ${w.lines.map(l => l.t.toFixed(1) + "s: " + l.text).join(" | ")}
${w.sync_lines.length ? `SYNC: line at ${w.sync_lines[0].t}s must coincide with its picture event at output frame ${w.sync_lines[0].output_frame} (offset ${w.sync_lines[0].offset_in_window} frames into the window). Find the exact source frame where the camera pull-back BEGINS (frame-step at full 30 fps around it; use the motion/scale CSV and your own frame-difference or feature-based zoom estimate). source_start = event_source_frame - ${w.sync_lines[0].offset_in_window}; the first ${w.sync_lines[0].offset_in_window} frames must show bundles/pink spheres drifting past the lens (no pull-back yet), and after the event the whole releasing colony and its neighbour must come into frame; the range [source_start, source_start+${w.length}) must lie within the clip.` : `Choose source_start so that EVERY frame of [source_start, source_start+${w.length}) matches the narration. If the valid interval is longer than needed, prefer placing the range so it avoids any ambiguous/transitional frames (e.g. centred in the clearly-matching part), and explain.`}
Shortlisted candidates (from first-pass descriptions): ${JSON.stringify(shortlist.map(compactDesc))}
Other clips (brief, in case the shortlist missed something): ${JSON.stringify(others)}
${extra || ""}
Inspect the shortlisted clips yourself in detail (extract frames at full rate around boundaries into ${ROOT}/work/win${w.window}/). Verify each detail of the narration.
Determine each viable clip's exact valid interval and source_start. Return ALL viable options ranked best first (score 0-10), with clip_frames (decoded frame count),
event_source_frame (window 4 only, else null), and list rejected clips with reasons. Save your reasoning to ${ROOT}/work/window_${w.window}.json. Do not render deliverables.`;
}
const windowResults = await parallel(WINDOWS.map(w => () => agent(windowPrompt(w, shortlistFor(w)), {label: `window-${w.window}`, phase: "Windows", schema: optionSchema})));

// ---------------- Assign ----------------
phase("Assign");
function normalizeOptions(w, res) {
  if (!res || !Array.isArray(res.options)) return [];
  const out = [];
  for (const o of res.options) {
    const clip = String(o.clip).padStart(2, "0");
    const frames = (clipInfo[clip] && clipInfo[clip].frames) || o.clip_frames;
    let a = Math.round(o.source_start);
    if (w.sync_lines.length && Number.isInteger(o.event_source_frame)) a = o.event_source_frame - w.sync_lines[0].offset_in_window;
    const b = a + w.length;
    const valid = a >= 0 && (!frames || b <= frames) && (!w.sync_lines.length || Number.isInteger(o.event_source_frame));
    out.push({clip, score: o.score, a, b, frames, event_source_frame: o.event_source_frame ?? null, rationale: o.rationale, valid});
  }
  return out.filter(o => o.valid).sort((x, y) => y.score - x.score).slice(0, 5);
}
let optsByWindow = WINDOWS.map((w, i) => normalizeOptions(w, windowResults[i]));

// retry windows that have no valid option, with all clips shortlisted by score
for (let i = 0; i < WINDOWS.length; i++) {
  if (optsByWindow[i].length) continue;
  const w = WINDOWS[i];
  log(`Window ${w.window}: no valid option, retrying with broad shortlist`);
  const broad = Object.keys(descriptions).sort((x, y) => {
    const fx = (descriptions[x].window_fit || []).find(f => f.window === w.window), fy = (descriptions[y].window_fit || []).find(f => f.window === w.window);
    return ((fy && fy.score) || 0) - ((fx && fx.score) || 0);
  }).slice(0, 10);
  const r = await agent(windowPrompt(w, broad, "A previous attempt produced no valid in-bounds option. Range must be fully inside the clip; window 4 needs event_source_frame. Re-check carefully."), {label: `window-${w.window}-retry`, phase: "Windows", schema: optionSchema});
  optsByWindow[i] = normalizeOptions(w, r);
}

function assign(opts) {
  let best = null;
  const cur = [];
  const used = new Set();
  function dfs(i, total) {
    if (i === opts.length) { if (!best || total > best.total) best = {total, picks: cur.slice()}; return; }
    for (const o of opts[i]) {
      if (used.has(o.clip)) continue;
      used.add(o.clip); cur.push(o); dfs(i + 1, total + o.score); cur.pop(); used.delete(o.clip);
    }
  }
  dfs(0, 0);
  return best;
}
let assignment = assign(optsByWindow);
if (!assignment) {
  // conflict resolution by a worker
  const r = await agent(CONTEXT + `
Per-window ranked options (normalized, in-bounds) are: ${JSON.stringify(optsByWindow)}
Raw window analyses: ${JSON.stringify(windowResults)}
No assignment of 6 DISTINCT clips exists from these options (or some window has none). Re-inspect the conflicting/empty windows' candidates in the clips,
find alternatives, and return a complete set of options per window so a distinct assignment exists.`,
    {label: "assign-resolve", phase: "Assign", schema: {type: "object", properties: {windows: {type: "array", items: {type: "object", properties: {window: {type: "integer"}, options: optionSchema.properties.options}, required: ["window", "options"]}}}, required: ["windows"]}});
  if (r && r.windows) {
    optsByWindow = WINDOWS.map((w, i) => {
      const e = r.windows.find(x => x.window === w.window);
      const extra = e ? normalizeOptions(w, {options: e.options}) : [];
      const merged = [...optsByWindow[i]];
      for (const o of extra) if (!merged.some(m => m.clip === o.clip && m.a === o.a)) merged.push(o);
      return merged.sort((x, y) => y.score - x.score).slice(0, 6);
    });
    assignment = assign(optsByWindow);
  }
}
if (!assignment) return {status: "unresolved", reason: "no distinct assignment", optsByWindow, windowResults, stillMissing};

const segments = WINDOWS.map((w, i) => {
  const p = assignment.picks[i];
  return {window: w.window, source: p.clip, source_frames: [p.a, p.b], output_frames: [w.out_start, w.out_end]};
});
const events = [];
WINDOWS.forEach((w, i) => {
  for (const s of w.sync_lines) {
    const p = assignment.picks[i];
    const of = Number.isInteger(p.event_source_frame) ? w.out_start + (p.event_source_frame - p.a) : s.output_frame;
    events.push({line_time_s: s.t, output_frame: of});
  }
});
const edl = {segments};
log("Planned EDL: " + JSON.stringify(edl));

// ---------------- Render ----------------
phase("Render");
const renderSchema = {type: "object", properties: {
  ok: {type: "boolean"}, frame_count: {type: "integer"}, issues: {type: "array", items: {type: "string"}}, notes: {type: "string"}
}, required: ["ok", "issues"]};
const renderPrompt = (extra) => CONTEXT + `
YOUR JOB: render deliverables exactly from this EDL (do not change clip choices or ranges unless they are impossible; if impossible, report it as an issue instead):
EDL: ${JSON.stringify(edl)}
events.csv rows: ${JSON.stringify(events)}
Steps:
1. Write ${ROOT}/output/edl.json exactly as {"segments":[...]} with the 6 objects above (source as 2-digit strings, integer half-open frame intervals).
2. Write ${ROOT}/output/events.csv with header "line_time_s,output_frame" and the rows above (e.g. "24.5,735").
3. Render ${ROOT}/output/solution.mp4: for each segment take decoded frames [a,b) of ${ROOT}/input/clips/NN.mp4 (frame-accurate, e.g. ffmpeg filter
   trim=start_frame=a:end_frame=b,setpts=PTS-STARTPTS, or select between(n,a,b-1)), concatenate in order with the concat filter, no other filters
   except setsar=1 and format=yuv420p; encode libx264 high quality (e.g. -crf 10 -preset slow), -pix_fmt yuv420p, -r 30 constant frame rate (fps_mode/vsync cfr),
   -an, -movflags +faststart. Work files in ${ROOT}/work/render/.
4. Verify: ffprobe shows h264, yuv420p, 1280x720, SAR 1:1, r_frame_rate 30/1, no audio stream, exactly 1290 decoded frames (count_frames), duration 43.0 s.
   Frame-accuracy check: for each segment, compare output frames c, c+1, mid, d-1 against source frames a, a+1, mid, b-1 (PSNR or mean abs diff in python),
   and confirm the best-matching source offset is 0 (compare against a-1/a+1 too). Report any mismatch.
5. Ensure ${ROOT}/output contains exactly solution.mp4, edl.json, events.csv (remove anything else).
${extra || ""}`;
let render = await agent(renderPrompt(), {label: "render", phase: "Render", schema: renderSchema});

// ---------------- Verify / repair ----------------
phase("Verify");
const verifySchema = {type: "object", properties: {
  technical_pass: {type: "boolean"},
  content_pass: {type: "boolean"},
  technical_issues: {type: "array", items: {type: "string"}},
  content_issues: {type: "array", items: {type: "object", properties: {window: {type: "integer"}, issue: {type: "string"}, suggested_fix: {type: "string"}}, required: ["window", "issue"]}},
  measured_event_output_frame: {type: ["integer", "null"]}
}, required: ["technical_pass", "content_pass", "technical_issues", "content_issues"]};
const verify = () => agent(CONTEXT + `
YOUR JOB: independently verify the deliverables in ${ROOT}/output/ (do not edit them).
Intended EDL: ${JSON.stringify(edl)}; intended events: ${JSON.stringify(events)}.
Technical: exactly 3 files; solution.mp4 is H.264 yuv420p 1280x720 SAR 1:1 30/1 fps, no audio, exactly 1290 frames; edl.json valid format
(6 segments in time order, window 1-6, source "NN", source_frames/output_frames integer half-open, contiguous from 0 to 1290, b-a=d-c, distinct sources,
ranges within each clip's decoded frame count); events.csv header and rows; and frame-by-frame tracing: sample output frames in each segment
(including first/last) and confirm they match the declared source frames at offset 0.
Content: extract and LOOK at output frames throughout each window (e.g. every 15 frames, plus each boundary) and check each window's picture matches its narration
for the whole window (day/night, subject, polyps retracted, white grains vs pink spheres, reef visible or not, etc.). For window 4, frame-step around output frame 735
and measure the output frame where the camera pull-back actually begins (measured_event_output_frame); it should be 735 (report the deviation).
Report issues with concrete suggested fixes (e.g. different source_start, or a different clip id that you checked).`,
  {label: "verify", phase: "Verify", schema: verifySchema});

let verdict = await verify();
const history = [{render, verdict}];
const MAX_REPAIRS = (args && Number.isInteger(args.maxRepairs)) ? args.maxRepairs : 2;
for (let round = 0; round < MAX_REPAIRS; round++) {
  const passed = verdict && verdict.technical_pass && verdict.content_pass;
  if (passed) break;
  const issues = verdict ? {technical: verdict.technical_issues, content: verdict.content_issues, measured_event_output_frame: verdict.measured_event_output_frame} : {technical: ["verifier returned no result"]};
  const repairSchema = {type: "object", properties: {
    changed_edl: {type: "boolean"},
    edl: {type: "object", properties: {segments: {type: "array", items: {type: "object"}}}, required: ["segments"]},
    events: {type: "array", items: {type: "object", properties: {line_time_s: {type: "number"}, output_frame: {type: "integer"}}, required: ["line_time_s", "output_frame"]}},
    ok: {type: "boolean"}, notes: {type: "string"}
  }, required: ["changed_edl", "edl", "events", "ok"]};
  const rep = await agent(CONTEXT + `
YOUR JOB: repair the deliverables in ${ROOT}/output/ given verifier findings.
Current EDL: ${JSON.stringify(edl)}; current events: ${JSON.stringify(events)}.
Ranked per-window alternatives from analysis: ${JSON.stringify(optsByWindow)}
Verifier findings: ${JSON.stringify(issues)}
First confirm each reported issue yourself by inspecting frames (verifiers can be wrong). Fix only confirmed issues: technical problems by re-rendering;
content problems by adjusting source_start or switching to a better clip (keep 6 distinct clips, exact window lengths, window 4 pull-back at output frame 735,
events.csv output_frame = actual event frame). Re-render solution.mp4 frame-accurately (libx264 yuv420p, 1280x720, SAR 1:1, CFR 30/1, no audio, 1290 frames),
rewrite edl.json and events.csv consistently, keep output/ to exactly 3 files, and re-run frame-trace checks. Return the final EDL and events.`,
    {label: `repair-${round + 1}`, phase: "Verify", schema: repairSchema});
  if (rep && rep.edl && Array.isArray(rep.edl.segments) && rep.edl.segments.length === 6) {
    edl.segments = rep.edl.segments;
    if (Array.isArray(rep.events)) { events.length = 0; for (const e of rep.events) events.push(e); }
  }
  verdict = await verify();
  history.push({repair: rep, verdict});
}

const finalPassed = !!(verdict && verdict.technical_pass && verdict.content_pass);
return {
  status: finalPassed ? "verified" : "unresolved",
  edl, events,
  assignment_score: assignment.total,
  options_by_window: optsByWindow,
  descriptions_missing: stillMissing,
  final_verdict: verdict,
  history
};
