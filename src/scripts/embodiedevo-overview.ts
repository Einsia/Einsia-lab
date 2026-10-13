import { projectPath } from '../lib/project-paths';

// Previously shared evidence links now belong to the project details page.
const movedSections = new Set([
  'framework-figure', 'control-paradigms-figure', 'performance',
  'capabilities', 'transfer', 'experience', 'cost',
  'full-evaluation', 'resources',
]);
function forwardEvidenceLink() {
  let id: string;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (movedSections.has(id)) location.replace(projectPath(`/embodiedevo/details/#${encodeURIComponent(id)}`));
}
window.addEventListener('hashchange', forwardEvidenceLink);
forwardEvidenceLink();

const animation = document.querySelector<HTMLImageElement>('#method-animation');
if (animation) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  function updateMotion() {
    const playing = !reducedMotion.matches && visible;
    const source = playing ? animation!.dataset.animation! : animation!.dataset.poster!;
    if (animation!.getAttribute('src') !== source) animation!.src = source;
  }
  reducedMotion.addEventListener('change', updateMotion);
  const visibility = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    updateMotion();
  }, { threshold: 0.1 });
  visibility.observe(animation);
}

const videos = [...document.querySelectorAll<HTMLVideoElement>('.dojo-showcase video')];
videos.forEach(video => video.addEventListener('play', () => videos.forEach(other => {
  if (other !== video) other.pause();
})));
