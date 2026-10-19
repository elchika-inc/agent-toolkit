---
name: layout-geometry-check
description: 'このスキルは「レイアウト崩れを検査」「はみ出しを確認」「文字切れを検出」「layout geometry check」と依頼されたときに使われる。Playwright で複数の画面幅の要素座標を測り、表示崩れの候補を JSON に出し、基準線との差分を検査する。'
---

# 座標によるレイアウト崩れの検査

画面幅を変えたときの位置関係から、表示崩れの候補を出す。画像の正解は不要。
この検査は standards AI_FIRST §2 の「表示崩れ」の確認を助けるもので、単独で §2 を満たすわけではない。
スクリーンショットによる確認、console、a11y、キーボード操作などは別途行う。

## 手順

1. Node.js と `playwright-cli` を PATH に用意する。初回と環境変更後は陽性の対照を実行する。

   ```sh
   node <このスキルの場所>/tests/selftest.mjs
   ```

   終了コード 0 を確認してから、検出 0 件の結果を信頼する。CLI が無ければ自己テストも 2 で失敗する。

2. 対象の HTTP(S) URL と出力先を決め、実行する。ローカル HTML は HTTP サーバーで配る。`file:` は判定不能になる。

   ```sh
   node <このスキルの場所>/scripts/check.mjs \
     --url http://127.0.0.1:3000/ \
     --widths 320,768,1280 --color-scheme light \
     --out /tmp/layout-light.json
   ```

3. `checked` が各幅で正の数かを見て、`findings` の要素を画面上で確かめる。`info.atReference` と未走査・比較不能の情報も読む。
4. 意図した表示かを確認した結果だけを、明示的に基準線へ保存する。保存先は各リポジトリの `e2e/layout-baseline/` を推奨する。

   ```sh
   node <このスキルの場所>/scripts/check.mjs \
     --url http://127.0.0.1:3000/ --out /tmp/layout-light.json \
     --baseline e2e/layout-baseline/light.json --update-baseline
   ```

5. 次回から同じ条件で `--baseline` を指定する。新規 finding があれば要素を確認し、必要な修正後に再実行する。基準線を自動更新して失敗を隠さない。

両方のテーマを確かめるには、`--color-scheme` を変えて 2 回走らせる。出力と基準線もテーマごとに分ける。
色の切替は `page.emulateMedia` による `prefers-color-scheme` の変更なので、クラスや属性でテーマを切り替えるアプリには効かない。

## 引数と終了コード

```text
node check.mjs --url <URL> [--widths 320,768,1280] [--exclude <CSSセレクタ>]... \
  [--rules R1] [--color-scheme light|dark] [--max-incomparable 0.3] \
  --out <結果.json> [--baseline <基準線.json>] [--update-baseline]
```

- 幅は最大から順に測る。既定は 1280、768、320。高さは 900px。
- `--exclude` は複数指定でき、そのセレクタに一致する要素を対象から除く。
- `--rules` は検査する規則を列挙する。既定は R1 のみ。R2〜R4 は任意で有効にする（例: `--rules R1,R2,R3,R4`）。
- 基準幅に DOM が存在しない要素が、狭い幅の対象の 30% を超えると判定不能。`--max-incomparable` で割合を変更できる。
- 基準線は `--update-baseline` を付けたときだけ書く。結果の保存先とは分ける。

| 終了コード / verdict | 意味 |
|---|---|
| 0 / `ok` | 完了。基準線なし、または新規 finding なし |
| 1 / `new-findings` | 基準線にない finding あり |
| 2 / `undecidable` | 判定不能、引数・CLI・出力などの失敗 |

基準線が無ければ「基準線なし」と表示して 0 で終える。0 は「崩れが無い」という意味ではない。
比較キーは（URL の正規形、規則、要素キー、幅）。URL は host と末尾 `/` を除く pathname を使う。
要素キーは一意な `data-testid`、または `body` からの `tag:nth-of-type` の連なり。`id` は使わない。
減少した finding は件数を表示する。件数そのものを合格条件にしない。

## 規則と出力の読み方

検出ロジックの正本は [scripts/detect.js](scripts/detect.js)。CLI とテストの helper はこのファイルを読み、中身を複製しない。

| 規則 | 候補として検出するもの | 報告 |
|---|---|---|
| R1 | 文書の横幅を増やす要素による、画面右側への 1px 超のはみ出し | すべての幅 |
| R2 | `hidden / clip` で文字が 1px 超切れる要素 | 基準幅では発生せず、狭い幅で発生 |
| R3 | 同じ親を持つ通常フローの兄弟の、縦横とも 1px 超の重なり | 同上 |
| R4 | `overflow: visible` の親からの、子の 1px 超のはみ出し | 同上 |

表示されない要素、面積 0、inline、自身に transform がある要素は対象外。
R1 は祖先の横スクロール・クリップや fixed を除き、外側から最大 50 候補を一時的に非表示にして文書幅の減少を確認する。測定後は元の style に戻す。
R2 は ellipsis、line-clamp、1px 以下や clip / clip-path で視覚的に隠す要素を除く。
R3 は static / relative / sticky の兄弟を比較し、表示する子が 200 個を超える親を除く。
R4 は absolute / fixed の子を除く。

2026-10-19 に todoke.dev・docs.todoke.dev・manako.dev・docs.manako.dev を 1280・768・320px、全規則で試走し、要素画像で判定した既定は次のとおり。
誤検出率が半分以上なら無効、finding が 0 件なら設計時の既定を維持した。

| 規則 | finding | 崩れ | 誤検出 | 誤検出率 | 既定 |
|---|---:|---:|---:|---:|---|
| R1 | 0 | 0 | 0 | 算出対象なし | 有効を維持 |
| R2 | 2 | 1 | 1 | 50% | 無効へ変更 |
| R3 | 0 | 0 | 0 | 算出対象なし | 無効を維持 |
| R4 | 4 | 0 | 4 | 100% | 無効を維持 |

R2 の誤検出は装飾背景のはみ出し、R4 は検索ボタンが親の行高を上下に越える意図した配置だった。R2 は Manako の CLI 出力例の文字切れも検出した。

- `checked`: 幅ごとの対象要素数。
- `findings`: 規則、キー、幅、矩形、詳細。R3・R4 のキーは 2 要素を ` | ` で連結する。
- `info.atReference`: 最大幅で起きた R2〜R4。崩れの候補から外すが、基準幅自体が崩れている可能性があるので確認する。
- `info.incomparable`: 基準幅で対象にならなかった要素と、その時点の DOM に無かった要素の件数。同じ Element を保持して区別する。
- `info.unscanned`: 閉じた shadow root と iframe の数。閉じた root を読み込み前から記録できなかった経路では `closedShadowRoot: null`（未計測）。0 と混同しない。
- `info.r1Unverified` / `leftProtrusion` / `skippedParents`: R1 の上限超過候補、左方向のはみ出し、R3 の上限超過親の件数。
- `info.networkidleTimedOut`: 5 秒以内に networkidle に達しなかったか。
- `reason`: 判定不能の理由。HTTP が 2xx 以外、host / pathname が変わる転送、対象 0 個、比較不能の上限超過、CLI 失敗など。

件数は幅ごとに加算する。`unscanned` は各幅で観測した最大数を返す。
開いた shadow root は走査する。閉じた root、iframe 内部、親が違う要素同士の重なりは走査しない。

## 実行の境界

専用の一時ディレクトリと名前付きブラウザを使い、成功・失敗にかかわらず close する。
ログイン状態の作成やページの自動修正は行わない。
中断には実行プロセスへ SIGINT を送る。判定不能は結果に理由を残し、原因を解消してから同じ引数で再実行する。
通信が一過性なら最大 2 回まで再試行し、同じ失敗が続けば停止して報告する。

Playwright のテストに組み込むときだけ [references/playwright-test.md](references/playwright-test.md) を読む。
入口は `test:e2e` に限り、`test` / `pretest` から呼ばず、GitHub Actions でも実行しない（standards DOCS_OPS §6）。
