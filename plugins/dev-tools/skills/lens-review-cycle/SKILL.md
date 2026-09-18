---
name: lens-review-cycle
description: 'This skill should be used when the user asks to "レンズレビュー", "lens review cycle", "専門家レビュー", "expert review cycle", "5人の専門家にレビューしてもらおう", "指摘が0になるまでレビュー", "レビューサイクルを回す", "繰り返しレビュー", or the legacy phrases "parallel review cycle" / "専門家並行レビュー" — to run multiple autonomous review rounds until all findings reach zero, without between-round confirmation. One reviewer applies 5 lenses sequentially; parallel agents only when the user explicitly asks. For prose targets (CLAUDE.md, .docs/plans, SKILL.md, README, design docs), also use a 6th "Ambiguity Hunter" for underspecification and a 7th "Altitude Checker" for detail-level overfit. Triggers also: "仕様の曖昧さをチェック", "ルールの曖昧さ", "未明文化を洗い出す", "ambiguity check", "overfit チェック", "過剰実装チェック", "altitude check". 構想段階の判断訂正には product-design-lens を使う。'
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Agent, mcp__code-review-graph__build_or_update_graph_tool, mcp__code-review-graph__get_minimal_context_tool]
---

# Lens Review Cycle

5〜7 の専門レンズを **1 名のレビュアーに順に当てさせ**、指摘が 0 件になるまでラウンドを繰り返すレビュー手法。
レンズ（観点の分離と、レンズごとに独立した findings）が品質を支えており、エージェントの並列起動は支えていない。レビュアーはレンズ別ブロックを応答として返し、オーケストレータがその本文を改変せず別ファイルへ永続化する。既定では並列起動しない。
セッションスコープの偽陽性レジストリにより、同じ誤判定が繰り返しエスカレートされることを防ぐ。
レビュー対象に文章仕様（CLAUDE.md / `.docs/plans` / スキル定義 / README / 設計書）が含まれる時は、6人目の **Ambiguity Hunter**（未明文化ハンター・詳細 → `references/ambiguity-hunter.md`）と、その対レンズである7人目の **Altitude Checker**（高度検査＝詳細レベルの overfit 検出・詳細 → `references/altitude-checker.md`）も起動する。明文化圧と抽象化圧を対にしてレビューの一方向膨張を防ぐ。

## このスキルを使わない場合

**まだ確定していない判断を訂正する用途には使わない。** 競合・法令・時間軸・失敗シナリオといった「文書の外」に照らして判断そのものを書き換えるのは `product-design-lens` である。このスキルは「文書の中」を見て記述の破綻を直す。

判断を確定させてから（product-design-lens）、記述を締める（このスキル）という順番になる。

## 実行モデル

この節が実行形態とモデル指定の正本である。

- **オーケストレータ**: セッションのモデルのまま（frontmatter で上書きしない）。レビュアー応答のレンズ別永続化・集約・FP 照合・修正・コミットだけを行い、自分ではレンズを当てない（セッションモデルが高価な場合にトークンを食うため）。
- **レビュアー**: **サブエージェント 1 名**。`Agent` 呼び出し 1 回で、適用するレンズを全部渡し、順に当てさせる。`model` は**明示指定**する（親からの継承に任せない——ユーザーが途中で入力するとセッションのモデルへ戻り、ラウンドごとにレビュー品質が変わって収束判定が信用できなくなる）。
  - 既定は `model: "sonnet"`。
  - 対象がコードで、セキュリティ・データ破壊・課金に影響しうる変更を含むときは `model: "opus"`。
  - ユーザーが明示的にモデルを指定した場合はそれに従う。
- **並列起動はしない**。レンズごとに 1 名ずつ同時起動するのは、ユーザーが「並列で」と明示したときだけ（その場合も各呼び出しで `model` を明示する）。理由は「設計原則」節。
- `Agent` 相当を持たない環境（Codex 等）では、オーケストレータ自身がレンズを順に当ててよい。この代替経路でもレビュー中は `Write` / `Edit` / 書き込み可能な `Bash` を使わず、全レンズの応答が揃ってからオーケストレータの永続化フェーズへ切り替える。切り替え前にレビュー中の tool call を確認し、書き込み系ツールの使用が0件であることを `state.md` へ checkpoint する。0件と確認できなければ `paused` で停止し、使用または判定不能の tool call、未永続化の role、保持した `REVIEW_DIR` を報告する。

## 自律実行の原則

**このスキルは全サイクルを自律的に実行する。ユーザーへの確認はしない。**

- ステップ 2〜5 を全スペシャリストが LGTM を返すまで繰り返す
- ラウンド間でユーザーに確認を求めない
- ユーザーが明示的に中断を要求した場合、堂々巡り検出時（ステップ5・エスカレーション）、または最大ラウンド数超過時（ステップ5）のみサイクルを終了する
- 完了後にまとめて報告する（途中経過は報告しない）

## 概要

```
Round N — レビュアー 1 名がレンズを順に当てる（各レンズの findings を応答の別ブロックへ）
  1. Fresh Eyes        → finding or LGTM   ※最初に当てる（修正済み事項を読む前）
  2. Security          → finding or LGTM
  3. Core Logic        → finding or LGTM
  4. Tests             → finding or LGTM
  5. Domain            → finding or LGTM
  6. Ambiguity Hunter  → finding or LGTM   ※対象に文章仕様が含まれる時のみ
  7. Altitude Checker  → finding or LGTM   ※同上（#6 の対レンズ）
         ↓
  オーケストレータが各ブロックを別ファイルへ原文のまま永続化
         ↓
  FP Registry 照合 → 既知FP は即棄却
         ↓
  真の指摘 → 修正 → テスト → 次ラウンドへ（確認なし）
         ↓
  全レンズ LGTM → 完了レポートを出力
```

## ステップ 1: durable state と FP レジストリを初期化する

サイクル開始時に worktree ごとの決定的な一時ディレクトリを選ぶ。

```bash
_wt=$(basename "$(git rev-parse --show-toplevel)")
REVIEW_DIR="/tmp/review-cycle-${_wt}"
```

`REVIEW_DIR` は symlink でなく実行ユーザー所有の mode 0700 であることを確認してから使う。同一 worktree では同時に複数サイクルを実行しない。ここへの書き込みはオーケストレータだけが行い、レビュアーのファイル書き込みや `REVIEW_DIR` へのアクセスを前提にしない。`state.md` の対象 HEAD、対象ファイル集合、content fingerprint が今回と一致すれば再開し、完了済みラウンドと有効な findings 済みロールをスキップする。不一致または `state.md` が無い残骸は `${REVIEW_DIR}-abandoned-$(date +%s)` へ退避して新規開始する。パス生成・安全検査・状態構造・再開比較は `references/durable-state.md`、FP レジストリの初期化と前回ログからの安全な carry-over は `references/fp-registry-format.md` を参照する。

## ステップ 1.5: 最小コンテキストの取得（任意）

レビュー対象にコードが含まれる場合だけ、全 specialist のディスパッチ前に、① `mcp__code-review-graph__build_or_update_graph_tool()`（引数なしで graph が無ければ作り、あれば増分更新）、成功したら② `mcp__code-review-graph__get_minimal_context_tool(task="review", changed_files=[レビュー対象のリポジトリ相対パス])` の順で各1回呼ぶ。②の `status` が `"ok"` なら `summary`・`risk`・`communities`・`flows_affected` を全 specialist に「まず読むべき起点（code-review-graph）」として渡すが、読む範囲の制約にはしない。`next_tool_suggestions` は渡さない。

①が失敗した、②の `status` が `"ok"` でない、または MCP サーバーが未接続・呼び出しに失敗した場合は結果を使わず、理由を1行記録し、**現行のレビュー動作を継続する**。この場で `full_rebuild=true` を指定したり、レビューを停止したりしない。文章仕様のみが対象なら呼び出さない。呼び出し形式とフォールバックは `references/minimal-context-feeder.md` を参照する。

## ステップ 2: レビュアー 1 名にレンズを順に当てさせる

`Agent` ツールを **1 回**呼び、適用するレンズを全部渡す。モデル指定は「実行モデル」節に従う（`model` を明示する）。Claude Code では `subagent_type: Explore` を使い、レビュアーのツールを `Read` / `Grep` / `Glob` などの読み取り専用ツールに限定する。等価な read-only reviewer type を使う環境でも、`Write` / `Edit` / 書き込み可能な `Bash` は渡さない。
適用するレンズは **5 つ**（コードのみ対象の場合）または **7 つ**（レビュー対象に文章仕様が1つ以上含まれる場合は #6 Ambiguity Hunter と #7 Altitude Checker を追加）。
レビュアーには findings のファイル書き込みを求めず、`REVIEW_DIR` や findings の保存先も渡さない。レンズごとの完全な findings は、次の境界を使った別ブロックとして応答本文へ返させる。

```text
<<<LENS_FINDINGS role="fresh-eyes">>>
LGTM
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="security">>>
flag 1件
[ISSUE] path/to/file:42
確信度: 90%
問題: 問題の内容
修正案: 修正の内容
<<<END_LENS_FINDINGS>>>
```

role は適用順に `fresh-eyes`、`security`、`core-logic`、`tests`、`domain`、文章仕様では続けて `ambiguity-hunter`、`altitude-checker` とする。応答には適用した role のブロックを各1個だけ含め、ブロック外へ結論や要約を書かせない。オーケストレータは応答を受け取ってから `$REVIEW_DIR/round-N/` を作成し、境界行だけを除いた各ブロックの本文をそのまま `$REVIEW_DIR/round-N/<role>.md` へ保存する。改変禁止、分割、検証、書き込み失敗時の詳細規則は `references/durable-state.md` を参照する。

レンズの適用順は **Fresh Eyes を最初**にする。修正済み事項はオーケストレータが `$REVIEW_DIR/round-N/fixed-items.md` に置き、その内容をプロンプト末尾の区切られたセクションへ展開して「Fresh Eyes の findings ブロックを完成させるまで参照しない」と指示する。これは同一プロンプト内の適用順と参照禁止指示で先入観を抑える方法であり、内容をコンテキストから不可視にする保証ではない。

### ロール構成

各ラウンドで以下のレンズを順に当てる（#6・#7 は条件付き）。プロジェクトの特性に応じて Domain ロールをカスタマイズすること。

| # | ロール | フォーカス |
|---|--------|-----------|
| 1 | Fresh Eyes | 先入観なしの総合チェック |
| 2 | Security | 注入・パストラバーサル・情報漏洩 |
| 3 | Core Logic | ビジネスロジック・データ整合性 |
| 4 | Tests | テスト隔離・カバレッジ・アサーション |
| 5 | Domain | CLI/API/DB など対象固有の品質 |
| 6 | Ambiguity Hunter | 文章仕様の未明文化（暗黙基準・未定義境界・閾値なし主観語・収束条件欠落・重複定義・宙吊り参照・anti-gaming欠落）。**対象に文章仕様が含まれる時のみ起動**。詳細 → `references/ambiguity-hunter.md` |
| 7 | Altitude Checker | 文章仕様の詳細レベル overfit（固有語彙の漏れ・委譲可能な詳細の常駐・一回性の一般化・right altitude 違反・scope excess）。**対象に文章仕様が含まれる時のみ起動**（#6 の対レンズ）。詳細 → `references/altitude-checker.md` |

> **Fresh Eyes の注意**: Fresh Eyes は「修正済み事項」を読む前に当てる。修正済みのはずの問題が再浮上する場合、修正が不完全な可能性があるため。FP レジストリは渡す（確認済みの偽陽性は除外する）。

> **Ambiguity Hunter / Altitude Checker の注意**: コードのみが対象のサイクルでは当てない（LGTM 扱い）。対象に文章仕様が1つ以上含まれる場合のみ当てる。


ロール別のフォーカスエリアとプロンプトテンプレートは `references/specialist-roles.md` を参照。

### レビュアーへ伝える必須情報

レビュアーのプロンプトに必ず含めること:

1. **レビュー対象ファイル一覧** — 絶対パスで指定
2. **修正済み事項の内容** — 重複報告を防ぐため、前ラウンドまでに修正した内容をオーケストレータが `$REVIEW_DIR/round-N/fixed-items.md` に列挙してプロンプトへ展開し、**Fresh Eyes の findings ブロックを完成させてから参照する**よう指示する（上記注意参照）
3. **設計上の事実** — 意図的な設計判断（「これは仕様」と分かっているもの）
4. **FP レジストリの内容** — `cat "$REVIEW_DIR/fp-registry.md"` で読み込んでプロンプトに展開
5. **最小コンテキスト** — ステップ1.5で取得できた場合だけ、「まず読むべき起点」であり範囲制約ではないと明記して添付
6. **role の一覧と適用順** — 対象に応じた5または7 role の識別子を上記の順で渡し、role ごとに境界付きブロックを1個返すよう明記する
7. **報告フォーマット** — `references/specialist-roles.md` 冒頭の「全テンプレート共通の報告規定」を正本としてプロンプトへ併記する。Ambiguity Hunter / Altitude Checker の形式は各 reference に従い、ブロック外へ本文を書かせない

### 確信度フィルタと scope フィルタ

レビュアーには「**確信度 80% 以上の問題のみ報告**」を明示する。これにより低品質な指摘のノイズを減らす。

あわせて `references/agent-output-principles.md`（同スキル内）の **scope フィルタ**を各プロンプトに含める——flag（correctness・セキュリティ・明示要件に影響。文章仕様では誤実装・誤運用・収束不能に至る欠陥を含む。**過剰実装は降格理由の欠落のみ flag**——判定条件は同ファイルの scope フィルタが正本）と optional（それ以外）を分離報告させる。**サイクル継続判定・LGTM 相当の判定は flag のみ**で行う（確信度は severity/scope と直交——100%確信のスタイル指摘で収束を妨げない）。optional は修正不要だが、記録は正本の記録先規定に従い**ディスクへ残す**（コード変更なら `INSPECTION_STATUS` 併記、それ以外はレビュー成果物、無ければ対象ルートの `.docs/reviews/`）。チャットの最終レポートには要約のみ載せる。

## ステップ 3: 結果を収集し FP レジストリと照合する

あるレンズの結果が返らない場合（Agent エラー、タイムアウト、空応答、対象 role のブロック欠落・重複・空・形式不正）は LGTM として扱わない。形式検証には先頭行の結論形式と、`flag N件` の N と findings ブロック数の一致を含める（正本は `references/durable-state.md` の「findings ファイルの有効性」）。有効なブロックはオーケストレータが先に role 別ファイルへ原文のまま保存し、欠けたレンズだけを 1 回だけ再依頼する（`Agent` を 1 回。並列起動はしない）。再依頼でも返らなければラウンドを未完のまま `paused` で停止し、ユーザーへ欠落 role、試行回数、保持した `REVIEW_DIR`、再開条件を報告する。試行回数は `state.md` に永続化し、再開用の `REVIEW_DIR` は削除しない。

role 別ファイルへの書き込みが失敗した場合は、レビュアーを再依頼せず、同じ未変更ブロックの書き込みだけを 1 回再試行する。2回目も失敗したら LGTM 判定や次の role へ進まず `paused` で停止する。`state.md` へ記録できる場合は失敗 role と試行回数を記録し、ユーザーへ失敗 role、保存先、原文が未永続化であること、正確なエラー、試行回数、保持できた `REVIEW_DIR`、再開には当該 role の再取得が必要なことを報告する。`state.md` 自体へ書けない場合も同じ情報を直接報告し、成功として続行しない。

全レンズの findings ファイルが揃ったら:

1. **flag なし（LGTM または optional のみ）** → そのレンズは次ラウンド不要（ただし Fresh Eyes は毎ラウンド当てる）。optional は記録リストに積む
2. **flag あり** → FP レジストリと照合する

### FP 照合ルール

```
指摘の「主張」が FP レジストリのエントリとマッチする
  → 偽陽性として即棄却（修正しない）
  → 次ラウンドの「修正済み事項」にも追加しない

マッチしない（新規指摘）
  → ステップ 4 へ
```

マッチ判定は完全一致でなくてよい。「同じロジックへの同じ誤解」であれば同一とみなす。

## ステップ 4: 真の指摘を修正する

修正着手前に `git status` で予期しない変更が無いか確認する。

新規指摘を評価し:

- **flag された真の問題** → 修正し、テストを実行して通過を確認する（テストが無い文章仕様レビューでは修正内容の実ファイル反映を確認）
- **新しい偽陽性** → レジストリに追記する（フォーマットは `references/fp-registry-format.md` 参照）

修正前に対象事項を `pending` として `state.md` に書き、実ファイル反映と検証後にだけ `applied` へ更新する。再開時は一般の fingerprint 比較より先に `pending` の回復規則を適用する。

**#6 × #7 の裁定規則**: Ambiguity（曖昧だ）と Altitude（詳しすぎる）が同一箇所・関連箇所を指した場合、既定解は「**委譲先（正本・詳細レイヤー）で明文化し、原則文書には要約＋ポインタを残す**」。原則文書への詳細追記は最後の手段とする。

偽陽性の判定基準:
- 設計上の意図が反映されていない（ドキュメント化された仕様と矛盾する）
- コードの別の箇所に保護が存在する（多層防御で補完されている）
- ライブラリやフレームワークの保証に依存している

## ステップ 5: 継続判定（確認なし）

ユーザーへの確認は一切行わず、即座に次のアクションへ移る。

**最大ラウンド数: 3**（デフォルト。standards `AI_FIRST.md` §3 の収束条件と同じ値）。3ラウンドを超えても指摘が残る場合は、現在の状況をユーザーに報告してサイクルを停止する（残った指摘は修正か明示受容かをその場で決め、積み残さない）。

```
flag された真の指摘が 1 件以上あった → テスト実行 → ステップ 2 へ（次ラウンド、確認なし）
堂々巡り検出（FP レジストリ非該当の同一 flag が、修正後も2ラウンド連続で再出現） → 現状を報告してサイクル停止（ユーザーへエスカレーション。自律実行原則の例外）
全レンズが LGTM（flag 0。optional のみは LGTM 扱い） → ステップ 6 へ
ラウンド数が 3 を超過     → 現状報告してサイクル停止
```

ラウンド番号を R1, R2, R3 ... と管理し、各ラウンドの修正内容を記録しておく（最終レポートで使用）。

## ステップ 6: 学習ログ、クリーンアップ、完了レポート

全レンズ LGTM、堂々巡り、ラウンド上限超過は terminal な終了としてこのステップへ進む。レビュアーの再試行失敗、findings の書き込み失敗、ユーザー中断は paused とし、ログも cleanup も行わず `REVIEW_DIR` を保持する。

terminal な終了時は、対象リポジトリの `.docs/reviews/cycles/<cycle-id>.md` へラウンド数、終了理由、レンズ別 flag 件数、確定した偽陽性を**先に書き出す**。このファイルはレビュードキュメント（standards DOCS_OPS §3「呼び名」）であり、1 サイクル 1 ファイルで書き切り、後から書き換えない。形式・書込規則・legacy ログからの読取フォールバックは `references/cycle-log-format.md` を参照する。レンズ実績は記録だけに使い、構成を自動変更しない。

ログへの書き出しを確認してから一時状態を削除し、サイクル全体のサマリーをユーザーに報告する。

```bash
rm -rf "$REVIEW_DIR"
```

### 完了レポートのフォーマット

以下の形式でまとめて報告する:

```
## レビュー完了

**総ラウンド数**: N ラウンド

### ラウンド別修正サマリー

| ラウンド | 指摘件数 | 修正内容 |
|---------|---------|---------|
| R1      | X 件    | {修正の概要} |
| R2      | Y 件    | {修正の概要} |
| ...     |         |         |
| RN      | 0 件    | 全員 LGTM |

### 偽陽性サマリー（FP レジストリ）

| ID     | 主張の概要 | 初出 |
|--------|-----------|------|
| FP-001 | {概要}    | R1 #X |
| ...    |           |       |

（FP が 0 件の場合は「偽陽性なし」と記載）

### テスト結果

最終ラウンド後のテスト: {通過数}/{総数}

### optional 指摘（終了条件外）

{N}件・記録先: {ディスク上のパス}

### 判断レンズへの差し戻し

{N}件（0件なら「なし」）
{1件以上ある場合のみ}: 判断の未検証が残っている。product-design-lens で裁定すること。
```

## 設計原則

### なぜ Checker エージェントは不要か

Checker（偽陽性チェッカー）は「偽陽性が私に到達してから止める」リアクティブな仕組み。
FP レジストリは「偽陽性が上がってくる前に止める」プロアクティブな仕組みであり、根本的に優れている。

- **既知 FP** → レジストリが防ぐ（Checker 不要）
- **未知 FP** → Checker も Specialist と同じコードを読んで同じ誤りをしうる（効果薄い）
- **真のバグ** → Specialist が正しく報告（Checker は単なるラグ）

### なぜレンズは 5〜7 で、レビュアーは 1 名か

専門分化（レンズ）が効く最小構成は 5〜7。同じレンズを 2 回当てても偽陽性が増えるだけ。
一方、レンズごとに**別のエージェントを並列起動する**必要は無い——findings の品質を支えているのは「レンズごとに観点を絞り、オーケストレータが独立したファイルへ原文のまま残す」ことであり、別人格ではない。
実測（2026-08-22、文書 PR 1 本）では 7 名×Opus×2 ラウンドでレビュアー 14 名分のコストが掛かり、R2 以降は収穫逓減だった。1 名が順に当てれば、コードを読む作業の重複（7 名が同じファイルを 7 回読む）も消える。
Fresh Eyes の独立性だけは別人格に依存していたので、「最初に当てる・修正済み事項を後から読む」という順序で代替する。

### FP レジストリの寿命

サイクル開始時に作成し、完了ログへの書き出し後に一時状態とともに削除する。次サイクルでは完了ログから安全条件を満たす偽陽性だけを carry-over する。繰り返す誤判定は、別途「設計上の事実」への昇格も検討する。

## 追加リソース

- **`references/specialist-roles.md`** — 5 ロールのフォーカスエリアとプロンプトテンプレート
- **`references/fp-registry-format.md`** — FP レジストリのエントリフォーマット・照合ルール・前回ログからの carry-over
- **`references/durable-state.md`** — `REVIEW_DIR` の生成と安全検査・state の構造と再開判定・findings ファイルの有効性
- **`references/minimal-context-feeder.md`** — code-review-graph の起動条件・2 段呼び出し・fail-open フォールバック
- **`references/cycle-log-format.md`** — サイクル横断ログの形式・ファイル書込規則・最新エントリの選択
- **`references/ambiguity-hunter.md`** — #6 Ambiguity Hunter（文章仕様の曖昧さ）の7分類・出力・明文化案・起動条件
- **`references/altitude-checker.md`** — #7 Altitude Checker（詳細レベル overfit）の5分類・出力・移設案・#6 との裁定
