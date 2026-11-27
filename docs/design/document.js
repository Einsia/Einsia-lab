const tokens = document.getElementById('ds-tokens').textContent;
const components = document.getElementById('ds-components').textContent;
const previewScript = document.getElementById('ds-preview-js').textContent;
function specimenDocument(name) {
  const markup = document.getElementById(`markup-${name}`).innerHTML;
  // Split the closing script delimiter so this code is safe when embedded in HTML.
  return '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lab · ' + name + '</title><style>' + tokens + '\n' + components + '</style></head><body class="lab-root">' + markup + '<script>' + previewScript + '<' + '/script></body></html>';
}
function download(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.querySelectorAll('[data-preview]').forEach(preview => {
  const name = preview.dataset.preview;
  const frame = preview.querySelector('iframe');
  const host = preview.querySelector('.doc-frame-host');
  const shell = preview.querySelector('.doc-frame-shell');
  const fit = () => {
    const available = host.clientWidth;
    if (!available) return;
    const width = preview.dataset.width === 'fit' ? available : Number(preview.dataset.width);
    const scale = Math.min(1, available / width);
    const maxHeight = ['Project','Results','Explorer','Article'].includes(name) ? 880 : 1000;
    frame.style.width = width + 'px';
    const height = Math.min(maxHeight, Math.max(200, frame.contentDocument?.documentElement?.scrollHeight || 400));
    frame.style.height = height + 'px';
    frame.style.transform = `scale(${scale})`;
    shell.style.width = width * scale + 'px';
    shell.style.height = height * scale + 'px';
  };
  preview.dataset.width = 'fit';
  frame.addEventListener('load', () => {
    fit();
    if (frame.contentDocument?.body) new ResizeObserver(fit).observe(frame.contentDocument.body);
  });
  frame.srcdoc = specimenDocument(name);
  new ResizeObserver(fit).observe(host);
  preview.querySelectorAll('[data-width]').forEach(button => button.addEventListener('click', () => {
    preview.dataset.width = button.dataset.width;
    preview.querySelectorAll('[data-width]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    // Reset height before measuring a narrower or wider layout.
    frame.style.height = '200px';
    fit();
  }));
  preview.querySelector('[data-download-template]').addEventListener('click', () => download(`lab-${name.toLowerCase()}.html`, specimenDocument(name), 'text/html;charset=utf-8'));
});
const navigation = [...document.querySelectorAll('.doc-side nav a')];
const observer = new IntersectionObserver(entries => {
  const current = entries.filter(e => e.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
  if (!current) return;
  navigation.forEach(link => {
    if (link.hash === `#${current.target.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}, {rootMargin: '-5% 0px -60% 0px'});
document.querySelectorAll('.doc-section').forEach(section => observer.observe(section));
