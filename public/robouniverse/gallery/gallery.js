(() => {
  const backdrop = document.querySelector('.rg-backdrop');
  const video = backdrop.querySelector('video');
  const canvas = backdrop.querySelector('canvas');
  const ctx = canvas.getContext('2d', {alpha: false});
  if (!ctx) return;
  const toggle = document.querySelector('.rg-motion');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let motion = !reduced.matches && !navigator.connection?.saveData;
  let visible = false;
  let frame = null;
  const nativeFrames = typeof video.requestVideoFrameCallback === 'function';
  function paint() {
    if (video.readyState < 2 || !canvas.width || !canvas.height) return;
    // Four tile widths are visible: 1/2 + 1 + 1 + 1 + 1/2. Crop each tile individually.
    const w = canvas.width / 4, h = canvas.height / 3;
    const tw = video.videoWidth / 5, th = video.videoHeight / 3;
    const scale = Math.max(w / tw, h / th), sw = w / scale, sh = h / scale;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
      const x = Math.round((col - 0.5) * w), y = Math.round(row * h);
      ctx.drawImage(video, col * tw + (tw - sw) / 2, row * th + (th - sh) / 2,
        sw, sh, x, y, Math.round((col + 0.5) * w) - x, Math.round((row + 1) * h) - y);
    }
    canvas.hidden = false;
  }
  function tick() {
    frame = null;
    if (video.paused || document.hidden || !visible || !motion) return;
    paint(); schedule();
  }
  function schedule() {
    if (frame === null) frame = nativeFrames ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
  }
  function update() {
    const label = motion ? 'Pause background video' : 'Play background video';
    toggle.title = label; toggle.setAttribute('aria-label', label);
    toggle.firstElementChild.textContent = motion ? 'Ⅱ' : '▶';
    if (!motion || !visible || document.hidden) {
      video.pause();
      if (frame !== null) { if (nativeFrames) video.cancelVideoFrameCallback(frame); else cancelAnimationFrame(frame); frame = null; }
      return;
    }
    if (!video.hasAttribute('src')) video.src = video.dataset.src;
    video.play().then(schedule).catch(e => { if (e.name === 'NotAllowedError') { motion = false; update(); } });
  }
  new ResizeObserver(() => {
    const scale = Math.min(devicePixelRatio || 1, 1.5, 2048 / Math.max(1, backdrop.clientWidth));
    canvas.width = Math.round(backdrop.clientWidth * scale); canvas.height = Math.round(backdrop.clientHeight * scale);
    paint();
  }).observe(backdrop);
  toggle.hidden = false;
  toggle.onclick = () => { motion = !motion; update(); };
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }).observe(backdrop);
  reduced.addEventListener('change', () => { motion = !reduced.matches; update(); });
  document.addEventListener('visibilitychange', update);
  update();
})();
