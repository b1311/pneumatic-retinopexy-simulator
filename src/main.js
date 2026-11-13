import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import { solveBubble, flatCapLevel, arcDegrees, makeKinetics, gasOption, gasDensity, GASES, REFERENCE_FILL, DISAPPEARANCE_FILL } from './physics.js';

const state={fill:35,gas:'SF6',concentration:30,lens:'Phakic',durationDays:18,elapsedDays:0,laterality:'Right',posture:0,tilt:0,iop:15,sigma:0.060,contact:39,bubbleOpacity:.72,opacity:.22,tearEnabled:false,tearClock:12,tearAnterior:45,tears:[{clock:12,anterior:45}],activeTear:0,labels:true,vessels:true,section:false};
// Gas data, sources and kinetics live in physics.js. Visual disappearance is 1% of the cavity.
const disappearanceFill=DISAPPEARANCE_FILL*100;
const cavityRadius=10.55,cavityVolume=4/3*Math.PI*cavityRadius**3;
document.querySelector('#app').innerHTML=`<div class="shell"><aside class="panel">
  <div class="brand"><span class="brand-mark">◉</span> Ophthalmic physics lab</div><h1>Pneumatic retinopexy simulator</h1><p class="lede">Explore how gas volume, posture and interfacial forces determine retinal tamponade.</p>
  <div class="section"><div class="section-title">Gas & volume <span>01</span></div>
    ${slider('fill','Current gas fill','%',0,100,1)}
    <div class="field"><div class="field-head"><span>Gas agent</span></div><select id="gas"><option>Air</option><option selected>SF6</option><option>C2F6</option><option>C3F8</option></select></div>
    <div class="field" id="concentrationField"><div class="field-head"><span>Gas concentration</span><span class="value" id="concentrationVal">30%</span></div><select id="concentration"></select></div>
    <div class="field"><div class="field-head"><span>Lens status</span></div><select id="lens"><option selected>Phakic</option><option>Pseudophakic</option><option>Aphakic</option></select></div>
    <div class="field"><div class="field-head"><span>Eye</span></div><select id="laterality"><option selected>Right</option><option>Left</option></select></div>
  </div>
  <div class="section kinetics"><div class="section-title">Gas kinetics <span>02</span></div>
    ${slider('elapsedDays','Time from now','days',0,90,.5)}
    ${slider('durationDays','Duration of a 90% fill','days',3,100,.5)}<p class="model-note" id="durationSource"></p>
    <div class="kinetics-grid"><div><span>Estimated fill</span><strong id="predictedFill">--</strong></div><div><span>First halving (model)</span><strong id="halfLife">--</strong></div><div><span>Remaining</span><strong id="remainingTime">--</strong></div><div><span>Phase</span><strong id="kineticsPhase">--</strong></div></div>
    <p class="model-note evidence" id="publishedHalfLife"></p><div class="expansion-warning" id="expansionWarning" hidden></div>
    <button class="timeline-reset" id="timelineReset" type="button">Return to now</button>
    <p class="model-note">Gas is absorbed through the retina it touches, so the rate scales with contact area: large bubbles shrink slowly and small ones quickly, and no single half-life fits a bubble's whole life. The rate is set so a 90% fill clears (below ${disappearanceFill}% of the cavity) at the duration above. Pure gas first expands to its published peak.</p>
  </div>
  <div class="section"><div class="section-title">Patient orientation <span>03</span></div>
    ${slider('posture','Pitch','°',-90,90,1)}${slider('tilt','Roll','°',-90,90,1)}
    <div class="field"><div class="field-head"><span>Preset</span></div><select id="preset"><option value="0,0">Upright</option><option value="90,0">Face down</option><option value="0,-90">Left side down</option><option value="0,90">Right side down</option></select></div>
  </div>
  <div class="section"><div class="section-title">Interface physics <span>04</span></div>
    ${slider('iop','Intraocular pressure','mmHg',5,40,1)}${slider('sigma','Surface tension','mN/m',30,75,1,1000)}${slider('contact','Contact angle','°',15,80,1)}${slider('bubbleOpacity','Bubble opacity','%',10,100,1,100)}
  </div>
  <div class="section"><div class="section-title">Anatomy <span>05</span></div>
    ${toggle('labels','Anatomical labels',true)}${toggle('vessels','Retinal vasculature',true)}${toggle('section','Cutaway view',false)}${slider('opacity','Scleral opacity','%',8,55,1,100)}
  </div>
  <div class="section"><div class="section-title">Retinal tear <span>06</span></div>
    ${toggle('tearEnabled','Show retinal breaks',false)}<div class="tear-toolbar"><button id="addTear" type="button">+ Add break</button><button id="removeTear" type="button">Remove</button></div><div id="tearList" class="tear-list"></div>${slider('tearClock','Selected clock hour','h',1,12,.5)}${slider('tearAnterior','Anterior position','%',0,100,1)}
    <p class="disclaimer">Posterior = 0%; anterior near the ora = 100%. Educational visualization—not a treatment planner or medical device.</p>
  </div>
 </aside><main class="viewport"><div class="topbar"><div class="status"><span class="pill"><b>● LIVE</b></span><span class="pill">Young–Laplace equilibrium</span><span class="pill">Scale 1 unit = 1 mm</span><span class="pill" id="orient">Gravity: inferior</span></div><div class="view-controls"><button class="icon-btn fundus-btn" id="fundus" title="Toggle 2.5D fundus view">◉</button><button class="icon-btn" id="reset" title="Reset view">↺</button><button class="icon-btn" id="pause" title="Pause">Ⅱ</button></div></div><div id="scene"></div>
 <div class="readout" id="readout"><div class="read-head"><div class="read-title">Physics readout</div><button type="button" id="toggleReadout" aria-label="Minimize physics readout" aria-expanded="true">−</button></div><div class="read-body"><div class="metric key-metric"><span>Apex tamponade</span><strong id="apexLoad">—</strong></div><div class="metric key-metric"><span>Foveal tamponade</span><strong id="fovealLoad">—</strong></div><div class="metric"><span>Bubble volume</span><strong id="vol">—</strong></div><div class="metric"><span>IOP</span><strong id="iopReadout">—</strong></div><div class="metric"><span>Laplace increment</span><strong id="laplace">—</strong></div><div class="metric"><span>Bubble pressure</span><strong id="gasPressure">—</strong></div><div class="metric"><span>Bond number</span><strong id="bond">—</strong></div><div class="metric"><span>Arc of contact</span><strong id="arc">—</strong></div><div class="metric"><span>Arc, flat-cap convention</span><strong id="arcFlat">—</strong></div><div class="metric"><span>Retinal contact</span><strong id="contactArea">—</strong></div><div class="bar"><i id="coverage"></i></div></div></div><div class="hint">Drag to orbit · Scroll to zoom · Right-drag to pan</div></main></div>`;

function slider(id,label,unit,min,max,step,scale=1){return `<div class="field"><div class="field-head"><span id="${id}Label">${label}</span><span class="value" id="${id}Val">${Math.round(state[id]*scale)} ${unit}</span></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${state[id]*scale}" data-scale="${scale}" data-unit="${unit}"></div>`}
function toggle(id,label,on){return `<div class="toggle-row"><span>${label}</span><span class="toggle ${on?'on':''}" id="${id}"></span></div>`}

const holder=document.querySelector('#scene'), renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(holder.clientWidth,holder.clientHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15; holder.appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,holder.clientWidth/holder.clientHeight,.1,200);camera.position.set(31,15,30);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,0,0);controls.minDistance=25;controls.maxDistance=75;
scene.add(new THREE.HemisphereLight(0xbceadd,0x071110,2.1));const key=new THREE.DirectionalLight(0xffe1b5,3);key.position.set(15,20,18);scene.add(key);const rim=new THREE.PointLight(0x45cbaa,45,70);rim.position.set(-20,5,-10);scene.add(rim);

const eye=new THREE.Group();scene.add(eye);
const sclera=new THREE.Mesh(new THREE.SphereGeometry(12,96,64),new THREE.MeshPhysicalMaterial({color:0xa9dbcf,transparent:true,opacity:state.opacity,roughness:.22,transmission:.5,side:THREE.DoubleSide,depthWrite:false}));sclera.scale.set(1,1,1.03);eye.add(sclera);
const retina=new THREE.Mesh(new THREE.SphereGeometry(11.45,96,64,0,Math.PI*2,.22,Math.PI-.30),new THREE.MeshPhysicalMaterial({color:0xb86454,roughness:.62,side:THREE.BackSide,transparent:true,opacity:.82}));retina.scale.set(1,1,1.03);eye.add(retina);
// Cornea, iris and crystalline lens on the anterior (+Z) axis.
const cornea=new THREE.Mesh(new THREE.SphereGeometry(6.4,64,32,0,Math.PI*2,0,1.18),new THREE.MeshPhysicalMaterial({color:0x8fd7d4,transparent:true,opacity:.24,transmission:.82,roughness:.08,side:THREE.DoubleSide,depthWrite:false}));cornea.position.z=10.4;cornea.scale.z=.48;eye.add(cornea);
const iris=new THREE.Mesh(new THREE.RingGeometry(2.15,5.1,64),new THREE.MeshPhysicalMaterial({color:0x548b78,roughness:.58,side:THREE.DoubleSide}));iris.position.z=9.35;eye.add(iris);
const lens=new THREE.Mesh(new THREE.SphereGeometry(4.3,64,32),new THREE.MeshPhysicalMaterial({color:0xf2e3b8,transparent:true,opacity:.9,transmission:.2,roughness:.2,depthWrite:false,emissive:0x000000,emissiveIntensity:0}));lens.scale.z=.72;lens.position.z=7.4;eye.add(lens);
const lensContactMarker=new THREE.Mesh(new THREE.SphereGeometry(.34,28,18),new THREE.MeshStandardMaterial({color:0xffc45c,emissive:0xff7a18,emissiveIntensity:2,transparent:true,opacity:.95,depthTest:false}));lensContactMarker.visible=false;eye.add(lensContactMarker);
// The pars plana is a 3.5 mm-wide posterior ciliary-body band; the vitreous base straddles the ora.
const parsPlana=new THREE.Mesh(new THREE.CylinderGeometry(8.45,9.75,2.15,96,1,true),new THREE.MeshStandardMaterial({color:0x756a4c,transparent:true,opacity:.72,roughness:.72,side:THREE.DoubleSide}));parsPlana.rotation.x=Math.PI/2;parsPlana.position.z=5.75;eye.add(parsPlana);
const baseMat=new THREE.MeshStandardMaterial({color:0xdca45e,emissive:0x3a210c,transparent:true,opacity:.72,roughness:.5,side:THREE.DoubleSide});
const vitreousBase=new THREE.Mesh(new THREE.CylinderGeometry(9.35,10.18,2.65,96,1,true),baseMat);vitreousBase.rotation.x=Math.PI/2;vitreousBase.position.z=4.35;eye.add(vitreousBase);
const oraMat=new THREE.MeshStandardMaterial({color:0xf4d891,emissive:0x49320e,roughness:.42});
const ora=new THREE.Mesh(new THREE.TorusGeometry(9.82,.13,10,160),oraMat);ora.position.z=4.45;eye.add(ora);
// Optic disc and nerve, slightly nasal.
const disc=new THREE.Mesh(new THREE.CircleGeometry(.75,48),new THREE.MeshStandardMaterial({color:0xf2bd86,side:THREE.DoubleSide,emissive:0x35170b}));disc.position.set(-1.8,.3,-11.55);disc.scale.y=1.08;disc.rotation.x=Math.PI;eye.add(disc);
const opticCup=new THREE.Mesh(new THREE.CircleGeometry(.27,40),new THREE.MeshStandardMaterial({color:0xffd6a4,side:THREE.DoubleSide,emissive:0x44210d}));opticCup.position.set(-1.8,.3,-11.57);opticCup.rotation.x=Math.PI;eye.add(opticCup);
// Approximate 1.5–1.7 mm optic-nerve diameter at the globe.
const nerve=new THREE.Mesh(new THREE.CylinderGeometry(.75,.85,7,36),new THREE.MeshPhysicalMaterial({color:0xd7a66f,roughness:.72}));nerve.rotation.x=Math.PI/2;nerve.position.set(-1.8,.3,-14.6);eye.add(nerve);
// Superior/inferior temporal arcades curve parabolically around the macula, with tapering branches.
const vesselGroup=new THREE.Group();eye.add(vesselGroup);
const arteryMat=new THREE.MeshStandardMaterial({color:0xa62e32,roughness:.48}),veinMat=new THREE.MeshStandardMaterial({color:0x33477e,roughness:.52});
function retinalPoint(x,y){return new THREE.Vector3(x,y,-Math.sqrt(Math.max(25,11.30**2-x*x-y*y)))}
function addVessel(points,radius,material){const curve=new THREE.CatmullRomCurve3(points.map(p=>retinalPoint(p[0],p[1])));vesselGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve,48,radius,6,false),material))}
for(const superior of [1,-1]){
  for(let pair=0;pair<2;pair++){const offset=pair*.28,mat=pair?veinMat:arteryMat;const trunk=[];for(let i=0;i<=14;i++){const t=i/14,x=-1.8+7.9*t,y=.3+superior*(.45+5.2*t-2.1*t*t+offset);trunk.push([x,y])}addVessel(trunk,pair?.085:.075,mat);
    for(let b=1;b<=4;b++){const start=.2+b*.13,branch=[];for(let i=0;i<=8;i++){const q=i/8,t=start+q*.24,x=-1.8+7.9*t+q*(.55+b*.13),base=.3+superior*(.45+5.2*t-2.1*t*t+offset),y=base+superior*q*(1.0+b*.34);branch.push([x,y])}addVessel(branch,.045,mat)}
  }
}
// Short nasal trunks complete the central retinal vascular tree.
for(const s of [1,-1])for(const pair of [0,1])addVessel([[-1.8,.3],[-3.1,.3+s*(1.1+pair*.25)],[-5.2,.3+s*(2.2+pair*.35)],[-7,.3+s*(2.8+pair*.4)]],pair?.065:.055,pair?veinMat:arteryMat);
// Gas bubble uses a deformed sphere. Its offset follows opposite gravity with damped motion.
const bubbleGeo=new THREE.SphereGeometry(1,96,64);const bubbleMat=new THREE.MeshPhysicalMaterial({color:0x20d7ae,transparent:true,opacity:state.bubbleOpacity,transmission:0,roughness:.22,metalness:0,depthWrite:false,side:THREE.DoubleSide});const bubble=new THREE.Mesh(bubbleGeo,bubbleMat);eye.add(bubble);
const compactBubble=new THREE.Mesh(bubbleGeo,bubbleMat.clone());eye.add(compactBubble);
const interfaceRing=new THREE.Mesh(new THREE.TorusGeometry(1,.055,12,128),new THREE.MeshBasicMaterial({color:0xffd47c,transparent:true,opacity:.95}));eye.add(interfaceRing);
const meniscusGeometry=new THREE.CircleGeometry(1,128);const meniscusPosition=meniscusGeometry.attributes.position;
const meniscus=new THREE.Mesh(meniscusGeometry,new THREE.MeshPhysicalMaterial({color:0x12bfa0,transparent:true,opacity:state.bubbleOpacity,transmission:0,roughness:.18,clearcoat:.8,clearcoatRoughness:.08,side:THREE.DoubleSide,depthWrite:false}));eye.add(meniscus);
const gasRegion=new THREE.Mesh(new THREE.BufferGeometry(),bubbleMat);eye.add(gasRegion);
// The generated gas mesh is already closed by the retinal and interface arcs.
// It must never inherit the legacy half-space clip used by the old globe mesh.
bubbleMat.clippingPlanes=[];
// Both arrows show local tamponade force over the same defined 1 mm² retinal patch.
const forceGroup=new THREE.Group();eye.add(forceGroup);
const apexArrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),4,0x63e6c2,1,.55);forceGroup.add(apexArrow);
const foveaArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(),3,0xffb84f,.85,.48);forceGroup.add(foveaArrow);
const foveaMarker=new THREE.Mesh(new THREE.SphereGeometry(.18,24,16),new THREE.MeshStandardMaterial({color:0xffd15c,emissive:0x7a3f00,emissiveIntensity:1.2}));eye.add(foveaMarker);
const apexForceLabel=makeLabel('APEX LOAD',0,0,0),foveaForceLabel=makeLabel('FOVEAL LOAD',0,0,0);apexForceLabel.scale.set(5.4,.88,1);foveaForceLabel.scale.set(6.2,1,1);forceGroup.add(apexForceLabel,foveaForceLabel);
const labels=new THREE.Group();scene.add(labels);[['OPTIC NERVE',-5,2,-15],['LENS',5,4,8],['PARS PLANA',9,5,6.5],['ORA SERRATA',10,2,4.45],['VITREOUS BASE',10,-2,3.6]].forEach(([t,x,y,z])=>labels.add(makeLabel(t,x,y,z)));
const tearGroup=new THREE.Group();eye.add(tearGroup);
function makeTearBadge(number){const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d');x.beginPath();x.arc(64,64,48,0,Math.PI*2);x.fillStyle='rgba(255,66,45,.32)';x.fill();x.lineWidth=8;x.strokeStyle='#ffb19f';x.stroke();x.fillStyle='#fff';x.font='700 48px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(number,64,66);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false,depthWrite:false}));s.scale.set(1.8,1.8,1);s.renderOrder=20;return s}
function createTearMarker(index){const marker=new THREE.Group(),core=new THREE.Mesh(new THREE.CircleGeometry(.5,40),new THREE.MeshBasicMaterial({color:0x340609,side:THREE.DoubleSide,depthTest:false,depthWrite:false})),rim=new THREE.Mesh(new THREE.RingGeometry(.48,.72,40),new THREE.MeshBasicMaterial({color:0xff5b45,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));core.scale.set(.55,1.25,1);rim.scale.set(.55,1.25,1);marker.add(core,rim);const badge=makeTearBadge(index+1);badge.position.z=.08;marker.add(badge);marker.userData.badge=badge;return marker}
function tearPoint(tear){const hourAngle=tear.clock/12*Math.PI*2,theta=.18+(tear.anterior/100)*1.72,R=11.32,radial=R*Math.sin(theta),point=new THREE.Vector3(Math.sin(hourAngle)*radial,Math.cos(hourAngle)*radial,-R*Math.cos(theta));return{point,normal:point.clone().normalize()}}
function updateTears(){while(tearGroup.children.length<state.tears.length)tearGroup.add(createTearMarker(tearGroup.children.length));while(tearGroup.children.length>state.tears.length){const marker=tearGroup.children.at(-1);tearGroup.remove(marker)}state.tears.forEach((tear,i)=>{const marker=tearGroup.children[i],{point,normal}=tearPoint(tear);marker.position.copy(point).addScaledVector(normal,.08);marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);marker.scale.setScalar(i===state.activeTear?1.15:1);marker.userData.badge.material.opacity=i===state.activeTear?1:.78});tearGroup.visible=state.tearEnabled;renderTearList()}
function renderTearList(){const list=document.querySelector('#tearList');if(!list)return;list.innerHTML=state.tears.map((t,i)=>`<button type="button" data-tear="${i}" class="tear-chip ${i===state.activeTear?'active':''}"><b>${i+1}</b><span>${t.clock}h · ${t.anterior}%</span></button>`).join('');list.querySelectorAll('[data-tear]').forEach(button=>button.onclick=()=>selectTear(+button.dataset.tear));document.querySelector('#removeTear').disabled=state.tears.length<=1}
function selectTear(index){state.activeTear=index;const tear=state.tears[index];state.tearClock=tear.clock;state.tearAnterior=tear.anterior;for(const id of ['tearClock','tearAnterior']){const el=document.querySelector('#'+id);el.value=state[id];document.querySelector('#'+id+'Val').textContent=`${state[id]} ${el.dataset.unit}`}updateTears()}
function updateTear(){updateTears()}
function makeLabel(textValue,x,y,z){const c=document.createElement('canvas');c.width=320;c.height=52;const cx=c.getContext('2d');cx.font='600 20px Manrope, sans-serif';cx.fillStyle='#d9eee8';cx.fillText(textValue,10,32);cx.fillStyle='#71cbb1';cx.fillRect(0,12,3,24);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));s.position.set(x,y,z);s.scale.set(8,1.3,1);return s}

let targetUp=new THREE.Vector3(0,1,0),bubbleUp=targetUp.clone(),velocity=new THREE.Vector3(),paused=false,fundusView=false,last=performance.now();
let gasShapeKey='',gasShape={level:0,ring:0,sag:0};
let kineticsKey='',kinetics=null;
function currentKinetics(){
 const key=[state.gas,state.concentration,state.fill,state.lens,state.durationDays].join('/');
 if(key!==kineticsKey){kineticsKey=key;kinetics=makeKinetics({gas:state.gas,concentration:state.concentration,fill:state.fill,lens:state.lens,durationDays:state.durationDays,R:cavityRadius})}
 return kinetics;
}
function isPureGas(){return Boolean(gasOption(state.gas,state.concentration).pure)}
function rawEstimatedFill(){return currentKinetics().rawFillAt(state.elapsedDays)}
function estimatedFill(){return Math.min(100,currentKinetics().fillAt(state.elapsedDays))}
function disappearanceDay(){return currentKinetics().disappearanceDay}
function setText(id,text){const el=document.getElementById(id);if(el&&el.textContent!==text)el.textContent=text}
function updateKineticsReadout(fill){
 const k=currentKinetics(),rawFill=rawEstimatedFill(),remaining=Math.max(0,k.disappearanceDay-state.elapsedDays),opt=k.option;
 setText('predictedFill',fill<=0?'Gone (<1%)':fill.toFixed(1)+'%');
 // First halving from the start of absorption; once time has passed, the halving time from the current fill.
 const halving=state.elapsedDays>k.peakDay&&fill>0?k.halvingFrom(fill/100):k.firstHalving;
 setText('halfLife',halving.toFixed(1)+' days');
 setText('remainingTime',remaining<=0?'Below threshold':'~'+remaining.toFixed(1)+' days');
 setText('kineticsPhase',k.phaseAt(state.elapsedDays));
 setText('durationSource','Default: '+opt.durationSource+'.');
 setText('publishedHalfLife','Published half-life: '+opt.publishedHalfLife+'. Single-exponential fits do not capture the slower early and faster late phases.');
 const warning=document.getElementById('expansionWarning'),over=rawFill>100;warning.hidden=!over;setText('expansionWarning',over?'Unconstrained expansion: '+rawFill.toFixed(0)+'% fill. Model capped at cavity volume; clinically this implies pressure risk.':'');
 setText('vol',(cavityVolume*fill/100/1000).toFixed(2)+' mL ('+fill.toFixed(1)+'%)');
 setText('fillVal',state.fill+' % · '+(cavityVolume*state.fill/100/1000).toFixed(2)+' mL');
}
function updateGasRegion(V,R,fill,deltaRho){
 // Round the fill so scrubbing time reuses solutions; the solve takes tens of milliseconds.
 const key=[fill.toFixed(1),R,state.sigma.toFixed(4),state.contact,deltaRho.toFixed(1)].join('/');if(key===gasShapeKey)return gasShape;gasShapeKey=key;
 if(fill<=0){gasRegion.visible=false;return gasShape={level:R,ring:0,apex:R,k0:0,laplacePa:0}}
 const sol=solveBubble({R,V:cavityVolume*(+fill.toFixed(1))/100,gamma:state.sigma,theta:THREE.MathUtils.degToRad(state.contact),deltaRho});
 if(!sol){const level=flatCapLevel(R,V);return gasShape={level,ring:Math.sqrt(Math.max(0,R*R-level*level)),apex:level,k0:0,laplacePa:0}}
 // Lathe outline: wall arc from the top down to the contact ring, then the interface back to the axis.
 const pts=[],wallAngle=Math.acos(THREE.MathUtils.clamp(sol.contactLevel/R,-1,1));
 for(let i=0;i<=96;i++){const a=wallAngle*i/96;pts.push(new THREE.Vector2(R*Math.sin(a),R*Math.cos(a)))}
 for(let i=sol.profile.length-2;i>=0;i--){const [x,z]=sol.profile[i];pts.push(new THREE.Vector2(Math.max(0,x),z))}
 const old=gasRegion.geometry;gasRegion.geometry=new THREE.LatheGeometry(pts,128);old.dispose();
 return gasShape={level:sol.contactLevel,ring:sol.contactRadius,apex:sol.apex,k0:sol.k0,laplacePa:sol.laplacePa,lc:sol.lc};
}
function updateModel(dt){const pitch=THREE.MathUtils.degToRad(state.posture),roll=THREE.MathUtils.degToRad(state.tilt);targetUp.set(Math.sin(roll)*Math.cos(pitch),Math.cos(roll)*Math.cos(pitch),-Math.sin(pitch)).normalize();if(!paused){velocity.addScaledVector(targetUp.clone().sub(bubbleUp),dt*5.5);velocity.multiplyScalar(Math.exp(-3.4*dt));bubbleUp.addScaledVector(velocity,dt).normalize()}
 const fill=estimatedFill(),cavityR=cavityRadius,cavityV=cavityVolume,V=cavityV*fill/100,r=Math.cbrt(V*3/(4*Math.PI)),hasGas=fill>=disappearanceFill,hasInterface=hasGas&&fill<99.9,gasDensityNow=gasDensity(state.gas,state.concentration),deltaRho=1005-gasDensityNow;const bo=hasGas?deltaRho*9.81*Math.pow(r/1000,2)/state.sigma:0,shape=hasInterface?updateGasRegion(V,cavityR,fill,deltaRho):{level:hasGas?-cavityR:cavityR,ring:0,apex:hasGas?-cavityR:cavityR,k0:0,laplacePa:0},meniscusLevel=shape.level,capRingR=shape.ring;
 updateKineticsReadout(fill);
 // Every partial fill is the same wall-plus-interface topology, revolved around buoyancy.
 bubble.position.set(0,0,0);bubble.scale.setScalar(cavityR);bubble.quaternion.identity();bubble.visible=fill>=99.9;compactBubble.visible=false;gasRegion.visible=hasInterface;gasRegion.position.set(0,0,0);gasRegion.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bubbleUp);
 interfaceRing.scale.setScalar(Math.max(.01,capRingR));interfaceRing.position.copy(bubbleUp).multiplyScalar(meniscusLevel);interfaceRing.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),bubbleUp);interfaceRing.visible=hasInterface;interfaceRing.material.opacity=1;meniscus.visible=false;
 // Wetted retina is the spherical zone above the contact ring. Gas pressure exceeds the liquid at the interface apex by γ·k0.
 const coverage=hasGas?(1-meniscusLevel/cavityR)*50:0,laplace=hasInterface?shape.laplacePa:0,laplaceMmHg=laplace/133.322,gasPressure=state.iop+laplaceMmHg,apexLevel=shape.apex;
 // The gas contacts the lens when its cap reaches the lens ellipsoid's support point along buoyancy.
 const lensRadii=new THREE.Vector3(4.3,4.3,4.3*.72),lensCenter=lens.position.clone(),supportDenom=Math.sqrt((lensRadii.x*bubbleUp.x)**2+(lensRadii.y*bubbleUp.y)**2+(lensRadii.z*bubbleUp.z)**2)||1,lensSupport=new THREE.Vector3(lensRadii.x*lensRadii.x*bubbleUp.x,lensRadii.y*lensRadii.y*bubbleUp.y,lensRadii.z*lensRadii.z*bubbleUp.z).divideScalar(supportDenom).add(lensCenter),lensContact=hasInterface&&lensSupport.dot(bubbleUp)>=meniscusLevel;
 lensContactMarker.visible=lensContact&&!fundusView;if(lensContact)lensContactMarker.position.copy(lensSupport);lens.material.emissive.setHex(lensContact?0x6b2e00:0x000000);lens.material.emissiveIntensity=lensContact?1.35:0;
 // Local tamponade force is differential pressure multiplied by a defined 1 mm² patch.
 const mirror=state.laterality==='Right'?-1:1,fovea=retinalPoint(1.7*mirror,-.15),foveaNormal=fovea.clone().normalize();foveaMarker.position.copy(fovea);
 // Compare polar angles, not raw radii: anatomy and fluid cavity use different shells.
 const foveaCavityAxial=cavityR*foveaNormal.dot(bubbleUp),contactTolerance=.02,foveaCovered=fill>=100||(hasInterface&&foveaCavityAxial>=meniscusLevel-contactTolerance);
 const hydrostaticHeadM=Math.max(0,(foveaCavityAxial-apexLevel)/1000),hydrostatic=deltaRho*9.81*hydrostaticHeadM,localPressure=foveaCovered?laplace+hydrostatic:0,fovealForce=localPressure*1e-6;
 const apexHeadM=hasInterface?(cavityR-apexLevel)/1000:0,apexPressure=hasInterface?laplace+deltaRho*9.81*apexHeadM:0,apexForce=apexPressure*1e-6;
 const apex=bubbleUp.clone().multiplyScalar(cavityR);apexArrow.visible=hasGas;apexForceLabel.visible=hasGas;apexArrow.position.copy(apex);apexArrow.setDirection(bubbleUp);apexArrow.setLength(2+Math.min(3,apexPressure/80),.85,.48);apexForceLabel.position.copy(apex).addScaledVector(bubbleUp,3.5);
 foveaArrow.visible=foveaCovered;foveaForceLabel.visible=foveaCovered;foveaArrow.position.copy(fovea);foveaArrow.setDirection(foveaNormal);foveaArrow.setLength(2+Math.min(3,localPressure/80),.8,.45);foveaForceLabel.position.copy(fovea).addScaledVector(foveaNormal,3.1);
 document.querySelector('#arc').textContent=hasGas?(fill>=99.9?'360°':arcDegrees(cavityR,meniscusLevel).toFixed(0)+'°'):'—';document.querySelector('#arcFlat').textContent=hasGas?(fill>=99.9?'360°':arcDegrees(cavityR,flatCapLevel(cavityR,V)).toFixed(0)+'°'):'—';document.querySelector('#iopReadout').textContent=state.iop.toFixed(0)+' mmHg';document.querySelector('#laplace').textContent=laplace.toFixed(1)+' Pa / '+laplaceMmHg.toFixed(3)+' mmHg';document.querySelector('#gasPressure').textContent=gasPressure.toFixed(2)+' mmHg';document.querySelector('#apexLoad').textContent=hasInterface?(apexForce*1e6).toFixed(1)+' µN / 1 mm²':'—';document.querySelector('#fovealLoad').textContent=foveaCovered?(fovealForce*1e6).toFixed(1)+' µN / 1 mm²':'No gas contact';document.querySelector('#bond').textContent=bo.toFixed(2)+(shape.lc?' (lc '+shape.lc.toFixed(1)+' mm)':'');document.querySelector('#contactArea').textContent=coverage.toFixed(0)+'% globe';document.querySelector('#coverage').style.width=coverage+'%';document.querySelector('#orient').textContent=`Bubble buoyancy: ${targetUp.x.toFixed(2)}, ${targetUp.y.toFixed(2)}, ${targetUp.z.toFixed(2)}`;
}
function setLaterality(side){state.laterality=side;const mirror=side==='Right'?-1:1;disc.position.x=-1.8*mirror;opticCup.position.x=-1.8*mirror;nerve.position.x=-1.8*mirror;vesselGroup.scale.x=mirror}
function setFundusView(enabled){fundusView=enabled;document.querySelector('.viewport').classList.toggle('fundus-view',enabled);document.querySelector('#fundus').classList.toggle('active',enabled);if(enabled){camera.position.set(0,0,5.7);camera.fov=62;controls.target.set(0,0,-11.3);controls.enableRotate=false;controls.enablePan=false;labels.visible=false;sclera.visible=false;cornea.visible=false;iris.visible=false;lens.visible=false;parsPlana.visible=false;vitreousBase.visible=false;ora.visible=false;nerve.visible=false}else{camera.position.set(31,15,30);camera.fov=34;controls.target.set(0,0,0);controls.enableRotate=true;controls.enablePan=true;labels.visible=state.labels;sclera.visible=true;cornea.visible=true;iris.visible=true;lens.visible=true;parsPlana.visible=true;vitreousBase.visible=true;ora.visible=true;nerve.visible=true}camera.updateProjectionMatrix();controls.update()}
function updateConcentrationControl(reset=false){
 const gas=GASES[state.gas],select=document.querySelector('#concentration'),field=document.querySelector('#concentrationField');
 if(reset||!gas.options.some(o=>o.c===state.concentration))state.concentration=(gas.options.find(o=>!o.pure&&o.c>=(gas.isoexpansile??0))??gas.options[0]).c;
 select.innerHTML=gas.options.map(o=>`<option value="${o.c}" ${o.c===state.concentration?'selected':''}>${o.pure?'100% (pure)':o.c+'%'+(o.c===gas.isoexpansile?' (isoexpansile)':'')}</option>`).join('');
 field.hidden=state.gas==='Air';document.querySelector('#concentrationVal').textContent=isPureGas()?'Pure':state.concentration+'%';
 document.querySelector('#fillLabel').textContent=isPureGas()?'Injected gas fill':'Current gas fill';
 // Each gas and concentration starts from its published clinical duration; the user can then change it.
 state.durationDays=gasOption(state.gas,state.concentration).durationDays;const d=document.querySelector('#durationDays');d.value=state.durationDays;document.querySelector('#durationDaysVal').textContent=state.durationDays+' days';
}
function bind(){document.querySelectorAll('input[type=range]').forEach(el=>el.addEventListener('input',()=>{state[el.id]=+el.value/+el.dataset.scale;document.querySelector('#'+el.id+'Val').textContent=`${+el.value} ${el.dataset.unit}`;if(el.id==='tearClock'||el.id==='tearAnterior')updateTear()}));document.querySelector('#gas').onchange=e=>state.gas=e.target.value;document.querySelector('#laterality').onchange=e=>setLaterality(e.target.value);document.querySelector('#preset').onchange=e=>{const [p,r]=e.target.value.split(',').map(Number);['posture','tilt'].forEach((id,i)=>{state[id]=[p,r][i];const el=document.querySelector('#'+id);el.value=state[id];document.querySelector('#'+id+'Val').textContent=state[id]+' °'})};['labels','vessels','section','tearEnabled'].forEach(id=>document.querySelector('#'+id).onclick=e=>{state[id]=!state[id];e.currentTarget.classList.toggle('on',state[id]);labels.visible=state.labels&&!fundusView;vesselGroup.visible=state.vessels;if(id==='tearEnabled')updateTear();if(id==='section'){sclera.material.clippingPlanes=state.section?[new THREE.Plane(new THREE.Vector3(-1,0,0),0)]:[];renderer.localClippingEnabled=true}});document.querySelector('#opacity').addEventListener('input',e=>sclera.material.opacity=+e.target.value/100);document.querySelector('#bubbleOpacity').addEventListener('input',e=>{const opacity=+e.target.value/100;bubbleMat.opacity=opacity;compactBubble.material.opacity=opacity;meniscus.material.opacity=opacity});document.querySelector('#fundus').onclick=()=>setFundusView(!fundusView);document.querySelector('#reset').onclick=()=>setFundusView(false);document.querySelector('#pause').onclick=e=>{paused=!paused;e.currentTarget.textContent=paused?'▶':'Ⅱ'}}bind();setLaterality(state.laterality);updateTear();
updateConcentrationControl();
document.querySelector('#gas').onchange=e=>{state.gas=e.target.value;updateConcentrationControl(true)};
document.querySelector('#concentration').onchange=e=>{state.concentration=+e.target.value;updateConcentrationControl()};
document.querySelector('#lens').onchange=e=>{state.lens=e.target.value};
document.querySelector('#timelineReset').onclick=()=>{state.elapsedDays=0;const el=document.querySelector('#elapsedDays');el.value=0;document.querySelector('#elapsedDaysVal').textContent='0 days'};
for(const id of ['tearClock','tearAnterior'])document.querySelector('#'+id).addEventListener('input',()=>{state.tears[state.activeTear][id==='tearClock'?'clock':'anterior']=state[id];updateTears()});
document.querySelector('#addTear').onclick=()=>{const source=state.tears[state.activeTear];state.tears.push({clock:source.clock===12?1:Math.min(12,source.clock+1),anterior:source.anterior});state.tearEnabled=true;document.querySelector('#tearEnabled').classList.add('on');selectTear(state.tears.length-1)};
document.querySelector('#removeTear').onclick=()=>{if(state.tears.length<=1)return;state.tears.splice(state.activeTear,1);selectTear(Math.min(state.activeTear,state.tears.length-1))};
document.querySelector('#toggleReadout').onclick=e=>{const collapsed=document.querySelector('#readout').classList.toggle('collapsed');e.currentTarget.textContent=collapsed?'+':'−';e.currentTarget.setAttribute('aria-expanded',String(!collapsed));e.currentTarget.setAttribute('aria-label',collapsed?'Expand physics readout':'Minimize physics readout')};
updateTears();
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;updateModel(dt);updateKineticsReadout(estimatedFill());controls.update();renderer.render(scene,camera)}requestAnimationFrame(animate);
addEventListener('resize',()=>{const w=holder.clientWidth,h=holder.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)});
