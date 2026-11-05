import paper from './frontier3d-paper.json';
export const benchmark = paper;
export type Level = 'L1' | 'L2' | 'L3';
export const levels = [
  { id: 'L1', name: 'Objects', count: paper.levels.L1, subtitle: 'Shape. Structure. Detail.', description: 'Generate and reconstruct individual 3D assets, from everyday objects to mechanical assemblies.', capabilities: ['Geometry', 'Structure', 'Appearance'], engine: 'Blender' },
  { id: 'L2', name: 'Scenes', count: paper.levels.L2, subtitle: 'Composition in three dimensions.', description: 'Arrange coherent environments with spatial relationships, materials, lighting, and purposeful detail.', capabilities: ['Layout', 'Appearance', 'Editing'], engine: 'Blender' },
  { id: 'L3', name: 'Interactive open worlds', count: paper.levels.L3, subtitle: 'Worlds that respond.', description: 'Build connected, traversable environments whose objects respond to actions and retain state within a session.', capabilities: ['Connected regions', 'Object interactions', 'Persistent state'], engine: 'Unreal Engine' },
] as const;

// External destinations remain unconfigured until release.
export const resources: { label: string; href: string | null }[] = [
  { label: 'Paper', href: null }, { label: 'Code', href: null }, { label: 'Dataset', href: null },
];
export const leaderboard = paper.leaderboard;

export const models = [
  { id: 'astra', name: 'GPT-6 Astra', model: 'gpt-6-astra', effort: 'max', harness: 'Codex' },
  { id: 'sol', name: 'GPT-6.1 Sol', model: 'gpt-6.1-sol', effort: 'max', harness: 'Codex' },
  { id: 'opus', name: 'Claude Opus 5.5', model: 'claude-opus-5-5', effort: 'max', harness: 'Claude Code' },
] as const;

export const cases = [
  { id: 'typewriter', level: 'L1', title: 'Typewriter' },
  { id: 'microscope', level: 'L1', title: 'Microscope' },
  { id: 'sneaker', level: 'L1', title: 'Sneaker' },
  { id: 'museum', level: 'L2', title: 'Museum hall' },
  { id: 'antique', level: 'L2', title: 'Antique shop' },
  { id: 'classroom', level: 'L2', title: 'Classroom' },
  { id: 'frontier', level: 'L3', title: 'Frontier town' },
  { id: 'minecraft', level: 'L3', title: 'Minecraft village' },
  { id: 'workshop', level: 'L3', title: 'Workshop' },
] as const;
