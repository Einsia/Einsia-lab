export const meta = {
  name: "cdc-a-x07-cut-to-narration",
  description: "Cut 37 anonymous underwater candidate clips to a locked 43-second, 6-window coral-reef narration script and deliver output/solution.mp4, output/edl.json and output/events.csv",
  phases: [
    { title: "Recon", detail: "Parse the narration timeline and inventory all 37 clips with ffprobe" },
    { title: "Clip analysis", detail: "One worker per clip: describe content, camera motion and timed events" },
    { title: "Selection", detail: "Assign one distinct clip and one exact-length source range per window, honouring in-window sync" },
    { title: "Selection review", detail: "Frame-level check that each chosen range matches its window's narration for the whole window" },
    { title: "Render", detail: "Write output/solution.mp4, output/edl.json and output/events.csv exactly" },
    { title: "Final QA", detail: "Probe, trace and validate every deliverable; repair if needed" }
  ]
};

const FPS = 30;
const TOTAL_FRAMES = 1290;
const MAX_SEL_REPAIRS = (args && Number.isFinite(args.maxSelectionRepairs)) ? args.maxSelectionRepairs : 2;
const MAX_QA_REPAIRS = (args && Number.isFinite(args.maxQaRepairs)) ? args.maxQaRepairs : 2;

const pad = (n) => String(n).padStart(2, "0");
const CLIP_IDS = Array.from({ length: 37 }, (_, i) => pad(i + 1));

// Known narration structure (from input/narration.en.txt). A recon worker re-parses
// the file at runtime and the script cross-checks; these literals are the fallback.
const EXPECTED_WINDOWS = [
  {
    window: 1, start_s: 0, end_s: 7,
    lines: [{ time_s: 0, text: "A coral reef is one of the most crowded places in the sea: a huge school of fish streams densely past the lens, hugging the reef and almost hiding the rock behind it." }]
  },
  {
    window: 2, start_s: 7, end_s: 13,
    lines: [{ time_s: 7, text: "Up close by day, the whole frame is tiny round cups packed side by side in neat rows. Each cup holds one polyp, and right now every polyp is pulled in." }]
  },
  {
    window: 3, start_s: 13, end_s: 21,
    lines: [{ time_s: 13, text: "Night. In frame is an entire brain-coral colony, its surface speckled all over with white grains: the bundles have already been pushed up to the mouths." }]
  },
  {
    window: 4, start_s: 21, end_s: 29,
    lines: [
      { time_s: 21, text: "The moment arrives: the bundles leave the coral in clusters, and pink spheres drift past the lens one after another." },
      { time_s: 24.5, text: "The camera pulls back with them, and the whole releasing colony comes into frame together with its neighbour." }
    ]
  },
  {
    window: 5, start_s: 29, end_s: 36,
    lines: [{ time_s: 29, text: "The spheres keep rising and the reef is left below; all that remains in frame is dark water and gametes drifting everywhere." }]
  },
  {
    window: 6, start_s: 36, end_s: 43,
    lines: [{ time_s: 36, text: "Next morning, on a shallow reef flat: a thicket of interlaced coral branches, with schools of small fish weaving between them. This is the home they are carrying forward." }]
  }
];

const NARRATION_DIGEST = EXPECTED_WINDOWS.map((w) => {
  const lines = w.lines.map((l) => `    line @ ${l.time_s}s: ${l.text}`).join("\n");
  return `Window ${w.window} (${w.start_s}-${w.end_s}s, ${Math.round((w.end_s - w.start_s) * FPS)} frames):\n${lines}`;
}).join("\n");

// ---------- schemas ----------

const scoutSchema = {
  type: "object", additionalProperties: false,
  required: ["windows", "toolsOk", "notes"],
  properties: {
    windows: {
      type: "array", minItems: 6, maxItems: 6,
      items: {
        type: "object", additionalProperties: false,
        required: ["window", "start_s", "end_s", "lines"],
        properties: {
          window: { type: "integer" }, start_s: { type: "number" }, end_s: { type: "number" },
          lines: {
            type: "array",
            items: {
              type: "object", additionalProperties: false, required: ["time_s", "text"],
              properties: { time_s: { type: "number" }, text: { type: "string" } }
            }
          }
        }
      }
    },
    toolsOk: { type: "boolean" },
    notes: { type: "string" }
  }
};

const inventorySchema = {
  type: "object", additionalProperties: false,
  required: ["clips", "notes"],
  properties: {
    clips: {
      type: "array", minItems: 37, maxItems: 37,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "frames", "width", "height", "fps", "duration_s"],
        properties: {
          id: { type: "string", pattern: "^[0-9]{2}$" },
          frames: { type: "integer" }, width: { type: "integer" },
          height: { type: "integer" }, fps: { type: "number" }, duration_s: { type: "number" }
        }
      }
    },
    notes: { type: "string" }
  }
};

const clipSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "frames", "summary", "scenes", "keyEvents", "candidateWindows"],
  properties: {
    id: { type: "string" },
    frames: { type: "integer" },
    summary: { type: "string" },
    scenes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["start_s", "end_s", "description"],
        properties: { start_s: { type: "number" }, end_s: { type: "number" }, description: { type: "string" } }
      }
    },
    keyEvents: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["time_s", "description"],
        properties: { time_s: { type: "number" }, description: { type: "string" } }
      }
    },
    candidateWindows: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["window", "fit", "rationale"],
        properties: {
          window: { type: "integer", minimum: 1, maximum: 6 },
          fit: { type: "string", enum: ["strong", "possible", "weak"] },
          rationale: { type: "string" }
        }
      }
    }
  }
};

const selectionSchema = {
  type: "object", additionalProperties: false,
  required: ["segments"],
  properties: {
    segments: {
      type: "array", minItems: 6, maxItems: 6,
      items: {
        type: "object", additionalProperties: false,
        required: ["window", "source", "sourceStartFrame", "sourceEndFrame", "rationale"],
        properties: {
          window: { type: "integer", minimum: 1, maximum: 6 },
          source: { type: "string", pattern: "^[0-9]{2}$" },
          sourceStartFrame: { type: "integer", minimum: 0 },
          sourceEndFrame: { type: "integer", minimum: 1 },
          syncEventSourceFrames: {
            type: "array",
            items: {
              type: "object", additionalProperties: false, required: ["line_time_s", "sourceFrame"],
              properties: { line_time_s: { type: "number" }, sourceFrame: { type: "integer" } }
            }
          },
          rationale: { type: "string" }
        }
      }
    }
  }
};

const reviewSchema = {
  type: "object", additionalProperties: false,
  required: ["passed", "issues"],
  properties: {
    passed: { type: "boolean" },
    issues: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["window", "description", "suggestedFix"],
        properties: { window: { type: "integer" }, description: { type: "string" }, suggestedFix: { type: "string" } }
      }
    }
  }
};

const renderSchema = {
  type: "object", additionalProperties: false,
  required: ["ok", "probeSummary", "notes"],
  properties: { ok: { type: "boolean" }, probeSummary: { type: "string" }, notes: { type: "string" } }
};

const qaSchema = {
  type: "object", additionalProperties: false,
  required: ["passed", "issues", "checks"],
  properties: {
    passed: { type: "boolean" },
    issues: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["area", "description"],
        properties: { area: { type: "string" }, description: { type: "string" }, fixHint: { type: "string" } }
      }
    },
    checks: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["name", "ok", "detail"],
        properties: { name: { type: "string" }, ok: { type: "boolean" }, detail: { type: "string" } }
      }
    }
  }
};

// ---------- deterministic helpers ----------

function windowsMatch(a, b) {
  if (!a || a.length !== 6) return false;
  for (let i = 0; i < 6; i++) {
    if (Math.abs(a[i].start_s - b[i].start_s) > 0.01 || Math.abs(a[i].end_s - b[i].end_s) > 0.01) return false;
    if ((a[i].lines || []).length !== b[i].lines.length) return false;
    for (let j = 0; j < b[i].lines.length; j++) {
      if (Math.abs(a[i].lines[j].time_s - b[i].lines[j].time_s) > 0.01) return false;
    }
  }
  return true;
}

function windowLenFrames(w) { return Math.round((w.end_s - w.start_s) * FPS); }
function windowStartFrame(w) { return Math.round(w.start_s * FPS); }

function validateSelection(sel, frameCounts, windows) {
  const problems = [];
  if (!sel || !Array.isArray(sel.segments) || sel.segments.length !== 6) {
    return { ok: false, problems: ["selection must contain exactly 6 segments"] };
  }
  const byWindow = new Map();
  for (const s of sel.segments) {
    if (byWindow.has(s.window)) problems.push(`window ${s.window} appears more than once`);
    byWindow.set(s.window, s);
  }
  for (let w = 1; w <= 6; w++) if (!byWindow.has(w)) problems.push(`window ${w} is missing`);
  if (problems.length) return { ok: false, problems };
  const sources = sel.segments.map((s) => s.source);
  if (new Set(sources).size !== 6) problems.push(`the 6 windows must use 6 distinct candidates; got: ${sources.join(",")}`);
  for (const s of sel.segments) {
    const win = windows[s.window - 1];
    const len = windowLenFrames(win);
    const actual = s.sourceEndFrame - s.sourceStartFrame;
    if (actual !== len) problems.push(`window ${s.window}: range length ${actual} != window length ${len} frames`);
    const fc = frameCounts[s.source];
    if (fc != null && (s.sourceStartFrame < 0 || s.sourceEndFrame > fc)) {
      problems.push(`window ${s.window}: range [${s.sourceStartFrame},${s.sourceEndFrame}] exceeds clip ${s.source} which has ${fc} frames`);
    }
  }
  return { ok: problems.length === 0, problems };
}

// Shift / check source ranges so in-window sync lines land exactly on their line start.
function enforceSync(sel, windows) {
  const adjustments = [];
  const segments = sel.segments.map((s) => ({ ...s }));
  for (const seg of segments) {
    const win = windows[seg.window - 1];
    const syncLines = win.lines.filter((l) => l.time_s > win.start_s + 1e-9);
    if (syncLines.length === 0) continue;
    const len = windowLenFrames(win);
    const winStart = windowStartFrame(win);
    const provided = (seg.syncEventSourceFrames || [])
      .filter((e) => syncLines.some((l) => Math.abs(l.time_s - e.line_time_s) < 1e-6));
    if (syncLines.length === 1) {
      const line = syncLines[0];
      const wantOffset = Math.round(line.time_s * FPS) - winStart;
      const ev = provided.length ? provided[0] : null;
      if (!ev) {
        adjustments.push(`window ${seg.window}: no syncEventSourceFrames entry for the line at ${line.time_s}s; range left as-is`);
        continue;
      }
      const newStart = ev.sourceFrame - wantOffset;
      const newEnd = newStart + len;
      if (newStart !== seg.sourceStartFrame) {
        adjustments.push(`window ${seg.window}: range shifted to [${newStart},${newEnd}] so the event at source frame ${ev.sourceFrame} lands at output frame ${Math.round(line.time_s * FPS)} (offset ${wantOffset} frames into the window)`);
      }
      seg.sourceStartFrame = newStart;
      seg.sourceEndFrame = newEnd;
    } else {
      for (const line of syncLines) {
        const ev = provided.find((e) => Math.abs(e.line_time_s - line.time_s) < 1e-6);
        const wantOffset = Math.round(line.time_s * FPS) - winStart;
        if (!ev) { adjustments.push(`window ${seg.window}: missing event frame for line at ${line.time_s}s`); continue; }
        if (ev.sourceFrame - seg.sourceStartFrame !== wantOffset) {
          adjustments.push(`window ${seg.window}: event for ${line.time_s}s at source frame ${ev.sourceFrame} has offset ${ev.sourceFrame - seg.sourceStartFrame}, expected ${wantOffset}`);
        }
      }
    }
  }
  return { selection: { segments }, adjustments };
}

function buildEdlJson(sel, windows) {
  const segments = sel.segments.slice().sort((a, b) => a.window - b.window).map((s) => {
    const win = windows[s.window - 1];
    return {
      window: s.window,
      source: s.source,
      source_frames: [s.sourceStartFrame, s.sourceEndFrame],
      output_frames: [windowStartFrame(win), windowStartFrame(win) + windowLenFrames(win)]
    };
  });
  return JSON.stringify({ segments }, null, 2);
}

function buildEventsCsv(windows) {
  const rows = ["line_time_s,output_frame"];
  for (const w of windows) {
    for (const l of w.lines) {
      if (l.time_s > w.start_s + 1e-9) rows.push(`${l.time_s},${Math.round(l.time_s * FPS)}`);
    }
  }
  return rows.join("\n") + "\n";
}

// ---------- prompts ----------

function clipPrompt(id) {
  return [
    "You are one worker in a video-editing task. First read instruction.md in the workspace for full context.",
    "Overall task: cut picture for a 43-second science short about how coral reefs reproduce. There are 6 narration time windows and 37 anonymous candidate clips (H.264, 1280x720, 30 fps, silent, 6-11 s each). Numbering is random and carries no order information.",
    `Your ONLY job: analyse the content of one candidate clip: input/clips/${id}.mp4.`,
    "Do not edit any deliverables and do not touch output/. Write scratch files only under work/analysis/" + id + "/.",
    "",
    "The 6 narration windows you are matching against are:",
    NARRATION_DIGEST,
    "",
    "Steps:",
    `1. mkdir -p work/analysis/${id}`,
    `2. Confirm the clip's exact frame count: ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames,r_frame_rate,width,height,duration -of json input/clips/${id}.mp4`,
    `3. Extract stills so you can actually SEE the clip, e.g. one frame per second plus a denser burst (every ~0.25 s) wherever the content changes: ffmpeg -i input/clips/${id}.mp4 -vf fps=1 work/analysis/${id}/f_%03d.jpg (adapt as needed). View the stills.`,
    "4. Describe what you see precisely: subject, framing, lighting (day/night), scale (close-up / medium / wide), camera behaviour (static, pan, tilt, zoom in/out, camera pulling back), and subject motion.",
    "5. Record timed key events with approximate timecodes in seconds, especially: any scene or content change inside the clip; coral spawning / gamete bundles being released; pink spheres appearing; any camera pull-back or zoom START moment; fish schools entering/leaving frame.",
    "6. Judge which of the 6 narration windows this clip could fill (fit: strong/possible/weak, with rationale). Be honest: only mark 'strong' if the clip visually matches that window's description for a sustained stretch.",
    "",
    "Return the structured result. id must be \"" + id + "\". times are seconds from the clip's own start (frame 0)."
  ].join("\n");
}

function matcherIntro() {
  return [
    "You are the picture editor for a 43-second science short about coral reef reproduction. Read instruction.md for the full task.",
    "37 anonymous candidate clips live in input/clips/ (01.mp4 .. 37.mp4; 1280x720, 30 fps, silent, 6-11 s; numbering carries no order information).",
    "",
    "Narration windows (picture must match the window's text for the WHOLE window):",
    NARRATION_DIGEST,
    "",
    "Hard requirements for your selection:",
    "- exactly one candidate clip per window, 6 distinct candidates in total;",
    "- for each window, one contiguous source range measured in the candidate's own frames, half-open [start,end), whose length equals the window length exactly: windows 1,5,6 = 210 frames, window 2 = 180 frames, windows 3,4 = 240 frames;",
    "- 1x speed, original direction, no crop/scale/mirror/grade/text/transition; hard cuts between windows;",
    "- in-window sync: window 4 has a second narration line starting at 24.5 s. The camera-pull-back event it describes must land at output frame 735, i.e. 105 frames into window 4's range. Provide syncEventSourceFrames with the source frame of the candidate at which the pull-back begins, and choose the range so that (pullBackSourceFrame - sourceStartFrame) = 105; equivalently set sourceStartFrame = pullBackSourceFrame - 105. No other window has a line after its window start.",
    "- the picture content must match the narration for the entire chosen range (check the whole range, not just its first frame)."
  ].join("\n");
}

function matcherPrompt(analysisDigest, frameCounts, missingIds) {
  return [
    matcherIntro(),
    "",
    "Below are per-clip content analyses produced by other workers (JSON), including exact frame counts and timed key events:",
    analysisDigest,
    "",
    "You may and should verify shortlisted candidates yourself: extract stills from input/clips/NN.mp4 at specific frames with ffmpeg (e.g. ffmpeg -i input/clips/NN.mp4 -vf \"select='between(n,A,B)'\" -vsync 0 out_%03d.jpg) before finalising. Do not trust a summary that seems inconsistent with what you see.",
    missingIds.length ? ("These clips have NO analysis (worker failed); inspect them yourself if relevant: " + missingIds.join(", ")) : "",
    "",
    "Choose the best assignment. Prefer clips whose content matches a window's description continuously over the whole window length, and where any required sync event exists at a usable position. Return exactly 6 segments (windows 1-6, each once, distinct sources), with sourceStartFrame/sourceEndFrame integers, and for window 4 also syncEventSourceFrames = [{\"line_time_s\":24.5,\"sourceFrame\":<frame where the camera pull-back begins>}]."
  ].filter(Boolean).join("\n");
}

function fixPrompt(currentSelection, problems, adjustments) {
  return [
    matcherIntro(),
    "",
    "The previous selection was rejected. Problems found:",
    problems.map((p) => "- " + p).join("\n"),
    adjustments.length ? ("Automatic adjustments already applied / noted:\n" + adjustments.map((a) => "- " + a).join("\n")) : "",
    "",
    "Previous selection (JSON):",
    JSON.stringify(currentSelection, null, 2),
    "",
    "Per-clip analyses are in work/analysis/ (still frames per clip) and the clip summaries used earlier are in work/clip-analyses.json. Re-inspect any clip you need with ffmpeg/ffprobe. Produce a corrected selection with the same output schema: exactly 6 segments, distinct sources, correct lengths (210/180/240/240/210/210 frames for windows 1-6), ranges inside each clip's frame count, and for window 4 the pull-back event exactly 105 frames into the range (give syncEventSourceFrames). Change as few windows as needed to fix the problems."
  ].filter(Boolean).join("\n");
}

function reviewPrompt(sel, windows) {
  const segLines = sel.segments.slice().sort((a, b) => a.window - b.window).map((s) => {
    const win = windows[s.window - 1];
    return `- window ${s.window} (${win.start_s}-${win.end_s}s): clip input/clips/${s.source}.mp4 frames [${s.sourceStartFrame},${s.sourceEndFrame})`;
  }).join("\n");
  return [
    "You are a frame-level continuity reviewer for a 43-second coral-reef science short. Read instruction.md for the task.",
    "The editor has chosen these source ranges:",
    segLines,
    "",
    "Narration windows:",
    NARRATION_DIGEST,
    "",
    "For EACH window, verify by looking at actual frames, not by trusting descriptions:",
    `1. Extract stills across the ENTIRE chosen range of input/clips/NN.mp4, e.g. ffmpeg -i input/clips/NN.mp4 -vf "select='between(n,A,B-1)'" -vsync 0 work/review/w<W>_%03d.jpg, and inspect start, ~25%, ~50%, ~75% and the last frame, plus a dense burst around any content change.`,
    "2. Check the picture matches that window's narration text for the WHOLE range (no stretch that contradicts the text, no mid-range content change that breaks the description).",
    "3. Window 4 only: the camera pull-back / reveal of the whole colony with its neighbour must BEGIN at source frame (sourceStartFrame + 105), which will be output frame 735 (24.5 s). Check the frames just before and just after that offset.",
    "4. Also sanity-check variety: the 6 windows must use 6 distinct clips (they do in this selection) and should not look like duplicates of each other.",
    "",
    "Report passed=true only if all 6 windows fully match. Otherwise list concrete issues per window with a suggested fix (e.g. alternative clip id and/or range). Write scratch files only under work/review/."
  ].join("\n");
}

function renderPrompt(sel, windows, edlJson, eventsCsv) {
  const inputs = sel.segments.slice().sort((a, b) => a.window - b.window)
    .map((s) => `-i input/clips/${s.source}.mp4`).join(" ");
  const trims = sel.segments.slice().sort((a, b) => a.window - b.window)
    .map((s, i) => `[${i}:v]trim=start_frame=${s.sourceStartFrame}:end_frame=${s.sourceEndFrame},setpts=PTS-STARTPTS[s${i}]`).join(";");
  const concatIn = sel.segments.map((_, i) => `[s${i}]`).join("");
  return [
    "You are the finishing/render worker for a 43-second science short. Read instruction.md for the full task.",
    "The creative selection is final. Do not change it. Produce exactly three files in output/ and nothing else:",
    "",
    "1) output/solution.mp4 — 1280x720, H.264/yuv420p, SAR 1:1, constant 30/1 fps, NO audio track, exactly 1290 frames (43.0 s). It must be a frame-exact concatenation of these source ranges at 1x speed, original direction, no crop/scale/mirror/grade/text/transitions, hard cuts:",
    edlJson,
    "",
    "Suggested approach (adapt as needed, but keep it frame-exact):",
    `  ffmpeg -y ${inputs} -filter_complex "${trims};${concatIn}concat=n=6:v=1:a=0[v]" -map "[v]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 30 -an -frames:v 1290 -movflags +faststart output/solution.mp4`,
    "Note: trim's end_frame is exclusive, which matches the half-open intervals. Verify frame-exactness afterwards (see step 4). If the concat output is off by frames, fix the command rather than trimming the output.",
    "",
    "2) output/edl.json — write EXACTLY this content (byte-for-byte, this is the authoritative EDL):",
    "<<<EDL",
    edlJson,
    "EDL>>>",
    "",
    "3) output/events.csv — write EXACTLY this content (including the trailing newline):",
    "<<<CSV",
    eventsCsv.replace(/\n$/, ""),
    "CSV>>>",
    "",
    "4) Verify before returning: ffprobe the output for codec=h264, pix_fmt=yuv420p, 1280x720, r_frame_rate=30/1, nb_frames=1290, duration=43.0, sample_aspect_ratio=1:1 and zero audio streams (ffprobe -show_streams). Also spot-check frame-exactness: extract a frame from solution.mp4 at output frame F (e.g. window start) and the corresponding source frame, and confirm they depict the same picture.",
    "Ensure output/ contains exactly solution.mp4, edl.json, events.csv (remove any other files). Scratch files go in work/. Return ok=true with an ffprobe summary only if all checks pass."
  ].join("\n");
}

function qaPrompt(edlJson, eventsCsv) {
  return [
    "You are the final QA worker for a video-editing deliverable. Read instruction.md for the full requirements.",
    "Verify the three deliverables in output/ against the authoritative EDL and events data below. Fix nothing yet — only report.",
    "",
    "Authoritative edl.json content:",
    edlJson,
    "",
    "Authoritative events.csv content:",
    eventsCsv.replace(/\n$/, ""),
    "",
    "Checks to perform:",
    "A. output/ contains exactly the three files: solution.mp4, edl.json, events.csv.",
    "B. solution.mp4: ffprobe must show h264, yuv420p, 1280x720, SAR 1:1, 30/1 fps, exactly 1290 frames, duration 43.0 s, no audio stream. Use: ffprobe -v error -count_frames -show_streams -show_format output/solution.mp4.",
    "C. output/edl.json parses and matches the authoritative content: 6 objects in time order, integer frames, half-open intervals, output_frames contiguous from 0 to 1290 with no gaps/overlaps, b-a = d-c for every segment, 6 distinct sources, every source_frames range within the corresponding clip's real frame count (re-probe input/clips/NN.mp4 with -count_frames to confirm).",
    "D. output/events.csv has header line_time_s,output_frame and exactly the rows given above (the 24.5 s line mapping to output frame 735).",
    "E. Frame tracing: for each of the 6 windows, extract a few frames from solution.mp4 (e.g. output frames c, c+len/2, d-1) and the matching frames from the source clip (a, a+len/2, b-1) and confirm they show the same picture. For a stronger check you can also compare short trims of solution.mp4 and the source with ffmpeg's psnr/ssim filter (encoding noise is fine; a different shot is not).",
    "F. Window-4 sync: at output frame 735 of solution.mp4 the camera-pull-back event must begin (compare frames 733-737 with the corresponding source frames).",
    "Report each check in 'checks' with ok true/false and a short detail. Overall passed=true only if every check passes. List any failures as issues with a concrete fixHint (e.g. which file to re-render or which field to correct). Scratch files go in work/qa/."
  ].join("\n");
}

function qaFixPrompt(qa) {
  return [
    "You are the repair worker for the deliverables of a video-editing task (read instruction.md for requirements).",
    "Final QA reported these failures:",
    JSON.stringify(qa.issues, null, 2),
    "",
    "Full QA report:",
    JSON.stringify(qa.checks, null, 2),
    "",
    "The authoritative EDL and events data are in output/edl.json and output/events.csv if they were correct; if a data file itself was wrong, regenerate it from the actual cut in output/solution.mp4 and the source clips. If solution.mp4 is wrong (wrong frames, length, format, audio track), re-render it frame-exactly from input/clips/ per the EDL using ffmpeg trim+concat (1x speed, no filters beyond trim/setpts/concat, -an, -frames:v 1290, libx264, yuv420p, -r 30).",
    "Keep the creative selection unchanged. Ensure output/ ends up containing exactly solution.mp4, edl.json and events.csv, all valid. Scratch files go in work/."
  ].join("\n");
}

// ---------- main flow ----------

phase("Recon");
log("Phase 1: parse narration and inventory clips");

const [scout, inventory] = await parallel([
  () => agent([
    "You are the recon worker for a video-editing task. Read instruction.md in the workspace first.",
    "1. Read input/narration.en.txt (and input/narration.zh.txt as a cross-check). Parse it into exactly 6 time windows with their narration lines: each line's start time in seconds and its text.",
    "2. Confirm ffmpeg and ffprobe are available (ffmpeg -version, ffprobe -version).",
    "3. List input/clips/ to confirm 37 clips 01.mp4..37.mp4 exist.",
    "Report: the 6 windows (window number 1-6, start_s, end_s, and lines with time_s and text), whether the tools are available, and any notes. Times are programme seconds. Do not modify any files."
  ].join("\n"), { label: "recon", phase: "Recon", schema: scoutSchema }),
  () => agent([
    "You are the clip-inventory worker for a video-editing task. Read instruction.md in the workspace first.",
    "For each of the 37 clips input/clips/01.mp4 .. input/clips/37.mp4, run an exact frame count probe, e.g.:",
    "  ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames,r_frame_rate,width,height,duration -of json input/clips/NN.mp4",
    "Report one entry per clip: id (two digits, e.g. \"07\"), frames (exact nb_read_frames), width, height, fps, duration_s. Report all 37. Do not modify any files. If a clip fails to probe, report its entry with frames 0 and explain in notes."
  ].join("\n"), { label: "inventory", phase: "Recon", schema: inventorySchema })
]);

let windows = EXPECTED_WINDOWS;
let narrationSource = "hardcoded fallback from instruction.md";
if (scout && windowsMatch(scout.windows, EXPECTED_WINDOWS)) {
  windows = scout.windows;
  narrationSource = "parsed from input/narration.en.txt by recon worker (matches expectation)";
} else if (scout && scout.windows.length === 6) {
  windows = scout.windows.map((w, i) => ({ window: i + 1, start_s: w.start_s, end_s: w.end_s, lines: w.lines }));
  narrationSource = "parsed from input/narration.en.txt by recon worker (DIFFERENT from expectation — used parsed values)";
  log("WARNING: parsed narration differs from expected structure; using parsed values");
} else {
  log("WARNING: recon worker failed or returned unusable narration; using hardcoded narration structure");
}
log("Narration timeline source: " + narrationSource);

if (scout && scout.toolsOk === false) {
  return { status: "unresolved", reason: "ffmpeg/ffprobe unavailable per recon worker", narrationSource };
}

const frameCounts = {};
if (inventory && Array.isArray(inventory.clips)) {
  for (const c of inventory.clips) frameCounts[c.id] = c.frames;
} else {
  log("WARNING: inventory worker failed; frame counts will come from per-clip analyses");
}

phase("Clip analysis");
log("Phase 2: analysing all 37 candidate clips (one worker per clip)");

const analyzeClip = async (id) => {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await agent(clipPrompt(id), { label: `analyze-${id}`, phase: "Clip analysis", schema: clipSchema });
    if (r && r.id === id) return r;
  }
  return null;
};

const analyses = await parallel(CLIP_IDS.map((id) => () => analyzeClip(id)));
const missingIds = CLIP_IDS.filter((_, i) => analyses[i] === null);
const okCount = analyses.filter(Boolean).length;
log(`Clip analysis complete: ${okCount}/37 succeeded` + (missingIds.length ? `; missing: ${missingIds.join(",")}` : ""));

// Fill in any missing frame counts from the analyses.
for (let i = 0; i < CLIP_IDS.length; i++) {
  const a = analyses[i];
  if (a && !(CLIP_IDS[i] in frameCounts)) frameCounts[CLIP_IDS[i]] = a.frames;
}

// Persist the condensed analyses for later workers to consult.
const analysisRecords = CLIP_IDS.map((id, i) => analyses[i] ? analyses[i] : { id, missing: true });
const analysisDigest = JSON.stringify(analysisRecords);

phase("Selection");
log("Phase 3: selecting clips and ranges per window");

let current = await agent(matcherPrompt(analysisDigest, frameCounts, missingIds), {
  label: "matcher", phase: "Selection", schema: selectionSchema
});

let bestSynced = null;        // constraint-valid, sync-adjusted selection
let bestReview = null;        // last review verdict for that selection
let lastProblems = [];
let lastAdjustments = [];

if (!current) {
  return {
    status: "unresolved",
    reason: "matcher worker failed to return a selection",
    narrationSource,
    clipsAnalysed: okCount,
    missingClips: missingIds
  };
}

for (let round = 0; round <= MAX_SEL_REPAIRS; round++) {
  const { selection: synced, adjustments } = enforceSync(current, windows);
  lastAdjustments = adjustments;
  for (const a of adjustments) log("Sync: " + a);
  const v = validateSelection(synced, frameCounts, windows);
  lastProblems = v.problems;

  if (!v.ok) {
    log(`Selection round ${round}: constraint problems: ${v.problems.join(" | ")}`);
    if (round === MAX_SEL_REPAIRS) break;
    const fixed = await agent(fixPrompt(current, v.problems, adjustments), {
      label: `selection-fix-${round + 1}`, phase: "Selection", schema: selectionSchema
    });
    if (!fixed) break;
    current = fixed;
    continue;
  }

  bestSynced = synced;
  const review = await agent(reviewPrompt(synced, windows), {
    label: `selection-review-${round + 1}`, phase: "Selection review", schema: reviewSchema
  });
  bestReview = review;
  if (!review) {
    log("Selection review worker failed; keeping constraint-valid selection");
    break;
  }
  if (review.passed) {
    log("Selection review passed");
    break;
  }
  log(`Selection review round ${round}: ${review.issues.length} issue(s): ` +
    review.issues.map((i) => `w${i.window}: ${i.description}`).join(" | "));
  if (round === MAX_SEL_REPAIRS) break;
  const fixed = await agent(
    fixPrompt(current, review.issues.map((i) => `window ${i.window}: ${i.description} (suggested fix: ${i.suggestedFix})`), adjustments),
    { label: `selection-fix-${round + 1}`, phase: "Selection", schema: selectionSchema }
  );
  if (!fixed) break;
  current = fixed;
}

if (!bestSynced) {
  return {
    status: "unresolved",
    reason: "could not reach a constraint-valid clip/range selection",
    narrationSource,
    problems: lastProblems,
    adjustments: lastAdjustments,
    clipsAnalysed: okCount,
    missingClips: missingIds
  };
}

const edlJson = buildEdlJson(bestSynced, windows);
const eventsCsv = buildEventsCsv(windows);
log("Final EDL:\n" + edlJson);
log("events.csv:\n" + eventsCsv.replace(/\n$/, ""));

phase("Render");
log("Phase 5: rendering deliverables");

const renderRes = await agent(renderPrompt(bestSynced, windows, edlJson, eventsCsv), {
  label: "render", phase: "Render", schema: renderSchema
});
if (!renderRes) {
  return {
    status: "unresolved",
    reason: "render worker failed",
    narrationSource, edl: JSON.parse(edlJson), eventsCsv,
    selectionReview: bestReview
  };
}
log("Render worker: ok=" + renderRes.ok + " — " + renderRes.probeSummary);

phase("Final QA");
log("Phase 6: QA and repair");

let qa = await agent(qaPrompt(edlJson, eventsCsv), { label: "qa-1", phase: "Final QA", schema: qaSchema });
let qaRounds = 1;
let lastQa = qa;
while (qa && !qa.passed && qaRounds <= MAX_QA_REPAIRS) {
  log(`QA round ${qaRounds} failed: ` + qa.issues.map((i) => `${i.area}: ${i.description}`).join(" | "));
  const fix = await agent(qaFixPrompt(qa), { label: `qa-fix-${qaRounds}`, phase: "Final QA" });
  if (fix === null) break;
  qa = await agent(qaPrompt(edlJson, eventsCsv), { label: `qa-${qaRounds + 1}`, phase: "Final QA", schema: qaSchema });
  lastQa = qa;
  qaRounds++;
}

const finalPassed = !!(lastQa && lastQa.passed);
log(finalPassed ? "Final QA passed" : "Final QA did not pass");

return {
  status: finalPassed ? "verified" : (lastQa ? "unresolved" : "unknown"),
  narrationSource,
  clipsAnalysed: okCount,
  missingClipAnalyses: missingIds,
  edl: JSON.parse(edlJson),
  eventsCsv: eventsCsv.replace(/\n$/, ""),
  selectionRationales: bestSynced.segments.map((s) => ({ window: s.window, source: s.source, rationale: s.rationale })),
  syncAdjustments: lastAdjustments,
  selectionReview: bestReview,
  renderReport: renderRes,
  qaReport: lastQa,
  unresolvedIssues: finalPassed ? [] : (lastQa ? lastQa.issues : [{ area: "QA", description: "QA worker failed to return a report" }])
};
