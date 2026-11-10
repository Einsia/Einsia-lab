const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#dfad86','#a7d7ad','#b8b5e0','#e0d087'];
const roles={scan:['⌕','观察素材，提取可交接的信息'],select:['◇','比较候选，让镜头贴合叙事'],review:['✓','独立检查约束与前后连续性'],edit:['✂','组织拼接、输出与交付步骤'],compute:['⌘','主控整理数据与确定性计算']};
let ci=0,mi=0,t=0,playing=false,last=0,phase=-1,thumb=-1;
const current=()=>CASES[ci], model=()=>current().models[mi], idx=()=>Math.min(model().stages.length-1,Math.floor(t*model().stages.length));
const photo=(c,n)=>`assets/${c.id}/${String(n).padStart(2,'0')}.jpg`;
function modal(html){$('detail-body').innerHTML=html;$('detail').showModal()}
function evidence(){const m=model(),s=m.stages[idx()];modal(`<div class="eyebrow">SOURCE / ${esc(m.id)}</div><h2>${esc(s.title)}</h2><p>源码第 ${s.line} 行附近</p><pre>${esc(s.excerpt)}</pre><a href="${m.source}" target="_blank" rel="noopener">打开完整 workflow.js ↗</a><p class="hash">SHA256 · ${m.sha256}</p>`)}
function setup(){phase=-1;thumb=-1;const c=current(),m=model();
 $('case-tabs').innerHTML=CASES.map((v,i)=>`<button class="case-tab ${i===ci?'active':''}" data-case="${i}"><img src="${photo(v,1)}" alt="${esc(v.title)}原素材"><div><small>${v.id.toUpperCase()} / ${esc(v.english)}</small><b>${esc(v.title)}</b></div><span class="arrow">↗</span></button>`).join('');
 $('model-tabs').innerHTML=c.models.map((v,i)=>`<button class="model-tab ${i===mi?'active':''}" data-model="${i}" style="--c:${colors[i]}"><i class="model-dot"></i>${v.id}</button>`).join('');
 $('case-id').textContent=c.id.toUpperCase();$('case-title').textContent=c.title;$('case-description').textContent=c.description;$('film-format').textContent=c.format;
 $('film-tracks').innerHTML=c.tracks.map((track,k)=>`<div class="film-track" data-track="${k}"><span class="track-name">${track.name}</span>${track.labels.map(label=>`<div class="clip" data-slot="${label}"><b>${label}</b></div>`).join('')}</div>`).join('');
 $('case-credit').textContent='素材来源：'+c.credit;
 $('phase-map').innerHTML=m.stages.map((s,i)=>{const a=contract(ci,mi,i);return `<button class="phase-step" data-phase="${i}"><span class="step-num">${String(i+1).padStart(2,'0')} <span>${a.icon}</span></span><b>${esc(s.title)}</b><small class="parallel-label">${s.kind==='compute'?'主控计算':s.count>1?s.count+' 路逻辑任务':'单任务'}</small><div class="mini-workers">${Array.from({length:Math.min(s.count,5)},()=>'<i>●</i>').join('')}${s.count>5?'<em>+'+(s.count-5)+'</em>':''}</div><span class="flow-input">输入 · ${a.input}</span><span class="flow-action">${a.action}</span><span class="flow-output">↓ ${a.output}</span><span class="focus-label">查看局部演示 ↘</span></button>`}).join('');
 $('branch-note').textContent=m.conditional;$('branch-detail').hidden=true;render();
}
function render(){const m=model(),i=idx(),s=m.stages[i],a=contract(ci,mi,i),r=[a.icon,a.duty];
 if(phase!==i){phase=i;const groups=Math.min(s.count,8),positions=groups===1?[[17,43]]:groups<=4?[[18,24],[82,24],[18,73],[82,73]]:[[18,21],[40,12],[64,12],[83,27],[83,69],[64,81],[40,81],[17,67]];
 const items=Array.from({length:groups},(_,j)=>{const a=Math.floor(j*s.count/groups)+1,b=Math.floor((j+1)*s.count/groups);return {label:a===b?`AGENT ${String(a).padStart(2,'0')}`:`AGENT ${String(a).padStart(2,'0')}–${String(b).padStart(2,'0')}`,n:b-a+1,pos:positions[j]}});
 $('agents').innerHTML=items.map((v,j)=>`<button class="agent" style="left:${v.pos[0]}%;top:${v.pos[1]}%;--c:${colors[mi]}" aria-label="查看${esc(s.title)}规划依据"><div class="avatar" style="animation-delay:${j*.17}s"><span class="tool">${r[0]}</span></div><span class="agent-label">${s.kind==='compute'?'CONTROLLER':v.label}</span><div class="agent-sub">${v.n>1?v.n+' 个任务 · ':''}${esc(s.title)}</div></button>`).join('');
 $('wires').innerHTML=items.map((v,j)=>{const x=v.pos[0]*9,y=v.pos[1]*4.6;return `<path id="wire${j}" class="wire" d="M ${x} ${y} Q ${x} 230 450 230"/><circle class="packet" r="3"><animateMotion dur="${2+j*.2}s" repeatCount="indefinite" path="M ${x} ${y} Q ${x} 230 450 230"/></circle>`}).join('');
 $('agent-list').innerHTML=items.map((v,j)=>`<button class="agent-row"><span class="row-number" style="--c:${colors[mi]}">${String(j+1).padStart(2,'0')}</span><span><b>${s.kind==='compute'?'主控':v.label}${v.n>1?' · 分组展示':''}</b><small>${r[1]}</small></span></button>`).join('');
 $('stage-title').textContent=s.title;$('stage-counter').textContent=`PHASE ${String(i+1).padStart(2,'0')} / ${m.stages.length}`;$('monitor-title').textContent=a.desk;$('active-count').textContent=s.kind==='compute'?'主控':s.count+' TASKS';
 $('stage-summary').textContent=r[1]+'。';
 $('collaboration-text').textContent=s.kind==='compute'?'主控汇总 · 生成下一阶段输入':s.count>1?`${s.count} 个逻辑任务 · 同阶段协作`:'单任务阶段 · 等待交接';
 $('handoff-title').textContent=m.stages[i+1]?.title||'规划交付完成';$('handoff-detail').textContent=`本阶段输出：${a.output}。${i<m.stages.length-1?'汇总后交给下一阶段。':'未通过时进入修复分支。'}`;
 $('stage').dataset.motion=a.motion;
 $('monitor-img').hidden=a.motion!=='scan';
 document.querySelector('.monitor-label').textContent=a.motion==='scan'?'SOURCE INSPECTION':'PLANNED ARTIFACT';
 document.querySelector('.monitor-caption small').textContent=a.motion==='scan'?'原始素材':'产物结构';
 $('artifact-screen').innerHTML=`<div class="artifact-symbol">${a.icon}</div><div class="artifact-bars">${Array.from({length:current().tracks[0].labels.length},()=>'<i></i>').join('')}</div>`;
 $('artifact-screen').hidden=a.motion==='scan';
 $('artifact-status').textContent=a.label;
 document.querySelectorAll('.film-track').forEach(track=>track.querySelectorAll('.clip').forEach((el,j)=>{el.className='clip state-'+a.track;el.classList.toggle('thread-b',current().id==='cdc-a-x08'&&el.dataset.slot.startsWith('B'));el.classList.toggle('jcut-entry',current().id==='cdc-a-x02'&&track.dataset.track==='1'&&j===5&&['assemble','verify'].includes(a.track));el.innerHTML=`<b>${el.dataset.slot}</b><span>${{empty:'待匹配',candidate:'候选',selected:'已选方案',align:'起止帧 ↔',assemble:'拼接',verify:'核验'}[a.track]}</span>${a.track==='align'?'<i class="trim left"></i><i class="trim right"></i>':''}`;}));
 document.querySelectorAll('.phase-step').forEach((el,j)=>el.className='phase-step'+(j===i?' active':j<i?' done':''));
 document.querySelectorAll('.agent,.agent-row').forEach(el=>el.onclick=evidence);
 }
 const pic=i%6+1;if(pic!==thumb){thumb=pic;$('monitor-img').src=photo(current(),pic)}
 $('scrub').value=Math.round(t*1000);$('progress').textContent=Math.round(t*100)+'%';$('play').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',playing?'暂停':'播放');document.querySelector('.cinema').classList.toggle('paused',!playing);if(playing)$('wires').unpauseAnimations();else $('wires').pauseAnimations();
 if(!$('comparison').hidden)$('comparison').innerHTML=current().models.map((v,j)=>{const st=v.stages[Math.min(v.stages.length-1,Math.floor(t*v.stages.length))];return `<button class="compare-card" data-model="${j}" style="--c:${colors[j]}"><h4>${v.id}</h4><div class="mini-progress"><i style="width:${t*100}%"></i></div><p>${esc(st.title)}</p><small>${st.count} 个逻辑任务 · ${v.stages.length} 个演示阶段</small></button>`}).join('');
}
document.addEventListener('click',e=>{const c=e.target.closest('[data-case]'),m=e.target.closest('[data-model]'),p=e.target.closest('[data-phase]');if(c){ci=+c.dataset.case;t=0;playing=false;setup()}if(m){mi=+m.dataset.model;t=0;playing=false;setup()}if(p){t=(+p.dataset.phase+.00001)/model().stages.length;playing=false;render()}});
$('play').onclick=()=>{if(t===1)t=0;playing=!playing;render()};$('reset').onclick=()=>{t=0;playing=true;render()};$('scrub').oninput=e=>{t=e.target.value/1000;render()};$('source-button').onclick=evidence;
$('compare').onclick=()=>{$('comparison').hidden=!$('comparison').hidden;$('compare').classList.toggle('active',!$('comparison').hidden);render()};
$('branch-toggle').onclick=()=>{$('branch-detail').hidden=!$('branch-detail').hidden};$('close-dialog').onclick=()=>$('detail').close();
$('about').onclick=()=>modal('<div class="eyebrow">ABOUT THIS ROOM</div><h2>多智能体剪辑室</h2><p>九个剪辑案例，四个模型。点击协作阶段、智能体或「规划依据」查看工作流源码。</p><p>本页展示生成的工作流规划；动画与轨道呈现计划中的协作和产物结构，不是实际执行记录。进度表示阶段顺序，不用于比较运行耗时。</p>');
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!/INPUT|SELECT|BUTTON/.test(e.target.tagName)&&!$('detail').open){e.preventDefault();$('play').click()}});
// The full workflow is primary; playback is an optional detail lens beneath it.
document.querySelector('.workspace').insertBefore(document.querySelector('.map'),document.querySelector('.room'));
document.querySelector('.map-heading').innerHTML='<h3>完整协作图 <span>ALL STAGES AT A GLANCE</span></h3><span>点击阶段查看协作与交接</span>';
document.querySelector('.monitor').insertAdjacentHTML('afterbegin','<div id="artifact-screen" hidden></div>');
document.querySelector('.film-heading').insertAdjacentHTML('afterend','<div id="artifact-status"></div>');
document.querySelector('.workspace-title').insertAdjacentHTML('afterend','<p id="case-credit"></p>');
setup();function tick(now){const dt=Math.min((now-last)/1000,.1);last=now;if(playing&&!window.__workflowPaused&&!document.hidden&&!$('detail').open){t=Math.min(1,t+dt*Number($('speed').value)/(model().stages.length*8));if(t===1)playing=false;render()}requestAnimationFrame(tick)}requestAnimationFrame(tick);
