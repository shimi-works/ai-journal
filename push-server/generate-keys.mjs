// VAPID鍵ペアを1組つくって表示する（初回だけ実行）。
//   実行: node generate-keys.mjs
// 出てきた PUBLIC を アプリの「VAPID公開鍵」欄に、PUBLIC/PRIVATE を Worker のシークレットに設定する。
// 秘密鍵は絶対に公開しない（gitにコミットしない）。
import { webcrypto as crypto } from "node:crypto";

function b64url(buf) {
  return Buffer.from(buf).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const kp = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
);
const rawPub = await crypto.subtle.exportKey("raw", kp.publicKey);   // 65バイト非圧縮点
const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);      // d が秘密鍵（base64url）

console.log("=== AI Journal 用 VAPID 鍵（この2つを保管） ===\n");
console.log("VAPID_PUBLIC_KEY :", b64url(rawPub));
console.log("VAPID_PRIVATE_KEY:", jwk.d);
console.log("\n公開鍵はアプリの設定にも貼ります。秘密鍵はWorkerのシークレット専用（他言無用）。");
