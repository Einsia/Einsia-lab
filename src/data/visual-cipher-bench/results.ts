// Transcribed from Visual_Cipher_Bench-17.pdf, Table 1 (November 12, 2026).
// All percentages are the paper's rounded values, not live leaderboard results.
export const results = [
  ['GPT-6 Astra','max',80,13.3,0,13.3,10.7,26.7],
  ['GPT-6 Astra','xhigh',66.7,6.7,3.3,13.3,9,22.5],
  ['GPT-6 Astra','high',63.3,10,3.3,10,8.7,21.7],
  ['GPT-6 Astra','medium',30,6.7,3.3,6.7,4.7,11.7],
  ['GPT-6 Astra','low',20,0,0,0,2,5],
  ['GPT-6.1 Sol','max',60,10,3.3,13.3,8.7,21.7],
  ['GPT-6.1 Sol','xhigh',53.3,6.7,0,3.3,6.3,15.8],
  ['GPT-6.1 Sol','high',36.7,3.3,0,6.7,4.7,11.7],
  ['GPT-6.1 Sol','medium',26.7,0,0,6.7,3.3,8.3],
  ['GPT-6.1 Sol','low',16.7,0,0,3.3,2,5],
  ['Claude Opus 5.5','max',56.7,6.7,0,6.7,7,17.5],
  ['Claude Opus 5.5','xhigh',70,6.7,0,10,8.7,21.7],
  ['Claude Opus 5.5','high',40,0,0,3.3,4.3,10.8],
  ['Claude Opus 5.5','medium',33.3,0,0,0,3.3,8.3],
  ['Claude Opus 5.5','low',0,0,0,0,0,0],
  ['GPT-6 Luna','max',3.3,0,0,0,0.3,0.8],
  ['GPT-6 Luna','xhigh',0,0,0,0,0,0],
  ['GPT-6 Luna','high',0,0,0,0,0,0],
  ['GPT-6 Luna','medium',0,0,0,0,0,0],
  ['GPT-6 Luna','low',0,0,0,0,0,0],
  ['GPT-6 Luna','none',0,0,0,0,0,0],
  ['Claude Sonnet 5.5','max',3.3,0,0,0,0.3,0.8],
  ['Claude Sonnet 5.5','xhigh',0,0,0,0,0,0],
  ['Claude Sonnet 5.5','high',0,0,0,0,0,0],
  ['Claude Sonnet 5.5','medium',0,0,0,0,0,0],
  ['Claude Sonnet 5.5','low',0,0,3.3,0,0.3,0.8],
  ['DeepSeek V4.1 Flash','max',0,0,0,0,0,0],
  ['Qwen 3.8 Max','xhigh',0,0,0,0,0,0],
  ['Kimi K3.1 Pro','max',0,0,0,0,0,0],
] as const;
export const models = [...new Set(results.map(row => row[0]))];
export const best = models.map(model => results.filter(row => row[0] === model).reduce((a,b) => b[7] > a[7] ? b : a));
// Shared by the main ranking, configuration bars, and configuration readout.
export const modelStyles: Record<string, { color: string; logo: string; vendor: string; short: string }> = {
  'GPT-6 Astra': { color: '#285FC2', logo: 'openai', vendor: 'OpenAI', short: 'GPT-6 Astra' },
  'GPT-6.1 Sol': { color: '#9547B1', logo: 'openai', vendor: 'OpenAI', short: 'GPT-6.1 Sol' },
  'Claude Opus 5.5': { color: '#D46B38', logo: 'claude', vendor: 'Anthropic', short: 'Opus 5.5' },
  'GPT-6 Luna': { color: '#27936C', logo: 'openai', vendor: 'OpenAI', short: 'GPT-6 Luna' },
  'Claude Sonnet 5.5': { color: '#BF8D16', logo: 'claude', vendor: 'Anthropic', short: 'Sonnet 5.5' },
  'DeepSeek V4.1 Flash': { color: '#188C9F', logo: 'deepseek', vendor: 'DeepSeek', short: 'DeepSeek V4.1 Flash' },
  'Qwen 3.8 Max': { color: '#CB5079', logo: 'qwen', vendor: 'Qwen', short: 'Qwen 3.8 Max' },
  'Kimi K3.1 Pro': { color: '#566C8C', logo: 'kimi', vendor: 'Kimi', short: 'Kimi K3.1 Pro' },
};
export const effortOrder = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];
export const effortOpacity: Record<string, number> = { none: 0.30, low: 0.42, medium: 0.56, high: 0.70, xhigh: 0.85, max: 1 };
export const metricOptions = [
  { id: 'overall', label: 'Overall · all 40 tasks', column: 7, attempts: 120 },
  { id: 'P1', label: 'P1 · Spatial manipulation & simulation', column: 2, attempts: 30 },
  { id: 'P2', label: 'P2 · Logical constraints & planning', column: 3, attempts: 30 },
  { id: 'P3', label: 'P3 · Rule induction', column: 4, attempts: 30 },
  { id: 'P4', label: 'P4 · Knowledge-based decoding', column: 5, attempts: 30 },
];
export const categories = [
  {id:'P1',short:'Spatial',name:'Spatial manipulation & simulation',description:'Fold, rotate, assemble, and project. Keep track of geometry and orientation through a sequence of transformations.',pooled:22.8,example:'prism-camera'},
  {id:'P2',short:'Logic',name:'Logical constraints & planning',description:'Recover constraints from the drawing, then find a path, plan, or configuration that satisfies them together.',pooled:2.4,example:'city-limits'},
  {id:'P3',short:'Rule',name:'Rule induction',description:'Discover a puzzle-specific transformation from visual examples, and test it against every clue before applying it.',pooled:0.6,example:'fickle-neighbors'},
  {id:'P4',short:'Knowledge',name:'Knowledge-based decoding',description:'Recognize a convention or linguistic relationship, then connect clues across the page to decode the answer.',pooled:3.3,example:'closed-stock'},
];
