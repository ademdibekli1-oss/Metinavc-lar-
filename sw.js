/* Metin Avcıları — paket dosyaları (.bin, .png) önbellekten, sayfa/kod önce ağdan */
const C='metin-v8';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
  const heavy=/\.(bin|png)$/.test(u.pathname);
  if(heavy){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{});}return res;})));return;}
  e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{});}return res;}).catch(()=>caches.match(r).then(m=>m||caches.match('./'))));
});
