/* Shared progressive enhancements. Core content and links remain usable without JS. */
(() => {
  document.querySelectorAll('.lab-nav-toggle').forEach(button => {
    const nav = document.getElementById(button.getAttribute('aria-controls'));
    if (!nav) return;
    nav.dataset.collapsed = 'true';
    const close = () => { nav.dataset.collapsed = 'true'; button.setAttribute('aria-expanded', 'false'); };
    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') !== 'true';
      nav.dataset.collapsed = String(!expanded); button.setAttribute('aria-expanded', String(expanded));
    });
    button.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    nav.addEventListener('keydown', event => { if (event.key === 'Escape') { close(); button.focus(); } });
    nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
  });
  // Local overflow is discoverable and keyboard scrollable; never clip the whole page.
  document.querySelectorAll('.swm-lane,.vcbm-lane,.vcbl-scroll,.pptbench-gallery-viewport,.board-scroll,.table-scroll,.results-table-wrap,.overflow-x-auto').forEach(region => {
    region.tabIndex = 0;
    if (!region.hasAttribute('role')) region.setAttribute('role', 'region');
    if (!region.hasAttribute('aria-label')) region.setAttribute('aria-label', region.querySelector('table') ? 'Results, scroll horizontally for all columns' : 'Examples, scroll horizontally to explore');
  });
  // One figure preview for Astro and standalone pages, including original-image links.
  const lightbox = document.createElement('dialog');
  lightbox.id = 'lightbox';
  lightbox.className = 'lab-lightbox';
  lightbox.setAttribute('aria-label', 'Figure preview');
  lightbox.innerHTML = '<button type="button" data-lightbox-close aria-label="Close figure preview">Close ×</button><p data-lightbox-status role="status" hidden>Loading image…</p><img id="lightbox-img" alt="" hidden><div data-lightbox-error hidden><p role="status">Image could not be loaded.</p><button type="button" data-lightbox-retry>Retry</button></div>';
  document.body.append(lightbox);
  const preview = lightbox.querySelector('img');
  const status = lightbox.querySelector('[data-lightbox-status]');
  const error = lightbox.querySelector('[data-lightbox-error]');
  let opener;
  let source;
  const loadImage = () => {
    preview.hidden = true;
    status.hidden = false;
    error.hidden = true;
    preview.src = source;
  };
  const openImage = (trigger, src, alt) => {
    if (!src) return;
    opener = trigger;
    source = src;
    preview.alt = alt || 'Research figure';
    trigger.focus({ preventScroll: true });
    lightbox.showModal();
    loadImage();
  };
  preview.addEventListener('load', () => {
    if (!lightbox.open) return;
    status.hidden = true;
    preview.hidden = false;
  });
  preview.addEventListener('error', () => {
    if (!lightbox.open) return;
    status.hidden = true;
    error.hidden = false;
  });
  lightbox.querySelector('[data-lightbox-close]').addEventListener('click', () => lightbox.close());
  lightbox.querySelector('[data-lightbox-retry]').addEventListener('click', () => {
    loadImage();
    lightbox.querySelector('[data-lightbox-close]').focus();
  });
  lightbox.addEventListener('click', event => {
    const rect = lightbox.getBoundingClientRect();
    if (event.target === lightbox && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) lightbox.close();
  });
  lightbox.addEventListener('close', () => {
    // Native close events are queued; a quick reopen must keep the new image.
    if (lightbox.open) return;
    preview.hidden = true;
    preview.removeAttribute('src');
    opener?.focus({ preventScroll: true });
  });
  const imageLink = link => {
    if (!link || link.hasAttribute('download') || link.closest('[data-no-lightbox]')) return false;
    try { return /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(new URL(link.href, document.baseURI).pathname); }
    catch { return false; }
  };
  document.querySelectorAll('main a[href]').forEach(link => {
    if (imageLink(link)) link.setAttribute('aria-haspopup', 'dialog');
  });
  // Navigation thumbnails and existing interactive media keep their own actions.
  document.querySelectorAll('main img').forEach(image => {
    if (image.closest('a,button,[role=button],[data-no-lightbox],.institution-row,.board-model')) return;
    if (Number(image.getAttribute('width')) > 0 && Number(image.getAttribute('width')) <= 64) return;
    image.dataset.labPreview = '';
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-haspopup', 'dialog');
    image.setAttribute('aria-label', `Enlarge figure: ${image.alt || 'Research image'}`);
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openImage(image, image.currentSrc || image.src, image.alt);
      }
    });
  });
  document.querySelectorAll('[data-lab-preview]').forEach(trigger => trigger.setAttribute('aria-haspopup', 'dialog'));
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const trigger = event.target.closest('[data-lab-preview],main a[href]');
    if (!trigger || (!trigger.hasAttribute('data-lab-preview') && !imageLink(trigger))) return;
    const image = trigger.matches('img') ? trigger : trigger.querySelector('img');
    const src = trigger.dataset.labPreview || (trigger.matches('a') ? trigger.href : image?.currentSrc || image?.src);
    if (!src) return;
    event.preventDefault();
    openImage(trigger, src, trigger.dataset.alt || image?.alt || trigger.textContent.trim());
  });
  // Native dialog handles Escape, modality and returning focus. Lock only while open.
  const dialogs = [...document.querySelectorAll('dialog')];
  if (dialogs.length) {
    const sync = () => document.documentElement.classList.toggle('lab-modal-open', dialogs.some(dialog => dialog.open));
    const observer = new MutationObserver(sync);
    dialogs.forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  }
})();
