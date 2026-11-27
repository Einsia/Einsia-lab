// Reference interactions, scoped to each specimen's own document.
document.body.dataset.enhanced = '';
// Keep live project resources outside the reference frame.
document.querySelectorAll('a[href^="https://"]').forEach(link => {
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
});
const menu = document.querySelector('[data-menu]');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  document.getElementById(menu.getAttribute('aria-controls')).classList.toggle('is-open', open);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') {
    menu.click();
    menu.focus();
  }
});
document.querySelectorAll('[data-sort]').forEach(button => {
  button.addEventListener('click', () => {
    const header = button.closest('th');
    const ascending = header.getAttribute('aria-sort') !== 'ascending';
    const body = button.closest('table').tBodies[0];
    [...body.rows].sort((a, b) => (Number(a.dataset.score) - Number(b.dataset.score)) * (ascending ? 1 : -1)).forEach(row => body.append(row));
    header.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
    button.textContent = `Accuracy (%) ${ascending ? '↑' : '↓'}`;
    document.querySelector('[data-sort-status]').textContent = `Sorted by accuracy, ${ascending ? 'lowest first' : 'highest first'}.`;
  });
});
const filter = document.querySelector('[data-filter]');
if (filter) {
  const rows = [...document.querySelectorAll('[data-filter-item]')];
  const update = () => {
    const query = filter.value.trim().toLocaleLowerCase();
    let count = 0;
    rows.forEach(row => { row.hidden = !row.textContent.toLocaleLowerCase().includes(query); if (!row.hidden) count++; });
    document.querySelector('[data-filter-count]').textContent = `${count} ${count === 1 ? 'category' : 'categories'}`;
    document.querySelector('[data-filter-empty]').hidden = count !== 0;
  };
  const reset = () => { filter.value = ''; update(); filter.focus(); };
  filter.addEventListener('input', update);
  document.querySelector('[data-filter-form]').addEventListener('submit', event => event.preventDefault());
  document.querySelector('[data-filter-form]').addEventListener('reset', event => { event.preventDefault(); reset(); });
  document.querySelector('[data-reset]').addEventListener('click', reset);
}
document.querySelector('[data-copy-citation]')?.addEventListener('click', async () => {
  const code = document.getElementById('citation-code');
  const status = document.querySelector('[data-copy-status]');
  try {
    await navigator.clipboard.writeText(code.textContent);
    status.textContent = 'Citation copied.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    code.focus();
    status.textContent = 'Citation selected. Use your keyboard to copy it.';
  }
});
// Track the current in-page section without treating navigation links as tabs.
const localLinks = [...document.querySelectorAll('.lab-project-nav a[href^="#"]')];
if (localLinks.length) {
  const observer = new IntersectionObserver(entries => {
    const active = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!active) return;
    localLinks.forEach(link => {
      if (link.hash === `#${active.target.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, {rootMargin: '0px 0px -50% 0px'});
  localLinks.forEach(link => { const section = document.querySelector(link.hash); if (section) observer.observe(section); });
}
