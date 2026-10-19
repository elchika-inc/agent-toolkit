<!-- review-cycle:start 2026-10-19-layout-geometry-check -->
## 2026-10-19 layout-geometry-check の追加

- **Cycle ID**: 2026-10-19-layout-geometry-check
- **対象 HEAD**: 421a661228fc239fbeba6fefdf341baf0dd61325
- **総ラウンド数**: 2
- **終了理由**: 全員 LGTM（初回 flag 1 件を修正後、クリーンラウンドを通過）
- **レンズ別 flag 件数（累計）**: Security 0 / Core Logic 0 / Tests 1 / Domain 0 / Fresh Eyes 0 / Ambiguity - / Altitude -
- **確定した偽陽性**: なし
- **ACCEPTED_RISKS**: なし（未修正 flag なし）
- **INSPECTION_STATUS**: レビュー済み。optional 延べ19件、重複除去16件。再試行の主語、URL保存、エラー出力、要素キー、基準線更新、追加テスト、観測記録の配置など。終了条件には数えず原文を下に保存した。

終了条件と記録形式の正本は [lens-review-cycle](../../../skills/lens-review-cycle/SKILL.md)。レンズは委任仕様の明示指定に従い fresh-eyes → security → core-logic → tests → domain の5つ、最大4ラウンドを採用した。Domain の要求正本は [AGENTS.md のスキル構造規約・整合性の維持対象](../../../AGENTS.md) と [PROJECT_GOAL の P-1〜P-3・C-001](../../PROJECT_GOAL.md)。実装の要求正本は [承認済み設計の成功基準](../../plans/2026-10-19-layout-geometry-check-design.md#成功基準rubric)。

### 実行と入力境界

`perl -e 'alarm shift @ARGV; exec @ARGV' 1800 claude -p --model sonnet --tools ""` に、レンズ指示と `git diff -U20 origin/main...HEAD` の全文を stdin で渡した。別コンテキストで道具を渡さず、応答のレンズ別ブロックを原文のまま保存してから判定した。入力には対象の絶対パス、AGENTS.md、PROJECT_GOAL、司令塔の裁定、検証の実測と未実施条件の理由を添えた。2回目の修正済み事項は末尾へ置き、Fresh Eyes 完成後に参照するよう指示した。

| ラウンド | 対象 HEAD | 入力 bytes | 終了コード | fresh-eyes / security / core-logic / tests / domain の flag | optional提案 |
|---|---|---:|---:|---|---:|
| 1 | 3c9dac6e06dbf1d43714e014aa96e1949088b8f0 | 105466 | 0 | 0 / 0 / 0 / 1 / 0 | 9 |
| 2 | 421a661228fc239fbeba6fefdf341baf0dd61325 | 109028 | 0 | 0 / 0 / 0 / 0 / 0 | 10 |

optional の数は修正を提案した項目を数え、正常性を説明する段落は数えない。ラウンドをまたぐ重複は3件。原文にはそれらの説明段落も含めて残した。

### flag への判断と検証

| 指摘 | 判断 | 変更と実測 |
|---|---|---|
| Round 1 Tests: 陰性の除外条件が壊れても基準幅の候補に吸収され、finding 0件で通る | 修正 | negative の atReference を、意図したカルーセルのR2と意図した重なりのR3の集合に固定。R1ではfixed・横スクロール・クリップ内の各51要素と原因要素を同居させ、除外が50候補の上限を消費しない対照を追加。 |

- R2 ellipsis の除外だけを削除した自己テスト: 余分な R2 が atReference に現れ、集合不一致で終了コード1。
- R1 fixed の除外だけを無効にした自己テスト: 原因要素の finding が失われ、集合不一致で終了コード1。
- 検出器を HEAD のバイト列へ復元して SHA256 `e6434ec52c278aacca5383d8977294ab870c4f6a420fbad76aae4fc343740e1d` と一致させた後、`node skills/layout-geometry-check/tests/selftest.mjs` は21件成功、終了コード0。
- 元の必須故障対照も実施済み: R1全体を無効化した版は r1 fixture の集合不一致で終了コード1、復元後は終了コード0。
- optional は本サイクルで修正対象へ広げず、原文を保持した。flag の格下げ・握りつぶしはない。

### レビュー原文

#### Round 1

```text
<<<LENS_FINDINGS role="fresh-eyes">>>
LGTM／optional: SKILL.md「実行の境界」の「通信が一過性なら最大 2 回まで再試行し」は check.mjs に再試行の実装が無い。エージェントへの運用指示と読めるが、CLI が自動で再試行すると誤読される余地がある。「呼び出し側が最大 2 回まで再実行する」と主語を明記すると誤読を避けられる。
<<<END_LENS_FINDINGS>>>

<<<LENS_FINDINGS role="security">>>
LGTM／optional:
- check.mjs の外部コマンドは `execFile` で shell を介さない。コードへの埋め込みは `JSON.stringify` か検証済みの整数・許可リスト値に限られる。一時ファイルは `mkdtemp` と 0600、結果と基準線の書き出しは `wx` と rename で、`/tmp` 上の既知パスでもシンボリックリンク追従の恐れは無い。
- 公開 JSON の `url` と `finalUrl` は、指定された URL をそのまま保存する。クエリにトークンや `user:pass@` を含む URL を渡すと、推奨運用の `e2e/layout-baseline/` へ保存されコミットされる。保存前に userinfo と query を落とすか、SKILL.md に「秘密を含む URL を渡さない」と一文書くのがよい。
- `cli()` の失敗時は playwright-cli の stdout（先頭 2000 字）が `reason` と stderr に入る。ページ由来の文字列が混ざるため、端末の制御文字を除くとよい。
<<<END_LENS_FINDINGS>>>

<<<LENS_FINDINGS role="core-logic">>>
LGTM／optional:
- R1 は外側の要素から 1 個ずつ単独で非表示にして測る。子だけで文書幅を決めている場合は親と子の両方が finding になり、重複して報告される。fixture は原因が 1 要素なので表面化しない。
- R4 は親が inline か transform 付きだと `elements` に入らず、基準幅の可視集合に載らない。そのため比較可能な候補が黙って捨てられる。R4 は既定無効なので影響は小さい。
- 基準線の URL 正規形は host と pathname のみで、query を無視する。`?tab=a` と `?tab=b` のように別状態を表す URL の基準線が混ざる。
- `--update-baseline` は、既存基準線に対して新規 finding があるときも基準線を上書きしたうえで終了コード 1 を返す。「明示更新で受容する」意図に沿うが、SKILL.md に書いておくと混乱が減る。
<<<END_LENS_FINDINGS>>>

<<<LENS_FINDINGS role="tests">>>
flag 1件
[ISSUE] tests/fixtures/negative.html、tests/fixtures/negative.expected.json、tests/selftest.mjs の `if (expected.atReference)` 付近
- 確信度: 85%
- 問題: 陰性 fixture が R1 の除外ロジックも R2〜R4 の除外ロジックも検証していない。
  - R1: 幅 320 でも `main` は 240px で、fixed の header（2000px）は文書の scrollWidth を増やさない。ゲート `documentWidth() > viewportWidth + 1` がどの幅でも偽になり、候補絞り込み（fixed 除外、祖先のスクロール・クリップ除外）が一度も実行されない。
  - R2〜R4: 規則側が除外するはずの ellipsis、視覚的に隠す要素、line-clamp、absolute のバッジは、レイアウトが幅に依存しないので基準幅でも同じ候補が出る。それらは一貫性の規則で `info.atReference` に吸収されるため、除外が壊れても findings は 0 件のまま。
  - 一方 selftest は `expected.atReference` が無いと `atReference` を比較しないので、negative.expected.json は何も縛っていない。
- 失敗の示し方: 次の改変をしても selftest は exit 0 のままになると推定する。
  - detect.js の R2 から `style.textOverflow === "ellipsis"` と line-clamp の除外を削除する。
  - R2 から 1px 以下と `clip` / `clip-path` の視覚的に隠す要素の除外を削除する。
  - R4 から `absolute` / `fixed` の除外を削除する。
  - R1 の `position === "fixed"` と祖先のスクロール・クリップの除外を削除する。
  - 設計の rubric 1 は「陰性 fixture はどれも finding 0 件」を求めるが、この fixture はどの改変でも 0 件になるため、規則の退行を検出できない。rubric 2 の故障対照も R1 の陽性しか確認していない。
- 修正案:
  1. negative.expected.json に `atReference` を追加する。許す項目は意図的に基準幅で崩れているカルーセルの R2 だけにする。ellipsis、視覚的に隠す要素、line-clamp、absolute のバッジが `atReference` に出たら失敗するようにする。
  2. R1 の除外用に、幅 320 で文書を溢れさせる要素（r1 と同じ `wide`）と、fixed の幅広 header、横スクロール容器、画面外の transform メニューを同居させた fixture を足す。期待 finding は `wide` だけにする。
  3. 除外を 1 つ外した版で selftest が非 0 になることを、R1 の対照と同様に PR へ記録する。

補足（optional）:
- `--max-incomparable` の境界（30% ちょうど）の fixture が無い。redraw-small は 1/13 程度、redraw-large は 3/4 と、閾値から離れた値しか見ていない。
- helper テストの `finally` で `close` が失敗すると、元のアサーション失敗を覆い隠す。
- 未実施の境界・量・SIGINT・ディスク障害は、設計と PR 本文に理由が明記されているので指摘しない。
<<<END_LENS_FINDINGS>>>

<<<LENS_FINDINGS role="domain">>>
LGTM／optional: AGENTS.md のスキル構造規約（frontmatter の `name` と 1 行の `description`、SKILL.md が約 120 行、外部参照は 1 階層、絶対パスは `~/.agents/skills/` のみ）は満たしている。README の一覧へ 1 項目を追加済みで、新規スキルのため plugins への同期コピーと version 更新は不要である。
- R1〜R4 の定義はこの道具が持ち、standards の検査項目は複製していない（P-1）。C-001 の範囲で、N-### と P-# への抵触は無い。
- 設計の「R2 は既定有効」と SKILL.md の「R2 は無効へ変更」は、設計の決定規則（誤検出が半分以上なら無効）に従った試走結果を SKILL.md の表に記録しており、整合している。
<<<END_LENS_FINDINGS>>>
```

#### Round 2

```text
<<<LENS_FINDINGS role="fresh-eyes">>>
LGTM／optional: 確信度80%以上のflagは無い。次の2点はoptional。
- `scripts/check.mjs` 末尾の `--out` フォールバックは、`--out --url x` のように値が欠けた引数でも `process.argv[indexOf("--out")+1]`（この例では `--url`）を出力先として結果を書く。cwd に `--url` という名のファイルができる。引数検証が失敗した場合に限る軽微な挙動。
- `scripts/detect.js` のR1は、外側から順に要素を非表示にして `scrollWidth` の減少を見る。祖先と、原因となる子孫の両方で減少するため、同じ原因が複数のR1 findingとして出うる。キーが別なので基準線の照合は壊れない。
<<<END_LENS_FINDINGS>>>

<<<LENS_FINDINGS role="security">>>
LGTM／optional: 確信度80%以上のflagは無い。
一時ファイルは `mkdtemp`（0700）の中に0600で作り、成功・失敗にかかわらず `finally` で削除する。結果の書き出しも `wx` と rename で行う。外部コマンドは `execFile` で引数配列を渡し、シェルを経由しない。`run-code` に埋め込む値は `JSON.stringify` を通す。`colorScheme` と `rules` は許可リストで検証し、URLは `http(s)` に限定する。
optional:
- 結果JSONと基準線に、指定したURLと最終URLがクエリ付きのまま保存される。基準線はリポジトリへのコミットを推奨している。署名付きURLやトークン付きURLを渡すと、それがコミットに入る。保存時にクエリを落とすか、SKILL.mdで注意を促す案がある。
- `### Error` を検出したとき、`new Error(stdout)` で標準出力の全文を `reason` に入れる。大きさに上限が無く、ページ由来の文字列も入りうる。`resultFrom` と同様に先頭2000文字へ切る案がある。
- `window.layoutGeometryCheck` は書き換え可能なグローバルのため、敵対的なページは結果を偽装できる。検査対象は開発者自身のアプリという前提なので、受容でよい。
<<<END_LENS_FINDINGS>>>

<<<LENS_FINDINGS role="core-logic">>>
LGTM／optional: 確信度80%以上のflagは無い。
規則R1〜R4、基準幅とのシグネチャ照合、DOMに存在しない要素の割合による判定不能、終了コード0/1/2とverdictの対応、(URL正規形, 規則, キー, 幅)の組による基準線比較は、設計と実装が整合している。
optional:
- キーの衝突: 同じホストの light DOM の子と、その shadow root 直下の子が同じ `tag:nth-of-type(n)` の連なりになる。`div:nth-of-type(1)` が2つあると同じキーになり、基準線の照合で2要素を区別できない。まれなケースで、shadow 内のキーに印を付ければ避けられる。
- `--update-baseline` を付けて、既存の基準線に無い新規 findings がある場合は、基準線を保存したうえで終了コード1を返す。保存後に1が返ることを、SKILL.mdの手順4に一言書くと誤読を防げる。
- R2〜R4で、基準幅では `inline` や `transform` で対象外だった要素が、狭い幅で対象になると `invisibleAtReference` に数えられる。名前と中身が少しずれるが、finding を抑えて件数を出す動作は設計意図どおり。
<<<END_LENS_FINDINGS>>>

<<<LENS_FINDINGS role="tests">>>
LGTM／optional: 確信度80%以上のflagは無い。
fixtureごとに `expected.json` の集合一致（足りなくても余っても失敗）、`atReference` と `incomparable` と `unscanned` の照合、陰性fixture、`r1-exclusions`（除外が壊れると50候補の上限で原因要素を見失う）、判定不能の対照、基準線の3方向、PATHに `playwright-cli` が無い場合を備えている。R1の故意の無効化で集合不一致になり、復元後は通ることも確認済み。
optional:
- `--color-scheme dark` の検証は終了コード0だけで、`prefers-color-scheme: dark` が実際に適用されたかを見ていない。dark のときだけ崩れる fixture を1つ足せば、`emulateMedia` の無効化も検出できる。
- 未実施の境界と量（50候補・200子の厳密境界）、SIGINT中断、ディスク障害は、コードレビュー対象として理由が明記されている。PR本文への記載が条件。
<<<END_LENS_FINDINGS>>>

<<<LENS_FINDINGS role="domain">>>
LGTM／optional: 確信度80%以上のflagは無い。
- 構造規約: SKILL.md は119行で、500行以下を満たす。frontmatter の `description` は1行で、トリガーとなる依頼語を含み、三人称形式で、1024字以内。外部参照は `scripts/`・`references/`・`tests/` の1階層。エージェント固有の絶対パスは無く、`~/.agents/skills/` だけを参照している。
- 同期対象: README のスキル一覧に1項目を追加した。`lens-review-cycle` と `product-design-lens` の同期コピー、`plugins/` の version は対象外で、今回触っていない。
- ゴールシート: P-1 については、R1〜R4 の定義をこのスキルが道具の正本として持つ。standards の検査項目の複製ではなく、standards は参照にとどめている。C-001 の範囲に入り、N-### と P-# には反しない。
optional:
- SKILL.md に、日付付きの試走結果の表（todoke.dev ほか4ドメイン）が入っている。AGENTS.md は、時点に依存する観測記録を `.docs/reviews/` に置く構造にしている。配布物に入れると、更新に追従しない記述になりうる。結果表は reviews に移し、SKILL.md には既定を決めた根拠への参照だけを残す案がある。
<<<END_LENS_FINDINGS>>>
```

<!-- review-cycle:end 2026-10-19-layout-geometry-check -->
