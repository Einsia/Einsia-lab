/** Verify every public video against source provenance and decoded image metadata. */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(root, 'public/frontier3d');
const manifest = JSON.parse(await readFile(path.join(publicRoot, 'media-manifest.json'), 'utf8'));
const groups = { L1: ['typewriter', 'microscope', 'sneaker'], L2: ['museum', 'antique', 'classroom'], L3: ['frontier', 'minecraft', 'workshop'] };
const models = ['astra', 'sol', 'opus'];
const expected = Object.values(groups).flat().flatMap(c => models.map(m => `${c}-${m}`)).sort();
assert.deepEqual(manifest.clips.map(c => c.id).sort(), expected);
assert.equal(manifest.benchmark.tasks, 145);
assert.deepEqual(manifest.benchmark.levels, { L1: 65, L2: 65, L3: 15 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let total = 0;
for (const c of manifest.clips) {
  assert.ok(groups[c.level].includes(c.case));
  assert.ok(c.model && c.task && c.harness);
  assert.equal(c.effort, 'max');
  assert.ok(c.source_artifact_sha256 || c.submission_manifest_sha256);
  assert.equal(c.visual_review.approved, true);
  for (const [field, suffix] of [['video', 'mp4'], ['poster', 'jpg']]) {
    assert.equal(c[field].file, `media/${c.id}.${suffix}`);
    const bytes = await readFile(path.join(publicRoot, c[field].file));
    assert.equal(hash(bytes), c[field].sha256, `${c.id} ${field} hash`);
    assert.equal(bytes.length, c[field].bytes);
    total += bytes.length;
    if (field === 'video') {
      assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
      assert.ok(bytes.includes(Buffer.from('avc1')), `${c.id}: browser-compatible H.264`);
      assert.equal(c.video.codec, 'h264');
      assert.equal(c.video.fps, 24);
      assert.equal(c.video.width, c.level === 'L3' ? 640 : 512);
      assert.equal(c.video.height, c.level === 'L3' ? 400 : 320);
      assert.equal(c.video.frames, Math.round(c.video.duration_seconds * 24));
      assert.ok(c.video.source_frames >= 64);
      assert.match(c.video.frame_processing, c.level === 'L3' ? /native rendered frames/ : /motion-compensated interpolation from original PNG/);
    }
  }

  if (c.level === 'L1') {
    assert.equal(c.camera.orbit_degrees, 360);
    assert.deepEqual(c.camera.target, c.camera.center);
    assert.equal(c.camera.projection, 'orthographic');
  }
  if (c.level === 'L3') {
    assert.equal(c.source_matches_frozen_manifest, true);
    assert.ok(c.route.min_camera_step_cm > 0);
    assert.equal(c.route.camera_never_holds, true);
    assert.deepEqual(c.route.cut_frames, []);
    assert.ok(c.route.max_camera_step_cm < 160);
    assert.equal(c.route.collision_rays, 239 * 7);
    assert.equal(c.route.blocked_rays, 0);
    assert.equal(c.route.clearance_radius_cm, 15);
    assert.deepEqual(c.route.stage_frames, [0, 115, 168, 240]);
    assert.equal(c.video.duration_seconds, 10);
    assert.equal(c.video.source_fps, 24);
    assert.equal(c.route.return_leg, false);
    assert.ok(c.interaction_evidence.entity);
    assert.ok(c.interaction_evidence.changed_visible_components > 0, `${c.id}: visible interaction required`);
  }
}
assert.equal(manifest.banner.selection, 'highest final v5 total per task');
assert.equal(manifest.banner.submissions.length, 15);
assert.equal(new Set(manifest.banner.submissions.map(s => s.task)).size, 15);
for (const s of manifest.banner.submissions) {
  assert.match(s.report_sha256, /^[a-f0-9]{64}$/);
  assert.match(s.submission_manifest_sha256, /^[a-f0-9]{64}$/);
  assert.equal(s.candidate_unchanged, true);
  assert.equal(s.visual_review.approved, true);
}
for (const kind of ['video', 'poster']) {
  const m = manifest.banner[kind];
  const bytes = await readFile(path.join(publicRoot, m.file));
  assert.equal(hash(bytes), m.sha256);
  assert.equal(bytes.length, m.bytes);
  total += bytes.length;
}
assert.equal(manifest.banner.video.fps, 24);
assert.equal(manifest.banner.video.frames, 96);
assert.equal(manifest.banner.video.width, 1920);
assert.equal(manifest.banner.video.height, 768);
const media = (await readdir(path.join(publicRoot, 'media'))).filter(n => !n.startsWith('._'));
assert.deepEqual(media.sort(), [...expected.flatMap(id => [`${id}.mp4`, `${id}.jpg`]), 'banner-mosaic.mp4', 'banner-mosaic.jpg'].sort());
const page = await readFile(path.join(root, 'src/pages/frontier3d/index.astro'), 'utf8');
assert.doesNotMatch(page, /f3-case-options|data-case=|id="interactions"|f3-footnote/);
assert.match(page, /data-level-panel/);
assert.match(page, /f3-case-row/);
assert.match(page, /<video/);
assert.ok(page.indexOf('id="showcase"') < page.indexOf('f3-benchmark'));
const config = await readFile(path.join(root, 'src/data/frontier3d.ts'), 'utf8');
assert.equal((config.match(/href: null/g) || []).length, 3);
const paper = JSON.parse(await readFile(path.join(root, 'src/data/frontier3d-paper.json'), 'utf8'));
assert.equal(paper.tasks, 145);
assert.equal(paper.categories, 10);
assert.deepEqual(paper.levels, manifest.benchmark.levels);
assert.equal(paper.pdf_sha256, manifest.paper.pdf_sha256);
assert.equal(paper.leaderboard.length, 11);
const formal = paper.leaderboard.filter(row => !row.supplemental);
assert.equal(formal.length, 10);
for (const [i,row] of formal.entries()) {
  assert.equal(row.valid, 145);
  assert.equal(row.effort, 'max');
  // The paper rounds level and total scores independently to two decimals.
  assert.ok(Math.abs(row.total - (.3*row.l1 + .3*row.l2 + .4*row.l3)) < .011);
  assert.ok(row.ci[0] < row.total && row.ci[1] > row.total);
  if (i) assert.ok(formal[i-1].total >= row.total);
}
assert.equal(formal[0].model, 'GPT-6.1 Sol');
assert.equal(formal[0].total, 66.02);
const qwen = paper.leaderboard.find(row => row.supplemental);
assert.equal(qwen.valid, 142);
assert.equal(qwen.l2, null);
assert.equal(qwen.total, null);
assert.equal(qwen.ci, null);
for (const figure of manifest.paper.figures) {
  assert.equal(hash(await readFile(path.join(publicRoot, figure.file))), figure.sha256);
}
assert.match(page, /leaderboard.map/);
assert.doesNotMatch(page, /Coming soon|170 tasks|85 object tasks|70 scene tasks/);
assert.doesNotMatch(JSON.stringify(manifest), /\/opt\/dlami|\/mnt\/einsia|\/Users\//);
console.log(`Frontier3D: 9 cases, 27 looping 24 fps videos, 15-task banner + posters, ${(total/1e6).toFixed(2)} MB. Source hashes, animation, centering and physical interactions verified.`);
