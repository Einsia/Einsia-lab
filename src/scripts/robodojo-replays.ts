import { projectPath } from '../lib/project-paths';
import { highlightRecord, languageForFile, type RecordLanguage } from './replay-highlighting';
import '../styles/replay-syntax.css';

type Task = { id: string; baseTask: string; title: string; category: string; score: number; successRate: number; evaluatedScenes: number; examples: string[] };
type Episode = { id: string; task: string; variantLabel: string; layout: number; score: number; success: boolean; executions: number; nativeSteps: number; instruction: string; duration: number; agentEvents: number };
type File = { name: string; content: string };
type Segment = { execution: number; code: string; files: File[]; ok: boolean; success: boolean; nativeSteps: number; nativeStepsTotal: number; stdout: string; stderr: string; reason: string };
type Event = { kind: string; label: string; text: string; timestamp?: string };
type Trace = Episode & { segments: Segment[]; contents: Record<string, string>; knowledge: { skills: File[]; lessons: File[] }; agentLog: Event[]; videos: Record<string, { file: string; duration: number }> };
type Catalog = { tasks: Task[]; episodes: Episode[] };
type View = 'code' | 'feedback' | 'agent' | 'skills' | 'lessons';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('episode-video');
const search = $<HTMLInputElement>('task-search');
const category = $<HTMLSelectElement>('category-filter');
const outcome = $<HTMLSelectElement>('outcome-filter');
const executionSelect = $<HTMLSelectElement>('execution-select');
const fileSelect = $<HTMLSelectElement>('file-select');
const assetRoot = projectPath('/embodied-rsi/replays/');
const esc = (s: string) => s.replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]!));
const fixed = (n: number) => n.toFixed(2);
const asset = (id: string, name: string) => `${assetRoot}episodes/${encodeURIComponent(id)}/${name}`;
const announce = (text: string) => { $('announcement').textContent = text; };
let catalog: Catalog;
let currentTask: Task | null = null;
let trace: Trace | null = null;
let chosenId = '';
let executionIndex = 0;
let view: View = 'code';
const wrapping: Record<View, boolean> = { code: false, feedback: true, agent: true, skills: true, lessons: true };
let camera = 'cam_head';
let requestVersion = 0;
let controller: AbortController | null = null;
let copiedText = '';
let copyTimer: ReturnType<typeof setTimeout>;

function updateURL() {
  if (!currentTask || !chosenId) return;
  const url = new URL(location.href);
  url.searchParams.set('task', currentTask.id);
  url.searchParams.set('scene', chosenId);
  history.replaceState(null, '', url);
}

function renderExamples() {
  if (!catalog || !currentTask) return;
  const entries = currentTask.examples.map(id => catalog.episodes.find(e => e.id === id)!);
  const visible = entries.filter(e => outcome.value === 'all' || e.success === (outcome.value === 'success'));
  $('no-examples').hidden = visible.length > 0;
  $('examples-label').textContent = outcome.value === 'all' ? `${entries.length} examples` : `${visible.length} of ${entries.length} examples`;
  $('example-grid').innerHTML = visible.map((e) => `<button type="button" class="example-card" data-scene="${esc(e.id)}" aria-pressed="${e.id === chosenId}" aria-label="Example ${entries.indexOf(e) + 1} of ${entries.length}, ${esc(e.variantLabel)} scene ${e.layout}, ${e.success ? 'success' : 'unsuccessful'}, score ${e.score}"><img src="${asset(e.id, 'poster.webp')}" width="640" height="480" alt="Initial robot scene ${e.layout}" loading="lazy" /><span class="card-play" aria-hidden="true">▶</span><span class="card-caption"><span><strong>Example ${entries.indexOf(e) + 1}</strong><small>Scene ${String(e.layout).padStart(2, '0')} · Seed 1</small></span><span class="card-result ${e.success ? 'success' : ''}">${e.success ? '✓' : '○'} ${e.score.toFixed(0)}</span></span></button>`).join('');
  $('example-grid').querySelectorAll<HTMLButtonElement>('[data-scene]').forEach(button => button.addEventListener('click', () => loadEpisode(button.dataset.scene!)));
}

function filterTasks() {
  const query = search.value.toLowerCase().replaceAll('_', ' ').trim();
  let count = 0;
  document.querySelectorAll<HTMLButtonElement>('[data-task]').forEach(button => {
    const name = `${button.dataset.task!.replaceAll('_', ' ')} ${button.querySelector('.task-name')!.textContent}`.toLowerCase();
    const matches = name.includes(query) && (category.value === 'all' || category.value === button.dataset.category);
    button.hidden = !matches;
    if (matches) count++;
  });
  $('task-count').textContent = `${count} TASK${count === 1 ? '' : 'S'}`;
  $('no-tasks').hidden = count > 0;
}

function chooseTask(id: string, episode?: string) {
  const task = catalog.tasks.find(t => t.id === id);
  if (!task) return;
  currentTask = task;
  outcome.value = 'all';
  $('task-title').textContent = task.title;
  $('selected-category').textContent = task.category.toUpperCase();
  $('task-meta').textContent = `${task.examples.length} examples · 3 camera views · Seed 1`;
  $('task-metric-scope').textContent = `ALL ${task.evaluatedScenes} SCENES · SCORE / SR`;
  $('task-metrics').textContent = `${fixed(task.score)} / ${fixed(task.successRate)}%`;
  document.querySelectorAll<HTMLButtonElement>('[data-task]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.task === id)));
  loadEpisode(episode && task.examples.includes(episode) ? episode : task.examples[0]);
}

function setCamera(name: string, preserve = true) {
  if (!trace || !trace.videos[name]) return;
  const time = preserve ? video.currentTime : 0;
  const resume = preserve && !video.paused;
  video.pause();
  camera = name;
  const src = asset(trace.id, trace.videos[name].file);
  document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button => {
    const selected = button.dataset.camera === name;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected) $('camera-panel').setAttribute('aria-labelledby', button.id);
  });
  $('video-error').hidden = true;
  video.poster = name === 'cam_head' ? asset(trace.id, 'poster.webp') : '';
  video.onloadedmetadata = () => {
    if (!video.currentSrc.endsWith(src)) return;
    if (time > .01) video.currentTime = Math.min(time, Math.max(0, video.duration - .01));
    video.playbackRate = Number($<HTMLSelectElement>('playback-speed').value);
    if (resume) video.play().catch(() => announce('Use the play button to resume the video.'));
  };
  video.src = src;
  video.load();
  $<HTMLAnchorElement>('download-video').href = src;
}

function renderExecution() {
  if (!trace) return;
  const segment = trace.segments[executionIndex];
  executionSelect.value = String(executionIndex);
  $('execution-status').textContent = segment ? `${segment.nativeSteps} native actions` : 'No submitted code';
  $<HTMLButtonElement>('previous-execution').disabled = executionIndex <= 0;
  $<HTMLButtonElement>('next-execution').disabled = executionIndex >= trace.segments.length - 1;
  $('execution-strip').querySelectorAll<HTMLButtonElement>('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === executionIndex)));
  renderRecord();
}

function renderRecord() {
  const active = Boolean(trace);
  const isExecution = view === 'code' || view === 'feedback';
  $('execution-controls').hidden = !isExecution || !active;
  $('file-controls').hidden = true;
  $('record-content').hidden = view === 'agent';
  $('agent-events').hidden = view !== 'agent';
  $('wrap-code').hidden = view === 'agent';
  $('record-content').classList.toggle('wrap', wrapping[view]);
  $('wrap-code').setAttribute('aria-pressed', String(wrapping[view]));
  $<HTMLButtonElement>('copy-record').disabled = !active;
  $('record-panel').setAttribute('aria-labelledby', `tab-${view}`);
  copiedText = '';
  if (!trace) {
    highlightRecord($('record-content'), 'Choose an example to inspect its record.');
    $('agent-events').replaceChildren();
    return;
  }
  const segment = trace.segments[executionIndex];
  let files: File[] = [];
  let language: RecordLanguage = 'plain';
  if (view === 'code' && segment) files = [{ name: 'Complete submitted snapshot', content: segment.code }, ...segment.files];
  if (view === 'skills' || view === 'lessons') files = trace.knowledge[view];
  if (files.length) {
    $('file-controls').hidden = false;
    fileSelect.replaceChildren(...files.map(file => new Option(file.name, file.content)));
    copiedText = trace.contents[files[0].content];
    language = languageForFile(files[0].name, view === 'code' ? 'python' : 'plain');
    $('record-label').textContent = view === 'code' ? `EXECUTION ${String(segment.execution).padStart(2, '0')} · PYTHON` : `${files.length} FROZEN FILE${files.length === 1 ? '' : 'S'}`;
  } else if (view === 'feedback' && segment) {
    $('record-label').textContent = `EXECUTION ${String(segment.execution).padStart(2, '0')} · FEEDBACK`;
    copiedText = `Execution accepted: ${segment.ok}\nTask success: ${segment.success}\nNative actions: ${segment.nativeSteps} (${segment.nativeStepsTotal} total)\nState: ${segment.reason}\n\nSTDOUT\n${segment.stdout || '(No stdout.)'}\n\nSTDERR\n${segment.stderr || '(No stderr.)'}`;
  } else if (view === 'agent') {
    $('record-label').textContent = `${trace.agentLog.length} RECORDED EVENTS`;
    const fragment = document.createDocumentFragment();
    trace.agentLog.forEach((event, i) => {
      const article = document.createElement('article'); article.className = 'agent-event';
      const heading = document.createElement('div'); heading.className = 'event-heading';
      const label = document.createElement('strong'); label.textContent = `${String(i + 1).padStart(2, '0')} · ${event.label}`; heading.append(label);
      const time = document.createElement('time'); const date = event.timestamp ? new Date(event.timestamp) : null;
      time.textContent = date && Number.isFinite(date.getTime()) ? `${date.toISOString().slice(11, 19)} UTC` : '';
      heading.append(time); article.append(heading);
      const pre = document.createElement('pre'); pre.textContent = event.text;
      if (event.kind === 'output') { const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = 'Read tool response'; details.append(summary, pre); article.append(details); }
      else article.append(pre);
      fragment.append(article);
    });
    $('agent-events').replaceChildren(fragment);
    copiedText = trace.agentLog.map(e => `${e.label}\n${e.text}`).join('\n\n');
    if (!trace.agentLog.length) $('agent-events').textContent = 'No public agent events were recorded for this episode.';
  } else {
    copiedText = `No ${view === 'code' ? 'submitted code' : view} files were recorded for this episode.`;
    $('record-label').textContent = 'RECORDED ARTIFACTS';
  }
  highlightRecord($('record-content'), copiedText, language);
  $('record-panel').scrollTop = 0;
  $('record-panel').scrollLeft = 0;
}

async function loadEpisode(id: string) {
  const version = ++requestVersion;
  controller?.abort(); controller = new AbortController();
  chosenId = id;
  trace = null;
  clearTimeout(copyTimer);
  $('copy-record').textContent = 'Copy';
  video.pause(); video.removeAttribute('src'); video.load();
  $('episode-player').hidden = true;
  $('episode-error').hidden = true;
  $('episode-loading').hidden = false;
  $('record-label').textContent = 'LOADING RECORD…';
  renderRecord(); renderExamples(); updateURL();
  try {
    const response = await fetch(asset(id, 'trace.json'), { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as Trace;
    if (version !== requestVersion) return;
    if (data.id !== id || !Array.isArray(data.segments) || !data.videos?.cam_head) throw new Error('Invalid recorded trace');
    trace = data;
    $('episode-title').textContent = `Scene ${String(data.layout).padStart(2, '0')} · ${data.variantLabel}`;
    $('episode-outcome').textContent = data.success ? 'Success' : 'Unsuccessful';
    $('episode-outcome').classList.toggle('success', data.success);
    $('episode-score').textContent = `Score ${fixed(data.score)} / 100`;
    $('task-instruction').textContent = data.instruction;
    $('episode-budget').textContent = `${data.executions} executions · ${data.nativeSteps} native actions`;
    $('agent-meta').textContent = `${data.executions} executions · ${data.agentLog.length} public events`;
    $<HTMLAnchorElement>('download-trace').href = asset(id, 'trace.json');
    $<HTMLAnchorElement>('official-report').href = asset(id, 'report.json');
    executionIndex = 0;
    executionSelect.replaceChildren(...data.segments.map((s, i) => new Option(`Execution ${String(s.execution).padStart(2, '0')} · ${s.nativeSteps} actions${s.ok === false ? ' · error' : ''}`, String(i))));
    const strip = $('execution-strip'); strip.replaceChildren();
    data.segments.forEach((s, i) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = String(s.execution).padStart(2, '0'); button.setAttribute('aria-label', `Execution ${s.execution}`); button.classList.toggle('has-error', s.ok === false); button.addEventListener('click', () => { executionIndex = i; renderExecution(); }); strip.append(button); });
    $('episode-loading').hidden = true; $('episode-player').hidden = false;
    setCamera(camera, false); renderExecution();
  } catch (error) {
    if (version !== requestVersion || (error instanceof DOMException && error.name === 'AbortError')) return;
    $('episode-loading').hidden = true; $('episode-error').hidden = false;
    $('record-label').textContent = 'RECORD UNAVAILABLE';
    announce('The trajectory could not be loaded. Use Try again to retry.');
  }
}

function tabs(selector: string, select: (button: HTMLButtonElement) => void) {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(selector)];
  buttons.forEach((button, index) => {
    button.addEventListener('click', () => select(button));
    button.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault(); buttons[next].click(); buttons[next].focus();
    });
  });
}

tabs('[data-camera]', button => setCamera(button.dataset.camera!));
tabs('[data-record]', button => {
  view = button.dataset.record as View;
  document.querySelectorAll<HTMLButtonElement>('[data-record]').forEach(tab => { const selected = tab === button; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
  renderRecord();
});
search.addEventListener('input', filterTasks);
category.addEventListener('change', filterTasks);
document.addEventListener('keydown', event => { if (event.key === '/' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); search.focus(); } });
outcome.addEventListener('change', () => {
  renderExamples();
  const visible = currentTask?.examples.map(id => catalog.episodes.find(e => e.id === id)!).filter(e => outcome.value === 'all' || e.success === (outcome.value === 'success')) ?? [];
  if (!visible.length) {
    controller?.abort(); requestVersion++;
    video.pause(); trace = null;
    $('episode-player').hidden = true; $('episode-loading').hidden = true;
    $('record-label').textContent = 'NO MATCHING EXAMPLES';
    renderRecord();
  } else if (trace && visible.some(e => e.id === trace!.id)) $('episode-player').hidden = false;
  else loadEpisode(visible.find(e => e.id === chosenId)?.id || visible[0].id);
});
executionSelect.addEventListener('change', () => { executionIndex = Number(executionSelect.value); renderExecution(); });
$('previous-execution').addEventListener('click', () => { if (executionIndex > 0) { executionIndex--; renderExecution(); } });
$('next-execution').addEventListener('click', () => { if (trace && executionIndex < trace.segments.length - 1) { executionIndex++; renderExecution(); } });
fileSelect.addEventListener('change', () => {
  copiedText = trace?.contents[fileSelect.value] || '';
  const language = languageForFile(fileSelect.selectedOptions[0]?.text ?? '', view === 'code' ? 'python' : 'plain');
  highlightRecord($('record-content'), copiedText, language);
  $('record-panel').scrollTop = 0;
  $('record-panel').scrollLeft = 0;
});
$('wrap-code').addEventListener('click', () => { wrapping[view] = !wrapping[view]; $('record-content').classList.toggle('wrap', wrapping[view]); $('wrap-code').setAttribute('aria-pressed', String(wrapping[view])); });
$('playback-speed').addEventListener('change', () => { video.playbackRate = Number($<HTMLSelectElement>('playback-speed').value); });
video.addEventListener('error', () => { if (trace && video.getAttribute('src')) { $('video-error').hidden = false; announce('Video unavailable. Code and experience are still available.'); } });
$('copy-record').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(copiedText); $('copy-record').textContent = 'Copied'; announce('Recorded text copied.'); }
  catch { announce('Clipboard unavailable. Select the recorded text and copy it manually.'); }
  clearTimeout(copyTimer); copyTimer = setTimeout(() => { $('copy-record').textContent = 'Copy'; }, 1800);
});
$('copy-link').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); announce('Scene link copied.'); $('copy-link').textContent = 'Link copied ✓'; setTimeout(() => { $('copy-link').textContent = 'Copy scene link ↗'; }, 1800); } catch { announce('Copy the scene link from the address bar.'); } });
$('retry-episode').addEventListener('click', () => chosenId ? loadEpisode(chosenId) : initialize());

async function initialize() {
  try {
    const response = await fetch(`${assetRoot}catalog.json`);
    if (!response.ok) throw new Error(`Catalog: HTTP ${response.status}`);
    catalog = await response.json();
    document.querySelectorAll<HTMLButtonElement>('[data-task]').forEach(button => { button.onclick = () => chooseTask(button.dataset.task!); });
    const query = new URLSearchParams(location.search);
    const episode = catalog.episodes.find(e => e.id === query.get('scene'));
    const task = catalog.tasks.find(t => t.id === query.get('task'));
    chooseTask(episode?.task || task?.id || 'stack_blocks_by_language', episode?.id);
  } catch {
    $('episode-error').hidden = false;
    announce('The trajectory catalog could not be loaded. Use Try again to retry.');
  }
}
initialize();
