# 座標によるレイアウト崩れの検査（layout-geometry-check）設計

- 置き場: このファイル
- 状態: 承認済み（2026-10-19、ユーザーがセッションの中で承認）。設計のレビューは 2 回で、flag は 10 件 → 1 件と減り、すべて反映済み。

## 背景

- standards AI_FIRST §2 は、UI を持つ変更でエージェントがブラウザで確かめることを MUST にしている。
  走査の項目に「表示崩れ・console error・ネットワークエラー」がある。ただし、何を崩れとみなすかの定義は無い。
  証跡の表の列は light / dark / console / a11y tree / keyboard で、崩れは light と dark の欄に書く。
  今は、AI が画面を見て判断しているだけで、毎回同じ結果になる判定が無い。
- 先行研究は ReDeCheck（Walsh・Kapfhammer・McMinn、ISSTA 2017）。
  複数の画面幅で、要素どうしの位置関係が変わらないかを確かめる。正解の画像の代わりに、ページ自身の一貫性を判定の基準にする。
  本番の 26 ページのうち 16 ページで、33 件の崩れを見つけた。
- 公開されている skill の調査（2026-10-19）では、座標で判定するものは無かった。
- ゴールシートでは C-001（検証の共通 skill）の範囲に入り、N-### と P-# には反しない。
  - 規則 R1〜R4 の定義は、この skill が道具の正本として持つ。standards に崩れの定義が無いので、複製にはあたらない（P-1）。
  - standards 側（AI_FIRST §2）にこの検査を参照として書き足すかは、別の PR で決める。この設計の範囲には含めない。

## 実測済みの前提（2026-10-19）

- `playwright-cli` 0.1.22 が `~/.vite-plus/bin/` にある。次の 3 点を確かめた。
  - `run-code --filename=<file>` が `async page => {...}` を実行し、戻り値を `### Result` の節に返す。
  - `page.setViewportSize` と `page.evaluate` が使える。
- `playwright-cli` は `file:` の URL を開けない（`Access to "file:" protocol is blocked`）。
  開けなかったときは about:blank のまま判定が走り、**崩れ 0 件を返した**。
- 手元の HTTP（`python3 -m http.server --bind 127.0.0.1`）で配った fixture を、幅 320 と 1280 で判定した。
  - 幅 320：画面からのはみ出し（500px の要素）と、文字の切れ（`overflow: hidden` の要素）を拾った。
  - 幅 1280：はみ出しは出ず、文字の切れだけが出た。
- todoke・manako・tools は、いずれも `@playwright/test` と、`test:e2e` の入口を持っている。
- agent-toolkit の Key Commands の `check` は、MCP サーバーの配下だけを検査する。skill の検査にはならない。

## 目的

エージェントと Playwright のテストの両方から、同じ判定で表示崩れの候補を機械的に出す。正解の画像は使わない。

## 判定の規則（v1）

### 対象にする要素

次の条件をすべて満たす要素だけを対象にする。

- `body` の子孫で、開いている shadow root の中を含む。
- 表示されている。`display: none`・`visibility: hidden`・`opacity: 0`・面積 0 のものは除く。
- `display` が `inline` ではない。複数行に折り返す inline 要素は、外接する矩形が隣と重なって見えるため除く。
- 自分の `transform` が `none` である。`getBoundingClientRect` は変形したあとの値を返すため。
- 呼び出し側が指定した除外セレクタに当たらない。

### 規則

| 規則 | 既定 | 判定 | 報告の条件 |
|---|---|---|---|
| R1 画面からのはみ出し | 有効 | 文書の `scrollWidth` が `clientWidth` より 1px を超えて大きいとき、原因の要素を特定する | すべての幅で報告する |
| R2 文字の切れ | 有効 | `overflow-x` か `overflow-y` が `hidden` か `clip` の要素で、`scrollWidth` か `scrollHeight` が表示の大きさを 1px を超えて上回り、文字を含む。`text-overflow: ellipsis`・`-webkit-line-clamp`・視覚的に隠す要素（幅か高さが 1px 以下、または `clip` / `clip-path` で隠したもの）は除く | 一貫性の規則に従う |
| R3 兄弟の重なり | **無効**（試走の結果で決める） | 同じ親を持ち、`position` が `static / relative / sticky` の兄弟どうしで、矩形が縦にも横にも 1px を超えて交差する | 一貫性の規則に従う |
| R4 親からのはみ出し | **無効**（試走の結果で決める） | `overflow` が `visible` の親から、子の矩形が 1px を超えて出る。子の `position` が `absolute / fixed` なら除く | 一貫性の規則に従う |

R1 で原因の要素を特定する手順は次のとおり。

1. 候補は、右端が画面幅を超えている要素のうち、次の 2 つに当たらないもの。
   - 祖先に、`overflow-x` が `hidden / clip / auto / scroll` の要素がある。
   - 自分か祖先の `position` が `fixed` である。
2. 候補を外側の要素から順に一時的に `display: none` にし、文書の `scrollWidth` が減るかを測る。減ったものを原因とし、測り終えたら必ず元に戻す。
3. 確かめるのは 1 ページ 1 幅あたり 50 個まで。超えた分は `info` に件数だけを出す。
4. 左方向のはみ出し（右端が 0 以下のもの）は、v1 では `info` に件数を出すだけにする。

R3 は、表示している子が 200 個を超える親を調べない（組の数が多くなりすぎるため）。そうした親の数は `info` に出す。親が違う要素どうしの重なりは、v1 では見ない。

### 一貫性の規則（R2〜R4）

- 一貫性の基準にするのは、指定した中で一番広い幅（以下、基準幅）。
- 崩れとして報告するのは、基準幅より狭い幅で起きていて、基準幅では起きていないもの。
- **基準幅で起きているもの**は、崩れには数えず、`info.atReference` に一覧で必ず出す。
  基準幅そのものが崩れている可能性を、黙って捨てないため。
- **比べられないもの**は、`info.incomparable` に件数を出す。次の 2 種類がある。
  - 基準幅で表示されていない（例：モバイル用のメニュー）。
  - 基準幅の時点で DOM に存在しない（幅を変えたときに JS が描き直した）。

### 要素の同定

- 幅をまたぐ比較は、1 回のページ読み込みの中で、**同じ Element そのもの**どうしで行う。
  ページの中に Element と番号の対応表を持ち、`page.evaluate` を呼ぶたびに引き継ぐ。DOM には書き込まない。
- 測る順番は、基準幅から狭い幅へ。
- DOM に存在しない要素（描き直されたもの）の割合が、狭い幅で調べた要素の 30% を超えたら「判定不能」にする。
  比べられない要素が多すぎるのに合格させないため。割合は引数で変えられる。
- 報告と基準線に使うキーは、`body` からの `tag:nth-of-type` の連なりにする。
  途中に、文書の中で一意な `data-testid` を持つ要素があれば、そこを起点にする。`id` は使わない（React の `useId` などは読み込みのたびに変わるため）。
  R3 と R4 のキーは、2 つの要素のキーを ` | ` でつないだものにする。
- キーは読み込みをまたぐと変わることがある。変わると、基準線との比較で「新しい finding」として失敗する。黙って通るのではなく、失敗する側に倒れる。

### 測る前の安定化

- 開いたあと、`load` を待つ。`networkidle` は最大 5 秒まで待ち、それでも落ち着かなければ先に進んで `info` に記録する。さらに `document.fonts.ready` を待つ。
- アニメーションとトランジションを止める CSS を入れる（Playwright のスクリーンショット比較の `animations: 'disabled'` と同じ考え方）。
- 幅を変えたら、2 フレーム待つ。続けて文書の `scrollHeight` と `scrollWidth` を 2 回測り、一致するまで待つ（最大 1 秒）。
- 閉じた shadow root と iframe の中は走査できない。その数を `info.unscanned` に出す。

## 黙って 0 件を返さないために

次のどれかに当たったら「判定不能」として終了コード 2 で終える。0 件として返さない。

- 開いた先の HTTP ステータスが 2xx ではない。
- 最後に表示している URL が、指定した URL と一致しない。
  - 比べるのは、host と、末尾の `/` を除いた pathname だけ。scheme は比べない（http から https への転送と、末尾の `/` の違いは許す）。
  - ロケールなどで pathname が変わる転送は許さない。その場合は、転送先の URL を指定し直す。
- 対象にする要素（上の条件を満たす `body` の子孫）が、どれかの幅で 0 個。
- DOM に存在しない要素の割合が、上限を超えた。
- `playwright-cli` が見つからない、または起動・移動・実行のどれかに失敗した。

出力には、幅ごとに調べた要素の数を必ず含める。

### 出力（JSON）

```json
{
  "url": "指定した URL", "finalUrl": "最後に表示した URL", "status": 200,
  "widths": [1280, 768, 320], "referenceWidth": 1280, "rules": ["R1", "R2"],
  "checked": { "1280": 0, "768": 0, "320": 0 },
  "findings": [
    { "rule": "R1", "key": "body > main:nth-of-type(1) > div:nth-of-type(2)", "width": 320,
      "rect": { "x": 0, "y": 0, "width": 0, "height": 0 }, "detail": "scrollWidth 500 > clientWidth 320" }
  ],
  "info": {
    "atReference": [], "incomparable": { "invisibleAtReference": 0, "missingAtReference": 0 },
    "unscanned": { "closedShadowRoot": 0, "iframe": 0 }, "r1Unverified": 0, "leftProtrusion": 0,
    "skippedParents": 0, "networkidleTimedOut": false
  },
  "verdict": "ok | new-findings | undecidable", "reason": "判定不能のときの理由"
}
```

- `checked` は幅ごとに調べた要素の数で、`atReference` の各項目は `findings` と同じ形。
- `verdict` は終了コードと 1 対 1 に対応させる（`ok` は 0、`new-findings` は 1、`undecidable` は 2）。

## 実行の仕方（入出力）

### エージェント用：`scripts/check.mjs`（Node の標準機能だけで書く）

```
node check.mjs --url <URL> [--widths 320,768,1280] [--exclude <CSSセレクタ>]... \
  [--rules R1,R2] [--color-scheme light|dark] [--max-incomparable 0.3] \
  --out <結果.json> [--baseline <基準線.json>] [--update-baseline]
```

- 中では `playwright-cli` の open → goto → run-code → close を呼ぶ。
  run-code に渡すファイルは一時ディレクトリに作り、`detect.js` の中身と引数を埋め込む。
  終了時は、成功しても失敗しても必ず close する。
- `--color-scheme` は `page.emulateMedia` で切り替える。`prefers-color-scheme` で色を変えるアプリにだけ効く。
  クラスや属性でテーマを切り替えるアプリには効かない。

終了コードは次のとおり。

| 終了コード | 意味 |
|---|---|
| 0 | 完了。基準線が無い（初回）か、基準線に無い finding が無い |
| 1 | 基準線に無い finding がある |
| 2 | 判定不能、または道具の失敗 |

### 基準線

- 基準線が無いときは、結果を書いて終了コード 0 で終え、「基準線なし」と表示する。
- 基準線を書くのは `--update-baseline` を付けたときだけにする。自動では更新しない。
- 保存先は呼び出し側が決める。各リポでは `e2e/layout-baseline/` を推奨する。
- 比べるときは、（URL の正規形, 規則, キー, 幅）の組で照合する。
  - 基準線に無い組があれば、終了コード 1。
  - 減った組は報告だけにする。
- 合格の基準を「0 件」にはしない。件数を、成功の条件に書き込まない。

### Playwright のテスト用：`references/playwright-test.md`

- `page.addScriptTag({ path: '<detect.js のパス>' })` で読み込み、`page.evaluate` で呼ぶ helper の例を書く。
- 置き場は各リポの `test:e2e` の入口に限る。`test` の入口や `pretest` からは呼ばない。GitHub Actions でも回さない（DOCS_OPS §6 の MUST NOT）。

### 検出ロジックの正本

検出のロジックは `scripts/detect.js` の 1 ファイルだけに置く。

- `check.mjs` は、このファイルを読んで埋め込む。
- テストの helper は、このファイルを `addScriptTag` で読む。

どちらも中身を写さない。

## 置き場（agent-toolkit `skills/layout-geometry-check/`）

| ファイル | 役割 |
|---|---|
| `SKILL.md` | いつ使うか、手順、出力の読み方 |
| `scripts/detect.js` | 検出の正本。ブラウザの中で動き、依存が無い |
| `scripts/check.mjs` | エージェント用の実行と、基準線との比較 |
| `references/playwright-test.md` | `test:e2e` に組み込む例 |
| `tests/fixtures/*.html` と `tests/fixtures/*.expected.json` | 陽性と陰性の fixture、それぞれが期待する finding の集合 |
| `tests/selftest.mjs` | 自己テスト。fixture を `127.0.0.1` で配って `check.mjs` を当てる |

- `SKILL.md` には次の 2 点を書く。
  - この検査は AI_FIRST §2 の「表示崩れ」の確認を助けるもので、単独で §2 を満たすわけではない。
  - 両方のテーマを確かめるには、`--color-scheme` を変えて 2 回走らせる。
- fixture と自己テストは、**配布物に含める**。使う人が自分の環境で道具が動くこと（陽性の対照）を確かめてから、0 件の結果を信じられるようにするため。中身は小さな HTML と JSON だけにする。
- README の skill の一覧に足す（agent-toolkit AGENTS.md「整合性の維持対象」）。

## 成功基準（rubric）

実装する人が、コマンド単位で合否を判定できる形で書く。

1. **自己テスト**：`node skills/layout-geometry-check/tests/selftest.mjs` が終了コード 0 で終わる。自己テストは次をすべて含む。
   - 規則ごとの陽性 fixture。期待する finding の集合（規則・キー・幅）を `*.expected.json` に書き、検出結果と**集合として一致**する（足りなくても、余っても失敗）。R3 と R4 は `--rules` で有効にして確かめる。
   - 陰性 fixture。どれも finding は 0 件であること。
     - 意図した重なり
     - ellipsis
     - 視覚的に隠す要素
     - 横スクロールの容器
     - `absolute` のバッジ
     - `overflow: hidden` のカルーセル（どの幅でもあふれる作りにする）
     - `fixed` のヘッダー
     - `translateX(100%)` で画面外に置いたメニュー
   - `playwright-cli` が PATH に無いときは、自己テストが終了コード 2 で終わる。
   - 一貫性の対照。幅 320 でだけ崩れる fixture は報告され、どの幅でも崩れている fixture は報告されずに `info.atReference` に出る。
   - 描き直しの対照。幅を変えると要素を描き直す fixture で、`info.incomparable` に件数が出る。割合が上限を超える fixture では終了コード 2。
   - 判定不能の対照。`file:` の URL、404 を返す URL、表示している要素が 0 個のページで、どれも終了コード 2。
   - 基準線の対照。結果と同じ基準線との比較なら 0。結果から finding を 1 件除いた基準線との比較なら 1（結果に、基準線に無い finding がある）。結果に無い finding を 1 件足した基準線との比較なら 0 で、減ったことを表示する。
2. **自己テストが壊れたら気づけること**：`detect.js` の R1 の判定をわざと無効にした版で自己テストを走らせ、終了コードが 0 以外になることを確かめ、結果を PR に記録する（確かめたら元に戻す）。
3. **構造の規約**：次をすべて満たす。
   - `wc -l < skills/layout-geometry-check/SKILL.md` が 500 以下。
   - frontmatter の `description` が 1024 字以内。次のコマンドが出す数が 1024 以下であること。
     `node -e "const s=require('fs').readFileSync('skills/layout-geometry-check/SKILL.md','utf8');console.log([...s.match(/^description:[ \t]*([^\s>|].*)$/m)[1]].length)"`
     - `description` は 1 行で書く。`>` や `|` の複数行の形で書くと、このコマンドは例外で止まり、終了コードが 1 になる。
     - 2026-10-19 に、1 行の場合（212 字を数えて終了コード 0）と、`description: >` の場合（終了コード 1）の両方で試した。
     - 最初の版の正規表現は、`>` の 1 字を数えて終了コード 0 で通っていた。直した版で両方を確かめている。
   - `rg -n 'layout-geometry-check' README.md` が 1 行以上ヒットする。
4. **ゴールシートの完了条件**：Key Commands の `test` と `check` が、どちらも終了コード 0 で終わる。
5. **試走と、規則の既定の決定**：公開されているログイン不要のページ 4 つ（`https://todoke.dev`、`https://docs.todoke.dev`、`https://manako.dev`、`https://docs.manako.dev`）で、3 つの幅とすべての規則（R1〜R4）を走らせる。
   - finding ごとに、要素のスクリーンショットを付けて「崩れ」か「誤検出」かを判定し、理由を表にして PR に載せる。
   - 規則ごとの既定は、誤検出の**割合**で決める。誤検出が、その規則の finding の半分未満なら既定で有効、半分以上なら無効。
   - finding が 0 件の規則は、既定を変えない（R1・R2 は有効のまま、R3・R4 は無効のまま）。
   - 件数そのものは、成功の条件にしない。
6. **配布の確認**（マージのあと、司令塔が行う）：`npx skills add elchika-inc/agent-toolkit -g` を実行したあと、`ls ~/.agents/skills/layout-geometry-check/scripts/detect.js` で実体があることを確かめる。

## やらないこと（v1）

- 画像の比較、a11y の検査（axe）、AI による判断。これらは別の道具が受け持つ。
- GitHub Actions での実行。
- 崩れの自動修正。
- クラスや属性で切り替えるテーマ、ログインしたあとの状態を作ること。
- 親が違う要素どうしの重なり、iframe と閉じた shadow root の中の走査。

## 実装する人が実測して報告すること

- `run-code` の戻り値の大きさに上限があるか。大きなページで結果が切れないか。
- 試走での、規則ごとの誤検出の内訳（成功基準 5）。
- 指示と実態が食い違ったら、止めて報告する。たとえば、次のような場合。
  - `playwright-cli` で `emulateMedia` や HTTP ステータスが取れない。
  - Element の対応表が `evaluate` をまたいで残らない。
