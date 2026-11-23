(() => {
 const {families,cases}=JSON.parse(document.querySelector('#robo-home-data').textContent);
 let selected=cases[12],family=families[4];
 const video=document.querySelector('#demo-video');
 const asset=p=>document.body.dataset.assetRoot+p.replace('/robouniverse/','');
 const selectCase=index=>{
  selected=cases[index];video.pause();video.removeAttribute('src');video.load();
  document.querySelector('#demo-title').textContent=selected.title;
  document.querySelector('#demo-instruction').textContent=selected.description;
  document.querySelector('#demo-example-count').textContent=`Example ${index%3+1} / 3`;
  document.querySelectorAll('[data-example]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.example)===index)));
  document.querySelectorAll('.lane-case').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.case)===index)));
  video.src=asset(selected.video);video.poster=asset(selected.images[0]);
  video.setAttribute('aria-label',`${selected.title}: reference replay`);
  document.querySelector('#demo-download').href=asset(selected.video);
  video.load();window.roboMedia?.refresh();
  document.querySelector('#demo-status').textContent=`${family.name}: ${selected.title}`;
 };
 const movePlayer=()=>{
  const grid=document.querySelector(`[data-embodiment-grid="${family.robot}"]`);
  const cards=[...grid.querySelectorAll('.atlas-card')];
  const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  const index=cards.findIndex(c=>c.dataset.family===family.id);
  const rowEnd=Math.min(Math.floor(index/columns)*columns+columns-1,cards.length-1);
  cards[rowEnd].after(document.querySelector('#atlas-detail'));
 };
 const selectFamily=id=>{
  family=families.find(f=>f.id===id);
  document.querySelectorAll('[data-family]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.family===id)));
  document.querySelector('#demo-family').textContent=family.name;
  document.querySelector('#demo-platform').textContent=family.robot==='Franka'?'SINGLE-ARM FRANKA':'DUAL-ARM AGILEX';
  document.querySelector('#demo-count').textContent=family.count.toLocaleString('en-US');
  const cats=document.querySelector('#demo-categories');cats.replaceChildren();
  family.categories.forEach(([name,n])=>{const s=document.createElement('span');s.textContent=name;const b=document.createElement('b');b.textContent=n.toLocaleString('en-US');s.append(b);cats.append(s);});
  const examples=document.querySelector('#demo-examples');examples.replaceChildren();
  cases.filter(c=>c.family===id).forEach(c=>{
   const b=document.createElement('button');b.type='button';b.dataset.example=c.index;
   const span=document.createElement('span');span.textContent=c.title;b.append(span);
   b.addEventListener('click',()=>selectCase(c.index));examples.append(b);
  });
  if(document.querySelector('#family-select'))document.querySelector('#family-select').value=id;
  movePlayer();selectCase(cases.findIndex(c=>c.family===id));
 };
 document.querySelectorAll('[data-family]').forEach(b=>{
  b.addEventListener('click',()=>selectFamily(b.dataset.family));
  if(b.tagName.toLowerCase()==='g')b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFamily(b.dataset.family);}});
 });
 document.querySelector('#family-select')?.addEventListener('change',e=>selectFamily(e.target.value));
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(movePlayer,150);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
 const initialFamily=location.hash.startsWith('#family-')?location.hash.slice(8):'transport';
 selectFamily(families.some(f=>f.id===initialFamily)?initialFamily:'transport');
 window.addEventListener('hashchange',()=>{
  const id=location.hash.slice(8);
  if(location.hash.startsWith('#family-')&&families.some(f=>f.id===id))selectFamily(id);
 });
 const copy=document.querySelector('#copy-citation');
 if(copy && navigator.clipboard?.writeText){
  copy.hidden=false;
  copy.addEventListener('click',async()=>{
   try { await navigator.clipboard.writeText(document.querySelector('#citation-text').textContent);document.querySelector('#copy-status').textContent='BibTeX copied.'; }
   catch { document.querySelector('#copy-status').textContent='Use Download .bib or select the citation below.'; }
  });
 }
 // All eight taxonomy columns are shown by default, grouped by embodiment.
 const setResultScope=scope=>{
  document.querySelectorAll('[data-result-scope]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.resultScope===scope)));
  document.querySelectorAll('[data-result-panel]').forEach(p=>p.hidden=p.dataset.resultPanel!==scope);
 };
 document.querySelectorAll('[data-result-scope]').forEach(b=>b.addEventListener('click',()=>setResultScope(b.dataset.resultScope)));
 document.querySelectorAll('[data-result-family]').forEach(b=>b.addEventListener('click',()=>{
  selectFamily(b.dataset.resultFamily);
  document.querySelector(`#${family.robot==='Franka'?'single-arm':'dual-arm'}`).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }));
})();
