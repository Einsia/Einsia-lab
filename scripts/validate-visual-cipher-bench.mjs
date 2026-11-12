/** Verify the external media bundle and every task image before deployment. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const manifest = JSON.parse(read('src/data/visual-cipher-bench/media.json'));
const tasks = JSON.parse(read('src/data/visual-cipher-bench/tasks.json'));
const assets = path.join(repo, 'resources/visual-cipher-bench/media');
const publicDir = path.join(repo, 'public/visual-cipher-bench');
const dist = path.join(repo, 'dist');
const base = 'https://raw.githubusercontent.com/Einsia/Einsia-lab/main/resources/visual-cipher-bench/media/';
assert.equal(manifest.baseUrl, base);
const expected = new Set([...tasks.flatMap(task => task.images), 'framework.webp']);
assert.equal(tasks.length, 40);
assert.equal(expected.size, 68, 'Expected 67 puzzle images plus the framework');
assert.deepEqual(new Set(manifest.files.map(file => file.path)), expected);
assert.equal(manifest.files.length, expected.size, 'Duplicate manifest entries');
assert.deepEqual(new Set(fs.readdirSync(assets)), expected);
let mediaBytes = 0;
for (const item of manifest.files) {
  assert(/^[a-z0-9-]+\.webp$/.test(item.path), `Invalid image name: ${item.path}`);
  const data = fs.readFileSync(path.join(assets, item.path));
  assert.equal(data.length, item.bytes, item.path);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), item.sha256, item.path);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF', item.path);
  assert.equal(data.toString('ascii', 8, 12), 'WEBP', item.path);
  assert(!fs.existsSync(path.join(publicDir, item.path)), `Media duplicated into public/: ${item.path}`);
  assert(!fs.existsSync(path.join(dist, 'visual-cipher-bench', item.path)), `Media leaked into dist/: ${item.path}`);
  mediaBytes += data.length;
}
assert(!fs.existsSync(path.join(publicDir, 'paper.pdf')), 'Do not publish the manuscript file');
assert(!fs.existsSync(path.join(dist, 'visual-cipher-bench/paper.pdf')), 'Manuscript leaked into dist/');
const html = read('dist/visual-cipher-bench/index.html');
const payload = html.match(/<script\b[^>]*id="vcb-explorer-data"[^>]*>(.*?)<\/script>/s);
assert(payload, 'Task explorer data missing');
const data = JSON.parse(payload[1]);
assert.equal(data.assetBase, base);
assert.deepEqual(data.tasks, tasks);
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const url = match[1];
  if (url.startsWith(base)) assert(expected.has(url.slice(base.length)), `Missing media: ${url}`);
  assert(!url.endsWith('/visual-cipher-bench/paper.pdf'), 'Local manuscript link remains');
  const marker = '/visual-cipher-bench/';
  if (url.startsWith('/') && url.includes(marker) && !url.endsWith(marker)) {
    const relative = url.slice(url.indexOf(marker) + marker.length).split(/[?#]/)[0];
    if (relative) assert(fs.existsSync(path.join(dist, 'visual-cipher-bench', relative)), `Missing local asset: ${url}`);
  }
}
for (const page of ['dist/index.html', 'dist/research/index.html']) {
  const content = read(page);
  assert(!content.includes('/visual-cipher-bench/paper.pdf'), `${page}: manuscript link remains`);
  assert(!content.includes('src="/visual-cipher-bench/framework.webp"'), `${page}: old framework URL remains`);
}
assert(html.includes(base + 'framework.webp'));
assert(html.includes('aria-label="Paper — coming soon"'), 'Keep the paper slot pending until an official link exists');
console.log(`PASS Visual Cipher Bench: 40 tasks, 67 puzzle images + framework, ${(mediaBytes / 1e6).toFixed(3)} MB outside Pages; manuscript link pending.`);
