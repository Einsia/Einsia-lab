import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const arg=process.argv.indexOf('--root');
const root=path.resolve(repo,arg<0?'public':process.argv[arg+1]);
const budget=950_000_000; // leave headroom below GitHub Pages' 1 GB site limit
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function* files(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    assert(!e.isSymbolicLink(),`Deployable resources must be real files: ${p}`);
    if(e.isDirectory())yield* files(p);else if(e.isFile())yield p;
  }
}
const physical=path.join(root,'physscope');
const gallery=JSON.parse(fs.readFileSync(path.join(physical,'video-gallery.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(physical,'release-assets.json'),'utf8'));
assert.equal(gallery.delivery?.version,1,'Run prepare-web-release.py before committing evaluation assets');
assert.equal(gallery.source,'all_test');
const expected=new Map(manifest.assets.map(a=>[a.url,a]));
assert.equal(expected.size,manifest.assets.length,'Duplicate asset URLs');
const resolve=url=>{
  assert(typeof url==='string' && url.startsWith('/physscope/') && !url.includes('..') && !url.includes('\\'),`Non-portable resource: ${url}`);
  assert(expected.has(url),`Resource missing from integrity manifest: ${url}`);
  return path.join(root,url.slice(1));
};
for(const [url,item] of expected){
  const p=resolve(url);assert(fs.existsSync(p),`Missing committed resource: ${url}`);
  assert.equal(fs.statSync(p).size,item.bytes,`Resource size mismatch: ${url}`);
  assert.equal(sha(p),item.sha256,`Resource hash mismatch (or unresolved LFS pointer): ${url}`);
}
let bytes=0;let count=0;
for(const p of files(root)){
  const n=fs.statSync(p).size;bytes+=n;count++;
  assert(n<95_000_000,`File exceeds the repository's 95 MB guard: ${p}`);
  if(p.startsWith(physical+path.sep)){
    const rel=path.relative(physical,p);
    assert(!/^(all_test(?:_[12])?|videos-old)\//.test(rel),`Evaluation working directory in release: ${rel}`);
    assert(!/\.(npz|npy|pt|pth|safetensors|pyc)$/.test(rel),`Model/cache file in release: ${rel}`);
    const builtPage=path.basename(root)==='dist' && rel==='index.html';
    if(rel!=='release-assets.json' && !builtPage)assert(expected.has('/physscope/'+rel.split(path.sep).join('/')),`Unmanifested release asset: ${rel}`);
  }
}
assert(bytes<budget,`Site is ${bytes} bytes; exceeds ${budget}-byte Pages budget`);
const triples=new Set();let annotated=0;let initialized=0;
const modelSet=new Set(),taskSet=new Set();
for(const e of gallery.entries){
  const key=[e.model,e.task,e.seed].join('/');assert(!triples.has(key),`Duplicate sample: ${key}`);triples.add(key);
  modelSet.add(e.model);taskSet.add(e.task);
  for(const k of ['original','annotated','poster','measurement','frames','features','visualizationMeasurement','figure','log'])if(e[k])resolve(e[k]);
  assert(e.original && e.poster,`Missing original/poster: ${key}`);
  assert(e.delivery.originalIsWebCopy);assert.equal(e.delivery.originalSourceSha256,e.sourceSha256);
  assert.equal(expected.get(e.original).sha256,e.delivery.originalSha256);
  if(e.annotated)annotated++;
  if(e.initializationRun){
    initialized++;const r=e.initializationRun;
    const init=JSON.parse(fs.readFileSync(resolve(r.annotation),'utf8'));
    assert.equal(sha(resolve(r.frameZero)),init.source_image_sha256);
    assert.equal(init.source_video_sha256,e.sourceSha256);
    assert.equal(sha(resolve(r.annotation)),r.signature.annotation);
    assert(e.annotated && r.measurementRecomputed && !r.historicalLeaderboardChanged);
  }
}
assert.equal(gallery.coverage.originals,triples.size);
assert.equal(gallery.coverage.annotated,annotated);
assert.equal(gallery.coverage.models,modelSet.size);assert.equal(gallery.coverage.tasks,taskSet.size);
assert.equal(gallery.coverage.initializedSamples,initialized);
if(path.basename(root)==='dist')assert(fs.existsSync(path.join(root,'physscope/index.html')));
console.log(`PASS ${path.relative(repo,root)}: ${triples.size} originals, ${annotated} overlays, ${initialized} initializations; ${manifest.assets.length} verified assets; site ${(bytes/1e6).toFixed(1)} MB / 950 MB (${count} files).`);
