import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function initializeObjects() {
  const hosts = [...document.querySelectorAll<HTMLElement>('[data-object-viewer]')];
  const decoder = new DRACOLoader().setDecoderPath(hosts[0]?.dataset.decoder || '').setDecoderConfig({type:'wasm'}).setWorkerLimit(2);
  const loader = new GLTFLoader().setDRACOLoader(decoder);
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { observer.unobserve(entry.target); void load(entry.target as HTMLElement); } });
  }, {rootMargin:'100px'});
  const jobs = new Map<HTMLElement, Promise<void>>();
  const openDialog = document.createElement('dialog');
  openDialog.className = 'f3-object-dialog';
  openDialog.setAttribute('aria-label','Interactive 3D preview');
  document.body.append(openDialog);
  let active: {host:HTMLElement; marker:Comment; focus:HTMLElement|null}|null=null;
  openDialog.addEventListener('close',()=>{
    if (!active) return;
    active.marker.replaceWith(active.host); active.host.classList.remove('is-expanded');
    active.focus?.focus(); active=null; openDialog.replaceChildren();
  });
  openDialog.addEventListener('click',event=>{if(event.target===openDialog) openDialog.close();});
  function expand(host:HTMLElement) {
    const marker=document.createComment('3d viewer');
    active={host,marker,focus:document.activeElement as HTMLElement};
    host.replaceWith(marker);host.classList.add('is-expanded');
    const close=document.createElement('button');close.className='f3-object-close';close.textContent='×';close.setAttribute('aria-label','Close 3D preview');close.onclick=()=>openDialog.close();
    const title=document.createElement('p');title.className='f3-object-dialog-title';title.textContent=host.dataset.label!;
    openDialog.append(title,close,host);openDialog.showModal();close.focus();
  }
  function load(host:HTMLElement):Promise<void> {
    const prior=jobs.get(host);if(prior) return prior;
    const job=mount(host).catch(()=>{
      jobs.delete(host);host.dataset.state='error';
      const button=host.querySelector<HTMLButtonElement>('.f3-object-load')!;
      button.hidden=false;button.disabled=false;button.textContent='Retry 3D';
      host.querySelector<HTMLElement>('.f3-object-status')!.textContent='3D preview could not load.';
    });
    jobs.set(host,job);return job;
  }
  async function mount(host:HTMLElement) {
    const stage=host.querySelector<HTMLElement>('.f3-object-stage')!;
    const button=host.querySelector<HTMLButtonElement>('.f3-object-load')!;
    const status=host.querySelector<HTMLElement>('.f3-object-status')!;
    host.dataset.state='loading';button.disabled=true;button.textContent='Loading 3D…';status.textContent='';
    // Allocate a WebGL context only after a valid asset is available.
    const gltf=await loader.loadAsync(host.dataset.modelSrc!);
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
    const scene=new THREE.Scene();
    const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();
    const environment=pmrem.fromScene(room,0.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
    // Batch static primitives by material without changing their geometry.
    gltf.scene.updateMatrixWorld(true);
    const object=new THREE.Group();
    const batches=new Map<string,{material:THREE.Material;geometries:THREE.BufferGeometry[]}>();
    gltf.scene.traverse((node:any)=>{
      if(!node.isMesh) return;
      if(node.isSkinnedMesh || Array.isArray(node.material) || node.matrixWorld.determinant()<0) {
        const clone=node.clone();clone.applyMatrix4(node.parent?.matrixWorld || new THREE.Matrix4());object.add(clone);return;
      }
      let geometry=node.geometry.clone();
      if(geometry.index){const indexed=geometry;geometry=geometry.toNonIndexed();indexed.dispose();}
      geometry.applyMatrix4(node.matrixWorld);
      const signature=Object.entries(geometry.attributes).map(([k,a]:any)=>`${k}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join('|');
      const key=node.material.uuid+signature;
      if(!batches.has(key))batches.set(key,{material:node.material,geometries:[]});
      batches.get(key)!.geometries.push(geometry);
    });
    batches.forEach(({material,geometries})=>{
      const merged=mergeGeometries(geometries,false);
      if(merged){object.add(new THREE.Mesh(merged,material));geometries.forEach(g=>g.dispose());}
      else geometries.forEach(g=>object.add(new THREE.Mesh(g,material)));
    });
    const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
    const span=Math.max(size.x,size.y,size.z);
    if(!Number.isFinite(span)||span<=0) {renderer.dispose();throw new Error('Empty geometry');}
    const center=bounds.getCenter(new THREE.Vector3());
    object.position.sub(center);const pivot=new THREE.Group();pivot.add(object);pivot.scale.setScalar(2/span);scene.add(pivot);
    const camera=new THREE.PerspectiveCamera(35,1,.01,100);
    const initial=new THREE.Vector3(2.42,1.72,2.96);camera.position.copy(initial);
    const controls=new OrbitControls(camera,stage);
    controls.enableDamping=false;controls.enablePan=false;controls.minDistance=1.5;controls.maxDistance=12;
    controls.target.set(0,0,0);controls.update();controls.saveState();
    scene.add(new THREE.HemisphereLight(0xffffff,0x8a9790,1.5));
    const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(4,6,5);scene.add(key);
    stage.replaceChildren(renderer.domElement);
    let frame=0,disposed=false;
    function render(){if(frame||disposed) return;frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});}
    function resize(){const {width,height}=stage.getBoundingClientRect();if(width<1||height<1)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();render();}
    const ro=new ResizeObserver(resize);ro.observe(stage);controls.addEventListener('change',render);
    function zoom(factor:number){camera.position.multiplyScalar(factor).clampLength(controls.minDistance,controls.maxDistance);controls.update();render();}
    function rotate(theta:number,phi:number){const spherical=new THREE.Spherical().setFromVector3(camera.position);spherical.theta+=theta;spherical.phi=Math.max(.1,Math.min(Math.PI-.1,spherical.phi+phi));camera.position.setFromSpherical(spherical);controls.update();render();}
    stage.addEventListener('keydown',event=>{
      const keys:Record<string,()=>void>={ArrowLeft:()=>rotate(-.15,0),ArrowRight:()=>rotate(.15,0),ArrowUp:()=>rotate(0,-.15),ArrowDown:()=>rotate(0,.15),'+':()=>zoom(.85),'=':()=>zoom(.85),'-':()=>zoom(1.15),r:()=>controls.reset(),R:()=>controls.reset()};
      if(keys[event.key]){event.preventDefault();keys[event.key]();}
    });
    host.querySelectorAll<HTMLButtonElement>('[data-view-action]').forEach(b=>b.addEventListener('click',()=>{
      if(b.dataset.viewAction==='in') zoom(.85);
      if(b.dataset.viewAction==='out') zoom(1.15);
      if(b.dataset.viewAction==='reset') controls.reset();
      if(b.dataset.viewAction==='expand') {if(openDialog.open) openDialog.close();else expand(host);}
    }));
    resize();renderer.render(scene,camera);
    host.dataset.state='ready';button.hidden=true;host.querySelector<HTMLElement>('.f3-object-tools')!.hidden=false;
    host.querySelector<HTMLElement>('.f3-object-poster')!.hidden=true;
    // Release resources on navigation; preserve them if the page enters the back/forward cache.
    window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;cancelAnimationFrame(frame);ro.disconnect();controls.dispose();environment.dispose();renderer.dispose();},{once:true});
  }
  hosts.forEach(host=>{
    host.querySelector('img')?.addEventListener('click',event=>event.stopImmediatePropagation());
    host.querySelector('button')!.addEventListener('click',()=>void load(host));observer.observe(host);
  });
}
