export const meta = {
  name: "cdc-a-x05-inspect-assemble-verify",
  description: "Inspect all 45 anonymous clips, match them to the seven slots, build a frame-exact 52-second edit, render it, and independently validate and repair the deliverables.",
  phases: [
    {title: "Preflight", detail: "Verify the task workspace and create scratch directories."},
    {title: "Candidate inventory", detail: "Inspect every candidate, detect internal cuts, and record visual evidence."},
    {title: "Slot matching", detail: "Rank and range candidates independently for each ordered slot."},
    {title: "Global selection", detail: "Choose seven distinct sources and exact ranges totaling 1248 frames, then review the plan."},
    {title: "Render deliverables", detail: "Create only output/solution.mp4 and output/solution.json."},
    {title: "Validate and repair", detail: "Run technical and editorial checks, then repair and revalidate if needed."}
  ]
};

const runtimeArgs = typeof args === "object" && args !== null ? args : {};
const ALL_CANDIDATE_IDS = Array.from({length: 45}, (_, index) => String(index + 1).padStart(2, "0"));
const TOTAL_OUTPUT_FRAMES = 1248;
const CUT_CLEARANCE_FRAMES = 12;

const SLOT_SPECS = [
  {
    slot: 1,
    title: "Waking",
    narrative: "Opening; establish the protagonist and his home, bringing him on stage out of darkness.",
    content: "The mouth of a burrow, at first completely dark inside; the protagonist's face gradually emerges from the darkness and his ears rise. Hard cut to a side wide shot: he crawls out of the hole, stands up and stretches.",
    camera: "Medium shot of the burrow at eye level; side wide shot from a slightly low camera; both shots locked off."
  },
  {
    slot: 2,
    title: "Greeting the morning",
    narrative: "Establish his good mood.",
    content: "Looking up at the sky, the protagonist rises into frame from the bottom edge and stretches; cut to a medium close-up of him against treetops and sky, smiling contentedly.",
    camera: "Low-angle upshot, then an eye-level medium close-up; locked off."
  },
  {
    slot: 3,
    title: "Absorbed",
    narrative: "He is lost in nature, while hinting that someone is watching.",
    content: "White flowers in the foreground; the protagonist walks up from the distance and leans in to smell them; cut to a wide shot of him from behind; then a shot through leaves, past a dark blurred foreground shape, toward the small distant protagonist; finally a close-up of him smelling the flowers, enraptured.",
    camera: "Medium shot with foreground occlusion, wide shot, voyeuristic wide shot with foreground occlusion, close-up."
  },
  {
    slot: 4,
    title: "A tender contact",
    narrative: "His gentlest moment, foreshadowing a later loss.",
    content: "The protagonist faces camera; a purple butterfly flies in from off-screen, settles on the tip of his nose, then lifts off and circles him while he breaks into an open-mouthed laugh; cut to his back as he walks toward a large tree in the distance.",
    camera: "Medium close-up, locked off; then a full shot from behind."
  },
  {
    slot: 5,
    title: "The threat gathers",
    narrative: "The antagonists appear and gather.",
    content: "Behind a fallen tree trunk, at first only one grey, fluffy small animal is present; a red small animal then joins it, and a third climbs out over the top of the trunk; a fruit they were holding drops onto the grass.",
    camera: "Low-camera medium shot, a single locked-off shot."
  },
  {
    slot: 6,
    title: "The strike",
    narrative: "The conflict erupts; cause and effect are complete within one segment.",
    content: "It starts with the throw from behind the trunk, a fruit flying out of frame; cut to a wide shot of the protagonist alone in the meadow, struck by fruit after fruit, the last one, a red fruit, landing squarely on top of his head; cut back behind the trunk, where they keep throwing.",
    camera: "Low medium shot behind the trunk, eye-level wide shot, medium shot again."
  },
  {
    slot: 7,
    title: "Humiliation",
    narrative: "Ending: the protagonist routed, his tormentors triumphant.",
    content: "A wide shot of an empty meadow and a large tree; the protagonist dashes in from frame left and runs for the trunk through a hail of falling green fruit; cut to beside the trunk, where he hides and peers out, shaken; cut to a wide shot of the three small animals jumping for joy under a tree.",
    camera: "Wide shot, medium shot beside the trunk, wide shot."
  }
];

function intArg(name, fallback, minimum, maximum) {
  const value = runtimeArgs[name];
  if (!Number.isInteger(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
}

const batchSize = intArg("batchSize", 3, 1, 5);
const inventoryRetryRounds = intArg("inventoryRetryRounds", 2, 0, 3);
const maxPlanRepairs = intArg("maxPlanRepairs", 2, 0, 4);
const maxRenderRepairs = intArg("maxRenderRepairs", 2, 0, 4);

let candidateIds = ALL_CANDIDATE_IDS.slice();
if (Array.isArray(runtimeArgs.candidateIds)) {
  const normalized = [];
  for (const value of runtimeArgs.candidateIds) {
    const numberValue = Number(value);
    if (Number.isInteger(numberValue) && numberValue >= 1 && numberValue <= 45) {
      normalized.push(String(numberValue).padStart(2, "0"));
    }
  }
  candidateIds = Array.from(new Set(normalized));
}
if (candidateIds.length === 0) {
  return {status: "unresolved", reason: "No valid candidate IDs were supplied."};
}

function makeBatches(ids, size) {
  const batches = [];
  for (let index = 0; index < ids.length; index += size) {
    batches.push(ids.slice(index, index + size));
  }
  return batches;
}

function truncateText(value, maximum) {
  const text = value === undefined || value === null ? "" : String(value);
  return text.length <= maximum ? text : text.slice(0, maximum - 1) + "…";
}

function safeJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

const preflightSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    inputs_found: {type: "integer", minimum: 0},
    ffmpeg_version: {type: "string"},
    ffprobe_version: {type: "string"},
    python_version: {type: "string"},
    input_spec_issues: {type: "array", items: {type: "string"}},
    workspace_dirs_created: {type: "array", items: {type: "string"}},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "inputs_found", "input_spec_issues", "issues"],
  additionalProperties: false
};

const inventoryBatchSchema = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          source: {type: "string", pattern: "^[0-9]{2}$"},
          file: {type: "string"},
          duration_frames: {type: "integer", minimum: 1},
          duration_seconds: {type: "number"},
          fps: {type: "string"},
          width: {type: "integer"},
          height: {type: "integer"},
          sar: {type: "string"},
          codec: {type: "string"},
          audio: {type: "boolean"},
          cut_frames: {type: "array", items: {type: "integer", minimum: 1}, uniqueItems: true},
          shots: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                start_frame: {type: "integer", minimum: 0},
                end_frame: {type: "integer", minimum: 1},
                description: {type: "string"},
                camera: {type: "string"},
                action: {type: "string"},
                characters: {type: "string"},
                colors_and_light: {type: "string"}
              },
              required: ["start_frame", "end_frame", "description", "camera", "action"],
              additionalProperties: false
            }
          },
          summary: {type: "string"},
          notable_objects: {type: "array", items: {type: "string"}},
          slot_hints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slot: {type: "integer", minimum: 1, maximum: 7},
                score: {type: "integer", minimum: 0, maximum: 100},
                matching: {type: "string"},
                missing: {type: "string"}
              },
              required: ["slot", "score", "matching", "missing"],
              additionalProperties: false
            }
          },
          inspection: {
            type: "object",
            properties: {
              contact_sheets: {type: "array", items: {type: "string"}},
              cut_detection_method: {type: "string"},
              frames_spot_checked: {type: "array", items: {type: "integer", minimum: 0}},
              confidence: {type: "string"}
            },
            required: ["contact_sheets", "cut_detection_method", "confidence"],
            additionalProperties: false
          }
        },
        required: ["source", "file", "duration_frames", "fps", "width", "height", "sar", "codec", "audio", "cut_frames", "shots", "summary", "slot_hints", "inspection"],
        additionalProperties: false
      }
    }
  },
  required: ["candidates"],
  additionalProperties: false
};

const slotReportSchema = {
  type: "object",
  properties: {
    slot: {type: "integer", minimum: 1, maximum: 7},
    search_complete: {type: "boolean"},
    ranked_candidates: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          source: {type: "string", pattern: "^[0-9]{2}$"},
          fit_score: {type: "integer", minimum: 0, maximum: 100},
          confidence: {type: "integer", minimum: 0, maximum: 100},
          observed_shot_order: {type: "array", items: {type: "string"}},
          matching_content: {type: "string"},
          missing_or_risks: {type: "string"},
          internal_cut_frames: {type: "array", items: {type: "integer", minimum: 1}, uniqueItems: true},
          recommended_ranges: {
            type: "array",
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                start_frame: {type: "integer", minimum: 0},
                end_frame: {type: "integer", minimum: 1},
                contains_all_content: {type: "boolean"},
                cut_clearance_ok: {type: "boolean"},
                rationale: {type: "string"}
              },
              required: ["start_frame", "end_frame", "contains_all_content", "cut_clearance_ok", "rationale"],
              additionalProperties: false
            }
          },
          evidence_paths: {type: "array", items: {type: "string"}}
        },
        required: ["source", "fit_score", "confidence", "observed_shot_order", "matching_content", "missing_or_risks", "internal_cut_frames", "recommended_ranges", "evidence_paths"],
        additionalProperties: false
      }
    },
    rejected_notables: {type: "array", items: {type: "string"}},
    notes: {type: "string"}
  },
  required: ["slot", "search_complete", "ranked_candidates", "rejected_notables", "notes"],
  additionalProperties: false
};

const planSchema = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          slot: {type: "integer", minimum: 1, maximum: 7},
          source: {type: "string", pattern: "^[0-9]{2}$"},
          source_frames: {type: "array", minItems: 2, maxItems: 2, items: {type: "integer", minimum: 0}},
          duration_frames: {type: "integer", minimum: 1},
          content_evidence: {type: "string"}
        },
        required: ["slot", "source", "source_frames", "duration_frames", "content_evidence"],
        additionalProperties: false
      }
    },
    total_frames: {type: "integer", enum: [TOTAL_OUTPUT_FRAMES]},
    rationale: {type: "string"},
    alternatives_considered: {type: "array", items: {type: "string"}},
    unresolved_uncertainties: {type: "array", items: {type: "string"}}
  },
  required: ["segments", "total_frames", "rationale", "alternatives_considered", "unresolved_uncertainties"],
  additionalProperties: false
};

const reviewSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}},
    slot_findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: {type: "integer", minimum: 1, maximum: 7},
          passed: {type: "boolean"},
          notes: {type: "string"}
        },
        required: ["slot", "passed", "notes"],
        additionalProperties: false
      }
    },
    measured: {type: "object"},
    suggested_repairs: {type: "array", items: {type: "string"}}
  },
  required: ["passed", "issues", "slot_findings", "suggested_repairs"],
  additionalProperties: false
};

const rendererSchema = {
  type: "object",
  properties: {
    rendered: {type: "boolean"},
    solution_json_written: {type: "boolean"},
    commands: {type: "array", items: {type: "string"}},
    ffprobe_summary: {type: "object"},
    checks: {type: "array", items: {type: "string"}},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["rendered", "solution_json_written", "commands", "checks", "issues"],
  additionalProperties: false
};

const repairSchema = {
  type: "object",
  properties: {
    completed: {type: "boolean"},
    changes: {type: "array", items: {type: "string"}},
    remaining_issues: {type: "array", items: {type: "string"}}
  },
  required: ["completed", "changes", "remaining_issues"],
  additionalProperties: false
};

function preflightPrompt() {
  return [
    "Read instruction.md in the workspace and perform only an environment preflight for this video assembly task.",
    "Verify that input/01.mp4 through input/45.mp4 exist and use ffprobe to confirm the public container/video properties: H.264 video, 640x360, SAR 1:1, 24 fps, no audio. Do not analyze story content yet.",
    "Confirm that python3, ffmpeg, and ffprobe are available. Create these scratch directories if absent: work/manifests, work/inspection, work/matching, work/plans, work/render, work/validation.",
    "Do not modify input/. Do not create, delete, or modify anything in output/. Do not use the network or any external knowledge about the source film.",
    "Return the structured preflight result."
  ].join("\n");
}

function inventoryPrompt(batch, attempt) {
  const files = batch.map(id => "input/" + id + ".mp4").join(", ");
  return [
    "Read instruction.md. You are producing a forensic visual inventory for a frame-exact video edit.",
    "Analyze only these candidate files: " + files + ".",
    "For each candidate:",
    "1. Use ffprobe with frame counting to determine the exact source frame count. Verify codec, dimensions, SAR, fps, and whether audio exists.",
    "2. Use ffmpeg and Python as needed to detect original shot cuts. A cut frame is the first frame after the cut; exclude frame 0 and the frame just past the end. Confirm suspected cuts visually, because scene-score thresholds can miss or invent cuts.",
    "3. Create inspection assets under work/inspection/NN/: at minimum a dense contact sheet spanning the entire clip plus frame strips or individual frames around every suspected cut and around important actions. Inspect the assets with the available visual tools and spot-check the original video when needed.",
    "4. Describe every shot in chronological order using half-open frame intervals [start_frame, end_frame). Record action, characters, camera angle/framing/movement, foreground/background, important objects, colors, and lighting.",
    "5. Compare the clip against all seven slot descriptions in instruction.md. List plausible slot hints, exact matching details, and missing details. Do not use filename order, external film knowledge, attribution, or guesswork.",
    "6. Write the complete per-candidate manifest to work/manifests/NN.json. The manifest should contain the same factual fields as your returned candidate object.",
    "Do not modify input/ or output/. Put all scratch files only under work/. This is inventory attempt " + attempt + ".",
    "Return one JSON object with a candidates array in the requested schema."
  ].join("\n");
}

function slotMatcherPrompt(spec, inventoryIndex, attempt) {
  return [
    "Read instruction.md. You are matching one ordered slot to the anonymous candidates for a frame-exact edit.",
    "Assigned slot " + spec.slot + ": " + spec.title,
    "Narrative function: " + spec.narrative,
    "Required content, in this order: " + spec.content,
    "Camera language: " + spec.camera,
    "First read all available per-candidate manifests in work/manifests and the inspection assets in work/inspection. Then inspect the actual videos and/or additional extracted frames for every plausible candidate before ranking it. Manifests are evidence, not proof.",
    "Compact inventory index:",
    safeJson(inventoryIndex),
    "Rank up to eight distinct candidates for this slot. For each ranked candidate, give the observed shot order, the precise content matches, missing elements or risks, internal cut frames, and up to four candidate half-open source ranges [start_frame, end_frame). Every recommended range must contain all required slot content in the required order and place both boundaries at least 12 frames away from every internal cut. Include a tight range and, when possible, a flexible range that still preserves all content.",
    "Remember that candidate numbers are random, several candidates can overlap, and the eventual global plan must use seven different sources. Do not identify the film or use outside knowledge. Do not modify input/ or output/.",
    "Write your full report to work/matching/slot-" + spec.slot + ".json and return it in the requested schema. This is matching attempt " + attempt + "."
  ].join("\n");
}

function plannerPrompt(slotReports, inventoryIndex, round) {
  return [
    "Read instruction.md. You are the global selection planner for the 7-slot, 52-second sequence.",
    "Use the seven slot reports below, the per-candidate manifests, inspection assets, and original videos. Independently inspect the leading candidate for every slot and enough alternatives to resolve overlaps or ambiguity. Do not merely trust the reports.",
    "Slot reports:",
    safeJson(slotReports),
    "Compact inventory:",
    safeJson(inventoryIndex),
    "Select exactly one candidate for each slot, in slot order, with all seven sources different. For each source choose one contiguous half-open source range [a,b), at original speed and direction. The range must still contain every required event and shot in its slot description, in order. It must not require scaling, cropping, mirroring, filtering, text, interpolation, dropped frames, or transitions. Each boundary must be at least 12 frames from every original cut inside that selected segment. The sum of b-a over all seven segments must be exactly 1248 frames.",
    "Use Python enumeration if useful to search feasible ranges and exact durations. When overlapping candidates show portions of the same event, compare their actual frame content and choose the candidate that most completely and unambiguously satisfies the slot; retain alternatives in the rationale.",
    "Write the selected plan to work/plans/edit_plan_round_" + round + ".json. Return only the requested plan schema, with source frame numbers relative to frame 0 of each chosen candidate. Do not render or modify output/."
  ].join("\n");
}

function planReviewPrompt(enrichedPlan, slotReports) {
  return [
    "Read instruction.md. Independently review this proposed frame plan before any rendering.",
    "Proposed plan, with output intervals computed as half-open ranges:",
    safeJson(enrichedPlan),
    "Relevant slot reports are available in work/matching and are summarized here:",
    safeJson(slotReports),
    "For each segment, inspect the actual source video over the selected source_frames range and frames immediately outside it. Verify that the range contains every required slot event and shot in the specified order, that the camera language fits, that no required action is trimmed away, and that the chosen candidate is more plausible than close alternatives. Independently detect/verify original cuts inside the selected range and check that both selected boundaries are at least 12 frames from each internal cut.",
    "Also verify seven distinct sources, slot order 1 through 7, half-open intervals, source bounds, equal source/output durations, contiguous output coverage from 0 to 1248, and total 1248 frames.",
    "Do not modify input/ or output/. You may create review assets under work/plans/review_assets. Return the requested verdict; list concrete, actionable issues and suggested repairs if it does not pass."
  ].join("\n");
}

function planRepairPrompt(currentPlan, issues, slotReports, inventoryIndex, round) {
  return [
    "Read instruction.md. Repair the proposed 7-segment frame plan using the actual videos and all existing evidence.",
    "Current proposed plan:",
    safeJson(currentPlan),
    "Issues to address:",
    safeJson(issues),
    "Slot reports:",
    safeJson(slotReports),
    "Compact inventory:",
    safeJson(inventoryIndex),
    "Inspect the affected candidates and any close alternatives directly. Make the smallest justified changes, but replace a candidate or range whenever needed. Preserve all task constraints: seven distinct sources, one contiguous original-direction range per source, all slot content in order, 12-frame clearance from every internal cut, and exactly 1248 total frames.",
    "Write the corrected plan to work/plans/edit_plan_round_" + round + ".json. Do not render or modify output/. Return the complete corrected plan in the requested schema."
  ].join("\n");
}

function renderPrompt(enrichedPlan, attempt) {
  return [
    "Read instruction.md. Render the two public deliverables from this verified frame plan.",
    "Verified plan:",
    safeJson(enrichedPlan),
    "Requirements:",
    "- output/ must contain exactly solution.mp4 and solution.json and no other files. Remove any prior contents of output/ before rendering.",
    "- Use the seven segments in slot order. For each segment take exactly source frames [a,b) from input/NN.mp4, original direction and speed. Do not scale, crop, mirror, filter the image, add text, interpolate, duplicate, or drop frames.",
    "- Use frame-accurate decoded-frame selection, preferably ffmpeg trim=start_frame:end_frame plus setpts/concat in a filter graph. Do not rely on inaccurate input seeking. Hard cuts only.",
    "- output/solution.mp4 must be H.264, yuv420p, 640x360, SAR 1:1, constant 24/1 fps, no audio track, exactly 1248 frames / 52.000 seconds. Use lossless x264 CRF 0 if available, otherwise CRF no higher than 18.",
    "- Write output/solution.json as exactly one top-level object with a segments array of exactly 7 objects in slot order. Each object must have exactly the keys slot, source, source_frames, output_frames. Use the plan's integer half-open intervals and no extra fields.",
    "- Also copy the verified plan, including any rationale you need, to work/plans/final_plan.json. Keep intermediates under work/render only.",
    "- After rendering, run ffprobe and a self-check that output frame count, fps, codec, pixel format, dimensions, SAR, and audio absence are correct.",
    "Return the requested render report. This is render attempt " + attempt + "."
  ].join("\n");
}

function technicalValidationPrompt(enrichedPlan) {
  return [
    "Read instruction.md. Perform an independent technical validation of output/solution.mp4 and output/solution.json. Do not modify output/; put scratch files only under work/validation/technical.",
    "Expected plan:",
    safeJson(enrichedPlan),
    "Check all of the following and report concrete evidence:",
    "1. output/ contains exactly solution.mp4 and solution.json.",
    "2. solution.json parses as one object with exactly seven segment objects in slot order, each with exactly slot, source, source_frames, output_frames; integer half-open ranges; distinct sources; valid source bounds; contiguous output intervals starting at 0; equal source/output durations; final output end 1248.",
    "3. ffprobe shows H.264 video, yuv420p, 640x360, SAR 1:1, constant 24/1 fps, no audio stream, exactly 1248 frames and 52.000 seconds, and CRF/quality consistent with the public limit.",
    "4. Decode frames and compare every output interval frame-by-frame with the corresponding source candidate interval. Because the renderer was instructed to use lossless x264 CRF 0, require exact decoded-pixel equality unless you can prove a container/timestamp-only difference. Report the first mismatching frame if any.",
    "5. Independently inspect/detect original cuts in each chosen candidate. For every internal cut k inside a selected [a,b), verify k-a >= 12 and b-k >= 12.",
    "6. Inspect the six edit junctions and segment endpoints for duplicate, dropped, blended, black, or flash frames. Hard cuts are required, with no transitions.",
    "Return the requested verdict. A missing file or inability to perform a required check is a failure, not a pass."
  ].join("\n");
}

function editorialValidationPrompt(enrichedPlan) {
  return [
    "Read instruction.md. Perform an independent editorial/content validation of output/solution.mp4 and the declared source ranges. Do not modify output/; put contact sheets or extracted frames only under work/validation/editorial.",
    "Declared plan:",
    safeJson(enrichedPlan),
    "Watch or inspect the rendered sequence and compare it with the seven slot descriptions in instruction.md. For every slot, verify the narrative function, every required action and shot, their order, and the camera language after trimming. Verify that no important action is cut off, that the selected candidate is visually the best-supported candidate among the evidence in work/manifests and work/matching, that the seven sources are distinct, and that the sequence reads as hard cuts with no extra frames.",
    "Do not use the candidate numbering, the source film's identity, or outside knowledge as evidence. Report concrete frame/slot issues and suggested repairs. Return the requested verdict."
  ].join("\n");
}

function deliverableRepairPrompt(enrichedPlan, renderReport, technicalReview, editorialReview, round) {
  return [
    "Read instruction.md. Repair the deliverables in output/ based on these independent validation results.",
    "Current expected plan:",
    safeJson(enrichedPlan),
    "Renderer report:",
    safeJson(renderReport),
    "Technical review:",
    safeJson(technicalReview),
    "Editorial review:",
    safeJson(editorialReview),
    "Use the existing manifests, slot reports, plan files, source videos, and current output. Determine the minimal correction. If a selected range or candidate is wrong, inspect actual frames and update the plan; otherwise fix only the render or JSON problem. Re-render frame-accurately if necessary and rewrite solution.json exactly to the public format. Enforce all constraints: seven distinct sources, all slot content in order, 12-frame internal-cut clearance, exactly 1248 frames, H.264 yuv420p 640x360 SAR 1:1 constant 24 fps, no audio, CRF 0 or no higher than 18, hard cuts, and only two files in output/.",
    "Keep all scratch under work/render/repair_" + round + " or work/validation. Do not delete input/ or evidence under work/manifests, work/inspection, or work/matching.",
    "Return the requested repair report listing every change and any remaining issue."
  ].join("\n");
}

function isValidInventoryEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (!/^[0-9]{2}$/.test(entry.source || "")) return false;
  if (!Number.isInteger(entry.duration_frames) || entry.duration_frames < 1) return false;
  if (!Array.isArray(entry.cut_frames) || !Array.isArray(entry.shots) || entry.shots.length === 0) return false;
  const seenCuts = new Set();
  for (const cut of entry.cut_frames) {
    if (!Number.isInteger(cut) || cut < 1 || cut >= entry.duration_frames || seenCuts.has(cut)) return false;
    seenCuts.add(cut);
  }
  return typeof entry.summary === "string" && entry.summary.length > 0;
}

function acceptInventoryResults(results, groups, inventoryById) {
  for (let groupIndex = 0; groupIndex < results.length; groupIndex++) {
    const result = results[groupIndex];
    const expected = new Set(groups[groupIndex]);
    if (!result || !Array.isArray(result.candidates)) continue;
    for (const entry of result.candidates) {
      if (entry && expected.has(entry.source) && isValidInventoryEntry(entry)) {
        inventoryById[entry.source] = entry;
      }
    }
  }
}

function compactInventoryEntry(entry) {
  return {
    source: entry.source,
    manifest: "work/manifests/" + entry.source + ".json",
    duration_frames: entry.duration_frames,
    cut_frames: entry.cut_frames,
    summary: truncateText(entry.summary, 900),
    shots: entry.shots.map(shot => ({
      start_frame: shot.start_frame,
      end_frame: shot.end_frame,
      camera: truncateText(shot.camera, 220),
      action: truncateText(shot.action, 500),
      description: truncateText(shot.description, 500)
    })),
    slot_hints: entry.slot_hints.map(hint => ({
      slot: hint.slot,
      score: hint.score,
      matching: truncateText(hint.matching, 350),
      missing: truncateText(hint.missing, 350)
    })),
    inspection_assets: entry.inspection && Array.isArray(entry.inspection.contact_sheets) ? entry.inspection.contact_sheets : []
  };
}

function isValidSlotReport(report, slot, inventoryById) {
  if (!report || report.slot !== slot || !Array.isArray(report.ranked_candidates)) return false;
  for (const candidate of report.ranked_candidates) {
    const inventory = candidate && inventoryById[candidate.source];
    if (!inventory) return false;
    if (!Array.isArray(candidate.recommended_ranges)) return false;
    for (const range of candidate.recommended_ranges) {
      if (!range || !Number.isInteger(range.start_frame) || !Number.isInteger(range.end_frame)) return false;
      if (range.start_frame < 0 || range.end_frame <= range.start_frame || range.end_frame > inventory.duration_frames) return false;
    }
  }
  return true;
}

function evaluatePlan(plan, inventoryById) {
  const violations = [];
  if (!plan || !Array.isArray(plan.segments)) {
    return {ok: false, violations: ["Plan is missing a segments array."], enriched: null};
  }
  if (plan.segments.length !== 7) violations.push("Plan must contain exactly 7 segments.");
  const ordered = plan.segments.slice().sort((left, right) => Number(left.slot) - Number(right.slot));
  const seenSlots = new Set();
  const seenSources = new Set();
  const outputSegments = [];
  let outputCursor = 0;
  for (let index = 0; index < ordered.length; index++) {
    const segment = ordered[index];
    const expectedSlot = index + 1;
    if (!segment || segment.slot !== expectedSlot) {
      violations.push("Segment at sorted position " + expectedSlot + " must have slot " + expectedSlot + ".");
      continue;
    }
    if (seenSlots.has(segment.slot)) violations.push("Duplicate slot " + segment.slot + ".");
    seenSlots.add(segment.slot);
    if (!/^[0-9]{2}$/.test(segment.source || "")) {
      violations.push("Slot " + segment.slot + " has an invalid source ID.");
      continue;
    }
    if (seenSources.has(segment.source)) violations.push("Source " + segment.source + " is used more than once.");
    seenSources.add(segment.source);
    const inventory = inventoryById[segment.source];
    if (!inventory) {
      violations.push("No completed inventory exists for source " + segment.source + ".");
      continue;
    }
    if (!Array.isArray(segment.source_frames) || segment.source_frames.length !== 2) {
      violations.push("Slot " + segment.slot + " source_frames must contain exactly two integers.");
      continue;
    }
    const start = Number(segment.source_frames[0]);
    const end = Number(segment.source_frames[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      violations.push("Slot " + segment.slot + " source frame bounds must be integers.");
      continue;
    }
    if (start < 0 || end <= start || end > inventory.duration_frames) {
      violations.push("Slot " + segment.slot + " range [" + start + "," + end + ") is outside source " + segment.source + " bounds 0.." + inventory.duration_frames + ".");
      continue;
    }
    const duration = end - start;
    if (Number.isInteger(segment.duration_frames) && segment.duration_frames !== duration) {
      violations.push("Slot " + segment.slot + " declares duration " + segment.duration_frames + " but range duration is " + duration + ".");
    }
    for (const cut of inventory.cut_frames || []) {
      if (cut > start && cut < end) {
        const before = cut - start;
        const after = end - cut;
        if (before < CUT_CLEARANCE_FRAMES || after < CUT_CLEARANCE_FRAMES) {
          violations.push("Slot " + segment.slot + " range [" + start + "," + end + ") is only " + before + "/" + after + " frames around internal cut " + cut + " of source " + segment.source + ".");
        }
      }
    }
    const outputStart = outputCursor;
    const outputEnd = outputStart + duration;
    outputCursor = outputEnd;
    outputSegments.push({
      slot: segment.slot,
      source: segment.source,
      source_frames: [start, end],
      output_frames: [outputStart, outputEnd]
    });
  }
  if (outputCursor !== TOTAL_OUTPUT_FRAMES) {
    violations.push("Total output length is " + outputCursor + " frames, not " + TOTAL_OUTPUT_FRAMES + ".");
  }
  return {
    ok: violations.length === 0,
    violations,
    enriched: {
      segments: outputSegments,
      total_frames: outputCursor,
      rationale: plan.rationale || "",
      alternatives_considered: Array.isArray(plan.alternatives_considered) ? plan.alternatives_considered : [],
      unresolved_uncertainties: Array.isArray(plan.unresolved_uncertainties) ? plan.unresolved_uncertainties : []
    }
  };
}

function missingReview(name, review) {
  return review ? review : {
    passed: false,
    issues: [name + " validator returned null or could not be invoked."],
    slot_findings: [],
    suggested_repairs: ["Re-run " + name + " validation before accepting the deliverables."]
  };
}

phase("Preflight");
log("Verifying workspace and tools before candidate inspection.");
const preflight = await agent(preflightPrompt(), {
  label: "preflight",
  phase: "Preflight",
  schema: preflightSchema
});
if (!preflight || preflight.passed !== true) {
  return {
    status: "unresolved",
    reason: "Environment preflight failed or returned no result.",
    preflight
  };
}

phase("Candidate inventory");
const batches = makeBatches(candidateIds, batchSize);
log("Inspecting " + candidateIds.length + " candidates in " + batches.length + " batches.");
const initialInventoryResults = await parallel(batches.map((batch, batchIndex) => () => agent(
  inventoryPrompt(batch, 1),
  {
    label: "inventory-" + batch[0] + "-" + batch[batch.length - 1],
    phase: "Candidate inventory",
    schema: inventoryBatchSchema
  }
)));
const inventoryById = {};
acceptInventoryResults(initialInventoryResults, batches, inventoryById);
let missingInventoryIds = candidateIds.filter(id => !inventoryById[id]);
for (let retryRound = 1; retryRound <= inventoryRetryRounds && missingInventoryIds.length > 0; retryRound++) {
  log("Retrying inventory for " + missingInventoryIds.length + " candidates individually.");
  const retryGroups = missingInventoryIds.map(id => [id]);
  const retryResults = await parallel(retryGroups.map(group => () => agent(
    inventoryPrompt(group, retryRound + 1),
    {
      label: "inventory-retry-" + retryRound + "-" + group[0],
      phase: "Candidate inventory",
      schema: inventoryBatchSchema
    }
  )));
  acceptInventoryResults(retryResults, retryGroups, inventoryById);
  missingInventoryIds = candidateIds.filter(id => !inventoryById[id]);
}
if (missingInventoryIds.length > 0) {
  return {
    status: "unresolved",
    reason: "Candidate inventory is incomplete; refusing to guess clip identities.",
    missing_candidates: missingInventoryIds,
    completed_candidates: Object.keys(inventoryById).sort()
  };
}
const inventoryIndex = candidateIds.map(id => compactInventoryEntry(inventoryById[id]));

phase("Slot matching");
log("Matching all seven slots against the complete inventory.");
let slotReports = await parallel(SLOT_SPECS.map(spec => () => agent(
  slotMatcherPrompt(spec, inventoryIndex, 1),
  {
    label: "match-slot-" + spec.slot,
    phase: "Slot matching",
    schema: slotReportSchema
  }
)));
const invalidSlotNumbers = [];
for (let index = 0; index < slotReports.length; index++) {
  if (!isValidSlotReport(slotReports[index], index + 1, inventoryById)) invalidSlotNumbers.push(index + 1);
}
if (invalidSlotNumbers.length > 0) {
  log("Retrying slot matching for slots: " + invalidSlotNumbers.join(", "));
  const retryReports = await parallel(invalidSlotNumbers.map(slot => () => agent(
    slotMatcherPrompt(SLOT_SPECS[slot - 1], inventoryIndex, 2),
    {
      label: "match-slot-" + slot + "-retry",
      phase: "Slot matching",
      schema: slotReportSchema
    }
  )));
  for (let index = 0; index < invalidSlotNumbers.length; index++) {
    const slot = invalidSlotNumbers[index];
    if (isValidSlotReport(retryReports[index], slot, inventoryById)) slotReports[slot - 1] = retryReports[index];
  }
}
const missingSlotReports = SLOT_SPECS.map(spec => spec.slot).filter(slot => !isValidSlotReport(slotReports[slot - 1], slot, inventoryById));
if (missingSlotReports.length > 0) {
  return {
    status: "unresolved",
    reason: "Slot matching is incomplete; refusing to guess clip identities.",
    missing_slot_reports: missingSlotReports,
    completed_slot_reports: slotReports.filter((report, index) => isValidSlotReport(report, index + 1, inventoryById))
  };
}

phase("Global selection");
log("Planning seven distinct source ranges totaling 1248 frames.");
let proposedPlan = await agent(plannerPrompt(slotReports, inventoryIndex, 0), {
  label: "global-plan",
  phase: "Global selection",
  schema: planSchema
});
if (!proposedPlan) {
  return {
    status: "unresolved",
    reason: "Global planner returned no usable plan.",
    slot_reports: slotReports
  };
}
let verifiedPlan = null;
let planReview = null;
let planIssues = [];
for (let round = 0; round <= maxPlanRepairs; round++) {
  const evaluated = evaluatePlan(proposedPlan, inventoryById);
  if (!evaluated.ok) {
    planReview = null;
    planIssues = evaluated.violations;
  } else {
    planReview = await agent(planReviewPrompt(evaluated.enriched, slotReports), {
      label: "plan-review-" + round,
      phase: "Global selection",
      schema: reviewSchema
    });
    if (planReview && planReview.passed === true) {
      verifiedPlan = evaluated.enriched;
      break;
    }
    planIssues = planReview && Array.isArray(planReview.issues) && planReview.issues.length > 0
      ? planReview.issues
      : ["Plan reviewer did not pass the plan or returned no result."];
  }
  if (round === maxPlanRepairs) break;
  const repairedPlan = await agent(planRepairPrompt(proposedPlan, planIssues, slotReports, inventoryIndex, round + 1), {
    label: "plan-repair-" + (round + 1),
    phase: "Global selection",
    schema: planSchema
  });
  if (!repairedPlan) {
    return {
      status: "unresolved",
      reason: "Plan repair returned no result.",
      unresolved_issues: planIssues,
      last_plan: proposedPlan,
      last_plan_review: planReview
    };
  }
  proposedPlan = repairedPlan;
}
if (!verifiedPlan) {
  const finalEvaluation = evaluatePlan(proposedPlan, inventoryById);
  return {
    status: "unresolved",
    reason: "No frame plan passed deterministic and editorial review.",
    unresolved_issues: planIssues,
    deterministic_violations: finalEvaluation.violations,
    last_plan: proposedPlan,
    last_plan_review: planReview
  };
}

phase("Render deliverables");
log("Rendering the verified plan to output/solution.mp4 and output/solution.json.");
let renderReport = await agent(renderPrompt(verifiedPlan, 1), {
  label: "render",
  phase: "Render deliverables",
  schema: rendererSchema
});
if (!renderReport || renderReport.rendered !== true || renderReport.solution_json_written !== true) {
  log("Initial render did not report success; retrying once.");
  renderReport = await agent(renderPrompt(verifiedPlan, 2), {
    label: "render-retry",
    phase: "Render deliverables",
    schema: rendererSchema
  });
}
if (!renderReport || renderReport.rendered !== true || renderReport.solution_json_written !== true) {
  return {
    status: "unresolved",
    reason: "Renderer did not produce both deliverables.",
    plan: verifiedPlan,
    render_report: renderReport
  };
}

phase("Validate and repair");
let technicalReview = null;
let editorialReview = null;
const repairReports = [];
for (let round = 0; round <= maxRenderRepairs; round++) {
  const validationResults = await parallel([
    () => agent(technicalValidationPrompt(verifiedPlan), {
      label: "technical-validation-" + round,
      phase: "Validate and repair",
      schema: reviewSchema
    }),
    () => agent(editorialValidationPrompt(verifiedPlan), {
      label: "editorial-validation-" + round,
      phase: "Validate and repair",
      schema: reviewSchema
    })
  ]);
  technicalReview = missingReview("Technical", validationResults[0]);
  editorialReview = missingReview("Editorial", validationResults[1]);
  if (technicalReview.passed === true && editorialReview.passed === true) {
    return {
      status: "verified",
      deliverables: {
        video: "output/solution.mp4",
        manifest: "output/solution.json"
      },
      plan: verifiedPlan,
      assignments: verifiedPlan.segments.map(segment => ({
        slot: segment.slot,
        source: segment.source,
        source_frames: segment.source_frames,
        output_frames: segment.output_frames,
        duration_frames: segment.output_frames[1] - segment.output_frames[0]
      })),
      evidence: {
        manifests: "work/manifests",
        inspection_assets: "work/inspection",
        slot_reports: "work/matching",
        final_plan: "work/plans/final_plan.json"
      },
      verification: {
        render_report: renderReport,
        technical_review: technicalReview,
        editorial_review: editorialReview,
        repairs: repairReports
      }
    };
  }
  if (round === maxRenderRepairs) break;
  log("Validation found issues; requesting deliverable repair round " + (round + 1) + ".");
  const repairReport = await agent(deliverableRepairPrompt(verifiedPlan, renderReport, technicalReview, editorialReview, round + 1), {
    label: "deliverable-repair-" + (round + 1),
    phase: "Validate and repair",
    schema: repairSchema
  });
  repairReports.push(repairReport);
  if (!repairReport || repairReport.completed !== true) {
    return {
      status: "unresolved",
      reason: "Deliverable repair failed or returned no result.",
      plan: verifiedPlan,
      render_report: renderReport,
      technical_review: technicalReview,
      editorial_review: editorialReview,
      repairs: repairReports
    };
  }
}

return {
  status: "unresolved",
  reason: "Deliverables did not pass technical and editorial validation within the repair budget.",
  plan: verifiedPlan,
  render_report: renderReport,
  technical_review: technicalReview,
  editorial_review: editorialReview,
  repairs: repairReports,
  unresolved_issues: {
    technical: technicalReview && Array.isArray(technicalReview.issues) ? technicalReview.issues : ["Technical validation unavailable."],
    editorial: editorialReview && Array.isArray(editorialReview.issues) ? editorialReview.issues : ["Editorial validation unavailable."]
  }
};