const CACHE = "asistente-v102";
const FILES = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" }))))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Red primero (para recibir actualizaciones), caché si no hay señal
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || e.request.url.includes(".enc.json")) return;
  // no-cache: siempre pregunta al servidor si hay versión nueva (GitHub Pages guarda copias 10 min)
  const mismo = new URL(e.request.url).origin === self.location.origin;
  e.respondWith((mismo ? fetch(e.request.url, { cache: "no-cache" }) : fetch(e.request)).then(r => {
    const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const abrir = e.notification.data && e.notification.data.abrir;
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(cs => {
    if (cs.length) { if (abrir) cs[0].postMessage({ abrir }); return cs[0].focus(); }
    return self.clients.openWindow(abrir ? "./#" + abrir : "./");
  }));
});
