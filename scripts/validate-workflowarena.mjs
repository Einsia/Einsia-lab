/** Check release integrity, animation timing, model dependencies and Pages output. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.indexOf('--root');
const root = path.resolve(repo, arg < 0 ? 'public' : process.argv[arg + 1]);
const project = path.join(root, 'workflowarena');
const resources = path.join(repo, 'resources/workflowarena');
const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'resources/workflowarena-manifest.json')));
const assetBase = 'https://raw.githubusercontent.com/Einsia/Einsia-lab/main/resources/workflowarena/';
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function* files(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Unexpected symlink: ${entry.name}`);
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(file); else yield file;
  }
}

execFileSync(process.execPath, [path.join(repo, 'scripts/sync-workflowarena.mjs'), '--check'], { stdio: 'inherit' });
assert.equal([...files(resources)].length, manifest.files.length);
let resourceBytes = 0;
for (const item of manifest.files) {
  const data = fs.readFileSync(path.join(resources, item.path));
  assert.equal(data.length, item.bytes, `Resource size mismatch: ${item.path}`);
  assert.equal(digest(data), item.sha256, `Resource hash mismatch: ${item.path}`);
  resourceBytes += data.length;
}
assert.equal(resourceBytes, manifest.file_bytes);
for (const packed of Object.values(manifest.compressed_scripts)) {
  new vm.Script(gunzipSync(fs.readFileSync(path.join(resources, packed))).toString(), { filename: packed });
}

const animations = manifest.files.filter(file => /workflows\/[^/]+(?<!\.poster)\.webp$/.test(file.path));
assert.equal(animations.length, 6);
for (const item of animations) {
  const data = fs.readFileSync(path.join(resources, item.path));
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  let frames = 0, duration = 0, width, height;
  for (let offset = 12; offset + 8 <= data.length;) {
    const kind = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4), body = offset + 8;
    if (kind === 'VP8X') { width = data.readUIntLE(body + 4, 3) + 1; height = data.readUIntLE(body + 7, 3) + 1; }
    if (kind === 'ANMF') { frames++; duration += data.readUIntLE(body + 12, 3); }
    offset += 8 + size + (size % 2);
  }
  assert.deepEqual([width, height, frames, duration], [768, 435, 120, 20_000], item.path);
}

const resolveReference = (value, relative) => {
  if (value.startsWith(assetBase)) {
    const url = new URL(value);
    const suffix = decodeURIComponent(url.pathname.slice(new URL(assetBase).pathname.length));
    return path.join(resources, suffix);
  }
  if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) return null;
  const url = new URL(value, 'https://lab.einsia.ai/workflowarena/' + relative);
  return path.join(root, decodeURIComponent(url.pathname));
};
let pagesBytes = 0;
for (const file of files(project)) {
  const data = fs.readFileSync(file);
  pagesBytes += data.length;
  if (!file.endsWith('.html')) continue;
  const relative = path.relative(project, file).split(path.sep).join('/');
  for (const match of data.toString().matchAll(/\b(?:src|href|poster|data-gif|data-poster)=(['"])(.*?)\1/g)) {
    const target = resolveReference(match[2], relative);
    if (target) assert(fs.existsSync(target), `${relative}: missing ${match[2]}`);
  }
}
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(project, '3d/cases/palace/model-config.js'), 'utf8'), sandbox);
const models = sandbox.window.PALACE_MODELS;
assert.deepEqual(Object.keys(models).sort(), ['astra', 'cc', 'glm', 'kimi']);
assert.equal(models.cc.name, 'Claude Opus 5.5');
for (const model of Object.values(models)) for (const script of model.scripts) {
  const target = resolveReference(script, '3d/cases/palace/index.html');
  assert(target && fs.existsSync(target), `${model.name}: missing ${script}`);
}
assert(pagesBytes < 800_000, `Pages footprint exceeds 800 KB: ${pagesBytes}`);
assert(resourceBytes + pagesBytes < 21_000_000, 'Combined project resources exceed 21 MB');
if (path.basename(root) === 'dist') {
  const research = fs.readFileSync(path.join(root, 'research/index.html'), 'utf8');
  assert(research.includes('WorkflowArena') && /href="[^\"]*\/workflowarena\/"/.test(research), 'Research entry is missing');
}
console.log(`PASS WorkflowArena: 4 models, 6 × 20s animations; Pages ${(pagesBytes / 1e6).toFixed(3)} MB, resources ${(resourceBytes / 1e6).toFixed(2)} MB.`);
