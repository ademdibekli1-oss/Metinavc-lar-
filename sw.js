/* Metin Avcıları — önce ağ, olmazsa önbellek (çevrimdışı açılış için sayfa kabuğu) */
const C='metin-shell-v1';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r,cp)).catch(()=>{});return res;}).catch(()=>caches.match(r).then(m=>m||caches.match('./'))));
});
