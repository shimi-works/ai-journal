// AI Journal Service Worker — オフラインでも起動できるようにする
// 方針: 同一オリジンのGETは stale-while-revalidate（キャッシュを即返し、裏で更新）。
//       Gemini・Open-Meteo等の外部APIには関与しない（ネットワーク直）。
const CACHE = "ai-journal-v11";  // 継続バナー（連続記録）＋ネタ帳（会話ネタのストック）を追加
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      const fetched = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || fetched;
    })
  );
});
