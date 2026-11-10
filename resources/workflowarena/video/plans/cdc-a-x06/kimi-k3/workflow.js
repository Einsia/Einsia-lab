export const meta = {
  name: "cdc-a-x06-dual-trailer-plan",
  description: "Catalog candidate clips, select ten slot-specific excerpts, assemble both trailers, and verify all deliverables.",
  phases: [
    {title: "Inventory and visual catalog", detail: "Probe all inputs and build a shared frame-accurate visual catalog."},
    {title: "Slot scouting", detail: "Independently shortlist and verify candidates for A1-A5 and B1-B5."},
    {title: "Selection and audit", detail: "Resolve each version, enforce uniqueness, and audit the visual choices."},
    {title: "Assembly", detail: "Join full clips and write the EDL and evidence JSON files."},
    {title: "Technical verification", detail: "Check codecs, frame counts, continuity, file set, and declared segments."}
  ]
};

const SLOT_ORDER = {
  comedy: ["A1", "A2", "A3", "A4", "A5"],
  suspense: ["B1", "B2", "B3", "B4", "B5"]
};

const SLOT_DEFINITIONS = {
  A1: "Entrance with irony. Function: a smug little gang makes its entrance while the audience sees a hazard hanging over their heads and they do not. Film language: opens on a tight close group shot of three small characters, eye-level to slightly low, pressing toward the lens; cuts to a low angle with a heavy object suspended at the top of frame while a huge arm sweeps past the frame edge; ends on a medium close shot of the leader holding a small object. The whole clip stays on the gang.",
  A2: "Peek gag. Function: a single-take timing gag with a peek, a retreat, and then the bystander paying for it. Film language: one locked-off camera for the whole clip; a near tree trunk at frame left is a foreground screen and a bird stands on a branch farther away at frame right; a character peeks from behind the trunk and ducks back; the bystander is hit by a small object flying in from off-screen and leaves the frame; ends on the empty branch.",
  A3: "Chain of close calls. Function: an oblivious small character dodges several disasters from nowhere one after another and carries on as if nothing happened; the gag escalates and pays off. Film language: a wide shot stays on this small character throughout; opens with a calm hold; a first large object rolls in from one side and grazes past, followed by other large objects toppling or dropping; ends with the character alone in frame, unharmed and still absorbed in its own business.",
  A4: "Deadpan scale contrast. Function: a huge figure silently appears behind the small character, who notices nothing; the laugh comes from size difference and a long pause. Film language: one essentially fixed framing; the small character is in the foreground busy with what is in front of it; the huge character walks in from the frame edge and stops right behind it; they then share the frame and the pause holds until the clip ends.",
  A5: "Closing button. Function: the character who thinks it is winning walks straight into the opponent's grip; the captor's sly grin is the button, then the picture starts to fade out. Film language: a medium shot opens on a small character edging along a branch toward a huge figure at frame right whose back is to camera; a big hand grabs it; cuts to a close two-shot of the two with the captor grinning; ends while the picture is fading down toward black.",
  B1: "Being watched. Function: establish the unease that someone in the dark is watching. Film language: opens on a low-angle wide shot of several small characters walking along a path toward camera; one walks right up to the lens and fills the frame, producing a wipe-like transition; cuts to a high-angle subjective view down on them through foreground leaves while a huge dark shape intrudes from the right foreground; ends back on an eye-level medium shot of them, unaware.",
  B2: "The threat behind. Function: the audience sees the danger while the character does not. Film language: deep staging in one essentially fixed framing; an unsuspecting small character is in the foreground, head down and busy; a huge silhouette walks in from off-screen and stops behind it, looming over it; the clip stays in this tension without release.",
  B3: "Watching from cover, then a strike. Function: a hidden figure watches from cover, then a strike from off-screen makes the bystander vanish. Film language: one locked-off camera for the whole clip; a near tree trunk screens the foreground and a bystander sits on a branch farther away; the hidden figure leans out and disappears again; the bystander is suddenly hit by something flying in from off-screen and vanishes from frame, leaving an empty shot.",
  B4: "Delay and shock. Function: hold on an unsuspecting character long enough to make the audience wait; danger finally breaks in, but the clip cuts away before the outcome and leaves suspense unresolved. Film language: wide shot with a static camera; opens with a long still hold; a huge object then rolls in from off-screen and closes on the character; ends at the most dangerous moment, as the object bears down on the character, without showing what happens.",
  B5: "Stinger. Function: a harmless small object falls and exposes a danger hidden in the ground, leaving an unresolved threat. Film language: low-angle wide shot of an empty patch of ground; a small object drops in from the top of frame and bounces; a hard cut to a close insert shows it impaled on something hidden in the ground; ends on a static wide shot of a clearing covered with these hidden things, with no character in frame."
};

const SOURCE_PATTERN = "^(0[1-9]|[12][0-9]|3[0-9])$";

const intervalSchema = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: {type: "integer", minimum: 0}
};

const inventorySchema = {
  type: "object",
  properties: {
    all_present: {type: "boolean"},
    all_specs_match: {type: "boolean"},
    clips: {
      type: "array",
      minItems: 39,
      maxItems: 39,
      items: {
        type: "object",
        properties: {
          source: {type: "string", pattern: SOURCE_PATTERN},
          path: {type: "string"},
          codec: {type: "string"},
          pix_fmt: {type: "string"},
          width: {type: "integer"},
          height: {type: "integer"},
          sar: {type: "string"},
          avg_frame_rate: {type: "string"},
          r_frame_rate: {type: "string"},
          frame_count: {type: "integer", minimum: 1},
          duration_seconds: {type: "number"},
          audio_stream_count: {type: "integer", minimum: 0}
        },
        required: ["source", "path", "codec", "pix_fmt", "width", "height", "sar", "avg_frame_rate", "r_frame_rate", "frame_count", "duration_seconds", "audio_stream_count"],
        additionalProperties: false
      }
    },
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["all_present", "all_specs_match", "clips", "issues"],
  additionalProperties: false
};

const shardSchema = {
  type: "object",
  properties: {
    shard: {type: "integer", minimum: 1, maximum: 5},
    status: {type: "string", enum: ["complete", "incomplete"]},
    catalog_path: {type: "string"},
    contact_sheet_dir: {type: "string"},
    sources_completed: {type: "array", items: {type: "string", pattern: SOURCE_PATTERN}},
    entries_written: {type: "integer", minimum: 0},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["shard", "status", "catalog_path", "contact_sheet_dir", "sources_completed", "entries_written", "issues"],
  additionalProperties: false
};

const catalogSchema = {
  type: "object",
  properties: {
    status: {type: "string", enum: ["complete", "incomplete"]},
    catalog_path: {type: "string"},
    similarity_path: {type: "string"},
    source_count: {type: "integer", minimum: 0, maximum: 39},
    all_sources_present: {type: "boolean"},
    schema_valid: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["status", "catalog_path", "similarity_path", "source_count", "all_sources_present", "schema_valid", "issues"],
  additionalProperties: false
};

const scoutCandidateSchema = {
  type: "object",
  properties: {
    source: {type: "string", pattern: SOURCE_PATTERN},
    frame_count: {type: "integer", minimum: 1},
    fit_score: {type: "integer", minimum: 0, maximum: 100},
    evidence_interval: intervalSchema,
    most_similar_other: {type: "string", pattern: SOURCE_PATTERN},
    reason_vs_most_similar: {type: "string", minLength: 20},
    opening_match: {type: "boolean"},
    ending_match: {type: "boolean"},
    internal_cut_match: {type: "boolean"},
    camera_match: {type: "boolean"},
    full_slot_match: {type: "boolean"},
    strengths: {type: "array", items: {type: "string"}},
    concerns: {type: "array", items: {type: "string"}}
  },
  required: ["source", "frame_count", "fit_score", "evidence_interval", "most_similar_other", "reason_vs_most_similar", "opening_match", "ending_match", "internal_cut_match", "camera_match", "full_slot_match", "strengths", "concerns"],
  additionalProperties: false
};

const scoutSchema = {
  type: "object",
  properties: {
    slot: {type: "string", enum: ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"]},
    status: {type: "string", enum: ["selected", "needs-more-evidence"]},
    selected_source: {type: "string", pattern: SOURCE_PATTERN},
    selected_candidate: scoutCandidateSchema,
    ranked_candidates: {type: "array", minItems: 3, maxItems: 8, items: scoutCandidateSchema},
    sources_considered: {type: "integer", minimum: 39, maximum: 39},
    search_summary: {type: "string"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["slot", "status", "selected_source", "selected_candidate", "ranked_candidates", "sources_considered", "search_summary", "issues"],
  additionalProperties: false
};

const finalSelectionItemSchema = {
  type: "object",
  properties: {
    slot: {type: "string", enum: ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"]},
    source: {type: "string", pattern: SOURCE_PATTERN},
    frame_count: {type: "integer", minimum: 1},
    evidence_interval: intervalSchema,
    most_similar_other: {type: "string", pattern: SOURCE_PATTERN},
    reason: {type: "string", minLength: 20},
    replaced_scout_choice: {type: "boolean"},
    decision_basis: {type: "string"},
    confidence: {type: "string", enum: ["high", "medium", "low"]}
  },
  required: ["slot", "source", "frame_count", "evidence_interval", "most_similar_other", "reason", "replaced_scout_choice", "decision_basis", "confidence"],
  additionalProperties: false
};

function finalVersionSchema(version) {
  return {
    type: "object",
    properties: {
      version: {type: "string", enum: [version]},
      selections: {type: "array", minItems: 5, maxItems: 5, items: finalSelectionItemSchema},
      version_unique: {type: "boolean"},
      all_requirements_met: {type: "boolean"},
      issues: {type: "array", items: {type: "string"}}
    },
    required: ["version", "selections", "version_unique", "all_requirements_met", "issues"],
    additionalProperties: false
  };
}

const selectionPairSchema = {
  type: "object",
  properties: {
    comedy: finalVersionSchema("comedy"),
    suspense: finalVersionSchema("suspense"),
    changes: {type: "array", items: {type: "string"}},
    rationale: {type: "string"},
    issues_remaining: {type: "array", items: {type: "string"}}
  },
  required: ["comedy", "suspense", "changes", "rationale", "issues_remaining"],
  additionalProperties: false
};

const auditSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    checked_clips: {type: "integer", minimum: 0},
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          version: {type: "string", enum: ["comedy", "suspense", "both"]},
          slot: {type: ["string", "null"], enum: ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5", null]},
          severity: {type: "string", enum: ["critical", "major", "minor"]},
          problem: {type: "string"},
          suggested_replacement_source: {type: ["string", "null"], pattern: SOURCE_PATTERN}
        },
        required: ["version", "slot", "severity", "problem", "suggested_replacement_source"],
        additionalProperties: false
      }
    },
    summary: {type: "string"}
  },
  required: ["passed", "checked_clips", "issues", "summary"],
  additionalProperties: false
};

const assemblySchema = {
  type: "object",
  properties: {
    status: {type: "string", enum: ["complete", "failed"]},
    method: {type: "string", enum: ["lossless-stream-copy", "crf18-reencode"]},
    output_files: {type: "array", items: {type: "string"}},
    decoded_frame_counts: {
      type: "object",
      properties: {
        comedy: {type: "integer", minimum: 1},
        suspense: {type: "integer", minimum: 1}
      },
      required: ["comedy", "suspense"],
      additionalProperties: false
    },
    wrote_exact_payload: {type: "boolean"},
    issues: {type: "array", items: {type: "string"}}
  },
  required: ["status", "method", "output_files", "decoded_frame_counts", "wrote_exact_payload", "issues"],
  additionalProperties: false
};

const verificationSchema = {
  type: "object",
  properties: {
    passed: {type: "boolean"},
    files_exact: {type: "boolean"},
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {type: "string"},
          passed: {type: "boolean"},
          detail: {type: "string"}
        },
        required: ["name", "passed", "detail"],
        additionalProperties: false
      }
    },
    issues: {type: "array", items: {type: "string"}},
    summary: {type: "string"}
  },
  required: ["passed", "files_exact", "checks", "issues", "summary"],
  additionalProperties: false
};

function failure(stage, issues, context) {
  return {
    status: "unresolved",
    stage,
    issues,
    context: context === undefined ? null : context
  };
}

function makeFrameMap(inventory) {
  const map = {};
  for (const clip of inventory.clips) map[clip.source] = clip.frame_count;
  return map;
}

function validInterval(interval, frameCount) {
  return Array.isArray(interval) && interval.length === 2 &&
    Number.isInteger(interval[0]) && Number.isInteger(interval[1]) &&
    interval[0] >= 0 && interval[1] > interval[0] &&
    interval[1] - interval[0] >= 12 && interval[1] <= frameCount;
}

function validateScoutReport(report, expectedSlot, frameMap) {
  const problems = [];
  if (!report || report.slot !== expectedSlot) problems.push("missing report or wrong slot");
  if (problems.length) return problems;
  if (report.status !== "selected") problems.push("scout did not reach a selection");
  if (report.sources_considered !== 39) problems.push("not all 39 catalog entries were considered");
  const selected = report.selected_candidate;
  if (!selected || selected.source !== report.selected_source) problems.push("selected_source does not match selected_candidate");
  if (selected) {
    const frames = frameMap[selected.source];
    if (selected.frame_count !== frames) problems.push("selected frame count disagrees with decoded inventory");
    if (!validInterval(selected.evidence_interval, frames)) problems.push("selected evidence interval is invalid or shorter than 12 frames");
    if (selected.most_similar_other === selected.source) problems.push("most-similar comparison points to the selected source itself");
    if (!selected.full_slot_match || !selected.opening_match || !selected.ending_match) problems.push("selected candidate is not asserted as matching the full slot including boundaries");
    if (!selected.reason_vs_most_similar.includes(selected.most_similar_other)) problems.push("reason does not explicitly name the most similar other candidate");
  }
  return problems;
}

function validateFinalVersion(finalVersion, version, frameMap) {
  const problems = [];
  if (!finalVersion || finalVersion.version !== version) return ["missing or wrong final version"];
  const expected = SLOT_ORDER[version];
  const seen = {};
  if (finalVersion.version_unique !== true) problems.push("version_unique is not true");
  if (finalVersion.all_requirements_met !== true) problems.push("all_requirements_met is not true");
  for (let i = 0; i < expected.length; i++) {
    const selection = finalVersion.selections[i];
    if (!selection) {
      problems.push(`missing selection ${expected[i]}`);
      continue;
    }
    if (selection.slot !== expected[i]) problems.push(`selection ${i} has slot ${selection.slot}, expected ${expected[i]}`);
    if (seen[selection.source]) problems.push(`source ${selection.source} is repeated within ${version}`);
    seen[selection.source] = true;
    const frames = frameMap[selection.source];
    if (!frames) {
      problems.push(`unknown source ${selection.source}`);
      continue;
    }
    if (selection.frame_count !== frames) problems.push(`${selection.slot}: frame count ${selection.frame_count} differs from inventory ${frames}`);
    if (!validInterval(selection.evidence_interval, frames)) problems.push(`${selection.slot}: invalid evidence interval`);
    if (selection.most_similar_other === selection.source) problems.push(`${selection.slot}: closest comparison is itself`);
    if (!selection.reason.includes(selection.most_similar_other)) problems.push(`${selection.slot}: reason does not name closest other candidate`);
  }
  return problems;
}

function seconds(frames) {
  return Number((frames / 24).toFixed(6));
}

function buildPlan(comedy, suspense, frameMap) {
  const edl = {comedy: {segments: []}, suspense: {segments: []}};
  for (const version of ["comedy", "suspense"]) {
    let cursor = 0;
    const finalVersion = version === "comedy" ? comedy : suspense;
    for (const selection of finalVersion.selections) {
      const frames = frameMap[selection.source];
      const start = cursor;
      const end = cursor + frames;
      edl[version].segments.push({
        slot: selection.slot,
        source: selection.source,
        output_frames: [start, end],
        source_frames: [0, frames],
        output: [seconds(start), seconds(end)]
      });
      cursor = end;
    }
  }
  const evidence = [];
  for (const version of ["comedy", "suspense"]) {
    const finalVersion = version === "comedy" ? comedy : suspense;
    for (const selection of finalVersion.selections) {
      evidence.push({
        version,
        slot: selection.slot,
        source: selection.source,
        source_frames: selection.evidence_interval,
        reason: selection.reason
      });
    }
  }
  return {edl, selection_evidence: evidence};
}

function inventoryPrompt() {
  return `You are the technical inventory worker for the task in /workspace/instruction.md. Work in /workspace and use only work/ for scratch files; do not modify input/ or output/.

Create /workspace/work/input-inventory.json covering input/01.mp4 through input/39.mp4, sorted by source number. For each clip, use ffprobe with frame counting enabled and record the actual decoded video frame count (for example nb_read_frames from -count_frames), codec, pixel format, width, height, sample aspect ratio, avg_frame_rate, r_frame_rate, duration, and audio stream count. Verify that all 39 files exist and are H.264/yuv420p, 640x360, SAR 1:1, constant 24 fps, with no audio. Do not infer anything from file numbers or sizes. Report any mismatch rather than normalizing it.

Return the structured result requested by the caller.`;
}

function shardPrompt(shard, sources) {
  return `You are visual catalog shard ${shard} for the task in /workspace/instruction.md. Work in /workspace. Read /workspace/work/input-inventory.json. Analyze only these anonymous candidate clips: ${sources.join(", ")}. File numbers are random and carry no story-order information.

Use FFmpeg/ffprobe and visual inspection of extracted real frames. Do not create or use generated imagery. For each assigned clip:
1. Confirm its decoded frame count against the inventory.
2. Inspect at least the first 12 and last 12 full frames, representative frames throughout, and all detectable internal shot boundaries. Increase sampling where action is fast or a boundary is ambiguous.
3. Make scratch contact sheets only from extracted frames under /workspace/work/contact-sheets/shard-${shard}/.
4. Write /workspace/work/catalog-shards/shard-${shard}.json as an object with a clips array containing exactly one detailed entry per assigned source.

Use this entry shape as far as the evidence permits:
{
  "source":"NN",
  "frame_count":N,
  "duration_seconds":D,
  "opening":{"frame_range":[a,b],"shot_size":"...","camera_angle":"...","camera_movement":"...","description":"..."},
  "ending":{"frame_range":[a,b],"shot_size":"...","camera_angle":"...","camera_movement":"...","description":"...","empty_frame":true,"fade_out_in_progress":false},
  "internal_cuts":[{"frame":N,"from":"...","to":"..."}],
  "timeline":[{"start_frame":a,"end_frame":b,"event":"..."}],
  "setting":"...",
  "small_characters":{"count":N,"positions":"...","actions":"..."},
  "huge_character":{"present":false,"position":"...","actions":"..."},
  "objects_and_hazards":[{"object":"...","motion":"...","frame_range":[a,b]}],
  "foreground_occluders":"...",
  "camera":{"locked":true,"angle":"...","framing":"...","movement":"..."},
  "visual_features":["..."],
  "comedy_features":["..."],
  "suspense_features":["..."],
  "likely_overlapping_sources":["NN"],
  "distinguishing_details":["..."],
  "uncertainties":["..."]
}

Be concrete and visual. Record how the complete candidate starts and ends, because no trimming is allowed and internal cuts count as part of the clip. Do not name or guess the source film or characters. Do not use file size or number as evidence of content. Do not alter input/ or output/. Return the compact structured shard status requested by the caller.`;
}

function catalogPrompt() {
  return `You are the catalog integration worker for /workspace/instruction.md. Read /workspace/work/input-inventory.json and all five /workspace/work/catalog-shards/shard-*.json files. Do not modify input/ or output/.

Validate and normalize them into /workspace/work/clip-catalog.json:
- exactly one entry for each source 01 through 39, in numeric order;
- every frame_count must equal the decoded inventory count;
- preserve concrete opening, ending, internal-cut, action, camera, character, object, hazard, and uncertainty details;
- retain enough information to distinguish overlapping excerpts and different in/out points of the same scene.

Also create /workspace/work/similarity-groups.json. Group candidates by observable setting/action/shot content, not filename. For each candidate likely to be confused with another, list the competing sources and the specific visible differences that can distinguish them. If a shard entry is materially ambiguous, inspect that clip directly before completing the catalog.

Return the structured integration status requested by the caller.`;
}

function scoutPrompt(slot) {
  const version = slot[0] === "A" ? "comedy" : "suspense";
  return `You are the specialist scout for slot ${slot} of the ${version} trailer in /workspace/instruction.md. Work in /workspace.

Exact slot requirement:
${SLOT_DEFINITIONS[slot]}

Assembly constraints that affect selection: the complete candidate must be used at 1x speed, in original direction, without cropping, trimming, transitions, text, grading, mirroring, added frames, or dropped frames. Therefore the complete file's actual opening and ending must satisfy the slot. Cuts already inside a candidate count. Clip numbers are random and must not be treated as story order.

Procedure:
1. Read /workspace/work/clip-catalog.json, /workspace/work/similarity-groups.json, and /workspace/work/input-inventory.json.
2. Screen all 39 catalog entries against every clause of the slot, especially its opening, internal cut structure, and ending.
3. Directly inspect the full videos for your selected clip and at least its three most similar competitors; inspect more when the catalog is ambiguous. Put scratch frame extracts only under /workspace/work/slot-evidence/${slot}/.
4. Choose the candidate whose complete boundaries and internal events best satisfy the entire slot. Do not choose on mood or narrative function alone when the film-language clauses conflict.
5. For the selected clip, choose a decisive evidence interval with at least 12 frames, using zero-based half-open source frame indexes and staying within the clip. The interval should visibly support the choice.
6. Identify the most similar other candidate and write a reason that names one concrete visible difference between the two. Generic statements such as "better timing" are insufficient.

Write the same structured report you return to /workspace/work/slot-reports/${slot}.json. Rank at least three candidates and set the selected candidate as the strongest match. Do not write anything to output/.`;
}

function resolverPrompt(version, reports) {
  const slots = SLOT_ORDER[version].join(", ");
  return `You are the final ${version} selection resolver for /workspace/instruction.md. Resolve slots ${slots}.

Here are the specialist scout reports as JSON:
${JSON.stringify(reports)}

You may also read /workspace/work/clip-catalog.json, /workspace/work/similarity-groups.json, /workspace/work/input-inventory.json, and the reports under /workspace/work/slot-reports/. Directly inspect the full nominated videos and serious runner-up videos before finalizing. You may override any scout.

Apply every clause in instruction.md for each slot, including the actual first visible moment, actual final visible moment, camera behavior, internal cuts, foreground/background staging, object motion, and unresolved versus released action. A clip will be used in full, so no imagined trim is allowed. Enforce five different sources within this ${version} version. Repetition across the other version is irrelevant to you.

For every final selection, provide:
- the two-digit source and exact decoded frame_count;
- a decisive zero-based half-open evidence_interval inside the clip, at least 12 frames long;
- the most similar non-selected candidate;
- a reason naming one specific visible difference from that candidate;
- whether you replaced the scout's choice and the basis for the decision.

Write your structured result to /workspace/work/final-selection-${version}.json. Do not modify input/ or output/.`;
}

function selectionAuditPrompt(comedy, suspense, round) {
  return `You are an independent visual selection auditor for /workspace/instruction.md. Audit this proposed final selection without assuming prior workers were right:
${JSON.stringify({comedy, suspense})}

Read the instruction and the shared catalog/reports as needed. Directly inspect each proposed full clip and the closest competitor named for it. Check:
1. Every film-language clause for A1-A5 and B1-B5, including exact openings, exact endings, internal cuts, camera behavior, staging, and object/character action.
2. Comedy and suspense narrative functions.
3. Five distinct sources within comedy and five distinct sources within suspense. Cross-version reuse is allowed.
4. Every evidence interval is inside its clip and at least 12 frames.
5. Every reason names a concrete visible difference from the stated most similar other candidate.

Do not fail a choice merely because another candidate is also plausible; fail it when a required clause is visibly violated, a boundary is wrong, a constraint is broken, or a competitor is clearly more exact. This is audit round ${round}. Return specific, actionable issues with replacement suggestions where available. Do not modify input/ or output/.`;
}

function selectionRepairPrompt(comedy, suspense, audit, round) {
  return `You are the selection repair worker for /workspace/instruction.md. Repair this final selection pair:
${JSON.stringify({comedy, suspense})}

The independent audit reported:
${JSON.stringify(audit.issues)}

Directly inspect the implicated full clips, named competitors, and relevant catalog/report evidence. Preserve correct choices. Replace only choices that fail the exact slot requirements, while enforcing five distinct sources within each version. Cross-version reuse remains allowed. Recompute evidence intervals and concrete difference reasons for every final slot, not only changed slots.

Write the complete repaired pair to /workspace/work/final-selection-repair-${round}.json and return it in the requested structure. Do not modify input/ or output/.`;
}

function assemblyPrompt(plan, round, priorIssues) {
  return `You are the assembly worker for /workspace/instruction.md. Create the public deliverables from this fixed, already-audited plan. Do not change sources, order, JSON values, or evidence text:
${JSON.stringify(plan)}

Assembly round: ${round}. Prior issues to correct: ${JSON.stringify(priorIssues || [])}

Requirements:
- Work in /workspace. First ensure /workspace/output exists and contains no leftover entries. At the end it must contain exactly comedy.mp4, suspense.mp4, edl.json, and selection-evidence.json.
- For each trailer, concatenate the five complete files named by the EDL in slot order. Use hard cuts only, full clips only, 1x speed, original direction, no crop, mirror, grade, text, transition, generated content, added frames, or dropped frames. Add no audio.
- Prefer lossless H.264 stream-copy concatenation because the inputs share the same technical parameters. If stream copying is genuinely incompatible, re-encode with libx264 at CRF 18 or better while preserving every frame and the exact 24 fps timing; report that method.
- Outputs must be H.264/yuv420p, 640x360, SAR 1:1, 24/1 fps, with no audio.
- Write output/edl.json exactly as the edl object in the plan and output/selection-evidence.json exactly as the selection_evidence array in the plan. Do not add extra JSON fields or files.
- Keep temporary concat lists and logs under /workspace/work/assembly-round-${round}/, never in output/.
- Run an initial ffprobe/decoded-frame-count check before returning.

Return the structured assembly status requested by the caller.`;
}

function verificationPrompt(plan, assembly, round) {
  return `You are the final technical verifier for /workspace/instruction.md. Independently verify the four files in /workspace/output against the instruction and this expected plan:
${JSON.stringify(plan)}

Assembly report:
${JSON.stringify(assembly)}

Verification round: ${round}. Do not trust the assembly report. Check at least:
1. output/ contains exactly comedy.mp4, suspense.mp4, edl.json, and selection-evidence.json, with no extra entries.
2. Both videos decode successfully and have H.264 video, yuv420p, 640x360, SAR 1:1, constant 24/1 fps, and no audio stream.
3. Actual decoded output frame counts equal the final EDL end frames.
4. edl.json has exactly the required versions, five ordered segments per version, required fields only, half-open contiguous output_frames beginning at 0, source_frames [0, actual source decoded frame count], and output seconds within 0.001 of frames/24.
5. Each declared output segment corresponds frame by frame to the complete declared source. For a lossless copy, compare decoded frame hashes for every frame. If assembly used CRF re-encoding, still verify frame counts and compare every corresponding frame using a robust decoded-frame similarity method, investigating any mismatch or misalignment.
6. selection-evidence.json is an array of exactly 10 objects with exactly the public fields; versions and slots are correct; each interval is half-open, at least 12 frames, and inside the source; each reason is specific and names the visible contrast.
7. The full selected source identity in each video segment agrees with the selection and no source is repeated within either version.

Use scratch only under /workspace/work/verification-round-${round}/ and do not modify output/. Return detailed checks and make passed true only if every requirement is satisfied.`;
}

async function callWithRetry(prompt, options, retries) {
  let result = await agent(prompt, options);
  for (let i = 0; result === null && i < retries; i++) {
    result = await agent(prompt, {...options, label: `${options.label}-retry-${i + 1}`});
  }
  return result;
}

phase("Inventory and visual catalog");
log("Probing all 39 candidates.");
let inventory = await callWithRetry(inventoryPrompt(), {
  label: "technical-inventory",
  phase: "Inventory and visual catalog",
  schema: inventorySchema
}, 1);
if (inventory === null) return failure("inventory", ["Technical inventory worker returned no result."]);
if (!inventory.all_present || !inventory.all_specs_match) {
  return failure("inventory", inventory.issues.length ? inventory.issues : ["Input inventory is incomplete or does not match the public technical specification."], inventory);
}
const frameMap = makeFrameMap(inventory);
log(`Inventory complete: ${inventory.clips.length} clips, ${inventory.clips.reduce((sum, clip) => sum + clip.frame_count, 0)} decoded frames.`);

const shardGroups = [
  {shard: 1, sources: ["01", "02", "03", "04", "05", "06", "07", "08"]},
  {shard: 2, sources: ["09", "10", "11", "12", "13", "14", "15", "16"]},
  {shard: 3, sources: ["17", "18", "19", "20", "21", "22", "23", "24"]},
  {shard: 4, sources: ["25", "26", "27", "28", "29", "30", "31", "32"]},
  {shard: 5, sources: ["33", "34", "35", "36", "37", "38", "39"]}
];

let shardResults = await parallel(shardGroups.map(group => () => agent(shardPrompt(group.shard, group.sources), {
  label: `visual-catalog-shard-${group.shard}`,
  phase: "Inventory and visual catalog",
  schema: shardSchema
})));

const failedShards = [];
for (let i = 0; i < shardResults.length; i++) if (shardResults[i] === null) failedShards.push(i);
if (failedShards.length) {
  const retries = await parallel(failedShards.map(index => () => agent(shardPrompt(shardGroups[index].shard, shardGroups[index].sources), {
    label: `visual-catalog-shard-${shardGroups[index].shard}-retry`,
    phase: "Inventory and visual catalog",
    schema: shardSchema
  })));
  for (let j = 0; j < failedShards.length; j++) shardResults[failedShards[j]] = retries[j];
}

const shardIssues = [];
for (let i = 0; i < shardResults.length; i++) {
  const result = shardResults[i];
  const expected = shardGroups[i].sources;
  if (result === null) {
    shardIssues.push(`Shard ${i + 1} returned no result.`);
    continue;
  }
  if (result.status !== "complete" || result.entries_written !== expected.length) shardIssues.push(`Shard ${i + 1} is incomplete.`);
  const actual = [...result.sources_completed].sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) shardIssues.push(`Shard ${i + 1} completed ${actual.join(",")}, expected ${wanted.join(",")}.`);
  shardIssues.push(...result.issues);
}
if (shardIssues.length) return failure("visual-catalog-shards", shardIssues, shardResults);

const catalog = await callWithRetry(catalogPrompt(), {
  label: "catalog-integration",
  phase: "Inventory and visual catalog",
  schema: catalogSchema
}, 1);
if (catalog === null) return failure("catalog-integration", ["Catalog integration worker returned no result."]);
if (catalog.status !== "complete" || !catalog.all_sources_present || !catalog.schema_valid || catalog.source_count !== 39) {
  return failure("catalog-integration", catalog.issues.length ? catalog.issues : ["Integrated catalog is incomplete."], catalog);
}
log("Shared visual catalog completed for all 39 clips.");

phase("Slot scouting");
const allSlots = [...SLOT_ORDER.comedy, ...SLOT_ORDER.suspense];
let scoutReports = await parallel(allSlots.map(slot => () => agent(scoutPrompt(slot), {
  label: `slot-scout-${slot}`,
  phase: "Slot scouting",
  schema: scoutSchema
})));

const invalidScouts = [];
for (let i = 0; i < allSlots.length; i++) {
  const report = scoutReports[i];
  const problems = report === null ? ["worker returned no result"] : validateScoutReport(report, allSlots[i], frameMap);
  if (problems.length) invalidScouts.push({index: i, slot: allSlots[i], problems});
}
if (invalidScouts.length) {
  const retries = await parallel(invalidScouts.map(item => () => agent(
    `${scoutPrompt(item.slot)}\n\nThe prior report was rejected for these structural reasons; correct them with direct evidence:\n${JSON.stringify(item.problems)}`,
    {label: `slot-scout-${item.slot}-retry`, phase: "Slot scouting", schema: scoutSchema}
  )));
  for (let j = 0; j < invalidScouts.length; j++) scoutReports[invalidScouts[j].index] = retries[j];
}

const scoutProblems = [];
for (let i = 0; i < allSlots.length; i++) {
  const problems = scoutReports[i] === null ? ["worker returned no result after retry"] : validateScoutReport(scoutReports[i], allSlots[i], frameMap);
  if (problems.length) scoutProblems.push(`${allSlots[i]}: ${problems.join("; ")}`);
}
if (scoutProblems.length) return failure("slot-scouting", scoutProblems, scoutReports);
log("All ten slots have structurally valid specialist recommendations.");

phase("Selection and audit");
const comedyReports = SLOT_ORDER.comedy.map(slot => scoutReports[allSlots.indexOf(slot)]);
const suspenseReports = SLOT_ORDER.suspense.map(slot => scoutReports[allSlots.indexOf(slot)]);
const resolved = await parallel([
  () => agent(resolverPrompt("comedy", comedyReports), {
    label: "resolve-comedy-selection",
    phase: "Selection and audit",
    schema: finalVersionSchema("comedy")
  }),
  () => agent(resolverPrompt("suspense", suspenseReports), {
    label: "resolve-suspense-selection",
    phase: "Selection and audit",
    schema: finalVersionSchema("suspense")
  })
]);
let comedy = resolved[0];
let suspense = resolved[1];
if (comedy === null || suspense === null) {
  return failure("selection-resolution", [
    comedy === null ? "Comedy resolver returned no result." : null,
    suspense === null ? "Suspense resolver returned no result." : null
  ].filter(Boolean), resolved);
}

let selectionProblems = [
  ...validateFinalVersion(comedy, "comedy", frameMap),
  ...validateFinalVersion(suspense, "suspense", frameMap)
];
if (selectionProblems.length) return failure("selection-resolution", selectionProblems, {comedy, suspense});

let audit = await callWithRetry(selectionAuditPrompt(comedy, suspense, 0), {
  label: "selection-audit-0",
  phase: "Selection and audit",
  schema: auditSchema
}, 1);
if (audit === null) return failure("selection-audit", ["Selection auditor returned no result."]);

const maxSelectionRepairs = typeof args.maxSelectionRepairs === "number" && args.maxSelectionRepairs >= 0 ? Math.floor(args.maxSelectionRepairs) : 2;
for (let round = 0; !audit.passed && round < maxSelectionRepairs; round++) {
  log(`Selection audit round ${round} reported ${audit.issues.length} issue(s); requesting repair.`);
  const repair = await callWithRetry(selectionRepairPrompt(comedy, suspense, audit, round + 1), {
    label: `selection-repair-${round + 1}`,
    phase: "Selection and audit",
    schema: selectionPairSchema
  }, 1);
  if (repair === null) return failure("selection-repair", [`Selection repair round ${round + 1} returned no result.`], audit);
  selectionProblems = [
    ...validateFinalVersion(repair.comedy, "comedy", frameMap),
    ...validateFinalVersion(repair.suspense, "suspense", frameMap)
  ];
  if (selectionProblems.length) return failure("selection-repair", selectionProblems, repair);
  comedy = repair.comedy;
  suspense = repair.suspense;
  audit = await callWithRetry(selectionAuditPrompt(comedy, suspense, round + 1), {
    label: `selection-audit-${round + 1}`,
    phase: "Selection and audit",
    schema: auditSchema
  }, 1);
  if (audit === null) return failure("selection-audit", [`Selection audit round ${round + 1} returned no result.`]);
}
if (!audit.passed) return failure("selection-audit", audit.issues.map(issue => `${issue.version}/${issue.slot}: ${issue.problem}`), {comedy, suspense, audit});
log("Independent audit accepted both five-clip selections.");

const plan = buildPlan(comedy, suspense, frameMap);

phase("Assembly");
let assembly = await callWithRetry(assemblyPrompt(plan, 0, []), {
  label: "assemble-trailers-0",
  phase: "Assembly",
  schema: assemblySchema
}, 0);

phase("Technical verification");
async function verifyOnce(round) {
  return await callWithRetry(verificationPrompt(plan, assembly, round), {
    label: `technical-verification-${round}`,
    phase: "Technical verification",
    schema: verificationSchema
  }, 1);
}

let verification = assembly === null ? null : await verifyOnce(0);
const maxAssemblyRepairs = typeof args.maxAssemblyRepairs === "number" && args.maxAssemblyRepairs >= 0 ? Math.floor(args.maxAssemblyRepairs) : 2;
for (let round = 0; (assembly === null || verification === null || !verification.passed) && round < maxAssemblyRepairs; round++) {
  const issues = assembly === null
    ? ["Assembly worker returned no result."]
    : verification === null
      ? ["Technical verifier returned no result after retry; rebuild and verify the deliverables."]
      : verification.issues;
  log(`Assembly/verification round ${round} failed; requesting repair.`);
  assembly = await callWithRetry(assemblyPrompt(plan, round + 1, issues), {
    label: `assemble-trailers-${round + 1}`,
    phase: "Assembly",
    schema: assemblySchema
  }, 0);
  verification = assembly === null ? null : await verifyOnce(round + 1);
}

if (assembly === null) return failure("assembly", ["Assembly worker returned no result after repair attempts."], {plan, verification});
if (verification === null) return failure("technical-verification", ["Technical verifier returned no result after repair attempts."], {plan, assembly});
if (!verification.passed) return failure("technical-verification", verification.issues, {plan, assembly, verification});

return {
  status: "complete",
  outputs: {
    comedy: "output/comedy.mp4",
    suspense: "output/suspense.mp4",
    edl: "output/edl.json",
    selection_evidence: "output/selection-evidence.json"
  },
  selected_sources: {
    comedy: comedy.selections.map(selection => ({slot: selection.slot, source: selection.source})),
    suspense: suspense.selections.map(selection => ({slot: selection.slot, source: selection.source}))
  },
  assembly_method: assembly.method,
  decoded_frame_counts: assembly.decoded_frame_counts,
  selection_audit: {
    passed: audit.passed,
    checked_clips: audit.checked_clips,
    summary: audit.summary
  },
  technical_verification: {
    passed: verification.passed,
    files_exact: verification.files_exact,
    summary: verification.summary,
    checks: verification.checks
  },
  edl: plan.edl,
  selection_evidence: plan.selection_evidence,
  unresolved_issues: []
};