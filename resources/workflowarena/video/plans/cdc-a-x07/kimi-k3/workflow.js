export const meta = {
  name: "cdc-a-x07-picture-cut",
  description: "Coordinate clip inspection, editorial selection, exact-frame assembly, and verification for the 43-second coral-reef narration cut.",
  phases: [
    {title: "Inputs and inventory", detail: "Parse narration timing and produce technical metadata for all candidates."},
    {title: "Visual catalogue", detail: "Inspect every anonymous clip without inferring identity from its number."},
    {title: "Editorial matching", detail: "Match six distinct candidates and exact source ranges to the six narration windows."},
    {title: "Assembly", detail: "Create solution.mp4, edl.json, and events.csv with stream-copied or losslessly faithful hard cuts as permitted."},
    {title: "Verification and repair", detail: "Check technical, traceability, editorial, and event-sync requirements; repair only reported defects."}
  ]
};

const narrationPath = "input/narration.en.txt";
const narrationZhPath = "input/narration.zh.txt";
const clipsDir = "input/clips";
const workDir = "work";
const outputDir = "output";

const windows = [
  {window: 1, startS: 0.0, endS: 7.0, outputFrames: [0, 210], narration: "A coral reef is one of the most crowded places in the sea: a huge school of fish streams densely past the lens, hugging the reef and almost hiding the rock behind it."},
  {window: 2, startS: 7.0, endS: 13.0, outputFrames: [210, 390], narration: "Up close by day, the whole frame is tiny round cups packed side by side in neat rows. Each cup holds one polyp, and right now every polyp is pulled in."},
  {window: 3, startS: 13.0, endS: 21.0, outputFrames: [390, 630], narration: "Night. In frame is an entire brain-coral colony, its surface speckled all over with white grains: the bundles have already been pushed up to the mouths."},
  {window: 4, startS: 21.0, endS: 29.0, outputFrames: [630, 870], narration: "The moment arrives: the bundles leave the coral in clusters, and pink spheres drift past the lens one after another. At 24.5, the camera pulls back with them, and the whole releasing colony comes into frame together with its neighbour."},
  {window: 5, startS: 29.0, endS: 36.0, outputFrames: [870, 1080], narration: "The spheres keep rising and the reef is left below; all that remains in frame is dark water and gametes drifting everywhere."},
  {window: 6, startS: 36.0, endS: 43.0, outputFrames: [1080, 1290], narration: "Next morning, on a shallow reef flat: a thicket of interlaced coral branches, with schools of small fish weaving between them. This is the home they are carrying forward."}
];

const inventorySchema = {
  type: "object",
  properties: {
    narration: {
      type: "object",
      properties: {
        windows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              window: {type: "integer"},
              startS: {type: "number"},
              endS: {type: "number"},
              outputFrames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
              lines: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    timeS: {type: "number"},
                    outputFrame: {type: "integer"},
                    text: {type: "string"}
                  },
                  required: ["timeS", "outputFrame", "text"],
                  additionalProperties: false
                }
              }
            },
            required: ["window", "startS", "endS", "outputFrames", "lines"],
            additionalProperties: false
          }
        }
      },
      required: ["windows"],
      additionalProperties: false
    },
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          path: {type: "string"},
          durationS: {type: "number"},
          frames: {type: "integer"},
          fps: {type: "number"},
          width: {type: "integer"},
          height: {type: "integer"},
          pixelFormat: {type: "string"},
          hasAudio: {type: "boolean"}
        },
        required: ["id", "path", "durationS", "frames", "fps", "width", "height", "pixelFormat", "hasAudio"],
        additionalProperties: false
      }
    },
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["narration", "clips", "issues"],
  additionalProperties: false
};

const catalogueSchema = {
  type: "object",
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: {type: "string"},
          visualSummary: {type: "string"},
          timeline: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sourceFrames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
                sourceSeconds: {type: "array", items: {type: "number"}, minItems: 2, maxItems: 2},
                description: {type: "string"}
              },
              required: ["sourceFrames", "sourceSeconds", "description"],
              additionalProperties: false
            }
          },
          reefScale: {type: "string"},
          timeOfDay: {type: "string"},
          organismsAndEvents: {type: "array", items: {type: "string"}},
          relevantWindows: {type: "array", items: {type: "integer"}},
          eventCandidates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                event: {type: "string"},
                sourceFrame: {type: "integer"},
                confidence: {type: "string"},
                rationale: {type: "string"}
              },
              required: ["event", "sourceFrame", "confidence", "rationale"],
              additionalProperties: false
            }
          },
          ambiguities: {type: "array", items: {type: "string"}},
          evidenceFiles: {type: "array", items: {type: "string"}}
        },
        required: ["id", "visualSummary", "timeline", "reefScale", "timeOfDay", "organismsAndEvents", "relevantWindows", "eventCandidates", "ambiguities", "evidenceFiles"],
        additionalProperties: false
      }
    },
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["clips", "issues"],
  additionalProperties: false
};

const decisionsSchema = {
  type: "object",
  properties: {
    decisions: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          window: {type: "integer"},
          source: {type: "string"},
          sourceFrames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
          outputFrames: {type: "array", items: {type: "integer"}, minItems: 2, maxItems: 2},
          matchRationale: {type: "string"},
          syncRationale: {type: "string"},
          confidence: {type: "string"},
          alternatives: {type: "array", items: {type: "string"}}
        },
        required: ["window", "source", "sourceFrames", "outputFrames", "matchRationale", "syncRationale", "confidence", "alternatives"],
        additionalProperties: false
      }
    },
    events: {
      type: "array",
      items: {
        type: "object",
        properties: {
          lineTimeS: {type: "number"},
          outputFrame: {type: "integer"},
          source: {type: "string"},
          sourceFrame: {type: "integer"},
          eventDescription: {type: "string"}
        },
        required: ["lineTimeS", "outputFrame", "source", "sourceFrame", "eventDescription"],
        additionalProperties: false
      }
    },
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["decisions", "events", "issues"],
  additionalProperties: false
};

const verdictSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    checks: {
      type: "object",
      properties: {
        deliverablePresence: {type: "boolean"},
        technicalFormat: {type: "boolean"},
        edlValidity: {type: "boolean"},
        frameTraceability: {type: "boolean"},
        narrationMatch: {type: "boolean"},
        eventSync: {type: "boolean"}
      },
      required: ["deliverablePresence", "technicalFormat", "edlValidity", "frameTraceability", "narrationMatch", "eventSync"],
      additionalProperties: false
    },
    issues: {type: "array", items: {type: "string"}},
    suggestedRepairs: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "checks", "issues", "suggestedRepairs"],
  additionalProperties: false
};

function clipIds() {
  const ids = [];
  for (let i = 1; i <= 37; i++) ids.push(String(i).padStart(2, "0"));
  return ids;
}

function batched(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function commonContext() {
  return [
    "Overall task: read instruction.md and complete CDC-A-X07 in the shared workspace.",
    "Inputs are input/narration.en.txt, input/narration.zh.txt, and input/clips/01.mp4 through 37.mp4.",
    "Do not infer content from clip numbers. Inspect the actual pixels/video with available tools.",
    "The final cut must use six distinct candidates, one contiguous original-direction 1x range per window, hard cuts, no crop/scale/mirror/grade/text/transitions, no generated picture, and no audio.",
    "Programme output is 1280x720, 30 fps, exactly 1290 frames (43.0 s).",
    "Window frame intervals are: W1 [0,210), W2 [210,390), W3 [390,630), W4 [630,870), W5 [870,1080), W6 [1080,1290).",
    "Window lengths in source/output frames are 210, 180, 240, 240, 210, and 210 respectively.",
    "The only narration line after its window start is at 24.5 s, output frame 735; its picture event must begin there.",
    "Put analysis and intermediate evidence under work/; final deliverables only under output/."
  ].join("\n");
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function mergeCatalogue(results) {
  const clips = [];
  const issues = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result === null) {
      issues.push("Catalogue batch " + i + " returned no result.");
      continue;
    }
    for (const clip of result.clips) clips.push(clip);
    for (const issue of result.issues) issues.push("Batch " + i + ": " + issue);
  }
  const byId = new Map();
  for (const clip of clips) {
    if (byId.has(clip.id)) issues.push("Duplicate catalogue entry for clip " + clip.id + ".");
    byId.set(clip.id, clip);
  }
  for (const id of clipIds()) {
    if (!byId.has(id)) issues.push("Missing catalogue entry for clip " + id + ".");
  }
  return {clips: Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id)), issues};
}

function decisionProblems(decisions, inventory) {
  const problems = [];
  if (!decisions || !Array.isArray(decisions.decisions)) return ["No structured decision set returned."];
  const seenWindows = new Set();
  const seenSources = new Set();
  const clipById = new Map((inventory?.clips || []).map(clip => [clip.id, clip]));
  for (const expected of windows) {
    const found = decisions.decisions.filter(d => d.window === expected.window);
    if (found.length !== 1) problems.push("Expected exactly one decision for window " + expected.window + ".");
    if (found.length !== 1) continue;
    const d = found[0];
    seenWindows.add(d.window);
    if (seenSources.has(d.source)) problems.push("Source " + d.source + " is reused.");
    seenSources.add(d.source);
    if (JSON.stringify(d.outputFrames) !== JSON.stringify(expected.outputFrames)) {
      problems.push("Window " + d.window + " has output frames " + safeJson(d.outputFrames) + ", expected " + safeJson(expected.outputFrames) + ".");
    }
    const sourceLength = d.sourceFrames[1] - d.sourceFrames[0];
    const outputLength = d.outputFrames[1] - d.outputFrames[0];
    if (sourceLength !== outputLength) problems.push("Window " + d.window + " source/output lengths differ.");
    if (sourceLength !== expected.outputFrames[1] - expected.outputFrames[0]) problems.push("Window " + d.window + " length is not exact.");
    const clip = clipById.get(d.source);
    if (!clip) {
      problems.push("Window " + d.window + " selects unknown source " + d.source + ".");
    } else if (d.sourceFrames[0] < 0 || d.sourceFrames[1] > clip.frames) {
      problems.push("Window " + d.window + " source range exceeds clip " + d.source + " length " + clip.frames + ".");
    }
  }
  const events = decisions.events || [];
  if (events.length !== 1 || events[0].lineTimeS !== 24.5 || events[0].outputFrame !== 735) {
    problems.push("events must contain exactly the 24.5 s line at output frame 735.");
  } else {
    const w4 = decisions.decisions.find(d => d.window === 4);
    if (w4 && (events[0].source !== w4.source || events[0].sourceFrame < w4.sourceFrames[0] || events[0].sourceFrame >= w4.sourceFrames[1])) {
      problems.push("The 24.5 s event is not mapped inside the selected window-4 source range.");
    }
  }
  return problems;
}

phase("Inputs and inventory");
log("Parsing narration and inspecting candidate metadata.");
const inventory = await agent(
  commonContext() + "\n\n" +
  "Assignment: parse both narration files and inspect technical metadata for every candidate clip. Write a human-readable report to work/inventory.md and a machine-readable copy to work/inventory.json. Use ffprobe or available equivalents. Confirm frame counts from the actual video streams, not duration alone. Check fps, dimensions, pixel format, sample aspect ratio if available, and audio presence. Parse all narration windows and line start times into exact frame numbers at 30 fps. Do not select clips yet. Return the structured inventory and list any concerns.",
  {label: "inventory", phase: "Inputs and inventory", schema: inventorySchema}
);
if (inventory === null) return {status: "unresolved", stage: "inventory", reason: "Inventory worker returned null."};
const inventoryIssues = inventory.issues || [];
if (inventoryIssues.length > 0) log("Inventory concerns: " + inventoryIssues.join(" | "));

phase("Visual catalogue");
log("Cataloguing all 37 clips in independent batches.");
const batches = batched(clipIds(), 5);
const catalogueResults = await parallel(batches.map((batch, batchIndex) => () => agent(
  commonContext() + "\n\n" +
  "Assignment: visually inspect these candidate clips and only these clips: " + batch.join(", ") + ". Paths are input/clips/NN.mp4.\n" +
  "Use actual visual evidence. Create dense frame samples/contact sheets under work/catalogue/batch-" + String(batchIndex + 1).padStart(2, "0") + "/, inspect the video across its full duration, and do not rely on filenames. Describe the whole temporal progression, not just representative frames.\n" +
  "For each clip report: scene scale, reef type, day/night appearance, organisms, camera movement, spawning/gamete/bundle events, and whether the visual can sustain each narration window for its full required duration. Give timestamped timeline intervals with source-frame equivalents. For a possible release/pull-back sequence, identify the first frame at which the camera pull-back or full-colony-plus-neighbour composition begins, with rationale and uncertainty.\n" +
  "Keep candidate IDs exactly as two-digit strings. Save detailed per-clip notes as Markdown or JSON under your batch directory. Return structured data for every assigned clip. If visual inspection tooling cannot decode a clip, report that as an issue rather than guessing.",
  {label: "catalogue-" + String(batchIndex + 1).padStart(2, "0"), phase: "Visual catalogue", schema: catalogueSchema}
)));
const catalogue = mergeCatalogue(catalogueResults);
if (catalogue.issues.length > 0) log("Catalogue concerns: " + catalogue.issues.join(" | "));
if (catalogue.clips.length !== 37) {
  return {status: "unresolved", stage: "catalogue", reason: "Visual catalogue is incomplete.", inventoryIssues, catalogueIssues: catalogue.issues, catalogued: catalogue.clips.length};
}

phase("Editorial matching");
log("Matching each narration window against the complete visual catalogue.");
const editorialResults = await parallel(windows.map(w => () => agent(
  commonContext() + "\n\n" +
  "Assignment: propose the best candidate and exact half-open source frame range for narration window " + w.window + ".\n" +
  "Window output frames: [" + w.outputFrames[0] + "," + w.outputFrames[1] + "), duration " + (w.outputFrames[1] - w.outputFrames[0]) + " frames.\n" +
  "Narration to match for the entire window: " + w.narration + "\n\n" +
  "Complete visual catalogue data:\n" + safeJson(catalogue) + "\n\n" +
  "Technical inventory:\n" + safeJson(inventory) + "\n\n" +
  "Independently re-inspect the strongest candidate clips directly, using frame samples or playback as needed. Rank likely candidates, but return one primary decision. The selected source range must be contiguous, original speed/direction, exactly the window length, and within the actual clip length. The picture must fit the narration throughout the full window, not only at its start.\n" +
  (w.window === 4 ?
    "For window 4, frame-level sync is mandatory: the event at narration time 24.5 s must begin at output frame 735. That is 105 frames after the window starts, so source_event_frame - source_start_frame must equal 105. Identify the visual first frame of the camera pull-back / whole releasing colony plus neighbour composition, then set source_frames[0] = event_frame - 105 and source_frames[1] = source_frames[0] + 240. Confirm the first 105 frames also show clustered bundle release and pink spheres drifting past the lens.\n" :
    "There are no mid-window narration lines in this window, so no events.csv row is required for it; nevertheless verify visual continuity for the entire range.\n") +
  "Populate outputFrames exactly as supplied above. If ambiguity remains, report alternatives and uncertainty, but do not guess silently.",
  {label: "edit-window-" + w.window, phase: "Editorial matching", schema: decisionsSchema}
)));

const proposedDecisions = [];
const proposedEvents = [];
const editorialIssues = [];
for (let i = 0; i < editorialResults.length; i++) {
  const result = editorialResults[i];
  if (result === null) {
    editorialIssues.push("Window " + windows[i].window + " matcher returned null.");
    continue;
  }
  const relevant = result.decisions.filter(d => d.window === windows[i].window);
  if (relevant.length !== 1) {
    editorialIssues.push("Window " + windows[i].window + " matcher returned " + relevant.length + " relevant decisions.");
  } else {
    proposedDecisions.push(relevant[0]);
  }
  for (const event of result.events) proposedEvents.push(event);
  for (const issue of result.issues) editorialIssues.push("W" + windows[i].window + ": " + issue);
}
proposedDecisions.sort((a, b) => a.window - b.window);
const initialDecisionSet = {decisions: proposedDecisions, events: proposedEvents, issues: editorialIssues};
let structuralProblems = decisionProblems(initialDecisionSet, inventory);

let finalDecisions = initialDecisionSet;
if (structuralProblems.length > 0 || editorialIssues.length > 0) {
  log("Reconciling editorial conflicts or ambiguities.");
  const reconciled = await agent(
    commonContext() + "\n\n" +
    "Assignment: reconcile the six window decisions into one valid edit decision list. Re-inspect disputed clips directly as needed.\n\n" +
    "Window proposals and reported issues:\n" + safeJson(initialDecisionSet) + "\n\n" +
    "Structural problems detected by workflow code:\n" + safeJson(structuralProblems) + "\n\n" +
    "Catalogue:\n" + safeJson(catalogue) + "\n\n" +
    "Return all six final decisions in window order. Use six distinct sources. Enforce exact source/output frame lengths and the mandatory 24.5 s event at output frame 735. Preserve two-digit source IDs. Resolve ambiguities using direct visual evidence; report any unresolved issue.",
    {label: "editorial-reconciliation", phase: "Editorial matching", schema: decisionsSchema}
  );
  if (reconciled === null) return {status: "unresolved", stage: "editorial", reason: "Reconciliation returned null.", initialDecisionSet, structuralProblems};
  finalDecisions = reconciled;
  structuralProblems = decisionProblems(finalDecisions, inventory);
  if (structuralProblems.length > 0) {
    return {status: "unresolved", stage: "editorial", reason: "Decision set remains structurally invalid.", structuralProblems, decisions: finalDecisions};
  }
}

log("Editorial decisions: " + finalDecisions.decisions.map(d => "W" + d.window + "=clip " + d.source + " [" + d.sourceFrames[0] + "," + d.sourceFrames[1] + ")").join("; "));

phase("Assembly");
const assembly = await agent(
  commonContext() + "\n\n" +
  "Assignment: build the final deliverables from these exact editorial decisions. Do not change clip choices, source ranges, output placement, or event frame.\n\n" +
  safeJson(finalDecisions) + "\n\n" +
  "Create exactly these files in output/: solution.mp4, edl.json, events.csv. Remove or move any other output/ files.\n" +
  "For each segment, extract exactly the declared half-open source frame interval at 1x speed and original direction, preserving source picture geometry and content. Join in window order with hard cuts. No audio, crop, scale, mirror, grade, text, transition, or generated frames.\n" +
  "Because all candidates are stated to be 1280x720 H.264 30 fps, prefer a frame-exact method that preserves the selected source pictures faithfully. If re-encoding is needed for exact frame boundaries or container consistency, use visually lossless/high-quality H.264 yuv420p settings and explain it in work/assembly.md; do not apply filters other than unavoidable trimming/format muxing. Ensure SAR 1:1 and no audio.\n" +
  "edl.json must be exactly {\"segments\":[...]} with six objects in time order. Each object must contain window, source as a two-digit string, source_frames [a,b], and output_frames [c,d], with b-a=d-c. output intervals must be [0,210], [210,390], [390,630], [630,870], [870,1080], [1080,1290].\n" +
  "events.csv must contain header line_time_s,output_frame and exactly one data row: 24.5,735.\n" +
  "Validate solution.mp4 with ffprobe/frame counting and save commands and validation output under work/assembly.md or work/assembly-validation.txt. Return a concise report of files created and checks performed.",
  {label: "assemble-output", phase: "Assembly"}
);
if (assembly === null) return {status: "unresolved", stage: "assembly", reason: "Assembly worker returned null.", decisions: finalDecisions};

phase("Verification and repair");
let verdict = await agent(
  commonContext() + "\n\n" +
  "Assignment: independently verify all three final deliverables against instruction.md. Do not modify files.\n" +
  "Checks required:\n" +
  "1. output/ contains exactly solution.mp4, edl.json, and events.csv.\n" +
  "2. solution.mp4 is H.264/yuv420p, 1280x720, SAR 1:1, constant 30 fps, no audio, exactly 1290 frames/43.0 s.\n" +
  "3. edl.json parses exactly as specified, has six ordered segments, distinct sources, contiguous output frames, and equal source/output lengths.\n" +
  "4. Trace sampled and boundary frames from solution.mp4 back to the declared candidate source frames. Check cut boundaries and confirm no transformation or transition.\n" +
  "5. Visually check each full window against its narration. Re-inspect source clips as needed.\n" +
  "6. Confirm the 24.5 s event starts at output frame 735: inspect frames immediately before and at/after 735 and compare to the declared source mapping.\n" +
  "7. events.csv has the required header and exactly the 24.5,735 row.\n" +
  "Use deterministic tools where possible and save verification evidence under work/final-verification/. Report passed only if all checks pass. Distinguish hard failures from subjective editorial concerns, but list both.",
  {label: "verify-final", phase: "Verification and repair", schema: verdictSchema}
);

const maxRepairs = typeof args.maxRepairs === "number" && args.maxRepairs >= 0 ? Math.floor(args.maxRepairs) : 2;
for (let round = 0; verdict && !verdict.passed && round < maxRepairs; round++) {
  log("Verification found issues; requesting repair round " + (round + 1) + ".");
  const repair = await agent(
    commonContext() + "\n\n" +
    "Assignment: repair the final deliverables based on this independent verification report. Modify only what is necessary. Preserve correct editorial decisions unless the report demonstrates a wrong clip/range; if changing a decision, directly inspect the evidence and keep edl.json, events.csv, and solution.mp4 mutually consistent.\n\n" +
    "Verification report:\n" + safeJson(verdict) + "\n\n" +
    "Current intended decisions:\n" + safeJson(finalDecisions) + "\n\n" +
    "After repair, rerun relevant technical and frame-trace checks and save evidence under work/repair-" + (round + 1) + "/. Return a concise repair report.",
    {label: "repair-" + (round + 1), phase: "Verification and repair"}
  );
  if (repair === null) {
    return {status: "unresolved", stage: "repair", reason: "Repair worker returned null.", verdict, round: round + 1};
  }
  verdict = await agent(
    commonContext() + "\n\n" +
    "Assignment: re-verify the repaired final deliverables independently against instruction.md and the required checks. Do not modify files. Use the same rigorous checks: exact deliverables, stream properties, EDL consistency, source traceability, full-window narration match, and frame-735 event sync. Save evidence under work/final-verification-after-repair-" + (round + 1) + "/.",
    {label: "verify-repair-" + (round + 1), phase: "Verification and repair", schema: verdictSchema}
  );
}

if (verdict === null) {
  return {status: "unresolved", stage: "verification", reason: "Verification worker returned null.", decisions: finalDecisions, assembly};
}

return {
  status: verdict.passed ? "verified" : "unresolved",
  deliverables: ["output/solution.mp4", "output/edl.json", "output/events.csv"],
  decisions: finalDecisions.decisions,
  events: finalDecisions.events,
  inventoryIssues,
  catalogueIssues: catalogue.issues,
  editorialIssues,
  assemblyReport: assembly,
  verification: verdict
};