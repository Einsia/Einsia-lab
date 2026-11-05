type Case = { id: string; level: string; title: string };
export function initializeGallery(cases: readonly Case[]) {
  const root = document.querySelector<HTMLElement>('.f3-showcase');
  if (!root) return;
  const videos = [...root.querySelectorAll<HTMLVideoElement>('[data-preview]')];
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-level]')];
  const groups = [...root.querySelectorAll<HTMLElement>('[data-level-panel]')];
  const toggle = root.querySelector<HTMLButtonElement>('#motion-toggle')!;
  const panel = root.querySelector<HTMLElement>('#case-panel')!;
  const dialog = root.querySelector<HTMLDialogElement>('.f3-player')!;
  const player = dialog.querySelector('video')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Set<HTMLVideoElement>();
  const hero = document.querySelector<HTMLVideoElement>('[data-hero]')!;
  const heroToggle = document.querySelector<HTMLButtonElement>('.f3-hero-toggle')!;
  let heroVisible = true;
  let heroMotion = !reduced.matches;
  let motion = !reduced.matches;
  let level = 'L1';
  function refresh() {
    toggle.textContent = motion ? 'Motion on' : 'Motion off';
    toggle.setAttribute('aria-pressed', String(motion));
    heroToggle.textContent = heroMotion ? 'Ⅱ' : '▶';
    heroToggle.setAttribute('aria-pressed', String(heroMotion));
    heroToggle.setAttribute('aria-label', heroMotion ? 'Pause background videos' : 'Play background videos');
    if (heroVisible && heroMotion && !document.hidden && !dialog.open) {
      if (!hero.getAttribute('src')) { hero.src = hero.dataset.src!; hero.muted = true; }
      void hero.play().catch(() => {});
    } else hero.pause();
    for (const v of videos) {
      const active = v.closest<HTMLElement>('[data-level-panel]')!.dataset.levelPanel === level;
      if (active && visible.has(v) && motion && !document.hidden && !dialog.open) {
        if (!v.getAttribute('src')) { v.src = v.dataset.src!; v.muted = true; }
        void v.play().catch(() => { /* Posters remain available when autoplay is blocked. */ });
      } else v.pause();
    }
  }
  function select(next: string, hash = true) {
    level = next;
    tabs.forEach(tab => {
      const active = tab.dataset.level === level;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    });
    groups.forEach(group => { group.hidden = group.dataset.levelPanel !== level; });
    panel.setAttribute('aria-labelledby', `tab-${level}`);
    if (hash) history.replaceState(null, '', `#showcase-${level}`);
    refresh();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.dataset.level!));
    tab.addEventListener('keydown', event => {
      const indexes: Record<string, number> = { ArrowRight: (i+1)%tabs.length, ArrowLeft: (i+tabs.length-1)%tabs.length, Home: 0, End: tabs.length-1 };
      if (!(event.key in indexes)) return;
      event.preventDefault(); const target = tabs[indexes[event.key]]; target.focus(); target.click();
    });
  });
  toggle.addEventListener('click', () => { motion = !motion; refresh(); });
  reduced.addEventListener('change', () => { motion = !reduced.matches; heroMotion = !reduced.matches; refresh(); });
  heroToggle.addEventListener('click', () => { heroMotion = !heroMotion; refresh(); });
  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; refresh(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); refresh(); });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { const v = entry.target as HTMLVideoElement; if (entry.isIntersecting) visible.add(v); else visible.delete(v); });
    refresh();
  }, { rootMargin: '100px' });
  videos.forEach(v => {
    observer.observe(v);
    v.addEventListener('error', () => { v.closest('figure')!.querySelector<HTMLElement>('.f3-media-error')!.hidden = false; });
    v.addEventListener('loadeddata', () => { v.closest('figure')!.querySelector<HTMLElement>('.f3-media-error')!.hidden = true; });
  });
  // Keep each comparison row on a common playback phase.
  window.setInterval(() => {
    root.querySelectorAll('.f3-case-row').forEach(row => {
      const rowVideos = [...row.querySelectorAll('video')].filter(v => !v.paused && v.readyState >= 2);
      const anchor = rowVideos[0];
      if (!anchor) return;
      rowVideos.slice(1).forEach(v => { if (Math.abs(v.currentTime - anchor.currentTime) > .15) v.currentTime = anchor.currentTime; });
    });
  }, 1000);
  root.querySelectorAll<HTMLButtonElement>('[data-expand]').forEach(button => button.addEventListener('click', () => {
    const source = videos.find(v => v.dataset.preview === button.dataset.expand)!;
    player.src = source.dataset.src!; player.poster = source.poster; player.muted = true;
    player.setAttribute('aria-label', source.getAttribute('aria-label')!);
    dialog.showModal(); refresh();
    // Opening a preview is an explicit playback request, including in reduced-motion mode.
    void player.play().catch(() => {});
  }));
  dialog.querySelector('button')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { player.pause(); player.removeAttribute('src'); player.load(); refresh(); });
  function fromHash() {
    const c = cases.find(c => location.hash === `#showcase-${c.level}-${c.id}`);
    const next = c?.level || tabs.find(t => location.hash === `#showcase-${t.dataset.level}`)?.dataset.level;
    if (next) select(next, false);
  }
  fromHash(); refresh(); window.addEventListener('hashchange', fromHash);
}
