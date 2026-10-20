# 本番の読み取りを守る仕組み

`production-check.mjs` は、deploy と見張りを確認してから対象へ接続し、`production-log.json` を保存する。ゲートの初期値は false。不明な通信は許可しない。自己テストの差し替えを本番へ持ち込まない。

## 起動と記録

必須の引数は `--repo`・`--expect-sha`・`--deploy-workflow`・`--targets`・`--allow-hosts`・`--out`・`--run-id`。`--budget-seconds` は正の秒数（既定 1200）、`--allow-write` は繰り返し指定できる。

`targets` は空でない JSON 配列。各項目は `{ name, kind: "page" | "http", url, expectStatus, expectSelectors: [] }`。name は重複しない英数字・ハイフン・アンダースコア。URL に認証情報や署名付き URL を使わない。許可 host はポートを含む `host[:port]` の完全一致。

- exit 0: 対象の記録を作成した。期待する status・selector と一致したことを意味しない。画像と記録を確認役が読んで結果にする。
- exit 1: deploy・見張り・実行・session 終了のいずれかを確認できない。本番を別の手段で開かず報告して止まる。
- exit 2: 引数や targets の形式が不正。

直下の記録には `deployCheck`・`guardSelfCheck`・`budgetExceeded`・`sessionClosed`・`requests`・`targets` がある。targets には status・location・selectorsFound・console・screenshot・a11y・skipped を残す。requests は対象名・method・URL・status・blocked・reason を残す。

## deploy と自己確認

1. `git ls-remote https://github.com/<repo>.git refs/heads/production` と、`gh run list` で指定 workflow の production 向け最新成功 run の headSha を測る。両方が対象 SHA と一致しなければ本番を開かない。
2. `--remote` と `VERIFYING_CHANGES_GH` はローカル自己テスト用の差し替えである。記録に残し、判定と司令塔の完了ゲートでは既定の remote・`gh` 以外を通さない。
3. 新しい専用 session で、127.0.0.1 の一時サーバーに対する POST と GraphQL mutation が届かず GET が届くことを、要求の記録とサーバーの受信で確認する。3 項目が true でなければ本番を開かない。

## 要求の判定

`judgeRequest({ method, url, postData, contentType }, policy)` は `{ allow, reason }` を返す。policy は `{ allowHosts, allowWrites: [{ method, urlPrefix }] }`。

| 条件 | 動作 |
|---|---|
| URL が読めない・HTTP(S) 以外・認証情報あり・許可外 host | 停止 |
| GET・HEAD・OPTIONS | 許可。ただし query パラメーターの値のどれかに mutation・subscription の語があれば停止 |
| その他の method | 宣言の method と URL の前方一致がなければ停止 |
| 宣言された通信の本文 | GraphQL query と確認できたときだけ許可 |

URL の前方一致は、次の文字が `/`・`?`・終端の場合だけ。`POST:https://api.example.com/graphql` は `/graphql-admin` を許可しない。

GET・HEAD・OPTIONS は、すべての query の値を URLSearchParams で 1 回デコードし、`\b(mutation|subscription)\b`（大文字・小文字を区別しない）で調べる。GraphQL として解析できるかは問わない。普通の検索値 `shoes` や `{ a }` は通し、不正な文法でも該当する語があれば止める。GraphQL の mutation・subscription は操作の種類の語を省略できず、省略した `{ … }` は query になるためである。文字列・コメント・普通の検索語に該当の語があるだけでも、止める側の誤りとして停止する。

GET・HEAD・OPTIONS 以外では、JSON の query、JSON 配列の各 query、`application/graphql` の本文を読む。すべてが読み取りでなければ停止する。mutation・subscription は許可しない。コメントの後の mutation、query と mutation の混在も停止する。operationName が query を指しても、本文に mutation があれば停止する。query の無い persisted query・不正な JSON・空の配列・解析できない文法も停止する。

Node 組み込みには GraphQL の構文解析が無く、この skill は外部依存を持たないため、読み取りの文法を限定して受理する。文字列やコメント中の単語を operation と混同しない。本文は 131072 文字、構文の深さは 100 を上限にする。

## ブラウザの見張り

本番の対象は新しい context で開く。context 全体に `route` を付け、popup・iframe・XHR も同じ判定を通す。Service Worker は context の設定で block にし、登録も拒否する。WebSocket は `routeWebSocket` で接続前に閉じる。

**本番のブラウザはリダイレクトをたどらない。** 通した要求も `route.fetch({ maxRedirects: 0 })` で受け、300〜399 は `route.fulfill` に渡さず abort する。許可 host 内の移動や、許可した POST の 307/308 も同じ。

- 主画面の navigation は status・location を targets に残し、selector は未確認（null）。画像・a11y は null になり得る。
- subresource・XHR・iframe を含む要求は、blocked とリダイレクトの reason・移動先を requests に残す。
- HTTP の対象も `redirect: "manual"` で取得する。

宣言にはリダイレクトしない URL を書く。リダイレクトする URL を対象にするなら、期待する応答に 3xx を書く。止めた要求そのもの、宣言済みの応答、許可 host 外のエラーを製品の発見に数えない。

## 時間・片付け・秘密

C 全体の残り時間を各回へ渡す。上限後の対象は skipped にして budgetExceeded を記録する。再現の出力は `reruns/<発見id>-<n>/` に分け、最初の記録を上書きしない。

session 名は `vc-<runId>-` で始まる。playwright-cli の cwd とコードは `--out` 下の一時ディレクトリへ置く。同名 session があれば勝手に再利用しない。正常・異常終了とも自分が開いた session を閉じ、`list --all` で実体を確かめ、一時コードを削除する。終了を確認できなければ exit 1。司令塔も別の cwd から `list --all` で確かめる。

CLI が自動保存するタブは about:blank のままにして対象の生ログを出さない。URL・console・a11y の署名付き URL は伏せる。画像は確認役が目視し、最後に置き場全体を `scan-artifacts.mjs` で検査する。署名付き URL や秘密が検出された出力を GitHub に渡さない。
