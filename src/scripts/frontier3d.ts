type Case = { id: string; level: string; title: string };
export function initializeGallery(cases: readonly Case[]) {
  const root = document.querySelector<HTMLElement>('.f3-showcase');
  if (!root) return;
  const videos = [...root.querySelectorAll<HTMLVideoElement>('[data-preview]')];
  const toggle = root.querySelector<HTMLButtonElement>('#motion-toggle')!;
  const dialog = root.querySelector<HTMLDialogElement>('.f3-player')!;
  const player = dialog.querySelector('video')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const visible = new Set<HTMLVideoElement>();
  const hero = document.querySelector<HTMLVideoElement>('[data-hero]')!;
  const heroToggle = document.querySelector<HTMLButtonElement>('.f3-hero-toggle')!;
  let heroVisible = true;
  let heroMotion = !reduced.matches;
  let motion = !reduced.matches;
  function refresh() {
    toggle.textContent = motion ? 'Motion on' : 'Motion off';
    toggle.setAttribute('aria-pressed', String(motion));
    heroToggle.textContent = heroMotion ? 'Ⅱ' : '▶';
    heroToggle.setAttribute('aria-pressed', String(heroMotion));
    heroToggle.setAttribute('aria-label', heroMotion ? 'Pause background videos' : 'Play background videos');
    if (heroVisible && heroMotion && !document.hidden && !dialog.open) {
      if (!hero.getAttribute('src')) { hero.src = matchMedia('(max-width: 1100px)').matches && hero.dataset.srcCompact ? hero.dataset.srcCompact : hero.dataset.src!; hero.muted = true; }
      void hero.play().catch(() => {});
    } else hero.pause();
    for (const v of videos) {
      if (visible.has(v) && motion && !document.hidden && !dialog.open) {
        if (!v.getAttribute('src')) { v.src = v.dataset.src!; v.muted = true; }
        void v.play().catch(() => { /* Posters remain available when autoplay is blocked. */ });
      } else v.pause();
    }
  }
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
  // Correct drift gently; seeking during playback causes visible camera jumps.
  window.setInterval(() => {
    root.querySelectorAll('.f3-case-row').forEach(row => {
      const rowVideos = [...row.querySelectorAll('video')].filter(v => !v.paused && v.readyState >= 2);
      const anchor = rowVideos[0];
      if (!anchor) return;
      rowVideos.slice(1).forEach(v => {
        const duration = v.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const raw = anchor.currentTime - v.currentTime;
        const drift = ((raw + duration / 2 + duration) % duration) - duration / 2;
        v.playbackRate = Math.abs(drift) < .03 ? 1 : 1 + Math.max(-.04, Math.min(.04, drift * .12));
      });
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
    if (c) document.getElementById(`case-${c.id}`)?.scrollIntoView({ block: 'start' });
  }
  fromHash(); refresh(); window.addEventListener('hashchange', fromHash);
}
