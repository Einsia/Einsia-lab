window.renderWorkflow=function(key){
 const NS='http://www.w3.org/2000/svg',el=(tag,attrs={},text)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;return n;};
 const host=document.createElement('section');host.className='workflow-overview';host.setAttribute('aria-label','完整智能体工作流网络');host.innerHTML='<div class="workflow-heading"><div><span>协作网络</span><i>WORKFLOW TOPOLOGY</i></div><div class="network-tools"><small>每个节点，一位智能体</small><button type="button" data-zoom="out" aria-label="缩小网络">−</button><button type="button" data-zoom="in" aria-label="放大网络">＋</button><button type="button" data-zoom="fit">重置</button></div></div><div class="network-scroll" tabindex="0" aria-label="智能体网络，可横向滚动"><div class="network-canvas"></div></div><div class="network-foot"><span><i></i> 建造阶段 · 当前 3D 回放</span><span class="network-detail">横向滚动查看完整网络</span></div>';
 const canvas=host.querySelector('.network-canvas'),scroll=host.querySelector('.network-scroll');
 const W=1440,H=key==='cc'?1440:1120,svg=el('svg',{viewBox:`0 0 ${W} ${H}`,role:'group','aria-label':key==='cc'?'CC：18 位智能体的工作流网络':'Astra：10 位智能体的工作流网络'});canvas.append(svg);
 const defs=el('defs');defs.innerHTML='<pattern id="network-grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#243e34" opacity=".10"/></pattern><filter id="network-glow"><feGaussianBlur stdDeviation="2.5"/></filter>';svg.append(defs,el('rect',{width:W,height:H,fill:'url(#network-grid)'}));
 const nodes=[],edges=[],add=(id,title,x,y,kind='agent',sub='')=>{nodes.push({id,title,x,y:y*1.6,kind,sub});return id;},link=(a,b,route)=>edges.push({a,b,route});
 const phase=(text,x,y)=>svg.append(el('text',{x,y:y*1.6,class:'network-phase'},text));
 const zone=el('rect',{x:341,y:62.4,width:350,height:key==='cc'?929.6:809.6,rx:16,class:'network-build-zone'});svg.append(zone);phase('CONSTRUCTION',365,69);svg.append(el('text',{x:365,y:144,class:'network-zone-caption'},'建造阶段 / 当前 3D 回放'));
 if(key==='cc'){
 const data=window.WORKFLOW_CC;const event=(id,x,y)=>{const e=data.find(e=>e.id===id);add(id,e.name,x,y,e.kind==='build'?'build':id.includes('agent')?'agent':'system',e.kind==='build'?'建造智能体':e.kind);};
 phase('PLAN & FOUNDATION',36,40);phase('ASSEMBLY & REVIEW',760,40);phase('REFINEMENT & DELIVERY',36,695);
 event('planning',70,310);event('001/agent-0001',230,310);link('planning','001/agent-0001');
 const ys=[139,208,277,346,415,484,553];for(let i=2;i<=8;i++)event('001/agent-'+String(i).padStart(4,'0'),512,ys[i-2]);
 for(let i=2;i<=8;i++)link('001/agent-0001','001/agent-'+String(i).padStart(4,'0'));

 event('001/agent-0009',790,310);event('001/agent-0010',1005,310);for(let i=2;i<=8;i++)link('001/agent-'+String(i).padStart(4,'0'),'001/agent-0009');link('001/agent-0009','001/agent-0010');
 [11,12,13].forEach((i,j)=>{const id='001/agent-'+String(i).padStart(4,'0');event(id,1250,208+j*105);link('001/agent-0010',id);});
 const tail=['001/agent-0014','001/agent-0015','002/agent-0001','002/agent-0002','002/agent-0003','continuation','grading'];tail.forEach((id,i)=>event(id,80+i*211,775));[11,12,13].forEach(i=>link('001/agent-'+String(i).padStart(4,'0'),tail[0],'return'));tail.slice(1).forEach((id,i)=>link(tail[i],id));
 }else{
 phase('FOUNDATION & DRAWINGS',36,40);phase('INTEGRATION & DELIVERY',760,40);
 add('planning','任务规划',80,300,'system');add('001/agent-0001','基础场景与公共构件',235,120);link('planning','001/agent-0001');
 const names=['轴线殿堂 / 门楼','配殿 / 东西碑亭','廊道 / 御道','桥梁 / 石狮 / 礼器'];
 names.forEach((name,i)=>{const spec='001/agent-'+String(i+2).padStart(4,'0'),build='001/agent-'+String(i+6).padStart(4,'0'),y=220+i*92;add(spec,'图纸规格 · '+['轴线','配殿','廊道','器物'][i],235,y);add(build,name,515,y,'build');link('planning',spec);link(spec,build);link('001/agent-0001',build);});
 add('001/agent-0010','场景总装与验证',830,340);for(let i=6;i<=9;i++)link('001/agent-'+String(i).padStart(4,'0'),'001/agent-0010');add('continuation','场景检查 / 最终交付',1080,340,'system');add('grading','独立评分 · 73.86',1310,340,'system');link('001/agent-0010','continuation');link('continuation','grading');
 svg.append(el('text',{x:760,y:928,class:'network-note'},'基础场景与四组图纸规格并行准备，再分组建造、集成与交付。'));
 }
 const edgeLayer=el('g',{'aria-hidden':'true'});svg.append(edgeLayer);
 edges.forEach(({a,b,route},i)=>{const s=nodes.find(n=>n.id===a),t=nodes.find(n=>n.id===b);let d;if(route==='return')d=`M ${s.x} ${s.y+18} C ${s.x} 1041.6 ${s.x} 1041.6 710 1041.6 S 80 1041.6 80 ${t.y-23}`;else if(route==='build')d=`M ${s.x+19} ${s.y} C ${s.x+140} ${s.y} ${t.x+140} ${t.y} ${t.x+19} ${t.y}`;else d=`M ${s.x+19} ${s.y} C ${s.x+(t.x-s.x)*.5} ${s.y} ${s.x+(t.x-s.x)*.5} ${t.y} ${t.x-19} ${t.y}`;
 const path=el('path',{id:'network-edge-'+i,d,class:'network-edge'+(s.kind==='build'||t.kind==='build'?' touches-build':'')});edgeLayer.append(path);const pulse=el('path',{d,class:'network-flow',pathLength:100,style:`animation-delay:-${i*.23}s`});edgeLayer.append(pulse);
 });
 const layer=el('g');svg.append(layer);
 nodes.forEach(n=>{const agent=n.id.includes('agent-'),label=agent?'AGENT '+n.id.replace('001/','').replace('002/','R2 · ').replace('agent-00',''):n.id==='grading'?'EVALUATION':'ORCHESTRATOR',g=el('g',{transform:`translate(${n.x} ${n.y})`,class:'network-agent '+(n.kind==='build'?'is-build':agent?'':'is-system'),tabindex:0,role:'button','aria-label':label+' · '+n.title});
 g.append(el('circle',{r:32,class:'network-orbit'}),el('circle',{r:23,class:'network-core'}));if(agent){g.append(el('circle',{cy:-6,r:5.5,class:'network-person'}),el('path',{d:'M -10 10 Q -10 0 0 0 Q 10 0 10 10',class:'network-person-body'}));}else g.append(el('path',{d:n.id==='grading'?'M -7 0 L -2 5 L 8 -6':'M 0 -7 L 7 0 L 0 7 L -7 0 Z',class:'network-symbol'}));
 g.append(el('text',{y:-43,'text-anchor':'middle',class:'network-agent-id'},label),el('text',{y:46,'text-anchor':'middle',class:'network-agent-title'},n.title));
 const activate=()=>{if(n.kind==='build'){const target=document.querySelector('[data-agent="'+n.id+'"]');if(target)target.click();document.querySelector('.stage').scrollIntoView({behavior:'smooth',block:'center'});}};g.addEventListener('click',activate);g.addEventListener('keydown',e=>{if(e.key==='Enter')activate();});layer.append(g);
 });
 layer.querySelectorAll('.network-agent-title').forEach(t=>{const text=t.textContent;if(text.length>12 && +t.parentNode.getAttribute("transform").split(" ")[1].replace(")","")>1100){t.textContent='';t.append(el('tspan',{x:0},text.slice(0,9)),el('tspan',{x:0,dy:22},text.slice(9)));}});
 document.querySelector('.story').after(host);let scale=1;const zoom=()=>{canvas.style.width=(Math.max(scroll.clientWidth,1440)*scale)+'px';};zoom();host.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.zoom==='fit'){scale=1;zoom();}else{scale=Math.max(.85,Math.min(1.8,scale+(b.dataset.zoom==='in'?.2:-.2)));zoom();}}));
};
