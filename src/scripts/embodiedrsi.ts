const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
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
const stages = JSON.parse($('method-data').textContent!) as {word: string; text: string}[];
const methodTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-method-step]')];
methodTabs.forEach((b, index) => b.addEventListener('click', () => {
  methodTabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
  $('method-panel').setAttribute('aria-labelledby', b.id);
  $('method-title').textContent = stages[index].word; $('method-description').textContent = stages[index].text;
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

// Preserve links into evidence that is now collapsed on the details page.
function revealLinkedEvidence() {
  let id: string;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  let opened = false;
  for (let element: HTMLElement | null = target; element; element = element.parentElement) {
    if (element instanceof HTMLDetailsElement && !element.open) {
      element.open = true;
      opened = true;
    }
  }
  if (opened) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }));
}
window.addEventListener('hashchange', revealLinkedEvidence);
revealLinkedEvidence();

// Keep the section links below the lab header, including its expanded mobile menu.
const labHeader = document.querySelector<HTMLElement>('body > header');
const sectionNav = document.querySelector<HTMLElement>('.details-nav-wrap');
const sectionLinks = [...document.querySelectorAll<HTMLAnchorElement>('.details-nav a')];
const projectSections = [...document.querySelectorAll<HTMLAnchorElement>('[data-project-section]')];
if (labHeader && sectionNav) {
  const sections = sectionLinks.map(link => ({ link, section: document.getElementById(link.dataset.section!)! }));
  function updateSection() {
    const boundary = sectionNav!.getBoundingClientRect().bottom + 30;
    let current = sectionLinks[0];
    for (const { link, section } of sections) {
      if (section.getBoundingClientRect().top <= boundary) current = link;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      current = sectionLinks[sectionLinks.length - 1];
    }
    sectionLinks.forEach(link => {
      if (link === current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const projectSection = current.dataset.section === 'method' ? 'method'
      : ['evaluation', 'full-evaluation'].includes(current.dataset.section!) ? 'results' : null;
    projectSections.forEach(link => {
      if (link.dataset.projectSection === projectSection) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  new ResizeObserver(() => {
    document.body.style.setProperty('--details-header-height', `${labHeader.getBoundingClientRect().height}px`);
    updateSection();
  }).observe(labHeader);
  let pending = false;
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { updateSection(); pending = false; });
  }, { passive: true });
  document.querySelectorAll('details').forEach(detail => detail.addEventListener('toggle', updateSection));
  updateSection();
}
