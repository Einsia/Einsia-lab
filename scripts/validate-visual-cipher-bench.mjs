/** Verify Visual Cipher Bench's puzzle images and its built pages before deployment. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(repo, file), 'utf8');
const manifest = JSON.parse(read('src/data/visual-cipher-bench/media.json'));
const tasks = JSON.parse(read('src/data/visual-cipher-bench/tasks.json'));
const pub = path.join(repo, 'public/visual-cipher-bench');
const dist = path.join(repo, 'dist');

// Images ship with Pages: originals for the lightbox, thumbnails for the gallery.
assert.equal(manifest.baseUrl, '/visual-cipher-bench/media/');
assert.equal(manifest.thumbBase, '/visual-cipher-bench/thumbs/');
const expected = new Set(tasks.flatMap(task => task.images));
assert.equal(tasks.length, 40);
assert.equal(expected.size, 67, 'Expected 67 puzzle images');
assert.deepEqual(new Set(manifest.files.map(file => file.path)), expected);
assert.equal(manifest.files.length, expected.size, 'Duplicate manifest entries');
for (const dir of ['media', 'thumbs']) assert.deepEqual(new Set(fs.readdirSync(path.join(pub, dir))), expected, `public/visual-cipher-bench/${dir}`);

const check = (file, item) => {
  const data = fs.readFileSync(file);
  assert.equal(data.length, item.bytes, file);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), item.sha256, file);
  assert.equal(data.toString('ascii', 0, 4), 'RIFF', file);
  assert.equal(data.toString('ascii', 8, 12), 'WEBP', file);
  return data.length;
};
let fullBytes = 0;
let thumbBytes = 0;
for (const item of manifest.files) {
  assert(/^[a-z0-9-]+\.webp$/.test(item.path), `Invalid image name: ${item.path}`);
  fullBytes += check(path.join(pub, 'media', item.path), item);
  thumbBytes += check(path.join(pub, 'thumbs', item.path), item.thumb);
  assert(item.thumb.bytes < 40_000, `Thumbnail too large: ${item.path}`);
  assert(item.thumb.width <= 360 && item.thumb.height <= 400, `Thumbnail too big: ${item.path}`);
  for (const dir of ['media', 'thumbs']) assert(fs.existsSync(path.join(dist, 'visual-cipher-bench', dir, item.path)), `Missing from dist/: ${dir}/${item.path}`);
}
assert(!fs.existsSync(path.join(pub, 'paper.pdf')), 'Do not publish the manuscript file');
assert(!fs.existsSync(path.join(dist, 'visual-cipher-bench/paper.pdf')), 'Manuscript leaked into dist/');

const html = read('dist/visual-cipher-bench/index.html');
for (const name of expected) {
  assert(html.includes(`visual-cipher-bench/thumbs/${name}`), `Gallery thumbnail missing: ${name}`);
  assert(html.includes(`visual-cipher-bench/media/${name}`), `Full-size link missing: ${name}`);
}
for (const match of html.matchAll(/\b(?:src|href|data-full)="([^"]+)"/g)) {
  const url = match[1];
  assert(!url.endsWith('/visual-cipher-bench/paper.pdf'), 'Local manuscript link remains');
  const marker = '/visual-cipher-bench/';
  if (url.startsWith('/') && url.includes(marker) && !url.endsWith(marker)) {
    const relative = url.slice(url.indexOf(marker) + marker.length).split(/[?#]/)[0];
    if (relative) assert(fs.existsSync(path.join(dist, 'visual-cipher-bench', relative)), `Missing local asset: ${url}`);
  }
}
for (const page of ['dist/index.html', 'dist/research/index.html', 'dist/visual-cipher-bench/index.html']) {
  const content = read(page);
  assert(!content.includes('/visual-cipher-bench/paper.pdf'), `${page}: manuscript link remains`);
  assert(!/raw\.githubusercontent\.com\/[^"']*visual-cipher-bench/.test(content), `${page}: Raw-hosted Visual Cipher Bench media remains`);
}
assert(read('dist/research/index.html').includes('visual-cipher-bench/overview.webp'), 'Research card should use the README overview figure');
const paper = 'https://arxiv.org/abs/2611.16861';
assert(html.includes(`href="${paper}"`), 'Project page should link the arXiv paper');
assert(read('dist/research/index.html').includes(`href="${paper}"`), 'Research card should link the arXiv paper');
assert(html.includes('arXiv:2611.16861'), 'Citation should name the arXiv identifier');
console.log(`PASS Visual Cipher Bench: 40 tasks, 67 puzzle images on Pages (${(fullBytes / 1e6).toFixed(2)} MB originals, ${(thumbBytes / 1e6).toFixed(2)} MB thumbnails); paper linked to arXiv.`);
