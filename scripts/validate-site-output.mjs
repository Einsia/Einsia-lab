/** Check the complete lab site before publishing it to GitHub Pages. */
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
let bytes = 0;
async function measure(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error(`Deployment must not contain symlinks: ${file}`);
    if (item.isDirectory()) await measure(file);
    else bytes += (await stat(file)).size;
  }
}
await writeFile(path.join(root, '.nojekyll'), '');
await measure(root);
if (bytes >= 1_000_000_000) throw new Error(`Site exceeds the GitHub Pages 1 GB limit: ${bytes} bytes`);
console.log(`Complete lab site: ${(bytes / 1e6).toFixed(1)} MB, including all EmbodiedEvo trajectories.`);
