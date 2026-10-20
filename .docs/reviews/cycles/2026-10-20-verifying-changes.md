# verifying-changes のレビュー記録（2026-10-20）

対象は承認済み `2026-10-20-agent-operation-check-plan.md` の Task 1〜5。判定基準は同計画の Interfaces・Global Constraints・Review Focus、`2026-10-20-agent-operation-check-design.md` §6.3・§6.8、委任仕様 §5 に従う。配布の基準は `AGENTS.md`「スキルの構造規約」「整合性の維持対象」、`PROJECT_GOAL.md` の C-001・P-1・DoneCriteria。

一名の Sonnet レビュアーに、計画・正しさ・信頼境界と秘密・テスト・配布の順でレンズを適用した。各呼び出しは独立した文脈、ツール無し。Task を分割して直列実行し、入力は毎回 `wc -c` で 150000 バイト以下を確認した。原文を下に保存する。最大 3 ラウンド、flag のみを終了判定に用い、optional は受容した欠陥と混同しない。

実行方法:

```bash
perl -e 'alarm shift @ARGV; exec @ARGV' 900 claude --print --model sonnet --tools '' --strict-mcp-config --no-session-persistence --safe-mode < input.md > raw.md
```

## 初回の差分と結果

| Task | 差分 | 入力バイト数 | flag |
|---|---|---:|---:|
| 1 | origin/main...e6ca39c | 94888 | 0 |
| 2 | e6ca39c..f9cc910 | 99528 | 2 |
| 3 | f9cc910..dc673aa | 72683 | 2 |
| 4 | dc673aa..ced2c48 | 106201 | 1 |
| 5 | ced2c48..fad39c6 | 90620 | 0 |

## 再レビューの入力

| 対象 | 入力バイト数 | exit |
|---|---:|---:|
| R2 Task 1 | 114996 | 0 |
| R2 Task 2 | 127676 | 0 |
| R2 Task 3 | 83612 | 0 |
| R2 Task 4 | 117679 | 0 |
| R3 Task 4 と production-guard reference | 127057 | 0 |

初回もすべて exit 0。900秒の上限での打ち切りは発生しておらず、再試行は無い。再レビューは対象 Task のファイルの最終差分、直前のレビュー原文、修正と実測、追加裁定を渡した。

## 対応した指摘

- R1 Task 2 F-1: まとめ作成失敗時は本文を完了扱いにせず、再開時にリンクを補う。実測で判定が変わった場合も、現在の本文と今回の内容を比較して再編集する。published の形式と planOperations の契約は維持。追加した再開 2 ケースで RED を観測し、修正後に成功した（6129fdf）。
- R1 Task 2 F-2: createGh の dry-run 書き込み拒否、read の書き込み系引数拒否、署名付き URL による publish 停止、render の伏せ字を直接テストした。読み取りが fake に届く陽性対照も置いた。すべて合成値と fake-gh（6129fdf）。
- R1 Task 3 F-1: 無視された依存ファイルの一覧を全件取得せず、Git の pathspec で `.env*`・`.dev.vars*` に限定。合成パス一覧が 1 MiB を超えることを測り、旧実装の exit 1 を観測してから修正した。新しい出力上限は 8 MiB、超過は失敗として扱う（6129fdf）。
- R1 Task 3 F-2: `--secret-files` の相対パスを inspect の前に検査する。絶対パス・親ディレクトリ指定が exit 1 になる RED を観測し、修正後は exit 2（6129fdf）。
- R1 Task 4 F-1: 計画のテストを維持し、有効な query と mutation の混在拒否、および同じ query だけの許可を追加。「最初の query で早期 return true」する変異では新しい混在テストだけが失敗した。復元後 guard 17/17、全体 184/184 成功。変異は commit していない（c9209b7）。

自己確認でも、設計 §6.3 の判定表にない environment/declaration の分類だけによる undetermined 条件と、分類名だけだった判定理由を修正した。追加 3 ケースで RED→GREEN を観測し、初回 flag 0 の Task 1 も再レビューした（1942208）。初回 Task 1 原文の末尾にある「environment/declaration は undetermined が計画どおり」という記述は、判定表との照合で訂正した。

Task 3 O-1（cleanup の cwd）は Task 5 の手順に明記済み。O-2（session 部分一致）は Task 4 で共通 listSessions に移行し、実ブラウザを別 cwd から一覧取得する試験で確認済み。内部モジュール io.mjs と sessions.mjs の追加は委任仕様 §2-10 の裁量であり PR に申告する。Task 4 R2 N-1（普通の検索 query の過剰拒否）は仕様の解釈差として司令塔へ ask で報告し、下の追加裁定で解消した。それ以外の optional は原文に残し、今回の修正対象にしない。

## GET の query に関する追加裁定

Task 4 Interfaces の GET 許可条件について、通常の検索値も GraphQL の構文検査で止める実装が過剰だったため司令塔へ確認した。司令塔は、GET・HEAD・OPTIONS の全 query 値を URLSearchParams で一度デコードし、`\b(mutation|subscription)\b`（大文字小文字を区別しない）に当たれば止め、語が無ければ解析可否を問わず通すと具体化した。mutation/subscription は操作の種類の語を省略できないことが根拠。文字列・コメント・検索語の中の該当語でも停止することは許容する。POST 等の本文の規則は維持した。

shoes の許可と HEAD/OPTIONS の操作語停止が旧実装で RED、修正後に全 190 テストが成功した。MCP 34 テスト・Biome 12 ファイル/4 warnings も再実行して exit 0（c67fa09）。Task 4 と production-guard reference を第3ラウンドで再レビューした。

## 第3ラウンドの追加 flag と終了判断

Task 4 R3 F-1（確信度85%）は、bare の SHA 不一致テストが gh の SHA も同時に不一致にしていたため、Git 側の照合を独立に検査できない指摘だった。テスト名と期待を維持し、一時 worktree で別の合成 commit を作って一時 bare の production だけを更新した。gh と expect-sha は元の SHA を保ち、両系統の測定値も assert した。

productionSha の比較だけを実装から外す一時変異で、このテストが exit 0 を返して期待の exit 1 に反し RED になることを実測した。復元後は全190テスト成功。実装の変更は無く、変異は commit していない。委任仕様 §5 は最大3ラウンドで、上限時の残りを「直す」か「受容」として判断する規定のため、F-1 は修正を選び、再現可能な変異検査で修正を確かめて終了した。第4ラウンドは行っていない。未修正 flag の受容は無い。

## INSPECTION_STATUS

| 対象 | 最終レビューと処理 | optional の記録 |
|---|---|---|
| Task 1 | R2 flag 0 | optional 6件: 入力境界・測定値の形・指紋等 |
| Task 2 | R2 flag 0、R1の2件は修正確認済み | optional 14件: 本文の同時編集・目印・再試行等（再掲を含む） |
| Task 3 | R2 flag 0、R1の2件は修正確認済み | optional 4件: 到達先・未検査条件・依存内env等 |
| Task 4 | R2 flag 0。裁定反映後のR3 flag 1はテスト入力を修正し変異検査で確認。上限により追加レビュー無し | optional 新規5件と既出11項目の再掲: 遷移・時間・session・秘匿・未検査条件等。GETのN-1は裁定で対応済み |
| Task 5 | R1 flag 0。production-guard referenceの追加変更はR3で確認 | optional 4件: referenceリンク・宣言境界・将来移管等 |

optional は各原文の識別子単位の報告で、同一内容の再掲や条件付き指摘を含む。件数を未受容欠陥数とは扱わない。詳細と継続・解消の観測は以下の原文と上の対応記録に残す。ACCEPTED_RISKS: 無し（flag の欠陥受容は行っていない）。

## 検証の範囲

計画 Task 4 Step 5 の guard 常時 allow 変異では 26 テストが失敗し、復元後 171/171 成功。追加裁定に従い、リダイレクトの旧 continue と fetch→fulfill は移動先到達が各 1 件になることを実測し、停止する実装では 0 件。テストの通信先は 127.0.0.1 の一時サーバーのみ。ブラウザは実際に起動し、GitHub は fake-gh、production の remote は一時 bare リポジトリを用いた。本番・実 GitHub の publish 動作は未実施。

MCP は 1 ファイル・34 テスト、Biome は 12 ファイル・4 warnings でともに exit 0。UI を持たない変更のため、委任仕様 §5 の収束の対 ② は N/A。

## 原文 R1 / Task 1

```markdown
# レビュー報告: Task 1（結果のファイル・分類・判定・指紋）

## 総評
flag は全レンズで 0 件です。optional は 7 件あります。

見たもの:
- `results.mjs`、`triage.mjs`、`fingerprint.mjs` と `references/results.md`
- テスト 3 ファイルと `helpers.mjs`、fixture

計画に書かれた Interfaces、分類と判定の順序、テスト名は一致しています。計画のテスト名はすべて存在し、名前も「条件 → 期待」の形です。

## レンズ別の結果

### 1. 計画・設計との一致: flag 0
- エクスポート名と引数は計画どおりです。`ResultsError` の message は `場所: 理由` で、`findings[0].headRuns` のような場所を含みます。
- 分類の順序は、category、回数がそろっているか、head の回数、比較の相手の回数の順で、計画と同じです。C は比較の相手を見ず、symptom の `expectation` / `console` / `network` だけを `production-failure` にします。
- 判定は「reject → undetermined → approve」の順です。A・B は preflight と reach、C は production だけを見ます。C の回数照合（`reruns`）、`remote` / `ghBin` の固定、`budgetExceeded` もあります。
- `baseRuns` を求める条件（A・B で product かつ head の occurred が 1 以上）と、timedOut / aborted のときだけ回数不足を許す規定は、そのとおり実装されています。
- テストは、計画の分類 15、判定 31 前後、指紋 8、結果 15 がそろっています。

### 2. 正しさ: flag 0
- 必須の `headRuns` / `baseRuns` を省略（key なし）した場合も `オブジェクトが必要` になり、場所を名指しして止まります。
- `incomplete` は reject にならず、undetermined にしか効きません。
- C の `targets[].skipped` が undefined でも「スキップ扱い」に倒れ、止まる側です。
- `reruns` が無い、または対象が `targets` に無い場合は 0 と比較して不一致になり、止まる側です。
- `normalizeSurface` が URL を解析できないときと `decodeURIComponent` が失敗するときは、`ResultsError` になります。
- `finding.id` は `[\w-]+` で一意に制限されています。後続の `reruns/<id>-<n>` で経路が壊れません。

### 3. 信頼境界と秘密: flag 0
- `ResultsError` のメッセージは場所と固定の理由だけで、入力値やファイルパスを出しません。
- この Task に `gh` の呼び出しや書き込みはありません。
- `evidence` と `matrix[].evidence` は、絶対パス、`\`、`..` を拒否します。
- C の判定は、確認役が写した値ではなく `measured`（実測）で SHA・remote・自己確認・回数を照合しています。

### 4. テスト: flag 0
- 陽性対照があります。「成功基準でない行の skip だけ → approve」と「C で … 正常 → approve」が基準になるので、他の undetermined テストは正しい理由で落ちます。
- 一時ディレクトリは `t.after` で片付けています。`helpers.mjs` は glob に当たりません。
- 以下は optional です。

### 5. 配布: flag 0
- 構造は `scripts/lib`、`references`、`tests/fixtures` の 1 階層で、規約に沿っています。
- fixture と `results.md` は合成値だけで、機械固有のパスや実データはありません。
- `~/.claude/skills` などのエージェント固有パスもありません。
- P-1 については、`results.md` は道具が検証する形式の説明にとどまっています。

## optional（直さなくてよい。確信度は「flag にすべき」度合い）

- **O-1**
  - 対象: `tests/results.test.mjs` / `results.mjs` の `relativePath`
  - 内容: `evidence` の拒否（`/abs`、`../x`、`a\b`）にテストがありません。この検証を外しても全件 pass します。
  - 影響: 将来 `publish.mjs` が添付で置き場外のファイルを読む経路の第一の防壁です。回帰の検知が無くなります。
  - 提案: 「evidence が `../x` → ResultsError で `findings[0].evidence[0]` を名指し」を 1 件足す。
  - 確信度: 60。計画に列挙が無く、Task 2 の側でも防ぐ前提のため flag にしません。
- **O-2**
  - 対象: `tests/results.test.mjs`
  - 内容: CODING 5.2 の「不正な入力」「境界」が一部しかありません。壊れた JSON、存在しないファイル、`tried: 4`、`occurred > tried`、SHA の桁違い、`id` の重複、`finishedAt < startedAt` が未テストです。
  - 提案: 表駆動で 1 件にまとめる。
  - 確信度: 50。
- **O-3**
  - 対象: `tests/triage.test.mjs` の「C で production.guardSelfCheck のどれかが false」
  - 内容: `mutationBlocked` しか試していません。`postBlocked` / `getAllowed` を `every` から外しても pass します。
  - 提案: 3 キーを `for` で回す。
  - 確信度: 55。
- **O-4**
  - 対象: `results.mjs` の `runs()`
  - 内容: `required` でない値は、partial でなくても `tried` が 0〜3 のものを受理します。例は head 0/3 の発見の `baseRuns: {tried:1}` です。分類はこれを見ないので無害です。
  - 提案: 現状維持でよい。
  - 確信度: 20。
- **O-5**
  - 対象: `triage.mjs` のバグ修正判定 `/^fix[:(]/`
  - 内容: `fix!:` や大文字の `Fix:` は対象外です。計画は `fix:` / `fix(` と明示しているので、変更しません。記録だけです。
  - 確信度: 30。
- **O-6**
  - 対象: `unverified[].declaredUnverifiable`
  - 内容: 判定に使われていません。`false` の未確認項目があっても approve になりえます。設計 §6.3 の表は提示されていないため、欠損とは断定しません。
  - 提案: 設計に「宣言なしの未確認は undetermined」があるなら、Task 2 以降または追加の修正で扱う。
  - 確信度: 40。
- **O-7**
  - 対象: `fingerprint.mjs` の `normalizeSurface`
  - 内容: 同じ query キーが重複すると（`a=1&a=2`）`a=:param&a=:param` になり、単一のものと別の surface として扱われます。URL の hash は落とします。
  - 影響: 指紋の揺れが起きる程度で、低リスクです。
  - 確信度: 25。

## 補足
計画で明示された振る舞い（reject 優先、`production-observation` は approve、environment / declaration は undetermined など）は変更を求めていません。
```

## 原文 R1 / Task 2

```markdown
# レビュー報告: Task 2「GitHub への書き込み」

## 総括
- flag は 2 件です。F-1 は正しさ、F-2 はテストのレンズに出しました。
- 計画との一致、信頼境界、配布は flag 0 です。
- 見たのは差分だけです。実行はしていません。Task 1・3・4 のコードは推測していません。

## レンズ1: 計画・設計との一致 — flag 0
- 次の項目は計画の Interfaces と一致しています。
  - `createGh` / `fetchRemote` / `planOperations` / `render*` / `replaceBodySection` / `extractAttachmentUrls` のシグネチャ。
  - 操作の並び: ラベル → 添付 → Issue → まとめ → 本文。
  - 添付は 50 枚ずつ。
  - Issue の選択規則: 開いているもの優先、次に createdAt 降順。
  - CLI の引数と exit 0/1/2。
  - `published.json` のスキーマ。
  - 各操作で使う `gh` の引数。
- テストの名前は計画の plan 22、render 8、fake-gh 8、publish 10 が全部あり、期待も一致しています。
- 計画に無いファイル `scripts/lib/io.mjs` が増えています。内部の分け方は委任仕様 §2-10 で裁量の範囲です。ただし PR 本文の「判断したこと」に載せる必要があります（optional O-1）。

## レンズ2: 正しさ — flag 1

### F-1【flag】`edit-body` が「まとめ: （未投稿）」のまま `bodyEdited=true` を記録し、やり直しでも本文が直らない
- 場所: `skills/verifying-changes/scripts/publish.mjs` の `edit-body` 分岐（`link` の組み立てと `published.bodyEdited = true`）と、`skills/verifying-changes/scripts/lib/plan.mjs` の `published?.bodyEdited ? [] : …`。
- 発火条件:
  1. まとめの作成が失敗する。これは計画のテスト「まとめの作成が失敗 → ほかの操作は続ける」と同じ状況です。このとき `published.summaryCommentId` は null のままなので、本文には `まとめ: （未投稿）` が書かれ、`bodyEdited=true` が保存されます。
  2. 運用者が `--write` をやり直すと、まとめは作られます。しかし `edit-body` は `bodyEdited` を理由に計画から消えます。
  3. 同じ runId のやり直しで `reach.json` や `reruns` が増え、判定が変わるときも同様です。まとめは `update-summary` で直りますが、本文の判定は古いまま残ります。
- 影響: 昇格 PR の本文は人が承認を判断する場所です。そこにリンク無しの欄や古い判定が固定されます。まとめコメントと本文で判定がずれ、止める側に倒れません。
- 根拠: `link` は `published.summaryCommentId` が無いと「（未投稿）」になります。その状態でも `published.bodyEdited = true` を立てます。`plan.mjs` の末尾は `bodyEdited` があれば本文の操作を出しません。
- 確信度: 80%
- 最小修正: `published.bodyEdited = true` を、実際に書いた内容にまとめのリンクが入っていた場合だけにします（`published.summaryCommentId` がある場合）。判定が変わる可能性まで直すなら、`bodyEdited` を真偽でなく「書いた content のハッシュ」にして、同じ content のときだけ飛ばします。計画のテスト（本文の編集は続ける・exit 1）は変えずに済みます。

その他は問題なしと見ました。
- 空・不正入力: 空の `gh api --paginate` 出力は例外にします。結果が不正なら GitHub を呼ばずに exit 1 です。
- `issuesComplete=false` でも、開いている Issue へのコメントは出し、起票は止めます。
- `replaceBodySection` のオフセット計算（挿入・置換・見出し無しの `null`・片側だけの目印の `null`）は、テストと一致しています。

## レンズ3: 信頼境界と秘密 — flag 0
- `read()` は許可リストの既知の形だけを通し、それ以外は拒否します。`write()` は `write:false` で例外になります。
- 署名付き URL は 3 箇所で止めています。
  - `results` 全体を事前に検査して拒否する。
  - 描画の `plain()` で `redact` する。
  - 添付の URL は `github.com/user-attachments/assets/` だけを採用する。
- 添付は `realpath` で out ディレクトリ配下かを確かめ、`#` と改行を含む名前を拒否します。
- エラー出力は定型文で、`gh` の応答を出しません。
- `execFile` を使い、シェルを通しません。秘密は argv に載りません。

以下は optional です。

- **O-2** `plain()` は HTML コメント `<!--` を無害化しません。発見の本文（`actual` など）に、ページ由来の `<!-- verifying-changes:fp=… -->` が混ざる可能性があります。その場合、`plan.mjs` の `issue.body.includes(marker)` に別の Issue が一致します。いまの対策は一部だけです。まとめと添付の照合は 1 行目の完全一致なので、これは起きません。起きうるのは Issue の指紋照合だけです。確信度は 50% 前後です。提案は `plain` で `<` を `&lt;` にすることです。
- **O-3** 添付コメントとまとめコメントの照合は、コメントの投稿者を見ません。公開リポジトリで第三者が同じ目印のコメントを置くと、添付 URL の取り込みや `update-summary` の対象に影響します。実行先は非公開リポジトリが主なので低優先です。
- **O-4** `edit-body` は処理開始時に取った `prBody` 全体で上書きします。添付に時間がかかると、その間の人の編集を失います。書く直前に本文を取り直すことを勧めます。

## レンズ4: テスト — flag 1

### F-2【flag】明示要件のガードにテストが無い（壊しても全件が通る）
- 場所: `skills/verifying-changes/scripts/lib/gh.mjs` の `createGh`（`isRead` による `read()` の拒否、`write:false` の `DryRunWriteError`）、`skills/verifying-changes/scripts/publish.mjs` の署名付き URL 検査、`skills/verifying-changes/scripts/lib/render.mjs` の `redact`。
- 状況:
  - `fake-gh.test.mjs` は `createGh` と `DryRunWriteError` を import していますが、使っていません。`createGh` を直接呼ぶテストが無いということです。
  - dry-run のテストは、fake が書き込み 0 回を記録したことしか見ません。publish.mjs 側が `if (!options.write) continue;` で先に抜けるため、`createGh` の dry-run ガードを外しても落ちません。
  - `read()` が書き込み系の引数を拒否する分岐も、誰も通りません。
  - 署名付き URL を含む結果で exit 1・GitHub 呼び出し 0 になる経路も、描画での削除も、テストがありません。
- 影響: どれも Interfaces か Global Constraints に書かれた要件で、秘密と書き込みの境界です。回帰しても検知されません。CODING 5.2 の「不正な入力」と「状態」に当たります。
- 確信度: 80%
- 最小修正（計画のテスト名は変えずに追加する）:
  - `createGh({write:false}).write([...])` が `DryRunWriteError` を投げ、fake が呼ばれない（状態ファイルに calls が無い）こと。
  - `createGh().read(["pr","merge","1"])` が拒否されること。
  - `results` の発見に `https://private-user-images.githubusercontent.com/x?jwt=y` を入れると exit 1 で GitHub 呼び出しが 0 になること。
  - `renderSummary` と `renderIssue` が、`redact` 対象の文字列を `[署名付き URL を削除]` に置き換えること。

以下は optional です。

- **O-5**「コメントが 100 件超」は、`--paginate` の引数が付くことしか見ていません。複数ページの出力（`[..][..]`）と、文字列中の `]`・エスケープ引用符を `pages()` が正しく扱うかは未検証です。`pages` を export するか、fake に 2 ページ返させる状態を足すことを勧めます。
- **O-6** 読み取りの再試行（2 回まで）は、失敗後に成功するケースも、上限で失敗するケースも未検証です。
- **O-7** dry-run のテストは「`planned-operations.json` が配列であること」しか見ません。空の計画でも通るので、非空の陽性対照を足すと強くなります。
- **O-8** `fake-gh.test.mjs` に未使用の import があります。`plan.test.mjs` にも未使用の `issue` と `published` がありますが、Biome の対象外なので実害はありません。
- **O-9** `fake-gh.mjs` の `readOnly` は `gh.mjs` の `isRead` の複製です。同じ誤りがあると、陽性対照も同じ側に倒れます。

## レンズ5: 配布 — flag 0
- `fake-gh.mjs` のモードは `100755` で、shebang もあります。
- Node の組み込みモジュールだけを使っていて、`package.json` や外部依存はありません。
- 差分に `~/.claude/skills` などの環境固有パスはありません。
- ファイル名は ASCII の kebab-case です。
- テストの cwd は一時ディレクトリです。
- P-1 に反する規則の複製は見当たりません。

## 補足の optional
- **O-1** `io.mjs` の追加を PR 本文の「判断したこと」に載せてください。
- **O-10** 上限で起票しなかった発見や「既知」の通知は、`published.issues` に `known` が入った後のやり直しで、まとめから文言が消えます。リンクは残るので表示だけの差です。
- **O-11** `gh.write` の 60 秒のタイムアウトに対して、50 枚の添付は長い可能性があります。タイムアウトは目印の照合で回復しますが、毎回失敗するなら延長か分割を検討してください。
- **O-12** `comment-issue` は、書き込み成功後に `published.json` の保存で落ちると、やり直しで同じコメントが重複します。目印がコメントに無いためです。許容できる程度です。
```

## 原文 R1 / Task 3

```markdown
# レビュー報告: verifying-changes Task 3（点検・到達・片付け・署名付き URL 検査）

flag は 2 件、optional は 6 件です。

## レンズ別の件数

| レンズ | flag | optional |
|---|---|---|
| 1. 計画・設計との一致 | 1（F-2） | 1（O-1） |
| 2. 正しさ | 1（F-1） | 2（O-2, O-3） |
| 3. 信頼境界と秘密 | 0 | 1（O-4） |
| 4. テスト | 0（F-1 の再現テスト欠如は F-1 に含める） | 2（O-5, O-6） |
| 5. 配布 | 0 | 0 |

レンズ 3 と 5 に flag はありません。

- **レンズ 3:** 4 スクリプトとも `gh` や GitHub 書込みを呼びません。秘密の中身は出力しません。stdout は「通過/未通過」と、`scan-artifacts` の相対パスと規則名だけです。
- **レンズ 5:** ファイル名は ASCII の kebab-case です。`package.json` もありません。

## flag

### F-1 `preflight.mjs` の `secretFiles`（`cleanup-check.mjs` も `inspect` 経由で同じ）: 依存を入れた実 worktree で必ず点検が落ちる

- **トリガー:** `node_modules` などの無視ディレクトリが大きい worktree で、`git ls-files -oi --exclude-standard -z` を `promisify(execFile)` で実行する場面です。
- **事実:**
  - `--directory` を付けない `-o -i` は、無視ディレクトリの中の全ファイルを列挙します。
  - `execFile` の既定 `maxBuffer` は 1 MiB です。1 件が約 65 バイトなら、約 1.6 万ファイルで超えます。
  - Next や wrangler を使う一般的なリポジトリは、依存を入れると 2〜6 万ファイルになります。
- **影響:**
  - `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` で `inspect` の try が失敗し、理由は「点検に失敗」だけになります。`preflight` は常に exit 1 になります。
  - 片付けも同じ理由で常に未通過です。確認が最後まで進まず、自動拾いの要件も実環境で満たされません。
  - fail-closed なので安全側には倒れますが、仕組みが使えません。
- **テスト:** 今のテストは無視ファイルが 2 つしかなく、これを検出しません。
- **確信度:** 85%
- **最小修正:**
  - pathspec で出力を絞ります。`git ls-files -oi --exclude-standard -z -- ':(glob)**/.env*' ':(glob)**/.dev.vars*'`
  - 念のため `maxBuffer` も引き上げます。
  - 回帰テストを足します。無視ディレクトリに長い名前のファイルを多数作り（合計で 1 MiB 超）、`.dev.vars` も 1 つ置きます。`ok` が true になり、`.dev.vars` を拾うことを期待値にします。

### F-2 `preflight.mjs` の `secretFiles` と `main`: `--secret-files` の不正値（絶対パス・`..`）が exit 2 にならない

- **トリガー:** `--secret-files /abs/x` または `--secret-files ../x` を指定したとき。
- **事実:**
  - `ArgumentError` は `inspect` の try/catch に飲まれ、固定の理由「点検に失敗」になります。
  - 結果は exit 1 です。引数の誤りは exit 2 とする計画の CLI 規定と食い違います。
  - 不正な指定を出力 JSON が「HEAD や状態の点検失敗」と区別できません。
- **影響:** 呼び出し側が引数ミスと環境の問題を区別できません。安全性は保たれます（読み取り自体は拒否されます）。
- **確信度:** 85%
- **最小修正:** `main` で `--secret-files` を分割し、`inspect` を呼ぶ前に絶対パスと `..` を `ArgumentError` として検査します。

## optional（直さなくてよい）

- **O-1 `cleanup-check.mjs` の worktree を cwd から取る点:**
  - 計画の CLI に `--worktree` が無く、`preflight.json` の項目にも worktree が無いため、cwd 前提は計画内の決定として妥当です。
  - Global Constraints は「ブラウザ道具の cwd は worktree の外」と定めており、同じ手順で cleanup-check を証跡の置き場から呼ぶと、必ず未通過（fail-closed）になります。
  - Task 5 の `SKILL.md` に「`cleanup-check` だけは worktree を cwd にする」と明記するとよいです。
- **O-2 `browserClosed`（`cleanup-check.mjs`）:**
  - `playwright-cli list --all` の引数と出力形式の仮定は、このレビュー入力では実測が示されていません。
  - `stdout.includes(session)` は部分一致です。`s1` と `s10` を区別できず、閉じた session が一覧に残る形式なら常に false になります。
  - 誤りは止める側に倒れます。
- **O-3 `reach-check.mjs`:**
  - 同じ `--url` に `--origin` を 2 回指定すると、後者で黙って上書きされます。
  - 3xx（`redirect: "manual"`）と 4xx は、Origin 指定が無ければ `ok: true` です。計画は 5xx と無応答だけを不可としているため、計画どおりです。
  - 3xx を到達とみなす点は `SKILL.md` に一言あるとよいです。
- **O-4 `reach-check.mjs` に host の許可リストが無い点:**
  - 任意の http(s) URL へ GET を送れます。書込みではなく、`redirect: "manual"` なので追従もしません。
  - ただし設計 §6.8 の「本番に触れるのは確認用スクリプトだけ」の枠から外れる使い方ができます。`SKILL.md` に「宣言した dev の URL だけ」と書いておくとよいです。
- **O-5 テストの条件（CODING 5.2）:** 次は未テストです。PR 本文の「外した条件と理由」に書くか、テストを足してください。
  - 不正な入力: 不正なポートや SHA での exit 2。
  - 失敗: `lsof` が stderr を出す場合、`reach-check` の 5xx、安全でない URL の拒否。
  - `--session` ありの `browserClosed`。偽の `playwright-cli` を PATH に置き、true と false の両方を、陽性対照とあわせて確かめます。
  - `scan-artifacts` の `X-Amz-Signature=` だけの規則（今のテストは 2 規則を同時に含む）、サブディレクトリ、シンボリックリンクでの exit 1。
- **O-6 テストの体裁:**
  - 各テストファイルに未使用の import があります（`main`、`repository`、`listen`、`freePort`、`temp` など）。
  - `scan-artifacts` のテストは、使わない `repository`、`listen`、`freePort` も読み込んでいます。
  - 動作には影響しません。Biome の対象外です。

## 補足（問題なしの確認）

- `lsof` の判定: exit 1 かつ空 stdout だけを空きとします。stderr あり、exit が 0 と 1 以外、コマンド無し（ENOENT）、タイムアウトは、いずれも `listening: null` です。`cleanup-check` の `portsReleased` はこの `null` を false にするので、止める側に倒れています。
- `cleanup-check` の `ok` 判定: `browserClosed` の `null` だけを許し、他の false はすべて不合格にします。
- 秘密の比較: 新規に現れた `.env*` と、削除されたファイルの両方を差分として検出します。
- `scan-artifacts`: 出力は相対パスと規則名だけです。シンボリックリンクと非通常ファイルは、中断して exit 1 にします。
- 一時ディレクトリ: テストはすべて `os.tmpdir()` 配下で行い、worktree に `.playwright-cli/` は残りません。
```

## 原文 R1 / Task 4

```markdown
# レビュー報告: Task 4（本番の読み取りだけの確認）

対象は `production-check.mjs`、`lib/guard.mjs`、`lib/sessions.mjs`、`cleanup-check.mjs` と `io.mjs` の変更、`fake-gh.mjs`、テスト 2 本、fixtures です。ツールは使わず、提示された差分と仕様だけで読みました。

## 結果の要約

| レンズ | flag |
|---|---|
| 1. 計画・設計との一致 | 0 |
| 2. 正しさ | 0 |
| 3. 信頼境界と秘密 | 0 |
| 4. テスト | 1（F-1） |
| 5. 配布 | 0 |

optional は 8 件です。

## レンズ 1: 計画・設計との一致（flag 0）

- **Interfaces:** `judgeRequest`（自己完結。`toString` で埋め込み、`new Function` で再構築するテストあり）と `listSessions(prefix)`（`scripts/lib/sessions.mjs`）は計画どおりです。
- **CLI:** 引数の名前と必須・任意の区別、`--budget-seconds` の既定 1200、exit 0 / 1 / 2 の使い分けは計画どおりです。
- **出力:** `production-log.json` の項目（`deployCheck`、`guardSelfCheck`、`budgetExceeded`、`sessionClosed`、`requests`、`targets` の各項目）は過不足がありません。
- **session 名:** `vc-<runId>-main` になります。作る前に `listSessions` で重複を確かめ、既存の session は閉じません。
- **テスト名:** 計画の guard 15 件、production-check 14 件、追加裁定 4 件がすべて存在します。名前も期待も一致しています。
- **追加裁定:** 3xx は `maxRedirects: 0` で取得して abort します。main frame なら `status` / `location` を記録し、`selectorsFound` は null にします。サブリソースは blocked と reason に残します。裁定の 1 と 2 に一致します。
- **未提示分:** 裁定の 4（`references/production-guard.md` と SKILL.md の C 節への記載）はこの差分に無く、Task 5 の範囲と見ます。欠損とはしません。Task 5 のレビューで、裁定 4 の文が両方に入っているか確かめてください。

## レンズ 2: 正しさ（flag 0）

- **fail-closed:** 次のものは、解析できない・判定できないとき止める側に倒れます。
  - GraphQL パーサ（`query` 以外の operation、空の selection、128KB 超、`query` の無い本文）
  - JSON の配列
  - 空配列（`queries.length` の確認で止まる）
  - 資格情報つき URL、http(s) 以外の scheme
  - `allowHosts` の完全一致（port を含む）
  - 本番の SHA 照合
- **アーキテクチャ:** 次の点が揃っています。
  - 自己確認は本番と同じ `pageCode` を通ります。
  - 自己確認が不一致なら、本番の対象を開く前に止まります。
  - 重複 session があると exit 1 になります。
  - 中断時も `finally` で自分の session だけを閉じます。
- **リダイレクト:** 許可 host 内も、307 / 308 も、追跡しません。

## レンズ 3: 信頼境界と秘密（flag 0）

- **GitHub への書込み:** `createGh({ write: false }).read` と `git ls-remote` だけです。
- **ログと結果への出力:**
  - `cli` の失敗は固定文言に置き換えています。
  - 記録する URL・console・a11y・Location は `redact` を通します。
  - 対象 URL は `safeUrl` で、資格情報と署名付き URL を持つものを拒否します。
  - 対象名は `^[\w-]+$` で検証済みなので、ファイル名の path traversal はありません。
  - 実行用ファイルは 0600 で、終了時に削除します。
- **作業ディレクトリ:** cwd は `--out` 配下の一時ディレクトリです。
- **ブラウザの通信:**
  - WebSocket と Service Worker は止めます。
  - ポップアップも、context 単位の route で見張られます。
  - 見張りは最初の navigation より前に入ります。

## レンズ 4: テスト

### F-1 [flag] 「query A{} mutation B{}」が mutation の検出を実際には検証していない

- **場所:** `skills/verifying-changes/tests/guard.test.mjs` の該当テスト。対応する実装は `lib/guard.mjs` の `readOnlyQuery` です。
- **トリガー:** 入力は `query A{} mutation B{}` です。パーサは `A{}` の空の selection で例外になり、`mutation` に到達する前に deny されます。
- **影響:** 複数 operation の混在検出（operationName が A でも止める）が壊れても、このテストは通ります。`judgeRequest` を常に allow にして 26 件落ちる実測でも、この穴は見えません。通信の見張りの中心の性質が、陽性対照なしになっています。
- **根拠:** `selection()` は `if (peek() === "}") throw new Error();` で空の `{}` を弾きます。この時点で `readOnlyQuery` は false を返します。
- **確信度:** 85%
- **最小修正:** 計画のテストはそのまま残し、隣に 2 件足します。
  - `query A { viewer { id } } mutation B { delete }`（operationName は A）→ 止める
  - 同じ文書から mutation を除いたもの → 通す（陽性対照）

### optional

- **O-1: guard の正の経路と境界が薄い。**
  - 通る側の入力が `query { viewer { id } }` だけです。変数、alias、引数、fragment、directive、文字列、ブロック文字列の分岐が未検証です。
  - 欲しいケースは次の 5 つです。
    - 文字列や field 名が `mutation` を含む正当な query を通す（語句検索でないことの確認）
    - 許可 prefix の直後が `?` または `/` のとき通る
    - 資格情報つき URL を止める
    - `ws:` などの scheme を止める
    - 標準外の `Content-Type` を止める
  - 偽陰性は止める側なので安全上の穴ではありません。確信度 60%。
- **O-2: 引数の誤り（exit 2）のテストが無い。**
  - 対象は `production-check.mjs` の `optionsOf` です。入力検証が約 25 行あり、`targets` の形式、`--allow-write` の形式、`--allow-hosts`、`--budget-seconds`、`--remote` が `-` で始まる場合を含みます。
  - CODING 5.2 の「不正な入力」に当たります。テストを足すか、PR 本文の「外した条件と理由」に書いてください（PR 本文は未作成のため flag にしません）。
  - 付随して、`--deploy-workflow` の形式は未検証です。`^[\w./-]+$` を足すとよいです。gh は読み取り専用なので書込みには至りません。
- **O-3: fake-gh の `run list` が絞り込みを無視する。**
  - `--workflow`、`--branch production`、`--status success`、`--limit 1` を見ません。
  - 本物では誤った引数でも、テストは通ります。
  - 「通常の実行」のテストで、`state.calls` の引数列を 1 件確かめると、引数のずれを検出できます。確信度 60%。
- **O-4: 次の分岐に専用のテストが無い。**
  - Service Worker の登録拒否
  - SIGINT による中断
  - 無効な `expectSelectors`（`locator` の例外で実行全体が exit 1 になる）

## レンズ 5: 配布（flag 0）

- 追加ファイルは `skills/verifying-changes/` 配下だけです。
- 名前は ASCII の kebab-case です。
- npm の依存は足していません。
- `~/.claude/skills` やマシン固有パスは差分に無く、fixtures は合成値だけです。
- `fake-gh.mjs` の mode は 100755 のままです。

## その他の optional

- **O-5: `io.mjs` の `redact`（確信度 65%）。**
  - 先頭のスキーム固定を外したため、`[^\s<>"']*(?:…)[^\s<>"']*` が入力長の 2 乗に近いバックトラックになりえます。
  - 空白の無い長い console 文字列（base64 や整形無しの JSON など。ページ由来）で、`run-code` が止まる可能性があります。
  - 安全側には倒れます。60 秒の timeout で exit 1 になります。
  - 修正案: 空白で分割したトークンごとに署名のパターンを `test` して置換すると、線形になります。
- **O-6: `cleanup-check.mjs` の `listSessions` 呼び出し（確信度 55%）。**
  - 以前は一覧取得の失敗が `browserClosed: false` として `cleanup.json` に残りました。今は例外が `main` の `catch` に抜け、`cleanup.json` を作らずに exit 1 します。
  - 後段が `cleanup.json` 欠落を「判定できない」に倒すなら問題ありません。
  - 修正案: `browserClosed` の算出だけ `try/catch` で囲み、失敗時は false を記録します。
- **O-7: `listSessions` の正規表現（確信度 45%）。**
  - 名前の次の行が `status: open` であることを前提にしています。
  - playwright-cli の版が変わって出力の項目順が変わると、空配列を返し（fail-open）、「閉じた」と誤判定します。
  - 版は 0.1.22 に固定されています。気になるなら、名前の項目ごとにブロックを区切って `status` を探す形にします。
- **O-8: 小さな点が 3 つあります。**
  - `git ls-remote` の呼び出しに `GIT_TERMINAL_PROMPT=0` を付けると、tty のある環境でも認証待ちで止まりません。
  - 300〜399 を一律に abort するため、304 も止まります。ルーティング中はキャッシュが無効なので、実害は見込みにくいです。
  - `resultFrom` の `JSON.parse` エラー文には、入力の断片が含まれます。今は `console.error(error.message)` で出ます。固定文言に置き換えると、署名付き URL を出さない約束が経路ごと守られます。

## 実測・未作成物の扱い

- 実測（RED / GREEN の件数、guard 常時 allow で 26 件失敗、旧 2 方式の到達 1 件と修正後 0 件）と整合しています。
- 最終の MCP / Biome の実行と PR 本文は未作成なので、flag にしません。
```

## 原文 R1 / Task 5

```markdown
# レビュー報告: Task 5(確認役の手順・司令塔の手順・配布)

対象は README、`skills/documenting-verification/SKILL.md`、`skills/verifying-changes/SKILL.md` と、`references/` の `triage.md`・`production-guard.md`・`coordinator.md` です。

**flag は全レンズで 0 件、optional は 4 件です。** レビューはツールなしで、提示された差分と計画だけを根拠にしています。

## レンズ1: 計画・設計との一致 — flag 0

- SKILL.md の節立ては計画 Step 1 のとおりです。節は入力、A/B の手順 1〜13、C の手順 ①〜⑦、してはいけないこと、ask で止まる条件です。
- `GitHub への書き込みは publish.mjs だけで行う` の文は、そのまま入っています。
- `--env-file` と `Using secrets defined in` の確認も、手順 3 に入っています。
- C が `preflight`・`reach-check`・`cleanup-check` を使わないことも、SKILL.md に書かれています。
- `triage.md` の分類表と判定の順序は、設計 §6.3 と一致しています。
  - reject は、regression、C の production-failure、fixChecks の head 再現です。
  - undetermined には ①〜⑧ が揃っています。
  - 表示語は A/B と C で分かれています。
  - 指紋、重複、5 件上限、1000 件打ち切りも一致しています。
- `coordinator.md` の完了ゲートは、計画 Step 2 の項目と一致しています。
  - A/B は、司令塔が自分で測る `rev-parse` と、`headMatches`・`reach.ok`・`cleanup.ok`・scan・planned-operations です。
  - C は、`ls-remote` と、`deployCheck`・`remote`・`ghBin`・`guardSelfCheck` です。
  - C は、`reruns` を含む全 `production-log.json` の method 検査と、`list --all` の `vc-<runId>-` 確認も含みます。
  - C の通知条件(`create-issue` なら知らせ、`comment-issue` だけなら知らせない)も入っています。
- 配車雛形の N/A 文言は、計画の指定どおりです。
- 承認済み追加裁定の項目 4(リダイレクトをたどらない)は、SKILL.md の C 節と `production-guard.md` の両方に入っています。
  - 3xx を記録して止めること、宣言にはリダイレクトしない URL を書くこと、リダイレクトする URL なら期待応答に 3xx を書くことの 3 点が揃っています。
- `documenting-verification` の description への境界の 1 文と、README の一覧への追加は、委任仕様どおりです。

## レンズ2: 正しさ — flag 0

判定の規則は止める側に倒れています。

- 回数不足の `incomplete` は reject にも起票にも使わず、undetermined に回ります。
- `fixChecks` が空の bug-fix PR は undetermined です。
- C の `remote`・`ghBin` が既定以外なら undetermined です。
- `reruns` の記録数と `headRuns.tried` が不一致なら undetermined です。

境界値(0/3、1〜2/3、3/3)は表で網羅されています。

## レンズ3: 信頼境界と秘密 — flag 0

- 差分に GitHub 書き込みを行う手順はありません。書き込みは `publish.mjs` に限定され、`--write` は「明示された write のときだけ」と一貫しています。
- `--remote` と `VERIFYING_CHANGES_GH` は自己テスト専用と明記され、完了ゲートでも既定値以外を通さない設計です。
- 秘密や署名付き URL は、argv・ログ・結果に出さない旨が複数箇所にあります。
- `scan-artifacts` が exit 1/2 のときは、内容を表示も投稿もせず報告する規則です。
- 本番を開くのは `production-check` だけです。

## レンズ4: テスト — flag 0

Task 5 は文書だけの変更で、新しい振る舞いを加えていないため、CODING 5.2 の対象外です。Step 4 の検証コマンドが確かめる文言と位置は、差分に存在します。

- `name: verifying-changes`
- 禁止文
- `--env-file`
- README と `documenting-verification` への言及
- `~/.claude/skills` は含まれません。

## レンズ5: 配布 — flag 0

- SKILL.md は 112 行で、500 行以下です。
- `references/` は 1 階層です。
- ファイル名は ASCII の kebab-case です。
- description は `: ` を含まないシングルクォート表記で、`: ` の扱いは計画に沿っています。
- plugins への同期、version、`package.json`、CI の変更はありません。
- 差分に機械固有のパスや実データはありません。

## optional(直さなくてよい)

- **O-1** `SKILL.md` の冒頭リンク `references/results.md` は、Task 5 の Files に含まれていません。この差分では作られていません。Task 1〜4 で作られているはずなので欠損とはしません。配布前に、実在とリンク切れが無いことを一度確かめてください。
- **O-2** bug-fix PR の判定条件が文書間で少し違います。
  - `SKILL.md` 手順 6 は、関連 Issue が bug、title が `fix:`/`fix(`、PR ラベルが bug の 3 つを挙げています。
  - `triage.md` は、スクリプトが機械的に見る title と labels だけを挙げています。
  - Issue だけが bug の PR は、確認役が `fixChecks` を省くとスクリプトでは止まりません。
  - これは Task 2 で決まったスクリプトの仕様で、文書側の誤りではありません。ただし `triage.md` に「関連 Issue のラベルは確認役の申告に依る」と 1 文足すと、境界が明確になります。
- **O-3** 計画 C ③ にある「(やり直しが途中で止まると)判定は undetermined になる」が、SKILL.md には明示されていません。`triage.md` が incomplete と中断を undetermined とするため、動作に影響はありません。
- **O-4** `coordinator.md` 冒頭の「導入計画 Task 9/10」は、public リポジトリの読者には参照先がありません。Task 10 で参照に切り替わる前提なので、現状は許容できます。ただし、置き換え後に残らないよう Task 10 の確認項目に入れておくと安全です。

## まとめ

| レンズ | flag |
|---|---|
| 1. 計画・設計との一致 | 0 |
| 2. 正しさ | 0 |
| 3. 信頼境界と秘密 | 0 |
| 4. テスト | 0 |
| 5. 配布 | 0 |

最終の MCP テスト、Biome、PR 本文は未実施の前提で、flag にしていません。
```

## 原文 R2 / Task 1

```markdown
# レビュー報告: Task 1 第2ラウンド（結果のファイル・分類・判定・指紋）

## 総評
flag は全レンズで 0 件です。optional は 6 件あります。

第2ラウンドの変更は次の2点です。
- **条件の除去:** `environment` と `declaration` の分類だけを理由にした undetermined の条件を除きました。
- **理由の補足:** 日本語の `reasons` を補い、テストを 3 件追加しました。

設計 §6.3 の undetermined 条件は ①〜⑧ です。除去した条件は、この ①〜⑧ のどれにも当たりません。「環境」と「宣言の食い違い」は別枠で記録して起票する、という設計の記述とも一致します。したがって除去は設計に沿っています。

初回レビューの補足には「environment / declaration は undetermined など」という記述がありました。これは提示された計画と設計にない根拠なので、今回は採用しません。初回の flag 0 の結論は変わりません。

## レンズ別

### 1. 計画・設計との一致: flag 0
- エクスポート名、引数、`ResultsError` の「場所: 理由」の形式は計画のとおりです。
- 分類の順序は、category、回数がそろっているか、head、比較の相手の順です。C は比較の相手を見ず、`symptom` が `expectation`・`console`・`network` のものだけを `production-failure` にします。
- 判定の順序は reject、undetermined、approve です。A・B は preflight と reach を見ます。C は production だけを見ます。`remote`・`ghBin`・`guardSelfCheck`・`targets`・`budgetExceeded`・`reruns` の照合もそろっています。
- 追加された 3 テストの名前は「条件 → 期待」の形です。計画のテスト名は維持されています。

### 2. 正しさ: flag 0
- 除去後も、`incomplete` と `regression-flaky` は reject にならず undetermined にだけ効きます。
- `reruns` や `targets[].skipped` が欠けたときは止まる側に倒れます。
- `environment` と `declaration` の発見は C の回数照合の対象外です。計画どおりです。
- 日本語の理由は reject と undetermined のどちらの経路にも入っています。

### 3. 信頼境界と秘密: flag 0
- `ResultsError` のメッセージは場所と固定の理由だけで、入力値を出しません。JSON の読み込み失敗でも原因の文字列を出しません。
- この Task に `gh` の呼び出しはありません。
- C の判定は、確認役が写した値ではなく実測の記録（`measured`）で照合しています。

### 4. テスト: flag 0
- 陽性対照があります。「成功基準でない行の skip だけ → approve」や「C で … 正常 → approve」が基準になるので、他の undetermined テストは正しい理由で落ちます。
- 追加テストは、除去した条件が復活したら落ちます。reject の理由が日本語であることを A と C の両方で確かめています。
- 一時ディレクトリは `t.after` で片付けています。`helpers.mjs` は glob に当たりません。

### 5. 配布: flag 0
- 構造は 1 階層で、規約に沿っています。fixture と `results.md` は合成値だけです。
- `~/.claude/skills` などのエージェント固有パスはありません。
- `results.md` は道具が検証する形式の説明にとどまり、P-1 に反しません。

## optional（直さなくてよい）

- **O-1**（確信度 35）
  - 対象: `triage.mjs` の `decideVerdict` の `fixChecks` 分岐
  - 内容: head が 3/3 でまだ起きていても、比較の相手の `tried` が 3 でなければ reject ではなく undetermined になります。計画の「回数がそろっていなければ undetermined」は、どちらの側を指すかが読み取れます。止まる側に倒れているので、変更は求めません。記録だけです。
- **O-2**（確信度 30）
  - 対象: `triage.mjs` の `measured.pr.labels.includes("bug")`
  - 内容: `pr` が非 null で `labels` が欠けていると TypeError になります。実際の入力は `publish.mjs` が作るため起きにくいです。
  - 提案: `labels?.includes` にする。
- **O-3**（確信度 55）
  - 対象: `triage.test.mjs`
  - 内容: `guardSelfCheck` のテストは `mutationBlocked` だけを試しています。`postBlocked` と `getAllowed` を判定から外しても全件 pass します。
  - 提案: 3 つのキーを `for` で回す。
- **O-4**（確信度 60）
  - 対象: `results.test.mjs`
  - 内容: `evidence` の拒否（`/abs`、`../x`、`a\b`）にテストがありません。
  - 提案: 「evidence が `../x` → ResultsError で `findings[0].evidence[0]` を名指し」を 1 件足す。
- **O-5**（確信度 25）
  - 対象: `fingerprint.mjs` の `normalizeSurface`
  - 内容: `URL` 解析を使うため、CLI のコマンドを surface にしたとき `?` や `#` で切れます。絶対 URL のホストも無視します。クエリの重複キーは `a=:param&a=:param` になります。指紋が揺れる程度の影響です。
- **O-6**（確信度 20）
  - 対象: `results.test.mjs`「fixtures/results/valid-a.json → 読める」
  - 内容: fixture の複製を書き出して読み戻すので、fixture 自体が不正でも他のテストと同じ入力で通ります。fixture は他のテストの基準でもあるため、実害は小さいです。
  - 提案: fixture を直接 `readResults` に渡す。

## 補足
`environment` や `declaration` の発見が、`fail` のセルの行に対応する唯一の発見になる場合があります。このとき判定は approve になり得ます。これは設計 §6.3 の「環境は別に書く」に従った結果です。変更は求めません。まとめコメント側で別枠として見えるようにする、という実装上の注意として残します。
```

## 原文 R2 / Task 2

```markdown
# レビュー報告（第2ラウンド）: Task 2「GitHub への書き込み」

## 総括
- flag は全レンズで 0 件です。初回の F-1 と F-2 は、どちらも修正で解消したと判断しました。
- 見たのは差分だけで、実行はしていません。Task 1・3・4 のコードは推測していません。
- 既知の実測（全体 182 テスト成功）と、RED→GREEN の記録は前提にしました。
- 初回の optional のうち未対応のものは、末尾にまとめて再掲します。

## 初回 flag の修正確認

**F-1（`edit-body` の `bodyEdited`）: 解消**
- 対象は `publish.mjs` の `edit-body` 分岐と、再開時の `bodyEdited` 再検証です。
- まとめの作成が失敗した場合、`published.bodyEdited = Boolean(published.summaryCommentId)` で `false` になります。やり直すと `edit-body` が再び計画され、まとめのリンク入りで書き直されます。
- 再開時の再検証は、`bodyEdited` が真のときに `replaceBodySection(remote.prBody, …, bodyContent())` と実本文を比較し、違えば `false` に戻します。実測の判定が変わった場合も本文が更新されます。
- 同じ内容の再開では、`replaceBodySection` が冪等なので `expected === prBody` になり、余計な再編集は起きません。
- 見出しが無い場合は `expected` が `null` になり、`false` に戻って `edit-body` が失敗として再記録されます。止める側に倒れています。
- `published.json` の形と `planOperations` の契約は変わっていません。計画のテスト（まとめ失敗でも本文の編集は続く・exit 1）とも両立します。
- 追加の2テスト（「まとめの作成失敗後に再開…」「再開時の実測で判定が変わる…」）が、修正前の挙動を捉える陽性対照になっています。

**F-2（明示要件ガードのテスト）: 解消**
- `createGh({write:false}).write` が `DryRunWriteError` を投げ、fake の呼び出しが 0 回になることを直接検証しています。
- `createGh.read` が `pr merge`・`issue close`・`api -F`・`graphql`・`-XPATCH`・`--method=PATCH` を拒否することを検証しています。
- 拒否の前後で fake の `calls` 件数が増えないことを確認しており、「拒否して呼ばない」まで見ています。
- 署名付き URL は2形（`private-user-images` と `X-Amz-Signature=`）で、exit 1・GitHub 呼び出し 0 回・stderr に生 URL が出ない、までを検証しています。
- 描画は、まとめと Issue の title・body から生 URL が消え、「署名付き」の伏せ字が出ることを検証しています。

## レンズ別
1. **計画・設計との一致: flag 0**
   - Interfaces、CLI、exit、`published.json` の形、操作の並び、`gh` の引数は計画のままです。
   - 計画のテスト名はすべて残っています。追加テストは「計画のテスト名は変えずに追加する」の範囲です。
2. **正しさ: flag 0**
   - F-1 の経路は上記のとおり閉じています。
   - 上限 5 件は再開をまたいでも効きます。
   - `issuesComplete=false` のとき、開いている Issue へのコメントは出し、起票は止めます。
3. **信頼境界と秘密: flag 0**
   - `read()` は許可リスト方式です。`write()` は dry-run で例外を投げます。
   - 署名付き URL は、事前検査・描画時の伏せ字・添付 URL の採用条件の3段で止めています。
   - エラーは定型文で、`gh` の応答や入力値を出していません。
4. **テスト: flag 0**
   - F-2 で求めた条件はすべて追加されています。
   - `withGhState` は `process.env` を書き換えますが、`finally` で復元しており、同一ファイル内では逐次実行です。
5. **配布: flag 0**
   - `fake-gh.mjs` は `100755` です。Node 組み込みのみで、環境固有パスや P-1 に反する規則の複製はありません。

## optional（直さなくてよい）
- **O-1（再掲）** `lib/io.mjs` の追加を PR 本文の「判断したこと」に載せてください。
- **N-1（新規）** `--na` の理由は、`publish.mjs` の `bodyContent` で `plain` を通さず、昇格 PR の本文へ生のまま入ります。
  - 署名付き URL の検査は通ります。
  - 理由に改行や `<!-- verifying-changes:B:end -->` が含まれると、欄の目印が壊れ得ます。
  - 引数は運用者が渡す値なので低リスクです。確信度は約 40% です。
  - 提案は、改行の除去と `<!--` の無害化です。
- **N-2（新規）** `countReruns` は `new RegExp(`^${finding.id}-[1-3]$`)` に `id` を直接埋めています。
  - `id` に正規表現の特殊文字があると例外になり、全体が exit 1 になります。
  - 止める側に倒れるため実害は小さいです。`id` の形式を Task 1 で制限済みなら不要です。
- **O-2（再掲、未対応）** `plain` は `<!--` を無害化しません。ページ由来の文字列が Issue の指紋の目印を偽装し得ます。
  - 起きるのは Issue の指紋照合だけで、攻撃側が他の発見の `fp` を知る必要があります。確信度は低めです。
- **O-4（再掲、未対応）** `edit-body` は処理開始時に取った `prBody` で上書きします。添付に時間がかかると、その間の人の編集を失います。書く直前の取り直しを勧めます。
- **O-3、O-5、O-6、O-7、O-8、O-9、O-10、O-11、O-12（再掲、未対応）**
  - O-5: `pages()` の複数ページ解析は未検証です。
  - O-6: 読み取りの再試行は未検証です。
  - O-7: dry-run のテストが、非空の計画を確かめていません。
  - O-8: テストに未使用の import があります。
  - O-9: `readOnly` が `isRead` の複製です。
  - O-10: 既知の通知が、やり直しでまとめから消えます。
  - O-11: 添付の 60 秒タイムアウトが短い可能性があります。
  - O-12: `comment-issue` が、`published.json` の保存失敗後の再開で重複し得ます。
  - いずれも受容してよい水準です。

## 結論
Task 2 の flag は 0 件で、本ラウンドで収束と判断します。上の optional は直さなくてかまいません。N-1 と N-2 は、直す場合も最小の変更で済みます。
```

## 原文 R2 / Task 3

```markdown
# レビュー報告 第2ラウンド: verifying-changes Task 3(点検・到達・片付け・署名付き URL 検査)

結論: 既出の F-1 と F-2 は解消しています。新規の flag は 0 件です。

## レンズ別の件数

| レンズ | flag | optional |
|---|---|---|
| 1. 計画・設計との一致 | 0 | 0(前回 O-1 は SKILL の明記で対応済みと確認) |
| 2. 正しさ | 0 | 1(O-7) |
| 3. 信頼境界と秘密 | 0 | 1(O-4 継続) |
| 4. テスト | 0 | 2(O-5 継続、O-6 継続) |
| 5. 配布 | 0 | 0 |

## 既出 flag の修正確認

### F-1: 解消

- **修正内容:** `secretFiles` の `git ls-files` を `:(glob)**/.env*` と `:(glob)**/.dev.vars*` の pathspec に絞り、`maxBuffer` を 8 MiB にしました。
- **ルート直下の鍵ファイル:** git の glob pathspec では先頭の `**/` が 0 階層に一致します。テストでルート直下の `.dev.vars` が拾われることを確認しています。
- **回帰テスト:** 「無視された依存のパス一覧が 1 MiB を超える → 点検を通過し秘密ファイルだけ記録する」を追加しています。
  - 絞り込みなしの列挙が 1 MiB を超えることを同じテスト内で assert しています。これが陽性対照です。
  - そのうえで `ok === true` と `secretFiles` が `.dev.vars` だけであることを検証しています。
  - 以前の実装で RED になることは、実測済みの記載を信頼します。
- **後段の絞り込み:** `-z` で引用符化を避けています。`.envrc` などは後段の basename 正規表現で絞られます。
- **cleanup-check:** `inspect` 経由で同じ修正が効きます。

### F-2: 解消

- **修正内容:** `main` で `--secret-files` を `inspect` の前に `validateSecretPaths` で検査し、不正なら `ArgumentError` として exit 2 になります。
- **範囲:** 絶対パス、空要素、`..` セグメントを拒否します。
- **テスト:** 絶対パスと `../` の両方で exit 2、stderr に「相対パス」、出力ファイルが作られないことを検証しています。他のテストの exit 0 が陽性対照になります。
- **cleanup-check 経由:** 改ざんされた `preflight.json` の不正パスは `inspect` の try に飲まれ、exit 1(止める側)になります。これは意図どおりです。

## 新規 flag

なし。確認した点は次のとおりです。

- **`inspectPorts`:** exit 1 かつ stdout 空だけを空きとします。ENOENT、タイムアウト、stderr あり、exit が 0 と 1 以外は `listening: null` で止める側です。`portsReleased` は `=== false` を要求しないため、`null` も false になります。
- **`cleanup-check`:** `browserClosed` の `null` だけを許し、他の false は不合格にします。
  - `listSessions` は prefix で絞り、呼び出し側が完全一致で判定します。そのため前回の O-2 の `s1` と `s10` の混同は起きません。
  - 一覧の形式が不明、stderr あり、`### Error` ありのときは例外で exit 1 です。cwd は tmp ディレクトリで、worktree に `.playwright-cli/` を残しません。
- **cwd が worktree の部分ディレクトリのとき:** 秘密ファイルの相対パスがずれてハッシュ不一致になり、止める側に倒れます。
- **`scan-artifacts`:** 出力は相対パスと規則名だけです。リンクと非通常ファイルは exit 1 です。
- **`reach-check`:** 署名付きらしい URL と埋め込み認証情報を `redact` で拒否し、`redirect: "manual"` で追従しません。
- **GitHub 書込み:** 4 スクリプトとも `gh` を呼びません。

## optional(直さなくてよい)

- **O-4(継続):** `reach-check` に host の許可リストがありません。SKILL に「宣言した dev の URL だけ」と書くとよいです。
- **O-5(継続):** CODING 5.2 の未テスト類型は、PR 本文の「外した条件と理由」に書くかテストを足してください。
  - 不正なポートや SHA での exit 2。
  - `reach-check` の 5xx。
  - `cleanup-check --session` ありの `browserClosed`(true と false の両方)。
  - `scan-artifacts` の `X-Amz-Signature=` 単独の規則、サブディレクトリ、シンボリックリンク。
- **O-6(継続):** 各テストの未使用 import(`main`、`repository`、`listen`、`freePort`、`temp` など)があります。動作に影響せず、Biome の対象外です。
- **O-7(新規、軽微):** 依存ディレクトリ内の `.env.example` のような無視ファイルも `secretFiles` に入ります。
  - ハッシュ計算のコストが増えるだけで、中身は出ません。
  - `node_modules` 内に大量にあっても pathspec で出力は有界です。

## 総括

flag は全レンズで 0 件です。このラウンドで収束と判断できます。残る optional は、PR 本文への記載か任意の追加テストで足ります。
```

## 原文 R2 / Task 4

```markdown
# レビュー報告: Task 4(本番の読み取りだけの確認)第2ラウンド

対象は第2ラウンドの修正後の差分です。F-1 への対応が足りているかを確かめ、差分全体を5レンズで読み直しました。ツールは使わず、提示された差分と仕様だけで読みました。

## 結果の要約

| レンズ | flag |
|---|---|
| 1. 計画・設計との一致 | 0 |
| 2. 正しさ | 0 |
| 3. 信頼境界と秘密 | 0 |
| 4. テスト | 0 |
| 5. 配布 | 0 |

- **flag の合計**は 0 件です。
- **F-1 は解消**しました。
- **新しい optional** は N-1〜N-3 の 3 件です。
- **前回の optional** O-1〜O-8 は保留で、状況は変わっていません。

## F-1 の解消確認

追加した 2 件のテストは、指摘の最小修正どおりです。

- **「有効な query A と mutation B が混在し operationName が A → 止める」**
  - 入力は `query A { viewer { id } } mutation B { delete }` です。
  - `query A` の部分は正しく読めます。次の operation 名 `mutation` は `operation !== "query"` に当たり、`readOnlyQuery` が false を返して止まります。
  - 空の selection で早く落ちる経路ではないので、検出が壊れると落ちます。先頭の query のあとで true を返す一時変異で、このテストだけが RED になった実測とも合います。
- **「同じ有効な query A から mutation B を除く → 通す」**
  - 陽性対照になっています。止まった理由が「パーサが全部を拒否する」ことではないと示せます。
- **元のテスト**「query A{} mutation B{} …」は名前も入力も期待も変えていません。計画との一致も保たれています。

## レンズ別(flag 0)

### 1. 計画・設計との一致

- **関数の形と出力:** `judgeRequest`(自己完結、`toString` で埋め込み、`new Function` で再構築するテストあり)、`listSessions`、CLI の引数、exit code(0/1/2)、`production-log.json` の項目は計画どおりです。
- **追加裁定の 1・2・3:** 次のとおり満たしています。
  - 通した要求はすべて `route.fetch({ maxRedirects: 0 })` で取得します。
  - 3xx は `fulfill` せず `abort` し、移動先を `requests` に blocked で残します。
  - main frame の 3xx は `targets` に status と location を残し、`selectorsFound` は null です。
  - 許可 host 内の移動、allow-write の 307 もたどりません。
  - 追加 4 テストは名前も期待も存在します。
- **追加裁定の 4:** `references/production-guard.md` と SKILL.md の C 節への記載はこの差分にありません。Task 5 の範囲として、欠損とは見ません。Task 5 のレビューで文面が両方に入っているかを確かめてください。

### 2. 正しさ(fail-closed、境界、回数、空・不正入力)

- **止める側に倒れる経路:** 次のとおり、判定できないときは止まります。
  - GraphQL パーサは、query 以外の operation、空の selection、128KB 超、`query` の無い本文、トークンの途中切れをすべて false にします。
  - 空配列は `queries.length` で止まります。
  - 資格情報つき URL、http(s) 以外の scheme、port を含む host の完全一致も止めます。
  - 前方一致の直後が `/`・`?`・末尾でなければ止めます。
- **SHA 照合:** `git ls-remote` と gh の 2 系統が両方一致しなければ、session を作る前に止まります。2 つのテストは片方ずつ独立に不一致にしています。
- **重複 session:** 作る前に重複を検出し、`opened` が立つ前なので既存の session は閉じません。
- **終了処理:** 終了時は自分の session だけを閉じ、`listSessions` で閉じたことを確かめます。確認できなければ exit 1 です。
- **中断:** SIGINT・SIGTERM でも `finally` を通ります。

### 3. 信頼境界と秘密

- **GitHub への書込み:** `createGh({ write: false }).read` と `git ls-remote` だけです。
- **署名付き URL の除去:** 記録する URL、console、a11y、Location、移動先はいずれも `redact` を通ります。対象 URL は `safeUrl` で、署名付き URL を持つものを拒否します。
- **ブラウザからの通信:**
  - ブラウザの通信は context 単位の `route` で見張ります。
  - WebSocket と Service Worker は止めます。
  - 見張りは最初の navigation より前に入ります。
- **作業ディレクトリ:** cwd は `--out` 配下の一時ディレクトリで、終了時に削除します。

### 4. テスト

- **陽性対照:** 見張りの各テストに対応する陽性対照があります。
  - 通す側は「query → 受け取る」「GET が通る」「通常の実行で自己確認が 3 つとも true」です。
  - `listSessions` は「別の cwd から開いたままの session を返す」です。
  - 常時 allow への破壊で 26 件が落ちる実測もあります。
- **CODING 5.2:** 変更に関わる類型をそれぞれテストしています。
  - 境界は `graphql-admin`。
  - 不正入力は JSON でない本文と persisted query。
  - 失敗は SHA 不一致。
  - 量は配列の 2 つめ。
  - 状態は重複 session。
- **未テストの類型:** 引数の誤り(exit 2)などは前回の O-2・O-4 のとおりです。PR 本文の「外した条件と理由」に書けば足ります。

### 5. 配布

- 追加は `skills/verifying-changes/` 配下だけです。名前は ASCII の kebab-case で、npm の依存はありません。
- マシン固有パスと実環境の値は差分に無く、fixtures は合成値だけです。
- `fake-gh.mjs` は 100755 です。
- `tests/local-helpers.mjs` と `tests/helpers.mjs` は提示範囲に無いので、前の Task のものとして欠損とはしません。

## 新しい optional(今回の差分で気づいたもの)

- **N-1: `guard.mjs` の GET の `query` パラメータの扱いが、計画の文言より厳しい**(確信度 60%)
  - 計画は「GraphQL の mutation か subscription なら止める」です。実装は `readOnlyQuery` で読み取りと確認できない `query=` をすべて止めます。
  - たとえば検索ページの `?query=shoes` のような GraphQL でない値も止まります。
  - 止める側なので安全ですが、本番の GET が blocked になって確認できる範囲が狭まります。blocked は C の失敗に数えない規定なので、気づきにくくなります。
  - 意図した fail-closed なら PR 本文の「判断したこと」に書いてください。
  - 計画どおりにするなら、パースを試みて operation が query 以外のときだけ止める形にします。
- **N-2: 予算のテストは「遅い対象を途中で打ち切る」経路を実際には通っていない可能性が高い**(確信度 65%)
  - `deadline` は SHA 照合・session 作成・自己確認より前に計算します。
  - `--budget-seconds 1` だと、最初の対象を開く前に期限が過ぎ、`/slow` の対象は実行されず skipped になりえます。
  - 期待(`budgetExceeded`、2つめが skipped、exit 0)は満たすので pass します。ただ、テスト名の「遅い対象」で打ち切る分岐は検証できていません。
  - 上限の起点を自己確認のあとに置くか、1つめの対象は実行され `status` が null になる、といった追加の確認を足すと確かです。
- **N-3: session 名の「直下の実行は main」の判定規則が `--out` の親ディレクトリ名 `reruns` に依存している**(確信度 50%)
  - 計画の文面は `vc-<runId>-<--out のディレクトリ名>` と「直下の実行は main」で、この規則自体は計画に書かれていません。
  - Task 5 の `coordinator.md` のやり直しの `--out` の置き方と必ず一致させ、PR 本文の「判断したこと」に載せてください。
  - 一致しない場合は `main` と衝突し、並行して動かすと重複検出で exit 1 になります。安全側ですが、手順が詰まります。

## 前回の optional(保留のまま)

- **O-1〜O-4:** guard の通る側の入力が薄いこと、exit 2 のテストが無いこと、fake-gh が絞り込みを無視すること、Service Worker・SIGINT・無効な selector のテストが無いこと。
- **O-5〜O-8:** `redact` のバックトラック、`cleanup-check` の `listSessions` の失敗時の扱い、`listSessions` の正規表現の項目順への依存、`GIT_TERMINAL_PROMPT` と `JSON.parse` エラー文の断片。

## 実測・未作成物の扱い

- 実測(RED/GREEN の件数、混在テストの変異で RED、復元で guard 17/17、全体 184/184)は、差分のテストと整合しています。
- 最終の MCP/Biome の実行と PR 本文は未作成なので、flag にしません。

**結論:** flag は 0 件で、収束してよいと判断します。
```

## 原文 R3 / Task 4

```markdown
# レビュー報告: Task 4 最終状態と Task 5 の production-guard reference(第3ラウンド)

ツールは使わず、提示された差分と仕様だけで読みました。マシン固有パス、秘密、実環境の値は書いていません。

## 結果の要約

| レンズ | flag |
|---|---|
| 1. 計画・設計との一致 | 0 |
| 2. 正しさ | 0 |
| 3. 信頼境界と秘密 | 0 |
| 4. テスト | 1(F-1) |
| 5. 配布 | 0 |

- flag は 1 件です。
- optional は 5 件です(O-A〜O-E)。
- 前ラウンドの optional(O-1〜O-8、N-1〜N-3)は保留のままで、状況は変わっていません。

## flag

### F-1 `tests/production-check.test.mjs` の「bare リポジトリの production が --expect-sha と違う」は、`git ls-remote` 側の照合を単独では検証していない

- **対象:** テスト名「bare リポジトリの production が --expect-sha と違う → exit 1・deployCheck.ok false・試験のサーバーへの到達は 0 件」。実装は `scripts/production-check.mjs` の `deployment`。
- **トリガー:**
  - このテストは `p.run(["--expect-sha", "e".repeat(40)])` で、`--expect-sha` だけを書き換えます。
  - `setup` では bare の `production` も fake-gh の `runs[0].headSha` も `r.sha` のままです。
  - つまり `git ls-remote` 側も gh 側も、同時に `--expect-sha` と食い違います。
  - `result.ok` を `deployHeadSha === expect` だけにして `productionSha` の条件を消しても、このテストは通ります。
  - もう片方のテスト(gh 側だけ食い違える)は gh 側の単独検証になっていますが、ls-remote 側を単独で検証するテストはありません。
- **影響:**
  - 計画は「どちらも `--expect-sha` と一致しなければ本番を開かない」という二重の照合を明示要件にしています。
  - 一方の照合が退行しても、テストが検知しません。
  - 本番に出ている SHA を確かめる唯一のゲートなので、見張りの退行は気づかれないまま通ります。
  - 前ラウンドの報告にある「2 つのテストは片方ずつ独立に不一致にしている」は、実際には成り立っていません。
- **根拠:** `setup` の構成(bare の clone 元は worktree、`state.runs` は `r.sha`、`--expect-sha` の上書きは後勝ち)から読み取れます。
- **確信度:** 85%。
- **最小修正:**
  - このテストは `--expect-sha` を変えず、bare 側の `production` だけを別 commit に向けます。
  - 例: bare で `git update-ref refs/heads/production <別commit>` を実行し、gh は `r.sha` を返したままにします。
  - これで ls-remote 側が単独で exit 1 と `deployCheck.ok false` を引き起こします。
  - 陽性対照は、既存の「通常の実行 → ok true」がそのまま担えます。
  - 今の「`--expect-sha` を変える」ケースは、両方ずれた場合として別名で残してもかまいません。

## レンズ別

### 1. 計画・設計との一致(flag 0)

- **Interfaces と出力:** `judgeRequest` の自己完結(`toString` での埋め込みと `new Function` での再構築テスト)、`listSessions`、CLI の引数、exit code、`production-log.json` の項目は計画どおりです。
- **追加裁定の 1〜3(リダイレクト):**
  - 通した要求は `route.fetch({ maxRedirects: 0 })` で取得します。
  - 3xx は `fulfill` せず `abort` し、移動先を `requests` に blocked で残します。
  - main frame の 3xx は status と location を `targets` に残し、`selectorsFound` は null です。
  - 追加 4 テストの名前と期待が存在します。
- **追加裁定 4(文面):**
  - reference に「本番のブラウザはリダイレクトをたどらない」「3xx を止める」「宣言にはリダイレクトしない URL を書く。リダイレクトする URL なら期待応答に 3xx を書く」が入っています。
  - 文言は裁定の語と実質同じです。
  - SKILL.md の C 節は提示範囲外です。欠損とは推測しませんが、SKILL.md のレビューで同じ文が入っているか確認してください。
- **GET の裁定:**
  - 実装(`getAll("query")` を `\b(mutation|subscription)\b/i` で検査)と reference の表は一致しています。
  - テストは裁定に挙がった 6 種類(shoes、読み取り GraphQL、既存 mutation、不正文法で mutation の語あり、2 つめが subscription、大文字 MUTATION)をそろえ、HEAD/OPTIONS の追加テストもあります。
  - POST などの本文の規則は変わっていません。
- **reference と実装の一致:** reference の以下の記述は実装と一致します。
  - 上限(131072 文字、深さ 100)
  - `reruns/<発見id>-<n>/` と session 名
  - exit code
  - 自己確認の 3 項目
  - `--remote` と `VERIFYING_CHANGES_GH` の扱い

### 2. 正しさ(flag 0)

- **GraphQL 解析:**
  - 全ループは、トークンが尽きると `name()` や `value()` の検査で例外になり、無限ループしません。
  - 例外は `catch` で false になり、止める側に倒れます。
  - 空配列、非文字列、`query` の無い本文、query 以外の operation も止まります。
- **許可 URL の判定:** 前方一致の直後の文字、認証情報、許可外 host、http(s) 以外の scheme を止めます。
- **終了処理:**
  - 中断は SIGINT/SIGTERM でも `finally` を通ります。
  - 自分の session の終了を確認できなければ exit 1 です。
  - `sessionClosed` は初期 true、open 後は false で、異常終了のログは止める側に倒れます。
- **SHA の二重照合:** 実装自体は ls-remote と gh の両方を要求しており、問題ありません(検証の穴は F-1)。

### 3. 信頼境界と秘密(flag 0)

- **GitHub への書き込み:** `createGh({ write: false }).read` と `git ls-remote` だけです。
- **URL と出力の秘匿:**
  - 記録する URL、console、a11y、Location、移動先は `redact` を通ります。
  - 対象 URL は `safeUrl` で署名付き URL を拒否します。
  - エラー出力は固定文言で、秘密を含みません。
- **ブラウザの見張り:**
  - 見張りは最初の navigation より前に context 単位で入ります。
  - WebSocket と Service Worker は止めます。
  - 例外時の `route.abort`、`route.fetch` の失敗時の abort、ハンドラ内の例外による要求の保留は、いずれも通さない側に倒れます。
- **ファイルと cwd:** 生成コードは `0o600` で、cwd は `--out` 配下の一時ディレクトリです。終了時に削除します。

### 4. テスト(F-1 以外は flag 0)

- **陽性対照:**
  - 常時 allow への破壊で 26 件が落ち、復元で 171 件が通るという実測があります。
  - query が届く、GET が通る、`listSessions` が別 cwd から開いたままの session を返す、といった陽性対照もそろっています。
  - リダイレクト 4 件のうち移動先到達が 0 件になる点は、旧 2 方式で到達 1 件が出ることを確かめた実測と整合します。
- **条件の網羅:** 境界(`graphql-admin`)、不正入力、失敗、量、状態の各類型が変更に応じてテストされています。

### 5. 配布(flag 0)

- 追加は `skills/verifying-changes/` 配下だけです。
- 名前は ASCII の kebab-case で、npm の依存はありません。
- `fake-gh.mjs` は 100755 です。
- fixtures は合成値(example/widget など)だけで、reference にもマシン固有パスはありません。
- `tests/helpers.mjs` と `tests/local-helpers.mjs` は提示範囲外で、前の Task のものとして扱います。

## optional(flag にしない)

- **O-A:**
  - `pageCode` の main frame 判定は、遷移のたびに `record.status` と `location` を上書きします。
  - JS による遷移や meta refresh で、対象 URL の応答ではなく最後の遷移先の status が残りえます。
  - 確信度 55%。最初の main frame の応答だけを記録すると確かです。
- **O-B:**
  - 裁定の「すべての query の値」は、`query` パラメータの全値(`getAll`)と解釈されています。
  - この解釈は reference に明記済みで妥当です。
  - もし全パラメータ名の値を意図していたなら不足です(確信度 30%)。PR 本文の判断に「`query` という名前のパラメータの全値」と一言あれば足ります。
- **O-C:**
  - 自己確認の `getAllowed` は、`/read` が届く前に `context.close()` が先に走ると偽陰性になりえます。
  - その場合は止める側(exit 1)に倒れるだけで安全ですが、不安定さの原因になりえます(確信度 40%)。
- **O-D:**
  - `redact` の正規表現は、空白の無い長い文字列(例: 縮小された JS を含む console)で二乗時間になりえます。
  - run-code 側に埋め込まれるため、時間切れになれば fail-closed です。O-5 と同じ指摘です。
- **O-E:**
  - exit 2(引数の誤り)と Service Worker のテストはありません。
  - CODING 5.2 により、PR 本文の「外した条件と理由」に書けば足ります。

## 結論

F-1 を直せば収束できます。修正はテストの入力の変更だけで、実装は変えません。第3ラウンドで残った flag は F-1 の 1 件だけです。受容する場合も、直す場合と同様に PR 本文へ記録してください。
```
