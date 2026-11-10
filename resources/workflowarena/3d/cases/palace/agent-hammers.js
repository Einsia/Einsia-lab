'use strict';
// Development-only scene feature. One tool per active modeling worker.
window.createAgentHammers=function(T,scene,renderer){
 const tools=new Map();let animationTime=0;
 function color(hex,factor=1){return new T.Color(hex).convertSRGBToLinear().multiplyScalar(factor);}
 // A small studio environment gives the miniature metalwork soft, broad reflections.
 const studio=new T.Scene();studio.background=new T.Color('#28312f');
 const shell=new T.Mesh(new T.SphereGeometry(12,24,16),new T.MeshBasicMaterial({color:0x434b47,side:T.BackSide}));studio.add(shell);
 const softboxes=[];for(const spec of [{p:[-4,6,4],s:[5,6],c:0xf4efe4},{p:[5,2,-3],s:[3,7],c:0xbcd0c4},{p:[0,7,-2],s:[6,2],c:0xffffff}]){const light=new T.Mesh(new T.PlaneGeometry(...spec.s),new T.MeshBasicMaterial({color:spec.c}));light.position.fromArray(spec.p);light.lookAt(0,0,0);studio.add(light);softboxes.push(light);}
 const pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.08);pmrem.dispose();studio.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
 function finish(hex,metalness=.7,roughness=.28){return new T.MeshStandardMaterial({color:color(hex),metalness,roughness,envMap:environment.texture,envMapIntensity:.8});}
 function enamel(hex){return new T.MeshBasicMaterial({color:color(hex),toneMapped:false});}
 function roundedBox(w,h,d,r=.06){const x=w/2,y=h/2,q=new T.Shape();q.moveTo(-x+r,-y);q.lineTo(x-r,-y);q.quadraticCurveTo(x,-y,x,-y+r);q.lineTo(x,y-r);q.quadraticCurveTo(x,y,x-r,y);q.lineTo(-x+r,y);q.quadraticCurveTo(-x,y,-x,y-r);q.lineTo(-x,-y+r);q.quadraticCurveTo(-x,-y,-x+r,-y);const g=new T.ExtrudeGeometry(q,{depth:d,bevelEnabled:true,bevelThickness:.025,bevelSize:.023,bevelSegments:3,steps:1,curveSegments:6});g.translate(0,0,-d/2);return g;}
 function make(event,hex){
  const root=new T.Group(),pivot=new T.Group();root.add(pivot);pivot.position.set(1.15,.15,0);pivot.rotation.y=-.34;
  const titanium=finish('#b5c5bd',.88,.25),darkMetal=finish('#283e37',.72,.34),paint=finish(hex,.6,.3),rubber=finish('#172d24',.05,.8),inlay=enamel(hex);
  const shaft=new T.Mesh(new T.LatheGeometry([new T.Vector2(.075,.12),new T.Vector2(.09,.32),new T.Vector2(.07,.9),new T.Vector2(.1,1.08)],20),darkMetal);pivot.add(shaft);
  const grip=new T.Mesh(new T.CylinderGeometry(.108,.12,.44,24),rubber);grip.position.y=.28;pivot.add(grip);
  // Fine machined rings and a small colored heel make the handle legible in motion.
  for(let i=0;i<6;i++){const ring=new T.Mesh(new T.TorusGeometry(.111,.008,5,24),darkMetal);ring.rotation.x=Math.PI/2;ring.position.y=.095+i*.064;pivot.add(ring);}
  const heel=new T.Mesh(new T.CylinderGeometry(.121,.105,.065,24),titanium);heel.position.y=.035;pivot.add(heel);
  const heelInlay=new T.Mesh(new T.TorusGeometry(.118,.009,6,24),inlay);heelInlay.rotation.x=Math.PI/2;heelInlay.position.y=.065;pivot.add(heelInlay);
  const collar=new T.Mesh(new T.CylinderGeometry(.13,.09,.18,20),titanium);collar.position.y=1.005;pivot.add(collar);
  const head=new T.Mesh(roundedBox(1.02,.32,.36,.065),paint);head.name='agent-hammer-head';head.position.y=1.18;pivot.add(head);
  // Recessed front and back plates, colored inlays, and steel striking faces.
  for(const z of [-.218,.218]){const recess=new T.Mesh(roundedBox(.62,.18,.012,.035),inlay);recess.position.set(0,1.18,z);pivot.add(recess);const strip=new T.Mesh(roundedBox(.22,.018,.016,.007),titanium);strip.position.set(0,1.18,z+Math.sign(z)*.019);pivot.add(strip);
   for(const x of [-.24,.24]){const bolt=new T.Mesh(new T.CylinderGeometry(.023,.023,.012,8),titanium);bolt.rotation.x=Math.PI/2;bolt.position.set(x,1.18,z+Math.sign(z)*.018);pivot.add(bolt);}}
  for(const x of [-.57,.57]){const shoulder=new T.Mesh(roundedBox(.09,.31,.36,.045),darkMetal);shoulder.position.set(x,1.18,0);pivot.add(shoulder);const face=new T.Mesh(roundedBox(.095,.34,.39,.065),titanium);face.position.set(x+Math.sign(x)*.065,1.18,0);pivot.add(face);const seam=new T.Mesh(roundedBox(.018,.28,.34,.04),inlay);seam.position.set(x-Math.sign(x)*.018,1.18,0);pivot.add(seam);}
  const impact=new T.Group();impact.position.copy(new T.Vector3(-.69,1.18,0).applyEuler(new T.Euler(0,-.34,.7)).add(pivot.position));root.add(impact);const flashMat=new T.LineBasicMaterial({color:color(hex),transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  const vertices=[];for(let i=0;i<5;i++){const angle=(i*1.29+.35);vertices.push(Math.cos(angle)*.13,Math.sin(angle)*.13,0,Math.cos(angle)*(.29+i%2*.09),Math.sin(angle)*(.29+i%2*.09),0);}
  const rays=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(vertices,3)),flashMat);impact.add(rays);
  const haloMat=new T.MeshBasicMaterial({color:color(hex),transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false,toneMapped:false});const halo=new T.Mesh(new T.RingGeometry(.13,.143,48),haloMat);impact.add(halo);
  scene.add(root);return{event,root,pivot,impact,flashMat,haloMat,hex,anchorUnit:null,phase:0,style:'beveled-titanium-and-enamel'};
 }
 function dispose(tool){scene.remove(tool.root);const materials=new Set();tool.root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});materials.forEach(m=>m.dispose());}
 function update({dt,time,playing,hover,reducedMotion,camera,viewportHeight,events,models,representative,surfaceAnchor,agentColor}){
  const live=events.filter(e=>e.start<=time&&time<e.end),liveIds=new Set(live.map(e=>e.id));
  for(const [id,tool]of tools)if(!liveIds.has(id)){dispose(tool);tools.delete(id);}
  if(playing&&!hover&&!reducedMotion)animationTime+=dt;
  for(const event of live){const uid=representative(event),source=models.get(uid);if(!source)continue;let tool=tools.get(event.id);if(!tool){tool=make(event,agentColor(event));tools.set(event.id,tool);}
   const anchor=surfaceAnchor(source);tool.root.position.copy(anchor);tool.root.quaternion.copy(camera.quaternion);tool.anchorUnit=uid;tool.pivot.traverse(o=>{if(o.isMesh){o.userData.uid=uid;o.userData.hammerAgent=event.id;}});
   // Keep the small tools readable as the visitor zooms or rotates the scene.
   const distance=camera.position.distanceTo(anchor),unitsPerPixel=2*distance*Math.tan(camera.fov*Math.PI/360)/Math.max(viewportHeight,1);tool.root.scale.setScalar(T.MathUtils.clamp(unitsPerPixel*19,8,23));
   const index=events.indexOf(event),phase=reducedMotion?.2:(animationTime*.92+index*.16)%1;tool.phase=phase;
   // A continuous wall-facing stroke: the hammerhead stays above the grip
   // throughout the swing, and the striking face contacts on the upper arc.
   // Slow recovery, accelerating downswing, a crisp contact stop, then recoil.
   if(phase<.64){const u=phase/.64;tool.pivot.rotation.z=.54-1.19*(u*u*(3-2*u));}
   else if(phase<.84){const u=(phase-.64)/.2;tool.pivot.rotation.z=-.65+1.35*u*u*u;}
   else if(phase<.87){tool.pivot.rotation.z=.7;}
   else{const u=(phase-.87)/.13;tool.pivot.rotation.z=.7-.16*(1-Math.pow(1-u,3));}
   const strike=phase>=.84&&phase<.98?(phase-.84)/.14:-1,selected=hover&&event.units.includes(hover),opacity=hover&&!selected?.3:1;
   tool.root.visible=true;tool.root.traverse(o=>{if(o.material&&o!==tool.impact.children[0]&&o!==tool.impact.children[1]){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=opacity<1;m.opacity=opacity;}}});
   tool.flashMat.opacity=strike>=0?(1-strike)*.8*opacity:0;tool.haloMat.opacity=strike>=0?(1-strike)*.45*opacity:0;tool.impact.scale.setScalar(strike>=0?.7+strike*2:1);
  }
 }
 return{update,tools,pickables(){return [...tools.values()].flatMap(tool=>tool.pivot.children.filter(o=>o.isMesh));},get time(){return animationTime;}};
};

