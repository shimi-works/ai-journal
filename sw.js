// AI Journal Service Worker — オフラインでも起動できるようにする
// 方針: 同一オリジンのGETは stale-while-revalidate（キャッシュを即返し、裏で更新）。
//       Gemini・Open-Meteo等の外部APIには関与しない（ネットワーク直）。
const CACHE = "ai-journal-v19";  // 新機能お知らせバナー＋端末別の通知セットアップ説明
const APP_URL = "./";
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

// ===== プッシュ通知 =====
// 送信役（本人のCloudflare Worker）から届いたWeb Pushを通知として表示する。
// ペイロードは { title, body, url } のJSON。壊れていても定型文で必ず1件出す（iOSはuserVisibleOnly必須）。
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_) { data = { body: e.data ? e.data.text() : "" }; }
  const title = data.title || "AI Journal";
  const body = data.body || "今日の一日を3分で振り返りましょう。";
  const url = data.url || APP_URL;
  e.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: "ai-journal-reminder",   // 同じタグは上書き（通知が溜まらない）
    renotify: true,
    data: { url }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || APP_URL;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      // 既に開いているタブがあればそれを前面に、なければ新しく開く
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
