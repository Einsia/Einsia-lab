/** Check the complete lab site before publishing it to GitHub Pages. */
import { open, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
let bytes = 0;
let metadataBytes = 0;
async function measure(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw new Error(`Deployment must not contain symlinks: ${file}`);
    if (item.isDirectory()) await measure(file);
    else {
      // macOS writes AppleDouble resource-fork sidecars on external drives.
      // They are filesystem metadata, not web assets. Verify the signature
      // before removing them from the generated deployment directory only.
      if (item.name.startsWith('._')) {
        const handle = await open(file, 'r');
        const magic = Buffer.alloc(4);
        let count;
        try { count = (await handle.read(magic, 0, 4, 0)).bytesRead; }
        finally { await handle.close(); }
        if (count === 4 && magic.readUInt32BE(0) === 0x00051607) {
          metadataBytes += (await stat(file)).size;
          await unlink(file);
          continue;
        }
      }
      bytes += (await stat(file)).size;
    }
  }
}
await writeFile(path.join(root, '.nojekyll'), '');
await measure(root);
// Match the deployment budget in validate:phys-last-exam: reserve 5 MB below 1 GB.
const budget = 995_000_000;
if (bytes >= budget) throw new Error(`Site exceeds the shared ${budget}-byte Pages budget: ${bytes} bytes`);
console.log(`Complete lab site: ${(bytes / 1e6).toFixed(1)} MB, including all EmbodiedEvo trajectories.`);
if (metadataBytes) console.log(`Excluded ${(metadataBytes / 1e6).toFixed(1)} MB of macOS filesystem metadata from deployment.`);
