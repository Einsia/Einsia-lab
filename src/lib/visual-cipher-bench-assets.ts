import manifest from '@/data/visual-cipher-bench/media.json';
import { projectPath } from '@/lib/project-paths';

export const paperUrl = 'https://arxiv.org/abs/2611.16861';

// Puzzle images ship with Pages: full-size originals for the lightbox, small
// thumbnails for the gallery. Both are listed with their hashes in media.json.
export type PuzzleImage = (typeof manifest.files)[number];
const byName = new Map(manifest.files.map(file => [file.path, file]));
export function puzzleImage(name: string): PuzzleImage {
  const file = byName.get(name);
  if (!file) throw new Error(`Unknown Visual Cipher Bench image: ${name}`);
  return file;
}
export const media = (name: string) => projectPath(manifest.baseUrl + puzzleImage(name).path);
export const thumb = (name: string) => projectPath(manifest.thumbBase + puzzleImage(name).path);
