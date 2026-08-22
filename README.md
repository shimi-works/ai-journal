# AI Journal

「書くことはシンプルに、振り返ることはAIに。」を軸にした、ローカルファーストの日記PWAです。日記は端末内へ保存され、Gemini APIキーを設定すると要約・タグ・感情推定・期間の振り返りを追加できます。AIや外部APIが利用できなくても、書く・保存する・読み返す基本機能は動きます。

公開版: https://shimi-works.github.io/ai-journal/

## 主な機能

- タイトル・本文・気分・点数を記録
- 月別一覧、カレンダー、検索、グラフ
- JSON・Markdownによるバックアップと復元
- Geminiによる要約、タグ、感情推定、週・月・年の振り返り
- Googleカレンダーから予定を挿入
- PWA、オフライン対応、任意の通知機能

## 技術構成

- `index.html`: HTML・CSS・JavaScriptを内包するアプリ本体
- `manifest.webmanifest` / `sw.js`: PWAとオフラインキャッシュ
- `push-server/`: Cloudflare Workerによる任意のWeb Push送信役
- 保存: localStorageとIndexedDB
- 外部API: Gemini、Google Calendar、Open-Meteo

フロントエンドのビルド工程と実行時依存はありません。開発用のスモークテストもNode.js標準機能だけで動きます。

## ローカル起動

PWAとService Workerを確認するため、リポジトリ直下をHTTPで配信します。

```powershell
npm run serve
```

ブラウザで `http://localhost:8000/` を開きます。ポート8000が使用中なら、次のように別ポートを指定できます。

```powershell
python -m http.server 8080
```

## 検証

```powershell
npm test
git diff --check
```

`npm test` はmanifestのJSON、PWAの必須参照、インラインJavaScriptの構文、秘密情報らしい値の混入を確認します。UI変更では、これに加えて375x812とデスクトップ幅で対象フローを目視確認してください。

## 外部サービスの設定

Gemini APIキーとGoogle OAuthクライアントIDは、利用者がアプリの設定画面で入力します。値をソースコードへ書かないでください。日記のバックアップや書き出しファイルもGitへ追加しないでください。

Push送信役の設定とデプロイは [push-server/README.md](push-server/README.md) を参照してください。VAPID秘密鍵はCloudflareのsecretとして登録し、ファイルへ保存しません。

## AIエージェントで開発する場合

作業前に [AGENTS.md](AGENTS.md) を読み、変更範囲・受け入れ条件・検証方法・停止条件を確認してください。無人実行では専用branchを使い、`main`へ直接pushまたはmergeしません。
