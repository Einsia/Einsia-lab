/** Keep standalone document entry points connected to the shared design assets.
 * WorkflowArena is edited in resources/; its existing publisher produces public/.
 * Run with --check in CI to catch a newly added page that missed the foundation. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = ['resources/workflowarena', 'public/robo-universe', 'public/robouniverse'].flatMap(dir => walk(path.join(root, dir))).filter(file => file.endsWith('.html'));
for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  let html = original;
  const published = file.replace(path.join(root, 'resources/workflowarena'), path.join(root, 'public/workflowarena'));
  const prefix = path.relative(path.dirname(published), path.join(root, 'public/design')).split(path.sep).join('/');
  const assets = `<!-- Einsia UI v0.4 -->\n<link rel="stylesheet" href="${prefix}/tokens.css">\n<link rel="stylesheet" href="${prefix}/site.css">\n<script defer src="${prefix}/site.js"></script>\n`;
  html = html.replace(/<!-- Einsia UI v0\.4 -->[\s\S]*?<script defer src="[^"]*\/site\.js"><\/script>\s*/, '');
  if (!/name=['"]viewport['"]/.test(html)) html = html.replace(/<head>/i, '<head>\n<meta name="viewport" content="width=device-width,initial-scale=1">');
  html = html.replace(/<\/head>/i, assets + '</head>');
  html = html.replaceAll('Navers lab', 'Navers Lab');
  html = html.replace('<nav aria-label="Company navigation">', '<button type="button" class="lab-nav-toggle" aria-controls="lab-navigation" aria-expanded="false">Menu</button><nav id="lab-navigation" class="lab-static-nav" aria-label="Company navigation">');
  html = html.replace(/<i(?: aria-hidden="true")?><\/i>Navers Lab/g, '<svg class="lab-brand-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C18.6274 0 24 5.37258 24 12C24 14.8675 22.9924 17.4984 21.3145 19.5625L14.8779 12.9307L20.9814 10.8125L19.8154 7.45312L15.0889 9.09277L16.8701 4.41797L13.5469 3.15234L11.2471 9.18945L6.7334 4.54004L4.31152 6.89062L8.62695 11.3369L3.1582 13.2363L4.32422 16.5957L9.05078 14.9531L7.27051 19.6299L10.5928 20.8965L12.6533 15.4844L18.8389 21.8574C16.8983 23.2063 14.5424 24 12 24C5.37269 23.9999 0 18.6273 0 12C0 5.37266 5.37269 0.000131941 12 0Z"/></svg>Navers Lab');
  // The approved project opening presents the complete mosaic as evidence after
  // its title/resources, without canvas cropping, a video background or autoplay.
  if (file.endsWith('/robo-universe/index.html') && html.includes('class="rg-backdrop"')) {
    html = html.replace(/<script defer src="[^\"]*gallery\/gallery\.js[^\"]*"><\/script>/, '');
    html = html.replace(/<div class="rg-backdrop"[\s\S]*?(?=<div class="rg-hero-inner)/, '');
    html = html.replace(/<button hidden class="rg-motion"[\s\S]*?<\/button><\/section>/,
       '</section><figure class="rg-evidence"><video controls muted playsinline preload="metadata" poster="/robouniverse/gallery/mosaic15.webp" src="/robouniverse/gallery/mosaic15.mp4" aria-label="RoboUniverse manipulation environment examples"></video><figcaption>Reference replays from RoboUniverse environments. Select Play to view the examples.</figcaption></figure>');
  }
  html = html.replace('<figure class="rg-evidence"><video controls muted playsinline preload="none"', '<figure class="rg-evidence"><video controls muted playsinline preload="metadata"');
  if (check) {
    if (html !== original) throw new Error(`Missing or outdated design integration: ${path.relative(root, file)}`);
  } else fs.writeFileSync(file, html);
}
console.log(`Shared design assets ${check ? 'verified in' : 'connected to'} ${files.length} standalone documents.`);
