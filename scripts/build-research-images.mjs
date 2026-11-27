/** Small, same-origin derivatives for Research cards. Never modify paper figures. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import sharp from 'sharp';
import { teaserBanner } from '../src/lib/quant-arena-teaser.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const content = path.join(root, 'src/content/blog');
const output = path.join(root, 'public/research/thumbnails');
const repository = 'https://raw.githubusercontent.com/Einsia/Einsia-lab/main/';
const widths = [240, 480, 960];
const quality = 78;
const manifest = {};
const generated = new Set();
let originalBytes = 0;
let cardBytes = 0;
await fs.mkdir(output, { recursive: true });

for (const name of (await fs.readdir(content)).sort()) {
  if (!/\.mdx?$/.test(name)) continue;
  const markdown = await fs.readFile(path.join(content, name), 'utf8');
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) continue;
  const entry = load(frontmatter[1]);
  const slug = name.replace(/\.mdx?$/, '');
  const banner = slug === 'quant-arena' ? teaserBanner : entry.banner;
  if (!banner || manifest[banner.src]) continue;

  // WorkflowArena's published raw URL has an authoritative local resource copy.
  const source = banner.src.startsWith('/') ? `public${banner.src}`
    : banner.src.startsWith(repository) ? banner.src.slice(repository.length) : null;
  if (!source) throw new Error(`Research image needs a local source: ${banner.src}`);
  const file = path.resolve(root, source);
  if (!file.startsWith(root)) throw new Error(`Research image is outside the project: ${source}`);
  const bytes = await fs.readFile(file);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Image dimensions unavailable: ${source}`);
  originalBytes += bytes.length;
  const hash = crypto.createHash('sha256').update(bytes)
    .update(JSON.stringify({ quality, widths, encoder: sharp.versions })).digest('hex').slice(0, 12);
  const variants = [];
  for (const width of new Set(widths.map(width => Math.min(width, metadata.width)))) {
    const name = `${slug}-${hash}-${width}.webp`;
    const destination = path.join(output, name);
    try { await fs.access(destination); }
    catch {
      await sharp(bytes).rotate().resize({ width, withoutEnlargement: true })
        .webp({ quality }).toFile(destination);
    }
    const { width: actualWidth, height } = await sharp(destination).metadata();
    const { size } = await fs.stat(destination);
    variants.push({ src: `/research/thumbnails/${name}`, width: actualWidth, height, bytes: size });
    generated.add(name);
  }
  manifest[banner.src] = variants;
  cardBytes += (variants.find(image => image.width >= 480) || variants.at(-1)).bytes;
}

await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
// Only remove obsolete files owned by this generator, after all new images exist.
for (const name of await fs.readdir(output)) {
  if (/^[\w-]+-[a-f0-9]{12}-\d+\.webp$/.test(name) && !generated.has(name)) await fs.unlink(path.join(output, name));
}
console.log(`Research thumbnails: ${Object.keys(manifest).length} images, ${generated.size} variants; originals ${(originalBytes / 1e6).toFixed(2)} MB → 480px cards ${(cardBytes / 1000).toFixed(1)} kB.`);
