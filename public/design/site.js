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
  // Native dialog handles Escape, modality and returning focus. Lock only while open.
  const dialogs = [...document.querySelectorAll('dialog')];
  if (dialogs.length) {
    const sync = () => document.documentElement.classList.toggle('lab-modal-open', dialogs.some(dialog => dialog.open));
    const observer = new MutationObserver(sync);
    dialogs.forEach(dialog => observer.observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  }
})();
