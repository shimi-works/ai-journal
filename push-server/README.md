# AI Journal 送信役（プッシュ通知サーバー）

AI Journal の「毎日◯時に日記を書こう」というプッシュ通知を送る小さなサーバーです。
Cloudflare Workers の**無料枠**で動きます（クレジットカード不要・超過しても課金されず配信が止まるだけ）。

- 送るのは定型文だけ。**日記の中身はこのサーバーに一切送られません**。
- 保存されるのは「あなたの端末の購読情報」と「希望時刻」だけです。

---

## セットアップ（初回のみ・約10分）

前提: パソコンに [Node.js](https://nodejs.org/)（18以上）が入っていること。

### 1. このフォルダで依存をインストール

```bash
cd push-server
npm install
```

### 2. Cloudflare にログイン

```bash
npx wrangler login
```

ブラウザが開くので、無料アカウントでログイン（未登録なら https://dash.cloudflare.com/sign-up で作成・カード不要）。

### 3. 購読を保存する KV を作る

```bash
npx wrangler kv namespace create SUBS
```

表示された `id = "xxxxxxxx"` を、`wrangler.toml` の `[[kv_namespaces]]` の `id` に貼り替えます。

### 4. VAPID 鍵を作る

```bash
npm run genkeys
```

`VAPID_PUBLIC_KEY` と `VAPID_PRIVATE_KEY` が表示されます。**公開鍵はあとでアプリに貼るので控えておきます**。
続けてこの2つ＋連絡先をシークレットとして登録します（値の入力を求められたら貼り付け）:

```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT      # 例: mailto:you@example.com
```

> 秘密鍵はここだけに置き、**git にコミットしない**でください（`.gitignore` 済み）。

### 5. デプロイ

```bash
npm run deploy
```

`https://ai-journal-push.<あなた>.workers.dev` のような **Worker の URL** が表示されます。

### 6. アプリに登録

AI Journal の 設定 →「② プッシュ通知」で、
- **送信役のURL** ＝ 手順5のURL
- **VAPID公開鍵** ＝ 手順4の `VAPID_PUBLIC_KEY`

を貼って「保存」→「通知を有効にする」→ 通知を許可。
「テスト通知を今すぐ送る」で届けば完了です。

> **iPhone は必ず**、Safari で開いて共有 →「ホーム画面に追加」し、**そのアイコンから起動した状態**で有効化してください（iOS の仕様で、ホーム画面PWAでないとWeb Pushが使えません）。

---

## 仕組み・エンドポイント

| メソッド | パス | 役割 |
|---|---|---|
| POST | `/subscribe` | 購読＋希望時刻を保存（`{subscription,time,tz}`）／時刻だけ更新（`{endpoint,time,tz}`） |
| POST | `/unsubscribe` | 購読を削除（`{endpoint}`） |
| POST | `/test` | その購読へテスト通知を即送信（`{endpoint}`） |
| GET | `/` | 動作確認＋VAPID公開鍵の確認 |
| cron | 毎分 | 各購読の希望時刻を各自のTZで判定し、過ぎていたらその日1回だけ送信 |

`crons` は `wrangler.toml` で変更できます（`"*/5 * * * *"` にすると5分ごと＝最大5分遅れ・実行回数1/5）。
失効した購読（404/410）は自動で削除されます。

## 費用の目安

個人利用（自分の数端末・1日1回配信）なら、無料枠（Workers 10万リクエスト/日、KV 10万読み取り/日など）の1%も使いません。
Workers Paid にアップグレードしない限り、**意図しない請求は発生しません**。
