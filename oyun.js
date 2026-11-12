/* =========================================================
   0. 3B MOTORU YÜKLE (ilk açılışta internetten; sonra cihazda saklı)
   ========================================================= */
const THREE_URLS=['https://unpkg.com/three@0.160.0/build/three.module.min.js','https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js'];
const LIB_CACHE='metin-lib-v1';
let THREE_FROM='';
async function importText(t){return import(URL.createObjectURL(new Blob([t],{type:'text/javascript'})));}
async function loadThree(){
  const errs=[];
  /* 1) Doğrudan adres (orijinal yöntem; önizleme/sandbox pencerelerinde de çalışır) */
  for (const u of THREE_URLS){
    try{ const m=await import(u);THREE_FROM=u;
      try{ if(window.caches) fetch(u).then(r=>r.ok?r.text():null).then(t=>{ if(t) return caches.open(LIB_CACHE).then(c=>c.put(u,new Response(t,{headers:{'content-type':'text/javascript'}}))); }).catch(()=>{}); }catch(e){}
      return m; }catch(e){ errs.push(e); }
  }
  /* 2) Cihazda saklı kopya (internet yoksa) */
  try{ const c=await caches.open(LIB_CACHE); for (const u of THREE_URLS){ const r=await c.match(u); if(r) return await importText(await r.text()); } }catch(e){ errs.push(e); }
  /* 3) Metni indirip blob olarak yükle */
  for (const u of THREE_URLS){ try{ const r=await fetch(u); if(!r.ok)throw new Error('HTTP '+r.status); return await importText(await r.text()); }catch(e){ errs.push(e); } }
  throw errs[errs.length-1]||new Error('yüklenemedi');
}
const $ = id => document.getElementById(id);
let THREE;
try{ THREE = window.__THREE_STUB || await loadThree(); }
catch(err){
  $('loadMsg').textContent='⚠️ 3B motor yüklenemedi. İlk açılışta internet gerekir; bağlantını kontrol edip sayfayı yenile. ('+(err&&err.message||err)+')';
  throw err;
}
$('loadMsg').textContent='';


/* =========================================================
   0c. PAKET YÜKLEYİCİ + DOĞA/BİNA PARÇALARI (doga.bin)
   Paketler: kahraman.bin, canavar.bin, doga.bin — index.html ile aynı klasörde
   ========================================================= */
const PACK_VER=9;
const PACK_ERR=[];
async function fetchPack(name,tmo){
  const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),tmo||90000);
  try{
    const r=await fetch(name+'?v='+PACK_VER,{signal:ctl.signal});if(!r.ok)throw new Error(name+': HTTP '+r.status);
    const buf=await r.arrayBuffer(),dv=new DataView(buf);
    if(buf.byteLength<12||dv.getUint32(0,false)!==0x4d504b31)throw new Error(name+': bozuk dosya');
    const jl=dv.getUint32(4,true),meta=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,8,jl)));
    if(meta.v!==PACK_VER)throw new Error(name+': sürüm uyumsuz (dosya '+meta.v+', oyun '+PACK_VER+')');
    return {meta,buf,base:8+jl};
  }catch(e){PACK_ERR.push(String(e&&e.message||e));return null;}
  finally{clearTimeout(tm);}
}
let KN_OK=false;const KN_TEX={},KN_GEO={};
async function loadKN(){
  try{
    if(!(THREE.Texture&&THREE.BufferAttribute&&THREE.BufferGeometry&&THREE.MeshLambertMaterial))return;
    const P=await fetchPack('doga.bin');if(!P)return;
    const {meta,buf,base}=P;
    for(const k in meta.tex){const o=meta.tex[k],im=new Image(),t=new THREE.Texture(im);im.onload=()=>{t.needsUpdate=true;};
      im.src=URL.createObjectURL(new Blob([buf.slice(base+o[0],base+o[0]+o[1])],{type:'image/png'}));
      t.magFilter=THREE.NearestFilter;t.wrapS=t.wrapT=THREE.RepeatWrapping;if(THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;KN_TEX[k]=t;}
    for(const n in meta.p)KN_GEO[n]=meta.p[n].map(q=>({img:q.img||null,
      pos:new Float32Array(buf,base+q.pos[0],q.pos[1]*3),nor:new Int8Array(buf,base+q.nor[0],q.nor[1]*3),
      uv:q.uv?new Float32Array(buf,base+q.uv[0],q.uv[1]*2):null,col:q.col?new Uint8Array(buf,base+q.col[0],q.col[1]*3):null,idx:new Uint16Array(buf,base+q.idx[0],q.idx[1])}));
    KN_OK=true;
  }catch(e){KN_OK=false;PACK_ERR.push('doga: '+(e&&e.message||e));}
}
const KN_MAT={};
function knMat(key){return KN_MAT[key]||(KN_MAT[key]=key==='#vc'?new THREE.MeshLambertMaterial({vertexColors:true}):new THREE.MeshLambertMaterial({map:KN_TEX[key]}));}
const srgb2lin=new Float32Array(256);for(let i=0;i<256;i++)srgb2lin[i]=Math.pow(i/255,2.2);
/* items: [{n,x,y,z,sx,sy,sz,ry,tint:[r,g,b,w]}] → tek Group (malzeme başına tek mesh) */
function knMerge(items){
  const acc={};
  for(const it of items){const G=KN_GEO[it.n];if(!G)continue;
    const c=Math.cos(it.ry||0),s=Math.sin(it.ry||0),sx=it.sx||1,sy=it.sy||sx,sz=it.sz||sx,tn=it.tint;
    for(const p of G){const key=p.img||'#vc',A=acc[key]||(acc[key]={pos:[],nor:[],uv:[],col:[],idx:[],n:0}),nv=p.pos.length/3;
      for(let i=0;i<nv;i++){const x=p.pos[i*3]*sx,y=p.pos[i*3+1]*sy,z=p.pos[i*3+2]*sz;
        A.pos.push(x*c+z*s+(it.x||0),y+(it.y||0),-x*s+z*c+(it.z||0));
        const nx=p.nor[i*3]/127,ny=p.nor[i*3+1]/127,nz=p.nor[i*3+2]/127;A.nor.push(nx*c+nz*s,ny,-nx*s+nz*c);
        if(p.img)A.uv.push(p.uv[i*2],p.uv[i*2+1]);
        else{let r=srgb2lin[p.col[i*3]],g=srgb2lin[p.col[i*3+1]],b=srgb2lin[p.col[i*3+2]];
          if(tn){const w=tn[3];r+= (tn[0]-r)*w;g+=(tn[1]-g)*w;b+=(tn[2]-b)*w;}A.col.push(r,g,b);}}
      for(let i=0;i<p.idx.length;i++)A.idx.push(p.idx[i]+A.n);A.n+=nv;}}
  const g=new THREE.Group();
  for(const key in acc){const A=acc[key],geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(A.pos),3));geo.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(A.nor),3));
    if(key==='#vc')geo.setAttribute('color',new THREE.BufferAttribute(new Float32Array(A.col),3));else geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(A.uv),2));
    geo.setIndex(new THREE.BufferAttribute(A.n>65535?new Uint32Array(A.idx):new Uint16Array(A.idx),1));
    const m=new THREE.Mesh(geo,knMat(key));m.frustumCulled=false;g.add(m);}
  return g;
}
await loadKN();

/* =========================================================
   0b. GERÇEK 3B MODELLER (kahraman.bin + canavar.bin, Quaternius CC0) — olmazsa çizim karakterler kullanılır
   ========================================================= */
const ADDON_BASE='https://unpkg.com/three@0.160.0/examples/jsm/';
let USE_MODELS=true;try{USE_MODELS=localStorage.getItem('m2_models')!=='off';}catch(e){}
const MODELS={ok:false,hero:null,mon:{},at:{},msg:'',SU:null};
const MON_DEF={Slime:{h:1.1,yaw:-Math.PI/2,hov:0},Skeleton:{h:2.0,yaw:0,hov:0},Bat:{h:.9,yaw:0,hov:1.0},Dragon:{h:2.2,yaw:0,hov:0}};
async function loadModels(){
  if(!USE_MODELS){MODELS.msg='kapalı';return;}
  const st=$('loadMsg');if(st)st.textContent='Karakter modelleri yükleniyor…';
  try{
    let AD=window.__ADDONS_STUB;
    if(!AD){
      if(THREE_FROM!==THREE_URLS[0])throw new Error('model eklentileri yalnızca ana sunucuyla yüklenir');
      const imp=u=>Promise.race([import(ADDON_BASE+u),new Promise((_,no)=>setTimeout(()=>no(new Error('zaman aşımı: '+u)),15000))]);
      const [g,f,s]=await Promise.allSettled([imp('loaders/GLTFLoader.js'),imp('loaders/FBXLoader.js'),imp('utils/SkeletonUtils.js')]);
      AD={GLTFLoader:g.value&&g.value.GLTFLoader,FBXLoader:f.value&&f.value.FBXLoader,SU:s.value};
      if(!AD.SU)MODELS.msg+=' [SkeletonUtils yok]';
    }
    MODELS.SU=AD.SU;
    const [HP,MP]=await Promise.all([AD.GLTFLoader&&AD.SU?fetchPack('kahraman.bin'):null,AD.FBXLoader&&AD.SU?fetchPack('canavar.bin'):null]);
    const AP=AD.FBXLoader&&AD.SU?await fetchPack('at.bin'):null;
    if(HP){
      try{
        const o=HP.meta.glb,ab=HP.buf.slice(HP.base+o[0],HP.base+o[0]+o[1]);
        const gltf=await new Promise((ok,no)=>new AD.GLTFLoader().parse(ab,'',ok,no));
        const clips={};(gltf.animations||[]).forEach(a=>{clips[a.name]=a;});
        let skinned=false;gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skinned=true;});
        if(!clips.Idle_Loop||!skinned)throw new Error('kahraman modeli eksik');
        MODELS.hero={scene:gltf.scene,clips};
      }catch(e){MODELS.hero=null;MODELS.msg+=' [kahraman: '+(e&&e.message||e)+']';}
    }
    if(MP){
      for(const k in MP.meta.mon){
        try{
          const o0=MP.meta.mon[k],o=new AD.FBXLoader().parse(MP.buf.slice(MP.base+o0[0],MP.base+o0[0]+o0[1]),'');
          o.position.set(0,0,0);o.updateMatrixWorld(true);
          const box=new THREE.Box3().setFromObject(o),size=new THREE.Vector3(),ctr=new THREE.Vector3();box.getSize(size);box.getCenter(ctr);
          if(!(size.y>0)||!isFinite(size.y)||!(o.animations&&o.animations.length))throw new Error('boyut/animasyon yok');
          const sc=MON_DEF[k].h/size.y;
          MODELS.mon[k]={src:o,clips:o.animations,sc,yaw:MON_DEF[k].yaw,off:[-ctr.x*sc,-box.min.y*sc+MON_DEF[k].hov,-ctr.z*sc]};
        }catch(e){MODELS.msg+=' ['+k+': '+(e&&e.message||e)+']';}
      }
    }
    if(AP){
      for(const k in AP.meta.mon){
        try{
          const o0=AP.meta.mon[k],o=new AD.FBXLoader().parse(AP.buf.slice(AP.base+o0[0],AP.base+o0[0]+o0[1]),'');
          o.position.set(0,0,0);o.updateMatrixWorld(true);
          const box=new THREE.Box3().setFromObject(o),size=new THREE.Vector3(),ctr=new THREE.Vector3();box.getSize(size);box.getCenter(ctr);
          if(!(size.y>0)||!isFinite(size.y)||!(o.animations&&o.animations.length))throw new Error('boyut/animasyon yok');
          const sc=2.2/size.y;
          MODELS.at[k]={src:o,clips:o.animations,sc,yaw:0,off:[-ctr.x*sc,-box.min.y*sc,-ctr.z*sc]};
        }catch(e){MODELS.msg+=' [at '+k+': '+(e&&e.message||e)+']';}
      }
    }
  }catch(e){MODELS.msg=String(e&&e.message||e);}
  MODELS.ok=!!MODELS.hero;
  if(st)st.textContent=PACK_ERR.length?('⚠ '+PACK_ERR[0]):'';
}
await loadModels();

/* =========================================================
   1. SAHNE, SES, YARDIMCILAR
   ========================================================= */
const canvas=$('game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9fd0ec); scene.fog=new THREE.Fog(0x9fd0ec,60,150);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.5,240);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
scene.add(new THREE.HemisphereLight(0xdcecff,0x5a7a3a,1.05));
const sun=new THREE.DirectionalLight(0xfff0cc,1.2); sun.position.set(30,50,20); scene.add(sun);
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const tmpV=new THREE.Vector3();
let actx=null,muted=false; try{muted=localStorage.getItem('metin2m_muted')==='1';}catch(e){}
function audioInit(){try{if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();}catch(e){}}
const SFX={hit:[220,.07,'square',-120,.05],crit:[440,.12,'sawtooth',-200,.07],hurt:[110,.18,'sawtooth',-60,.09],skill:[330,.22,'triangle',300,.08],
  drop:[660,.14,'sine',400,.07],level:[523,.5,'triangle',523,.1],die:[200,.3,'square',-150,.08],quest:[587,.35,'triangle',293,.08],miss:[150,.05,'sine',0,.03],buy:[880,.1,'sine',200,.06],pot:[400,.2,'sine',300,.06],fail:[180,.3,'sawtooth',-100,.08]};
function sfx(n){if(muted||!actx)return;const s=SFX[n];if(!s)return;try{const o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime;
  o.type=s[2];o.frequency.setValueAtTime(s[0],t);o.frequency.linearRampToValueAtTime(Math.max(40,s[0]+s[3]),t+s[1]);g.gain.setValueAtTime(s[4],t);g.gain.exponentialRampToValueAtTime(.0001,t+s[1]);
  o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+s[1]+.02);}catch(e){}}
const sndBtn=$('sndBtn');const paintSnd=()=>{sndBtn.textContent=muted?'🔇':'🔊';};paintSnd();
sndBtn.onclick=()=>{muted=!muted;try{localStorage.setItem('metin2m_muted',muted?'1':'0');}catch(e){}paintSnd();audioInit();};
function makeLabel(text,cls){const e=document.createElement('div');e.className='lbl '+(cls||'');e.textContent=text;document.body.appendChild(e);return e;}
function placeLabel(el,x,y,z,maxD,dist){tmpV.set(x,y,z).project(camera);
  if(tmpV.z>1||dist>maxD){el.style.display='none';return;}el.style.display='block';el.style.left=((tmpV.x*.5+.5)*innerWidth)+'px';el.style.top=((-tmpV.y*.5+.5)*innerHeight)+'px';}
const chatEl=$('chat');
function chat(t,color){const d=document.createElement('div');d.textContent=t;d.style.color=color||'#e8e0c8';chatEl.appendChild(d);while(chatEl.children.length>7)chatEl.firstChild.remove();}
const msgEl=$('msg');let msgTimer=0;function showMsg(t){msgEl.textContent=t;msgEl.style.opacity=1;msgTimer=1.9;chat(t,'#ffe08a');}
const flashEl=$('flash');let flashTimer=0;
function showDamage(wp,amount,color,crit){tmpV.copy(wp).project(camera);if(tmpV.z>1)return;
  const el=document.createElement('div');el.className='dmg'+(crit?' crit':'');el.textContent=(crit?'✦':'')+amount;el.style.left=((tmpV.x*.5+.5)*innerWidth)+'px';el.style.top=((-tmpV.y*.5+.5)*innerHeight)+'px';el.style.color=color;document.body.appendChild(el);setTimeout(()=>el.remove(),850);}
const particles=[];const burstGeo=new THREE.BoxGeometry(.16,.16,.16);
function spawnBurst(pos,color){const mat=new THREE.MeshBasicMaterial({color,transparent:true});
  for(let i=0;i<9;i++){const m=new THREE.Mesh(burstGeo,mat.clone());m.position.copy(pos).setY(.9);scene.add(m);particles.push({m,v:new THREE.Vector3((Math.random()-.5)*7,3+Math.random()*5,(Math.random()-.5)*7),life:.65});}}

/* =========================================================
   2. DÜNYA: bölgeler, zemin dokusu, dekor
   ========================================================= */
const VR=28, WORLD_R=175, DG={x:800,z:800,r:26};
const ZONES={
  village:{n:'Aslan Köyü',fog:0xa6d4f0,rgb:[118,142,78]},
  forest:{n:'Yeşil Orman',lv:[1,8],fog:0x9fd0e8,rgb:[74,150,56]},
  desert:{n:'Kızıl Çöl',lv:[8,16],fog:0xecd6a4,rgb:[222,190,108]},
  snow:{n:'Buzul Vadisi',lv:[16,25],fog:0xe2edf7,rgb:[232,242,248]},
  swamp:{n:'Karanlık Bataklık',lv:[25,35],fog:0x65786a,rgb:[52,70,56]},
  dungeon:{n:'Ork Mağarası',fog:0x1c1522,rgb:[40,34,44]}
};
function zoneAt(x,z){
  if(x>400)return 'dungeon'; if(Math.hypot(x,z)<VR)return 'village';
  if(Math.abs(z)>=Math.abs(x))return z>0?'forest':'snow'; return x>0?'desert':'swamp';
}
const ZK=['forest','desert','snow','swamp'];
function groundRGB(x,z){
  const d=Math.hypot(x,z)||1,w=[Math.max(0,z/d),Math.max(0,x/d),Math.max(0,-z/d),Math.max(0,-x/d)].map(v=>Math.pow(v,5));
  const s=w.reduce((a,b)=>a+b,0)||1;let r=0,g=0,b=0;
  w.forEach((v,i)=>{const c=ZONES[ZK[i]].rgb;r+=c[0]*v/s;g+=c[1]*v/s;b+=c[2]*v/s;});
  const vb=clamp((VR+14-d)/14,0,1); const v=ZONES.village.rgb;r=r*(1-vb)+v[0]*vb;g=g*(1-vb)+v[1]*vb;b=b*(1-vb)+v[2]*vb;
  const road=Math.min(Math.abs(x),Math.abs(z)); if(d>VR-6&&d<WORLD_R&&road<3.2){const k=clamp(1-(road-1.8)/1.4,0,1)*.85;r=r*(1-k)+170*k;g=g*(1-k)+146*k;b=b*(1-k)+98*k;}
  return [r,g,b];
}
const GCV=document.createElement('canvas');GCV.width=GCV.height=1024;
(function(){const x=GCV.getContext('2d'),R=rng(11),S=400/1024,N=200,SM=document.createElement('canvas');SM.width=SM.height=N;const sx=SM.getContext('2d'),im=sx.createImageData(N,N);
  for(let py=0;py<N;py++)for(let px=0;px<N;px++){const c=groundRGB((px+.5)/N*400-200,(py+.5)/N*400-200),k=(py*N+px)*4;im.data[k]=c[0];im.data[k+1]=c[1];im.data[k+2]=c[2];im.data[k+3]=255;}
  sx.putImageData(im,0,0);x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(SM,0,0,1024,1024);
  /* detay: çim/toprak benekleri ve lekeler */
  for(let i=0;i<9000;i++){const px=R()*1024,py=R()*1024,r=6+R()*22,d=(R()-.5)*16;x.fillStyle=d>0?`rgba(255,255,230,${(d/16*.07).toFixed(3)})`:`rgba(0,10,0,${(-d/16*.09).toFixed(3)})`;x.beginPath();x.arc(px,py,r,0,6.283);x.fill();}
  const bd=sx.getImageData(0,0,N,N).data;
  for(let i=0;i<60000;i++){const px=R()*1024,py=R()*1024,k=((py/1024*N|0)*N+(px/1024*N|0))*4,v=(R()-.5)*46,h=1.5+R()*4;
    x.fillStyle=`rgb(${clamp(bd[k]+v,0,255)|0},${clamp(bd[k+1]+v*1.1,0,255)|0},${clamp(bd[k+2]+v*.8,0,255)|0})`;x.fillRect(px,py,1.3,h);}
  x.strokeStyle='rgba(120,100,70,.85)';x.lineWidth=5;x.beginPath();x.arc(512,512,VR/S,0,Math.PI*2);x.stroke();
})();
const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshLambertMaterial({map:(()=>{const t=new THREE.CanvasTexture(GCV);try{t.anisotropy=renderer.capabilities.getMaxAnisotropy();}catch(e){}return t;})()}));
ground.rotation.x=-Math.PI/2;scene.add(ground);
/* zindan zemini */
const dgFloor=new THREE.Mesh(new THREE.CircleGeometry(DG.r+4,32),new THREE.MeshLambertMaterial({color:0x3a3240}));dgFloor.rotation.x=-Math.PI/2;dgFloor.position.set(DG.x,.02,DG.z);scene.add(dgFloor);

const obstacles=[];
const M={trunk:new THREE.MeshLambertMaterial({color:0x6a4524}),leaf:new THREE.MeshLambertMaterial({color:0x2f8a30}),leaf2:new THREE.MeshLambertMaterial({color:0x44a83c}),rock:new THREE.MeshLambertMaterial({color:0x8a8a90,flatShading:true}),
  cactus:new THREE.MeshLambertMaterial({color:0x4a9a4a}),sleaf:new THREE.MeshLambertMaterial({color:0xe6f2fa}),sleaf2:new THREE.MeshLambertMaterial({color:0xbfd8ea}),dead:new THREE.MeshLambertMaterial({color:0x3a3028}),
  wall:new THREE.MeshLambertMaterial({color:0xc9b48a}),roof:new THREE.MeshLambertMaterial({color:0xa83a2a}),wood:new THREE.MeshLambertMaterial({color:0x7a5230}),stone:new THREE.MeshLambertMaterial({color:0x9a9aa2}),
  torch:new THREE.MeshBasicMaterial({color:0xffc040}),cave:new THREE.MeshLambertMaterial({color:0x4a3f52,flatShading:true})};
const G={trunk:new THREE.CylinderGeometry(.28,.4,2.4,6),cone1:new THREE.ConeGeometry(1.5,3.2,7),cone2:new THREE.ConeGeometry(1.15,2.4,7),rock:new THREE.IcosahedronGeometry(1,0),cact:new THREE.CylinderGeometry(.35,.4,3,6),arm:new THREE.CylinderGeometry(.2,.2,1,5),box:new THREE.BoxGeometry(1,1,1),roof:new THREE.ConeGeometry(1,1,4)};
function stat(g,x,z,rad,ry){g.position.set(x,0,z);g.rotation.y=ry||0;scene.add(g);if(g.updateMatrix){g.updateMatrix();g.matrixAutoUpdate=false;}if(rad)obstacles.push({x,z,r:rad});}
function mkTree(kind,s){const g=new THREE.Group();
  if(kind==='forest'||kind==='snow'){const lm=kind==='snow'?M.sleaf:M.leaf,lm2=kind==='snow'?M.sleaf2:M.leaf2;
    const t=new THREE.Mesh(G.trunk,M.trunk);t.position.y=1.2;const a=new THREE.Mesh(G.cone1,lm);a.position.y=3.4;const b=new THREE.Mesh(G.cone2,lm2);b.position.y=5;g.add(t,a,b);}
  else if(kind==='desert'){const t=new THREE.Mesh(G.cact,M.cactus);t.position.y=1.5;const a=new THREE.Mesh(G.arm,M.cactus);a.position.set(.5,1.8,0);a.rotation.z=1.2;g.add(t,a);}
  else{const t=new THREE.Mesh(G.trunk,M.dead);t.position.y=1.4;t.scale.set(1,1.3,1);const a=new THREE.Mesh(G.arm,M.dead);a.position.set(.5,2.6,0);a.rotation.z=.9;const b=a.clone();b.position.set(-.4,2.2,0);b.rotation.z=-1;g.add(t,a,b);}
  g.scale.setScalar(s);return g;}
const KN_ITEMS=[];
/* bölgeye göre doğa parçaları (Kenney Nature Kit) */
const NZ={
  forest:{trees:['tree_default','tree_oak','tree_tall','tree_fat','tree_detailed','tree_small','tree_simple','tree_default'],k:[3.2,4.8],r:.7,tint:null,
    deco:['plant_bush','plant_bushLarge','plant_bushSmall','grass_large','grass','grass_leafs','flower_redA','flower_yellowA','flower_purpleA','mushroom_redGroup','mushroom_tanGroup','log','stump_old','rock_smallA','rock_smallC'],dk:[2.2,3.2],dn:150,dt:null},
  snow:{trees:['tree_pineTallA','tree_pineTallB','tree_pineTallC','tree_pineRoundA','tree_pineRoundC','tree_pineSmallA','tree_pineSmallB','tree_cone'],k:[3.4,5],r:.7,tint:[.9,.95,1,.38],
    deco:['rock_largeA','rock_largeB','rock_smallA','rock_smallC','rock_tallA','stone_smallA','stone_largeA','plant_bushSmall','log'],dk:[2.2,3.4],dn:70,dt:[.92,.96,1,.65]},
  desert:{trees:['cactus_tall','cactus_short','cactus_tall','cactus_short','tree_palm','tree_palmTall','tree_palmBend'],k:[2.8,4],r:.6,tint:null,
    deco:['rock_largeA','rock_largeC','rock_smallA','rock_smallFlatA','rock_tallC','stone_smallA','plant_bushSmall','log','stump_old','statue_columnDamaged'],dk:[2.2,3.6],dn:70,dt:[.9,.72,.45,.45]},
  swamp:{trees:['tree_default_dark','tree_oak_dark','tree_tall_dark','tree_thin_dark','tree_default_dark','tree_oak_dark'],k:[3,4.6],r:.7,tint:[.18,.26,.12,.35],
    deco:['mushroom_redGroup','mushroom_tanGroup','mushroom_redTall','plant_bush','plant_bushDetailed','grass_large','log','log_large','stump_old','stump_round','hanging_moss'],dk:[2,3.2],dn:100,dt:[.15,.2,.1,.3]}};
(function buildWorld(){
  const R=rng(7),cnt={forest:46,desert:24,snow:34,swamp:30};
  for(const z of ZK){let n=0,guard=0;
    while(n<cnt[z]&&guard++<800){const r=VR+8+R()*(WORLD_R-VR-12),a=R()*Math.PI*2,x=Math.cos(a)*r,zz=Math.sin(a)*r;
      if(zoneAt(x,zz)!==z)continue; if(Math.min(Math.abs(x),Math.abs(zz))<4.5)continue;
      const s=.8+R()*.7;
      if(KN_OK&&NZ[z]){const Z=NZ[z],nm=Z.trees[Math.floor(R()*Z.trees.length)],k=Z.k[0]+R()*(Z.k[1]-Z.k[0]);KN_ITEMS.push({n:nm,x,y:0,z:zz,sx:k,sy:k*(.9+R()*.3),sz:k,ry:R()*6.28,tint:Z.tint});obstacles.push({x,z:zz,r:Z.r*k/3.6});n++;continue;}
      stat(mkTree(z,s),x,zz,z==='desert'?.45*s:.55*s,R()*6);n++;}
    if(KN_OK&&NZ[z]){const Z=NZ[z];for(let i=0,tr=0;i<Z.dn&&tr<900;tr++){const r=VR+7+R()*(WORLD_R-VR-10),a=R()*Math.PI*2,x=Math.cos(a)*r,zz=Math.sin(a)*r;if(zoneAt(x,zz)!==z)continue;
        const nm=Z.deco[Math.floor(R()*Z.deco.length)],big=/^(rock_large|stone_large|rock_tall|statue|log_large)/.test(nm),k=Z.dk[0]+R()*(Z.dk[1]-Z.dk[0]);
        KN_ITEMS.push({n:nm,x,y:0,z:zz,sx:k,sy:k,sz:k,ry:R()*6.28,tint:Z.dt});if(big)obstacles.push({x,z:zz,r:k*.55});i++;}continue;}
    for(let i=0;i<10;i++){const r=VR+8+R()*(WORLD_R-VR-12),a=R()*Math.PI*2,x=Math.cos(a)*r,zz=Math.sin(a)*r;if(zoneAt(x,zz)!==z||Math.min(Math.abs(x),Math.abs(zz))<4.5)continue;
      const g=new THREE.Group(),rk=new THREE.Mesh(G.rock,M.rock),sx=.8+R()*.9;rk.position.y=.5;rk.scale.set(sx,.5+R()*.7,sx);rk.rotation.set(R(),R(),R());g.add(rk);stat(g,x,zz,sx*.85,0);}
  }
  /* köy */
  const houses=[[-17,-14,5,4,0],[17,-14,5,4,0],[-19,12,5,4,.3],[19,10,5,4,-.3],[-4,21,5,4,0],[8,-22,4,3.5,0]];
  if(KN_OK){houses.forEach(h=>{const x=h[0],z=h[1],r=Math.hypot(x,z),th=Math.atan2(x,z),sx=h[3]+.3,sz=h[2]+.6,sy=3.1;
      KN_ITEMS.push({n:'wall-door',x,y:0,z,sx,sy,sz,ry:th},{n:'roof',x,y:sy,z,sx:sx+.5,sy:2.7,sz:sz+.5,ry:th});
      const fx=-Math.sin(th),fz=-Math.cos(th),px=Math.cos(th),pz=-Math.sin(th);/* kapı yönü ve yan yön */
      KN_ITEMS.push({n:'detail-crate',x:x+fx*(sz/2+.9)+px*1.4,y:0,z:z+fz*(sz/2+.9)+pz*1.4,sx:3.4,ry:th+.4},{n:'detail-barrel',x:x+fx*(sz/2+.9)-px*1.5,y:0,z:z+fz*(sz/2+.9)-pz*1.5,sx:3.2,ry:0});
      obstacles.push({x,z,r:Math.max(sx,sz)*.58});});}
  else houses.forEach(h=>{const g=new THREE.Group(),b=new THREE.Mesh(G.box,M.wall);b.scale.set(h[2],3,h[3]);b.position.y=1.5;const r=new THREE.Mesh(G.roof,M.roof);r.scale.set(h[2]*.85,2.4,h[3]*.85);r.rotation.y=Math.PI/4;r.position.y=4.2;g.add(b,r);stat(g,h[0],h[1],Math.max(h[2],h[3])*.62,h[4]);});
  const fo=new THREE.Group(),fb=new THREE.Mesh(new THREE.CylinderGeometry(2,2.2,.8,12),M.stone);fb.position.y=.4;const fp=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,2,6),M.stone);fp.position.y=1.4;fo.add(fb,fp);stat(fo,0,0,2.4,0);
  [[-24,-24],[24,-24],[-24,24],[24,24],[0,-26],[0,26],[-26,0],[26,0]].forEach(p=>{const g=new THREE.Group(),po=new THREE.Mesh(G.trunk,M.wood);po.position.y=1.2;po.scale.set(.4,1,.4);const fl=new THREE.Mesh(new THREE.SphereGeometry(.28,6,6),M.torch);fl.position.y=2.6;g.add(po,fl);stat(g,p[0],p[1],.3,0);});
  if(KN_OK){const RR=27.5,GW=11.5*Math.PI/180;
    for(let i=0;i<72;i++){const a=i/72*Math.PI*2;let d=a%(Math.PI/2);d=Math.min(d,Math.PI/2-d);const nearGate=d<GW+.05;
      if(nearGate)continue;const x=Math.cos(a)*RR,z=Math.sin(a)*RR;KN_ITEMS.push({n:'wall-fortified',x,y:0,z,sx:2.7,sy:3,sz:2.3,ry:Math.PI/2-a});obstacles.push({x,z,r:1.5});}
    for(let q=0;q<4;q++)for(const sg of [-1,1]){const a=q*Math.PI/2+sg*GW,x=Math.cos(a)*RR,z=Math.sin(a)*RR;
      KN_ITEMS.push({n:'tower',x,y:0,z,sx:3.6,sy:4.4,sz:3.6,ry:0},{n:'tower-top',x,y:4.4,z,sx:3.6,sy:1.6,sz:3.6,ry:0});obstacles.push({x,z,r:2});}
    scene.add(knMerge(KN_ITEMS));}
  /* zindan duvarı + giriş kapısı */
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2,g=new THREE.Group(),rk=new THREE.Mesh(G.rock,M.cave);rk.position.y=1.5;rk.scale.set(3,3.5,3);g.add(rk);stat(g,DG.x+Math.cos(a)*(DG.r+2),DG.z+Math.sin(a)*(DG.r+2),3.2,0);}
  const pg=new THREE.Group(),ring=new THREE.Mesh(new THREE.TorusGeometry(2,.3,8,16),new THREE.MeshBasicMaterial({color:0xaa44ff}));ring.position.y=2.4;pg.add(ring);stat(pg,0,-17,0,0);
})();
function pushOut(p,rad){for(const o of obstacles){const dx=p.x-o.x,dz=p.z-o.z,min=o.r+rad,d2=dx*dx+dz*dz;if(d2<min*min){const d=Math.sqrt(d2)||.001;p.x=o.x+dx/d*min;p.z=o.z+dz/d*min;}}}
/* küçük harita: dünya dokusu + noktalar */
const miniCv=$('miniCv'),mctx=miniCv.getContext('2d');
function drawMini(px,pz,inDg,ents){
  mctx.save();mctx.clearRect(0,0,104,104);mctx.beginPath();mctx.arc(52,52,52,0,Math.PI*2);mctx.clip();
  if(inDg){mctx.fillStyle='#3a3240';mctx.fillRect(0,0,104,104);} else {const S=512/400,view=70,sx=(px+200-view/2)*S,sz=(pz+200-view/2)*S;mctx.drawImage(GCV,sx,sz,view*S,view*S,0,0,104,104);}
  const sc=104/70,ox=inDg?DG.x:px,oz=inDg?DG.z:pz;
  const dot=(x,z,c,r)=>{const X=52+(x-px)*sc,Z=52+(z-pz)*sc;if(X<-4||X>108||Z<-4||Z>108)return;mctx.fillStyle=c;mctx.beginPath();mctx.arc(X,Z,r,0,6.3);mctx.fill();};
  ents.forEach(e=>dot(e.x,e.z,e.c,e.r));
  mctx.fillStyle='#fff';mctx.strokeStyle='#000';mctx.lineWidth=1;mctx.beginPath();mctx.arc(52,52,3.5,0,6.3);mctx.fill();mctx.stroke();mctx.restore();
}

/* =========================================================
   3. VERİ: sınıflar, yetenekler, düşman türleri, eşya
   ========================================================= */
const UNLOCK=[1,4,8,14];
const CLASSES={
  savasci:{name:'Savaşçı',icon:'🛡',desc:'Yüksek can, güçlü yakın dövüş.',hp:130,mp:40,dmg:14,speed:6.0,color:0x2f5fa8,skills:[
    {n:'Kılıç Girdabı',t:'aoe',mp:14,cd:4,dm:1.5,r:3.6,col:0xff8844},{n:'Savaş Çığlığı',t:'buff',mp:18,cd:10,b:'dmg',v:.4,dur:6,col:0xffcc00},
    {n:'Sarsıcı Darbe',t:'single',mp:22,cd:8,dm:3,stun:1.5,col:0xffaa22},{n:'Demir Deri',t:'buff',mp:25,cd:16,b:'def',v:.4,dur:8,col:0x99aacc}]},
  ninja:{name:'Ninja',icon:'🗡',desc:'Hızlı, çevik, yüksek kritik.',hp:90,mp:60,dmg:12,speed:7.4,color:0x3a3a4a,skills:[
    {n:'Ok Yağmuru',t:'aoe',mp:16,cd:3.5,dm:1.2,r:5.5,col:0x88ff88},{n:'Gölge Adım',t:'buff',mp:15,cd:8,b:'speed',v:.6,dur:5,col:0x66ccff},
    {n:'Zehirli Ok',t:'single',mp:20,cd:6,dm:1.4,dot:.5,col:0x66ff44},{n:'Duman Bombası',t:'aoe',mp:26,cd:14,dm:.5,r:5,stun:1.2,slow:true,col:0xbbbbbb}]},
  sura:{name:'Sura',icon:'🔮',desc:'Kılıç ve kara büyü ustası.',hp:105,mp:70,dmg:13,speed:6.4,color:0x5a1a6a,skills:[
    {n:'Kara Büyü',t:'aoe',mp:20,cd:5,dm:1.7,r:4,slow:true,col:0xaa44ff},{n:'Kılıç Alevi',t:'buff',mp:16,cd:6,b:'dmg',v:.35,dur:6,col:0xff5522},
    {n:'Ruh Emişi',t:'single',mp:24,cd:8,dm:2.2,leech:.4,col:0xdd44aa},{n:'Karanlık Küre',t:'aoe',mp:40,cd:14,dm:3,r:6,col:0x5522aa}]},
  saman:{name:'Şaman',icon:'✨',desc:'İyileştirme ve destek büyüleri.',hp:85,mp:90,dmg:10,speed:6.2,color:0x2a7a5a,skills:[
    {n:'İyileştirme',t:'heal',mp:22,cd:7,v:40,col:0x66ff99},{n:'Ejder Nefesi',t:'aoe',mp:28,cd:8,dm:1.9,r:4.5,col:0xffaa00},
    {n:'Şimşek',t:'chain',mp:26,cd:6,dm:1.6,n:3,col:0xffff66},{n:'Kutsama',t:'buff',mp:30,cd:20,b:'def',v:.25,regen:3,dur:10,col:0xffffaa}]},
  lykaner:{name:'Lykaner',icon:'🐺',desc:'Pençe darbeleriyle vahşi yakın dövüş.',hp:115,mp:50,dmg:13,speed:6.8,color:0x6b4a1e,skills:[
    {n:'Pençe Darbesi',t:'aoe',mp:12,cd:3,dm:1.4,r:2.8,col:0xff4444},{n:'Kurt Çağırma',t:'buff',mp:25,cd:12,b:'dmg',v:.6,dur:6,col:0xcccccc},
    {n:'Kükreme',t:'aoe',mp:24,cd:12,dm:.8,r:4.5,stun:1,col:0xff8855},{n:'Parçalama',t:'single',mp:22,cd:7,dm:2,dot:.6,col:0xcc2222}]},
  okcu:{name:'Okçu',icon:'🏹',desc:'Uzaktan ok yağdırır, yüksek kritik.',hp:95,mp:55,dmg:12,speed:6.8,color:0x6b2a1e,ranged:true,critB:8,skills:[
    {n:'Çoklu Ok',t:'aoe',mp:16,cd:4,dm:1.4,r:6,col:0xffcc44},{n:'Kartal Gözü',t:'buff',mp:20,cd:10,b:'dmg',v:.6,dur:6,col:0x88ff44},
    {n:'Zehirli Ok',t:'single',mp:22,cd:7,dm:1.8,dot:.7,rng:14,col:0x88ff44},{n:'Ok Fırtınası',t:'aoe',mp:40,cd:16,dm:2.6,r:5.5,col:0xffaa00}]}
};
/* düşman türleri: b=gövde, pal=[ten,giysi,koyu,göz] */
const SP={
  orc:{n:'Ork',b:'orc',pal:[0x6b4230,0x4a3b28,0x2f2318,0xff5522],sc:1,hp:1,dm:1,sp:3.8,cd:1.85},
  orcw:{n:'Ork Savaşçısı',b:'orc',pal:[0x8f2020,0x5a1010,0x3a0a0a,0xffdd00],sc:1.35,hp:2.2,dm:1.7,sp:3.2,cd:1.5},
  wolf:{n:'Kurt',b:'wolf',pal:[0x6e6e78,0x2a2a30,0xffcc22],sc:1,hp:.7,dm:.8,sp:6,cd:1.1},
  scor:{n:'Akrep',b:'scor',pal:[0x9a6a2a,0x4a2a10,0xff3300],sc:1,hp:.9,dm:1.1,sp:4.6,cd:1.3},
  skel:{n:'İskelet',mdl:'Skeleton',b:'orc',pal:[0xe0dccb,0x8a8570,0x55524a,0x66ccff],sc:1.05,hp:1.1,dm:1.2,sp:3.6,cd:1.7},
  iwolf:{n:'Buz Kurdu',b:'wolf',pal:[0xdde8f2,0x6a8aa8,0x55ddff],sc:1.1,hp:1,dm:1,sp:6.4,cd:1.1},
  yeti:{n:'Yeti',b:'orc',pal:[0xeaf2f8,0x9bb4c8,0x5a7288,0x4488ff],sc:1.6,hp:2.6,dm:1.8,sp:3,cd:1.8},
  ghoul:{n:'Gul',b:'orc',pal:[0x4a6a3a,0x2a3a22,0x1a2414,0xccff33],sc:1.1,hp:1.3,dm:1.4,sp:3.6,cd:1.6},
  shade:{n:'Gölge',b:'orc',pal:[0x2a1a3a,0x150a22,0x0a0512,0xaa44ff],sc:1.25,hp:1.6,dm:1.8,sp:4.2,cd:1.5},
  boss_forest:{n:'Ork Reisi',b:'orc',pal:[0x4a2a6a,0x2a1040,0x1a0a2a,0xff44ff],sc:2.2,hp:14,dm:3,sp:2.8,cd:1.6,boss:1},
  boss_desert:{n:'Çöl Kralı',b:'scor',pal:[0x6a3a10,0x2a1405,0xff0000],sc:2.8,hp:14,dm:3,sp:3.2,cd:1.5,boss:1},
  boss_snow:{n:'Buz Ejderi',mdl:'Dragon',tint:0x9fd8ff,b:'orc',pal:[0xcfe6ff,0x6a8aa8,0x2a4a68,0x88ddff],sc:2.8,hp:14,dm:3,sp:2.8,cd:1.7,boss:1},
  boss_swamp:{n:'Gölge Ejderi',mdl:'Dragon',tint:0x7a3aa8,b:'orc',pal:[0x14081f,0x0a0412,0x05020a,0xff2266],sc:2.8,hp:14,dm:3.2,sp:3.2,cd:1.5,boss:1},
  slime:{n:'Jöle',mdl:'Slime',b:'slime',pal:[0x44cc66,0x2a8a44,0x1a5a2a,0xffffff],sc:1,hp:.8,dm:.7,sp:2.6,cd:1.6},
  bat:{n:'Yarasa',mdl:'Bat',b:'wolf',pal:[0x3a2a4a,0x1a1022,0xff3366],sc:1,hp:.6,dm:.8,sp:6.5,cd:1.0},
  firebat:{n:'Ateş Yarasası',mdl:'Bat',tint:0xff7a40,b:'wolf',pal:[0x8a2a10,0x4a1005,0xffaa00],sc:1.1,hp:.8,dm:1.1,sp:6.5,cd:1.0},
  iskel:{n:'Buz İskeleti',mdl:'Skeleton',tint:0x9fd8ff,b:'orc',pal:[0xcfe6ff,0x6a8aa8,0x2a4a68,0x88ddff],sc:1.1,hp:1.2,dm:1.3,sp:3.6,cd:1.6},
  islime:{n:'Buz Jölesi',mdl:'Slime',tint:0x7fd4ff,b:'slime',pal:[0x7fd4ff,0x4a8ab0,0x2a5a80,0xffffff],sc:1.15,hp:1,dm:.9,sp:2.8,cd:1.6},
  pslime:{n:'Zehir Jölesi',mdl:'Slime',tint:0xa040e0,b:'slime',pal:[0xa040e0,0x602a90,0x301050,0xffffff],sc:1.2,hp:1.2,dm:1.2,sp:2.8,cd:1.5},
  sandskel:{n:'Kum İskeleti',mdl:'Skeleton',tint:0xe8c070,b:'orc',pal:[0xe8c070,0x8a7040,0x55401a,0xffaa44],sc:1.1,hp:1.1,dm:1.2,sp:3.6,cd:1.7},
  boss_world:{n:'Dünya Ejderhası',mdl:'Dragon',tint:0xff4422,b:'orc',pal:[0x8a1a10,0x4a0a05,0x2a0402,0xffdd00],sc:3.6,hp:45,dm:4.2,sp:3.4,cd:1.3,boss:1,world:1},
  archer:{n:'Okçu Ork',b:'orc',pal:[0x6b5030,0x3a4a22,0x24301a,0xffaa44],sc:1,hp:.8,dm:1,sp:3.2,cd:2.2,rng:11,proj:0xffaa44},
  mage:{n:'Kara Büyücü',b:'orc',pal:[0x4a3a6a,0x2a1a4a,0x150a28,0xaa44ff],sc:1,hp:.7,dm:1.3,sp:2.8,cd:2.6,rng:12,proj:0xaa44ff},
  tank:{n:'Zırhlı Muhafız',b:'orc',pal:[0x7a7a88,0x4a4a5a,0x2a2a34,0xffffff],sc:1.5,hp:3.2,dm:1.6,sp:2.6,cd:2},
  elite:{n:'Elit Ork',b:'orc',pal:[0x8f2a20,0x5a1a10,0x2a0a08,0xffdd00],sc:1.45,hp:2.6,dm:2,sp:3.2,cd:1.6},
  boss_spider:{n:'Örümcek Kraliçe',b:'scor',pal:[0x2a1a2a,0x120a14,0xff2288],sc:3.2,hp:18,dm:3.4,sp:3.4,cd:1.4,boss:1},
  boss_sohan:{n:'Sohan Efendisi',mdl:'Dragon',b:'orc',pal:[0x3a3a5a,0x1a1a30,0x0a0a18,0x66aaff],sc:3,hp:22,dm:3.8,sp:3,cd:1.4,boss:1},
  boss_cave:{n:'Mağara Ağası',b:'orc',pal:[0x6a2a2a,0x3a1010,0x1a0505,0xffaa00],sc:2.6,hp:16,dm:3,sp:3,cd:1.5,boss:1}
};
const ZMOBS={forest:['orc','wolf','orcw','archer','slime','bat'],desert:['scor','skel','scor','archer','elite','sandskel','firebat'],snow:['iwolf','yeti','iwolf','mage','iskel','islime'],swamp:['ghoul','shade','ghoul','mage','tank','bat','pslime']};
const METIN_TYPES={forest:{n:'Orman Metini',col:0x44dd66},desert:{n:'Ateş Metini',col:0xff7733},snow:{n:'Buz Metini',col:0x66ddff},swamp:{n:'Gölge Metini',col:0xaa55ff}};
/* eşya */
const SLOTS={weapon:{n:'Silah',i:'⚔',base:6},armor:{n:'Zırh',i:'🛡',base:4},helm:{n:'Kask',i:'⛑',base:2},boots:{n:'Bot',i:'👢',base:1.5},shield:{n:'Kalkan',i:'🔰',base:2},ring:{n:'Yüzük',i:'💍',base:1},neck:{n:'Kolye',i:'📿',base:1},
  earring:{n:'Küpe',i:'💎',base:1},bracelet:{n:'Bilezik',i:'⌚',base:1.5},belt:{n:'Kemer',i:'🥋',base:2},wings:{n:'Kanat',i:'🪽',base:1.5}};
const SLOTKEYS=Object.keys(SLOTS);
const RARITIES=[{key:'common',name:'Sıradan',color:'#ddd',mul:1,aff:0},{key:'uncommon',name:'Az Bulunan',color:'#6f6',mul:1.25,aff:1},{key:'rare',name:'Nadir',color:'#6af',mul:1.6,aff:2},{key:'epic',name:'Destansı',color:'#d9f',mul:2.1,aff:3},{key:'legendary',name:'Efsanevi',color:'#fa3',mul:2.8,aff:4}];
const AFFIX={atk:{n:'Saldırı',u:'%',lo:3,hi:10},crit:{n:'Kritik',u:'%',lo:2,hi:6},def:{n:'Savunma',u:'%',lo:3,hi:9},hp:{n:'Can',u:'',lo:30,hi:110},mp:{n:'Mana',u:'',lo:20,hi:70},
  spd:{n:'Hız',u:'%',lo:2,hi:6},xp:{n:'Tecrübe',u:'%',lo:3,hi:10},yang:{n:'Yang',u:'%',lo:5,hi:15},skill:{n:'Yetenek',u:'%',lo:4,hi:12}};
const AFFKEYS=Object.keys(AFFIX);
const SHOP=[{id:'hpPot',n:'Kırmızı İksir',d:'Canın %35\'ini yeniler',p:40,i:'🧪'},{id:'mpPot',n:'Mavi İksir',d:'Manan %35 yenilenir',p:40,i:'💧'},
  {id:'bless',n:'Kutsama Kitabı',d:'Geliştirmede eşya kırılmasını önler',p:400,i:'📖'},{id:'dgKey',n:'Zindan Anahtarı',d:'Ork Mağarası girişi',p:200,i:'🗝'},{id:'petEgg',n:'Evcil Hayvan Yumurtası',d:'İçinden rastgele bir pet çıkar',p:1200,i:'🥚'},{id:'horse',n:'At',d:'Hızlı binek (bir kez alınır)',p:1500,i:'🐎'}];
const UP_RATE=[1,1,1,1,.8,.65,.5,.4,.3,.2,.14,.1,.07,.05,.03]; /* +0'dan +9'a; index = mevcut seviye */
const UP_MAX=15;

/* ---- Genişleme verisi ---- */
const MATS={tooth:{n:'Ork Dişi',i:'🦷'},sting:{n:'Akrep Zehri',i:'☠'},shard:{n:'Buz Kırığı',i:'🧊'},soul:{n:'Ruh Tozu',i:'💠'},book:{n:'Beceri Kitabı',i:'📘'},eshard:{n:'Element Kırığı',i:'🔷'}};
const MATKEYS=Object.keys(MATS);
const ZMAT={forest:'tooth',desert:'sting',snow:'shard',swamp:'soul'};
function upMats(lv){if(lv<5)return null;if(lv<7)return {tooth:4};if(lv===7)return {tooth:6,sting:4};if(lv<9)return {tooth:8,sting:6,shard:4,soul:2};return {tooth:8,sting:6,shard:4,soul:2,eshard:lv-8};}
const ELEMENTS={fire:{n:'🔥 Ateşli',d:'Vuruşta yakar'},ice:{n:'❄ Buzlu',d:'Vuruşta dondurur/yavaşlatır'},poison:{n:'☠ Zehirli',d:'Vuruşta zehirler'}};
const DGS=[
  {id:'cave',n:'Ork Mağarası',min:8,waves:3,per:5,mobs:['orc','orcw','skel'],boss:'boss_cave',mul:1,fog:0x1c1522},
  {id:'spider',n:'Örümcek Yuvası',min:15,waves:4,per:6,mobs:['wolf','archer','scor','elite'],boss:'boss_spider',mul:1.5,fog:0x1a1226},
  {id:'sohan',n:'Sohan Kalesi',min:25,waves:5,per:6,mobs:['tank','mage','archer','elite'],boss:'boss_sohan',mul:2.2,fog:0x12182a}];
const KINGDOMS=[{id:'aslan',n:'Kızıl Aslan',c:'#ff8a8a',d:'+%4 saldırı',bon:{atk:4}},{id:'kurt',n:'Mavi Kurt',c:'#8ac4ff',d:'+%4 savunma',bon:{def:4}},{id:'kartal',n:'Altın Kartal',c:'#ffd76a',d:'+%5 tecrübe',bon:{xp:5}}];
const PETS={slime:{n:'Yeşil Balçık',col:0x66dd66,bon:{yang:10},d:'Yang +%10'},kurt:{n:'Kurt Yavrusu',col:0x9a9aa8,bon:{atk:6},d:'Saldırı +%6'},ruh:{n:'Ateş Ruhu',col:0xff9a44,bon:{xp:8},d:'Tecrübe +%8'},bayku:{n:'Gece Baykuşu',col:0x6a5aa8,bon:{crit:4},d:'Kritik +%4'},ejder:{n:'Mini Ejder',col:0xdd4433,bon:{atk:5,crit:3},d:'Saldırı +%5, Kritik +%3'},tilki:{n:'Ateş Tilkisi',col:0xee8833,bon:{spd:5,xp:4},d:'Hız +%5, Tecrübe +%4'},kartal:{n:'Altın Kartal',col:0xd9b84a,bon:{crit:5,def:3},d:'Kritik +%5, Savunma +%3'},kedi:{n:'Gölge Kedisi',col:0x44445a,bon:{hp:60,yang:6},d:'Can +60, Yang +%6'}};
const PETKEYS=Object.keys(PETS);
const sEff=L=>L<=10?L:10+(L-10)*.55;
const skLv=L=>L<=10?'Sv '+L:L<=15?'M'+(L-10):'G'+(L-15);

/* =========================================================
   4. OYUNCU, MODELLER
   ========================================================= */
const player={group:new THREE.Group(),cls:null,name:'Kahraman',hp:100,maxHp:100,mp:50,maxMp:50,level:1,xp:0,xpNext:50,speed:6.4,baseDmg:14,crit:5,dodge:0,defPct:0,
  atkCd:0,atkAnim:0,hitTimer:-1,invuln:0,walkPhase:0,alive:true,skillCd:[0,0,0,0],buffs:{},potCd:0,yang:0,inventory:[],equipped:{},
  pots:{hp:5,mp:3},scrolls:{bless:0},keys:0,shards:0,horse:false,mounted:false,pts:0,attr:{st:5,dx:5,ht:5,iq:5},sp:2,skills:[1,0,0,0],arena:0,
  quests:[],stats:{kills:0,metins:0,pvpWin:0,pvpLoss:0,bosses:0,dungeons:0},bon:{},bodyY:0};
const istat=it=>Math.round(it.stat*(1+it.up*.14));
function rarClr(it){return RARITIES.find(r=>r.key===it.rarity).color;}
function buildHuman(clsKey,isPlayer,eq,tint){
  eq=eq||{};const cls=CLASSES[clsKey],g=new THREE.Group();
  const bodyCol=tint!==undefined?tint:cls.color;
  const bodyMat=new THREE.MeshLambertMaterial({color:eq.armor&&eq.armor.up>=5?0xffd060:bodyCol}),skinMat=new THREE.MeshLambertMaterial({color:0xf2c496}),darkMat=new THREE.MeshLambertMaterial({color:0x222230});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.36,.62,3,10),bodyMat);torso.position.y=.95;
  const belt=new THREE.Mesh(new THREE.CylinderGeometry(.37,.37,.14,10),new THREE.MeshLambertMaterial({color:0xcaa24a}));belt.position.y=.72;
  const head=new THREE.Mesh(new THREE.SphereGeometry(.31,12,10),skinMat);head.position.y=1.66;
  const hair=new THREE.Mesh(new THREE.SphereGeometry(.34,12,8,0,Math.PI*2,0,Math.PI*.6),new THREE.MeshLambertMaterial({color:isPlayer?0x2a1a10:0x6a4a2a}));hair.position.y=1.7;hair.rotation.x=-.25;
  const legL=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.42,3,6),eq.boots?new THREE.MeshLambertMaterial({color:parseInt(rarClr(eq.boots).slice(1).replace(/^(.)(.)(.)$/,'$1$1$2$2$3$3'),16)}):darkMat);legL.position.set(-.17,.33,0);
  const legR=legL.clone();legR.position.x=.17;
  const cape=new THREE.Mesh(G.box,new THREE.MeshLambertMaterial({color:bodyCol}));cape.scale.set(.6,1.1,.06);cape.position.set(0,1.0,-.38);cape.rotation.x=.12;
  g.add(torso,belt,head,hair,legL,legR,cape);
  if(eq.helm){const hc=new THREE.Mesh(new THREE.ConeGeometry(.3,.4,8),new THREE.MeshLambertMaterial({color:0xb0b8c8}));hc.position.y=2.0;g.add(hc);}
  const arm=new THREE.Group();arm.position.set(.47,1.32,0);
  const armMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.115,.42,3,6),bodyMat);armMesh.position.y=-.28;
  const hand=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),skinMat);hand.position.y=-.55;
  const wc=eq.weapon?new THREE.Color(rarClr(eq.weapon)).getHex():0xdfe6ee,wm=new THREE.MeshLambertMaterial({color:wc,emissive:eq.weapon&&eq.weapon.up>=7?0x553300:0});wm.userData={};
  let weapon;
  if(clsKey==='ninja'){weapon=new THREE.Mesh(new THREE.BoxGeometry(.07,.9,.07),wm);weapon.position.set(0,-1.0,.12);}
  else if(clsKey==='saman'){weapon=new THREE.Mesh(new THREE.CylinderGeometry(.04,.06,1.3,6),new THREE.MeshLambertMaterial({color:0x8a6a2a}));weapon.position.set(0,-1.1,.12);
    const top=new THREE.Mesh(new THREE.SphereGeometry(.16,8,8),new THREE.MeshLambertMaterial({color:wc===0xdfe6ee?0x44ffaa:wc,emissive:0x116644}));top.position.set(0,-1.75,.12);top.userData.keepEm=true;arm.add(top);}
  else if(clsKey==='lykaner'){weapon=new THREE.Mesh(new THREE.ConeGeometry(.12,.6,5),wm);weapon.position.set(0,-.9,.12);weapon.rotation.x=.5;}
  else if(clsKey==='okcu'){weapon=new THREE.Group();const bm=new THREE.MeshLambertMaterial({color:wc===0xdfe6ee?0x8a5a2a:wc}),b0=new THREE.Mesh(G.box,bm);b0.scale.set(.06,.8,.06);const b1=new THREE.Mesh(G.box,bm);b1.scale.set(.06,.5,.06);b1.position.set(0,.55,-.1);b1.rotation.x=.5;
    const b2=new THREE.Mesh(G.box,bm);b2.scale.set(.06,.5,.06);b2.position.set(0,-.55,-.1);b2.rotation.x=-.5;const st=new THREE.Mesh(G.box,new THREE.MeshBasicMaterial({color:0xeeeeee}));st.scale.set(.015,1.5,.015);st.position.set(0,0,-.25);weapon.add(b0,b1,b2,st);weapon.position.set(0,-1.0,.22);}
  else{weapon=new THREE.Mesh(new THREE.BoxGeometry(.09,1.2,.09),wm);weapon.position.set(0,-1.15,.12);const tip=new THREE.Mesh(new THREE.ConeGeometry(.06,.22,4),wm);tip.position.set(0,-1.82,.12);tip.rotation.x=Math.PI;arm.add(tip);}
  arm.add(armMesh,hand,weapon);arm.rotation.x=.28;g.add(arm);g.userData.arm=arm;
  if(eq.shield){const sh=new THREE.Mesh(G.box,new THREE.MeshLambertMaterial({color:0x9a7a3a}));sh.scale.set(.1,.7,.55);sh.position.set(-.62,1.0,.1);g.add(sh);}
  if(eq.wings){const wc2=new THREE.Color(rarClr(eq.wings)).getHex(),wmat=new THREE.MeshLambertMaterial({color:wc2,emissive:0x222222,side:THREE.DoubleSide||2});[-1,1].forEach(sd=>{const w=new THREE.Mesh(G.box,wmat);w.scale.set(.9,1.2,.05);w.position.set(sd*.5,1.25,-.42);w.rotation.z=sd*.5;w.rotation.y=sd*.5;g.add(w);});}
  const sh2=new THREE.Mesh(new THREE.CircleGeometry(.55,14),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.28,depthWrite:false}));sh2.rotation.x=-Math.PI/2;sh2.position.y=.02;sh2.scale.setScalar(1.1);g.add(sh2);
  if(isPlayer)player.armPivot=arm;
  return g;
}
function buildRealHorse(){
  const M=MODELS.at&&MODELS.at.Horse;if(!M||!MODELS.SU)return null;
  try{
    const w=new THREE.Group(),inner=MODELS.SU.clone(M.src);
    inner.traverse(n=>{if(n.isMesh&&n.material){const f=m=>{m=m.clone();if(m.emissive&&m.color)m.emissive.copy(m.color).multiplyScalar(.38);return m;};n.material=Array.isArray(n.material)?n.material.map(f):f(n.material);}});
    inner.scale.multiplyScalar(M.sc);inner.position.set(M.off[0],M.off[1],M.off[2]);w.add(inner);
    const mixer=new THREE.AnimationMixer(inner),A={};
    const mk=(n,re)=>{const c=pickClip(M.clips,re);if(c)A[n]=mixer.clipAction(c);};
    mk('idle',/idle/i);mk('walk',/\|walk$|walk$/i);mk('run',/\|run$|run$/i);
    if(!A.idle)return null;if(!A.walk)A.walk=A.idle;if(!A.run)A.run=A.walk;
    A.idle.play();w.userData.horse={mixer,A,cur:A.idle};w.visible=false;return w;
  }catch(e){return null;}
}
function buildHorse(){
  const rh=buildRealHorse();if(rh)return rh;
  const g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:0x7a4a22}),d=new THREE.MeshLambertMaterial({color:0x2a1a0c});
  const b=new THREE.Mesh(G.box,m);b.scale.set(.7,.7,1.7);b.position.y=.95;const n=new THREE.Mesh(G.box,m);n.scale.set(.3,.8,.35);n.position.set(0,1.4,.85);n.rotation.x=-.4;
  const h=new THREE.Mesh(G.box,m);h.scale.set(.3,.35,.6);h.position.set(0,1.75,1.15);const t=new THREE.Mesh(G.box,d);t.scale.set(.1,.7,.1);t.position.set(0,.95,-1);t.rotation.x=.4;g.add(b,n,h,t);
  [[-.25,.6],[.25,.6],[-.25,-.6],[.25,-.6]].forEach(p=>{const l=new THREE.Mesh(G.box,d);l.scale.set(.15,.75,.15);l.position.set(p[0],.38,p[1]);g.add(l);});
  g.position.y=0;g.visible=false;return g;
}
let playerLbl=null,horseMesh=null;
function rebuildPlayer(){
  while(player.group.children.length)player.group.children.pop();
  const hb=buildHero(player.cls,true,player.equipped);player.hero=hb?hb.userData.hero:null;
  if(hb){player.armPivot=null;player.group.add(hb);}else player.group.add(buildHuman(player.cls,true,player.equipped));horseMesh=buildHorse();player.group.add(horseMesh);paintMount();
  if(!playerLbl)playerLbl=makeLabel(player.name,'me');playerLbl.textContent=player.name;
}
function paintMount(){const on=player.mounted&&player.horse;if(horseMesh)horseMesh.visible=!!on;const rh=!!(horseMesh&&horseMesh.userData.horse);player.bodyY=on?(rh?1.12:.85):0;{const b0=player.group.children[0];if(b0&&player.hero)b0.position.z=(on&&rh)?.33:0;}$('mountBtn').style.background=on?'linear-gradient(180deg,#c99a3a,#7a5518)':'';}

/* =========================================================
   5. DÜŞMANLAR
   ========================================================= */
const enemies=[];let duel=null,target=null,dungeon=null;
function buildSlimeM(pal){const g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:pal[0]});const b=new THREE.Mesh(new THREE.SphereGeometry(.55,12,9),m);b.scale.set(1,.8,1);b.position.y=.45;g.add(b);
  const e=new THREE.MeshBasicMaterial({color:0x111111});[-.18,.18].forEach(x=>{const o=new THREE.Mesh(new THREE.SphereGeometry(.07,6,6),e);o.position.set(x,.6,.46);g.add(o);});return g;}
function buildOrcM(pal,boss){
  const g=new THREE.Group(),skin=new THREE.MeshLambertMaterial({color:pal[0]}),cloth=new THREE.MeshLambertMaterial({color:pal[1]}),dark=new THREE.MeshLambertMaterial({color:pal[2]});
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.66,3,9),cloth);torso.position.y=.95;const head=new THREE.Mesh(new THREE.SphereGeometry(.34,10,9),skin);head.position.y=1.62;
  const hg=new THREE.ConeGeometry(.09,.42,5),hL=new THREE.Mesh(hg,dark);hL.position.set(-.19,1.92,0);hL.rotation.z=.45;const hR=new THREE.Mesh(hg,dark);hR.position.set(.19,1.92,0);hR.rotation.z=-.45;
  const eg=new THREE.SphereGeometry(.055,6,6),em=new THREE.MeshBasicMaterial({color:pal[3]});const eL=new THREE.Mesh(eg,em);eL.position.set(-.12,1.66,.29);const eR=new THREE.Mesh(eg,em);eR.position.set(.12,1.66,.29);
  const ag=new THREE.CapsuleGeometry(.115,.44,3,6),aL=new THREE.Mesh(ag,skin);aL.position.set(-.52,1.02,0);aL.rotation.z=.22;const aR=new THREE.Mesh(ag,skin);aR.position.set(.52,1.02,0);aR.rotation.z=-.22;
  const lg=new THREE.CapsuleGeometry(.15,.4,3,6),lL=new THREE.Mesh(lg,dark);lL.position.set(-.19,.32,0);const lR=new THREE.Mesh(lg,dark);lR.position.set(.19,.32,0);
  g.add(torso,head,hL,hR,eL,eR,aL,aR,lL,lR);const club=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,.95,6),dark);club.position.set(.62,.85,.1);club.rotation.z=-.35;g.add(club);
  const sh=new THREE.Mesh(new THREE.CircleGeometry(.55,14),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.28,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.02;g.add(sh);return g;}
function buildWolfM(pal){
  const g=new THREE.Group(),fur=new THREE.MeshLambertMaterial({color:pal[0]}),dark=new THREE.MeshLambertMaterial({color:pal[1]});
  const body=new THREE.Mesh(new THREE.CapsuleGeometry(.28,.7,3,8),fur);body.rotation.x=Math.PI/2;body.position.y=.62;const head=new THREE.Mesh(new THREE.SphereGeometry(.26,8,8),fur);head.position.set(0,.8,.62);
  const snout=new THREE.Mesh(new THREE.ConeGeometry(.12,.3,6),dark);snout.rotation.x=Math.PI/2;snout.position.set(0,.74,.9);
  const eg=new THREE.ConeGeometry(.08,.2,4),e1=new THREE.Mesh(eg,dark);e1.position.set(-.13,1.05,.6);const e2=new THREE.Mesh(eg,dark);e2.position.set(.13,1.05,.6);
  const ym=new THREE.MeshBasicMaterial({color:pal[2]}),y1=new THREE.Mesh(new THREE.SphereGeometry(.04,5,5),ym);y1.position.set(-.1,.86,.84);const y2=y1.clone();y2.position.x=.1;
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.09,.5,5),fur);tail.rotation.x=-Math.PI/2.4;tail.position.set(0,.7,-.7);
  const lg=new THREE.CylinderGeometry(.07,.06,.5,5);[[-.18,.3],[.18,.3],[-.18,-.35],[.18,-.35]].forEach(p=>{const l=new THREE.Mesh(lg,dark);l.position.set(p[0],.25,p[1]);g.add(l);});
  g.add(body,head,snout,e1,e2,y1,y2,tail);const sh=new THREE.Mesh(new THREE.CircleGeometry(.6,14),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.28,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.02;g.add(sh);return g;}
function buildScorM(pal){
  const g=new THREE.Group(),sh=new THREE.MeshLambertMaterial({color:pal[0]}),dk=new THREE.MeshLambertMaterial({color:pal[1]});
  const b=new THREE.Mesh(new THREE.SphereGeometry(.5,8,8),sh);b.scale.set(1,.6,1.4);b.position.y=.45;g.add(b);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(.28,8,8),sh);hd.position.set(0,.5,.7);g.add(hd);
  [[0,.75,-.65,.28],[0,1.15,-.85,.24],[0,1.5,-.7,.2]].forEach(p=>{const s=new THREE.Mesh(new THREE.SphereGeometry(p[3],6,6),sh);s.position.set(p[0],p[1],p[2]);g.add(s);});
  const st=new THREE.Mesh(new THREE.ConeGeometry(.1,.4,5),new THREE.MeshBasicMaterial({color:pal[2]}));st.position.set(0,1.7,-.45);st.rotation.x=1.2;g.add(st);
  [-1,1].forEach(s=>{const c=new THREE.Mesh(G.box,dk);c.scale.set(.25,.2,.6);c.position.set(s*.5,.45,1.0);g.add(c);for(let i=0;i<3;i++){const l=new THREE.Mesh(G.box,dk);l.scale.set(.5,.06,.06);l.position.set(s*.6,.3,.35-i*.4);g.add(l);}});
  const sd=new THREE.Mesh(new THREE.CircleGeometry(.8,14),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.28,depthWrite:false}));sd.rotation.x=-Math.PI/2;sd.position.y=.02;g.add(sd);return g;}
function buildMetinM(col){
  const g=new THREE.Group(),rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1.4,0),new THREE.MeshLambertMaterial({color:0x4a4a5a,flatShading:true}));rock.position.y=1.3;
  const rune=new THREE.Mesh(new THREE.TorusGeometry(.7,.1,6,12),new THREE.MeshBasicMaterial({color:col}));rune.position.y=1.3;rune.rotation.x=Math.PI/2;
  const orb=new THREE.Mesh(new THREE.SphereGeometry(.28,8,8),new THREE.MeshBasicMaterial({color:col}));orb.position.y=1.3;g.add(rock,rune,orb);g.userData.rune=rune;
  const sh=new THREE.Mesh(new THREE.CircleGeometry(1.1,16),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.3,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.02;g.add(sh);return g;}
const mobHp=(L,m)=>Math.round((26+L*14)*m), mobDmg=(L,m)=>Math.round((5+L*1.6)*m);
class Enemy{
  constructor(pos,spk,lv,o){
    o=o||{};this.kind=o.kind||'mob';this.lv=lv;this.camp=o.camp||null;this.dg=!!o.dg;this.dead=false;this.home={x:pos.x,z:pos.z};this.state='idle';this.wT=1+Math.random()*3;this.wx=pos.x;this.wz=pos.z;
    this.isMetin=this.kind==='metin';this.isPvP=this.kind==='pvp';this.stunUntil=0;this.slowUntil=0;this.buffUntil=0;this.dot=null;this.hitFlash=0;this.lunge=0;this.walkPhase=Math.random()*10;this.atkCd=Math.random()*1.2;this.skillT=4+Math.random()*3;this.provoked=false;this.wave=0;
    if(this.isMetin){const mt=METIN_TYPES[o.zone];this.name=mt.n;this.sc=1;this.maxHp=Math.round(90+lv*50);this.hp=this.maxHp;this.dmg=0;this.baseSpeed=0;this.cd=9;this.xp=Math.round((10+lv*5)*5);this.yang=Math.round((5+lv*3)*8);this.col=0x44aaff;this.zone=o.zone;
      this.mesh=buildMetinM(mt.col);addGlow(this.mesh,mt.col,5.2,0,1.3,0,this);this.h=3.2;this.label=makeLabel(this.name+' Lv'+lv);}
    else if(this.isPvP){this.cls=o.cls;const c=CLASSES[this.cls];this.name='Rakip '+c.name;this.sc=1;this.maxHp=Math.round(150+player.level*20+c.hp*.5);this.hp=this.maxHp;this.dmg=Math.round(c.dmg*(1+player.level*.1)+4+player.level);this.baseSpeed=c.speed*.92;this.cd=.95;
      this.xp=100+player.level*20;this.yang=80+player.level*15;this.col=0xff4455;this.mesh=buildHuman(this.cls,false,{},0x8a2a2a);this.h=2.3;this.label=makeLabel('⚔ '+this.name+' (Lv '+player.level+')');}
    else{const s=SP[spk];this.sp=s;this.spk=spk;this.name=s.n;this.sc=s.sc;this.boss=!!s.boss;this.maxHp=mobHp(lv,s.hp);this.hp=this.maxHp;this.dmg=mobDmg(lv,s.dm);this.baseSpeed=s.sp;this.cd=s.cd;
      this.xp=Math.round((10+lv*5)*(this.boss?8:Math.sqrt(s.hp)));this.yang=Math.round((5+lv*3)*(this.boss?10:1)*(.6+Math.random()*.8));this.col=this.boss?0xcc44ff:0xff4444;
      const mm=s.mdl&&MODELS.ok!==undefined?buildMonModel(s.mdl,s.tint):null;
      if(mm){this.mesh=mm;this.mon=mm.userData.mon;this.mon.px=pos.x;this.mon.pz=pos.z;this.h=(MON_DEF[s.mdl].h+MON_DEF[s.mdl].hov+.3)*(s.sc>1?s.sc:1);}
      else{this.mesh=s.b==='wolf'?buildWolfM(s.pal):s.b==='scor'?buildScorM(s.pal):s.b==='slime'?buildSlimeM(s.pal):buildOrcM(s.pal);this.h=(s.b==='wolf'?1.4:s.b==='scor'?1.2:s.b==='slime'?1.1:2.1)*(s.sc>1?s.sc*.9:1);}
      if(this.boss){this.label=makeLabel('👑 '+s.n+' Lv'+lv);addGlow(this.mesh,0xaa44ff,1.7,0,1.1,0,this);}
      if(s.rng){const stf=new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,1.5,5),new THREE.MeshLambertMaterial({color:0x5a3a1a}));stf.position.set(.66,1.0,.18);const orb=new THREE.Mesh(new THREE.SphereGeometry(.12,6,6),new THREE.MeshBasicMaterial({color:s.proj}));orb.position.set(.66,1.78,.18);this.mesh.add(stf,orb);}}
    this.speed=this.baseSpeed;this.mesh.scale.setScalar(this.sc);this.mesh.position.copy(pos);scene.add(this.mesh);
    this.barGroup=new THREE.Group();const bg=new THREE.Mesh(new THREE.PlaneGeometry(1.3,.17),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.7,depthTest:false}));
    this.barFg=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.11),new THREE.MeshBasicMaterial({color:this.col,depthTest:false}));bg.renderOrder=998;this.barFg.renderOrder=999;this.barGroup.add(bg,this.barFg);scene.add(this.barGroup);
  }
  flash(on){this.mesh.traverse(o=>{if(o.isMesh&&o.material&&o.material.emissive&&!o.userData.keepEm)o.material.emissive.setHex(on?0x663322:0);});}
  update(dt){
    if(this.dead)return;const now=performance.now();
    if(this.hitFlash>0){this.hitFlash-=dt;if(this.hitFlash<=0)this.flash(false);}
    if(this.dot){if(now>this.dot.until)this.dot=null;else{this.dot.acc+=this.dot.dps*dt;if(this.dot.acc>=1){const a=Math.round(this.dot.acc);this.dot.acc-=a;this.hp-=a;if(this.dot.tx<now){this.dot.tx=now+900;showDamage(this.mesh.position.clone().setY(this.h),a,'#7f7',false);}if(this.hp<=0){this.die();return;}}}}
    const stunned=now<this.stunUntil;this.speed=this.baseSpeed*(now<this.slowUntil?.5:1)*(now<this.buffUntil?1.5:1);
    const ep=this.mesh.position,pp=player.group.position,dx=pp.x-ep.x,dz=pp.z-ep.z,dist=Math.hypot(dx,dz)||.001;
    if(this.isMetin){this.mesh.userData.rune.rotation.z+=dt*1.5;this.mesh.userData.rune.material.color.setHSL((now/2000)%1,1,.6);}
    else if(!stunned){
      const inV=!this.dg&&!this.isPvP&&player.alive&&Math.hypot(pp.x,pp.z)<VR&&zoneAt(pp.x,pp.z)==='village';
      const aggro=this.isPvP||this.dg?300:(this.boss?15:11),homeD=Math.hypot(ep.x-this.home.x,ep.z-this.home.z);
      if(this.state!=='return'&&(!player.alive||inV||(!this.dg&&!this.isPvP&&homeD>40)))this.state='return';
      if(this.state==='idle'&&player.alive&&!inV&&(dist<aggro||this.provoked))this.state='chase';
      if(this.state==='return'){const hx=this.home.x-ep.x,hz=this.home.z-ep.z,hd=Math.hypot(hx,hz);
        if(hd<1.5){this.state='idle';this.provoked=false;this.hp=this.maxHp;}else{ep.x+=hx/hd*this.speed*1.4*dt;ep.z+=hz/hd*this.speed*1.4*dt;this.mesh.rotation.y=Math.atan2(hx,hz);this.walkPhase+=dt*9;}}
      else if(this.state==='chase'){
        const rng=this.sp&&this.sp.rng,stop=rng?rng*.78:(this.isPvP?1.9:1.7)*Math.max(1,this.sc*.8);
        if(dist>stop){ep.x+=dx/dist*this.speed*dt;ep.z+=dz/dist*this.speed*dt;this.mesh.rotation.y=Math.atan2(dx,dz);this.walkPhase+=dt*9;ep.y=Math.abs(Math.sin(this.walkPhase))*.08;}
        else{ep.y*=.85;this.mesh.rotation.y=Math.atan2(dx,dz);if(rng&&dist<rng*.4){ep.x-=dx/dist*this.speed*.7*dt;ep.z-=dz/dist*this.speed*.7*dt;}}
        this.atkCd-=dt;
        if(rng){if(dist<=rng&&this.atkCd<=0&&player.alive){this.atkCd=this.cd;this.lunge=.22;enemyShoot(this);}}else if(dist<=stop+.5&&this.atkCd<=0&&player.alive){this.atkCd=this.cd;this.lunge=.22;damagePlayer(this.dmg,this);}
        if(this.isPvP)this.pvpSkills(dt,dist);
      } else { /* serseri dolaş */
        this.wT-=dt;if(this.wT<=0){this.wT=3+Math.random()*4;const a=Math.random()*6.28,r=Math.random()*5;this.wx=this.home.x+Math.cos(a)*r;this.wz=this.home.z+Math.sin(a)*r;}
        const wx=this.wx-ep.x,wz=this.wz-ep.z,wd=Math.hypot(wx,wz);if(wd>.5){ep.x+=wx/wd*this.speed*.35*dt;ep.z+=wz/wd*this.speed*.35*dt;this.mesh.rotation.y=Math.atan2(wx,wz);}
      }
      pushOut(ep,.5*this.sc);
      if(this.lunge>0){this.lunge-=dt;const k=Math.max(0,this.lunge)/.22;if(this.isPvP){const a=this.mesh.userData.arm;if(a)a.rotation.x=.28-Math.sin((1-k)*Math.PI)*2.2;}else this.mesh.scale.setScalar(this.sc*(1+k*.12));}
      else{if(this.isPvP){const a=this.mesh.userData.arm;if(a)a.rotation.x+=(.28-a.rotation.x)*Math.min(1,dt*10);}else this.mesh.scale.setScalar(this.sc);}
    }
    if(this.mon)monAnim(this,dt,dist);
    this.barGroup.position.set(ep.x,this.h+ep.y,ep.z);this.barGroup.quaternion.copy(camera.quaternion);
    const k=Math.max(0,this.hp/this.maxHp);this.barFg.scale.x=k;this.barFg.position.x=-.5+.5*k;this.barGroup.visible=k<.999||this.isPvP||this.boss||this.isMetin;
    if(this.label)placeLabel(this.label,ep.x,this.h+.6+ep.y,ep.z,65,dist);
  }
  pvpSkills(dt,dist){this.skillT-=dt;if(this.skillT>0)return;const c=CLASSES[this.cls];this.skillT=5+Math.random()*3;
    if(this.cls==='saman'&&this.hp<this.maxHp*.5){this.hp=Math.min(this.maxHp,this.hp+45);showDamage(this.mesh.position.clone().setY(2.4),'+45','#6dff8a',false);spawnBurst(this.mesh.position.clone(),0x66ff99);return;}
    if(this.cls==='ninja'||this.cls==='lykaner'){this.buffUntil=performance.now()+3000;spawnBurst(this.mesh.position.clone(),c.skills[1].col);return;}
    if(dist<4.5){spawnBurst(this.mesh.position.clone(),c.skills[0].col);damagePlayer(Math.round(this.dmg*1.6),this);sfx('skill');}}
  takeDamage(amount,crit,o){
    if(this.dead)return;o=o||{};this.hp-=amount;this.hitFlash=.12;this.flash(true);this.provoked=true;if(this.state==='idle')this.state='chase';
    showDamage(this.mesh.position.clone().setY(this.mesh.position.y+this.h-.1),Math.round(amount),crit?'#ffd24a':'#fff',crit);sfx(crit?'crit':'hit');
    if(this.isMetin){const pct=this.hp/this.maxHp,w=pct<.25?3:pct<.5?2:pct<.75?1:0;
      while(this.wave<w&&this.hp>0){this.wave++;const p=this.mesh.position,zl=ZMOBS[this.zone];showMsg('Metin taşı muhafızlarını çağırdı! ('+this.wave+'/3)');
        for(let i=0;i<3;i++){const a=Math.random()*6.28;enemies.push(new Enemy(new THREE.Vector3(p.x+Math.cos(a)*4,0,p.z+Math.sin(a)*4),zl[Math.floor(Math.random()*zl.length)],this.lv,{kind:'mob'}));}}}
    if(this.hp<=0)this.die();
  }
  remove(){this.dead=true;scene.remove(this.mesh);scene.remove(this.barGroup);if(this.label){this.label.remove();this.label=null;}if(target===this){target=null;}}
  die(){
    const pos=this.mesh.position.clone(),wasDg=this.dg,boss=this.boss;this.remove();
    gainXP(Math.round(this.xp*(1+(player.bon.xp||0)/100)));const y=Math.round(this.yang*(1+(player.bon.yang||0)/100));player.yang+=y;
    spawnBurst(pos,this.isMetin?0x44aaff:this.col);onKillExtras(this);
    if(this.isPvP){duelEnd(true);} else if(this.isMetin){player.stats.metins++;player.shards+=1+Math.floor(Math.random()*2);questProgress('metin');showMsg('Metin taşı kırıldı! +Metin Parçası');
      dropItem(pos,1,this.lv);if(Math.random()<.3)player.keys++;}
    else{player.stats.kills++;questProgress('kill');if(boss){player.stats.bosses++;questProgress('boss');player.shards+=3;dropItem(pos,2,this.lv);dropItem(pos,1,this.lv);if(Math.random()<.4)player.keys++;}
      else if(Math.random()<.14)dropItem(pos,0,this.lv);else if(Math.random()<.1){const k=Math.random()<.5?'hp':'mp';player.pots[k]++;chat('Düştü: '+(k==='hp'?'Kırmızı':'Mavi')+' İksir','#9fd');}}
    if(wasDg)dungeonKill(boss);
    chat('+'+y+' Yang','#ffe08a');updateHUD();if(this.mon&&this.mon.A.death)startCorpse(this);else if(!this.mon)this.mesh.traverse(o=>{if(o.geometry&&o.geometry.dispose)o.geometry.dispose();});
  }
}
const enemyCount=f=>{let n=0;for(const e of enemies)if(!e.dead&&f(e))n++;return n;};

/* ---------- Kamplar ---------- */
const camps=[];
(function(){
  const R=rng(23);const axes={forest:[0,1],desert:[1,0],snow:[0,-1],swamp:[-1,0]};
  for(const z of ZK){const lv=ZONES[z].lv,ax=axes[z];
    for(let i=0;i<6;i++){const r=VR+20+i*((WORLD_R-VR-40)/5.5),off=(R()-.5)*r*.9;let x=ax[0]*r+(ax[1]?off:0),zz=ax[1]*r+(ax[0]?off:0);
      if(zoneAt(x,zz)!==z){x=ax[0]*r;zz=ax[1]*r;}
      const L=Math.round(lv[0]+(lv[1]-lv[0])*(i/5)),mobs=ZMOBS[z];
      camps.push({x,z:zz,zone:z,lv:L,type:'mob',slots:Array.from({length:4},()=>({e:null,t:Math.random()*5})),mobs});}
    const br=WORLD_R-14;camps.push({x:ax[0]*br,z:ax[1]*br,zone:z,lv:lv[1]+2,type:'boss',spk:'boss_'+z,slots:[{e:null,t:0}]});
    for(let k=0;k<2;k++){const r=VR+45+k*55,off=(k?1:-1)*(22+R()*10);camps.push({x:ax[0]*r+(ax[1]?off:0),z:ax[1]*r+(ax[0]?off:0),zone:z,lv:Math.round(lv[0]+(lv[1]-lv[0])*(.25+k*.5)),type:'metin',slots:[{e:null,t:0}]});}}
})();
let campT=0;
function updateCamps(dt){
  if(dungeon)return;const pp=player.group.position;
  for(const c of camps){const d=Math.hypot(c.x-pp.x,c.z-pp.z);
    if(d>125){for(const s of c.slots){if(s.e&&!s.e.dead){s.e.remove();const i=enemies.indexOf(s.e);if(i>=0)enemies.splice(i,1);}s.e=null;}continue;}
    if(d>90)continue;
    for(const s of c.slots){
      if(s.e&&s.e.dead){s.e=null;s.t=c.type==='boss'?150:c.type==='metin'?70:16;}
      if(!s.e){if(s.t>0){s.t-=dt;continue;}
        const a=Math.random()*6.28,r=c.type==='mob'?Math.random()*7:0,pos=new THREE.Vector3(c.x+Math.cos(a)*r,0,c.z+Math.sin(a)*r);
        let e;if(c.type==='metin')e=new Enemy(pos,null,c.lv,{kind:'metin',zone:c.zone,camp:c});else if(c.type==='boss')e=new Enemy(pos,c.spk,c.lv,{camp:c});
        else{const spk=c.mobs[Math.floor(Math.random()*c.mobs.length)];e=new Enemy(pos,spk,Math.max(1,c.lv+Math.floor(Math.random()*3)-1),{camp:c});}
        enemies.push(e);s.e=e;}}
  }
}
function nearestMetin(){let best=null,bd=1e9;for(const c of camps){if(c.type!=='metin')continue;const s=c.slots[0];if(!s.e||s.e.dead)continue;const d=s.e.mesh.position.distanceTo(player.group.position);if(d<bd){bd=d;best=s.e;}}return best?{e:best,d:bd}:null;}

/* ---------- NPC'ler ---------- */
const NPCS=[
  {id:'smith',n:'Demirci Orhan',x:-9,z:-7,tint:0x8a4a2a,cls:'savasci',t:'smith'},
  {id:'shop',n:'Tüccar Selim',x:9,z:-7,tint:0x2a6a8a,cls:'saman',t:'shop'},
  {id:'heal',n:'Şifacı Ayşe',x:-9,z:8,tint:0xaa4a7a,cls:'saman',t:'heal'},
  {id:'arena',n:'Arena Ustası',x:10,z:8,tint:0x6a2a2a,cls:'lykaner',t:'arena'},
  {id:'dungeon',n:'Zindan Muhafızı',x:0,z:-14,tint:0x4a2a6a,cls:'sura',t:'dungeon'}];
NPCS.forEach(n=>{n.mesh=buildHuman(n.cls,false,{},n.tint);n.mesh.position.set(n.x,0,n.z);n.mesh.rotation.y=Math.atan2(-n.x,-n.z);scene.add(n.mesh);n.label=makeLabel(n.n,'npc');obstacles.push({x:n.x,z:n.z,r:.6});});
function nearestNpc(){let best=null,bd=4.5;if(dungeon)return null;for(const n of NPCS){const d=Math.hypot(n.x-player.group.position.x,n.z-player.group.position.z);if(d<bd){bd=d;best=n;}}return best;}

/* =========================================================
   3b. GERÇEK MODEL KULLANIMI (kahraman + canavarlar) — hata olursa çizim modellere düşer
   ========================================================= */
const pickClip=(cl,re,ex)=>{for(const c of cl)if(re.test(c.name)&&!(ex&&ex.test(c.name)))return c;return null;};
function ownMats(root,fn){root.traverse(o=>{if(o.isMesh){o.frustumCulled=false;const f=m=>{const n=fn?fn(m):m.clone();return n;};o.material=Array.isArray(o.material)?o.material.map(f):f(o.material);}});}
function setAct(m,a){if(!a)return;if(m.cur===a)return;a.reset();a.enabled=true;a.play();if(m.cur)m.cur.crossFadeTo(a,.15,false);m.cur=a;}
/* ---------- canavar ---------- */
function buildMonModel(key,tint){
  const M=MODELS.mon[key];if(!M||!MODELS.SU)return null;
  try{
    const w=new THREE.Group(),yg=new THREE.Group(),inner=MODELS.SU.clone(M.src);
    inner.scale.multiplyScalar(M.sc);inner.position.set(M.off[0],M.off[1],M.off[2]);yg.rotation.y=M.yaw;yg.add(inner);w.add(yg);
    ownMats(inner,m=>{const n=m.clone();if(tint!==undefined&&n.color&&n.color.setHex)n.color.setHex(tint);return n;});
    const mixer=new THREE.AnimationMixer(inner),A={};
    const mk=(n,re,ex)=>{const c=pickClip(M.clips,re,ex);if(c)A[n]=mixer.clipAction(c);};
    mk('idle',/idle/i);mk('walk',/walk|fly|run/i);mk('atk',/attack/i,/qe$/i);mk('death',/death$/i);
    if(!A.idle)A.idle=A.walk;if(!A.walk)A.walk=A.idle;if(!A.idle)return null;
    if(A.atk){A.atk.setLoop(THREE.LoopOnce,1);A.atk.clampWhenFinished=true;}
    if(A.death){A.death.setLoop(THREE.LoopOnce,1);A.death.clampWhenFinished=true;}
    A.idle.play();mixer.update(Math.random()*.8);
    w.userData.mon={mixer,A,cur:A.idle,px:0,pz:0,atkOn:false,atkT:0};
    return w;
  }catch(e){return null;}
}
function monAnim(e,dt,dist){
  const m=e.mon;if(!m||dist>55)return;
  const ep=e.mesh.position,mv=Math.hypot(ep.x-m.px,ep.z-m.pz)/Math.max(dt,.001)>.7;m.px=ep.x;m.pz=ep.z;
  if(e.lunge>0&&!m.atkOn&&m.A.atk){m.atkOn=true;m.atkT=.8;setAct(m,m.A.atk);}
  if(m.atkOn){m.atkT-=dt;if(m.atkT<=0)m.atkOn=false;}
  if(!m.atkOn)setAct(m,mv?m.A.walk:m.A.idle);
  m.mixer.update(dt);
}
/* ---------- kahraman ---------- */
function heroWeapon(clsKey,wc,up){
  const g=new THREE.Group(),wm=new THREE.MeshLambertMaterial({color:wc,emissive:up>=7?0x553300:0}),dark=new THREE.MeshLambertMaterial({color:0x5a3a1a});
  const bar=(x,y,z,px,py,pz,m)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),m||wm);b.position.set(px,py,pz);g.add(b);return b;};
  if(clsKey==='ninja'){bar(.05,.05,.8,0,0,.5);bar(.12,.04,.04,0,0,.1,dark);}
  else if(clsKey==='saman'){bar(.05,.05,1.5,0,0,.55,dark);const o=new THREE.Mesh(new THREE.SphereGeometry(.15,8,8),new THREE.MeshLambertMaterial({color:wc===0xdfe6ee?0x44ffaa:wc,emissive:0x116644}));o.position.set(0,0,1.35);o.userData.keepEm=true;g.add(o);}
  else if(clsKey==='lykaner'){const c=new THREE.Mesh(new THREE.ConeGeometry(.1,.6,5),wm);c.rotation.x=Math.PI/2;c.position.set(0,0,.45);g.add(c);}
  else if(clsKey==='okcu'){/* yay: sol elde, kollar yerel X boyunca, kiriş (−Y) oyuncuya doğru */
    const bm=new THREE.MeshLambertMaterial({color:wc===0xdfe6ee?0x9a6a30:wc});
    const r=new THREE.Mesh(new THREE.BoxGeometry(.5,.09,.09),bm);g.add(r);
    [1,-1].forEach(sd=>{const l=new THREE.Mesh(new THREE.BoxGeometry(.55,.07,.07),bm);l.position.set(sd*.46,-.14,0);l.rotation.z=-sd*.5;g.add(l);});
    const st=new THREE.Mesh(new THREE.BoxGeometry(1.3,.015,.015),new THREE.MeshBasicMaterial({color:0xf0f0f0}));st.position.set(0,-.3,0);g.add(st);}
  else{bar(.1,.07,1.25,0,0,.7);bar(.36,.08,.08,0,0,.12,dark);}
  return g;
}
const rc0=it=>new THREE.Color(rarClr(it)).getHex();
function buildHero(clsKey,isPlayer,eq){
  const H=MODELS.hero;if(!H||!MODELS.SU)return null;
  try{
    eq=eq||{};const cls=CLASSES[clsKey],g=new THREE.Group(),inner=MODELS.SU.clone(H.scene);
    const col=eq.armor&&eq.armor.up>=5?0xffd060:cls.color;
    ownMats(inner,()=>new THREE.MeshLambertMaterial({color:col}));
    try{/* ten / kıyafet / bot ayrımı: kemik ağırlıklarına göre köşe rengi */
      const skin=new THREE.Color(0xf0c090),cloth=new THREE.Color(col),beltC=new THREE.Color(0x4a2e14).lerp(new THREE.Color(eq.belt&&RARITIES.findIndex(r=>r.key===eq.belt.rarity)>=2?rc0(eq.belt):0x4a2e14),.35),boot=new THREE.Color(eq.boots?new THREE.Color(rarClr(eq.boots)).getHex():0x2a2a34);
      inner.traverse(o=>{if(!o.isSkinnedMesh||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.skinIndex||!o.skeleton)return;
        const geo=o.geometry.clone(),si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight,n=si.count,arr=new Float32Array(n*3),bn=o.skeleton.bones.map(b=>b.name);
        const kind=name=>/^(Head|neck|hand_|thumb|index|middle|ring|pinky)/i.test(name)?0:/^(foot_|ball_|calf_)/i.test(name)?2:(eq.belt&&/^pelvis/i.test(name))?3:1;
        for(let i=0;i<n;i++){let best=0,bw=-1;for(let k=0;k<4;k++){const w=sw.getComponent(i,k);if(w>bw){bw=w;best=si.getComponent(i,k);}}
          const c=[skin,cloth,boot,beltC][kind(bn[best]||'')];arr[i*3]=c.r;arr[i*3+1]=c.g;arr[i*3+2]=c.b;}
        geo.setAttribute('color',new THREE.BufferAttribute(arr,3));o.geometry=geo;
        o.material=Array.isArray(o.material)?o.material.map(m=>new THREE.MeshLambertMaterial({vertexColors:true})):new THREE.MeshLambertMaterial({vertexColors:true});});
    }catch(e){}
    g.add(inner);
    const B=n=>inner.getObjectByName(n);
    const bow=clsKey==='okcu',hand=B(bow?'hand_l':'hand_r');let wpn=null;if(hand){const wc=eq.weapon?new THREE.Color(rarClr(eq.weapon)).getHex():0xdfe6ee;wpn=heroWeapon(clsKey,wc,eq.weapon?eq.weapon.up:0);if(bow)wpn.visible=false;hand.add(wpn);}
    const lo=B('lowerarm_l');if(eq.shield&&lo){const sh=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.07,14),new THREE.MeshLambertMaterial({color:0x9a7a3a}));sh.rotation.x=Math.PI/2;sh.position.set(-.2,0,0);lo.add(sh);}
    const rc=it=>new THREE.Color(rarClr(it)).getHex(),ri=it=>RARITIES.findIndex(r=>r.key===it.rarity);
    const metal=it=>{const c=new THREE.Color(0xb0b8c8).lerp(new THREE.Color(rc(it)),.45);return new THREE.MeshLambertMaterial({color:c.getHex(),emissive:ri(it)>=3?new THREE.Color(rc(it)).multiplyScalar(.25).getHex():(it.up>=7?0x553300:0)});};
    const hd=B('Head');if(eq.helm&&hd){const m=metal(eq.helm);const dome=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8,0,Math.PI*2,0,Math.PI*.58),m);dome.position.set(0,.1,0);hd.add(dome);
      if(ri(eq.helm)>=2){const crest=new THREE.Mesh(new THREE.ConeGeometry(.045,.22,5),m);crest.position.set(0,.3,0);hd.add(crest);}}
    if(eq.armor){const m=metal(eq.armor);['upperarm_l','upperarm_r'].forEach(n=>{const b=B(n);if(b){const p=new THREE.Mesh(new THREE.SphereGeometry(ri(eq.armor)>=3?.15:.125,10,8),m);b.add(p);}});
      const cp=new THREE.Mesh(new THREE.BoxGeometry(.52,.95,.035),new THREE.MeshLambertMaterial({color:new THREE.Color(cls.color).multiplyScalar(.7).getHex(),side:2}));cp.position.set(0,1.2,-.24);cp.rotation.x=.08;g.add(cp);}
    if(eq.bracelet){const m=metal(eq.bracelet);['hand_l','hand_r'].forEach(n=>{const b=B(n);if(b){const p=new THREE.Mesh(new THREE.SphereGeometry(.075,8,8),m);b.add(p);}});}
    if(eq.wings){const wmat=new THREE.MeshLambertMaterial({color:new THREE.Color(rarClr(eq.wings)).getHex(),emissive:0x222222,side:2});[-1,1].forEach(sd=>{const w=new THREE.Mesh(new THREE.BoxGeometry(.9,1.2,.05),wmat);w.position.set(sd*.5,1.3,-.3);w.rotation.z=sd*.5;w.rotation.y=sd*.5;g.add(w);});}
    const sh2=new THREE.Mesh(new THREE.CircleGeometry(.55,14),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.28,depthWrite:false}));sh2.rotation.x=-Math.PI/2;sh2.position.y=.02;sh2.scale.setScalar(1.1);g.add(sh2);
    const mixer=new THREE.AnimationMixer(inner),A={},C=H.clips;
    ['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Sword_Attack','Punch_Jab','Punch_Cross','Spell_Simple_Shoot','Roll','Death01','Hit_Chest','Sitting_Idle_Loop','Sword_Regular_A','Sword_Regular_B','Sword_Regular_C','Sword_Heavy_Combo','Hit_Knockback','Consume','Melee_Hook','Sword_Block'].forEach(n=>{if(C[n])A[n]=mixer.clipAction(C[n]);});
    if(!A.Idle_Loop)return null;
    ['Sword_Attack','Punch_Jab','Punch_Cross','Spell_Simple_Shoot','Roll','Death01','Hit_Chest','Sword_Regular_A','Sword_Regular_B','Sword_Regular_C','Sword_Heavy_Combo','Hit_Knockback','Consume','Melee_Hook','Sword_Block'].forEach(n=>{if(A[n]){A[n].setLoop(THREE.LoopOnce,1);A[n].clampWhenFinished=true;}});
    A.Idle_Loop.play();
    g.userData.hero={mixer,A,cur:A.Idle_Loop,one:0,atkOn:false,alt:0,dead:false,bow:bow?wpn:null,bowT:0};
    return g;
  }catch(e){return null;}
}
function heroUpdate(dt,moving){
  const h=player.hero;if(!h)return;
  if(!player.alive&&!h.dead){h.dead=true;if(h.A.Death01)setAct(h,h.A.Death01);}
  if(player.alive&&h.dead){h.dead=false;h.one=0;h.cur=null;h.mixer.stopAllAction();}
  if(!h.dead){
    const cls=CLASSES[player.cls]||{};
    if(player.dodging>0&&h.A.Roll&&h.cur!==h.A.Roll){setAct(h,h.A.Roll);h.one=.3;}
    if(player.atkAnim>0&&!h.atkOn){h.atkOn=true;h.bowT=2.5;const cs=cls.ranged?['Spell_Simple_Shoot']:player.cls==='lykaner'?['Punch_Jab','Punch_Cross','Melee_Hook']:player.cls==='ninja'?['Sword_Regular_A','Sword_Regular_B','Sword_Regular_A','Melee_Hook']:['Sword_Regular_A','Sword_Regular_B','Sword_Regular_C'];
      const n=cs[(h.alt++)%cs.length],a=h.A[n]||h.A.Sword_Attack||h.A.Punch_Jab;if(a){const slow=n==='Sword_Regular_C'||n==='Melee_Hook';a.timeScale=slow?1.7:1.15;setAct(h,a);h.one=slow?.45:.38;}}
    if(!(player.atkAnim>0))h.atkOn=false;
    if(h.one>0)h.one-=dt;
    else{const want=player.mounted&&player.horse&&h.A.Sitting_Idle_Loop?h.A.Sitting_Idle_Loop:moving?(h.A.Jog_Fwd_Loop||h.A.Walk_Loop):h.A.Idle_Loop;setAct(h,want);}
  }
  if(h.bow){if(h.bowT>0)h.bowT-=dt;h.bow.visible=h.bowT>0;}
  h.mixer.update(dt);
}
function heroCast(){const h=player.hero;if(!h||h.dead)return;h.bowT=2.5;const cls=CLASSES[player.cls]||{};
  if(!cls.ranged&&h.A.Sword_Heavy_Combo&&player.cls!=='lykaner'){const a=h.A.Sword_Heavy_Combo;a.timeScale=2.4;setAct(h,a);h.one=.85;return;}
  const a=h.A.Spell_Simple_Shoot;if(!a)return;a.timeScale=1.3;setAct(h,a);h.one=.5;}
function heroConsume(){const h=player.hero;if(!h||h.dead||h.one>0||!h.A.Consume)return;const a=h.A.Consume;a.timeScale=1.9;setAct(h,a);h.one=.6;}
function heroHurt(big){if(typeof vib==='function')vib(big?70:35);const h=player.hero;if(!h||h.dead)return;const a=big&&h.A.Hit_Knockback?h.A.Hit_Knockback:h.A.Hit_Chest;if(!a||(h.one>0&&!big))return;a.timeScale=big?1.5:1;setAct(h,a);h.one=big?.45:.3;}
/* ölü canavar: ölüm animasyonu oynar, sonra sahneden kalkar */
const CORPSES=[];
function startCorpse(e){const m=e.mon;if(!m||!m.A.death)return;try{m.atkOn=false;setAct(m,m.A.death);scene.add(e.mesh);CORPSES.push({e,t:1.5});}catch(x){}}
function corpseUpdate(dt){for(let i=CORPSES.length-1;i>=0;i--){const c=CORPSES[i];c.t-=dt;c.e.mon.mixer.update(dt);if(c.t<=0){scene.remove(c.e.mesh);CORPSES.splice(i,1);}}}

/* =========================================================
   6. İSTATİSTİK, EŞYA, YETENEK, SAVAŞ
   ========================================================= */
function recalcStats(){
  const c=CLASSES[player.cls],a=player.attr,bon={};AFFKEYS.forEach(k=>bon[k]=0);let wd=0,hpB=0,mpB=0,defB=0,critB=0,dodgeB=0;
  for(const s of SLOTKEYS){const it=player.equipped[s];if(!it)continue;const st=istat(it);
    if(s==='weapon')wd+=st;else if(s==='armor')hpB+=st*3;else if(s==='helm')hpB+=st*2;else if(s==='boots')dodgeB+=st*.3;else if(s==='shield')defB+=st*.5;else if(s==='ring')critB+=st*.4;else if(s==='neck')mpB+=st*3;else if(s==='earring')critB+=st*.3;else if(s==='bracelet')defB+=st*.4;else if(s==='belt')hpB+=st*2.5;else if(s==='wings')bon.spd+=st*.35;
    it.aff.forEach(f=>{bon[f.k]+=f.v;});}
  const kd=KINGDOMS.find(k=>k.id===player.kingdom);if(kd)for(const k in kd.bon)bon[k]+=kd.bon[k];
  const pet=activePet();if(pet){const P=PETS[pet.k],m=1+.15*(pet.lv-1)+(pet.gear?.25:0);for(const k in P.bon)bon[k]+=Math.round(P.bon[k]*m);}
  player.bon=bon;player.baseDmg=(c.dmg+a.st*1.3+player.level*.8+wd)*(1+bon.atk/100);
  player.crit=clamp(5+a.dx*.4+critB+bon.crit+(c.critB||0),0,65);player.dodge=clamp(a.dx*.25+dodgeB,0,30);player.defPct=defB+bon.def;
  player.maxHp=Math.round(c.hp+player.level*8+a.ht*10+hpB+bon.hp);player.maxMp=Math.round(c.mp+player.level*4+a.iq*6+mpB+bon.mp);player.speed=c.speed*(1+bon.spd/100);
  player.hp=Math.min(player.hp,player.maxHp);player.mp=Math.min(player.mp,player.maxMp);updateHUD();
}
function makeItem(level,minRar){
  const r=Math.random();let ri=r<.5?0:r<.78?1:r<.92?2:r<.98?3:4;ri=Math.max(ri,minRar||0);const R=RARITIES[ri];
  const slot=SLOTKEYS[Math.floor(Math.random()*SLOTKEYS.length)];
  let el=null;if(ri>=3&&Math.random()<(ri===4?1:.5))el=['fire','ice','poison'][Math.floor(Math.random()*3)];
  const st=Math.round(SLOTS[slot].base*R.mul*(1+level*.18)*(el?1.15:1));
  const keys=AFFKEYS.slice(),aff=[];for(let i=0;i<R.aff;i++){const k=keys.splice(Math.floor(Math.random()*keys.length),1)[0],A=AFFIX[k];aff.push({k,v:Math.round((A.lo+(A.hi-A.lo)*Math.random())*(1+level*.03))});}
  return {id:++itemId,slot,name:(el?ELEMENTS[el].n+' ':'')+R.name+' '+SLOTS[slot].n,rarity:R.key,el,lv:level,stat:st,up:0,value:Math.round(st*3+10+aff.length*20),aff};
}
let itemId=0;
const INV_MAX=40;
function giveItem(it){if(player.inventory.length>=INV_MAX){player.yang+=it.value;chat('Envanter dolu! '+it.name+' otomatik satıldı (+'+it.value+')','#fc8');return false;}player.inventory.push(it);return true;}
function dropItem(pos,minRar,lv){const it=makeItem(Math.max(1,lv||player.level),minRar);spawnBurst(pos.clone().setY(1),0xffdd44);sfx('drop');
  if(giveItem(it)){showMsg('Eşya düştü: '+it.name);chat('Düştü: '+itemLine(it),rarClr(it));}renderInvIfOpen();saveGame();}
const affTxt=f=>AFFIX[f.k].n+' +'+f.v+AFFIX[f.k].u;
const itemLine=it=>it.name+(it.up?' +'+it.up:'')+' ['+SLOTS[it.slot].n+' '+istat(it)+']';
function equipItem(it){const s=it.slot;if(player.equipped[s])player.inventory.push(player.equipped[s]);player.equipped[s]=it;player.inventory=player.inventory.filter(i=>i.id!==it.id);
  recalcStats();rebuildPlayer();renderInvIfOpen();showMsg(it.name+' kuşanıldı!');saveGame();}
function unequip(s){const it=player.equipped[s];if(!it)return;if(player.inventory.length>=INV_MAX){showMsg('Envanter dolu!');return;}player.inventory.push(it);player.equipped[s]=null;recalcStats();rebuildPlayer();renderInvIfOpen();saveGame();}
function sellItem(it){player.inventory=player.inventory.filter(i=>i.id!==it.id);player.yang+=it.value;sfx('buy');chat('Satıldı: '+it.name+' (+'+it.value+')','#ffe08a');updateHUD();saveGame();}
const upCost=it=>Math.round(60*Math.pow(1.45,it.up)*(1+it.lv*.05));
function upgradeItem(it,useBless){
  if(it.up>=UP_MAX){showMsg('Bu eşya en üst seviyede!');return {ok:false};}
  const cost=upCost(it);if(player.yang<cost){showMsg('Yetersiz Yang! Gerekli: '+cost);return {ok:false};}
  const need=upMats(it.up);if(need)for(const k in need)if((player.mats[k]||0)<need[k]){showMsg('Malzeme yetersiz: '+MATS[k].n+' x'+need[k]);return {ok:false};}
  const risky=it.up>=5,bless=!!useBless&&risky;if(bless&&player.scrolls.bless<1){showMsg('Kutsama Kitabın yok!');return {ok:false};}
  player.yang-=cost;if(need)for(const k in need)player.mats[k]-=need[k];if(bless)player.scrolls.bless--;
  const rate=UP_RATE[it.up];let res='fail';
  if(Math.random()<rate){it.up++;res='ok';showMsg(it.name+' → +'+it.up+' başarılı!');sfx('level');}
  else{let broke=false;if(it.up>=7&&!bless&&Math.random()<.35)broke=true;
    if(broke){res='broke';player.inventory=player.inventory.filter(i=>i.id!==it.id);for(const s of SLOTKEYS)if(player.equipped[s]===it)player.equipped[s]=null;showMsg('💥 '+it.name+' kırıldı!');sfx('die');}
    else{if(risky){it.up--;showMsg('Geliştirme başarısız! Seviye düştü: +'+it.up);}else showMsg('Geliştirme başarısız!');sfx('fail');}}
  it.value=Math.round(istat(it)*3+10+it.aff.length*20);recalcStats();rebuildPlayer();updateHUD();saveGame();return {ok:true,res};
}
function rerollAff(it){
  if(!it.aff.length){showMsg('Bu eşyada bonus yok.');return false;}const cost=200+it.lv*40;
  if(player.yang<cost||player.shards<1){showMsg('Gerekli: '+cost+' Yang + 1 Metin Parçası');return false;}
  player.yang-=cost;player.shards--;const keys=AFFKEYS.slice(),n=it.aff.length;it.aff=[];
  for(let i=0;i<n;i++){const k=keys.splice(Math.floor(Math.random()*keys.length),1)[0],A=AFFIX[k];it.aff.push({k,v:Math.round((A.lo+(A.hi-A.lo)*Math.random())*(1+it.lv*.03))});}
  showMsg('Bonuslar yenilendi!');sfx('level');recalcStats();updateHUD();saveGame();return true;
}
const skillMp=(sk,L)=>Math.round(sk.mp*(1+.06*(sEff(L)-1)));
const skillPow=L=>(1+.15*(sEff(L)-1))*(1+player.attr.iq*.015+(player.bon.skill||0)/100);
const skillOpen=i=>player.level>=UNLOCK[i]&&player.skills[i]>=1;
function nearestEnemy(range,face){let best=null,bd=range;const pp=player.group.position;
  for(const e of enemies){if(e.dead)continue;const d=e.mesh.position.distanceTo(pp);if(d<bd){bd=d;best=e;}}return best;}
function faceTo(e){const d=e.mesh.position.clone().sub(player.group.position);player.group.rotation.y=Math.atan2(d.x,d.z);}
function hitDamage(mul,crit){return Math.round(player.baseDmg*mul*(.88+Math.random()*.24)*(crit?1.8:1));}
function useSkill(i){
  if(!player.cls||!player.alive)return;if(player.mounted&&player.horseLv<10){showMsg('At üstünde yetenek için At Lv 10 gerekir.');return;}const sk=CLASSES[player.cls].skills[i];if(!sk||!skillOpen(i))return;
  if(player.skillCd[i]>0)return;const L=player.skills[i],Le=sEff(L),mp=skillMp(sk,L);if(player.mp<mp){showMsg('Yetersiz MP!');return;}
  player.mp-=mp;player.skillCd[i]=sk.cd;sfx('skill');const pp=player.group.position,now=performance.now(),pw=skillPow(L);
  if(sk.t==='heal'){const v=Math.round(sk.v*(1+.2*(Le-1))*(1+player.attr.iq*.02));player.hp=Math.min(player.maxHp,player.hp+v);showDamage(pp.clone().setY(2.2),'+'+v,'#6dff8a',false);spawnBurst(pp.clone(),sk.col);}
  else if(sk.t==='buff'){const v=sk.v*(1+.05*(Le-1));player.buffs[sk.b]={value:v,until:now+sk.dur*1000};if(sk.regen)player.buffs.regen={value:sk.regen*(1+.1*(Le-1)),until:now+sk.dur*1000};showMsg(sk.n+' aktif!');spawnBurst(pp.clone(),sk.col);}
  else if(sk.t==='aoe'){for(const e of enemies.slice()){if(e.dead||e.mesh.position.distanceTo(pp)>sk.r)continue;const cr=Math.random()*100<player.crit;
      const ad=hitDamage(sk.dm*pw,cr);e.takeDamage(ad,cr);elemProc(e,ad);if(!e.dead){if(sk.slow)e.slowUntil=now+3000;if(sk.stun)e.stunUntil=now+sk.stun*1000;}}spawnBurst(pp.clone(),sk.col);}
  else if(sk.t==='single'){const RG=sk.rng||8,e=(target&&!target.dead&&target.mesh.position.distanceTo(pp)<RG)?target:nearestEnemy(RG);
    if(!e){player.mp+=mp;player.skillCd[i]=0;showMsg('Hedef yok!');return;}faceTo(e);const cr=Math.random()*100<player.crit,dmg=hitDamage(sk.dm*pw,cr);e.takeDamage(dmg,cr);elemProc(e,dmg);
    if(!e.dead){if(sk.stun)e.stunUntil=now+sk.stun*1000;if(sk.dot)e.dot={until:now+6000,dps:dmg*sk.dot/6,acc:0,tx:0};}
    if(sk.leech){const h=Math.round(dmg*sk.leech);player.hp=Math.min(player.maxHp,player.hp+h);showDamage(pp.clone().setY(2.2),'+'+h,'#e8a',false);}spawnBurst(e.mesh.position.clone(),sk.col);}
  else if(sk.t==='chain'){const arr=enemies.filter(e=>!e.dead&&e.mesh.position.distanceTo(pp)<10).sort((a,b)=>a.mesh.position.distanceTo(pp)-b.mesh.position.distanceTo(pp)).slice(0,sk.n);
    if(!arr.length){player.mp+=mp;player.skillCd[i]=0;showMsg('Hedef yok!');return;}arr.forEach(e=>{const cr=Math.random()*100<player.crit,cd=hitDamage(sk.dm*pw,cr);e.takeDamage(cd,cr);elemProc(e,cd);spawnBurst(e.mesh.position.clone(),sk.col);});}
  updateHUD();renderSkillButtons();
}
const comboMul=()=>player.combo>=3?1.5:player.combo===2?1.15:1;
let comboTO=0;
function showCombo(){if(player.combo<2)return;const b=$('comboBox');b.textContent=player.combo===3?'KOMBO x3!':'x'+player.combo;b.classList.add('show');clearTimeout(comboTO);comboTO=setTimeout(()=>b.classList.remove('show'),460);}
function doAttack(){
  if(player.atkCd>0||!player.alive||!player.cls)return;
  const rg=CLASSES[player.cls].ranged,t=rg?((target&&!target.dead&&target.mesh.position.distanceTo(player.group.position)<13)?target:nearestEnemy(13)):nearestEnemy(6);if(t)faceTo(t);
  const spdMul=(player.buffs.atkspd&&performance.now()<player.buffs.atkspd.until)?1+player.buffs.atkspd.value:1;
  player.combo=(player.comboTimer>0&&player.combo<3)?player.combo+1:1;player.comboTimer=1.0;
  player.atkCd=(.5/comboMul())/spdMul;player.atkAnim=player.combo===3?.45:.34;player.hitTimer=.11;showCombo();
}
function applyHit(){
  const pRot=player.group.rotation.y,pp=player.group.position;let bonus=1,hits=0;if(player.buffs.dmg&&performance.now()<player.buffs.dmg.until)bonus+=player.buffs.dmg.value;
  if(player.mounted)bonus*=1.15;bonus*=comboMul();
  if(CLASSES[player.cls].ranged){shootArrow(bonus);return;}
  for(const e of enemies.slice()){if(e.dead)continue;const d=e.mesh.position.clone().sub(pp),dist=Math.hypot(d.x,d.z),reach=2.7+(e.sc>1?.5*e.sc:0)+(e.isMetin?.9:0)+(player.mounted?.5:0);if(dist>reach)continue;
    const th=Math.atan2(d.x,d.z);let diff=th-pRot;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;if(Math.abs(diff)>Math.PI*.62)continue;
    let ed=th-e.mesh.rotation.y;while(ed>Math.PI)ed-=Math.PI*2;while(ed<-Math.PI)ed+=Math.PI*2;
    const back=!e.isMetin&&(Math.abs(ed)<Math.PI*.3||performance.now()<e.stunUntil||e.state==='return'),cr=Math.random()*100<player.crit;let dmg=hitDamage(bonus,cr);if(back){dmg*=2;showDamage(e.mesh.position.clone().setY(e.h+.5),'SIRTTAN!','#f6f',false);}
    spawnBurst(e.mesh.position.clone(),cr?0xffd24a:back?0xff44ff:0xccddff);player.shake=Math.max(player.shake,cr?.22:back?.26:.09);if(cr||back||player.combo===3)player.hitstop=.06;
    e.takeDamage(dmg,cr);elemProc(e,dmg);hits++;}
  if(!hits)sfx('miss');
}
function damagePlayer(n,src){
  if(player.invuln>0||!player.alive)return;
  if(Math.random()*100<player.dodge){showDamage(player.group.position.clone().setY(2.2),'KAÇTI','#9cf',false);return;}
  let df=player.defPct/100;if(player.buffs.def&&performance.now()<player.buffs.def.until)df+=player.buffs.def.value;df=clamp(df,0,.75);
  const dm=Math.max(1,Math.round(n*(1-df)));player.hp-=dm;flashEl.style.opacity=.9;flashTimer=.16;sfx('hurt');showDamage(player.group.position.clone().setY(2.3),dm,'#f66',false);
  updateHUD();
  if(player.hp<=0){player.hp=0;player.alive=false;updateHUD();sfx('die');if(duel)duelEnd(false);else showMsg('ÖLDÜN...');setTimeout(respawn,1800);}
}
function respawn(){
  clearProjs();if(dungeon){leaveDungeon(false);}
  player.hp=player.maxHp;player.mp=player.maxMp;player.alive=true;player.invuln=2.5;player.group.position.set(0,0,4);
  player.xp=Math.max(0,player.xp-Math.floor(player.xpNext*.05));updateHUD();showMsg('Köyde yeniden doğdun!');saveGame();
}
function gainXP(n){
  player.xp+=n;
  while(player.xp>=player.xpNext){player.xp-=player.xpNext;player.level++;player.xpNext=Math.floor(50*Math.pow(player.level,1.5));player.pts+=3;player.sp+=1;
    recalcStats();player.hp=player.maxHp;player.mp=player.maxMp;showMsg('SEVİYE ATLADIN! Lv '+player.level+' (+3 statü, +1 yetenek puanı)');sfx('level');spawnBurst(player.group.position.clone(),0xffd24a);renderSkillButtons();saveGame();}
  updateHUD();
}
function usePot(k){
  if(!player.alive||player.potCd>0)return;if(player.pots[k]<1){showMsg('İksirin kalmadı! (Tüccardan al)');return;}
  if(k==='hp'){if(player.hp>=player.maxHp)return;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.35);}else{if(player.mp>=player.maxMp)return;player.mp=Math.min(player.maxMp,player.mp+player.maxMp*.35);}
  player.pots[k]--;player.potCd=1.5;sfx('pot');updateHUD();
}
function toggleMount(){if(!player.horse)return;if(dungeon){showMsg('Zindanda ata binilmez.');return;}player.mounted=!player.mounted;paintMount();}

/* =========================================================
   7. GÖREVLER
   ========================================================= */
const QDEF={
  kill:{text:n=>n+' canavar öldür',need:t=>6+t*4,yang:t=>50*t,xp:t=>30*t},
  metin:{text:n=>n+' Metin taşı kır',need:t=>Math.ceil(t/2),yang:t=>110*t,xp:t=>70*t},
  pvp:{text:n=>n+' düello kazan',need:t=>Math.ceil(t/2),yang:t=>130*t,xp:t=>90*t},
  boss:{text:n=>n+' boss öldür',need:t=>Math.ceil(t/2),yang:t=>200*t,xp:t=>150*t},
  dungeon:{text:n=>n+' zindan bitir',need:t=>Math.ceil(t/2),yang:t=>250*t,xp:t=>180*t}
};
function makeQuest(kind,tier,cur){const d=QDEF[kind],need=d.need(tier);return {kind,tier,cur:cur||0,need,text:d.text(need),reward:{yang:d.yang(tier),xp:d.xp(tier)}};}
function questProgress(kind){const q=player.quests.find(q=>q.kind===kind);if(!q)return;q.cur++;
  if(q.cur>=q.need){const rw=q.reward,old=q.text,i=player.quests.indexOf(q);player.yang+=rw.yang;sfx('quest');player.quests[i]=makeQuest(kind,q.tier+1,0);gainXP(rw.xp);
    showMsg('Görev tamamlandı: '+old+' (+'+rw.yang+' Yang)');saveGame();}
  renderQuestsIfOpen();}

/* =========================================================
   8. DÜELLO / ARENA, ZİNDAN
   ========================================================= */
const BOTS=[['Karaoğlan',160],['Kızıl Kurt',130],['Gölgeavcı',105],['Demir Yumruk',85],['Buzkıran',60],['Çöl Şahini',40],['Yıldırım',25],['Çırak Ali',10]];
function startPvP(){
  if(duel&&!duel.dead){duel.remove();const i=enemies.indexOf(duel);if(i>=0)enemies.splice(i,1);duel=null;showMsg('Düellodan çekildin.');return;}
  if(!player.alive||dungeon)return;const a=Math.random()*6.28,p=player.group.position,keys=Object.keys(CLASSES).filter(k=>k!==player.cls),cls=keys[Math.floor(Math.random()*keys.length)];
  duel=new Enemy(new THREE.Vector3(p.x+Math.cos(a)*9,0,p.z+Math.sin(a)*9),null,player.level,{kind:'pvp',cls});duel.state='chase';enemies.push(duel);showMsg('DÜELLO başladı! Rakip: '+CLASSES[cls].name);
}
function duelEnd(won){
  if(!duel)return;
  if(won){player.stats.pvpWin++;player.arena+=25;questProgress('pvp');showMsg('DÜELLOYU KAZANDIN! +25 arena puanı');sfx('quest');}
  else{player.stats.pvpLoss++;player.arena=Math.max(0,player.arena-10);const f=duel;f.remove();const i=enemies.indexOf(f);if(i>=0)enemies.splice(i,1);showMsg('Düelloyu kaybettin... -10 puan');}
  duel=null;saveGame();
}
function enterDungeon(id){
  if(dungeon)return;const def=DGS.find(d=>d.id===id)||DGS[0];
  if(player.level<def.min){showMsg(def.n+' için en az '+def.min+'. seviye gerekir.');return;}if(player.keys<1){showMsg('Zindan Anahtarın yok! (Tüccardan al)');return;}
  if(duel){showMsg('Önce düelloyu bitir.');return;}
  player.keys--;player.mounted=false;paintMount();enemies.slice().forEach(e=>{if(!e.dead){e.remove();}});enemies.length=0;clearProjs();
  dungeon={def,t:300+def.waves*20,wave:0,done:false,exitT:0,pend:false};ZONES.dungeon.n=def.n;ZONES.dungeon.fog=def.fog;
  player.group.position.set(DG.x,0,DG.z+DG.r-7);closePanels();showMsg(def.n+'! Süre: '+Math.round(dungeon.t/60*10)/10+' dk');spawnWave(1);saveGame();
}
function spawnWave(n){
  const def=dungeon.def;dungeon.wave=n;dungeon.pend=false;const L=Math.max(def.min-2,player.level)+n-1;
  if(n<=def.waves){showMsg('Dalga '+n+'/'+def.waves);for(let i=0;i<def.per;i++){const a=i/def.per*6.28+Math.random(),pos=new THREE.Vector3(DG.x+Math.cos(a)*12,0,DG.z+Math.sin(a)*12);
    const e=new Enemy(pos,def.mobs[Math.floor(Math.random()*def.mobs.length)],L,{dg:true});e.state='chase';enemies.push(e);}}
  else{showMsg('BOSS: '+SP[def.boss].n+'!');const e=new Enemy(new THREE.Vector3(DG.x,0,DG.z-8),def.boss,Math.max(def.min+2,player.level+3),{dg:true});e.state='chase';enemies.push(e);}
}
function dungeonKill(boss){
  if(!dungeon||dungeon.done)return;const def=dungeon.def,m=def.mul;
  if(boss){dungeon.done=true;dungeon.exitT=12;player.stats.dungeons++;questProgress('dungeon');player.shards+=Math.round(5*m);player.yang+=Math.round((300+player.level*30)*m);player.mats.book+=1+Math.floor(m);
    const p=player.group.position.clone();dropItem(p,m>=1.5?3:2,player.level+3);dropItem(p,2,player.level+3);showMsg('ZİNDAN TAMAMLANDI! Ödüller alındı. 12 sn sonra çıkış.');sfx('quest');return;}
  if(!dungeon.pend&&!enemies.some(e=>!e.dead&&e.dg)){dungeon.pend=true;setTimeout(()=>{if(dungeon&&!dungeon.done)spawnWave(dungeon.wave+1);},1200);}
}
function leaveDungeon(ok){
  if(!dungeon)return;enemies.slice().forEach(e=>{if(e.dg&&!e.dead)e.remove();});for(let i=enemies.length-1;i>=0;i--)if(enemies[i].dead)enemies.splice(i,1);clearProjs();
  dungeon=null;player.group.position.set(0,0,-10);if(!ok)showMsg('Zindandan çıkıldı.');else chat('Köye döndün.','#9fd');saveGame();
}

/* =========================================================
   9. KAYIT
   ========================================================= */
const SAVE_KEY='metin2m_save_v2';
function saveGame(){
  if(!player.cls||window.__noSave)return;
  try{localStorage.setItem(SAVE_KEY,JSON.stringify({v:2,cls:player.cls,name:player.name,level:player.level,xp:player.xp,xpNext:player.xpNext,yang:player.yang,attr:player.attr,pts:player.pts,sp:player.sp,skills:player.skills,
    inventory:player.inventory,equipped:player.equipped,pots:player.pots,scrolls:player.scrolls,keys:player.keys,shards:player.shards,horse:player.horse,arena:player.arena,
    quests:player.quests.map(q=>({kind:q.kind,tier:q.tier,cur:q.cur})),itemId,stats:player.stats,mats:player.mats,kingdom:player.kingdom,pets:player.pets,petId:player.petId,petIdC,horseLv:player.horseLv,horseXp:player.horseXp,ach:player.ach||[]}));}catch(e){}
}
function readSave(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return s&&s.v===2&&CLASSES[s.cls]?s:null;}catch(e){return null;}}
function applySave(s){
  player.name=String(s.name||'Kahraman').slice(0,14);player.level=s.level|0||1;player.xp=+s.xp||0;player.xpNext=+s.xpNext||50;player.yang=+s.yang||0;
  player.attr=Object.assign({st:5,dx:5,ht:5,iq:5},s.attr||{});player.pts=s.pts|0;player.sp=s.sp|0;player.skills=Array.isArray(s.skills)&&s.skills.length===4?s.skills:[1,0,0,0];
  player.inventory=Array.isArray(s.inventory)?s.inventory:[];player.equipped=Object.assign({},s.equipped||{});
  player.pots=Object.assign({hp:0,mp:0},s.pots||{});player.scrolls=Object.assign({bless:0},s.scrolls||{});player.keys=s.keys|0;player.shards=s.shards|0;player.horse=!!s.horse;player.arena=s.arena|0;
  player.ach=Array.isArray(s.ach)?s.ach.filter(x=>typeof x==='string'):[];itemId=+s.itemId||0;player.stats=Object.assign({kills:0,metins:0,pvpWin:0,pvpLoss:0,bosses:0,dungeons:0},s.stats||{});
  player.mats=Object.assign({tooth:0,sting:0,shard:0,soul:0,book:0},s.mats||{});player.kingdom=KINGDOMS.some(k=>k.id===s.kingdom)?s.kingdom:'aslan';player.pets=Array.isArray(s.pets)?s.pets.filter(p=>PETS[p.k]):[];player.petId=s.petId|0;petIdC=+s.petIdC||player.pets.reduce((m,p)=>Math.max(m,p.id),0);
  player.horseLv=Math.max(1,Math.min(30,(s.horseLv|0)||1));player.horseXp=+s.horseXp||0;
  const qs=(s.quests||[]).filter(q=>QDEF[q.kind]).map(q=>makeQuest(q.kind,Math.max(1,q.tier|0),q.cur|0));for(const k of Object.keys(QDEF))if(!qs.some(q=>q.kind===k))qs.push(makeQuest(k,1,0));player.quests=qs;
}
setInterval(saveGame,5000);addEventListener('pagehide',saveGame);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame();});

/* =========================================================
   6b. OK/BÜYÜ MERMİLERİ, ELEMENT, PET, AT SEVİYESİ, TAKLA
   ========================================================= */
let petMesh=null,petIdC=0; // applySave'den önce tanımlı kalsın
Object.assign(player,{combo:0,comboTimer:0,dodging:0,dodgeCd:0,dodgeDir:{x:0,z:1},shake:0,hitstop:0,mats:{tooth:0,sting:0,shard:0,soul:0,book:1},horseLv:1,horseXp:0,pets:[],petId:0,kingdom:'aslan',moveX:0,moveZ:0});
const projs=[],arrowGeo=new THREE.BoxGeometry(.1,.1,.75),orbGeo=new THREE.SphereGeometry(.22,6,6);
function fireProj(from,tgtFn,col,speed,arrow,onHit){
  const m=new THREE.Mesh(arrow?arrowGeo:orbGeo,new THREE.MeshBasicMaterial({color:col}));m.position.copy(from);scene.add(m);projs.push({m,tgt:tgtFn,sp:speed,onHit,life:2.5});
}
function updateProjs(dt){
  for(let i=projs.length-1;i>=0;i--){const p=projs[i];p.life-=dt;const t=p.tgt(),m=p.m.position,dx=t.x-m.x,dy=t.y-m.y,dz=t.z-m.z,d=Math.hypot(dx,dy,dz)||.001;
    if(d<.7||p.life<=0){if(d<.7)p.onHit();scene.remove(p.m);p.m.material.dispose();projs.splice(i,1);continue;}
    const st=Math.min(d,p.sp*dt);m.x+=dx/d*st;m.y+=dy/d*st;m.z+=dz/d*st;p.m.rotation.y=Math.atan2(dx,dz);}
}
function clearProjs(){for(const p of projs){scene.remove(p.m);p.m.material.dispose();}projs.length=0;}
function shootArrow(bonus){
  const pp=player.group.position,e=(target&&!target.dead&&target.mesh.position.distanceTo(pp)<13)?target:nearestEnemy(13);if(!e){sfx('miss');return;}
  const cr=Math.random()*100<player.crit,dmg=hitDamage(bonus,cr);sfx('skill');
  fireProj(pp.clone().setY(1.5+player.bodyY),()=>e.mesh.position.clone().setY(1.1),0xffe08a,34,true,()=>{if(!e.dead){player.shake=Math.max(player.shake,cr?.18:.06);e.takeDamage(dmg,cr);elemProc(e,dmg);}});
}
function enemyShoot(en){
  // Mermi ateş anındaki konuma gider; oyuncu kaçarsa/taklayla yer değiştirirse ıskalar (bilinçli kaçınma mekaniği).
  const from=en.mesh.position.clone().setY(en.h*.7),aim=player.group.position.clone().setY(1.1);
  fireProj(from,()=>aim,en.sp.proj,13,false,()=>{if(!player.alive)return;const pp=player.group.position;if(Math.hypot(pp.x-aim.x,pp.z-aim.z)<1.4)damagePlayer(en.dmg,en);});
}
function elemProc(e,dmg){
  const w=player.equipped.weapon;if(!w||!w.el||e.dead)return;const now=performance.now();
  if(w.el==='fire')e.dot={until:now+3000,dps:Math.max(1,dmg*.9/3),acc:0,tx:0};
  else if(w.el==='poison')e.dot={until:now+5000,dps:Math.max(1,dmg*1.1/5),acc:0,tx:0};
  else if(Math.random()<.4){e.slowUntil=now+3000;if(Math.random()<.3)e.stunUntil=now+700;}
  if(Math.random()<.25)spawnBurst(e.mesh.position.clone(),w.el==='fire'?0xff6a22:w.el==='ice'?0x88ddff:0x88ff44);
}
function triggerDodge(){
  if(player.dodgeCd>0||!player.alive||player.mounted||!player.cls)return;
  let dx=player.moveX,dz=player.moveZ;if(Math.hypot(dx,dz)<.1){dx=Math.sin(player.group.rotation.y);dz=Math.cos(player.group.rotation.y);}
  const l=Math.hypot(dx,dz)||1;player.dodgeDir={x:dx/l,z:dz/l};player.dodging=.28;player.dodgeCd=1.5;player.invuln=Math.max(player.invuln,.32);sfx('miss');spawnBurst(player.group.position.clone(),0x66ccff);
}
/* at */
const horseNext=lv=>Math.floor(15*Math.pow(lv,1.4));
function addHorseXp(n){if(!player.horse||player.horseLv>=30)return;player.horseXp+=n;
  while(player.horseXp>=horseNext(player.horseLv)&&player.horseLv<30){player.horseXp-=horseNext(player.horseLv);player.horseLv++;showMsg('🐎 At seviye atladı: Lv '+player.horseLv);if(player.horseLv===10)chat('Atın artık üstünde yetenek kullanabilirsin!','#ffe08a');}}
/* pet */
const activePet=()=>player.pets.find(p=>p.id===player.petId)||null;
const petXpNext=lv=>lv*15+10;
function addPetXp(n){const p=activePet();if(!p||p.lv>=10)return;p.xp+=n;if(p.xp>=petXpNext(p.lv)){p.xp=0;p.lv++;showMsg('🐾 '+PETS[p.k].n+' seviye atladı: Lv '+p.lv);recalcStats();}}
function hatchPet(){if(player.pets.length>=8){showMsg('Pet çantan dolu!');return false;}const k=PETKEYS[Math.floor(Math.random()*PETKEYS.length)],p={id:++petIdC,k,lv:1,xp:0,v:Math.floor(Math.random()*5)};player.pets.push(p);
  if(!player.petId)setActivePet(p.id);showMsg('🥚 Yumurtadan '+PETS[k].n+' çıktı!');sfx('level');return true;}
function setActivePet(id){player.petId=player.petId===id?0:id;buildPetMesh();recalcStats();saveGame();}
function petCol(c,v){const r=c>>16&255,g=c>>8&255,b=c&255,p=[[r,g,b],[g,b,r],[b,r,g],[b,g,r],[g,r,b]][v%5];return (p[0]<<16)|(p[1]<<8)|p[2];}
function buildPetMesh(){
  if(petMesh){scene.remove(petMesh);petMesh=null;}const p=activePet();if(!p)return;const P=PETS[p.k],g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:petCol(P.col,p.v||0)});
  if(p.k==='slime'){const b=new THREE.Mesh(new THREE.SphereGeometry(.36,10,8),m);b.scale.set(1,.75,1);b.position.y=.3;g.add(b);}
  else if(p.k==='kurt'){const b=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.34,3,6),m);b.rotation.x=Math.PI/2;b.position.y=.3;const hd=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),m);hd.position.set(0,.4,.32);g.add(b,hd);}
  else if(p.k==='ejder'||p.k==='kartal'){const b=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),m),w1=new THREE.Mesh(G.box,m),w2=new THREE.Mesh(G.box,m),hd=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),m);b.scale.set(1,.9,1.3);b.position.y=.85;hd.position.set(0,.95,.3);w1.scale.set(.55,.04,.3);w1.position.set(.38,.9,0);w2.scale.set(.55,.04,.3);w2.position.set(-.38,.9,0);g.add(b,hd,w1,w2);}
  else if(p.k==='tilki'||p.k==='kedi'){const b=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.3,3,6),m);b.rotation.x=Math.PI/2;b.position.y=.3;const hd=new THREE.Mesh(new THREE.SphereGeometry(.15,8,6),m);hd.position.set(0,.4,.3);const t=new THREE.Mesh(new THREE.CapsuleGeometry(.06,.3,3,5),m);t.rotation.x=1.1;t.position.set(0,.4,-.35);g.add(b,hd,t);}
  else if(p.k==='ruh'){const b=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),new THREE.MeshBasicMaterial({color:P.col}));b.position.y=.9;g.add(b);}
  else{const b=new THREE.Mesh(new THREE.SphereGeometry(.26,8,8),m),w1=new THREE.Mesh(G.box,m);b.position.y=.8;w1.scale.set(.5,.05,.2);w1.position.set(.35,.85,0);const w2=new THREE.Mesh(G.box,m);w2.scale.set(.5,.05,.2);w2.position.set(-.35,.85,0);g.add(b,w1,w2);}
  g.userData.k=p.k;scene.add(g);petMesh=g;const pp=player.group.position;g.position.set(pp.x+1,0,pp.z+1);
}
function updatePet(dt){
  if(!petMesh)return;const pp=player.group.position,r=player.group.rotation.y,m=petMesh.position,tx=pp.x-Math.sin(r)*1.3+Math.cos(r)*1.1,tz=pp.z-Math.cos(r)*1.3-Math.sin(r)*1.1;
  m.x+=(tx-m.x)*Math.min(1,dt*4);m.z+=(tz-m.z)*Math.min(1,dt*4);petMesh.rotation.y=Math.atan2(pp.x-m.x,pp.z-m.z);const k=petMesh.userData.k;
  m.y=(k==='ruh'||k==='bayku')?.4+Math.sin(performance.now()/300)*.18:Math.abs(Math.sin(performance.now()/180))*.12;if(Math.hypot(pp.x-m.x,pp.z-m.z)>14){m.x=pp.x;m.z=pp.z;}
}
/* ölünce ek ödüller: malzeme, kitap, pet/at tecrübesi */
function onKillExtras(en){
  if(en.isPvP)return;const zone=en.camp?en.camp.zone:null;
  if(!en.isMetin){const mk=zone?ZMAT[zone]:(en.dg?(Math.random()<.5?'soul':'shard'):null);
    if(mk&&Math.random()<(en.boss?1:.24)){const n=en.boss?3+Math.floor(Math.random()*3):1;player.mats[mk]+=n;chat('Düştü: '+MATS[mk].i+' '+MATS[mk].n+' x'+n,'#9fd');}}
  if((en.boss||en.isMetin)&&Math.random()<(en.boss?.7:.25)){player.mats.book++;showMsg('📘 Beceri Kitabı düştü!');}
  addPetXp(1);addHorseXp(player.mounted?3:1);
}

/* =========================================================
   6c. GÖRSEL İYİLEŞTİRME: gökyüzü, bulut, hava durumu, parıltı, efektler
   ========================================================= */
try{if(THREE.ACESFilmicToneMapping){renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;}}catch(e){}
const FX={t:0,zone:'village'};
/* gökyüzü kubbesi: ufuk rengi sisle aynı, tepe rengi bölgeye göre */
const SKYTOP={village:0x4d8fd6,forest:0x4d8fd6,desert:0x3f86d0,snow:0x7c9fc4,swamp:0x34403c,dungeon:0x1c1522};
const CLOUDC={village:0xffffff,forest:0xffffff,desert:0xfff2dd,snow:0xe8f0f8,swamp:0x8a948e,dungeon:0x000000};
const skyMat=new THREE.ShaderMaterial({uniforms:{top:{value:new THREE.Color(SKYTOP.village)},hor:{value:new THREE.Color(0x9fd0ec)},sunD:{value:new THREE.Vector3(.5,.6,.4)}},side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 top;uniform vec3 hor;uniform vec3 sunD;varying vec3 vDir;void main(){vec3 d=normalize(vDir);float h=clamp(d.y*1.5+.08,0.,1.);vec3 c=mix(hor,top,pow(h,.55));float s=max(dot(d,normalize(sunD)),0.);c+=vec3(1.,.85,.55)*(pow(s,500.)*1.6+pow(s,7.)*.22);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(190,24,12),skyMat);skyDome.renderOrder=-10;skyDome.frustumCulled=false;scene.add(skyDome);
/* bulutlar */
const cloudTex=(()=>{const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d');
  for(let i=0;i<14;i++){const cx=24+Math.random()*80,cy=26+Math.random()*14,r=12+Math.random()*14,g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,64);}
  return new THREE.CanvasTexture(c);})();
const clouds=[];const cloudGrp=new THREE.Group();scene.add(cloudGrp);
for(let i=0;i<9;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,color:0xffffff,transparent:true,opacity:.7,depthWrite:false,fog:false}));
  const a=Math.random()*6.28,r=110+Math.random()*50,w=50+Math.random()*50;s.scale.set(w,w*.45,1);cloudGrp.add(s);clouds.push({s,a,r,h:34+Math.random()*34,sp:.004+Math.random()*.006});}
/* parıltı sprite'ları (bloom yerine ucuz çözüm) */
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const glows=[];
function addGlow(parent,col,size,x,y,z,owner){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:col,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false}));
  s.scale.set(size,size,1);s.position.set(x,y,z);parent.add(s);glows.push({s,base:size,ph:Math.random()*6,owner,parent});return s;
}
[[-24,-24],[24,-24],[-24,24],[24,24],[0,-26],[0,26],[-26,0],[26,0]].forEach(p=>addGlow(scene,0xffa040,3.4,p[0],2.6,p[1],null));
addGlow(scene,0xaa55ff,7,0,2.4,-17,null);
/* kısa parlama ve şok halkası havuzları */
const flashes=[],rings=[];let flashI=0,ringI=0;
for(let i=0;i<24;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffffff,blending:THREE.AdditiveBlending,transparent:true,opacity:0,depthWrite:false,fog:false}));s.visible=false;scene.add(s);flashes.push({s,life:0,max:.3,size:2});}
for(let i=0;i<6;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.82,1,32),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide||2}));m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);rings.push({m,life:0,max:.4,r:3});}
function flashFx(pos,col,size){const f=flashes[flashI++%flashes.length];f.s.material.color.setHex(col);f.s.position.set(pos.x,(pos.y||0)+1.1,pos.z);f.size=size||2.6;f.life=f.max=.3;f.s.visible=true;}
function ringFx(pos,radius,col){const r=rings[ringI++%rings.length];r.m.material.color.setHex(col);r.m.position.set(pos.x,.12,pos.z);r.r=radius;r.life=r.max=.42;r.m.visible=true;}
const _sb=spawnBurst;spawnBurst=function(pos,color){_sb(pos,color);flashFx(pos,color,2.4);};
const _us=useSkill;
useSkill=function(i){const before=player.skillCd[i];_us(i);if(player.cls&&player.skillCd[i]>0&&before<=0){const sk=CLASSES[player.cls].skills[i];
  if(sk.t==='aoe')ringFx(player.group.position,sk.r,sk.col);else if(sk.t==='buff'||sk.t==='heal')ringFx(player.group.position,2.4,sk.col);}};
/* kılıç izi */
const slashes=[];
for(let i=0;i<3;i++){const g=new THREE.Group(),m=new THREE.Mesh(new THREE.RingGeometry(1.3,2.1,20,1,-Math.PI*.9,Math.PI*.8),new THREE.MeshBasicMaterial({color:0xddeeff,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide||2}));
  m.rotation.x=-Math.PI/2;g.add(m);g.visible=false;scene.add(g);slashes.push({g,m,life:0,max:.2});}
let slashI=0;
const _da=doAttack;
doAttack=function(){const was=player.atkCd;_da();if(player.atkCd>was&&!CLASSES[player.cls].ranged){const s=slashes[slashI++%slashes.length],c3=player.combo===3;
  s.m.material.color.setHex(c3?0xffa030:0xddeeff);s.g.position.set(player.group.position.x,.95+player.bodyY,player.group.position.z);s.g.rotation.y=player.group.rotation.y;s.g.scale.setScalar(c3?1.35:1);s.life=s.max=c3?.28:.2;s.g.visible=true;}};
/* hava durumu parçacıkları */
const WX={forest:{c:0xfff0a0,size:.14,vx:.4,vy:.25,n:120,op:.7,wrap:true},desert:{c:0xd9b878,size:.17,vx:7,vy:-.3,n:260,op:.55},snow:{c:0xffffff,size:.22,vx:1,vy:-2.4,n:520,op:.9},swamp:{c:0x9ab8ff,size:.1,vx:-2,vy:-22,n:600,op:.55}};
const WMAX=600,wpos=new Float32Array(WMAX*3),wgeo=new THREE.BufferGeometry();
for(let i=0;i<WMAX;i++){wpos[i*3]=(Math.random()-.5)*60;wpos[i*3+1]=Math.random()*22;wpos[i*3+2]=(Math.random()-.5)*60;}
wgeo.setAttribute('position',new THREE.BufferAttribute(wpos,3));
const wmat=new THREE.PointsMaterial({color:0xffffff,size:.2,transparent:true,opacity:.8,depthWrite:false});
const wpts=new THREE.Points(wgeo,wmat);wpts.frustumCulled=false;wpts.visible=false;scene.add(wpts);let wcur=null;
function gfxZone(z){FX.zone=z;wcur=WX[z]||null;wpts.visible=!!wcur;if(wcur){wmat.color.setHex(wcur.c);wmat.size=wcur.size;wmat.opacity=wcur.op;if(wgeo.setDrawRange)wgeo.setDrawRange(0,wcur.n);}
  skyDome.visible=z!=='dungeon';cloudGrp.visible=z!=='dungeon';}
/* göletler (geçilmez su) */
const ponds=[];
[[-48,72,7,0x2f6ea8],[-92,-26,8,0x3a5a3a]].forEach(p=>{const g=new THREE.Group(),mud=new THREE.Mesh(new THREE.CircleGeometry(p[2]+1.2,24),new THREE.MeshLambertMaterial({color:0x4a4a2a}));mud.rotation.x=-Math.PI/2;mud.position.y=.03;
  const w=new THREE.Mesh(new THREE.CircleGeometry(p[2],24),new THREE.MeshLambertMaterial({color:p[3],transparent:true,opacity:.82,emissive:0x0a1a28}));w.rotation.x=-Math.PI/2;w.position.y=.06;g.add(mud,w);g.position.set(p[0],0,p[1]);scene.add(g);
  obstacles.push({x:p[0],z:p[1],r:p[2]-.3});ponds.push({w,ph:Math.random()*6});});
/* düşük can uyarısı */
const lowHpEl=$('lowHp'),tmpC1=new THREE.Color(),tmpC2=new THREE.Color();
function gfxUpdate(dt){
  FX.t+=dt;const t=FX.t,cp=camera.position,pp=player.group.position;
  skyDome.position.copy(cp);
  if(scene.fog&&scene.fog.color&&skyMat.uniforms.hor.value.copy)skyMat.uniforms.hor.value.copy(scene.fog.color);
  tmpC1.setHex(SKYTOP[FX.zone]||SKYTOP.village);if(skyMat.uniforms.top.value.lerp)skyMat.uniforms.top.value.lerp(tmpC1,Math.min(1,dt*1.5));
  /* yavaş gün döngüsü: öğle ↔ altın saat */
  const el=(48+22*Math.sin(t*2*Math.PI/420))*Math.PI/180,az=.7;
  skyMat.uniforms.sunD.value.set(Math.cos(el)*Math.sin(az),Math.sin(el),Math.cos(el)*Math.cos(az));
  if(typeof sun!=='undefined'&&sun.position){sun.position.set(skyMat.uniforms.sunD.value.x*60,skyMat.uniforms.sunD.value.y*60,skyMat.uniforms.sunD.value.z*60);
    const warm=1-Math.min(1,(el*180/Math.PI-26)/22);if(sun.color&&sun.color.setRGB)sun.color.setRGB(1,1-.18*warm,1-.38*warm);}
  const cc=tmpC2.setHex(CLOUDC[FX.zone]||0xffffff);
  for(const c of clouds){c.a+=dt*c.sp;c.s.position.set(cp.x+Math.cos(c.a)*c.r,c.h,cp.z+Math.sin(c.a)*c.r);if(c.s.material.color.lerp)c.s.material.color.lerp(cc,Math.min(1,dt));}
  /* hava durumu */
  if(wcur&&wpts.visible){const n=wcur.n,W=30,H=22;for(let i=0;i<n;i++){let x=wpos[i*3]+wcur.vx*dt,y=wpos[i*3+1]+wcur.vy*dt+(wcur.wrap?Math.sin(t+i)*.3*dt:0),z=wpos[i*3+2];
      if(wcur.vy===-22)z+=0;if(x-pp.x>W)x-=2*W;else if(x-pp.x<-W)x+=2*W;if(z-pp.z>W)z-=2*W;else if(z-pp.z<-W)z+=2*W;if(y<0)y+=H;else if(y>H)y-=H;
      wpos[i*3]=x;wpos[i*3+1]=y;wpos[i*3+2]=z;}wgeo.attributes.position.needsUpdate=true;}
  /* parıltılar */
  for(let i=glows.length-1;i>=0;i--){const g=glows[i];if(g.owner&&g.owner.dead){if(g.parent&&g.parent.remove)g.parent.remove(g.s);g.s.material.dispose();glows.splice(i,1);continue;}
    const k=g.base*(1+.13*Math.sin(t*3+g.ph));g.s.scale.set(k,k,1);}
  for(const f of flashes)if(f.life>0){f.life-=dt;const k=Math.max(0,f.life/f.max);f.s.material.opacity=k*.9;f.s.scale.set(f.size*(1.4-k*.4),f.size*(1.4-k*.4),1);if(f.life<=0)f.s.visible=false;}
  for(const r of rings)if(r.life>0){r.life-=dt;const k=Math.max(0,r.life/r.max);r.m.material.opacity=k*.85;r.m.scale.setScalar(Math.max(.2,r.r*(1-k*k)));if(r.life<=0)r.m.visible=false;}
  for(const s of slashes)if(s.life>0){s.life-=dt;const k=Math.max(0,s.life/s.max);s.m.material.opacity=k*.9;s.g.rotation.y+=dt*3;if(s.life<=0)s.g.visible=false;}
  for(const p of ponds)p.w.material.opacity=.78+Math.sin(t*1.4+p.ph)*.06;
  if(lowHpEl){const f=player.cls&&player.alive?player.hp/player.maxHp:1;lowHpEl.style.opacity=f<.3?(.35+.25*Math.sin(t*5))*(1-f/.3):0;}
}

/* model animasyon kancaları */
{const _us2=useSkill;useSkill=function(i){const b=player.skillCd[i];_us2(i);if(player.skillCd[i]>0&&b<=0)heroCast();};
const _dp=damagePlayer;damagePlayer=function(){const hp=player.hp;const r=_dp.apply(null,arguments);if(player.hp<hp)heroHurt(hp-player.hp>player.maxHp*.18);return r;};}

/* =========================================================
   10. ARAYÜZ: HUD, paneller, NPC pencereleri
   ========================================================= */
const panels={inv:$('invPanel'),char:$('charPanel'),quest:$('questPanel'),npc:$('npcPanel')};
let smithSel=0,npcCur=null;
const PCT=(a,b)=>Math.max(0,Math.min(100,a/Math.max(1,b)*100))+'%';
function updateHUD(){
  if(!player.cls)return;
  $('pName').textContent=player.name;$('lvBadge').textContent=player.level;$('portrait').textContent=CLASSES[player.cls].icon;
  $('hpFill').style.width=PCT(player.hp,player.maxHp);$('hpTxt').textContent=Math.ceil(player.hp)+' / '+player.maxHp;
  $('mpFill').style.width=PCT(player.mp,player.maxMp);$('mpTxt').textContent=Math.floor(player.mp)+' / '+player.maxMp;
  $('xpFill').style.width=PCT(player.xp,player.xpNext);$('xpTxt').textContent='Lv '+player.level+'  •  '+Math.floor(player.xp)+' / '+player.xpNext+'  ('+Math.floor(player.xp/player.xpNext*100)+'%)';
  $('hpN').textContent=player.pots.hp;$('mpN').textContent=player.pots.mp;
  const canSk=player.sp>0&&player.skills.some((l,i)=>player.level>=UNLOCK[i]&&l<10);
  $('ptDot').style.display=(player.pts>0||canSk)?'block':'none';
  $('mountBtn').style.display=player.horse?'block':'none';
}
function renderSkillButtons(){
  const c=CLASSES[player.cls];if(!c)return;
  for(let i=0;i<4;i++){const b=$('s'+(i+1)),sk=c.skills[i];
    if(!skillOpen(i)){b.className='skillBtn off';b.innerHTML=player.level<UNLOCK[i]?'🔒<span class="cost">Lv '+UNLOCK[i]+'</span>':'＋<span class="cost">öğren</span>';}
    else{b.className='skillBtn'+(player.skillCd[i]>0?' cool':'');b.innerHTML=sk.n+'<span class="cost">'+skillMp(sk,player.skills[i])+' MP</span>';}}
}
function closePanels(){for(const k in panels)panels[k].classList.remove('open');npcCur=null;}
function openPanel(k){const was=panels[k].classList.contains('open');closePanels();if(was)return;panels[k].classList.add('open');renderPanel(k);}
function renderPanel(k){const p=panels[k],st=p.scrollTop;({inv:renderInv,char:renderChar,quest:renderQuests,npc:renderNpc})[k]();p.scrollTop=st;}
function renderInvIfOpen(){for(const k in panels)if(panels[k].classList.contains('open'))renderPanel(k);}
function renderQuestsIfOpen(){if(panels.quest.classList.contains('open'))renderPanel('quest');}
function findItem(id){for(const s of SLOTKEYS)if(player.equipped[s]&&player.equipped[s].id===id)return player.equipped[s];return player.inventory.find(i=>i.id===id)||null;}
const affHtml=it=>it.aff.map(f=>' · '+affTxt(f)).join('');
function itemRow(it,btns,tag){return '<div class="itemRow"><span>'+SLOTS[it.slot].i+'</span><span class="name" style="color:'+rarClr(it)+'">'+(tag||'')+it.name+(it.up?' +'+it.up:'')+' <small>Lv'+it.lv+'</small><span class="aff">'+SLOTS[it.slot].n+' '+istat(it)+affHtml(it)+'</span></span>'+btns+'</div>';}
const btn=(a,label,extra,dis)=>'<button data-act="'+a+'" '+(extra||'')+(dis?' disabled':'')+'>'+label+'</button>';
const matsLine=()=>MATKEYS.map(k=>MATS[k].i+' '+(player.mats[k]||0)).join('  ');
function resLine(){return '<div class="stat"><span>💰 '+player.yang+' Yang</span><span>🗝 '+player.keys+'  💎 '+player.shards+'  📖 '+player.scrolls.bless+'</span></div><div class="stat" style="font-size:10.5px"><span>'+matsLine()+'</span></div>';}
function matLack(it){const nd=upMats(it.up);if(!nd)return false;for(const k in nd)if((player.mats[k]||0)<nd[k])return true;return false;}
function matReq(it){const nd=upMats(it.up);if(!nd||it.up>=UP_MAX)return '';return '<div class="stat"><span>Gerekli malzeme</span><span style="color:'+(matLack(it)?'#f88':'#7f7')+'">'+Object.keys(nd).map(k=>MATS[k].i+' '+(player.mats[k]||0)+'/'+nd[k]).join('  ')+'</span></div>';}

function renderInv(){
  let h=resLine()+'<div class="slots">';
  for(const s of SLOTKEYS){const it=player.equipped[s];
    h+='<div class="slot" '+(it?'data-act="unequip" data-s="'+s+'" style="color:'+rarClr(it)+'"':'')+'><b>'+SLOTS[s].i+' '+SLOTS[s].n+'</b>'+(it?(it.el?ELEMENTS[it.el].n.split(' ')[0]+' ':'')+RARITIES.find(r=>r.key===it.rarity).name+(it.up?' +'+it.up:'')+'<br>'+istat(it):'—')+'</div>';}
  h+='</div><div class="stat"><span>Çanta ('+player.inventory.length+'/'+INV_MAX+')</span>'+btn('sellcommon','Sıradanları sat')+'</div>';
  const list=player.inventory.slice().sort((a,b)=>SLOTKEYS.indexOf(a.slot)-SLOTKEYS.indexOf(b.slot)||istat(b)-istat(a));
  if(!list.length)h+='<div class="stat"><span>Çantan boş. Canavar kes, Metin taşı kır!</span></div>';
  for(const it of list){const cur=player.equipped[it.slot],diff=istat(it)-(cur?istat(cur):0);
    h+=itemRow(it,'<span style="font-size:10px;color:'+(diff>=0?'#7f7':'#f88')+'">'+(diff>=0?'+':'')+diff+'</span>'+btn('equip','Kuşan','data-id="'+it.id+'"')+btn('sell',it.value+'💰','data-id="'+it.id+'"'));}
  $('invBody').innerHTML=h;
}
function renderChar(){
  const c=CLASSES[player.cls],a=player.attr,b=player.bon,kd=KINGDOMS.find(k=>k.id===player.kingdom);let h='<div class="stat"><span>'+c.icon+' '+player.name+' — '+c.name+'</span><span>Lv '+player.level+'</span></div>';
  if(kd)h+='<div class="stat"><span style="color:'+kd.c+'">⚑ '+kd.n+'</span><span>'+kd.d+'</span></div>';
  h+='<div class="stat"><span><b>Statü puanı:</b> '+player.pts+'</span><span><b>Yetenek puanı:</b> '+player.sp+'</span></div>';
  const AN={st:['💪 Güç','saldırı'],dx:['🏹 Çeviklik','kritik, kaçınma'],ht:['❤ Dayanıklılık','can'],iq:['🧠 Zekâ','mana, yetenek gücü']};
  for(const k of ['st','dx','ht','iq'])h+='<div class="stat"><span>'+AN[k][0]+' <small style="color:#9a8a68">('+AN[k][1]+')</small></span><span>'+a[k]+' '+btn('attr','＋','data-k="'+k+'"',player.pts<1)+'</span></div>';
  h+='<div class="stat"><span>⚔ Saldırı</span><span>'+Math.round(player.baseDmg)+'</span></div><div class="stat"><span>✦ Kritik / 🌀 Kaçınma</span><span>%'+player.crit.toFixed(1)+' / %'+player.dodge.toFixed(1)+'</span></div>';
  h+='<div class="stat"><span>🛡 Savunma</span><span>%'+player.defPct.toFixed(0)+'</span></div><div class="stat"><span>❤ Can / 💧 Mana</span><span>'+player.maxHp+' / '+player.maxMp+'</span></div>';
  h+='<div class="stat"><span>👟 Hız</span><span>'+player.speed.toFixed(1)+'</span></div><div class="stat" style="margin-top:4px"><b>Yetenekler</b><span style="font-size:10px;color:#9a8a68">Sv10 sonrası: 📘 kitapla M / G</span></div>';
  c.skills.forEach((sk,i)=>{const L=player.skills[i],lock=player.level<UNLOCK[i];let bt;
    if(lock||L>=20)bt=btn('skup','＋','data-i="'+i+'"',true);else if(L<10)bt=btn('skup','＋','data-i="'+i+'"',player.sp<1);else{const nd=L<15?1:2;bt=btn('skbook','📘 '+nd+' • %'+(L<15?70:45),'data-i="'+i+'"',player.mats.book<nd);}
    h+='<div class="stat"><span>'+sk.n+' <small style="color:#9a8a68">'+(lock?'Lv '+UNLOCK[i]+' gerekir':skLv(L)+' • '+skillMp(sk,Math.max(1,L))+' MP')+'</small></span><span>'+bt+'</span></div>';});
  if(player.horse)h+='<div class="stat"><span>🐎 At</span><span>Lv '+player.horseLv+(player.horseLv<30?' ('+player.horseXp+'/'+horseNext(player.horseLv)+')':' MAX')+'</span></div><div class="stat" style="display:block;font-size:10px;color:#9a8a68">Hız: +%'+Math.round((.45+player.horseLv*.015)*100)+'. Lv 10\'da at üstünde yetenek, atla saldırı +%15 hasar.</div>';
  h+='<div class="stat" style="margin-top:4px"><b>Evcil hayvanlar</b><span style="font-size:10px;color:#9a8a68">Tüccardan yumurta al</span></div>';
  if(!player.pets.length)h+='<div class="stat"><span style="color:#9a8a68">Hiç petin yok.</span></div>';
  for(const p of player.pets){const P=PETS[p.k];h+='<div class="stat"><span>🐾 '+P.n+' <small style="color:#9a8a68">Lv '+p.lv+' • '+P.d+'</small></span><span>'+btn('petsel',p.id===player.petId?'✓ Aktif':'Çağır','data-id="'+p.id+'"')+'</span></div>';}
  const bn=AFFKEYS.filter(k=>b[k]);if(bn.length)h+='<div class="stat" style="display:block"><b>Eşya/pet bonusları:</b> '+bn.map(k=>AFFIX[k].n+' +'+Math.round(b[k])+AFFIX[k].u).join(', ')+'</div>';
  const s=player.stats;h+='<div class="stat" style="display:block"><b>İstatistik:</b> '+s.kills+' canavar • '+s.metins+' Metin • '+s.bosses+' boss • '+s.dungeons+' zindan • '+s.pvpWin+'G/'+s.pvpLoss+'M düello</div>';
  $('charBody').innerHTML=h;
}
function renderQuests(){
  let h='<div class="stat"><span>🏆 Arena puanı</span><span>'+player.arena+'</span></div>';
  for(const q of player.quests)h+='<div class="itemRow"><span class="name"><b>'+q.text+'</b><span class="aff">İlerleme: '+q.cur+' / '+q.need+' • Ödül: '+q.reward.yang+' Yang, '+q.reward.xp+' TP</span></span></div>';
  h+='<div class="stat" style="display:block;color:#9a8a68">Görevler bitince otomatik yenilenir ve zorlaşır.</div>';$('questBody').innerHTML=h;
}
function arenaRank(){const l=BOTS.map(b=>({n:b[0],p:b[1]}));l.push({n:player.name,p:player.arena,me:true});l.sort((a,b)=>b.p-a.p);return l;}
function renderNpc(){
  const n=npcCur;if(!n){return;}$('npcTitle').textContent=n.n;let h=resLine();
  if(n.t==='smith'){
    const all=[];for(const s of SLOTKEYS)if(player.equipped[s])all.push({it:player.equipped[s],e:true});player.inventory.forEach(it=>all.push({it,e:false}));
    let sel=findItem(smithSel);if(!sel&&all.length){sel=all[0].it;smithSel=sel.id;}
    if(!sel)h+='<div class="stat"><span>Geliştirecek eşyan yok.</span></div>';
    else{const rate=sel.up>=UP_MAX?0:Math.round(UP_RATE[sel.up]*100),cost=upCost(sel);
      h+=itemRow(sel,'')+'<div class="stat"><span>+'+sel.up+' → +'+Math.min(UP_MAX,sel.up+1)+'</span><span>Başarı %'+rate+' • '+cost+' Yang</span></div>'
        +matReq(sel)+'<div class="stat" style="display:block;font-size:10.5px;color:#c9b88a">+5 ve üstünde başarısızlık seviye düşürür; +7 ve üstünde eşya kırılabilir (Kutsama Kitabı korur).</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap">'+btn('upg','🔨 Geliştir','',sel.up>=UP_MAX||matLack(sel))+btn('upgb','📖 Kutsama ile','',sel.up<5||sel.up>=UP_MAX||player.scrolls.bless<1||matLack(sel))+btn('reroll','🎲 Bonus yenile ('+(200+sel.lv*40)+'💰+💎)','',!sel.aff.length)+'</div>';}
    h+='<div class="stat"><b>Eşyalar</b></div>';
    for(const o of all)h+=itemRow(o.it,btn('smsel','Seç','data-id="'+o.it.id+'"',o.it.id===smithSel),o.e?'[E] ':'');
  }else if(n.t==='shop'){
    for(const s of SHOP){const own=s.id==='horse'&&player.horse;h+='<div class="itemRow"><span>'+s.i+'</span><span class="name"><b>'+s.n+'</b><span class="aff">'+s.d+'</span></span>'+btn('buy',own?'Sahipsin':s.p+'💰','data-id="'+s.id+'"',own||player.yang<s.p)+'</div>';}
    h+='<div class="stat"><span>Sıradan eşyaları topluca sat</span>'+btn('sellcommon','Sat')+'</div>';
  }else if(n.t==='heal'){
    const cost=player.level*4;h+='<div class="itemRow"><span class="name">Yaralarını sarayım, evlat. Can ve manan tamamen dolar.</span>'+btn('heal','Şifa ('+cost+'💰)','',player.yang<cost||(player.hp>=player.maxHp&&player.mp>=player.maxMp))+'</div>';
  }else if(n.t==='arena'){
    h+='<div class="itemRow"><span class="name">Rastgele bir rakiple düello yap. Kazanırsan +25, kaybedersen −10 puan.<span class="aff">Rakipler yapay zekâdır; çok oyunculu değildir.</span></span>'+btn('duel',duel?'Çekil':'⚔ Düello')+'</div><div class="stat"><b>Sıralama</b></div>';
    const l=arenaRank();l.forEach((r,i)=>{h+='<div class="stat" style="'+(r.me?'background:rgba(201,154,58,.3)':'')+'"><span>'+(i+1)+'. '+(r.me?'★ ':'')+r.n+'</span><span>'+r.p+'</span></div>';});
  }else if(n.t==='dungeon'){
    h+=DGS.map(d=>'<div class="itemRow"><span class="name"><b>'+d.n+'</b><span class="aff">Lv '+d.min+'+ • '+d.waves+' dalga + boss • '+Math.round((300+d.waves*20)/60*10)/10+' dk • 1 anahtar<br>Ödül: Yang, Metin Parçası, 📘 kitap, nadir+ eşya</span></span>'+btn('dungeon','🗝 Gir','data-id="'+d.id+'"',player.level<d.min||player.keys<1)+'</div>').join('');
  }
  $('npcBody').innerHTML=h;
}
function openNpc(n){closePanels();npcCur=n;panels.npc.classList.add('open');renderNpc();}
function buy(id){const s=SHOP.find(x=>x.id===id);if(!s||player.yang<s.p)return;
  if(id==='petEgg'){if(!hatchPet())return;}
  else if(id==='horse'){if(player.horse)return;player.horse=true;showMsg('At satın aldın! 🐎 düğmesiyle bin.');}
  else if(id==='hpPot')player.pots.hp++;else if(id==='mpPot')player.pots.mp++;else if(id==='bless')player.scrolls.bless++;else if(id==='dgKey')player.keys++;
  player.yang-=s.p;sfx('buy');updateHUD();saveGame();renderInvIfOpen();}
function sellCommon(){let n=0,y=0;player.inventory=player.inventory.filter(it=>{if(it.rarity==='common'){n++;y+=it.value;return false;}return true;});
  if(n){player.yang+=y;sfx('buy');showMsg(n+' eşya satıldı (+'+y+' Yang)');updateHUD();saveGame();}renderInvIfOpen();}
document.body.addEventListener('click',e=>{
  const t=e.target.closest('[data-act],[data-close]');if(!t)return;audioInit();
  if(t.hasAttribute('data-close')){closePanels();return;}
  const a=t.dataset.act,id=+t.dataset.id,it=id?findItem(id):null;
  switch(a){
    case 'equip':if(it)equipItem(it);break;
    case 'unequip':unequip(t.dataset.s);break;
    case 'sell':if(it&&player.inventory.includes(it))sellItem(it);renderInvIfOpen();break;
    case 'sellcommon':sellCommon();break;
    case 'attr':if(player.pts>0&&player.attr[t.dataset.k]!==undefined){player.pts--;player.attr[t.dataset.k]++;recalcStats();sfx('buy');saveGame();renderInvIfOpen();}break;
    case 'skup':{const i=+t.dataset.i;if(player.sp>0&&player.level>=UNLOCK[i]&&player.skills[i]<10){player.sp--;player.skills[i]++;sfx('level');renderSkillButtons();updateHUD();saveGame();renderInvIfOpen();}break;}
    case 'smsel':smithSel=id;renderInvIfOpen();break;
    case 'upg':{const s=findItem(smithSel);if(s)upgradeItem(s,false);renderInvIfOpen();break;}
    case 'upgb':{const s=findItem(smithSel);if(s)upgradeItem(s,true);renderInvIfOpen();break;}
    case 'reroll':{const s=findItem(smithSel);if(s)rerollAff(s);renderInvIfOpen();break;}
    case 'buy':buy(t.dataset.id);break;
    case 'heal':{const c=player.level*4;if(player.yang>=c){player.yang-=c;player.hp=player.maxHp;player.mp=player.maxMp;sfx('level');spawnBurst(player.group.position.clone(),0x66ff99);updateHUD();saveGame();renderInvIfOpen();}break;}
    case 'duel':closePanels();startPvP();break;
    case 'dungeon':enterDungeon(t.dataset.id);break;
    case 'petsel':setActivePet(id);renderInvIfOpen();break;
    case 'skbook':{const i=+t.dataset.i,L=player.skills[i];if(L<10||L>=20)break;const nd=L<15?1:2,rate=L<15?70:45;if(player.mats.book<nd){showMsg('Gerekli: '+nd+' 📘 Beceri Kitabı');break;}player.mats.book-=nd;
      if(Math.random()*100<rate){player.skills[i]++;showMsg('✨ '+CLASSES[player.cls].skills[i].n+' → '+skLv(player.skills[i]));sfx('level');}else{showMsg('💢 Okuma başarısız! Kitap yandı.');sfx('fail');}renderSkillButtons();saveGame();renderInvIfOpen();break;}
  }
});
$('invBtn').onclick=()=>openPanel('inv');$('charBtn').onclick=()=>openPanel('char');$('questBtn').onclick=()=>openPanel('quest');

/* =========================================================
   11. GİRDİ: joystick, tuşlar, kamera, hedef seçme
   ========================================================= */
const joy={x:0,y:0,active:false,id:null,baseX:0,baseY:0},MAXR=54;let cameraYaw=0,camH=7.4,atkHeld=false;
const joyZone=$('joyZone'),joyBase=$('joyBase'),joyKnob=$('joyKnob'),atkBtn=$('atkBtn');
joyZone.addEventListener('pointerdown',e=>{audioInit();if(joy.active)return;joy.active=true;joy.id=e.pointerId;joy.baseX=e.clientX;joy.baseY=e.clientY;
  joyBase.style.left=e.clientX+'px';joyBase.style.top=e.clientY+'px';joyBase.style.opacity=1;joyKnob.style.transform='translate(-50%,-50%)';try{joyZone.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
joyZone.addEventListener('pointermove',e=>{if(!joy.active||e.pointerId!==joy.id)return;let dx=e.clientX-joy.baseX,dy=e.clientY-joy.baseY;const len=Math.hypot(dx,dy);if(len>MAXR){dx=dx/len*MAXR;dy=dy/len*MAXR;}
  joyKnob.style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))';joy.x=dx/MAXR;joy.y=-dy/MAXR;e.preventDefault();});
function endJoy(e){if(e.pointerId!==joy.id)return;joy.active=false;joy.id=null;joy.x=0;joy.y=0;joyBase.style.opacity=0;joyKnob.style.transform='translate(-50%,-50%)';}
joyZone.addEventListener('pointerup',endJoy);joyZone.addEventListener('pointercancel',endJoy);
atkBtn.addEventListener('pointerdown',e=>{audioInit();atkHeld=true;doAttack();e.preventDefault();});
['pointerup','pointercancel','pointerleave'].forEach(n=>atkBtn.addEventListener(n,()=>{atkHeld=false;}));
for(let i=0;i<4;i++)$('s'+(i+1)).addEventListener('pointerdown',e=>{audioInit();if(player.cls&&player.alive&&player.level>=UNLOCK[i]&&player.skills[i]<1){showMsg('Yetenek puanı harca: Karakter → Yetenekler');openPanel('char');}else useSkill(i);e.preventDefault();});
$('hpPot').addEventListener('pointerdown',e=>{audioInit();usePot('hp');e.preventDefault();});
$('mpPot').addEventListener('pointerdown',e=>{audioInit();usePot('mp');e.preventDefault();});
$('mountBtn').addEventListener('pointerdown',e=>{toggleMount();e.preventDefault();});
const dodgeBtn=$('dodgeBtn');dodgeBtn.addEventListener('pointerdown',e=>{audioInit();triggerDodge();e.preventDefault();});
const talkBtn=$('talkBtn');
function doTalk(){if(dungeon){leaveDungeon(false);return;}const n=nearestNpc();if(n)openNpc(n);}
talkBtn.addEventListener('click',doTalk);
const keys={};
addEventListener('keydown',e=>{keys[e.key.toLowerCase()]=true;if(!player.cls)return;
  if(e.key===' '){audioInit();doAttack();e.preventDefault();}
  if('1234'.includes(e.key)&&e.key)useSkill(+e.key-1);if(e.key==='q')usePot('hp');if(e.key==='w'&&false)0;if(e.key==='e')doTalk();if(e.key==='h')toggleMount();if(e.key==='Shift'||e.key==='v')triggerDodge();
  if(e.key==='i')openPanel('inv');if(e.key==='c')openPanel('char');if(e.key==='j')openPanel('quest');if(e.key==='Escape')closePanels();});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
let drag=null;
canvas.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,t:performance.now()};});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;cameraYaw-=(e.clientX-drag.x)*.008;camH=clamp(camH+(e.clientY-drag.y)*.03,3.2,12);drag.x=e.clientX;drag.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;
  if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<10&&performance.now()-drag.t<400&&player.cls){
    let best=null,bd=60;for(const en of enemies){if(en.dead)continue;tmpV.set(en.mesh.position.x,en.h*.5,en.mesh.position.z).project(camera);if(tmpV.z>1)continue;
      const d=Math.hypot((tmpV.x*.5+.5)*innerWidth-e.clientX,(-tmpV.y*.5+.5)*innerHeight-e.clientY);if(d<bd){bd=d;best=en;}}
    if(best){target=best;autoStart(best);}else if(typeof autoStop==='function'&&auto.tgt)autoStop();}
  drag=null;});
canvas.addEventListener('pointercancel',()=>{drag=null;});

/* =========================================================
   12. ANA DÖNGÜ
   ========================================================= */
const camForward=new THREE.Vector3(),camRight=new THREE.Vector3(),moveDir=new THREE.Vector3(),camTarget=new THREE.Vector3();
let lastTime=performance.now(),running=false,slowT=0,hudT=0,zoneNow='village',fogTarget=null;
const infoEl=$('info');
function setZone(z){zoneNow=z;gfxZone(z);$('zoneName').textContent=ZONES[z].n;fogTarget=new THREE.Color(ZONES[z].fog);
  if(scene.fog){scene.fog.near=z==='dungeon'?12:60;scene.fog.far=z==='dungeon'?60:150;}if(running)chat('📍 '+ZONES[z].n+(ZONES[z].lv?'  (Lv '+ZONES[z].lv[0]+'–'+ZONES[z].lv[1]+')':''),'#9fd0ff');}
function boundPos(pos){
  if(dungeon){const dx=pos.x-DG.x,dz=pos.z-DG.z,r=Math.hypot(dx,dz),lim=DG.r-2;if(r>lim){pos.x=DG.x+dx/r*lim;pos.z=DG.z+dz/r*lim;}}
  else{const r=Math.hypot(pos.x,pos.z),lim=WORLD_R-4;if(r>lim){pos.x*=lim/r;pos.z*=lim/r;}}
  pushOut(pos,.45);
}
const tRing=new THREE.Mesh(new THREE.RingGeometry(.7,.95,28),new THREE.MeshBasicMaterial({color:0xff3030,transparent:true,opacity:.85,side:THREE.DoubleSide||2,depthWrite:false}));tRing.rotation.x=-Math.PI/2;tRing.visible=false;scene.add(tRing);
function update(dt){
  const now=performance.now();if(player.hitstop>0){player.hitstop-=dt;dt*=.25;}
  for(const k in player.buffs)if(now>player.buffs[k].until)delete player.buffs[k];
  let ix=joy.x,iy=joy.y;
  if(keys['w']||keys['arrowup'])iy+=1;if(keys['s']||keys['arrowdown'])iy-=1;if(keys['a']||keys['arrowleft'])ix-=1;if(keys['d']||keys['arrowright'])ix+=1;
  const inLen=Math.hypot(ix,iy);if(inLen>1){ix/=inLen;iy/=inLen;}
  camForward.set(-Math.sin(cameraYaw),0,-Math.cos(cameraYaw));camRight.set(Math.cos(cameraYaw),0,-Math.sin(cameraYaw));
  moveDir.set(0,0,0).addScaledVector(camForward,iy).addScaledVector(camRight,ix);autoSteer(dt,inLen);
  let spd=player.speed;if(player.buffs.speed)spd*=1+player.buffs.speed.value;if(player.mounted&&player.horse)spd*=1.45+player.horseLv*.015;
  const moving=moveDir.lengthSq()>.001&&player.alive,body=player.group.children[0],pos=player.group.position;
  player.moveX=moving?moveDir.x:0;player.moveZ=moving?moveDir.z:0;
  if(player.dodging>0){player.dodging-=dt;pos.x+=player.dodgeDir.x*16*dt;pos.z+=player.dodgeDir.z*16*dt;boundPos(pos);}
  if(moving){moveDir.normalize();pos.addScaledVector(moveDir,spd*dt*(player.dodging>0?.4:1));boundPos(pos);
    const ty=Math.atan2(moveDir.x,moveDir.z);let d=ty-player.group.rotation.y;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
    player.group.rotation.y+=d*Math.min(1,dt*15);player.walkPhase+=dt*(player.mounted?15:11);if(body&&!player.hero)body.position.y=player.bodyY+Math.abs(Math.sin(player.walkPhase))*.09;
  }else if(body)body.position.y+=(player.bodyY-body.position.y)*.2;
  if(player.hero)heroUpdate(dt,moving);
  if(atkHeld)doAttack();
  if(player.atkCd>0){player.atkCd-=dt;if(player.atkCd<=0)atkBtn.classList.remove('cool');}
  if(player.potCd>0)player.potCd-=dt;
  if(player.comboTimer>0){player.comboTimer-=dt;if(player.comboTimer<=0)player.combo=0;}
  if(player.dodgeCd>0)player.dodgeCd-=dt;dodgeBtn.classList.toggle('cool',player.dodgeCd>0);
  if(player.hitTimer>0){player.hitTimer-=dt;if(player.hitTimer<=0){player.hitTimer=-1;applyHit();}}
  if(player.armPivot){
    if(player.atkAnim>0){player.atkAnim-=dt;const t=1-Math.max(0,player.atkAnim)/(player.combo===3?.45:.34),a=Math.sin(t*Math.PI*.9);player.armPivot.rotation.x=.28-a*2.5;player.armPivot.rotation.z=-a*.75;}
    else{player.armPivot.rotation.x+=(.28-player.armPivot.rotation.x)*Math.min(1,dt*10);player.armPivot.rotation.z+=(0-player.armPivot.rotation.z)*Math.min(1,dt*10);}}
  if(player.atkCd>.15)atkBtn.classList.add('cool');
  for(let i=0;i<4;i++)if(player.skillCd[i]>0){player.skillCd[i]-=dt;if(player.skillCd[i]<=0){player.skillCd[i]=0;renderSkillButtons();}}
  if(player.invuln>0){player.invuln-=dt;player.group.visible=Math.floor(player.invuln*12)%2===0||player.invuln<=0;}else player.group.visible=true;
  /* dünya */
  updateCamps(dt);
  for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.update(dt);if(e.dead)enemies.splice(i,1);}
  if(dungeon){if(!dungeon.done){dungeon.t-=dt;if(dungeon.t<=0){showMsg('Süre doldu! Zindandan atıldın.');leaveDungeon(false);}}else{dungeon.exitT-=dt;if(dungeon.exitT<=0)leaveDungeon(true);}}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=22*dt;p.m.position.addScaledVector(p.v,dt);p.m.rotation.x+=dt*8;p.m.rotation.y+=dt*6;
    p.m.material.opacity=Math.max(0,p.life/.65);if(p.life<=0||p.m.position.y<0){scene.remove(p.m);p.m.material.dispose();particles.splice(i,1);}}
  updateProjs(dt);updatePet(dt);
  /* yenilenme */
  if(player.alive){
    if(player.mp<player.maxMp)player.mp=Math.min(player.maxMp,player.mp+dt*(2+player.attr.iq*.12));
    const rg=(player.buffs.regen?player.buffs.regen.value:0)+(!duel&&!dungeon?.4+player.attr.ht*.03:0);if(player.hp<player.maxHp&&rg>0)player.hp=Math.min(player.maxHp,player.hp+dt*rg);}
  /* kamera */
  camTarget.set(pos.x+Math.sin(cameraYaw)*11.5,camH,pos.z+Math.cos(cameraYaw)*11.5);camera.position.lerp(camTarget,1-Math.pow(.0001,dt));
  if(player.shake>0){camera.position.x+=(Math.random()-.5)*player.shake;camera.position.y+=(Math.random()-.5)*player.shake;player.shake=Math.max(0,player.shake-dt*.9);}
  camera.lookAt(pos.x,pos.y+1.35,pos.z);
  if(target&&!target.dead){tRing.visible=true;tRing.position.set(target.mesh.position.x,.07,target.mesh.position.z);tRing.scale.setScalar((target.sc||1)*(target.isMetin?1.9:1));}else tRing.visible=false;
  if(playerLbl)placeLabel(playerLbl,pos.x,2.7+player.bodyY,pos.z,60,0);
  if(msgTimer>0){msgTimer-=dt;if(msgTimer<=0)msgEl.style.opacity=0;}if(flashTimer>0){flashTimer-=dt;if(flashTimer<=0)flashEl.style.opacity=0;}
  /* bölge ve sis */
  const z=dungeon?'dungeon':zoneAt(pos.x,pos.z);if(z!==zoneNow)setZone(z);
  if(fogTarget&&scene.background.lerp){scene.background.lerp(fogTarget,Math.min(1,dt*1.5));scene.fog.color.copy(scene.background);}
  /* NPC etiketleri / konuş düğmesi */
  for(const n of NPCS)placeLabel(n.label,n.x,2.55,n.z,28,dungeon?99:Math.hypot(n.x-pos.x,n.z-pos.z));
  const npc=nearestNpc();if(dungeon){talkBtn.style.display='block';talkBtn.textContent='🚪 Zindandan çık';}else if(npc){talkBtn.style.display='block';talkBtn.textContent='💬 '+npc.n;}else talkBtn.style.display='none';
  /* 4 Hz: hedef, minimap, bilgi, HUD */
  slowT-=dt;if(slowT<=0){slowT=.22;
    if(!target||target.dead||target.mesh.position.distanceTo(pos)>16){target=null;let bd=10;for(const e of enemies){if(e.dead)continue;const d=e.mesh.position.distanceTo(pos);if(d<bd){bd=d;target=e;}}}
    const tb=$('targetBar');if(target){tb.style.display='block';$('tName').textContent=target.name+' Lv'+target.lv;$('tFill').style.width=PCT(target.hp,target.maxHp);$('tTxt').textContent=Math.max(0,Math.ceil(target.hp))+' / '+target.maxHp;}else tb.style.display='none';
    const ents=[];for(const e of enemies){if(e.dead)continue;ents.push({x:e.mesh.position.x,z:e.mesh.position.z,c:e.isPvP?'#ff3'+'3':e.isMetin?'#4af':e.boss?'#c4f':'#e33',r:e.isMetin||e.boss?3.4:2});}
    if(!dungeon)for(const n of NPCS)ents.push({x:n.x,z:n.z,c:'#ffe58a',r:2.6});
    drawMini(pos.x,pos.z,!!dungeon,ents);$('coords').textContent=Math.round(pos.x)+', '+Math.round(pos.z);
    let t='💰 '+player.yang+(player.keys?'  🗝'+player.keys:'')+(player.shards?'  💎'+player.shards:'');
    if(dungeon)t+='<br>⏱ '+(dungeon.done?'Çıkış: '+Math.ceil(dungeon.exitT)+' sn':Math.max(0,Math.ceil(dungeon.t))+' sn')+' • Dalga '+Math.min(dungeon.def.waves,dungeon.wave)+'/'+dungeon.def.waves;
    else{const m=nearestMetin();t+='<br>'+(m?'🔷 En yakın Metin: '+Math.round(m.d)+' m':'🔷 Metin taşı aranıyor…');}
    if(duel&&!duel.dead)t+='<br>⚔ Düello: rakip '+Math.max(0,Math.ceil(duel.hp))+' / '+duel.maxHp;
    infoEl.innerHTML=t;}
  hudT-=dt;if(hudT<=0){hudT=.25;updateHUD();}
}
function loop(now){
  requestAnimationFrame(loop);const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
  if(running)update(dt);
  else{cameraYaw+=dt*.12;camera.position.set(Math.sin(cameraYaw)*26,9,Math.cos(cameraYaw)*26);camera.lookAt(0,3,0);}
  gfxUpdate(dt);renderer.render(scene,camera);
}

/* =========================================================
   13. BAŞLANGIÇ
   ========================================================= */
let selectedClass='savasci',selectedKingdom='aslan',pendingSave=readSave(),newConfirm=false;
const classList=$('classList'),startBtn=$('startBtn'),contBtn=$('contBtn'),nameIn=$('nameIn');
for(const key in CLASSES){const c=CLASSES[key],d=document.createElement('div');d.className='classCard'+(key===selectedClass?' sel':'');d.innerHTML='<b>'+c.icon+' '+c.name+'</b><span>'+c.desc+'</span>';
  d.onclick=()=>{selectedClass=key;[...classList.children].forEach(x=>x.classList.remove('sel'));d.classList.add('sel');newConfirm=false;startBtn.textContent='OYUNA BAŞLA';};classList.appendChild(d);}
const kList=$('kingdomList');KINGDOMS.forEach(k=>{const d=document.createElement('div');d.className='kingdomCard'+(k.id===selectedKingdom?' sel':'');d.style.color=k.c;d.innerHTML=k.n+'<small>'+k.d+'</small>';
  d.onclick=()=>{selectedKingdom=k.id;[...kList.children].forEach(x=>x.classList.remove('sel'));d.classList.add('sel');};kList.appendChild(d);});
if(pendingSave){contBtn.style.display='block';contBtn.textContent='▶ DEVAM: '+pendingSave.name+' — '+CLASSES[pendingSave.cls].name+' Lv '+pendingSave.level;}
startBtn.disabled=false;
scene.add(player.group);
function beginGame(cls,save,name){
  audioInit();player.cls=cls;
  if(save)applySave(save);
  else{Object.assign(player,{name:name||'Kahraman',level:1,xp:0,xpNext:50,yang:100,attr:{st:5,dx:5,ht:5,iq:5},pts:0,sp:2,skills:[1,0,0,0],inventory:[],equipped:{},pots:{hp:5,mp:3},scrolls:{bless:0},keys:0,shards:0,horse:false,arena:0,ach:[],
      stats:{kills:0,metins:0,pvpWin:0,pvpLoss:0,bosses:0,dungeons:0},mats:{tooth:0,sting:0,shard:0,soul:0,book:1},horseLv:1,horseXp:0,pets:[],petId:0,kingdom:selectedKingdom});
    player.equipped.weapon={id:++itemId,slot:'weapon',name:'Çırak Silahı',rarity:'common',lv:1,stat:6,up:0,value:20,aff:[]};
    player.quests=Object.keys(QDEF).map(k=>makeQuest(k,1,0));}
  player.mounted=false;player.alive=true;player.buffs={};player.skillCd=[0,0,0,0];player.hp=player.mp=1e9;recalcStats();player.hp=player.maxHp;player.mp=player.maxMp;
  player.combo=0;player.comboTimer=0;player.dodging=0;player.dodgeCd=0;clearProjs();rebuildPlayer();buildPetMesh();{const kd=KINGDOMS.find(k=>k.id===player.kingdom);if(kd&&playerLbl)playerLbl.style.color=kd.c;}player.group.position.set(0,0,6);player.group.rotation.y=Math.PI;player.invuln=2;cameraYaw=0;camera.position.set(0,6.6,15.5);
  closePanels();renderSkillButtons();updateHUD();$('start').style.display='none';running=true;setZone('village');
  chat('Hoş geldin, '+player.name+'! Köyde NPC\'lere konuş, ormana git ve Metin taşlarını kır.','#ffe08a');saveGame();
}
contBtn.onclick=()=>{if(pendingSave)beginGame(pendingSave.cls,pendingSave);};
startBtn.onclick=()=>{
  if(pendingSave&&!newConfirm){newConfirm=true;startBtn.textContent='Kayıt silinecek! Emin misin? Tekrar dokun';return;}
  const nm=(nameIn.value||'').trim().slice(0,14)||'Kahraman';try{localStorage.removeItem(SAVE_KEY);}catch(e){}pendingSave=null;beginGame(selectedClass,null,nm);};
setZone('village');
requestAnimationFrame(loop);
if(location.search.indexOf('debug')>=0)window.__game={MODELS,ZMOBS,player,enemies,camps,NPCS,get duel(){return duel;},get dungeon(){return dungeon;},get target(){return target;},CLASSES,Enemy,makeItem,giveItem,equipItem,unequip,sellItem,upgradeItem,rerollAff,dropItem,
  useSkill,doAttack,FX,glows,skyDome,wpts,rings,slashes,ponds,triggerDodge,hatchPet,setActivePet,projs,DGS,MATS,elemProc,addHorseXp,KINGDOMS,PETS,get petMesh(){return petMesh;},gainXP,usePot,toggleMount,startPvP,enterDungeon,leaveDungeon,questProgress,saveGame,readSave,recalcStats,openPanel,openNpc,closePanels,damagePlayer,zoneAt,UP_RATE,SHOP,buy,renderPanel,INV_MAX,upCost,beginGame,setZone,get zone(){return zoneNow;},arenaRank};

/* =========================================================
   6. EK ÖZELLİKLER: ayarlar, kayıt kodu, başarımlar, gece-gündüz, boss telgrafı
   ========================================================= */
let OPT={vib:true,low:false,bigui:false};try{const o=JSON.parse(localStorage.getItem('m2_opt')||'null');if(o)OPT=Object.assign(OPT,o);}catch(e){}
const saveOpt=()=>{try{localStorage.setItem('m2_opt',JSON.stringify(OPT));}catch(e){}};
const applyUi=()=>document.body.classList.toggle('cmp',!OPT.bigui);applyUi();
function vib(ms){if(OPT.vib&&navigator.vibrate){try{navigator.vibrate(ms);}catch(e){}}}
function applyQuality(){try{renderer.setPixelRatio(OPT.low?1:Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);}catch(e){}gfxZone(FX.zone);}
{const _gz=gfxZone;gfxZone=function(z){_gz(z);if(OPT.low){wpts.visible=false;cloudGrp.visible=false;}};}
if(OPT.low)applyQuality();
/* ---------- başarımlar ---------- */
const ACH=[
  {id:'k1',n:'İlk Av',d:'1 canavar öldür',t:()=>player.stats.kills>=1,r:50},
  {id:'k100',n:'Avcı',d:'100 canavar öldür',t:()=>player.stats.kills>=100,r:500},
  {id:'k500',n:'Katliam Ustası',d:'500 canavar öldür',t:()=>player.stats.kills>=500,r:3000},
  {id:'m1',n:'Taş Kırıcı',d:'1 Metin taşı kır',t:()=>player.stats.metins>=1,r:200},
  {id:'m25',n:'Metin Avcısı',d:'25 Metin taşı kır',t:()=>player.stats.metins>=25,r:4000},
  {id:'b1',n:'Boss Avcısı',d:'1 boss öldür',t:()=>player.stats.bosses>=1,r:500},
  {id:'b10',n:'Boss Katili',d:'10 boss öldür',t:()=>player.stats.bosses>=10,r:5000},
  {id:'d1',n:'Zindan Fatihi',d:'1 zindan bitir',t:()=>player.stats.dungeons>=1,r:800},
  {id:'p3',n:'Arena Şampiyonu',d:'3 düello kazan',t:()=>player.stats.pvpWin>=3,r:1000},
  {id:'l10',n:'Çırak',d:'Seviye 10',t:()=>player.level>=10,r:300},
  {id:'l20',n:'Usta',d:'Seviye 20',t:()=>player.level>=20,r:1500},
  {id:'l30',n:'Efsane',d:'Seviye 30',t:()=>player.level>=30,r:6000},
  {id:'up9',n:'Demirci Gururu',d:'+9 eşya yap',t:()=>[...Object.values(player.equipped),...player.inventory].some(i=>i&&i.up>=9),r:2500},
  {id:'y10k',n:'Zengin',d:'10.000 Yang biriktir',t:()=>player.yang>=10000,r:0}
];
let achT=0;
function achCheck(){if(!player.cls||!player.stats)return;player.ach=player.ach||[];
  for(const a of ACH){if(player.ach.includes(a.id))continue;let ok=false;try{ok=a.t();}catch(e){}
    if(ok){player.ach.push(a.id);player.yang+=a.r;showMsg('🏆 Başarım: '+a.n+(a.r?' (+'+a.r+' Yang)':''));sfx('level');vib([40,40,40]);updateHUD();saveGame();if($('setBox').classList.contains('open'))renderSet();break;}}}
function renderSet(){$('achList').innerHTML='<b>🏆 Başarımlar ('+((player.ach||[]).length)+'/'+ACH.length+')</b><br>'+ACH.map(a=>{const d=(player.ach||[]).includes(a.id);return '<div style="opacity:'+(d?1:.5)+'">'+(d?'✅ ':'⬜ ')+a.n+' <small>— '+a.d+(a.r?' (+'+a.r+')':'')+'</small></div>';}).join('');
  $('optVib').checked=OPT.vib;$('optBig').checked=OPT.bigui;$('optLow').checked=OPT.low;if($('optRet')){$('optRet').value=String(OPT.retreat);$('optPot').checked=OPT.autoPot;$('optSk').checked=OPT.autoSkill;$('optNext').checked=OPT.autoNext;}}
$('setBtn').onclick=()=>{const b=$('setBox');if(b.classList.contains('open'))b.classList.remove('open');else{closePanels();b.classList.add('open');renderSet();}};
$('setX').onclick=()=>$('setBox').classList.remove('open');
$('optVib').onchange=e=>{OPT.vib=e.target.checked;saveOpt();if(OPT.vib)vib(30);};
$('optBig').onchange=e=>{OPT.bigui=e.target.checked;saveOpt();applyUi();};
$('optLow').onchange=e=>{OPT.low=e.target.checked;saveOpt();applyQuality();};
/* ---------- kayıt kodu ---------- */
$('saveOut').onclick=()=>{saveGame();let raw=null;try{raw=localStorage.getItem(SAVE_KEY);}catch(e){}
  if(!raw){$('saveTxt').value='Kayıt bulunamadı.';return;}
  const code='MA1.'+btoa(unescape(encodeURIComponent(raw)));$('saveTxt').value=code;$('saveTxt').select();
  try{if(navigator.clipboard)navigator.clipboard.writeText(code).then(()=>showMsg('Kayıt kodu kopyalandı'),()=>{});}catch(e){}};
$('saveIn').onclick=()=>{const t=$('saveTxt').value.trim();
  try{if(!t.startsWith('MA1.'))throw 0;const raw=decodeURIComponent(escape(atob(t.slice(4)))),s=JSON.parse(raw);
    if(!s||s.v!==2||!CLASSES[s.cls])throw 0;
    if(!confirm('Mevcut kaydın silinip "'+String(s.name).slice(0,14)+'" Lv '+(s.level|0)+' kaydı yüklensin mi?'))return;
    window.__noSave=true;localStorage.setItem(SAVE_KEY,raw);location.reload();
  }catch(e){showMsg('Geçersiz kayıt kodu');}};
/* ---------- gece-gündüz ---------- */
const DAY_LEN=840;let dayT=DAY_LEN*.2;
function nightAmt(){const p=(dayT%DAY_LEN)/DAY_LEN;/* 0..1: gündüz .0-.55, akşam .55-.68, gece .68-.88, şafak .88-1 */
  const sm=(a,b,x)=>{x=Math.min(1,Math.max(0,(x-a)/(b-a)));return x*x*(3-2*x);};
  return sm(.55,.68,p)*(1-sm(.88,1,p));}
let nightEl=null;
function dayNight(dt){dayT+=dt;nightEl=nightEl||$('night');
  const out=FX.zone==='dungeon'||FX.zone==='village'&&false;const n=out?0:nightAmt();
  nightEl.style.opacity=(n*.62).toFixed(3);window.__night=n;}
/* ---------- boss telgraf saldırısı ---------- */
const teleMat=new THREE.MeshBasicMaterial({color:0xff2222,transparent:true,opacity:.35,depthWrite:false});
function bossTele(e,dt,dist){
  if(e.tele){const T=e.tele;T.t-=dt;T.mesh.material.opacity=.25+.25*Math.abs(Math.sin(T.t*9));
    if(T.t<=0){const pp=player.group.position;scene.remove(T.mesh);e.tele=null;e.teleCd=7+Math.random()*3;e.lunge=.22;
      spawnBurst(new THREE.Vector3(T.x,.4,T.z),0xff5533);player.shake=Math.max(player.shake||0,.5);vib(60);
      if(player.alive&&Math.hypot(pp.x-T.x,pp.z-T.z)<T.r)damagePlayer(Math.round(e.dmg*1.8),e);}
    return;}
  e.teleCd=(e.teleCd===undefined?3:e.teleCd)-dt;
  if(e.teleCd<=0&&dist<16&&player.alive){const pp=player.group.position,r=3.6+Math.min(2,e.sc*.5);
    const m=new THREE.Mesh(new THREE.CircleGeometry(r,28),new THREE.MeshBasicMaterial({color:0xff2222,transparent:true,opacity:.35,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.set(pp.x,.06,pp.z);scene.add(m);e.tele={x:pp.x,z:pp.z,r,t:1.5,mesh:m};showMsg('⚠ Kırmızı alandan kaç!');}
}
{const _eu=Enemy.prototype.update;Enemy.prototype.update=function(dt){_eu.call(this,dt);
    if(this.boss&&!this.dead&&this.state==='chase'&&player.alive){const ep=this.mesh.position,pp=player.group.position;bossTele(this,dt,Math.hypot(pp.x-ep.x,pp.z-ep.z));}};
  const _er=Enemy.prototype.remove;Enemy.prototype.remove=function(){if(this.tele){scene.remove(this.tele.mesh);this.tele=null;}_er.call(this);};
  const _ed=Enemy.prototype.die;Enemy.prototype.die=function(){vib(20);_ed.call(this);};}
/* ---------- döngü kancası ---------- */
{const _gu=gfxUpdate;gfxUpdate=function(dt){_gu(dt);corpseUpdate(dt);if(running){dayNight(dt);achT-=dt;if(achT<=0){achT=2;achCheck();}}};}
if(window.__game)Object.assign(window.__game,{KN_OK,obstacles,KN_ITEMS,ACH,OPT,achCheck,nightAmt,corpses:CORPSES});
{const _up=usePot;usePot=function(k){const hp=player.hp,mp=player.mp;_up(k);if(player.hp>hp||player.mp>mp)heroConsume();};}

/* =========================================================
   7. MÜZİK/SES, DÜNYA BOSS'U, TAM EKRAN
   ========================================================= */
Object.assign(SFX,{warn:[330,.35,'square',-150,.07],ach:[660,.4,'triangle',440,.09],boss:[90,.6,'sawtooth',-40,.1]});
/* ---------- üretilen fon müziği ---------- */
const MUS={
  village:{root:261.6,sc:[0,2,4,7,9,12],bpm:84,wave:'triangle',vol:.05,drone:0},
  forest:{root:196,sc:[0,2,5,7,9],bpm:70,wave:'sine',vol:.05,drone:1},
  desert:{root:174.6,sc:[0,1,4,5,7,8],bpm:78,wave:'triangle',vol:.05,drone:1},
  snow:{root:392,sc:[0,2,3,7,10,12],bpm:58,wave:'sine',vol:.045,drone:1},
  swamp:{root:130.8,sc:[0,1,3,6,7],bpm:62,wave:'sawtooth',vol:.025,drone:1},
  dungeon:{root:98,sc:[0,1,3,5,6],bpm:66,wave:'sawtooth',vol:.028,drone:1}};
let mGain=null,mNext=0,mStep=0,mDrone=null,mZone='';
function musicTick(){
  if(!actx||muted||!running){if(mDrone){try{mDrone.g.gain.value=0;}catch(e){}}return;}
  const z=zoneNow,M=MUS[z]||MUS.village,fight=enemies.some(e=>e.boss&&!e.dead&&e.state==='chase'&&Math.hypot(e.mesh.position.x-player.group.position.x,e.mesh.position.z-player.group.position.z)<26);
  const t=actx.currentTime;
  if(!mGain){mGain=actx.createGain();mGain.gain.value=1;mGain.connect(actx.destination);}
  if(!mDrone){const o=actx.createOscillator(),g=actx.createGain();o.type='sine';o.connect(g);g.connect(mGain);g.gain.value=0;o.start();mDrone={o,g};}
  const dv=M.drone?(fight?.05:.03):0;mDrone.o.frequency.setTargetAtTime(M.root/2*(fight?1.122:1),t,.6);mDrone.g.gain.setTargetAtTime(dv,t,.6);
  const bpm=M.bpm*(fight?1.9:1),beat=60/bpm;if(mNext<t)mNext=t+.05;
  while(mNext<t+.35){
    const dens=fight?.9:(z==='village'?.55:.38);
    if(Math.random()<dens){const deg=M.sc[Math.floor(Math.random()*M.sc.length)],oct=Math.random()<.2?2:1,f=M.root*Math.pow(2,deg/12)*oct*(fight?.5:1);
      const o=actx.createOscillator(),g=actx.createGain();o.type=fight?'sawtooth':M.wave;o.frequency.value=f;
      const v=(fight?M.vol*1.3:M.vol),dur=beat*(fight?.8:1.6);g.gain.setValueAtTime(.0001,mNext);g.gain.linearRampToValueAtTime(v,mNext+.03);g.gain.exponentialRampToValueAtTime(.0001,mNext+dur);
      o.connect(g);g.connect(mGain);o.start(mNext);o.stop(mNext+dur+.05);}
    mNext+=beat*(fight?.5:1);mStep++;}
}
setInterval(()=>{try{musicTick();}catch(e){}},200);
/* ---------- dünya boss'u ---------- */
const WB={t:240,cur:null,life:0,zone:'desert'};
const WB_ZONES=[['forest','Orman',0,1],['desert','Çöl',1,0],['snow','Kar',0,-1],['swamp','Bataklık',-1,0]];
function wbSpawn(){
  const zi=WB_ZONES[Math.floor(Math.random()*WB_ZONES.length)],d=Math.min(95,WORLD_R-12);
  const x=zi[2]*d+(Math.random()-.5)*14*(zi[2]?0:1),z=zi[3]*d+(Math.random()-.5)*14*(zi[3]?0:1);
  const lv=Math.max(15,player.level+2),e=new Enemy(new THREE.Vector3(x,0,z),'boss_world',lv);e.xp*=3;e.yang*=3;e.wbZone=zi[1];
  enemies.push(e);WB.cur=e;WB.life=480;WB.zone=zi[1];
  showMsg('🐉 Dünya Ejderhası belirdi: '+zi[1]+' bölgesi!');sfx('boss');vib([80,60,80]);
}
function wbUpdate(dt){
  if(!running||!player.alive)return;
  if(WB.cur){
    if(WB.cur.dead){WB.cur=null;WB.t=600+Math.random()*300;return;}
    WB.life-=dt;if(WB.life<=0){WB.cur.remove();const i=enemies.indexOf(WB.cur);if(i>=0)enemies.splice(i,1);WB.cur=null;WB.t=420;showMsg('Dünya Ejderhası uzaklaştı...');}
    return;}
  if(dungeon||duel)return;WB.t-=dt;if(WB.t<=0)wbSpawn();
}
{const _ed2=Enemy.prototype.die;Enemy.prototype.die=function(){const w=this.sp&&this.sp.world,pos=this.mesh.position.clone(),lv=this.lv;_ed2.call(this);
  if(w){for(let i=0;i<3;i++)dropItem(pos,i===0?3:2,lv);player.shards+=5;player.keys+=1;showMsg('🐉 Dünya Ejderhası yenildi! Büyük ödül düştü');sfx('level');vib([60,40,60,40,120]);}};}
{const _gu2=gfxUpdate;gfxUpdate=function(dt){_gu2(dt);wbUpdate(dt);};}
/* ---------- tam ekran ---------- */
{const box=$('setBox'),b=document.createElement('button');b.id='fsBtn';b.textContent='⛶ Tam ekran';
  b.onclick=()=>{try{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();}catch(e){}};
  const a=$('saveOut');box.insertBefore(b,a);}
if(window.__game)Object.assign(window.__game,{WB,wbSpawn,MUS,musicTick});

// ===== Otomatik saldırı: düşmana dokun -> kovala + vur; canın azalırsa geri çekil =====
Object.assign(OPT,Object.assign({retreat:30,autoPot:true,autoSkill:true,autoNext:true},JSON.parse(localStorage.getItem('m2_opt')||'{}')));
const auto={tgt:null,flee:false};
function autoStart(e){auto.tgt=e;auto.flee=false;target=e;autoChipUpdate();}
function autoStop(){auto.tgt=null;auto.flee=false;autoChipUpdate();}
function autoChipUpdate(){const c=$('autoChip');if(!c)return;c.style.display=(auto.tgt||auto.flee)?'block':'none';c.textContent=auto.flee?'🏃 Geri çekiliyor':'⚔ Otomatik';c.style.background=auto.flee?'rgba(150,40,30,.85)':'rgba(40,90,40,.85)';}
{const c=document.createElement('div');c.id='autoChip';c.style.cssText='display:none;position:fixed;left:50%;top:92px;transform:translateX(-50%);z-index:30;color:#fff;font-size:12px;padding:3px 10px;border-radius:12px;border:1px solid #e8c36a;pointer-events:auto';c.onclick=autoStop;document.body.appendChild(c);}
function autoNearest(r,flt){let b=null,bd=r;const pp=player.group.position;for(const e of enemies){if(e.dead)continue;if(flt){if(OPT.autoOnlyMetin&&!e.isMetin)continue;if(OPT.autoAvoidBoss&&(e.boss||e.eboss||e.storyCh))continue;}const d=Math.hypot(e.mesh.position.x-pp.x,e.mesh.position.z-pp.z);if(d<bd){bd=d;b=e;}}return b;}
let autoTick=0;
function autoSteer(dt,inLen){
  if(!auto.tgt&&!auto.flee)return;
  if(!player.alive||!player.cls||inLen>.2){autoStop();return;}
  const pp=player.group.position,thr=(OPT.retreat||0)/100,ratio=player.hp/player.maxHp;
  autoTick-=dt;
  if(autoTick<=0){autoTick=.25;
    if(OPT.autoPot&&player.potCd<=0){if(ratio<(OPT.potPct||30)/100&&player.pots.hp>0)usePot('hp');else if(player.mp/player.maxMp<.2&&player.pots.mp>0)usePot('mp');}}
  if(!auto.flee&&thr>0&&ratio<thr){auto.flee=true;autoChipUpdate();showMsg('Can azaldı, geri çekiliyorum!');}
  if(auto.flee){
    const near=autoNearest(14);
    if(!near||ratio>Math.min(.95,thr+.3)){auto.flee=false;if(!near||ratio>.6){autoStop();return;}autoChipUpdate();}
    else{const dx=pp.x-near.mesh.position.x,dz=pp.z-near.mesh.position.z,l=Math.hypot(dx,dz)||1;moveDir.set(dx/l,0,dz/l);return;}
  }
  let t=auto.tgt;
  if(!t||t.dead){auto.tgt=null;t=null;if(OPT.autoNext)t=autoNearest(8,true);if(!t){autoStop();return;}auto.tgt=t;}
  target=t;
  const dx=t.mesh.position.x-pp.x,dz=t.mesh.position.z-pp.z,d=Math.hypot(dx,dz);
  if(d>40){autoStop();return;}
  const rg=CLASSES[player.cls].ranged,stop=rg?9:(2.0+(t.sc>1?.5*t.sc:0)+(t.isMetin?.9:0));
  if(d>stop){moveDir.set(dx/d,0,dz/d);}
  else if(rg&&d<4){moveDir.set(-dx/d,0,-dz/d);}
  if(d<=(rg?12:stop+.8)){faceTo(t);if(player.atkCd<=0)doAttack();
    if(OPT.autoSkill&&!(player.mounted&&player.horseLv<10)){for(let i=0;i<4;i++){if(!skillOpen(i)||player.skillCd[i]>0)continue;const sk=CLASSES[player.cls].skills[i];if(!sk)continue;if(player.mp<skillMp(sk,player.skills[i])+Math.round(player.maxMp*.1))continue;try{useSkill(i);}catch(e){}break;}}}
}
$('optRet').onchange=e=>{OPT.retreat=+e.target.value;saveOpt();};
$('optPot').onchange=e=>{OPT.autoPot=e.target.checked;saveOpt();};
$('optSk').onchange=e=>{OPT.autoSkill=e.target.checked;saveOpt();};
$('optNext').onchange=e=>{OPT.autoNext=e.target.checked;saveOpt();};
window.__auto=auto;
// gerçek at animasyonu
function horseUpdate(dt,moving){
  const hm=horseMesh&&horseMesh.userData.horse;if(!hm||!horseMesh.visible)return;
  const want=moving?(player.speed&&player.mounted?hm.A.run:hm.A.walk):hm.A.idle;
  if(want!==hm.cur){want.reset().play();hm.cur.crossFadeTo(want,.2,false);hm.cur=want;}
  hm.mixer.update(dt*(moving&&want===hm.A.run?1:1));
}
{const _hu=heroUpdate;heroUpdate=function(dt,moving){_hu(dt,moving);horseUpdate(dt,moving);};}

// ===== Kusursuz Kaçınma: kaçış sırasında gelen vuruş -> 4 sn %50 fazla hasar =====
let perfectUntil=0;
{const _dp=damagePlayer;damagePlayer=function(n,src){
  if(player.alive&&player.dodging>0&&player.invuln>0){const now=performance.now();if(now>perfectUntil-3000){perfectUntil=now+4000;showDamage(player.group.position.clone().setY(2.4),'KUSURSUZ KAÇIŞ!','#6ff',true);spawnBurst(player.group.position.clone(),0x66ffff);sfx('level');}return;}
  return _dp(n,src);};
 const _hd=hitDamage;hitDamage=function(mul,crit){let r=_hd(mul,crit);if(performance.now()<perfectUntil)r=Math.round(r*1.5);return r;};}

// ===== Gezgin Tüccar: ara sıra yakında belirir, kısa süre kalır =====
let wand=null,wandNext=Date.now()+150000;
function wanderSpawn(){
  if(wand||!player.cls||!player.alive||dungeon||duel)return;
  const pp=player.group.position,a=Math.random()*Math.PI*2,x=pp.x+Math.cos(a)*14,z=pp.z+Math.sin(a)*14;
  const n={id:'wander',n:'Gezgin Tüccar',x,z,tint:0xc9902a,cls:'okcu',t:'wander',until:Date.now()+360000,stock:[]};
  n.mesh=buildHuman(n.cls,false,{},n.tint);n.mesh.position.set(x,0,z);n.mesh.rotation.y=Math.atan2(pp.x-x,pp.z-z);scene.add(n.mesh);
  n.label=makeLabel('💰 '+n.n,'npc');n.ob={x,z,r:.6};obstacles.push(n.ob);
  for(let i=0;i<2;i++){const it=makeItem(player.level+2,3);n.stock.push({k:'item',it,p:Math.max(200,it.value*4)});}
  n.stock.push({k:'bless',p:250},{k:'key',p:120},{k:'egg',p:900});
  NPCS.push(n);wand=n;showMsg('💰 Gezgin Tüccar yakınında belirdi! (6 dk)');chat('Gezgin Tüccar yakınında bir yerde, haritada sarı nokta.','#fd6');sfx('level');
}
function wanderEnd(){if(!wand)return;const n=wand;wand=null;const i=NPCS.indexOf(n);if(i>=0)NPCS.splice(i,1);scene.remove(n.mesh);if(n.label&&n.label.remove)n.label.remove();const j=obstacles.indexOf(n.ob);if(j>=0)obstacles.splice(j,1);
  if(npcCur===n)closePanels();wandNext=Date.now()+(600000+Math.random()*420000);}
setInterval(()=>{if(wand){if(Date.now()>wand.until)wanderEnd();}else if(Date.now()>wandNext)wanderSpawn();},1500);
{const _rn=renderNpc;renderNpc=function(){_rn();if(npcCur&&npcCur.t==='wander'){
  let h='<div class="stat"><span>Nadir mallarım var, çabuk ol yolcu!</span></div>';
  npcCur.stock.forEach((s,i)=>{const d=s.sold||player.yang<s.p;
    if(s.k==='item')h+=itemRow(s.it,btn('wbuy',s.sold?'Satıldı':s.p+'💰','data-w="'+i+'"',d));
    else{const nm=s.k==='bless'?'📖 Kutsama Kitabı':s.k==='key'?'🗝 Zindan Anahtarı':'🥚 Pet Yumurtası';h+='<div class="itemRow"><span class="name"><b>'+nm+'</b></span>'+btn('wbuy',s.sold?'Satıldı':s.p+'💰','data-w="'+i+'"',d)+'</div>';}});
  $('npcBody').innerHTML=h;}};}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act="wbuy"]');if(!t||!wand)return;
  const s=wand.stock[+t.dataset.w];if(!s||s.sold||player.yang<s.p)return;
  if(s.k==='egg'){if(!hatchPet())return;}else if(s.k==='item'){if(!giveItem(s.it))return;}else if(s.k==='bless')player.scrolls.bless++;else player.keys++;
  player.yang-=s.p;s.sold=true;sfx('buy');updateHUD();saveGame();renderNpc();});
window.__wander={hit:n=>damagePlayer(n),spawn:wanderSpawn,end:wanderEnd,get npc(){return wand;},perfect:()=>perfectUntil};

// ===== Krallık Baskını: köye saldırı =====
let raid=null,raidNext=Date.now()+420000;
function raidStart(){
  if(raid||!player.cls||!player.alive||dungeon||duel)return false;
  const pp=player.group.position;if(Math.hypot(pp.x,pp.z)>60)return false;
  const my=player.kingdom,enemyK=KINGDOMS.find(k=>k.id!==my&&Math.random()<.6)||KINGDOMS.find(k=>k.id!==my);
  const n=Math.min(14,5+Math.floor(player.level/4)),a0=Math.random()*Math.PI*2,list=[];
  for(let i=0;i<n;i++){const a=a0+(Math.random()-.5)*1.2,r=44+Math.random()*4,pos={x:Math.cos(a)*r,y:0,z:Math.sin(a)*r};
    const e=new Enemy(pos,i%4===0?'orcw':'orc',Math.max(1,player.level),{dg:true});e.provoked=true;e.state='chase';e.name=enemyK.n+' Akıncısı';enemies.push(e);list.push(e);}
  raid={list,until:Date.now()+100000,k:enemyK};
  showMsg('⚔ '+enemyK.n+' köyünüze saldırıyor!');chat('BASKIN! '+enemyK.n+' akıncıları köyü basıyor — savun!','#f66');sfx('die');vib([80,60,80]);
  return true;
}
function raidEnd(win){
  if(!raid)return;const r=raid;raid=null;raidNext=Date.now()+(780000+Math.random()*600000);
  if(win){const pp=player.group.position.clone(),y=300+player.level*60;player.yang+=y;gainXP(Math.round(player.level*40+100));dropItem(pp,2,player.level+2);
    showMsg('🏆 Baskın püskürtüldü! +'+y+' Yang');chat('Köyü savundun! Ödüller alındı.','#8f8');sfx('quest');player.stats.raids=(player.stats.raids||0)+1;updateHUD();saveGame();}
  else{r.list.forEach(e=>{if(!e.dead)e.remove();});showMsg('Akıncılar geri çekildi.');}
}
setInterval(()=>{if(raid){if(!raid.list.some(e=>!e.dead))raidEnd(true);else if(Date.now()>raid.until||dungeon||!player.alive&&false)raidEnd(false);}
  else if(Date.now()>raidNext&&!raidStart())raidNext=Date.now()+60000;},1500);
window.__raid={start:raidStart,end:raidEnd,get cur(){return raid;}};

// ===== Yoldaş: Şaman — +%15 hasar, 8 sn'de bir %4 can yeniler =====
let comp={own:false,mesh:null,t:0};
try{comp.own=localStorage.getItem('m2_comp')==='1';}catch(e){}
SHOP.push({id:'comp',n:'Şaman Yoldaş',d:'Seni takip eder: +%15 hasar, can yeniler (bir kez)',p:2500,i:'🧙'});
function compMesh(){if(comp.mesh||!player.cls)return;comp.mesh=buildHuman('saman',false,{},0x3a8a6a);comp.mesh.position.copy(player.group.position);scene.add(comp.mesh);}
{const _b=buy;buy=function(id){if(id==='comp'){if(comp.own){showMsg('Yoldaşın zaten var.');return;}const s=SHOP.find(x=>x.id==='comp');if(player.yang<s.p)return;player.yang-=s.p;comp.own=true;try{localStorage.setItem('m2_comp','1');}catch(e){}compMesh();sfx('buy');showMsg('🧙 Şaman yoldaşın artık seninle!');updateHUD();saveGame();renderNpc();return;}return _b(id);};}
{const _hd2=hitDamage;hitDamage=function(m,c){const r=_hd2(m,c);return comp.own?Math.round(r*1.15):r;};}
setInterval(()=>{if(comp.own&&player.alive&&player.cls&&player.hp<player.maxHp&&!dungeon&&!duel||comp.own&&player.alive&&player.cls&&player.hp<player.maxHp){player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.04);updateHUD();}},8000);
{const _ru=update;update=function(dt){_ru(dt);if(!comp.own||!player.cls)return;compMesh();const m=comp.mesh,pp=player.group.position,a=player.group.rotation.y+2.5,tx=pp.x+Math.sin(a)*2,tz=pp.z+Math.cos(a)*2,k=Math.min(1,dt*4);
  const d=Math.hypot(tx-m.position.x,tz-m.position.z);if(d>20)m.position.set(tx,0,tz);else{m.position.x+=(tx-m.position.x)*k;m.position.z+=(tz-m.position.z)*k;}
  m.rotation.y=Math.atan2(pp.x-m.position.x,pp.z-m.position.z);m.visible=!dungeon;};}
window.__comp=comp;

// ===== g9: Biyolog, Ruh Taşı, Alt Sınıf, Kombo, Şifacı Ork, KS Rakip, Şeytan Kulesi =====
const META=()=>player.stats.meta||(player.stats.meta={bio:{st:0,have:0},sub:null,stones:{crit:0,atk:0,def:0,hp:0}});
const STONES={crit:{n:'Öldürücü Darbe Taşı',i:'🔴',d:'+3 kritik',a:{crit:3}},atk:{n:'Savaş Taşı',i:'🟠',d:'+%4 saldırı',a:{atk:4}},def:{n:'Koruyan Taş',i:'🔵',d:'+%4 savunma',a:{def:4}},hp:{n:'Can Taşı',i:'🟢',d:'+40 can',a:{hp:40}}};
const BIO=[
  {n:'Ork Dişi',sp:['orc','orcw','archer'],need:5,r:'+%3 hareket hızı',a:{spd:3}},
  {n:'Kurt Postu',sp:['wolf','iwolf'],need:5,r:'+%4 savunma',a:{def:4}},
  {n:'Akrep Zehri',sp:['scor','sandskel'],need:6,r:'+%4 saldırı',a:{atk:4}},
  {n:'Balçık Özü',sp:['slime','islime','pslime'],need:6,r:'+50 can',a:{hp:50}},
  {n:'Eski Kemik',sp:['skel','iskel','sandskel'],need:7,r:'+3 kritik',a:{crit:3}},
  {n:'Yarasa Kanadı',sp:['bat','firebat'],need:7,r:'+3 kaçınma',a:{dodge:3}}];
const SUBS={atk:{n:'Saldırı Yolu',d:'+%12 saldırı, +5 kritik',a:{atk:12,crit:5}},def:{n:'Koruma Yolu',d:'+%15 savunma, +%12 can, +4 kaçınma',a:{def:15,hpP:12,dodge:4}}};
const SUBN={savasci:{atk:'Bedensel Yol',def:'Zihinsel Yol'},ninja:{atk:'Suikast Yolu',def:'Gölge Yolu'},okcu:{atk:'Nişancı Yolu',def:'Avcı Yolu'},sura:{atk:'Kara Büyü Yolu',def:'Kutsal Yol'},saman:{atk:'Ejderha Yolu',def:'Şifa Yolu'},lykaner:{atk:'Kurt Yolu',def:'Dağ Yolu'}};
const subN=k=>(SUBN[player.cls]&&SUBN[player.cls][k])||SUBS[k].n;
function metaBonus(){
  const t={},add=a=>{for(const k in a)t[k]=(t[k]||0)+a[k];};const m=META();
  for(let i=0;i<m.bio.st&&i<BIO.length;i++)add(BIO[i].a);
  if(m.sub&&SUBS[m.sub])add(SUBS[m.sub].a);
  for(const s of SLOTKEYS){const it=player.equipped[s];if(it&&it.socks)it.socks.forEach(k=>{if(k&&STONES[k])add(STONES[k].a);});}
  return t;
}
{const _rc=recalcStats;recalcStats=function(){_rc();if(!player.cls)return;const b=metaBonus();
  if(b.spd)player.speed*=1+b.spd/100;if(b.def)player.defPct+=b.def;if(b.atk)player.baseDmg*=1+b.atk/100;
  if(b.hp)player.maxHp+=b.hp;if(b.hpP)player.maxHp=Math.round(player.maxHp*(1+b.hpP/100));
  if(b.crit)player.crit=clamp(player.crit+b.crit,0,65);if(b.dodge)player.dodge=clamp(player.dodge+b.dodge,0,30);
  player.hp=Math.min(player.hp,player.maxHp);updateHUD();};}

// ---- yardımcı: yeni NPC ekle
function addNpc(o){o.mesh=buildHuman(o.cls,false,{},o.tint);o.mesh.position.set(o.x,0,o.z);o.mesh.rotation.y=Math.atan2(-o.x,-o.z);scene.add(o.mesh);o.label=makeLabel(o.n,'npc');obstacles.push({x:o.x,z:o.z,r:.6});NPCS.push(o);return o;}
addNpc({id:'bio',n:'Biyolog Kemal',x:0,z:14,tint:0x5a8a3a,cls:'okcu',t:'bio'});

// ---- biyolog + ruh taşı + zaman (kuyruk) için renderNpc eki
{const _rn2=renderNpc;renderNpc=function(){_rn2();if(!npcCur)return;
  if(npcCur.t==='bio'){const m=META(),b=m.bio;let h='';
    if(b.st>=BIO.length)h='<div class="stat"><span>Tüm görevleri bitirdin, usta avcı! Kalıcı bonusların aktif.</span></div>';
    else{const q=BIO[b.st];h='<div class="stat"><span>Görev '+(b.st+1)+'/'+BIO.length+': <b>'+q.n+'</b> topla</span><span>'+b.have+'/'+q.need+'</span></div><div class="stat" style="display:block;font-size:11px;color:#c9b88a">Bu eşya ilgili canavarlardan düşük ihtimalle düşer. Ödül (kalıcı): '+q.r+'</div>'+btn('biot','📦 Teslim et','',b.have<q.need);}
    h+='<div class="stat"><b>Kazanılan kalıcı bonuslar</b></div>';for(let i=0;i<Math.min(b.st,BIO.length);i++)h+='<div class="stat"><span>✔ '+BIO[i].n+'</span><span>'+BIO[i].r+'</span></div>';
    $('npcBody').innerHTML=h;}
  else if(npcCur.t==='smith'){const m=META(),sel=findItem(smithSel);let h='<div class="stat"><b>💎 Ruh Taşı</b></div>';
    h+='<div class="stat" style="display:block;font-size:11px">';for(const k in STONES)h+=STONES[k].i+' '+STONES[k].n+' ×'+m.stones[k]+' <span style="color:#9a8a68">('+STONES[k].d+')</span><br>';h+='</div>';
    h+='<div class="stat"><span>Rastgele taş satın al</span>'+btn('stbuy','400💰','',player.yang<400)+'</div>';
    if(sel){const sn=sel.sn||0,so=sel.socks||[];
      h+='<div class="stat"><span>Seçili: '+sel.name+' • Soket '+so.filter(x=>x).length+'/'+sn+'</span>'+btn('sopen','Soket aç ('+(300+sel.lv*30)+'💰)','',sn>=2||player.yang<300+sel.lv*30)+'</div>';
      if(so.filter(x=>x).length<sn){h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';for(const k in STONES)h+=btn('stput',STONES[k].i+' tak','data-k="'+k+'"',m.stones[k]<1);h+='</div><div class="stat" style="display:block;font-size:10.5px;color:#c9b88a">Takarken %15 ihtimalle taş kırılır. Soket açma %65 başarılı.</div>';}
      else if(sn>0)h+='<div class="stat"><span>Soketler dolu: '+so.map(k=>STONES[k].i).join(' ')+'</span></div>';}
    else h+='<div class="stat"><span>Önce yukarıdan bir eşya seç.</span></div>';
    $('npcBody').innerHTML+=h;}
};}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,m=META();
  if(a==='biot'){const b=m.bio;if(b.st<BIO.length&&b.have>=BIO[b.st].need){b.have-=BIO[b.st].need;showMsg('🧬 Kalıcı bonus: '+BIO[b.st].r);b.st++;sfx('quest');recalcStats();saveGame();renderNpc();}}
  else if(a==='stbuy'){if(player.yang>=400){player.yang-=400;const ks=Object.keys(STONES),k=ks[Math.floor(Math.random()*ks.length)];m.stones[k]++;showMsg(STONES[k].i+' '+STONES[k].n);sfx('buy');updateHUD();saveGame();renderNpc();}}
  else if(a==='sopen'){const s=findItem(smithSel);if(!s)return;const c=300+s.lv*30,sn=s.sn||0;if(sn>=2||player.yang<c)return;player.yang-=c;
    if(Math.random()<.65){s.sn=sn+1;s.socks=s.socks||[];s.socks.push(null);showMsg('Soket açıldı!');sfx('level');}else{showMsg('Soket açılamadı.');sfx('miss');}updateHUD();saveGame();renderNpc();}
  else if(a==='stput'){const s=findItem(smithSel),k=t.dataset.k;if(!s||!STONES[k]||m.stones[k]<1)return;s.socks=s.socks||[];if(s.socks.filter(x=>x).length>=(s.sn||0))return;m.stones[k]--;
    if(Math.random()<.15){showMsg('Taş kırıldı!');sfx('miss');}else{const i=s.socks.indexOf(null);if(i>=0)s.socks[i]=k;else s.socks.push(k);showMsg(STONES[k].i+' takıldı!');sfx('level');recalcStats();}saveGame();renderNpc();}
});

// ---- ölüm kancası: biyolog eşyası, ruh taşı, KS rakip ödülü
{const _die=Enemy.prototype.die;Enemy.prototype.die=function(){const spk=this.spk,iM=this.isMetin,iP=this.isPvP,rv=this.rival,pos=this.mesh.position.clone(),dg=this.dg;_die.call(this);
  if(iM||iP||!player.cls)return;const m=META();
  if(rv){const y=200+player.level*40;player.yang+=y;dropItem(pos,2,player.level+1);chat('Rakibi alt ettin! +'+y+' Yang','#8f8');return;}
  if(spk&&m.bio.st<BIO.length&&BIO[m.bio.st].sp.includes(spk)&&Math.random()<.16){m.bio.have++;showMsg('🧬 '+BIO[m.bio.st].n+' ('+m.bio.have+'/'+BIO[m.bio.st].need+')');sfx('pot');}
  if(!dg&&Math.random()<.012){const ks=Object.keys(STONES),k=ks[Math.floor(Math.random()*ks.length)];m.stones[k]++;showMsg('Düştü: '+STONES[k].i+' '+STONES[k].n);}
};}

// ---- alt sınıf seçimi (Lv5)
let subBox=null;
function subAsk(){if(subBox)return;subBox=document.createElement('div');subBox.style.cssText='position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center';
  subBox.innerHTML='<div class="panel open" style="position:relative;width:min(92vw,340px);padding:14px;text-align:center"><h3>⚜ YOL SEÇ</h3><div style="font-size:12px;margin-bottom:8px">Seviye 5\'e ulaştın! Bir yol seç (sonradan değişmez):</div>'
   +Object.keys(SUBS).map(k=>'<button data-sub="'+k+'" style="display:block;width:100%;margin:6px 0;padding:10px">'+subN(k)+'<br><small>'+SUBS[k].d+'</small></button>').join('')+'</div>';
  subBox.onclick=e=>{const b=e.target.closest('[data-sub]');if(!b)return;META().sub=b.dataset.sub;subBox.remove();subBox=null;recalcStats();saveGame();showMsg('⚜ '+subN(META().sub)+' seçildi!');sfx('level');};
  document.body.appendChild(subBox);}
setInterval(()=>{if(player.cls&&player.alive&&player.level>=5&&!META().sub&&!dungeon&&!duel&&!subBox)subAsk();},2000);

// ---- Kombo: yetenekleri sırayla (1→2→3→4) 3 sn içinde kullan
let comboLast=-1,comboT=0,comboN=0;
{const _us2=useSkill;useSkill=function(i){const cd0=player.skillCd[i];_us2(i);if(!(cd0<=0&&player.skillCd[i]>0))return;const now=performance.now();
  if(comboLast>=0&&i===comboLast+1&&now-comboT<3000)comboN++;else comboN=i===0?1:0;comboLast=i;comboT=now;
  if(comboN>=2){const e=nearestEnemy(10);if(e&&!e.dead){const d=Math.round(player.baseDmg*(.6+.4*comboN));showDamage(e.mesh.position.clone().setY(e.h+1),'KOMBO x'+comboN+'!','#fd4',true);e.stunUntil=performance.now()+1300;player.shake=Math.max(player.shake,.35);spawnBurst(e.mesh.position.clone(),0xffdd44);e.takeDamage(d,true);}}};}

// ---- Şifacı Ork: dostlarını iyileştirir
SP.orcshaman={n:'Ork Şamanı',b:'orc',pal:[0x3a6a4a,0x1a3a2a,0x0a2014,0x66ffaa],sc:1,hp:.9,dm:.6,sp:3,cd:2.4,rng:10,proj:0x66ffaa,heal:true};
ZMOBS.forest.push('orcshaman');ZMOBS.swamp.push('orcshaman');
{const _eu2=Enemy.prototype.update;Enemy.prototype.update=function(dt){_eu2.call(this,dt);
  if(!this.sp||!this.sp.heal||this.dead||this.state==='idle')return;this.healT=(this.healT||3)-dt;
  if(this.healT>0)return;this.healT=5;let n=0;
  for(const o of enemies){if(o===this||o.dead||o.isMetin||o.hp>=o.maxHp)continue;if(Math.hypot(o.mesh.position.x-this.mesh.position.x,o.mesh.position.z-this.mesh.position.z)>9)continue;o.hp=Math.min(o.maxHp,o.hp+o.maxHp*.14);spawnBurst(o.mesh.position.clone(),0x66ffaa);n++;}
  if(n)showDamage(this.mesh.position.clone().setY(this.h+.6),'✚ İYİLEŞTİRME','#6fa',false);};}

// ---- KS atan rakip avcı: Metin taşına vururken ara sıra gelir
const RIVN=['Tuğrul','Barış','Kaan','Selçuk','Alp','Deniz','Yiğit','Aras'];
function rivalSpawn(metin){if(!player.cls||dungeon||duel)return;const p=metin.mesh.position,a=Math.random()*6.28;rivalAt(p.x+Math.cos(a)*16,p.z+Math.sin(a)*16,null,null,'Metin taşını çalmaya geldi!');}
function rivalAt(x,z,cls,nm,why){
  if(!player.cls||dungeon||duel)return;
  const cl=['savasci','ninja','okcu','sura','saman','lykaner'].filter(c=>CLASSES[c]);cls=cls||cl[Math.floor(Math.random()*cl.length)];nm=nm||RIVN[Math.floor(Math.random()*RIVN.length)];
  const e=new Enemy(new THREE.Vector3(x,0,z),'orcw',Math.max(1,player.level),{});
  scene.remove(e.mesh);e.mesh=buildHuman(cls,false,{},0x2a5a8a);e.mesh.position.set(x,0,z);scene.add(e.mesh);e.h=2.3;e.sc=1;e.rival=true;e.name='Rakip Avcı '+nm;
  e.maxHp=Math.round(e.maxHp*1.5);e.hp=e.maxHp;e.provoked=true;e.state='chase';if(e.label){e.label.textContent='⚔ '+e.name+' Lv'+e.lv;}
  enemies.push(e);showMsg('⚠ '+nm+' '+(why||'saldırıyor!'));chat('Rakip avcı '+nm+' sana saldırıyor!','#fa6');sfx('die');
}
{const _td=Enemy.prototype.takeDamage;Enemy.prototype.takeDamage=function(a,c,o){if(this.isMetin&&!this.ksDone&&this.hp>this.maxHp*.5&&Math.random()<.025&&!enemies.some(x=>x.rival&&!x.dead)){this.ksDone=true;rivalSpawn(this);}return _td.call(this,a,c,o);};}
window.__g9={META,BIO,STONES,SUBS,rivalSpawn,metaBonus,subAsk};

// ---- Şeytan Kulesi (katlı zindan)
DGS.push({id:'tower',n:'Şeytan Kulesi',min:12,waves:4,per:6,mobs:['orcw','archer','mage','elite','orcshaman'],boss:'boss_sohan',mul:2,fog:0x1a0e22,tower:true});
{const _sw=spawnWave;spawnWave=function(n){
  if(!(dungeon&&dungeon.def.tower&&n<=dungeon.def.waves))return _sw(n);
  const def=dungeon.def;dungeon.wave=n;dungeon.pend=false;const L=Math.max(def.min-2,player.level)+n-1;
  const mk=(sp,x,z,o)=>{const e=new Enemy(new THREE.Vector3(x,0,z),sp,L,Object.assign({dg:true},o||{}));e.state='chase';enemies.push(e);return e;};
  const ring=(i,c)=>{const a=i/c*6.28+Math.random();return [DG.x+Math.cos(a)*12,DG.z+Math.sin(a)*12];};
  const pick=()=>def.mobs[Math.floor(Math.random()*def.mobs.length)];
  if(n===1){showMsg('KAT 1: Metin taşını kır!');mk(null,DG.x,DG.z-4,{kind:'metin',zone:'forest'});}
  else if(n===2){showMsg('KAT 2: Tüm canavarları temizle!');for(let i=0;i<def.per+2;i++){const q=ring(i,def.per+2);mk(pick(),q[0],q[1]);}}
  else if(n===3){showMsg('KAT 3: Bekçileri yen, anahtarları doğru renkli mühürlere götür!');dungeon.pend=true;sealsInit(L,mk,ring,pick);}
  else{showMsg('KAT 4: Metin ve muhafızlar!');mk(null,DG.x,DG.z-4,{kind:'metin',zone:'desert'});for(let i=0;i<def.per;i++){const q=ring(i,def.per);mk(pick(),q[0],q[1]);}}
};}
{const _dk=dungeonKill;dungeonKill=function(b){const tw=dungeon&&!dungeon.done&&dungeon.def.tower;_dk(b);
  if(tw&&b&&dungeon&&dungeon.done){const w=player.equipped.weapon;if(w&&w.up<UP_MAX){w.up++;recalcStats();showMsg('🔨 Kule Demircisi silahını +'+w.up+' yaptı!');chat('Kule Demircisi: '+w.name+' +'+w.up,'#fd6');}else{player.yang+=2000;chat('Kule Demircisi: +2000 Yang','#fd6');}saveGame();}};}

// ---- Kat 3 mühür mekaniği
const SEALC=[{n:'Kırmızı',c:0xff3333},{n:'Mavi',c:0x3388ff},{n:'Yeşil',c:0x33dd55}];
let seals=null;
function sealsInit(L,mk,ring,pick){
  sealsClear();const perm=[0,1,2].sort(()=>Math.random()-.5),list=[];
  for(let i=0;i<3;i++){const q=ring(i,3),e=mk('elite',q[0],q[1]);const sc=SEALC[perm[i]];e.name=sc.n+' Mühür Bekçisi';e.sealKey=perm[i];e.maxHp=Math.round(e.maxHp*1.6);e.hp=e.maxHp;if(e.label)e.label.textContent='🔑 '+e.name+' Lv'+e.lv;}
  for(let i=0;i<3;i++){const q=ring(i+.5,3);mk(pick(),q[0],q[1]);}
  for(let i=0;i<3;i++){const a=i/3*6.28+1,x=DG.x+Math.cos(a)*7,z=DG.z+Math.sin(a)*7,gm=new THREE.Group();
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,1.4,8),new THREE.MeshLambertMaterial({color:0x555566})),orb=new THREE.Mesh(new THREE.SphereGeometry(.3,8,8),new THREE.MeshBasicMaterial({color:SEALC[i].c}));orb.position.y=1.7;col.position.y=.7;gm.add(col,orb);gm.position.set(x,0,z);scene.add(gm);list.push({m:gm,orb,x,z,k:i,open:false});}
  seals={list,keys:new Set()};
}
function sealsClear(){if(!seals)return;seals.list.forEach(s=>scene.remove(s.m));seals=null;}
{const _d3=Enemy.prototype.die;Enemy.prototype.die=function(){const k=this.sealKey;_d3.call(this);if(k!==undefined&&seals){seals.keys.add(k);showMsg('🔑 '+SEALC[k].n+' Anahtar alındı! '+SEALC[k].n+' mühüre götür.');sfx('pot');}};}
setInterval(()=>{if(!seals)return;if(!dungeon||!dungeon.def.tower||dungeon.wave!==3){sealsClear();return;}
  const pp=player.group.position;let allOpen=true;
  for(const s of seals.list){if(!s.open){allOpen=false;if(seals.keys.has(s.k)&&Math.hypot(pp.x-s.x,pp.z-s.z)<3){s.open=true;s.orb.scale.setScalar(2);showMsg('🔓 '+SEALC[s.k].n+' mühür açıldı!');sfx('level');spawnBurst(new THREE.Vector3(s.x,1.7,s.z),SEALC[s.k].c);}
    else if(!seals.keys.has(s.k)&&Math.hypot(pp.x-s.x,pp.z-s.z)<2.5&&seals.keys.size>0&&!s.hinted){s.hinted=true;showMsg('Bu mühür için '+SEALC[s.k].n+' anahtar gerekir.');}}}
  if(allOpen&&!enemies.some(e=>e.dg&&!e.dead)){sealsClear();showMsg('Tüm mühürler açıldı! Kat 4...');dungeon.pend=true;setTimeout(()=>{if(dungeon&&!dungeon.done)spawnWave(4);},1500);}
},400);
{const _dk2=dungeonKill;dungeonKill=function(b){if(seals&&dungeon&&dungeon.def.tower&&dungeon.wave===3)dungeon.pend=true;return _dk2(b);};}

// ---- Haritada gezen bot avcılar
const bots=[];const BOTCH=['Metin taşı nerede kaldı?','Kızıl Çöl\'de boss var mı?','+9 basan var mı?','Şeytan Kulesi\'ne grup lazım.','Kutsama kitabı satıyorum!','Bu sunucu çok kalabalık :)','Dün 3 metin kırdım!','At almak için Yang biriktiriyorum.'];
function botSpawn(){
  const pp=player.group.position,a=Math.random()*6.28,r=38+Math.random()*22,x=pp.x+Math.cos(a)*r,z=pp.z+Math.sin(a)*r;
  if(zoneAt(x,z)==='village'||Math.hypot(x,z)>WORLD_R-8)return;
  const cl=['savasci','ninja','okcu','sura','saman','lykaner'].filter(c=>CLASSES[c]),cls=cl[Math.floor(Math.random()*cl.length)],nm=RIVN[Math.floor(Math.random()*RIVN.length)];
  const b={n:nm,cls,hostile:Math.random()<.3,x,z,wx:x,wz:z,wt:0,born:Date.now(),greeted:false,ph:Math.random()*9};
  b.mesh=buildHuman(cls,false,{},b.hostile?0x8a2a2a:0x2a7a5a);b.mesh.position.set(x,0,z);scene.add(b.mesh);
  b.label=makeLabel((b.hostile?'⚔ ':'🧑 ')+nm+' Lv'+Math.max(1,player.level+Math.floor(Math.random()*5)-2),b.hostile?'me':'npc');bots.push(b);
}
function botRemove(b){scene.remove(b.mesh);if(b.label&&b.label.remove)b.label.remove();const i=bots.indexOf(b);if(i>=0)bots.splice(i,1);}
setInterval(()=>{if(!player.cls||!player.alive||dungeon||duel){bots.slice().forEach(botRemove);return;}
  const pp=player.group.position;bots.slice().forEach(b=>{if(Date.now()-b.born>300000||Math.hypot(b.x-pp.x,b.z-pp.z)>130)botRemove(b);});
  if(zoneAt(pp.x,pp.z)!=='village'&&bots.length<3&&Math.random()<.12)botSpawn();
  if(bots.length&&Math.random()<.05){const b=bots[Math.floor(Math.random()*bots.length)];chat('[Dünya] '+b.n+': '+BOTCH[Math.floor(Math.random()*BOTCH.length)],'#9cf');}
},1000);
{const _ub=update;update=function(dt){_ub(dt);if(!bots.length)return;const pp=player.group.position;
  for(const b of bots.slice()){b.wt-=dt;if(b.wt<=0){b.wt=3+Math.random()*4;const a=Math.random()*6.28,r=6+Math.random()*14;b.wx=b.x+Math.cos(a)*r;b.wz=b.z+Math.sin(a)*r;}
    const dx=b.wx-b.x,dz=b.wz-b.z,d=Math.hypot(dx,dz);if(d>.5){b.x+=dx/d*3.6*dt;b.z+=dz/d*3.6*dt;b.mesh.rotation.y=Math.atan2(dx,dz);b.ph+=dt*9;}
    if(zoneAt(b.x,b.z)==='village'){b.x-=dx/(d||1)*4*dt;b.z-=dz/(d||1)*4*dt;}
    b.mesh.position.set(b.x,d>.5?Math.abs(Math.sin(b.ph))*.08:0,b.z);
    const pd=Math.hypot(b.x-pp.x,b.z-pp.z);placeLabel(b.label,b.x,2.6,b.z,30,pd);
    if(pd<13&&!b.greeted){b.greeted=true;if(b.hostile){botRemove(b);rivalAt(b.x,b.z,b.cls,b.n,'sana meydan okuyor!');}else{chat(b.n+': Selam, bol şans!','#9fd');spawnBurst(b.mesh.position.clone(),0x88ffcc);}}}};}
window.__g9.botSpawn=botSpawn;window.__g9.bots=bots;window.__g9.sealsInfo=()=>seals;

// ===== g10: günlük ödül, ayarlar, ışınlanma, banka, otomatik satış, emote, balık tutma, Sonsuz Kule =====
Object.assign(OPT,Object.assign({musVol:1,autoSell:-1},JSON.parse(localStorage.getItem('m2_opt')||'{}')));
const mkEl=(h,css)=>{const d=document.createElement('div');d.style.cssText=css||'';d.innerHTML=h;document.body.appendChild(d);return d;};
const todayStr=()=>new Date().toISOString().slice(0,10);

// ---- günlük giriş ödülü
let dailyDone=false;
setInterval(()=>{if(dailyDone||!player.cls)return;dailyDone=true;let d=null;try{d=JSON.parse(localStorage.getItem('m2_daily')||'null');}catch(e){}
  const t=todayStr();if(d&&d.d===t)return;const y=new Date(Date.now()-864e5).toISOString().slice(0,10),streak=(d&&d.d===y)?Math.min(30,d.s+1):1;
  const r=50+Math.min(streak,7)*30+player.level*5;player.yang+=r;try{localStorage.setItem('m2_daily',JSON.stringify({d:t,s:streak}));}catch(e){}
  showMsg('🎁 Günlük ödül: +'+r+' Yang ('+streak+'. gün)');chat('Günlük giriş ödülü: +'+r+' Yang • seri '+streak+' gün','#fd6');updateHUD();saveGame();},1500);

// ---- ayarlar: müzik, otomatik satış, köye dön
{const sb=$('saveOut');if(sb){const w=document.createElement('div');w.style.cssText='display:flex;flex-direction:column;gap:5px;font-size:12px';
  w.innerHTML='<label>🎵 Müzik sesi <input type="range" id="optMus" min="0" max="100" style="width:110px;vertical-align:middle"></label>'
   +'<label>💰 Otomatik sat: <select id="optAs"><option value="-1">Kapalı</option><option value="0">Sıradan</option><option value="1">Sıradan + Az Bulunan</option><option value="2">Nadir\'e kadar</option></select></label>'
   +'<button id="homeBtn">🏠 Köye dön (ücretsiz)</button>';sb.parentNode.insertBefore(w,sb);
  $('optMus').value=Math.round(OPT.musVol*100);$('optAs').value=String(OPT.autoSell);
  $('optMus').oninput=e=>{OPT.musVol=e.target.value/100;saveOpt();};$('optAs').onchange=e=>{OPT.autoSell=+e.target.value;saveOpt();};
  $('homeBtn').onclick=()=>{if(!player.cls||!player.alive)return;if(dungeon){showMsg('Zindandan önce çık.');return;}if(duel){showMsg('Düello sürüyor.');return;}player.group.position.set(0,0,4);player.mounted=false;paintMount();$('setBox').classList.remove('open');showMsg('Köye döndün.');};}}
setInterval(()=>{try{if(typeof mGain!=='undefined'&&mGain)mGain.gain.value=OPT.musVol;}catch(e){}},500);
{const _gi=giveItem;giveItem=function(it){if(OPT.autoSell>=0&&it&&RARITIES.findIndex(r=>r.key===it.rarity)<=OPT.autoSell&&!(it.sn>0)){player.yang+=it.value;chat('Otomatik satıldı: '+it.name+' (+'+it.value+')','#fc8');updateHUD();return false;}return _gi(it);};}

// ---- NPC'ler: ışınlanma, banka, kule bekçisi
const NPT=addNpc({id:'portal',n:'Işınlanma Taşı',x:12,z:-14,tint:0x6a4ab0,cls:'saman',t:'portal'});
addNpc({id:'bank',n:'Bankacı Hüsnü',x:6,z:14,tint:0xb08a2a,cls:'savasci',t:'bank'});
addNpc({id:'etower',n:'Kule Bekçisi',x:-6,z:-14,tint:0x4a3a5a,cls:'sura',t:'etower'});
const TPS=[['forest','🌲 Yeşil Orman',0,50],['desert','🏜 Kızıl Çöl',50,0],['snow','❄ Buzul Vadisi',0,-50],['swamp','🌫 Karanlık Bataklık',-50,0],['fish1','🎣 Güney Gölü',-48,63],['fish2','🎣 Bataklık Gölü',-82,-26]];
const TPC=5000;
let bkFilter='';
const bankItems=()=>META().bank||(META().bank=[]);
function bankList(){const q=bkFilter.toLowerCase(),b=bankItems(),el=$('bkList');if(!el)return;
  const ok=it=>!q||(it.name+' '+(it.aff||[]).map(f=>f.k).join(' ')+' '+it.slot+' '+it.rarity).toLowerCase().includes(q);
  let h='<div class="stat"><b>🏦 Banka ('+b.length+'/100)</b></div>';b.filter(ok).forEach(it=>{h+=itemRow(it,btn('bkget','Çek','data-id="'+it.id+'"',player.inventory.length>=INV_MAX));});
  h+='<div class="stat"><b>🎒 Çanta ('+player.inventory.length+'/'+INV_MAX+')</b></div>';player.inventory.filter(ok).forEach(it=>{h+=itemRow(it,btn('bkput','Yatır','data-id="'+it.id+'"',b.length>=100));});el.innerHTML=h;}
{const _rn3=renderNpc;renderNpc=function(){_rn3();if(!npcCur)return;
  if(npcCur.t==='portal'){let h='<div class="stat"><span>Işınlan ('+TPC+' Yang)</span><span>💰 '+player.yang+'</span></div>';TPS.forEach(t=>{h+='<div class="itemRow"><span class="name"><b>'+t[1]+'</b></span>'+btn('tp','Işınlan','data-t="'+t[0]+'"',player.yang<TPC)+'</div>';});$('npcBody').innerHTML=h;}
  else if(npcCur.t==='bank'){$('npcBody').innerHTML='<input id="bkQ" placeholder="Ara: kritik, nadir, silah, crit…" style="width:100%;box-sizing:border-box;background:#1a1208;color:#ffe9b0;border:1px solid #c99a3a;padding:5px;font-size:12px"><div id="bkList"></div>';
    $('bkQ').value=bkFilter;$('bkQ').oninput=e=>{bkFilter=e.target.value;bankList();};bankList();}
  else if(npcCur.t==='etower')etowerRender();
};}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act;
  if(a==='tp'){const d=TPS.find(x=>x[0]===t.dataset.t);if(!d||player.yang<TPC||dungeon||duel)return;player.yang-=TPC;player.group.position.set(d[2],0,d[3]);closePanels();showMsg('Işınlandın: '+d[1]);sfx('level');updateHUD();saveGame();}
  else if(a==='bkput'){const id=+t.dataset.id,i=player.inventory.findIndex(x=>x.id===id),b=bankItems();if(i<0||b.length>=100)return;b.push(player.inventory.splice(i,1)[0]);sfx('buy');saveGame();bankList();}
  else if(a==='bkget'){const id=+t.dataset.id,b=bankItems(),i=b.findIndex(x=>x.id===id);if(i<0||player.inventory.length>=INV_MAX)return;player.inventory.push(b.splice(i,1)[0]);sfx('buy');saveGame();bankList();}
  else if(a==='etenter'){endlessEnter();}
});

// ---- Emote
const EMO=[['👋','Selam'],['😄','Gülme'],['💃','Dans'],['😠','Sinirli'],['😭','Ağlama'],['❤','Kalp']];
const NPCR=['Selam evlat!','Hoş geldin yolcu!','Ha ha, neşeli biri bu!','Sakin ol, kahraman.','Üzülme, her şey düzelir.','Ne güzel bir gün!'];
{const mb=$('menu');if(mb){const b=document.createElement('button');b.id='emoBtn';b.textContent='😀';mb.appendChild(b);
  const pn=mkEl(EMO.map((x,i)=>'<button data-emo="'+i+'" style="font-size:22px;margin:3px;padding:6px 10px">'+x[0]+'</button>').join(''),'position:fixed;right:52px;top:140px;z-index:60;display:none;background:rgba(30,20,8,.92);border:2px solid #c99a3a;border-radius:10px;padding:4px;max-width:180px');
  b.onclick=()=>{pn.style.display=pn.style.display==='none'?'block':'none';};
  pn.onclick=e=>{const x=e.target.closest('[data-emo]');if(!x)return;const i=+x.dataset.emo;pn.style.display='none';if(!player.cls||!player.alive)return;
    showDamage(player.group.position.clone().setY(2.6),EMO[i][0],'#fff',true);chat('[Emote] '+player.name+' '+EMO[i][1].toLowerCase()+' yaptı '+EMO[i][0],'#fcf');
    if(i===2){let n=0;const iv=setInterval(()=>{player.group.rotation.y+=.5;if(++n>24)clearInterval(iv);},40);}
    const pp=player.group.position;for(const n of NPCS){if(Math.hypot(n.x-pp.x,n.z-pp.z)<7){chat(n.n+': '+NPCR[i],'#ffe58a');break;}}};}}

// ---- Balık tutma
const POND=[[-48,72,7],[-92,-26,8]];
const FISH=[{id:'levrek',n:'Levrek',r:0,v:30,h:25},{id:'sazan',n:'Sazan',r:0,v:35,h:25},{id:'hamsi',n:'Hamsi',r:0,v:20,h:20},{id:'alabalik',n:'Alabalık',r:0,v:40,h:25},
  {id:'kefal',n:'Kefal',r:1,v:80,h:35},{id:'cipura',n:'Çipura',r:1,v:100,h:35},{id:'lufer',n:'Lüfer',r:1,v:120,h:35},
  {id:'somon',n:'Somon',r:2,v:300,h:45},{id:'yayin',n:'Yayın',r:2,v:450,h:50},{id:'mersin',n:'Mersin',r:2,v:600,h:55},
  {id:'altin',n:'Altın Sazan',r:3,v:10000,h:100},{id:'ejder',n:'Ejder Balığı',r:3,v:10000,h:100}];
const RN=['Sıradan','Az bulunan','Nadir','Efsanevi'],RC=['#ddd','#6f6','#6af','#fa3'];
const fishBag=()=>META().fish||(META().fish={});
ACH.push({id:'fishleg',n:'Efsanevi Balıkçı',d:'Efsanevi bir balık yakala',t:()=>(fishBag().altin||0)+(fishBag().ejder||0)+((META().fishLeg)||0)>0,r:0});
const fishBtn=mkEl('🎣 Balık tut','position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:22;display:none;padding:10px 20px;border-radius:10px;border:2px solid #c99a3a;background:linear-gradient(180deg,#2a6a8a,#143a50);color:#fff;font-size:14px');
const fishP=mkEl('','position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:70;display:none;width:min(88vw,320px);background:rgba(20,14,6,.95);border:2px solid #c99a3a;border-radius:12px;padding:12px;color:#ffe9b0;font-size:13px;text-align:center');
let fish={st:'off',t:0,pos:0,dir:1,zone:[40,60],f:null};
function nearPond(){const pp=player.group.position;for(const p of POND)if(Math.hypot(pp.x-p[0],pp.z-p[1])<p[2]+5)return true;return false;}
function fishRender(msg){const bag=fishBag(),tot=FISH.reduce((s,f)=>s+(bag[f.id]||0)*f.v,0);
  let h='<div style="font-weight:bold;margin-bottom:6px">🎣 BALIK TUTMA <span id="fishX" style="float:right;cursor:pointer">✕</span></div>';
  if(fish.st==='off'||fish.st==='res')h+=(msg?'<div style="margin:6px 0">'+msg+'</div>':'<div style="margin:6px 0">Olta atıp balığı yakala!</div>')+'<button id="fCast" style="padding:8px 14px">🎣 Olta at</button> ';
  if(fish.st==='wait')h+='<div style="margin:10px 0">Balık bekleniyor...</div>';
  if(fish.st==='bite')h+='<div style="margin:4px 0;color:#ff8">ŞİMDİ! Çubuk yeşilin içindeyken çek!</div><div style="position:relative;height:22px;background:#3a2a1a;border:1px solid #c99a3a;border-radius:6px;margin:6px 0"><div id="fZone" style="position:absolute;top:0;bottom:0;left:'+fish.zone[0]+'%;width:'+(fish.zone[1]-fish.zone[0])+'%;background:#3c3"></div><div id="fMark" style="position:absolute;top:-3px;bottom:-3px;width:5px;background:#fff;left:0"></div></div><button id="fPull" style="padding:10px 22px;font-size:16px">ÇEK!</button>';
  h+='<div style="margin-top:8px;font-size:11px;text-align:left">'+FISH.filter(f=>bag[f.id]).map(f=>'<span style="color:'+RC[f.r]+'">'+f.n+' ×'+bag[f.id]+'</span>').join(' • ')+'</div>';
  if(tot>0&&fish.st!=='bite')h+='<div style="margin-top:6px"><button id="fSell">💰 Hepsini sat (+'+tot+')</button> <button id="fEat">🍣 Ye (can)</button></div>';
  fishP.innerHTML=h;
  const g=id=>fishP.querySelector('#'+id);if(g('fishX'))g('fishX').onclick=fishClose;if(g('fCast'))g('fCast').onclick=fishCast;if(g('fPull'))g('fPull').onclick=fishPull;
  if(g('fSell'))g('fSell').onclick=()=>{const b=fishBag();let s=0;FISH.forEach(f=>{s+=(b[f.id]||0)*f.v;b[f.id]=0;});player.yang+=s;sfx('buy');updateHUD();saveGame();fishRender('Balıklar satıldı: +'+s+' Yang');};
  if(g('fEat'))g('fEat').onclick=()=>{const b=fishBag(),f=FISH.filter(x=>b[x.id]>0).sort((a,c)=>a.v-c.v)[0];if(!f)return;b[f.id]--;player.hp=Math.min(player.maxHp,player.hp+player.maxHp*f.h/100);sfx('pot');updateHUD();saveGame();fishRender(f.n+' yedin: +%'+f.h+' can');};
}
function fishOpen(){fish.st='off';fishP.style.display='block';fishRender();}
function fishClose(){fish.st='off';fishP.style.display='none';}
function fishCast(){if(fish.st==='wait'||fish.st==='bite')return;fish.st='wait';fishRender();fish.t=1.2+Math.random()*2.2;}
function fishRoll(){const r=Math.random(),lv=r<.54?0:r<.82?1:r<.97?2:3,l=FISH.filter(f=>f.r===lv);return l[Math.floor(Math.random()*l.length)];}
function fishPull(){if(fish.st!=='bite')return;const f=fish.f,ok=fish.pos>=fish.zone[0]&&fish.pos<=fish.zone[1];fish.st='res';
  if(ok){fishBag()[f.id]=(fishBag()[f.id]||0)+1;sfx('level');let m='Yakaladın: <b style="color:'+RC[f.r]+'">'+f.n+'</b> ('+RN[f.r]+')';
    if(f.r===3){player.yang+=10000;META().fishLeg=1;m+='<br>🏆 EFSANEVİ! +10000 Yang';showMsg('🐉 Efsanevi balık: '+f.n+'!');updateHUD();}saveGame();fishRender(m);}
  else{sfx('miss');fishRender('Balık kaçtı!');}}
setInterval(()=>{if(!player.cls||!player.alive||dungeon||duel){fishBtn.style.display='none';if(fish.st!=='off')fishClose();return;}
  const np=nearPond();fishBtn.style.display=(np&&fishP.style.display==='none')?'block':'none';if(!np&&fish.st!=='off')fishClose();},300);
fishBtn.onclick=fishOpen;
setInterval(()=>{if(fish.st==='wait'){fish.t-=.05;if(fish.t<=0){fish.f=fishRoll();const w=[34,26,18,9][fish.f.r],c=15+Math.random()*(70-w);fish.zone=[Math.round(c),Math.round(c+w)];fish.st='bite';fish.pos=0;fish.dir=1;fish.bt=3.5;fishRender();sfx('pot');}}
  else if(fish.st==='bite'){const sp=(90+fish.f.r*40)*.05;fish.pos+=fish.dir*sp;if(fish.pos>=100){fish.pos=100;fish.dir=-1;}if(fish.pos<=0){fish.pos=0;fish.dir=1;}const m=fishP.querySelector('#fMark');if(m)m.style.left=Math.min(97,fish.pos)+'%';
    fish.bt-=.05;if(fish.bt<=0){fish.st='res';sfx('miss');fishRender('Balık yemi bırakıp kaçtı...');}}},50);

// ---- Sonsuz Kule
const ETDEF={id:'endless',n:'Sonsuz Kule',min:10,waves:1,per:6,mobs:['orcw','archer','mage','elite','orcshaman','tank','skel'],boss:'boss_sohan',mul:2,fog:0x1a0e22,endless:true};
const EBOSS=['boss_cave','boss_spider','boss_sohan','boss_snow','boss_swamp'];
const weekId=()=>Math.floor(Date.now()/6048e5);
const ETW=()=>{const m=META();return m.tw||(m.tw={cp:1,best:0,wk:weekId(),wbest:0});};
const botFl=(w,i)=>8+((w*7919+i*104729+i*i*31)%38);
const botRank=(w,v)=>1+Array.from({length:9},(_,i)=>botFl(w,i)).filter(x=>x>v).length;
function etWeekly(){const t=ETW(),w=weekId();if(t.wk===w)return;const rk=botRank(t.wk,t.wbest);
  if(t.wbest>0&&rk<=10){const it=makeItem(player.level+3,2);giveItem(it);showMsg('🏆 Geçen hafta Kule sıralaması #'+rk+'! Ödül: '+it.name);chat('Haftalık Kule ödülü: '+it.name,'#fd6');}
  t.wk=w;t.wbest=0;saveGame();}
setInterval(()=>{if(player.cls)etWeekly();},5000);
function etowerRender(){etWeekly();const t=ETW(),w=weekId();let h='<div class="stat"><span>Başlangıç katı: <b>'+t.cp+'</b></span><span>En iyi: '+t.best+'</span></div>'
  +'<div class="stat" style="display:block;font-size:11px;color:#c9b88a">Her katta düşmanlar +%15 güçlenir, ödül +%8 artar. Her 5 katta boss. Ölürsen 1 kat gerilersin. Zindan anahtarı gerekir. Süre her kat temizlenince +45 sn uzar. Haftalık ilk 10 sıraya nadir+ eşya.</div>'
  +btn('etenter','🗝 Kuleye gir (kat '+t.cp+')','',player.level<ETDEF.min||player.keys<1)+'<div class="stat"><b>Bu haftanın sıralaması</b></div>';
  const rows=Array.from({length:9},(_,i)=>({n:RIVN[i%RIVN.length]+(i>=RIVN.length?' II':''),f:botFl(w,i)}));rows.push({n:player.name,f:t.wbest,me:true});rows.sort((a,b)=>b.f-a.f);
  rows.forEach((r,i)=>{h+='<div class="stat" style="'+(r.me?'background:rgba(201,154,58,.3)':'')+'"><span>'+(i+1)+'. '+(r.me?'★ ':'')+r.n+'</span><span>Kat '+r.f+'</span></div>';});$('npcBody').innerHTML=h;}
function endlessEnter(){if(dungeon||duel)return;const idx=DGS.length;DGS.push(ETDEF);try{enterDungeon('endless');}finally{const i=DGS.indexOf(ETDEF);if(i>=0)DGS.splice(i,1);}}
{const _sw3=spawnWave;spawnWave=function(n){
  if(!(dungeon&&dungeon.def.endless))return _sw3(n);
  const def=dungeon.def;dungeon.wave=n;dungeon.pend=false;dungeon.floor=dungeon.floor==null?ETW().cp:dungeon.floor+1;const f=dungeon.floor,m=1+.15*(f-1),L=Math.max(player.level,def.min)+Math.floor(f/3);
  const mk=(sp,x,z)=>{const e=new Enemy(new THREE.Vector3(x,0,z),sp,L,{dg:true});e.state='chase';e.maxHp=Math.round(e.maxHp*m);e.hp=e.maxHp;e.dmg=Math.round(e.dmg*m);enemies.push(e);return e;};
  if(f%5===0){const bk=EBOSS[(f/5-1)%EBOSS.length],e=mk(bk,DG.x,DG.z-8);e.maxHp=Math.round(e.maxHp*1.2);e.hp=e.maxHp;e.boss=false;e.eboss=true;showMsg('KAT '+f+': BOSS '+(SP[bk]?SP[bk].n:'')+'!');}
  else{const c=Math.min(14,4+Math.floor(f/2));showMsg('KAT '+f+' • düşman gücü +%'+Math.round((m-1)*100));for(let i=0;i<c;i++){const a=i/c*6.28+Math.random(),sp=def.mobs[Math.floor(Math.random()*def.mobs.length)];mk(sp,DG.x+Math.cos(a)*12,DG.z+Math.sin(a)*12);}}
};}
{const _dk3=dungeonKill;dungeonKill=function(b){
  if(dungeon&&dungeon.def.endless&&!dungeon.pend&&!enemies.some(e=>e.dg&&!e.dead)){const f=dungeon.floor,t=ETW(),r=1+.08*(f-1),y=Math.round((150+player.level*15)*r);
    player.yang+=y;t.cp=f+1;if(f>t.best)t.best=f;if(f>t.wbest)t.wbest=f;dungeon.t+=45;
    showMsg('✔ Kat '+f+' tamam! +'+y+' Yang');if(f%5===0){dropItem(player.group.position.clone(),2,player.level+2);player.shards+=2;chat('Boss katı ödülü: eşya + 2 Metin Parçası','#fd6');}else if(Math.random()<.25)dropItem(player.group.position.clone(),1,player.level+1);
    updateHUD();saveGame();}
  return _dk3(b);};}
{const _rs=respawn;respawn=function(){if(dungeon&&dungeon.def.endless){const t=ETW();t.cp=Math.max(1,(dungeon.floor||t.cp)-1);saveGame();showMsg('Kuleden düştün. Yeni başlangıç katı: '+t.cp);}return _rs();};}
window.__g10={give:it=>giveItem(it),FISH,fish:()=>fish,fishRoll,fishCast,fishPull,fishOpen,fishClose,ETW,endlessEnter,TPS,bankItems,EMO,botRank,botFl};

// ===== g11: yetenek dalları, element kombo, silah evrimi, klan, krallık savaşı, sıralama =====
const mkPanel=(id,title)=>{const d=document.createElement('div');d.id=id;d.className='panel';d.style.width='min(92vw,340px)';d.innerHTML='<h3>'+title+' <span class="x" style="float:right;cursor:pointer">✕</span></h3><div class="pb"></div>';document.body.appendChild(d);d.querySelector('.x').onclick=()=>d.classList.remove('open');panels[id]=d;return d;};
const pbody=p=>p.querySelector('.pb');
const menuBtn=(id,txt,fn)=>{const mb=$('menu');if(!mb)return;const b=document.createElement('button');b.id=id;b.textContent=txt;b.onclick=fn;mb.appendChild(b);};
const hsh=(a,b)=>((Math.imul(a|0,2654435761)^Math.imul((b|0)+7,40503))>>>0)%1000/1000;
const weekN=()=>Math.floor(Date.now()/6048e5);
const monthN=()=>{const d=new Date();return d.getFullYear()*12+d.getMonth();};

// ---------- Yetenek dalları ----------
const BR_COST=2000;let brBoostUntil=0;
const brArr=()=>{const m=META();return m.br||(m.br=[null,null,null,null]);};
const brP=mkPanel('brPanel','🌿 YETENEK DALLARI');
function brRender(){const sk=CLASSES[player.cls].skills,br=brArr();let h='<div style="font-size:11px;color:#c9b88a">Yetenek Lv 5 olunca dal seçilir. İlk seçim ücretsiz, değiştirmek '+BR_COST+' Yang.</div>';
  for(let i=0;i<4;i++){const s=sk[i];if(!s)continue;h+='<div class="stat" style="display:block"><b>'+s.n+'</b> <small>Lv '+(player.skills[i]||0)+'</small><br>';
    if(!skillOpen(i))h+='<small style="color:#9a8a68">Henüz açılmadı</small>';else if(player.skills[i]<5)h+='<small style="color:#9a8a68">Dal için yetenek Lv 5 gerekir</small>';
    else h+=btn('brsel','⚔ Güç (+%25 hasar)'+(br[i]==='a'?' ✓':''),'data-i="'+i+'" data-b="a"',br[i]==='a')+' '+btn('brsel','⚡ Seri (−%25 bekleme, −%20 MP)'+(br[i]==='b'?' ✓':''),'data-i="'+i+'" data-b="b"',br[i]==='b');
    h+='</div>';}
  pbody(brP).innerHTML=h;}
menuBtn('brBtn','🌿',()=>{if(!player.cls)return;if(brP.classList.contains('open'))brP.classList.remove('open');else{closePanels();brP.classList.add('open');brRender();}});
brP.addEventListener('click',e=>{const t=e.target.closest('[data-act=brsel]');if(!t)return;const i=+t.dataset.i,b=t.dataset.b,arr=brArr();if(arr[i]===b)return;
  if(arr[i]){if(player.yang<BR_COST){showMsg('Dal değiştirmek için '+BR_COST+' Yang gerekir.');return;}player.yang-=BR_COST;}
  arr[i]=b;sfx('level');showMsg('Dal seçildi!');updateHUD();saveGame();brRender();});
{const _u=useSkill;useSkill=function(i){const b=brArr()[i],cd0=player.skillCd[i],mp0=player.mp;if(b==='a')brBoostUntil=performance.now()+900;_u(i);
  if(b==='b'&&cd0<=0&&player.skillCd[i]>0){player.skillCd[i]*=.75;const used=mp0-player.mp;if(used>0){player.mp=Math.min(player.maxMp,player.mp+used*.2);updateHUD();}}};}
{const _h=hitDamage;hitDamage=function(m,c){const r=_h(m,c);return performance.now()<brBoostUntil?Math.round(r*1.25):r;};}

// ---------- Element kombinasyonu + silah evrimi ----------
const EKEYS=['fire','ice','poison'];
{const _ep=elemProc;elemProc=function(e,dmg){_ep(e,dmg);const w=player.equipped.weapon;if(!w||!w.el||!w.el2||e.dead)return;
  const sv=w.el;w.el=w.el2;_ep(e,dmg);w.el=sv;const now=performance.now(),k=[w.el,w.el2].sort().join('+');
  if(k==='fire+ice'){e.blindUntil=now+4000;if(Math.random()<.2)showDamage(e.mesh.position.clone().setY(e.h+1),'BUHAR!','#ccf',false);}
  else if(k==='fire+poison'){if(e.dot&&!e.dot.x2){e.dot.dps*=2;e.dot.x2=1;}if(Math.random()<.2)showDamage(e.mesh.position.clone().setY(e.h+1),'CEHENNEM!','#f84',false);}
  else if(k==='ice+poison'){e.slowUntil=now+3500;e.dot={until:now+4000,dps:Math.max(1,dmg*.6/4),acc:0,tx:0};if(Math.random()<.2)showDamage(e.mesh.position.clone().setY(e.h+1),'KARA BUZ!','#9bd',false);}};}
{const _dp=damagePlayer;damagePlayer=function(n,src){if(src&&src.blindUntil&&performance.now()<src.blindUntil&&Math.random()<.3){showDamage(player.group.position.clone().setY(2.2),'KAÇIRDI','#ccf',false);return;}return _dp(n,src);};}
{const _rc4=recalcStats;recalcStats=function(){_rc4();const w=player.equipped&&player.equipped.weapon;if(w&&w.up>=11)player.baseDmg*=1.15;};}
{const _td4=Enemy.prototype.takeDamage;Enemy.prototype.takeDamage=function(a,c,o){const r=_td4.call(this,a,c,o);const w=player.equipped&&player.equipped.weapon;
  if(c&&w&&w.up>=15&&!this._aoe&&this.mesh){const p=this.mesh.position;spawnBurst(p.clone(),0xffee66);for(const e of enemies){if(e===this||e.dead||e.isMetin)continue;if(Math.hypot(e.mesh.position.x-p.x,e.mesh.position.z-p.z)<4){e._aoe=1;_td4.call(e,Math.round(a*.4),false);e._aoe=0;}}}return r;};}
SHOP.push({id:'eshard',n:'Element Kırığı',d:'+9 üstü geliştirme ve element ekleme için',p:1200,i:'🔷'});
{const _b2=buy;buy=function(id){if(id==='eshard'){const s=SHOP.find(x=>x.id==='eshard');if(player.yang<s.p)return;player.yang-=s.p;player.mats.eshard=(player.mats.eshard||0)+1;sfx('buy');updateHUD();saveGame();renderNpc();return;}return _b2(id);};}
{const _dd=Enemy.prototype.die;Enemy.prototype.die=function(){const bs=this.boss||this.eboss,im=this.isMetin;_dd.call(this);if(bs&&!im){const n=1+(Math.random()<.5?1:0);player.mats.eshard=(player.mats.eshard||0)+n;chat('Düştü: 🔷 Element Kırığı ×'+n,'#9df');}};}
{const _rn4=renderNpc;renderNpc=function(){_rn4();if(!npcCur||npcCur.t!=='smith')return;const s=findItem(smithSel),m=player.mats.eshard||0;
  let h='<div class="stat"><b>🔷 Element ('+m+' kırık)</b></div>';
  if(s&&s.slot==='weapon'){h+='<div class="stat" style="display:block;font-size:11px"><b>'+s.name+'</b> +'+s.up+' • '+(s.el?ELEMENTS[s.el].n:'elementsiz')+(s.el2?' + '+ELEMENTS[s.el2].n:'')+'<br><span style="color:#c9b88a">+10: element eklenir • +11–14: +%15 hasar • +15: kritikte alan hasarı<br>Kombo: 🔥+❄=Buhar (kör) • 🔥+☠=Cehennem (2× yanma) • ❄+☠=Kara Buz</span></div>';
    if(s.up>=10&&!s.el2){h+='<div style="display:flex;gap:4px;flex-wrap:wrap">';EKEYS.filter(k=>k!==s.el).forEach(k=>{h+=btn('eladd',ELEMENTS[k].n,'data-k="'+k+'"',m<2||player.yang<2000);});h+='</div><div class="stat"><span>Bedel: 2000 Yang + 2 🔷</span></div>';}
    else if(s.up<10)h+='<div class="stat"><span>Element için silah +10 olmalı.</span></div>';}
  else h+='<div class="stat"><span>Element için yukarıdan bir silah seç.</span></div>';
  $('npcBody').innerHTML+=h;};}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act=eladd]');if(!t)return;const s=findItem(smithSel),k=t.dataset.k;if(!s||s.slot!=='weapon'||s.up<10||s.el2||(player.mats.eshard||0)<2||player.yang<2000||!ELEMENTS[k])return;
  player.mats.eshard-=2;player.yang-=2000;if(!s.el)s.el=k;else s.el2=k;sfx('level');showMsg('Element eklendi: '+ELEMENTS[k].n);recalcStats();saveGame();updateHUD();renderNpc();});

// ---------- Klan ----------
const clanO=()=>META().clan||null;
const CLN=['Alp','Barış','Kaan','Selçuk','Deniz','Yiğit','Aras','Tuğrul'];
const CLMSG=['Bugün metin kesen var mı?','Klan savaşı için hazırlanın!','Zindan grubu kuruyoruz.','Yeni üyelere hoş geldin!','Banka\'ya eşya bıraktım.','Kule\'de 20. kata ulaştım!'];
addNpc({id:'clan',n:'Klan Ustası',x:-12,z:12,tint:0x2a6a4a,cls:'savasci',t:'clan'});
const clanNeed=c=>c.lv*500;
function clanXp(n){const c=clanO();if(!c)return;c.xp+=n;while(c.xp>=clanNeed(c)&&c.lv<10){c.xp-=clanNeed(c);c.lv++;chat('[Klan] Klan seviye atladı: '+c.lv+'!','#6f6');showMsg('🏰 Klan Lv '+c.lv);recalcStats();}}
function clanLabel(){const c=clanO();if(playerLbl&&player.name)playerLbl.textContent=(c?'['+c.tag+'] ':'')+player.name+(META().title?' «'+META().title+'»':'');}
{const _rp=rebuildPlayer;rebuildPlayer=function(){_rp();clanLabel();};}
{const _rc5=recalcStats;recalcStats=function(){_rc5();const c=clanO();if(c){player.bon.xp=(player.bon.xp||0)+c.lv;}const kw=META().kw;if(kw&&kw.win&&kw.win.until>Date.now()&&kw.win.k===player.kingdom){player.bon.xp=(player.bon.xp||0)+10;player.bon.yang=(player.bon.yang||0)+10;}};}
function clanRender(){const c=clanO(),b=pbody(panels.npc);let h='';
  if(!c){h='<div class="stat" style="display:block">Klan kurmak <b>10.000 Yang</b>. Klan seviyesi arttıkça tecrübe bonusu (+%1/seviye), klan bankası ve haftalık klan savaşı açılır.</div>'
    +'<input id="clnN" maxlength="16" placeholder="Klan adı" style="width:100%;box-sizing:border-box;margin:4px 0;background:#1a1208;color:#ffe9b0;border:1px solid #c99a3a;padding:5px"><input id="clnT" maxlength="4" placeholder="Rozet (2-4 harf)" style="width:100%;box-sizing:border-box;background:#1a1208;color:#ffe9b0;border:1px solid #c99a3a;padding:5px">'
    +btn('clcreate','🏰 Klan kur (10000💰)','',player.yang<10000);}
  else{h='<div class="stat"><span><b>['+c.tag+'] '+c.n+'</b></span><span>Lv '+c.lv+'</span></div><div class="stat"><span>Tecrübe</span><span>'+c.xp+'/'+clanNeed(c)+'</span></div>'
    +'<div class="stat"><span>Klan savaşı (haftada 1)</span>'+btn('clwar','⚔ Savaş',' ',c.war===weekN())+'</div><div class="stat"><b>Klan Bankası ('+c.bank.length+'/30)</b></div>';
    c.bank.forEach(it=>{h+=itemRow(it,btn('cbget','Çek','data-id="'+it.id+'"',player.inventory.length>=INV_MAX));});
    h+='<div class="stat"><b>Çanta</b></div>';player.inventory.slice(0,40).forEach(it=>{h+=itemRow(it,btn('cbput','Yatır','data-id="'+it.id+'"',c.bank.length>=30));});}
  $('npcBody').innerHTML=h;}
{const _rn5=renderNpc;renderNpc=function(){_rn5();if(npcCur&&npcCur.t==='clan')clanRender();else if(npcCur&&npcCur.t==='kwar')kwRender();};}
function clanWar(){const c=clanO();if(!c||c.war===weekN())return;c.war=weekN();
  const mine=player.level*10+player.baseDmg*.5+c.lv*20+Math.random()*60,foe=player.level*10+30+Math.random()*100;let w=0,l=0;
  for(let i=0;i<5;i++){const a=mine/5*(.7+Math.random()*.6),b=foe/5*(.7+Math.random()*.6),win=a>=b;win?w++:l++;
    setTimeout(()=>chat('[Klan Savaşı] '+(i===0?player.name:CLN[(i*3)%CLN.length])+' '+(win?'kazandı ✔':'kaybetti ✘')+'  ('+w+'-'+l+')','#6f6'),700*(i+1));}
  setTimeout(()=>{const win=w>=3;if(win){const y=2000+player.level*100;player.yang+=y;clanXp(60);const it=makeItem(player.level+2,2);giveItem(it);showMsg('🏆 Klan savaşını kazandınız! +'+y+' Yang');chat('[Klan] Zafer! '+it.name,'#6f6');}else{player.yang+=500;clanXp(15);showMsg('Klan savaşını kaybettiniz (+500 Yang)');}updateHUD();saveGame();if(panels.npc.classList.contains('open'))clanRender();},4200);}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,c=clanO();
  if(a==='clcreate'&&!c){const n=($('clnN').value||'').trim(),tg=($('clnT').value||'').trim().toUpperCase();if(n.length<3||tg.length<2){showMsg('Ad (3+) ve rozet (2-4 harf) gir.');return;}if(player.yang<10000)return;
    player.yang-=10000;META().clan={n,tag:tg.slice(0,4),lv:1,xp:0,bank:[],war:0};clanLabel();sfx('level');showMsg('🏰 Klan kuruldu: '+n);updateHUD();saveGame();clanRender();}
  else if(a==='clwar'){clanWar();setTimeout(()=>clanRender(),50);}
  else if(a==='cbput'&&c){const id=+t.dataset.id,i=player.inventory.findIndex(x=>x.id===id);if(i<0||c.bank.length>=30)return;c.bank.push(player.inventory.splice(i,1)[0]);sfx('buy');saveGame();clanRender();}
  else if(a==='cbget'&&c){const id=+t.dataset.id,i=c.bank.findIndex(x=>x.id===id);if(i<0||player.inventory.length>=INV_MAX)return;player.inventory.push(c.bank.splice(i,1)[0]);sfx('buy');saveGame();clanRender();}
});
setInterval(()=>{if(clanO()&&player.cls&&player.alive&&Math.random()<.2)chat('[Klan] '+CLN[Math.floor(Math.random()*CLN.length)]+': '+CLMSG[Math.floor(Math.random()*CLMSG.length)],'#6f6');},30000);
setInterval(()=>{if(player.cls)clanLabel();},4000);

// ---------- Krallık Savaşı ----------
addNpc({id:'kwar',n:'Krallık Habercisi',x:12,z:12,tint:0xb04a2a,cls:'ninja',t:'kwar'});
const KWD=1800000;
const kwO=()=>{const m=META();return m.kw||(m.kw={wk:0,until:0,pts:{aslan:0,kurt:0,kartal:0},my:0,win:null});};
const kwChip=mkEl('','position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:30;display:none;color:#fff;font-size:11px;padding:3px 10px;border-radius:12px;border:1px solid #e8c36a;background:rgba(120,40,30,.85)');
function kwActive(){const k=kwO();return k.until>Date.now();}
function kwStart(){const k=kwO(),w=weekN();if(k.wk===w||kwActive()||!player.cls)return false;k.wk=w;k.until=Date.now()+KWD;k.pts={aslan:0,kurt:0,kartal:0};k.my=0;
  showMsg('⚔ KRALLIK SAVAŞI başladı! (30 dk)');chat('Krallık Savaşı: canavar +1, metin +10, boss +25 puan. En çok puan toplayan krallık kazanır.','#f96');sfx('die');saveGame();return true;}
function kwEnd(){const k=kwO();if(k.until<=0)return;k.until=0;const e=Object.entries(k.pts).sort((a,b)=>b[1]-a[1]),win=e[0][0],kn=KINGDOMS.find(x=>x.id===win);
  k.win={k:win,until:Date.now()+6048e5};let m='Krallık Savaşı bitti! Kazanan: '+kn.n;
  if(k.my>=10){player.yang+=500;m+=' • Katılım +500';}
  if(win===player.kingdom){const y=3000+player.level*100;player.yang+=y;giveItem(makeItem(player.level+3,3));m+=' • Zafer +'+y+' Yang + Destansı eşya';}
  showMsg(m);chat(m+'. Kazanan krallık 1 hafta %10 bonus alır.','#fd6');recalcStats();updateHUD();saveGame();}
function kwPoint(n){if(!kwActive())return;const k=kwO();k.pts[player.kingdom]=(k.pts[player.kingdom]||0)+n;k.my+=n;}
{const _dk5=Enemy.prototype.die;Enemy.prototype.die=function(){const im=this.isMetin,bs=this.boss||this.eboss,pv=this.isPvP,rv=this.rival;_dk5.call(this);if(pv)return;kwPoint(im?10:bs?25:1);if(!im&&!pv&&clanO())clanXp(1);
  const s=META().sn=seasonO();s.k++;if(im)s.m++;if(bs&&!im)s.b++;};}
setInterval(()=>{if(!player.cls)return;const now=new Date();
  if(!kwActive()&&now.getDay()===6&&now.getHours()===20&&now.getMinutes()<10)kwStart();
  const k=kwO();if(k.until>0&&k.until<=Date.now())kwEnd();
  if(kwActive()){kwChip.style.display='block';const r=Math.max(0,k.until-Date.now()),s=Math.floor(r/1000);kwChip.textContent='⚔ Krallık Savaşı '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+' • Puanın '+k.my;
    for(const id in k.pts)k.pts[id]+=Math.random()<.5?Math.floor(Math.random()*3):0;}else kwChip.style.display='none';},5000);
function kwRender(){const k=kwO();let h='<div class="stat" style="display:block;font-size:11px">Her Cumartesi 20:00\'de otomatik başlar (oyun açıksa), 30 dk sürer. Puan: canavar +1, metin +10, boss +25. Kazanan krallık 1 hafta tüm ödüllerde +%10 alır (tecrübe/Yang).</div>';
  if(kwActive()){h+='<div class="stat"><b>Savaş sürüyor</b></div>';KINGDOMS.forEach(x=>{h+='<div class="stat"><span style="color:'+x.c+'">'+x.n+(x.id===player.kingdom?' ★':'')+'</span><span>'+(k.pts[x.id]||0)+'</span></div>';});}
  else{const w=k.win&&k.win.until>Date.now()?KINGDOMS.find(x=>x.id===k.win.k):null;h+='<div class="stat"><span>Mevcut kazanan</span><span>'+(w?w.n:'—')+'</span></div>'+btn('kwgo','⚔ Savaşı başlat',' ',k.wk===weekN());if(k.wk===weekN())h+='<div class="stat"><span style="color:#9a8a68">Bu haftaki savaş yapıldı.</span></div>';}
  $('npcBody').innerHTML=h;}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act=kwgo]');if(!t)return;if(kwStart())kwRender();});

// ---------- Sezonluk sıralama ----------
const seasonO=()=>{const m=META(),s=m.sn;const w=weekN(),mo=monthN();if(!s||s.w!==w){if(s&&s.w!==w)seasonReward(s);m.sn={w,mo,k:0,m:0,b:0};}return m.sn;};
const SNB=['Karaoğlan','Kızıl Kurt','Gölgeavcı','Demir Yumruk','Buzkıran','Çöl Şahini','Yıldırım','Bozkurt','Tarkan'];
const snBot=(w,i,sc)=>Math.round((20+hsh(w+sc*31,i)*160)*(sc===1?.4:sc===2?.1:1));
function snRank(w,sc,v){return 1+SNB.filter((_,i)=>snBot(w,i,sc)>v).length;}
function seasonReward(s){const rk=snRank(s.w,0,s.k);if(s.k>0&&rk<=10){player.yang+=1500;META().titles=Array.from(new Set((META().titles||[]).concat(['Haftanın Avcısı'])));showMsg('🏆 Haftalık öldürme sıralaması #'+rk+'! +1500 Yang, unvan');chat('Yeni unvan: Haftanın Avcısı','#fd6');saveGame();}}
const snP=mkPanel('snPanel','🏆 SIRALAMA');
function snRender(){const s=seasonO(),w=s.w,t=META().titles||[];const rows=(lbl,sc,v)=>{const r=snRank(w,sc,v);return '<div class="stat"><span>'+lbl+'</span><span><b>'+v+'</b> • #'+r+'</span></div>';};
  let h='<div class="stat"><b>Bu hafta</b></div>'+rows('Öldürme',0,s.k)+rows('Metin',1,s.m)+rows('Boss',2,s.b)+'<div class="stat"><b>Bu ay</b></div>'
    +'<div class="stat"><span>Seviye</span><span><b>'+player.level+'</b> • #'+(1+SNB.filter((_,i)=>Math.round(10+hsh(monthN(),i+50)*30)>player.level).length)+'</span></div><div class="stat"><span>Arena</span><span><b>'+player.arena+'</b> • #'+(1+BOTS.filter(b=>b[1]>player.arena).length)+'</span></div>'
    +'<div class="stat"><b>Profil / Unvanlar</b></div><div class="stat"><span>'+player.name+' Lv'+player.level+(clanO()?' • ['+clanO().tag+']':'')+'</span><span>Kule: '+(META().tw?META().tw.best:0)+'</span></div>';
  h+=t.length?t.map(x=>btn('title',(META().title===x?'✓ ':'')+x,'data-t="'+x+'"')).join(' ')+btn('title','Unvansız','data-t=""'):'<div class="stat"><span style="color:#9a8a68">Haftalık ilk 10 sıraya girince unvan kazanırsın.</span></div>';
  pbody(snP).innerHTML=h;}
menuBtn('snBtn','🏆',()=>{if(!player.cls)return;if(snP.classList.contains('open'))snP.classList.remove('open');else{closePanels();snP.classList.add('open');snRender();}});
snP.addEventListener('click',e=>{const t=e.target.closest('[data-act=title]');if(!t)return;META().title=t.dataset.t||null;clanLabel();saveGame();snRender();});
window.__g11={brArr,kwStart,kwEnd,kwO,kwActive,clanO,clanWar,clanXp,seasonO,snRank,EKEYS,elemProc:()=>elemProc};

// ===== g12: maden, pet çiftliği, hikâye, kostüm, silah efekti =====
const wait2=(f,ms)=>setTimeout(f,ms);

// ---------- Maden kazma ----------
const ORES={iron:{n:'Demir',i:'⬛',c:0x8a8a94,t:0},copper:{n:'Bakır',i:'🟧',c:0xc2733a,t:0},gold:{n:'Altın',i:'🟨',c:0xf0c030,t:2},mith:{n:'Mitril',i:'🟦',c:0x66ccff,t:3}};
const ZORE={forest:['iron','copper'],desert:['copper','gold'],snow:['gold','mith'],swamp:['iron','mith']};
const ZC={forest:[0,1],desert:[1,0],snow:[0,-1],swamp:[-1,0]};
const oreBag=()=>META().ores||(META().ores={iron:0,copper:0,gold:0,mith:0});
const pickT=()=>META().pick||0;
const PICKP=[600,1500,3500,7000,15000];
SHOP.push({id:'pick',n:'Kazma',d:'Daha iyi kazma = kolay maden (Lv1-5)',p:600,i:'⛏'});
{const _b3=buy;buy=function(id){if(id==='pick'){const t=pickT();if(t>=5){showMsg('Kazman zaten en iyisi!');return;}const c=PICKP[t];if(player.yang<c){showMsg('Yetersiz Yang: '+c);return;}player.yang-=c;META().pick=t+1;sfx('buy');showMsg('⛏ Kazma Lv '+(t+1));SHOP.find(x=>x.id==='pick').p=PICKP[Math.min(4,t+1)];updateHUD();saveGame();renderNpc();return;}return _b3(id);};}
const oreNodes=[];
for(const z in ZORE){for(let i=0;i<5;i++){const a=(ZC[z][0]?(ZC[z][0]>0?0:Math.PI):(ZC[z][1]>0?Math.PI/2:-Math.PI/2))+(hsh(i,z.length*17)-.5)*1.3,r=48+hsh(i+9,z.length)*60,x=Math.cos(a)*r,zz=Math.sin(a)*r,k=ZORE[z][i%2];
  const m=new THREE.Mesh((THREE.DodecahedronGeometry?new THREE.DodecahedronGeometry(.7):new THREE.BoxGeometry(1,1,1)),new THREE.MeshLambertMaterial({color:ORES[k].c}));m.position.set(x,.5,zz);scene.add(m);oreNodes.push({m,x,z:zz,k,until:0});}}
const mineBtn=mkEl('⛏ Kaz','position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:22;display:none;padding:10px 20px;border-radius:10px;border:2px solid #c99a3a;background:linear-gradient(180deg,#6a5a3a,#3a2a14);color:#fff;font-size:14px');
const mineP=mkEl('','position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:70;display:none;width:min(88vw,300px);background:rgba(20,14,6,.95);border:2px solid #c99a3a;border-radius:12px;padding:12px;color:#ffe9b0;font-size:13px;text-align:center');
let mine={node:null,seq:[],i:0,t:0,on:false};
const nearNode=()=>{const pp=player.group.position;return oreNodes.find(n=>n.until<Date.now()&&Math.hypot(n.x-pp.x,n.z-pp.z)<3.8);};
setInterval(()=>{if(!player.cls||!player.alive||dungeon||duel){mineBtn.style.display='none';return;}const n=nearNode();mineBtn.style.display=(n&&!mine.on)?'block':'none';if(!n&&mine.on)mineEnd(false,true);
  for(const o of oreNodes){const v=o.until<Date.now();if(o.m.visible!==v)o.m.visible=v;}},300);
function mineStart(){const n=nearNode();if(!n||mine.on)return;if(pickT()<1){showMsg('Önce bir kazma al (Tüccar Selim).');return;}if(ORES[n.k].t>pickT()){showMsg(ORES[n.k].n+' için Kazma Lv '+ORES[n.k].t+' gerekir.');return;}
  mine={node:n,seq:Array.from({length:4},()=>'ABCD'[Math.floor(Math.random()*4)]),i:0,t:Math.max(2.2,7-pickT()*.9),on:true};mineRender();}
function mineRender(){const s=mine.seq.map((c,i)=>'<span style="font-size:20px;margin:2px;'+(i<mine.i?'color:#6f6':i===mine.i?'color:#ff8;text-decoration:underline':'')+'">'+c+'</span>').join('');
  mineP.style.display='block';mineP.innerHTML='<b>⛏ '+ORES[mine.node.k].n+' Yatağı</b><div style="margin:6px 0">Harfleri sırayla bas!</div><div>'+s+'</div><div id="mT" style="margin:4px 0;font-size:11px">'+mine.t.toFixed(1)+' sn</div>'+'ABCD'.split('').map(c=>'<button data-m="'+c+'" style="font-size:18px;margin:3px;padding:8px 14px">'+c+'</button>').join('');}
function mineEnd(ok,quiet){if(!mine.on)return;mine.on=false;mineP.style.display='none';if(ok){const k=mine.node.k,n=1+(Math.random()<.35?1:0)+(pickT()>=4&&Math.random()<.3?1:0);oreBag()[k]+=n;mine.node.until=Date.now()+180000;sfx('level');showMsg(ORES[k].i+' '+ORES[k].n+' ×'+n);saveGame();}else if(!quiet){showMsg('Kazma boşa gitti...');sfx('miss');}}
mineP.addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b||!mine.on)return;if(b.dataset.m===mine.seq[mine.i]){mine.i++;if(mine.i>=mine.seq.length)mineEnd(true);else mineRender();}else{mine.t-=1;sfx('miss');mineRender();}});
setInterval(()=>{if(!mine.on)return;mine.t-=.1;const e=mineP.querySelector('#mT');if(e)e.textContent=Math.max(0,mine.t).toFixed(1)+' sn';if(mine.t<=0)mineEnd(false);},100);
mineBtn.onclick=mineStart;
// cevher takviyesi (demirci)
const ORECOST={iron:3,copper:2,gold:1,mith:1};
{const _ug=upgradeItem;upgradeItem=function(it,b){const bst=META().oreBoost||0,i=it.up,orig=UP_RATE[i];if(bst&&i<UP_RATE.length)UP_RATE[i]=Math.min(1,orig+bst);let r;try{r=_ug(it,b);}finally{if(i<UP_RATE.length)UP_RATE[i]=orig;}if(r&&r.res&&bst){META().oreBoost=0;showMsg('Cevher takviyesi kullanıldı.');}return r;};}
{const _rn6=renderNpc;renderNpc=function(){_rn6();if(!npcCur||npcCur.t!=='smith')return;const o=oreBag(),m=META();let h='<div class="stat"><b>⛏ Cevherler</b></div><div class="stat">'+Object.keys(ORES).map(k=>ORES[k].i+' '+ORES[k].n+' ×'+o[k]).join(' • ')+'</div>'
  +'<div class="stat"><span>Takviye: sonraki geliştirmede +%10 başarı'+(m.oreBoost?' <b>(aktif)</b>':'')+'</span>'+btn('oreup','Dök ('+Object.keys(ORECOST).map(k=>ORECOST[k]+ORES[k].i).join(' ')+')','',!!m.oreBoost||Object.keys(ORECOST).some(k=>o[k]<ORECOST[k]))+'</div>';$('npcBody').innerHTML+=h;};}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act=oreup]');if(!t)return;const o=oreBag();if(META().oreBoost||Object.keys(ORECOST).some(k=>o[k]<ORECOST[k]))return;Object.keys(ORECOST).forEach(k=>o[k]-=ORECOST[k]);META().oreBoost=.1;sfx('level');showMsg('Cevher takviyesi hazır (+%10).');saveGame();renderNpc();});

// ---------- Pet çiftliği ----------
addNpc({id:'pfarm',n:'Çiftlik Ustası',x:14,z:8,tint:0x7a5a2a,cls:'okcu',t:'pfarm'});
const farmSel=new Set();
function pfarmRender(){let h='<div class="stat" style="display:block;font-size:11px">İki pet seç ve çiftleştir (2000 Yang). Yavru ebeveynlerden birinin türünde olur, %8 ihtimalle nadir mutasyon. Ebeveynler 10 dk dinlenir. Kolye (1500 Yang): pet bonusu +%25.</div>';
  if(!player.pets.length)h+='<div class="stat"><span style="color:#9a8a68">Hiç petin yok.</span></div>';
  for(const p of player.pets){const P=PETS[p.k],cd=(p.bc||0)>Date.now();h+='<div class="stat"><span>'+(farmSel.has(p.id)?'☑ ':'☐ ')+P.n+' <small>Lv'+p.lv+' • renk '+((p.v||0)+1)+(p.gear?' • 📿':'')+(cd?' • dinleniyor':'')+'</small></span><span>'+btn('pfsel','Seç','data-id="'+p.id+'"')+(p.gear?'':btn('pfgear','📿','data-id="'+p.id+'"',player.yang<1500))+'</span></div>';}
  h+=btn('pfbreed','🥚 Çiftleştir (2000💰)','',farmSel.size!==2||player.yang<2000||player.pets.length>=8)+btn('pfbattle','⚔ Pet savaşı (aktif pet)','',!activePet());
  $('npcBody').innerHTML=h;}
{const _rn7=renderNpc;renderNpc=function(){_rn7();if(npcCur&&npcCur.t==='pfarm')pfarmRender();else if(npcCur&&npcCur.t==='story')storyRender();else if(npcCur&&npcCur.t==='cost')costRender();};}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act;
  if(a==='pfsel'){const id=+t.dataset.id;if(farmSel.has(id))farmSel.delete(id);else{if(farmSel.size>=2)farmSel.clear();farmSel.add(id);}pfarmRender();}
  else if(a==='pfgear'){const p=player.pets.find(x=>x.id===+t.dataset.id);if(!p||p.gear||player.yang<1500)return;player.yang-=1500;p.gear=1;sfx('level');recalcStats();updateHUD();saveGame();pfarmRender();}
  else if(a==='pfbreed'){const ps=[...farmSel].map(id=>player.pets.find(x=>x.id===id)).filter(Boolean);if(ps.length!==2||player.yang<2000||player.pets.length>=8)return;if(ps.some(p=>(p.bc||0)>Date.now())){showMsg('Pet dinleniyor.');return;}
    player.yang-=2000;const mut=Math.random()<.08,k=mut?PETKEYS[Math.floor(Math.random()*PETKEYS.length)]:ps[Math.floor(Math.random()*2)].k,v=mut?Math.floor(Math.random()*5):ps[Math.floor(Math.random()*2)].v||0;
    player.pets.push({id:++petIdC,k,lv:1,xp:0,v});ps.forEach(p=>p.bc=Date.now()+600000);farmSel.clear();showMsg('🥚 Yavru doğdu: '+PETS[k].n+(mut?' (MUTASYON!)':''));sfx('level');updateHUD();saveGame();pfarmRender();}
  else if(a==='pfbattle'){const p=activePet();if(!p)return;const pw=x=>20+x.lv*8+(x.gear?10:0)+(PETS[x.k].bon.atk||0)*2+(PETS[x.k].bon.crit||0)*2;let w=0;const foe={lv:Math.max(1,p.lv+Math.floor(Math.random()*5)-2),k:PETKEYS[Math.floor(Math.random()*PETKEYS.length)]};
    for(let r=0;r<3;r++){const a1=pw(p)*(.7+Math.random()*.6),b1=pw(foe)*(.7+Math.random()*.6);const win=a1>=b1;if(win)w++;wait2(()=>chat('[Pet Savaşı] Tur '+(r+1)+': '+(win?PETS[p.k].n+' kazandı':PETS[foe.k].n+' kazandı'),'#fc8'),500*(r+1));}
    wait2(()=>{if(w>=2){const y=300+p.lv*30;player.yang+=y;showMsg('🐾 Pet savaşı kazanıldı! +'+y+' Yang');}else showMsg('Pet savaşını kaybettin.');updateHUD();saveGame();},2000);}
});

// ---------- Hikâye ----------
addNpc({id:'story',n:'Bilge Kadir',x:14,z:-6,tint:0x6a6aa0,cls:'saman',t:'story'});
const STORY=[
 {t:'Köy Baskınından Dönüş',lv:5,boss:'boss_cave',bn:'Akıncı Başı',rw:1500,
  d:[['🧙','Bilge Kadir','Evlat, köyümüz bir baskın atlattı. Ama saldıranlar hâlâ yakınlarda dolaşıyor.'],['🛡','Muhafız','Akıncıların başı mağaralarda saklanıyor. Eşyalarımızı geri almalıyız.'],['🧙','Bilge Kadir','Sana güveniyorum. Silahını kuşan ve Akıncı Başı\'nı bul.'],['🛡','Muhafız','Dikkatli ol, yanında epey adamı vardır.'],['🧙','Bilge Kadir','Haydi, köyün kaderi senin ellerinde!']],
  e:[['🛡','Muhafız','Başardın! Akıncı Başı\'ndan bir mektup düştü... Ork Reisi\'nden bahsediyor.']]},
 {t:'Ork Reisi\'nin Mektubu',lv:10,boss:'boss_forest',bn:'Ork Reisi',rw:3000,
  d:[['🧙','Bilge Kadir','Mektupta Ork Reisi\'nin bütün kabileleri birleştirdiği yazıyor.'],['📜','Mektup','"Metin taşlarının gücünü ele geçirip krallıkları yıkacağız."'],['🧙','Bilge Kadir','Onu orman derinliklerinde bulabilirsin.'],['🛡','Muhafız','Ork Reisi çok güçlüdür; iksirlerini yanına al.'],['🧙','Bilge Kadir','Onu durdur, yoksa metinler uyanacak.']],
  e:[['🧙','Bilge Kadir','Ork Reisi düştü. Ama o sadece bir piyondu... Kuzeyde Buz Ejderi uyanıyor.']]},
 {t:'Buz Ejderi\'nin Sırrı',lv:15,boss:'boss_snow',bn:'Buz Ejderi',rw:5000,
  d:[['🧙','Bilge Kadir','Buz Ejderi yüzyıllardır uyuyordu. Metin taşları onu uyandırdı.'],['🐉','Ejder\'in Sesi','"Ben bekçiyim... Karanlık General\'in mührünü korurum."'],['🧙','Bilge Kadir','Demek mühür onun elinde! Ejderi yenmeliyiz.'],['🛡','Muhafız','Kar fırtınasına hazırlıklı git.'],['🧙','Bilge Kadir','Buzul Vadisi seni bekliyor.']],
  e:[['🐉','Ejder','Haklısın, ölümlü... Şeytan Kulesi\'nin kökeni mührün parçasındadır.']]},
 {t:'Şeytan Kulesi\'nin Kökeni',lv:20,boss:'boss_sohan',bn:'Kule Efendisi',rw:8000,
  d:[['🧙','Bilge Kadir','Kule, eski bir krallığın mühür tapınağıymış.'],['📜','Eski Yazıt','"Her kat bir mührü, her mühür bir lanetle bağlı."'],['🧙','Bilge Kadir','Kule Efendisi bu lanetlerin bekçisi oldu.'],['🛡','Muhafız','Sohan\'ın gölgesi çok güçlü, birlikte hareket et.'],['🧙','Bilge Kadir','Lanetleri kır, mührü kurtar.']],
  e:[['🧙','Bilge Kadir','Lanetler zayıfladı. Ama Karanlık General intikam için geliyor...']]},
 {t:'Karanlık General\'in İntikamı',lv:25,boss:'boss_swamp',bn:'Karanlık General',rw:15000,
  d:[['🧙','Bilge Kadir','Karanlık General bataklıkta ordusunu topladı.'],['👹','Karanlık General','"Mühürsüz kaldım ama gücüm tamam! Köyünüzü yakacağım!"'],['🛡','Muhafız','Bu son savaş, kahraman. Hepimiz seninle.'],['🧙','Bilge Kadir','Tüm gücünü topla ve bataklığa git.'],['🧙','Bilge Kadir','Efsane olmak senin elinde!']],
  e:[['🧙','Bilge Kadir','Köy kurtuldu! Sen artık bir efsanesin.']]}];
const storyO=()=>{const m=META();return m.story||(m.story={ch:0,live:0});};
const dlg=mkEl('','position:fixed;inset:0;z-index:90;display:none;background:rgba(0,0,0,.6);align-items:flex-end;justify-content:center');
let dlgQ=[],dlgCb=null;
function dlgShow(q,cb){dlgQ=q.slice();dlgCb=cb;dlg.style.display='flex';dlgNext(true);}
function dlgNext(first){if(!dlgQ.length){dlg.style.display='none';const c=dlgCb;dlgCb=null;if(c)c();return;}const l=dlgQ.shift();
  dlg.innerHTML='<div style="width:min(96vw,420px);margin-bottom:16px;background:rgba(30,20,8,.96);border:2px solid #c99a3a;border-radius:12px;padding:12px;color:#ffe9b0;display:flex;gap:10px;align-items:center"><div style="font-size:44px">'+l[0]+'</div><div style="flex:1"><b>'+l[1]+'</b><div style="font-size:13px;margin-top:4px">'+l[2]+'</div></div></div><div style="position:absolute;bottom:40%;font-size:12px;color:#ccc"></div>';
  dlg.firstChild.insertAdjacentHTML('beforeend','<div style="font-size:11px;color:#c9b88a;align-self:flex-end">▶</div>');}
dlg.onclick=()=>dlgNext();
function storyBossSpawn(ch){const S=STORY[ch],pp=player.group.position,a=Math.random()*6.28;
  const e=new Enemy(new THREE.Vector3(pp.x+Math.cos(a)*18,0,pp.z+Math.sin(a)*18),S.boss,Math.max(S.lv,player.level),{dg:true});e.name=S.bn;e.storyCh=ch+1;e.state='chase';e.provoked=true;if(e.label)e.label.textContent='📖 '+S.bn+' Lv'+e.lv;enemies.push(e);showMsg('📖 '+S.bn+' belirdi!');sfx('die');storyO().live=ch+1;}
function storyRender(){const s=storyO();let h='';
  STORY.forEach((c,i)=>{const done=i<s.ch,cur=i===s.ch;h+='<div class="stat"><span>'+(done?'✔ ':cur?'▶ ':'🔒 ')+'Bölüm '+(i+1)+': '+c.t+' <small>(Lv '+c.lv+')</small></span></div>';});
  if(s.ch>=STORY.length)h+='<div class="stat"><b>Hikâye tamamlandı! Efsane unvanı kazandın.</b></div>';
  else{const c=STORY[s.ch];h+=btn('stgo',s.live?'📖 Boss\'u yeniden çağır':'📖 Bölümü başlat','',player.level<c.lv||dungeon);if(player.level<c.lv)h+='<div class="stat"><span style="color:#f88">Seviye '+c.lv+' gerekli.</span></div>';}
  $('npcBody').innerHTML=h;}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act=stgo]');if(!t)return;const s=storyO();if(s.ch>=STORY.length||player.level<STORY[s.ch].lv)return;
  if(enemies.some(x=>x.storyCh&&!x.dead)){showMsg('Boss zaten sahada.');return;}closePanels();
  if(s.live)storyBossSpawn(s.ch);else dlgShow(STORY[s.ch].d,()=>storyBossSpawn(s.ch));});
{const _ds=Enemy.prototype.die;Enemy.prototype.die=function(){const ch=this.storyCh;_ds.call(this);if(!ch)return;const s=storyO(),S=STORY[ch-1];if(s.ch!==ch-1)return;s.ch=ch;s.live=0;
  setTimeout(()=>dlgShow(S.e,()=>{player.yang+=S.rw;const it=makeItem(player.level+3,3);giveItem(it);player.mats.eshard=(player.mats.eshard||0)+2;showMsg('📖 Bölüm '+ch+' tamam! +'+S.rw+' Yang, '+it.name);chat('Hikâye ödülü: '+it.name+' + 2 🔷','#fd6');
    if(ch===STORY.length){META().titles=Array.from(new Set((META().titles||[]).concat(['Efsane'])));chat('Yeni unvan: Efsane','#fd6');}updateHUD();saveGame();}),1800);};}

// ---------- Kostümler ----------
const CK={helm:['Boynuz','Taç','Halo','Tüy','Sivri Şapka','Kedi Kulağı','Alev Tacı'],cape:['Pelerin','Kızıl Pelerin','Kraliyet Pelerini','Gölge Pelerini','Orman Pelerini','Buz Pelerini','Altın Pelerin'],wing:['Kelebek Kanadı','Melek Kanadı','Şeytan Kanadı','Kristal Kanat','Alev Kanadı','Gölge Kanadı','Altın Kanat']};
const CCOL=[0xcccccc,0x44bb66,0x4488ff,0xcc55ff,0xff9933,0xff4444,0xffd24a];
const CST=['atk','def','hp','crit','spd','xp','yang'],CSN={atk:'Saldırı +%5',def:'Savunma +%5',hp:'Can +%5',crit:'Kritik +%2',spd:'Hız +%5',xp:'Tecrübe +%5',yang:'Yang +%5'};
const COSTS=[];['helm','cape','wing'].forEach(sl=>CK[sl].forEach((n,i)=>COSTS.push({id:sl+i,n,sl,r:Math.min(3,Math.floor(i/2)),col:CCOL[i],st:CST[(i+(sl==='cape'?2:sl==='wing'?4:0))%7]})));
const CPR=[1000,3000,8000,20000],CRN=['Sıradan','Nadir','Destansı','Efsanevi'];
const cosO=()=>{const m=META();return m.cos||(m.cos={own:[],worn:{}});};
addNpc({id:'cost',n:'Kostümcü Ayşe',x:-14,z:-8,tint:0xc05a9a,cls:'ninja',t:'cost'});
function costRender(){const c=cosO();let h='<div class="stat" style="display:block;font-size:11px">Kostümler görsel + küçük bonus verir. Her boşlukta (başlık, pelerin, kanat) bir kostüm giyilir.</div>';
  COSTS.forEach(k=>{const own=c.own.includes(k.id),on=c.worn[k.sl]===k.id;h+='<div class="stat"><span style="color:'+RC[k.r]+'">'+k.n+' <small>('+k.sl+' • '+CRN[k.r]+' • '+CSN[k.st]+')</small></span>'+(own?btn('cwear',on?'Çıkar':'Giy','data-id="'+k.id+'"'):btn('cbuy',CPR[k.r]+'💰','data-id="'+k.id+'"',player.yang<CPR[k.r]))+'</div>';});
  $('npcBody').innerHTML=h;}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,c=cosO(),k=COSTS.find(x=>x.id===t.dataset.id);
  if(a==='cbuy'&&k&&!c.own.includes(k.id)&&player.yang>=CPR[k.r]){player.yang-=CPR[k.r];c.own.push(k.id);sfx('buy');updateHUD();saveGame();costRender();}
  else if(a==='cwear'&&k&&c.own.includes(k.id)){if(c.worn[k.sl]===k.id)delete c.worn[k.sl];else c.worn[k.sl]=k.id;sfx('pot');recalcStats();rebuildPlayer();saveGame();costRender();}});
{const _rc6=recalcStats;recalcStats=function(){_rc6();if(!player.cls)return;const w=cosO().worn;for(const sl in w){const k=COSTS.find(x=>x.id===w[sl]);if(!k)continue;
  if(k.st==='atk')player.baseDmg*=1.05;else if(k.st==='def')player.defPct+=5;else if(k.st==='hp')player.maxHp=Math.round(player.maxHp*1.05);else if(k.st==='crit')player.crit=clamp(player.crit+2,0,65);else if(k.st==='spd')player.speed*=1.05;else player.bon[k.st]=(player.bon[k.st]||0)+5;}
  player.hp=Math.min(player.hp,player.maxHp);};}
function costMesh(k){const g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:k.col}),em=new THREE.MeshBasicMaterial({color:k.col}),i=CK[k.sl].indexOf(k.n),B=()=>new THREE.Mesh(G.box,m);
  if(k.sl==='helm'){if(i===0||i===5){for(const s of[-1,1]){const h=B();h.scale.set(.1,.3,.1);h.position.set(.18*s,1.95,0);h.rotation.z=-.4*s;g.add(h);}}
    else if(i===1){const h=B();h.scale.set(.42,.14,.42);h.position.y=1.93;g.add(h);for(let j=0;j<4;j++){const p=B();p.scale.set(.07,.14,.07);p.position.set(Math.cos(j*1.57)*.17,2.05,Math.sin(j*1.57)*.17);g.add(p);}}
    else if(i===2){const h=new THREE.Mesh((THREE.TorusGeometry?new THREE.TorusGeometry(.22,.03,6,14):G.box),em);h.rotation.x=Math.PI/2;h.position.y=2.1;g.add(h);}
    else if(i===3){const h=B();h.scale.set(.06,.5,.2);h.position.set(0,2.0,-.05);g.add(h);}
    else if(i===4){const h=B();h.scale.set(.3,.5,.3);h.position.y=2.08;g.add(h);}
    else{const h=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),em);h.position.y=2.1;g.add(h);}}
  else if(k.sl==='cape'){const h=B();h.scale.set(.5,.95,.04);h.position.set(0,1.1,-.24);h.rotation.x=.12;g.add(h);}
  else{for(const s of[-1,1]){const h=B();h.scale.set(.75,.55,.04);h.position.set(.5*s,1.35,-.25);h.rotation.z=.5*s;g.add(h);}}
  return g;}
// ---------- Silah efektleri + kostüm yeniden takma ----------
let wfx=null;
{const _rp2=rebuildPlayer;rebuildPlayer=function(){_rp2();wfx=null;try{const hb=player.group.children[0];if(!hb)return;const w=cosO().worn;for(const sl in w){const k=COSTS.find(x=>x.id===w[sl]);if(k)hb.add(costMesh(k));}
  const wp=player.equipped&&player.equipped.weapon;if(wp&&wp.up>=7){const gm=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:wp.el==='ice'?0x88ddff:wp.el==='poison'?0x88ff44:0xffbb55}));gm.position.set(.5,1.0,.35);hb.add(gm);wfx={up:wp.up,el:wp.el,gm};
    if(wp.up>=12&&THREE.RingGeometry){const rg=new THREE.Mesh(new THREE.RingGeometry(.9,1.05,24),new THREE.MeshBasicMaterial({color:0xffd24a,side:THREE.DoubleSide}));rg.rotation.x=-Math.PI/2;rg.position.y=.05;hb.add(rg);wfx.ring=rg;}}}catch(e){}};}
setInterval(()=>{if(!wfx||!player.alive||!player.cls)return;const c=wfx.el==='ice'?0x88ddff:wfx.el==='poison'?0x88ff44:wfx.el==='fire'?0xff6a22:0xcc2222;const p=player.group.position.clone();
  if(wfx.up>=10&&Math.random()<(wfx.up>=15?1:.35)){p.y=1.1;spawnBurst(p,c);}},250);
{const _uf=update;update=function(dt){_uf(dt);if(wfx&&wfx.ring)wfx.ring.rotation.z+=dt*2;if(wfx&&wfx.gm)wfx.gm.scale.setScalar(1+Math.sin(performance.now()/200)*.25);};}
window.__g12={ORES,oreBag,oreNodes,mineStart,STORY,storyO,storyBossSpawn,COSTS,cosO,farmSel,dlgNext,mine:()=>mine};

// ===== g13: at (takipçi + hediye), gamepad, Rüya Alemi, bestiary, unvan, asker, meyhane, hazine, hortlak, dünya boss botları =====
Object.assign(OPT,Object.assign({autoOnlyMetin:false,autoAvoidBoss:false,potPct:30},JSON.parse(localStorage.getItem('m2_opt')||'{}')));

// ---------- AT: herkese hediye + yanında dolaşan at ----------
setInterval(()=>{if(player.cls&&!player.horse){player.horse=true;showMsg('🐎 Sana bir at hediye ettik! Sağdaki 🐎 düğmesiyle bin.');chat('At hediye edildi: 🐎 düğmesine bas ve bin!','#fd6');saveGame();}},2000);
let sHorse=null,shMoving=false;
function shEnsure(){if(sHorse||!player.cls)return;try{sHorse=buildHorse();}catch(e){sHorse=null;return;}if(!sHorse)return;sHorse.visible=false;sHorse.position.set(player.group.position.x-3,0,player.group.position.z-3);scene.add(sHorse);}
function shAnim(want,dt){const hm=sHorse.userData.horse;if(!hm)return;if(want!==hm.cur){want.reset().play();hm.cur.crossFadeTo(want,.25,false);hm.cur=want;}hm.mixer.update(dt);}
{const _uh=update;update=function(dt){_uh(dt);gpPoll(dt);
  if(!player.cls||!player.horse)return;shEnsure();if(!sHorse)return;
  const show=!player.mounted&&!dungeon&&player.alive;sHorse.visible=show;if(!show){if(player.mounted)sHorse.position.set(player.group.position.x,0,player.group.position.z);return;}
  const pp=player.group.position,dx=pp.x-sHorse.position.x,dz=pp.z-sHorse.position.z,d=Math.hypot(dx,dz);
  if(d>40){sHorse.position.set(pp.x-3,0,pp.z-3);}
  else if(d>4.2||(shMoving&&d>3)){shMoving=true;const sp=Math.min(18,Math.max(5.5,d*.9));sHorse.position.x+=dx/d*sp*dt;sHorse.position.z+=dz/d*sp*dt;sHorse.rotation.y=Math.atan2(dx,dz);}
  else shMoving=false;
  const hm=sHorse.userData.horse;if(hm)shAnim(shMoving?(d>9?hm.A.run:hm.A.walk):hm.A.idle,dt);};}
// tanı satırı + makro ayarları
{const sb=$('saveOut');if(sb){const w=document.createElement('div');w.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px;margin:4px 0';
  w.innerHTML='<b>🤖 Otomatik Av Pro</b><label><input type="checkbox" id="optOM"> Sadece metin taşlarına saldır</label><label><input type="checkbox" id="optAB"> Boss/elit canavarlardan uzak dur</label>'
   +'<label>İksir eşiği: <select id="optPP"><option value="20">%20</option><option value="30">%30</option><option value="50">%50</option></select></label><div id="diagTxt" style="font-size:10.5px;color:#c9b88a"></div>';
  sb.parentNode.insertBefore(w,sb);$('optOM').checked=!!OPT.autoOnlyMetin;$('optAB').checked=!!OPT.autoAvoidBoss;$('optPP').value=String(OPT.potPct);
  $('optOM').onchange=e=>{OPT.autoOnlyMetin=e.target.checked;saveOpt();};$('optAB').onchange=e=>{OPT.autoAvoidBoss=e.target.checked;saveOpt();};$('optPP').onchange=e=>{OPT.potPct=+e.target.value;saveOpt();};
  setInterval(()=>{const d=$('diagTxt');if(!d)return;const hm=!!(MODELS.at&&MODELS.at.Horse),rh=!!(sHorse&&sHorse.userData.horse);
    d.textContent='Modeller: kahraman '+(MODELS.hero?'✔':'✘')+' • canavar '+Object.keys(MODELS.mon).length+' • at '+(hm?(rh?'✔ gerçek':'✔ yüklendi (kutu at)'):'✘ kutu at')+(MODELS.msg?' • '+MODELS.msg:'')+(PACK_ERR.length?' • '+PACK_ERR[0]:'');},2000);}}

// ---------- Gamepad ----------
let gpOn=false,gpPrev=[];
function gpPoll(dt){const gps=navigator.getGamepads?navigator.getGamepads():[];let g=null;for(const x of gps)if(x&&x.connected){g=x;break;}
  if(!g){if(gpOn){gpOn=false;if(!joy.active){joy.x=0;joy.y=0;}}return;}if(!player.cls||!player.alive)return;
  const ax=g.axes[0]||0,ay=g.axes[1]||0;if(!joy.active){if(Math.hypot(ax,ay)>.22){joy.x=ax;joy.y=-ay;gpOn=true;}else if(gpOn){joy.x=0;joy.y=0;gpOn=false;}}
  const rx=g.axes[2]||0;if(Math.abs(rx)>.25)cameraYaw-=rx*dt*2.6;
  const b=i=>!!(g.buttons[i]&&g.buttons[i].pressed),edge=i=>b(i)&&!gpPrev[i];
  if(b(0)&&player.atkCd<=0)doAttack();
  if(edge(2))useSkill(0);if(edge(3))useSkill(1);if(edge(1))useSkill(2);if(edge(5))useSkill(3);if(edge(4))usePot('hp');if(edge(6))usePot('mp');if(edge(7))triggerDodge();if(edge(9))toggleMount();if(edge(8)&&auto.tgt)autoStop();
  gpPrev=g.buttons.map(x=>x.pressed);}

// ---------- Hortlaklar (gece) ----------
let ghosts=[];
setInterval(()=>{if(!player.cls||!player.alive||dungeon||duel)return;ghosts=ghosts.filter(e=>!e.dead);const pp=player.group.position,n=nightAmt();
  if(n<.3){ghosts.forEach(e=>e.remove());ghosts=[];return;}
  if(n>.6&&zoneAt(pp.x,pp.z)!=='village'&&ghosts.length<3&&Math.random()<.45){const a=Math.random()*6.28,e=new Enemy(new THREE.Vector3(pp.x+Math.cos(a)*22,0,pp.z+Math.sin(a)*22),'skel',Math.max(1,player.level),{});
    e.name='Hortlak';e.ghost=true;e.maxHp=Math.round(e.maxHp*1.4);e.hp=e.maxHp;e.dmg=Math.round(e.dmg*1.2);e.provoked=true;e.state='chase';if(e.label)e.label.textContent='👻 Hortlak Lv'+e.lv;enemies.push(e);ghosts.push(e);showMsg('👻 Gece: Hortlak belirdi!');}},4000);

// ---------- Canavar Kitabı ----------
const BSN=[50,150,400],BSP=[3,6,10];
const bsO=()=>META().bs||(META().bs={});
const bsTier=k=>{const c=bsO()[k]||0;return c>=BSN[2]?3:c>=BSN[1]?2:c>=BSN[0]?1:0;};
const bsBonus=k=>{const t=bsTier(k);return t?BSP[t-1]/100:0;};
{const _td5=Enemy.prototype.takeDamage;Enemy.prototype.takeDamage=function(a,c,o){const b=this.spk?bsBonus(this.spk):0;return _td5.call(this,b?Math.round(a*(1+b)):a,c,o);};}
{const _dp5=damagePlayer;damagePlayer=function(n,src){const b=src&&src.spk?bsBonus(src.spk):0;return _dp5(b?Math.round(n*(1-b)):n,src);};}
const bsP=mkPanel('bsPanel','📖 CANAVAR KİTABI');
function bsRender(){const bs=bsO();let h='<div style="font-size:11px;color:#c9b88a">50/150/400 kesimde o türe karşı kalıcı +%3/+%6/+%10 hasar ve aynı oranda daha az hasar alırsın.</div>';
  Object.keys(bs).sort((a,b)=>bs[b]-bs[a]).forEach(k=>{if(!SP[k])return;const t=bsTier(k),nx=BSN[t]||null;h+='<div class="stat"><span>'+SP[k].n+' <small>×'+bs[k]+(nx?' / '+nx:' (MAX)')+'</small></span><span>'+(t?'+%'+BSP[t-1]:'—')+'</span></div>';});
  if(!Object.keys(bs).length)h+='<div class="stat"><span style="color:#9a8a68">Henüz kayıt yok.</span></div>';pbody(bsP).innerHTML=h;}
menuBtn('bsBtn','📖',()=>{if(!player.cls)return;if(bsP.classList.contains('open'))bsP.classList.remove('open');else{closePanels();bsP.classList.add('open');bsRender();}});
{const _d6=Enemy.prototype.die;Enemy.prototype.die=function(){const spk=this.spk,iM=this.isMetin,gh=this.ghost,pos=this.mesh.position.clone();_d6.call(this);if(iM||!spk||!player.cls)return;const bs=bsO();bs[spk]=(bs[spk]||0)+1;
  if(gh){player.yang+=100+player.level*10;if(Math.random()<.3)dropItem(pos,1,player.level);}
  if(Math.random()<.012){META().maps=(META().maps||0)+1;showMsg('🗺 Eski Parşömen buldun!');chat('Eski Parşömen: ⛏ Hazine haritası (🗺 düğmesi)','#fd6');}};}

// ---------- Unvanlar (başarımlardan) ----------
const TDEF=[['Ejderha Katili',()=>player.stats.bosses>=10],['Usta Madenci',()=>Object.values(META().ores||{}).reduce((a,b)=>a+b,0)>=40],['Gölge Yürüyen',()=>player.stats.dungeons>=5],['Kule Fatihi',()=>META().tw&&META().tw.best>=20],['Hikâye Anlatıcısı',()=>META().story&&META().story.ch>=5],['Efsanevi Balıkçı',()=>META().fishLeg],['Avcı Reisi',()=>Object.values(META().bs||{}).reduce((a,b)=>a+b,0)>=500]];
setInterval(()=>{if(!player.cls)return;const m=META(),t=new Set(m.titles||[]);let add=false;TDEF.forEach(d=>{try{if(!t.has(d[0])&&d[1]()){t.add(d[0]);add=true;showMsg('🏅 Yeni unvan: '+d[0]);chat('Yeni unvan: '+d[0]+' (🏆 menüsü)','#fd6');}}catch(e){}});
  try{ACH.forEach(a=>{if(a.t&&a.t()&&!t.has(a.n)){t.add(a.n);add=true;}});}catch(e){}if(add){m.titles=[...t];saveGame();}},4000);
{const _rc7=recalcStats;recalcStats=function(){_rc7();if(!player.cls)return;if(META().title){player.baseDmg*=1.02;player.defPct+=2;}};}

// ---------- Paralı Asker (Savaşçı) ----------
addNpc({id:'merc',n:'Paralı Asker Cevat',x:-14,z:4,tint:0x8a4a2a,cls:'savasci',t:'merc'});
const mercO=()=>{const m=META();return m.merc||(m.merc={own:false});};
let mercMesh=null,mercT=0;
{const _rn8=renderNpc;renderNpc=function(){_rn8();if(npcCur&&npcCur.t==='merc'){const o=mercO();$('npcBody').innerHTML='<div class="stat" style="display:block;font-size:11px">Savaşçı asker yanında savaşır: yakın düşmanlara hasar verir ve sana gelen hasarın %25\'ini üstlenir. Ücret: 4.000 Yang (bir kez).</div>'+(o.own?'<div class="stat"><b>Askerin yanında!</b></div>':btn('mercbuy','⚔ Kirala (4000💰)','',player.yang<4000));}
  else if(npcCur&&npcCur.t==='tavern')tavRender();};}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act=mercbuy]');if(!t||mercO().own||player.yang<4000)return;player.yang-=4000;mercO().own=true;sfx('buy');showMsg('⚔ Paralı asker artık seninle!');updateHUD();saveGame();renderNpc();});
{const _dp6=damagePlayer;damagePlayer=function(n,src){return _dp6(mercO().own&&mercMesh&&mercMesh.visible?Math.round(n*.75):n,src);};}
{const _um=update;update=function(dt){_um(dt);if(!player.cls||!mercO().own)return;if(!mercMesh){mercMesh=buildHuman('savasci',false,{},0x8a4a2a);mercMesh.position.copy(player.group.position);scene.add(mercMesh);}
  const pp=player.group.position;mercMesh.visible=!dungeon||true;let tx=pp.x+2,tz=pp.z+1.5,tgt=null;
  for(const e of enemies){if(e.dead||e.isMetin)continue;const d=Math.hypot(e.mesh.position.x-pp.x,e.mesh.position.z-pp.z);if(d<9&&e.state==='chase'||e.provoked&&d<9){tgt=e;break;}}
  if(tgt){tx=tgt.mesh.position.x-1.2;tz=tgt.mesh.position.z;}
  const dx=tx-mercMesh.position.x,dz=tz-mercMesh.position.z,d=Math.hypot(dx,dz);if(d>30)mercMesh.position.set(tx,0,tz);else if(d>.7){const sp=Math.min(d*4,7);mercMesh.position.x+=dx/d*sp*dt;mercMesh.position.z+=dz/d*sp*dt;mercMesh.rotation.y=Math.atan2(dx,dz);}
  mercT-=dt;if(tgt&&mercT<=0&&Math.hypot(tgt.mesh.position.x-mercMesh.position.x,tgt.mesh.position.z-mercMesh.position.z)<3.2){mercT=1.4;mercMesh.rotation.y=Math.atan2(tgt.mesh.position.x-mercMesh.position.x,tgt.mesh.position.z-mercMesh.position.z);tgt.takeDamage(Math.round(player.baseDmg*.55),false);spawnBurst(tgt.mesh.position.clone().setY(1),0xffcc88);}};}

// ---------- Meyhane: zar oyunu ----------
addNpc({id:'tavern',n:'Meyhaneci Rıza',x:-14,z:10,tint:0xa07030,cls:'sura',t:'tavern'});
let tavMsg='';
function tavRender(){const bets=[100,500,2000,10000];let h='<div class="stat" style="display:block;font-size:11px">İki zar atılır. <b>Düşük</b> (2-6) ve <b>Yüksek</b> (8-12) 1.9× öder, tam <b>7</b> 4.5× öder. Kasa avantajlıdır; Yang erit!</div>';
  if(tavMsg)h+='<div class="stat" style="display:block">'+tavMsg+'</div>';h+='<div class="stat"><span>Bahis</span><span><select id="tavBet">'+bets.map(b=>'<option>'+b+'</option>').join('')+'</select></span></div>'
  +'<div style="display:flex;gap:4px">'+btn('tavroll','⬇ Düşük','data-w="lo"')+btn('tavroll','7️⃣ Yedi','data-w="7"')+btn('tavroll','⬆ Yüksek','data-w="hi"')+'</div>';$('npcBody').innerHTML=h;}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act=tavroll]');if(!t)return;const bet=+($('tavBet')||{}).value||100;if(player.yang<bet){showMsg('Yetersiz Yang.');return;}
  const a=1+Math.floor(Math.random()*6),b=1+Math.floor(Math.random()*6),s=a+b,w=t.dataset.w,win=(w==='lo'&&s<=6)||(w==='hi'&&s>=8)||(w==='7'&&s===7),mul=w==='7'?4.5:1.9;
  player.yang-=bet;if(win){const g=Math.round(bet*mul);player.yang+=g;tavMsg='🎲 '+a+' + '+b+' = '+s+' → <b style="color:#6f6">KAZANDIN +'+(g-bet)+'</b>';sfx('level');}else{tavMsg='🎲 '+a+' + '+b+' = '+s+' → <span style="color:#f88">Kaybettin −'+bet+'</span>';sfx('miss');}
  updateHUD();saveGame();tavRender();});

// ---------- Hazine haritası ----------
const tmBtn=mkEl('🗺 Haritayı oku','position:fixed;left:14px;bottom:130px;z-index:22;display:none;padding:7px 12px;border-radius:10px;border:2px solid #c99a3a;background:linear-gradient(180deg,#6a5a2a,#3a2a10);color:#fff;font-size:12px');
const tmChip=mkEl('','position:fixed;left:50%;top:112px;transform:translateX(-50%);z-index:30;display:none;color:#fff;font-size:11px;padding:3px 10px;border-radius:12px;border:1px solid #e8c36a;background:rgba(80,60,10,.88)');
const digBtn=mkEl('⛏ Kazı yap','position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:23;display:none;padding:10px 20px;border-radius:10px;border:2px solid #ffd24a;background:linear-gradient(180deg,#8a6a1a,#4a3408);color:#fff;font-size:14px');
let tm=null;
tmBtn.onclick=()=>{const m=META();if(tm||!(m.maps>0)||dungeon)return;m.maps--;const a=Math.random()*6.28,r=55+Math.random()*60;tm={x:Math.cos(a)*r,z:Math.sin(a)*r};showMsg('🗺 Hazine işaretlendi! Üstteki mesafeyi takip et.');saveGame();};
const CARD=['Doğu','Güneydoğu','Güney','Güneybatı','Batı','Kuzeybatı','Kuzey','Kuzeydoğu'];
setInterval(()=>{if(!player.cls||!player.alive){tmBtn.style.display=digBtn.style.display=tmChip.style.display='none';return;}
  tmBtn.style.display=(!tm&&(META().maps||0)>0&&!dungeon)?'block':'none';if(!tm){digBtn.style.display=tmChip.style.display='none';return;}
  const pp=player.group.position,dx=tm.x-pp.x,dz=tm.z-pp.z,d=Math.hypot(dx,dz);tmChip.style.display='block';tmChip.textContent='🗺 Hazine: '+Math.round(d)+' m '+CARD[(Math.round(Math.atan2(dz,dx)/(Math.PI/4))+8)%8];digBtn.style.display=d<3.5?'block':'none';},400);
digBtn.onclick=()=>{if(!tm)return;const p=new THREE.Vector3(tm.x,0,tm.z);tm=null;digBtn.style.display=tmChip.style.display='none';sfx('level');
  if(Math.random()<.3){const e=new Enemy(p.clone(),'boss_cave',Math.max(5,player.level),{dg:true});e.name='Hazine Bekçisi';e.provoked=true;e.state='chase';e.treasure=true;enemies.push(e);showMsg('⚠ Hazine Bekçisi uyandı!');}
  else{const y=800+player.level*120;player.yang+=y;dropItem(p,2,player.level+2);player.mats.eshard=(player.mats.eshard||0)+1;showMsg('💰 Sandık! +'+y+' Yang, eşya, 🔷');updateHUD();saveGame();}};
{const _dt=Enemy.prototype.die;Enemy.prototype.die=function(){const tr=this.treasure,pos=this.mesh.position.clone();_dt.call(this);if(tr){player.yang+=2000+player.level*150;dropItem(pos,3,player.level+3);showMsg('💰 Hazine Bekçisi yenildi! Büyük ödül!');updateHUD();}};}

// ---------- Rüya Alemi (roguelite) ----------
const DMODS=[['steal','🩸 Can Çalma','Verdiğin hasarın %10\'u kadar can yenile'],['dbl','🏹 Çift Atış','%20 ihtimalle vuruş iki kez isabet eder'],['fire','🔥 Ateş Hasarı','+%25 hasar'],['crit','🎯 Keskin Göz','+12 kritik'],['hp','❤ Dev Beden','+%30 maksimum can'],['spd','💨 Rüzgâr Adımı','+%15 hız'],['arm','🛡 Taş Deri','−%15 alınan hasar'],['heal','✚ Şifa Çağlayanı','Kat bitince +%15 can']];
const dmN=k=>(dungeon&&dungeon.def.dream&&dungeon.mods||[]).filter(x=>x===k).length;
const DDEF={id:'dream',n:'Rüya Alemi',min:10,waves:1,per:6,mobs:['orcw','archer','mage','elite','orcshaman','skel','tank'],boss:'boss_sohan',mul:2,fog:0x120a2a,dream:true};
const drO=()=>{const m=META();return m.dr||(m.dr={pts:0,up:0,best:0});};
addNpc({id:'dream',n:'Rüya Bekçisi',x:-14,z:-2,tint:0x7a4ab0,cls:'saman',t:'dream'});
{const _rn9=renderNpc;renderNpc=function(){_rn9();if(!npcCur||npcCur.t!=='dream')return;const o=drO();
  $('npcBody').innerHTML='<div class="stat" style="display:block;font-size:11px;color:#c9b88a">Her katı bitirince 3 güçlendirmeden birini seçersin. Ölünce/çıkınca güçlendirmeler sıfırlanır; ama <b>Rüya Puanı</b> kalır ve kalıcı bonusa dönüşür.</div>'
   +'<div class="stat"><span>Rüya Puanı: <b>'+o.pts+'</b></span><span>En iyi kat: '+o.best+'</span></div>'+btn('dreamgo','🌙 Rüya Alemi\'ne gir (1 anahtar)','',player.level<DDEF.min||player.keys<1||!!dungeon)
   +'<div class="stat"><span>Kalıcı bonus: +%'+o.up+' saldırı/savunma</span>'+btn('dreamup','Yükselt ('+(10+o.up*10)+' puan)','',o.up>=10||o.pts<10+o.up*10)+'</div>';};}
document.body.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(!t)return;const a=t.dataset.act,o=drO();
  if(a==='dreamgo'){if(dungeon||duel||player.keys<1)return;DGS.push(DDEF);try{enterDungeon('dream');}finally{const i=DGS.indexOf(DDEF);if(i>=0)DGS.splice(i,1);}if(dungeon&&dungeon.def.dream)dungeon.mods=[];}
  else if(a==='dreamup'){const c=10+o.up*10;if(o.up>=10||o.pts<c)return;o.pts-=c;o.up++;recalcStats();sfx('level');saveGame();renderNpc();}});
{const _rc8=recalcStats;recalcStats=function(){_rc8();if(!player.cls)return;const o=drO();if(o.up){player.baseDmg*=1+o.up/100;player.defPct+=o.up;}
  if(dungeon&&dungeon.def.dream&&dungeon.mods){const c=dmN('crit');if(c)player.crit=clamp(player.crit+12*c,0,65);const h=dmN('hp');if(h)player.maxHp=Math.round(player.maxHp*(1+.3*h));const s=dmN('spd');if(s)player.speed*=1+.15*s;player.hp=Math.min(player.hp,player.maxHp);}};}
{const _td6=Enemy.prototype.takeDamage;Enemy.prototype.takeDamage=function(a,c,o){if(!(dungeon&&dungeon.def.dream&&dungeon.mods)||this._dd)return _td6.call(this,a,c,o);
  const f=dmN('fire');if(f)a=Math.round(a*(1+.25*f));const r=_td6.call(this,a,c,o);const st=dmN('steal');if(st&&player.alive){player.hp=Math.min(player.maxHp,player.hp+a*.1*st);}
  const d=dmN('dbl');if(d&&Math.random()<.2*d&&!this.dead){this._dd=1;_td6.call(this,a,false,o);this._dd=0;}return r;};}
{const _dp7=damagePlayer;damagePlayer=function(n,src){const k=dmN('arm');return _dp7(k?Math.round(n*Math.pow(.85,k)):n,src);};}
{const _sw4=spawnWave;spawnWave=function(n){
  if(!(dungeon&&dungeon.def.dream))return _sw4(n);
  const def=dungeon.def;dungeon.wave=n;dungeon.pend=false;dungeon.floor=(dungeon.floor||0)+1;const f=dungeon.floor,m=1+.2*(f-1),L=Math.max(player.level,def.min)+Math.floor(f/3);
  const mk=(sp,x,z)=>{const e=new Enemy(new THREE.Vector3(x,0,z),sp,L,{dg:true});e.state='chase';e.maxHp=Math.round(e.maxHp*m);e.hp=e.maxHp;e.dmg=Math.round(e.dmg*m);enemies.push(e);return e;};
  if(f%4===0){const bk=EBOSS[(f/4-1)%EBOSS.length],e=mk(bk,DG.x,DG.z-8);e.boss=false;e.eboss=true;showMsg('RÜYA KAT '+f+': BOSS!');}
  else{const c=Math.min(12,4+Math.floor(f/2));showMsg('RÜYA KAT '+f);for(let i=0;i<c;i++){const a=i/c*6.28+Math.random();mk(def.mobs[Math.floor(Math.random()*def.mobs.length)],DG.x+Math.cos(a)*12,DG.z+Math.sin(a)*12);}}
};}
const dreamBox=mkEl('','position:fixed;inset:0;z-index:85;display:none;background:rgba(10,5,30,.75);align-items:center;justify-content:center');
function dreamPick(){const pool=DMODS.slice().sort(()=>Math.random()-.5).slice(0,3);dreamBox.style.display='flex';
  dreamBox.innerHTML='<div style="width:min(92vw,340px);background:rgba(30,20,50,.97);border:2px solid #a07aff;border-radius:12px;padding:12px;color:#eee;text-align:center"><b>🌙 Bir güçlendirme seç</b>'+pool.map(m=>'<button data-dm="'+m[0]+'" style="display:block;width:100%;margin:6px 0;padding:9px;text-align:left"><b>'+m[1]+'</b><br><small>'+m[2]+'</small></button>').join('')+'</div>';}
dreamBox.onclick=e=>{const b=e.target.closest('[data-dm]');if(!b||!dungeon||!dungeon.def.dream)return;dungeon.mods.push(b.dataset.dm);dreamBox.style.display='none';
  if(b.dataset.dm==='heal'){}recalcStats();dungeon.pend=false;spawnWave(dungeon.wave+1);};
{const _dk6=dungeonKill;dungeonKill=function(b){
  if(dungeon&&dungeon.def.dream&&!dungeon.pend&&!enemies.some(e=>e.dg&&!e.dead)){const f=dungeon.floor,o=drO();o.pts+=f;if(f>o.best)o.best=f;dungeon.t+=40;const hl=dmN('heal');if(hl){player.hp=Math.min(player.maxHp,player.hp+player.maxHp*.15*hl);}
    player.yang+=Math.round(100+player.level*10*f);showMsg('✔ Rüya katı '+f+' tamam! +'+f+' Rüya Puanı');saveGame();updateHUD();dungeon.pend=true;setTimeout(dreamPick,600);return;}
  return _dk6(b);};}
{const _rs2=respawn;respawn=function(){dreamBox.style.display='none';return _rs2();};}

// ---------- Dünya Ejderhası'na saldıran botlar ----------
let wbBots=[],wbSaid=false;
setInterval(()=>{const e=WB.cur;if(!e||e.dead){wbBots.forEach(b=>scene.remove(b.m));wbBots=[];wbSaid=false;return;}
  if(!wbSaid){wbSaid=true;chat('[Dünya] Avcılar Dünya Ejderhası\'na koşuyor!','#9cf');}
  while(wbBots.length<5){const cl=['savasci','ninja','okcu','sura','saman','lykaner'].filter(c=>CLASSES[c]),m=buildHuman(cl[wbBots.length%cl.length],false,{},[0x2a7a5a,0x7a2a5a,0x2a5a9a,0x9a7a2a,0x5a2a9a][wbBots.length%5]),a=wbBots.length/5*6.28;m.position.set(e.mesh.position.x+Math.cos(a)*30,0,e.mesh.position.z+Math.sin(a)*30);scene.add(m);wbBots.push({m,a});}
  for(const b of wbBots){const a=b.a+performance.now()/9000,tx=e.mesh.position.x+Math.cos(a)*7,tz=e.mesh.position.z+Math.sin(a)*7;const dx=tx-b.m.position.x,dz=tz-b.m.position.z,d=Math.hypot(dx,dz)||1;b.m.position.x+=dx/d*Math.min(d,5);b.m.position.z+=dz/d*Math.min(d,5);b.m.rotation.y=Math.atan2(e.mesh.position.x-b.m.position.x,e.mesh.position.z-b.m.position.z);
    if(Math.random()<.5){spawnBurst(e.mesh.position.clone().setY(1.5+Math.random()),0xffaa44);if(e.hp>e.maxHp*.55)e.hp=Math.max(e.maxHp*.55,e.hp-e.maxHp*.004);}}},1000);
window.__g13={sh:()=>sHorse,shEnsure,DMODS,drO,bsO,bsBonus,tavRender,mercO,TDEF,gpPoll,dreamPick,get tm(){return tm;},tmGo:()=>tmBtn.onclick(),ghosts:()=>ghosts};

