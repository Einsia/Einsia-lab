/** Audit the committed static collection, without the experiment checkout. */
import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'public/embodied-rsi/replays');
const json = async p => JSON.parse(await readFile(p, 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// The official Python aggregation uses ties-to-even (34.125 -> 34.12),
// whereas JavaScript toFixed rounds that particular halfway value upward.
const officialRound = value => {
  const scaled = value * 100, lower = Math.floor(scaled);
  const rounded = Math.abs(scaled - lower - .5) < 1e-8 ? lower + (lower % 2) : Math.round(scaled);
  return (rounded / 100).toFixed(2);
};
const catalog = await json(path.join(directory, 'catalog.json'));
const evaluation = await json(path.join(directory, 'evaluation.json'));
const results = await json(path.join(root, 'public/embodied-rsi/data/results.json'));
const snapshot = results.leaderboardSnapshot;
assert.equal(snapshot.updated, '2026-10-09');
assert.equal(snapshot.rows.length, 7);
assert.equal(new Set(snapshot.rows.map(row => row.name)).size, 7);
for (const row of snapshot.rows) {
  assert.deepEqual(row.categories.map(category => category.name), results.fullEvaluation.categories.map(category => category.name));
  for (const metric of ['score', 'success']) {
    assert(row.categories.every(category => Number.isFinite(category[metric]) && category[metric] >= 0 && category[metric] <= 100));
    const average = row.categories.reduce((sum, category) => sum + category[metric], 0) / row.categories.length;
    assert(Math.abs(average - row[metric]) <= .011, `Snapshot category aggregation: ${row.name} ${metric}`);
  }
}
const ours = snapshot.rows.find(row => row.name === 'EmbodiedEvo (Ours)');
assert.equal(ours.score, results.fullEvaluation.score);
assert.equal(ours.success, results.fullEvaluation.success);
assert.deepEqual(ours.categories, results.fullEvaluation.categories.map(({ name, score, success }) => ({ name, score, success })));
assert.equal(catalog.version, 2);
assert.equal(catalog.tasks.length, 54);
assert.equal(new Set(catalog.tasks.map(task => task.id)).size, 54);
assert.equal(new Set(catalog.tasks.map(task => task.baseTask)).size, 42);
assert.equal(catalog.examplesPerTask, 3);
assert.equal(catalog.episodes.length, 162);
assert.equal(catalog.exampleCount, 162);
assert.equal(new Set(catalog.episodes.map(e => e.id)).size, 162);
assert.deepEqual((await readdir(path.join(directory, 'episodes'))).sort(), catalog.episodes.map(e => e.id).sort(), 'Only displayed episodes belong in the deployed collection');
assert.equal(evaluation.episodes.length, 2100);
assert.equal(new Set(evaluation.episodes.map(e => `${e.variant}/${e.layout}`)).size, 2100);
let videoBytes = 0, count = 0, executions = 0, events = 0;
const categories = new Map();
for (const task of catalog.tasks) {
  assert.equal(task.examples.length, 3);
  const all = evaluation.episodes.filter(e => e.variant === task.id);
  assert.equal(all.length, task.category === 'Generalization' ? 25 : 50);
  assert.equal(task.evaluatedScenes, all.length);
  assert(all.every(e => e.task === task.baseTask));
  const mean = key => all.reduce((total, e) => total + Number(e[key]), 0) / all.length;
  assert(Math.abs(task.score - mean('score')) < 1e-9);
  assert(Math.abs(task.successRate - 100 * mean('success')) < 1e-9);
  const selected = task.examples.map(id => catalog.episodes.find(e => e.id === id));
  assert(selected.every(e => e?.task === task.id && e.variant === task.id && e.baseTask === task.baseTask));
  assert(selected.every(e => e.variantLabel === task.variantLabel));
  const expected = all.slice(0, 3).map(e => `${e.variant}--${String(e.layout).padStart(5, '0')}`);
  assert.deepEqual(task.examples, expected, 'Selection must follow official record order, independent of outcome');
}
// The gallery displays 54 variants; paper aggregation still weights 42 base
// tasks, averaging the Standard and Random variants within Generalization.
for (const baseTask of new Set(catalog.tasks.map(task => task.baseTask))) {
  const variants = catalog.tasks.filter(task => task.baseTask === baseTask);
  const category = variants[0].category;
  assert.equal(variants.length, category === 'Generalization' ? 2 : 1);
  assert(variants.every(task => task.category === category));
  assert.equal(variants.reduce((sum, task) => sum + task.evaluatedScenes, 0), 50);
  const average = key => variants.reduce((sum, task) => sum + task[key], 0) / variants.length;
  if (!categories.has(category)) categories.set(category, []);
  categories.get(category).push({ score: average('score'), successRate: average('successRate') });
}
for (const category of results.fullEvaluation.categories) {
  const tasks = categories.get(category.name);
  assert.equal(tasks.length, category.tasks);
  for (const [key, published] of [['score', category.score], ['successRate', category.success]]) {
    const average = tasks.reduce((sum, t) => sum + t[key], 0) / tasks.length;
    assert.equal(officialRound(average), published.toFixed(2), `${category.name}: ${key}`);
  }
}
for (const [key, expected] of [['score', 44.48], ['successRate', 37.82]]) {
  const average = [...categories.values()].reduce((sum, tasks) => sum + tasks.reduce((s, t) => s + t[key], 0) / tasks.length, 0) / categories.size;
  assert.equal(officialRound(average), expected.toFixed(2));
}
for (const entry of catalog.episodes) {
  assert(/^[a-zA-Z0-9_-]+$/.test(entry.id));
  const folder = path.join(directory, 'episodes', entry.id);
  const trace = await json(path.join(folder, 'trace.json'));
  const reportBytes = await readFile(path.join(folder, 'report.json'));
  const report = JSON.parse(reportBytes);
  assert.equal(digest(reportBytes), trace.provenance.reportSha256);
  assert.equal(trace.provenance.reportSha256, evaluation.episodes.find(e => e.variant === entry.variant && e.layout === entry.layout).reportSha256);
  assert.equal(report.score, entry.score);
  assert.equal(report.details['0'].layout_id, entry.layout);
  assert.equal(report.details['0'].success, entry.success);
  assert.equal(trace.id, entry.id);
  assert.equal(trace.task, entry.task);
  assert.equal(trace.baseTask, entry.baseTask);
  assert.equal(trace.segments.length, entry.executions);
  assert.equal(new Set(trace.segments.map(s => s.execution)).size, trace.segments.length);
  assert.equal(trace.segments.reduce((sum, s) => sum + s.nativeSteps, 0), entry.nativeSteps);
  for (const [key, text] of Object.entries(trace.contents)) assert.equal(digest(text), key, 'Recorded code content must retain its checksum');
  for (const segment of trace.segments) {
    assert(trace.contents[segment.code] !== undefined);
    for (const file of segment.files) assert(trace.contents[file.content] !== undefined);
  }
  for (const kind of ['skills', 'lessons']) {
    for (const file of trace.knowledge[kind]) {
      assert(file.name.startsWith(`${kind}/`));
      assert(trace.contents[file.content] !== undefined);
    }
  }
  assert(trace.agentLog.every(event => ['message', 'tool', 'output'].includes(event.kind)));
  assert(!/sk-[a-zA-Z0-9_-]{24,}/.test(JSON.stringify(trace)), 'Unexpected credential-shaped text');
  for (const [camera, movie] of Object.entries(trace.videos)) {
    assert.equal(movie.file, `${camera}.mp4`);
    const bytes = await readFile(path.join(folder, movie.file));
    const provenance = trace.provenance.videos.find(v => v.camera === camera);
    assert.equal(digest(bytes), provenance.webSha256);
    assert.equal(bytes.length, provenance.webBytes);
    assert.equal(movie.frames, provenance.frames);
    assert.equal(provenance.width, 480);
    assert.equal(provenance.height, 360);
    assert.equal(provenance.originalWidth, 640);
    assert.equal(provenance.originalHeight, 480);
    assert(trace.provenance.encoding.includes('CRF 34, 480x360'));
    videoBytes += bytes.length; count++;
  }
  assert.equal(Object.keys(trace.videos).length, 3);
  assert((await lstat(path.join(folder, 'poster.webp'))).size > 0);
  executions += trace.segments.length; events += trace.agentLog.length;
}
assert.equal(count, 486);
let totalBytes = 0;
async function auditFiles(folder) {
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, item.name);
    assert(!item.isSymbolicLink(), `No runtime symlinks: ${file}`);
    if (item.isDirectory()) await auditFiles(file);
    else { const bytes = (await lstat(file)).size; assert(bytes < 100_000_000, `GitHub file limit: ${file}`); totalBytes += bytes; }
  }
}
await auditFiles(path.join(root, 'public/embodied-rsi'));
assert(totalBytes < 950_000_000, 'Leave room for HTML, fonts and scripts within the 1 GB Pages limit');
console.log(JSON.stringify({ galleryTasks: 54, baseTasks: 42, examplesPerTask: 3, examples: 162, videos: count, executions, publicAgentEvents: events, videoMB: +(videoBytes / 1e6).toFixed(1), projectAssetMB: +(totalBytes / 1e6).toFixed(1), fullEvaluation: '44.48 Score / 37.82% SR', audit: 'passed' }, null, 2));
