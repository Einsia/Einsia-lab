type Task = { id:string; title:string; partition:string; category:string; images:string[] };
type Category = { id:string; name:string; description:string; example:string };
const data = JSON.parse(document.querySelector('#vcb-explorer-data')!.textContent!) as {tasks:Task[];categories:Category[];assetBase:string;repo:string};
const get = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const picker = get<HTMLSelectElement>('task-picker');
const image = get<HTMLImageElement>('task-image');
const prev = get<HTMLButtonElement>('image-prev');
const next = get<HTMLButtonElement>('image-next');
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-category]'));
let task = data.tasks.find(t=>t.id==='prism-camera')!;
let page = 0;
function renderImage() {
  const url = data.assetBase + task.images[page];
  image.src = url;
  image.alt = `${task.title}: original puzzle drawing, page ${page+1} of ${task.images.length}`;
  const link = get<HTMLAnchorElement>('task-image-link');
  link.href = url;
  link.setAttribute('aria-label',`Open ${task.title} image ${page+1} in a new tab`);
  get('task-image-label').textContent = `${task.title} · ${page+1} / ${task.images.length}`;
  get<HTMLAnchorElement>('task-source').href = `${data.repo}/tree/main/tasks/${task.category}/${task.id}`;
  prev.disabled = page===0;
  next.disabled = page===task.images.length-1;
}
function activateCategory(id:string) {
  const category = data.categories.find(c=>c.id===id)!;
  tabs.forEach(tab=>{ const selected=tab.dataset.category===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1; });
  get('task-panel').setAttribute('aria-labelledby',`category-${id}`);
  get('category-name').textContent = category.name;
  get('category-description').textContent = category.description;
  picker.replaceChildren(...data.tasks.filter(t=>t.partition===id).map(t=>new Option(t.title,t.id)));
  picker.value=category.example;
  task=data.tasks.find(t=>t.id===category.example)!;
  page=0;renderImage();
}
tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>activateCategory(tab.dataset.category!));
  tab.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    activateCategory(tabs[index].dataset.category!);tabs[index].focus();
  });
});
picker.addEventListener('change',()=>{task=data.tasks.find(t=>t.id===picker.value)!;page=0;renderImage();});
prev.addEventListener('click',()=>{if(page>0){page--;renderImage();}});
next.addEventListener('click',()=>{if(page<task.images.length-1){page++;renderImage();}});
document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  document.querySelectorAll<HTMLElement>('[data-step-panel]').forEach(panel=>panel.hidden=panel.dataset.stepPanel!==button.dataset.step);
}));
