(() => {
  'use strict';
  const A=window.ARENA, $=s=>document.querySelector(s);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fixed=n=>n.toFixed(2);
  const resources=[['arxiv','arXiv'],['code','Code'],['jiqizhixin','机器之心'],['cases','Cases']];
  $('#project-resources').replaceChildren(...resources.map(([key,label])=>{
    const href=A.links[key],item=document.createElement(href?'a':'span');
    item.className='resource-link'+(href?'':' pending');
    if(href){item.href=href;item.textContent=label+(href.startsWith('#')?' ↓':' ↗');}
    else{
      item.setAttribute('role','link');item.setAttribute('aria-disabled','true');
      const name=document.createElement('span'),status=document.createElement('small');
      name.textContent=label;status.textContent='Coming soon';item.append(name,status);
    }
    return item;
  }));
  const paperLink=$('#paper-link');
  if(A.links.arxiv){
    paperLink.href=A.links.arxiv;
    paperLink.textContent='arXiv ↗';
    paperLink.removeAttribute('aria-disabled');
  }
  $('#domainbar').innerHTML=A.domains.map(d=>`<span style="width:${100*d.n/145}%;background:${d.color}"></span>`).join('');
  $('#domains').innerHTML=A.domains.map(d=>`<article class="domain" style="--color:${d.color}"><div class="domainhead"><span>${d.key}</span><strong>${d.n}</strong></div><h3>${esc(d.name)}</h3><ul>${d.forms.map(([name,n])=>`<li><span>${esc(name)}</span><b>${n}</b></li>`).join('')}</ul></article>`).join('');
  let metric='resolved';
  const cellColor=value=>{
    const t=value/100,light=[237,240,231],dark=[49,77,60];
    const rgb=light.map((v,i)=>Math.round(v+(dark[i]-v)*t));
    const linear=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    const luminance=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
    return `background:rgb(${rgb.join(',')});color:${luminance<.179?'#fff':'#000'}`;
  };
  function renderResults(){
    const selection=$('#effort').value;
    let rows=A.rows.slice();
    if(selection==='maximum')rows=rows.filter(r=>r.effort===(r.model==='doubao'?'high':'max'));
    else if(selection==='best')rows=Object.keys(A.models).map(model=>rows.filter(r=>r.model===model).sort((a,b)=>b[metric]-a[metric])[0]);
    else if(selection!=='all')rows=rows.filter(r=>r.effort===selection);
    rows.sort((a,b)=>b[metric]-a[metric]);
    const resolved=metric==='resolved';
    $('#domain-heatmap').innerHTML=`<caption class="sr-only">${resolved?'Resolved rates (%)':'Continuous scores (0–100)'} across eight domains.</caption><thead><tr><th scope="col">Model / effort</th>${A.domains.map(d=>`<th scope="col"><abbr title="${esc(d.name)}">${d.key}</abbr></th>`).join('')}<th scope="col" class="heatmapoverall">Overall</th></tr></thead><tbody>${rows.map(r=>{
      const m=A.models[r.model],values=r[resolved?'rates':'scores'];
      return `<tr><th scope="row"><span class="modeldot" style="--color:${m.color}"></span>${esc(m.name)}<small>${m.harness} · ${r.effort}</small></th>${values.map((v,i)=>`<td style="${cellColor(v)}" title="${esc(m.name)} · ${esc(A.domains[i].name)}: ${fixed(v)}${resolved?'%':''}">${fixed(v)}</td>`).join('')}<td class="heatmapoverall" style="${cellColor(r[metric])}" title="Equal-weight domain mean">${fixed(r[metric])}</td></tr>`;
    }).join('')}</tbody>`;
  }
  document.querySelectorAll('[data-metric]').forEach(b=>b.addEventListener('click',()=>{metric=b.dataset.metric;document.querySelectorAll('[data-metric]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderResults();}));
  $('#effort').addEventListener('change',renderResults);
  renderResults();
  $('#delegation-chart').innerHTML=[['calls','Workflow calls per task',2.5],['workers','Worker invocations per Workflow',7]].map(([key,title,max])=>`<div class="delegationpanel"><h3>${title}</h3>${A.delegation.map(r=>`<div class="barrow" style="--color:${A.models[r.model].color}"><span>${esc(A.models[r.model].name)}</span><div class="bartrack" aria-hidden="true"><div class="barfill" style="width:${r[key]/max*100}%"></div></div><b>${fixed(r[key])}</b></div>`).join('')}</div>`).join('');
  $('#transfer-table').innerHTML=`<caption class="sr-only">Continuous transfer scores on 32 tasks, Table 2</caption><thead><tr><th rowspan="2" scope="col">Execution model</th><th scope="colgroup">Self</th><th colspan="2" scope="colgroup">GPT-6 Astra source</th><th colspan="2" scope="colgroup">Claude Opus 5.5 source</th></tr><tr><th scope="col">Dynamic</th><th scope="col">Static</th><th scope="col">Dynamic</th><th scope="col">Static</th><th scope="col">Dynamic</th></tr></thead><tbody>${A.transfer.map(r=>{const keys=['self','astraStatic','astraDynamic','opusStatic','opusDynamic'],max=Math.max(...keys.map(k=>r[k]));return `<tr><th scope="row">${esc(A.models[r.model].name)}</th>${keys.map(k=>{const gain=r[k]-r.self;return `<td class="${r[k]===max?'bestcell':''}">${fixed(r[k])}${k==='self'?'':`<span class="gain ${gain<0?'negative':''}" aria-label="${gain>=0?'gain':'change'} versus self">${gain>=0?'+':'−'}${fixed(Math.abs(gain))}</span>`}</td>`;}).join('')}</tr>`;}).join('')}</tbody>`;
  const motionButton=$('#toggle-case-motion');
  const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  function setCaseMotion(on){
    document.querySelectorAll('.spawn-clip img').forEach(img=>{img.src=on?img.dataset.gif:img.dataset.poster;});
    motionButton.setAttribute('aria-pressed',String(on));
    motionButton.textContent=on?'Pause animations':'Play animations';
  }
  motionButton.addEventListener('click',()=>setCaseMotion(motionButton.getAttribute('aria-pressed')!=='true'));
  motionPreference.addEventListener('change',e=>setCaseMotion(!e.matches));
  setCaseMotion(!motionPreference.matches);
  $('#copy-citation').addEventListener('click',async()=>{
    const text=$('#bibtex').textContent;
    try{await navigator.clipboard.writeText(text);$('#copy-status').textContent='Copied';}
    catch{const range=document.createRange();range.selectNodeContents($('#bibtex'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);$('#copy-status').textContent='Citation selected. Press Ctrl+C or ⌘C to copy.';}
  });
})();
