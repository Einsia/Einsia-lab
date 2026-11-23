(() => {
 const videos=[...document.querySelectorAll('video[data-auto-video]')];
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=reduce.matches;
 const visible=new Set();
 const refresh=()=>videos.forEach(v=>{
  if(!paused&&!document.hidden&&visible.has(v)&&v.getClientRects().length&&!v.closest('[hidden]'))v.play().catch(()=>{});
  else v.pause();
 });
 const controls=[...document.querySelectorAll('[data-video-toggle]')];
 const updateControls=()=>controls.forEach(b=>{b.hidden=false;b.textContent=paused?'Play videos':'Pause videos';b.setAttribute('aria-pressed',String(paused));});
 controls.forEach(b=>b.addEventListener('click',()=>{paused=!paused;updateControls();refresh();}));
 const observer=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting)visible.add(e.target);else visible.delete(e.target);});refresh();
 },{threshold:.15});
 videos.forEach(v=>{v.muted=true;observer.observe(v);});
 document.addEventListener('visibilitychange',refresh);
 reduce.addEventListener('change',()=>{paused=reduce.matches;updateControls();refresh();});
 window.roboMedia={refresh};updateControls();
})();
