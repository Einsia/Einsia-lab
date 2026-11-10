/* Communicate with the case shell without accessing a file:// frame's globals. */
(() => {
  'use strict';
  if (parent === window) return;
  const targetOrigin = location.protocol === 'file:' ? '*' : location.origin;
  window.addEventListener('message', event => {
    if (event.source !== parent || (location.protocol !== 'file:' && event.origin !== location.origin)) return;
    if (event.data?.type !== 'workflow-control') return;
    window.__workflowPaused = !!event.data.paused;
    if (event.data.restart && window.Showcase) {
      window.Showcase.reset();
      window.Showcase.play();
    }
  });
  let lastHeight = 0;
  const reportSize = () => {
    const height = document.documentElement.scrollHeight;
    if (height === lastHeight) return;
    lastHeight = height;
    parent.postMessage({type: 'workflow-size', height}, targetOrigin);
  };
  new ResizeObserver(reportSize).observe(document.documentElement);
  window.addEventListener('load', reportSize);
})();
