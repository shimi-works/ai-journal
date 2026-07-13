// AI Journal 送信役 Worker — 毎日の日記リマインダーをWeb Pushで送る
//
// 役割:
//   - PWA(github.io)からの購読登録/解除を受け、Cloudflare KVに保存する
//   - Cron（毎分）で各購読の希望時刻を各自のタイムゾーンで判定し、その時刻を過ぎたら
//     1日1回だけ通知を送る（日付でlastSentを管理し、cronが1分飛んでも取りこぼさない）
//
// 送るのは定型文だけ。日記の中身はこのサーバーに一切送られない。
// 費用: Cloudflare Workers/KV/Cron の無料枠内。超過しても課金でなく配信が止まるだけ。
import { buildPushPayload } from "@block65/webcrypto-web-push";

const DEFAULT_MSG = {
  title: "AI Journal",
  body: "今日の一日を3分で振り返りましょう。",
  url: "https://shimi-works.github.io/ai-journal/"
};

function cors(env) {
  return {
    "access-control-allow-origin": env.ALLOW_ORIGIN || "*",
    "access-control-allow-methods": "POST, GET, OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}
function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(env), "content-type": "application/json" }
  });
}

// 購読はendpointごとに1件。endpointは長いのでSHA-256でキー化する
async function keyFor(endpoint) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return "sub:" + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function vapidFrom(env) {
  return {
    subject: env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY
  };
}

async function sendTo(rec, env, msg) {
  const payload = await buildPushPayload(
    { data: msg, options: { ttl: 12 * 60 * 60, urgency: "normal" } },
    rec.subscription, vapidFrom(env)
  );
  const res = await fetch(rec.subscription.endpoint, payload);
  return res.status;
}

// 指定タイムゾーンの「今日の日付」と「現在のHH:MM」を返す
function nowInTz(tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  const hh = p.hour === "24" ? "00" : p.hour;   // 環境により深夜0時が"24"になる対策
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${hh}:${p.minute}` };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });

    if (req.method === "GET" && url.pathname === "/") {
      // 動作確認用。VAPID公開鍵も返すのでアプリに貼るときの控えに使える
      return json({ ok: true, service: "ai-journal-push", vapidPublicKey: env.VAPID_PUBLIC_KEY || null }, 200, env);
    }

    if (req.method === "POST" && url.pathname === "/subscribe") {
      let b;
      try { b = await req.json(); } catch { return json({ error: "bad json" }, 400, env); }
      // 時刻だけの更新（endpointのみ）
      if (b.endpoint && !b.subscription) {
        const k = await keyFor(b.endpoint);
        const cur = await env.SUBS.get(k, "json");
        if (!cur) return json({ error: "not found" }, 404, env);
        if (b.time) cur.time = b.time;
        if (b.tz) cur.tz = b.tz;
        await env.SUBS.put(k, JSON.stringify(cur));
        return json({ ok: true, updated: true }, 200, env);
      }
      // 新規購読
      const sub = b.subscription;
      if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return json({ error: "missing subscription" }, 400, env);
      }
      const tz = b.tz || "Asia/Tokyo";
      const time = /^\d{2}:\d{2}$/.test(b.time) ? b.time : "21:00";
      // 購読時点で今日の予定時刻を過ぎていれば、今日は送らない（登録直後の不意打ちを防ぐ）
      const now = nowInTz(tz);
      const rec = { subscription: sub, time, tz, lastSent: now.hm >= time ? now.date : null };
      await env.SUBS.put(await keyFor(sub.endpoint), JSON.stringify(rec));
      return json({ ok: true }, 200, env);
    }

    if (req.method === "POST" && url.pathname === "/unsubscribe") {
      let b;
      try { b = await req.json(); } catch { return json({ error: "bad json" }, 400, env); }
      if (!b.endpoint) return json({ error: "missing endpoint" }, 400, env);
      await env.SUBS.delete(await keyFor(b.endpoint));
      return json({ ok: true }, 200, env);
    }

    if (req.method === "POST" && url.pathname === "/test") {
      let b;
      try { b = await req.json(); } catch { return json({ error: "bad json" }, 400, env); }
      if (!b.endpoint) return json({ error: "missing endpoint" }, 400, env);
      const rec = await env.SUBS.get(await keyFor(b.endpoint), "json");
      if (!rec) return json({ error: "not found" }, 404, env);
      try {
        const status = await sendTo(rec, env, { ...DEFAULT_MSG, body: "テスト通知です。これが届けば設定完了！" });
        return json({ ok: true, status }, 200, env);
      } catch (e) {
        return json({ error: String((e && e.message) || e) }, 500, env);
      }
    }

    return json({ error: "not found" }, 404, env);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDaily(env));
  }
};

async function runDaily(env) {
  let cursor;
  do {
    const list = await env.SUBS.list({ prefix: "sub:", cursor });
    for (const key of list.keys) {
      const rec = await env.SUBS.get(key.name, "json");
      if (!rec) continue;
      const now = nowInTz(rec.tz || "Asia/Tokyo");
      if (rec.lastSent === now.date) continue;          // 今日は送信済み
      if (now.hm < (rec.time || "21:00")) continue;     // まだ予定時刻より前
      try {
        const status = await sendTo(rec, env, DEFAULT_MSG);
        if (status === 404 || status === 410) {         // 失効した購読は掃除する
          await env.SUBS.delete(key.name);
          continue;
        }
        rec.lastSent = now.date;
        await env.SUBS.put(key.name, JSON.stringify(rec));
      } catch (e) {
        // 一時的な失敗。lastSentを更新しないので次のcronで再試行される
      }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
}
