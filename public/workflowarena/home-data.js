// Reported results from the supplied November 10, 2026 paper.
// Resolved: Table 1; continuous: Table 6; transfer: Table 2; catalogue: Table 3.
// Column order: overall, SWE, OPS, SCI, MATH, FIN, LAW, CDN, 3D.
window.ARENA = (() => {
  const models = {
    opus: {name:'Claude Opus 5.5', harness:'Claude Code', color:'#b9623e'},
    sonnet: {name:'Claude Sonnet 5.5', harness:'Claude Code', color:'#cd9239'},
    astra: {name:'GPT-6 Astra', harness:'Codex', color:'#4879ad'},
    sol: {name:'GPT-6.1 Sol', harness:'Codex', color:'#388c8a'},
    kimi: {name:'Kimi K3.1 Pro', harness:'Claude Code', color:'#8b70a5'},
    luna: {name:'GPT-6 Luna', harness:'Codex', color:'#6c93aa'},
    doubao: {name:'Doubao-Seed-Evolving', harness:'Claude Code', color:'#829750'},
    glm: {name:'GLM-5.3 Flash', harness:'Claude Code', color:'#8b8579'},
    deepseek: {name:'DeepSeek V4.1 Flash', harness:'Claude Code', color:'#6776a7'}
  };
  const domains = [
    {key:'SWE',name:'Software & systems',n:17,color:'#7d9cbd',forms:[['Feature implementation',11],['Subsystem reimplementation',6]]},
    {key:'OPS',name:'Enterprise operations',n:18,color:'#d4a174',forms:[['Policy-constrained process execution',6],['Cross-system business orchestration',6],['Multi-party information coordination',6]]},
    {key:'SCI',name:'Science',n:16,color:'#91ab87',forms:[['Blind predictive modeling',8],['Published result reproduction',8]]},
    {key:'MATH',name:'Formal mathematics',n:24,color:'#ac9ac4',forms:[['Formal proof construction',16],['Formal API development',8]]},
    {key:'FIN',name:'Finance',n:16,color:'#d0af61',forms:[['Cross-filing peer analysis',10],['Multi-entity consolidation and audit',6]]},
    {key:'LAW',name:'Law',n:22,color:'#b6a18f',forms:[['Contract portfolio analysis',13],['Multi-party case adjudication',9]]},
    {key:'CDN',name:'Content design',n:14,color:'#c58f8c',forms:[['Narrative video assembly',8],['Presentation and document design',6]]},
    {key:'3D',name:'3D production',n:18,color:'#86aca8',forms:[['3D scene construction',10],['3D narrative short film',8]]}
  ];
  const continuous = [
    ['opus','high',80.21,96.98,54.94,87.97,97.44,81.69,74.36,79.72,68.60],
    ['opus','max',79.94,79.26,52.91,94.71,95.83,87.79,74.63,82.60,71.82],
    ['opus','xhigh',78.77,91.10,50.03,82.03,97.67,84.29,74.64,83.13,67.27],
    ['astra','xhigh',77.69,74.24,62.65,82.18,96.96,84.01,73.58,81.86,66.05],
    ['sol','xhigh',77.52,76.11,65.68,82.21,95.35,85.02,71.10,81.65,63.05],
    ['astra','max',77.29,74.67,64.97,78.78,97.20,82.30,73.30,80.14,66.93],
    ['sol','max',76.50,71.19,72.97,79.76,95.36,77.43,71.36,77.66,66.28],
    ['astra','high',76.47,77.85,64.84,78.74,95.84,80.92,70.64,79.08,63.87],
    ['sol','low',76.32,78.43,62.06,82.43,91.02,82.05,70.91,80.84,62.85],
    ['astra','medium',76.12,76.09,64.02,77.46,92.63,83.00,71.01,80.04,64.67],
    ['sol','high',76.11,76.16,66.58,79.47,94.71,81.33,70.79,76.25,63.56],
    ['sol','medium',74.87,76.82,63.98,78.57,88.06,75.57,72.72,80.38,62.84],
    ['opus','medium',74.39,84.86,53.04,86.26,77.63,80.94,72.26,77.50,62.63],
    ['astra','low',74.02,71.64,63.28,77.82,83.11,80.05,71.99,80.88,63.42],
    ['sonnet','max',73.11,73.35,52.45,84.31,90.39,70.23,61.84,80.97,71.32],
    ['opus','low',72.44,84.50,45.70,79.14,72.44,77.59,73.87,78.61,67.62],
    ['sonnet','high',70.15,69.87,45.61,77.36,79.58,70.71,71.61,79.80,66.61],
    ['sonnet','xhigh',70.00,80.18,37.95,82.11,81.00,58.01,73.75,81.79,65.18],
    ['sonnet','medium',63.90,67.96,43.01,72.45,70.56,49.67,71.40,74.33,61.82],
    ['sonnet','low',63.71,60.37,45.57,68.78,70.76,62.20,70.16,73.71,58.11],
    ['kimi','max',62.73,52.79,50.35,74.10,54.37,67.26,74.14,76.94,51.86],
    ['luna','max',55.44,51.66,34.36,66.87,36.55,68.50,66.24,76.20,43.12],
    ['doubao','high',48.66,35.87,52.73,63.68,4.07,55.12,70.29,66.47,41.04],
    ['glm','max',39.03,25.75,50.60,54.99,7.61,57.13,63.90,21.56,30.71],
    ['deepseek','max',34.48,34.45,43.48,52.25,10.36,46.81,56.28,0.00,32.25]
  ];
  const resolved = [
    ['opus','max',36.95,29.41,22.22,56.25,95.83,12.50,0.00,57.14,22.22],
    ['opus','high',34.11,17.65,16.67,50.00,87.50,18.75,4.55,50.00,27.78],
    ['opus','xhigh',33.23,11.76,16.67,43.75,91.67,12.50,4.55,57.14,27.78],
    ['sonnet','max',33.21,11.76,11.11,50.00,79.17,12.50,9.09,64.29,27.78],
    ['astra','xhigh',30.80,0.00,22.22,50.00,83.33,12.50,4.55,57.14,16.67],
    ['astra','high',29.82,0.00,27.78,43.75,83.33,12.50,4.55,50.00,16.67],
    ['sol','xhigh',29.50,0.00,16.67,43.75,79.17,12.50,4.55,57.14,22.22],
    ['opus','medium',29.14,11.76,16.67,50.00,70.83,18.75,0.00,42.86,22.22],
    ['astra','medium',28.11,0.00,16.67,43.75,79.17,12.50,4.55,57.14,11.11],
    ['sol','max',28.04,0.00,22.22,43.75,83.33,12.50,4.55,35.71,22.22],
    ['astra','low',27.80,5.88,16.67,43.75,70.83,12.50,4.55,57.14,11.11],
    ['sol','low',27.59,0.00,16.67,43.75,75.00,12.50,4.55,57.14,11.11],
    ['astra','max',27.34,0.00,22.22,43.75,83.33,12.50,4.55,35.71,16.67],
    ['sol','medium',27.30,0.00,11.11,43.75,79.17,18.75,4.55,50.00,11.11],
    ['sol','high',25.63,0.00,22.22,43.75,79.17,12.50,4.55,42.86,0.00],
    ['sonnet','high',25.26,0.00,11.11,43.75,62.50,12.50,0.00,50.00,22.22],
    ['sonnet','xhigh',23.24,0.00,11.11,43.75,70.83,6.25,0.00,42.86,11.11],
    ['opus','low',22.02,0.00,11.11,43.75,66.67,6.25,0.00,42.86,5.56],
    ['sonnet','medium',19.78,0.00,11.11,37.50,58.33,18.75,0.00,21.43,11.11],
    ['sonnet','low',16.88,0.00,5.56,37.50,54.17,6.25,4.55,21.43,5.56],
    ['kimi','max',16.48,0.00,16.67,43.75,37.50,12.50,0.00,21.43,0.00],
    ['luna','max',13.32,0.00,5.56,37.50,25.00,12.50,4.55,21.43,0.00],
    ['doubao','high',10.84,0.00,27.78,31.25,0.00,6.25,0.00,21.43,0.00],
    ['deepseek','max',6.08,0.00,11.11,25.00,0.00,12.50,0.00,0.00,0.00],
    ['glm','max',4.43,0.00,16.67,18.75,0.00,0.00,0.00,0.00,0.00]
  ];
  const rows=continuous.map(([model,effort,score,...scores])=>{const r=resolved.find(r=>r[0]===model&&r[1]===effort);return {model,effort,score,scores,resolved:r[2],rates:r.slice(3)};});
  // Fill these project URLs when they are available; an empty URL renders a disabled entry.
  const links={arxiv:'https://arxiv.org/pdf/2611.12856',code:'https://github.com/Einsia/WorkflowArena',jiqizhixin:'',cases:'cases.html'};
  return {date:'2026-11-10',links,models,domains,rows,
    delegation:[{model:'opus',calls:.86,workers:5.55},{model:'sonnet',calls:.76,workers:6.14},{model:'astra',calls:2.09,workers:1.72},{model:'sol',calls:1.94,workers:1.69}],
    transfer:[
      {model:'kimi',self:35.75,astraStatic:29.69,astraDynamic:33.80,opusStatic:45.04,opusDynamic:46.61},
      {model:'luna',self:25.08,astraStatic:24.87,astraDynamic:29.22,opusStatic:30.37,opusDynamic:25.35},
      {model:'doubao',self:20.39,astraStatic:22.07,astraDynamic:24.25,opusStatic:28.04,opusDynamic:27.46},
      {model:'deepseek',self:18.37,astraStatic:12.85,astraDynamic:17.69,opusStatic:21.79,opusDynamic:25.24}
    ]};
})();
