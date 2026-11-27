/** Import the reviewed design artifact once; build/check shared production tokens. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFile = path.join(root, 'docs/design/approved-v0.4.html');
const tokenFile = path.join(root, 'src/design/tokens.json');
const output = path.join(root, 'public/design');
const args = process.argv.slice(2);
const write = (name, data) => { fs.mkdirSync(path.dirname(name), { recursive: true }); fs.writeFileSync(name, data); };
if (args.includes('--import')) {
  const input = args[args.indexOf('--import') + 1];
  if (!input) throw new Error('--import requires the reviewed HTML path');
  const source = fs.readFileSync(input, 'utf8');
  write(sourceFile, source);
  const json = source.match(/<script\b[^>]*id="ds-tokens-json"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error('Missing reviewed token JSON');
  const tokens = JSON.parse(json);
  tokens.status = 'approved-for-lab-implementation';
  tokens.description = 'Einsia UI v0.4, adopted for Navers Lab by user instruction. Original artifact retained unchanged in docs/design/approved-v0.4.html.';
  tokens.sourceSHA256 = crypto.createHash('sha256').update(source).digest('hex');
  // The approved values are authoritative. Legacy global aliases are mapped to
  // these values in global.css, never allowed to override them in the other direction.
  for (const token of Object.values(tokens.tokens)) delete token.alias;
  write(tokenFile, JSON.stringify(tokens, null, 2) + '\n');
}
const source = fs.readFileSync(sourceFile, 'utf8');
const config = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
const fonts = [...source.matchAll(/@font-face\{font-family:"([^"]+)";[^}]*src:url\(data:font\/woff2;base64,([^)]*)\)[^}]*\}/g)];
if (fonts.length !== 2) throw new Error('Expected the two reviewed heading fonts');
const files = new Map();
let css = '/* Generated from src/design/tokens.json and the reviewed v0.4 fonts. */\n';
for (const [, family, encoded] of fonts) {
  const filename = family.toLowerCase().replaceAll(' ', '-') + '.woff2';
  files.set(path.join(output, 'fonts', filename), Buffer.from(encoded, 'base64'));
  css += `@font-face { font-family: "${family}"; font-style: normal; font-weight: 100 900; font-display: swap; src: url("./fonts/${filename}") format("woff2"); }\n`;
}
css += ':root {\n  color-scheme: light;\n';
for (const [name, token] of Object.entries(config.tokens)) css += `  --lab-${name}: ${token.value};\n`;
css += '}\n';
files.set(path.join(output, 'tokens.css'), Buffer.from(css));
for (const [file, data] of files) {
  if (args.includes('--check')) {
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(data)) throw new Error(`Outdated design asset: ${path.relative(root, file)}`);
  } else write(file, data);
}
console.log(`Einsia UI ${config.version}: ${Object.keys(config.tokens).length} tokens, ${fonts.length} local heading fonts (${args.includes('--check') ? 'verified' : 'generated'}).`);
