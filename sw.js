/* しおりスマホ版の Service Worker。
   同じサイトのファイル: 回線があれば最新を取って保存、つながらない・遅い（4秒）ときは保存済みを出す。
   Google Fonts: 一度取ったら保存済みを使う。 */
const CACHE = "shiori-v1";
const FONTS = "shiori-fonts-v1";
const CORE = ["./", "payload.bin", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const within = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout")), ms);
  p.then(v => { clearTimeout(t); resolve(v); }, err => { clearTimeout(t); reject(err); });
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const key = req.mode === "navigate" ? new URL("./", self.registration.scope).href : url.origin + url.pathname;
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(key, { cache: "no-cache" }).then(r => {
        if (r.ok) cache.put(key, r.clone());
        return r;
      });
      net.catch(() => {});
      try {
        return await within(net, 4000);
      } catch (err) {
        return (await cache.match(key)) || net;
      }
    })());
    return;
  }

  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === "opaque") c.put(req, r.clone());
      return r;
    }));
  }
});
