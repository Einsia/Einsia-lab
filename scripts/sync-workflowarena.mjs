/** Publish the compact project without exceeding the shared Pages size budget. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(repo, 'resources/workflowarena');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const output = path.resolve(repo, option('--output', 'public/workflowarena'));
assert(output !== repo && output !== source && !source.startsWith(output + path.sep), 'Output must be a separate directory');
const assets = option('--asset-base', 'https://raw.githubusercontent.com/Einsia/Einsia-lab/main/resources/workflowarena/');
assert(assets.endsWith('/'), 'Asset base must end with a slash');
const check = args.includes('--check');
const external = name => !/\.(html|css|js|csv)$/.test(name)
  || name.startsWith('video/plans/') || name === 'video/data.js' || name === '3d/vendor/three.min.js';

function* files(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Unexpected symlink: ${entry.name}`);
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else yield file;
  }
}

const vendor = fs.readFileSync(path.join(source, '3d/vendor/three.min.js'));
const integrity = 'sha384-' + crypto.createHash('sha384').update(vendor).digest('base64');
const vendorURL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

function assetReference(value, relative) {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) return value;
  const boundary = value.search(/[?#]/);
  const pathname = boundary < 0 ? value : value.slice(0, boundary);
  const rest = boundary < 0 ? '' : value.slice(boundary);
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), pathname));
  if (target === 'video/data.js') return value; // Loaded by the ordered bootstrap below.
  return external(target) && fs.existsSync(path.join(source, target))
    && fs.statSync(path.join(source, target)).isFile() ? assets + target + rest : value;
}

const expected = new Set();
for (const file of files(source)) {
  const relative = path.relative(source, file).split(path.sep).join('/');
  if (external(relative)) continue;
  let content = fs.readFileSync(file, 'utf8');
  if (relative.endsWith('.html')) {
    content = content.replace(/\b(src|href|poster|data-gif|data-poster)=(['"])(.*?)\2/g,
      (_, attribute, quote, value) => `${attribute}=${quote}${assetReference(value, relative)}${quote}`);
    if (relative === '3d/cases/palace/index.html') {
      content = content.replace(/<script src="[^"]*three\.min\.js[^"]*"><\/script>/,
        `<script src="${vendorURL}" integrity="${integrity}" crossorigin="anonymous"></script>`);
    }
    if (relative === 'video/index.html') {
      const original = /<script src="data\.js"><\/script><script src="semantics\.js"><\/script><script src="\.\.\/case-embed\.js"><\/script><script src="app\.js[^\"]*"><\/script>/;
      assert(original.test(content), 'Video bootstrap changed; update the ordered loader');
      content = content.replace(original, `<script>
(async()=>{
 const response=await fetch(${JSON.stringify(assets + 'video/data.js')});
 if(!response.ok)throw new Error('Case data: '+response.status);
 (0,eval)(await response.text());
 for(const src of ['semantics.js','../case-embed.js','app.js?v=github-release-v1']){
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.append(s);});
 }
})().catch(error=>{console.error(error);document.querySelector('main').insertAdjacentHTML('afterbegin','<p role="alert">案例暂未加载，请刷新重试。</p>');});
</script>`);
    }
  }
  if (relative.endsWith('.css')) {
    content = content.replace(/url\((['"]?)([^)'"\s]+)\1\)/g,
      (_, quote, value) => `url(${quote}${assetReference(value, relative)}${quote})`);
  }
  if (relative === '3d/cases/palace/model-config.js') {
    content = content.replace(/"([^"]+\.js\.gz)"/g,
      (_, value) => JSON.stringify(assets + '3d/cases/palace/' + value));
  }
  if (relative === 'video/app.js') {
    content = 'const WORKFLOWARENA_ASSETS=' + JSON.stringify(assets) + ';\n' + content;
    assert(content.includes('`assets/${c.id}/'), 'Video image template changed');
    content = content.replace('`assets/${c.id}/', '`${WORKFLOWARENA_ASSETS}video/assets/${c.id}/');
    content = content.replace('${m.source}', "${new URL(m.source,WORKFLOWARENA_ASSETS+'video/').href}");
  }
  content = content.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trimEnd() + '\n';
  const target = path.join(output, relative);
  expected.add(target);
  if (check) assert(fs.existsSync(target) && fs.readFileSync(target, 'utf8') === content,
    `Stale published file: ${relative}. Run npm run sync:workflowarena.`);
  else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}
if (fs.existsSync(output)) for (const file of files(output)) {
  if (expected.has(file)) continue;
  if (check) throw new Error(`Unexpected published file: ${file}`);
  fs.unlinkSync(file);
}
const bytes = [...expected].reduce((total, file) => total + fs.statSync(file).size, 0);
assert(bytes < 800_000, `Project Pages footprint exceeds 800 KB: ${bytes}`);
console.log(`WorkflowArena: ${expected.size} Pages files, ${bytes.toLocaleString()} bytes; media and data stay in resources/.`);
if (!check && !args.includes('--asset-base')) {
  const manifestPath = path.join(repo, 'resources/workflowarena-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.files = [...files(source)].sort().map(file => {
    const data = fs.readFileSync(file);
    return { path: path.relative(source, file).split(path.sep).join('/'), bytes: data.length,
      sha256: crypto.createHash('sha256').update(data).digest('hex') };
  });
  manifest.file_bytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
  assert(manifest.file_bytes + bytes < manifest.budget_bytes, 'Project exceeds the 21 MB budget');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
