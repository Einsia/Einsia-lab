const brands = {
  openai: { label: 'OpenAI', icon: 'openai', light: '#9ED8CA', dark: '#358B7B' },
  claude: { label: 'Anthropic', icon: 'claude', light: '#F1C4AB', dark: '#BA795B' },
  deepseek: { label: 'DeepSeek', icon: 'deepseek', light: '#ABC8F4', dark: '#547FCC' },
  kimi: { label: 'Kimi', icon: 'kimi', light: '#BCBDEB', dark: '#7778B8' },
  minimax: { label: 'MiniMax', icon: 'minimax', light: '#F0B9CB', dark: '#C47794' },
  glm: { label: 'Z.ai', icon: 'zdotai', light: '#ABD9E6', dark: '#559BB2' },
  qwen: { label: 'Qwen', icon: 'qwen', light: '#CFBAEA', dark: '#9579BE' },
  doubao: { label: 'Doubao', icon: 'doubao', light: '#EED399', dark: '#BA934C' },
} as const;

export function modelBrand(name: string) {
  if (name.startsWith('GPT-')) return brands.openai;
  if (name.startsWith('Claude')) return brands.claude;
  if (name.startsWith('DeepSeek')) return brands.deepseek;
  if (name.startsWith('Kimi')) return brands.kimi;
  if (name.startsWith('MiniMax')) return brands.minimax;
  if (name.startsWith('GLM')) return brands.glm;
  if (name.startsWith('Qwen')) return brands.qwen;
  if (name.startsWith('Doubao')) return brands.doubao;
  throw new Error(`Missing model identity: ${name}`);
}
