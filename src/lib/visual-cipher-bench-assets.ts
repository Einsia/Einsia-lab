import manifest from '@/data/visual-cipher-bench/media.json';

// Use an official arXiv, conference or journal URL once it is available.
export const paperUrl: string = '';

// Follow WorkflowArena: media lives in Git, outside the Pages deployment artifact.
export const mediaBase = manifest.baseUrl;
const names = new Set(manifest.files.map(file => file.path));
export function media(name: string) {
  if (!names.has(name)) throw new Error(`Unknown Visual Cipher Bench image: ${name}`);
  return mediaBase + name;
}
