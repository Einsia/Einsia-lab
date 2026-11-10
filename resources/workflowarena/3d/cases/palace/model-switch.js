/* Parallel, versioned asset loading with retained model views. */
'use strict';
(async()=>{
 const configs=window.PALACE_MODELS,params=new URLSearchParams(location.search),cathedral=document.title.includes('大教堂'),noun=cathedral?'大教堂':'宫殿',requested=params.get('model'),key=configs[requested]?.scripts?requested:(cathedral?'astra':'cc'),config=configs[key],embedded=params.get('embedded')==='1',version='perf-20261027-v3';
 const cleanURL=new URL(location.href);for(const p of ['view','time','preview'])cleanURL.searchParams.delete(p);history.replaceState(history.state,'',cleanURL);
 const root=embedded?parent:window;
 if(!root.__workflowAssets)root.__workflowAssets=new Map();
 const source=src=>{const url=new URL(src,location.href);url.searchParams.set('v',version);const id=url.href;if(!root.__workflowAssets.has(id)){root.__workflowAssets.set(id,fetch(id,{cache:'force-cache'}).then(r=>{if(!r.ok)throw new Error('Asset '+r.status+': '+src);return r.text();}).catch(e=>{root.__workflowAssets.delete(id);throw e;}));}return root.__workflowAssets.get(id);};
 const bar=document.createElement('div');bar.className='model-switch';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','选择'+noun+'实验模型');
 for(const[id,c]of Object.entries(configs)){const a=document.createElement('a'),url=new URL(location.href);url.searchParams.set('model',id);url.searchParams.delete('preview');url.searchParams.delete('embedded');a.href=url.pathname+url.search;a.role='tab';a.setAttribute('aria-selected',String(id===key));a.textContent=c.short+' · '+c.name;if(c.available===false){a.removeAttribute('href');a.setAttribute('aria-disabled','true');a.title='暂无已完成的建造记录';}else a.addEventListener('click',e=>{e.preventDefault();if(embedded)parent.postMessage({type:'workflow-switch',key:id},location.origin);else switchView(id);});bar.append(a);}
 window.renderWorkflow(key);const header=document.querySelector('main header');header.append(bar);const identity=document.createElement('p');identity.className='model-identity';identity.textContent=config.name+' · 独立评分 '+config.score.toFixed(2);identity.dataset.model=key;header.append(identity);
 const cue=document.querySelector('.stage-bottom>span');if(cue){cue.classList.add('interaction-cue');cue.innerHTML='<svg viewBox="0 0 24 34" aria-hidden="true"><rect x="3" y="1" width="18" height="30" rx="9"/><path d="M12 2v9"/><path class="mouse-wheel" d="M12 7v4"/></svg><span>拖动旋转 · 悬停查看 · 点击探索</span>';}
 const loading=document.createElement('div');loading.className='model-loading';loading.setAttribute('role','status');document.querySelector('.stage').append(loading);
 const frames=new Map();let active=key;
 function switchView(id,historyEntry=true){if(!configs[id]?.scripts)return;active=id;if(id===key&&window.Showcase){window.Showcase.reset();window.Showcase.play();}window.__workflowPaused=id!==key;for(const[k,f]of frames){if(k===id&&f.contentWindow.Showcase){f.contentWindow.Showcase.reset();f.contentWindow.Showcase.play();}f.style.display=k===id?'block':'none';f.contentWindow.__workflowPaused=k!==id;}
  if(id!==key&&!frames.has(id)){const f=document.createElement('iframe'),u=new URL(location.href);u.searchParams.set('model',id);u.searchParams.set('embedded','1');f.title=configs[id].name+' · '+noun;f.src=u.href;f.style.cssText='position:fixed;inset:0;width:100%;height:100%;border:0;background:#f3f0e6;z-index:1000';f.addEventListener('load',()=>{f.contentWindow.__workflowPaused=active!==id;});frames.set(id,f);document.body.append(f);}
  document.body.style.overflow=id===key?'':'hidden';if(historyEntry){const u=new URL(location.href);u.searchParams.set('model',id);history.pushState({model:id},'',u);}document.title=noun+' · '+configs[id].name+' · WorkflowArena';
 }
 if(!embedded){window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='workflow-switch')switchView(e.data.key);});window.addEventListener('popstate',()=>switchView(new URLSearchParams(location.search).get('model')||key,false));}
 try{
  let completed=0;const tasks=config.scripts.map(src=>source(src).then(code=>{completed++;loading.textContent='正在加载 '+config.name+' · '+completed+'/'+config.scripts.length;return code;}));
  const scripts=await Promise.all(tasks);
  for(let i=0;i<scripts.length;i++){loading.textContent='正在准备 3D 场景 · '+(i+1)+'/'+scripts.length;await new Promise(resolve=>requestAnimationFrame(resolve));(0,eval)(scripts[i]+'\n//# sourceURL='+config.scripts[i]);const u=new URL(config.scripts[i],location.href);u.searchParams.set('v',version);root.__workflowAssets.delete(u.href);}
  const d=window.CASE_DATA;document.getElementById('agent-total').textContent=new Set(d.events.filter(e=>e.kind==='build').map(e=>e.id)).size;
  if(window.Showcase){window.Showcase.reset();window.Showcase.play();}
  document.title=noun+' · '+config.name+' · WorkflowArena';document.documentElement.dataset.model=key;loading.remove();
  if(!embedded){const others=Object.entries(configs).filter(([id,c])=>id!==key&&c.scripts);const prefetch=async()=>{for(const[,c]of others){const remaining=[...c.scripts];while(remaining.length){await Promise.allSettled(remaining.splice(0,2).map(source));await new Promise(r=>setTimeout(r,150));}}};setTimeout(prefetch,2000);}
 }catch(error){loading.textContent='加载暂未完成，请刷新重试。';console.error(error);}
})();
