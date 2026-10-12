type Segment = { execution: number; start: number; end: number; title: string; code: string; rationale: string; stdout: string; stderr: string; success: boolean; native_steps: number | null };
type Episode = { id: string; benchmark: string; title: string; instruction: string; model: string; phase: string; suite: string; video: string; poster: string; duration: number; executions: number; nativeSteps: number; cameras: string[]; timelineNote: string; segments: Segment[] };
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('episode-video');
const scrub = $<HTMLInputElement>('timeline-scrub');
const speed = $<HTMLSelectElement>('playback-speed');
const episodeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-episode]')];
const cache = new Map<string, Episode>();
let current: Episode | null = null;
let activeIndex = -1;
let selectedId = 'robotwin';
let request = 0;
let abort: AbortController | null = null;
let pendingTime: number | null = null;
let copyTimer: ReturnType<typeof setTimeout>;
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function python(source: string) {
  // Tokenize raw text once, then escape every token. Logged code is never HTML.
  const pattern = /#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:def|return|if|else|elif|for|in|while|and|or|not|is|None|True|False|break|continue|import|from|as|try|except|with)\b|\b\d+(?:\.\d+)?\b/g;
  let html = '', pos = 0;
  for (const match of source.matchAll(pattern)) {
    html += esc(source.slice(pos, match.index));
    const text = match[0];
    const kind = text.startsWith('#') ? 'comment' : /^['"]/.test(text) ? 'string' : /^\d/.test(text) ? 'number' : 'keyword';
    html += `<span class="py-${kind}">${esc(text)}</span>`;
    pos = match.index! + text.length;
  }
  return html + esc(source.slice(pos));
}
function announce(text: string) { $('copy-announcement').textContent = text; }
function selectSegment(index: number) {
  if (!current || index === activeIndex) return;
  activeIndex = Math.max(0, Math.min(index, current.segments.length - 1));
  const s = current.segments[activeIndex];
  $('execution-number').textContent = `EXEC ${String(s.execution).padStart(2, '0')}`;
  $('chapter-title').textContent = s.title;
  $('chapter-rationale').textContent = s.rationale?.trim() || (s.execution === 0 ? 'Initial environment observation, before the first code execution.' : 'No explanatory comment was recorded in this code segment.');
  $('execution-code').innerHTML = s.code ? python(s.code) : '<span class="py-comment"># Initial observation. No submitted code yet.</span>';
  $('execution-feedback').textContent = `FEEDBACK AFTER EXECUTION ${s.execution}\n\nTask success: ${s.success}\n\nSTDOUT\n${s.stdout || '(No stdout recorded.)'}\n\nSTDERR\n${s.stderr || '(No stderr recorded.)'}`;
  $('execution-status').textContent = s.success ? 'Task success confirmed after this execution' : s.execution === 0 ? 'Initial observation' : 'Task not yet complete after this execution';
  $('execution-status').classList.toggle('success', s.success);
  $('native-steps').textContent = s.native_steps == null ? '' : `${s.native_steps} control steps`;
  $('chapter-position').textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${current.segments.length}`;
  $<HTMLButtonElement>('prev-chapter').disabled = activeIndex === 0;
  $<HTMLButtonElement>('next-chapter').disabled = activeIndex === current.segments.length - 1;
  $<HTMLButtonElement>('copy-code').disabled = !s.code;
  $('copy-code').textContent = 'Copy ⧉';
  clearTimeout(copyTimer);
  document.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach((button, i) => {
    button.classList.toggle('is-active', i === activeIndex);
    button.setAttribute('aria-pressed', String(i === activeIndex));
  });
  $('execution-code').parentElement!.scrollTop = 0;
  $('execution-feedback').scrollTop = 0;
}
function seek(time: number) {
  if (!current) return;
  const t = Math.min(Math.max(0, time), current.duration);
  pendingTime = video.readyState < 1 ? t : null;
  if (video.readyState >= 1) video.currentTime = t;
  scrub.value = String(t);
  $('current-time').textContent = fmt(t);
  const index = current.segments.findIndex(s => t >= s.start && t < s.end);
  selectSegment(index < 0 ? current.segments.length - 1 : index);
}
function jump(index: number) {
  if (!current || index < 0 || index >= current.segments.length) return;
  seek(current.segments[index].start + .01);
}
async function loadEpisode(id: string) {
  const version = ++request;
  selectedId = id;
  abort?.abort();
  video.pause();
  video.removeAttribute('src');
  video.load();
  pendingTime = null;
  current = null;
  activeIndex = -1;
  episodeButtons.forEach(b => { const on = b.dataset.episode === id; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  $('replay').hidden = true;
  $('episode-error').hidden = true;
  $('dojo-empty').hidden = id !== 'robodojo';
  $('episode-loading').hidden = id === 'robodojo';
  if (id === 'robodojo') {
    const url = new URL(location.href); url.searchParams.set('episode', id); history.replaceState(null, '', url);
    return;
  }
  abort = new AbortController();
  try {
    let data = cache.get(id);
    if (!data) {
      const response = await fetch(`/embodied-rsi/data/${id}.json`, { signal: abort.signal });
      if (!response.ok) throw new Error(`Episode unavailable: ${response.status}`);
      data = await response.json() as Episode;
      if (!data.segments?.length || !Number.isFinite(data.duration) || data.duration <= 0) throw new Error('Invalid episode');
      cache.set(id, data);
    }
    if (version !== request) return;
    current = data;
    $('episode-benchmark').textContent = data.benchmark;
    $('episode-title').textContent = data.title;
    $('episode-instruction').textContent = `“${data.instruction}”`;
    $('episode-meta').textContent = `${data.model} · ${data.suite} / ${data.phase} · Recorded preview`;
    $('duration').textContent = fmt(data.duration);
    $('camera-label').textContent = `${data.cameras.length} CAMERA VIEWS`;
    $('camera-label').title = data.cameras.join(' · ');
    $('chapter-count').textContent = `${data.executions} code executions`;
    $('timeline-note').textContent = data.timelineNote;
    $<HTMLAnchorElement>('download-trace').href = `/embodied-rsi/data/${id}.json`;
    scrub.max = String(data.duration);
    const timeline = $('chapter-timeline');
    timeline.replaceChildren();
    data.segments.forEach((s, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.chapter = String(index);
      button.title = `${fmt(s.start)} · ${s.title}`;
      button.setAttribute('aria-label', `Execution ${s.execution}: ${s.title}, at ${fmt(s.start)}`);
      button.setAttribute('aria-pressed', 'false');
      button.style.flexGrow = String(Math.max(1, s.end - s.start));
      button.textContent = String(s.execution).padStart(2, '0');
      button.classList.toggle('is-success', s.success);
      button.addEventListener('click', () => jump(index));
      timeline.append(button);
    });
    video.poster = data.poster;
    video.src = data.video;
    video.controls = false;
    video.playbackRate = Number(speed.value);
    video.load();
    $('episode-loading').hidden = true;
    $('replay').hidden = false;
    // Start at the first recorded motion so the initial view includes real code.
    jump(Math.max(0, data.segments.findIndex(s => (s.native_steps ?? 0) > 0)));
    const url = new URL(location.href);
    url.searchParams.set('episode', id);
    history.replaceState(null, '', url);
  } catch (error) {
    if (version !== request || (error instanceof DOMException && error.name === 'AbortError')) return;
    $('episode-loading').hidden = true;
    $('episode-error').hidden = false;
  }
}
function updatePlayButton() {
  $('play-toggle').textContent = video.paused ? '▶' : 'Ⅱ';
  $('play-toggle').setAttribute('aria-label', video.paused ? 'Play recorded episode' : 'Pause recorded episode');
}
video.addEventListener('loadedmetadata', () => { if (pendingTime !== null) { const t = pendingTime; pendingTime = null; seek(t); } video.playbackRate = Number(speed.value); });
video.addEventListener('timeupdate', () => {
  if (!current || pendingTime !== null) return;
  const time = video.currentTime;
  scrub.value = String(time);
  $('current-time').textContent = fmt(time);
  const idx = current.segments.findIndex(s => time >= s.start && time < s.end);
  selectSegment(idx < 0 ? current.segments.length - 1 : idx);
});
video.addEventListener('play', updatePlayButton);
video.addEventListener('pause', updatePlayButton);
video.addEventListener('ended', updatePlayButton);
video.addEventListener('error', () => {
  if (!current || !video.getAttribute('src')) return;
  $('timeline-note').textContent = 'The video could not be loaded. Recorded code and feedback remain available through the execution chapters below.';
  announce('Video unavailable. You can still explore the execution chapters.');
});
$('play-toggle').addEventListener('click', async () => {
  if (!current) return;
  if (!video.paused) video.pause();
  else { try { if (video.ended) seek(0); await video.play(); } catch { announce('Playback is unavailable. Try opening the recording directly.'); video.controls = true; } }
});
$('replay-start').addEventListener('click', () => seek(0));
scrub.addEventListener('input', () => seek(Number(scrub.value)));
speed.addEventListener('change', () => { video.playbackRate = Number(speed.value); });
$('prev-chapter').addEventListener('click', () => jump(activeIndex - 1));
$('next-chapter').addEventListener('click', () => jump(activeIndex + 1));
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('video-stage').requestFullscreen) { video.controls = true; await $('video-stage').requestFullscreen(); }
    else { video.controls = true; (video as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.(); }
  } catch { announce('Fullscreen is unavailable in this browser.'); }
});
document.addEventListener('fullscreenchange', () => { video.controls = Boolean(document.fullscreenElement); });
$('copy-code').addEventListener('click', async () => {
  const code = current?.segments[activeIndex]?.code;
  if (!code) return;
  try { await navigator.clipboard.writeText(code); $('copy-code').textContent = 'Copied ✓'; announce('Python code copied.'); }
  catch { $('copy-code').textContent = 'Select to copy'; announce('Clipboard unavailable. Select the code and copy it manually.'); }
  clearTimeout(copyTimer); copyTimer = setTimeout(() => { $('copy-code').textContent = 'Copy ⧉'; }, 2200);
});
const traceTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-trace-tab]')];
function traceTab(name: string) {
  traceTabs.forEach(b => { const on = b.dataset.traceTab === name; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
  $('code-panel').hidden = name !== 'code'; $('feedback-panel').hidden = name !== 'feedback';
  $('copy-code').hidden = name !== 'code';
}
traceTabs.forEach(b => b.addEventListener('click', () => traceTab(b.dataset.traceTab!)));
function keyboardTabs(buttons: HTMLButtonElement[]) {
  buttons.forEach((button, index) => button.addEventListener('keydown', event => {
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault(); buttons[next].click(); buttons[next].focus();
  }));
}
keyboardTabs(traceTabs);
episodeButtons.forEach(b => b.addEventListener('click', () => loadEpisode(b.dataset.episode!)));
$('retry-episode').addEventListener('click', () => loadEpisode(selectedId));
document.querySelector('[data-show-twin]')!.addEventListener('click', () => loadEpisode('robotwin'));
document.querySelectorAll<HTMLButtonElement>('[data-open-episode]').forEach(b => b.addEventListener('click', () => { loadEpisode(b.dataset.openEpisode!); $('trajectories').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }));
const stages = JSON.parse($('method-data').textContent!) as {file: string; word: string; text: string}[];
const methodTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-method-step]')];
methodTabs.forEach((b, index) => b.addEventListener('click', () => {
  methodTabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
  $('method-panel').setAttribute('aria-labelledby', b.id);
  $('method-file').textContent = stages[index].file; $('method-title').textContent = stages[index].word; $('method-description').textContent = stages[index].text;
  document.querySelectorAll('.method-position i').forEach((dot, i) => dot.classList.toggle('active', i === index));
}));
keyboardTabs(methodTabs);
const inputTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-input-tab]')];
inputTabs.forEach(button => button.addEventListener('click', () => {
  inputTabs.forEach(tab => {
    const selected = tab === button;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute('aria-controls')!).hidden = !selected;
  });
}));
keyboardTabs(inputTabs);
const requested = new URLSearchParams(location.search).get('episode');
loadEpisode(['robotwin', 'robocasa', 'robodojo'].includes(requested || '') ? requested! : 'robotwin');
