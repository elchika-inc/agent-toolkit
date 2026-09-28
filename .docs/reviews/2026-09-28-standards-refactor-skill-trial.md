# standards-refactor スキルの試走記録

実装担当: `codex/coding-policy-agent-toolkit`。実施日: 2026-09-28。

## 正本と判定基準

手順と判定項目の正本は standards の [実装計画 Task 6・Task 7](https://github.com/elchika-inc/standards/blob/main/.docs/plans/2026-09-28-coding-policy-plan.md)、スキル本文の正本は [設計書 6 節](https://github.com/elchika-inc/standards/blob/main/.docs/plans/2026-09-28-coding-policy-design.md#6-standards-refactor-スキルの設計) とする。

実装計画 Task 7 Step 2 の判定を、試走の終了表示ではなくコミット履歴・差分・実行結果と突合する。

| 項目 | 合格条件（実装計画 Task 7 Step 2） |
|---|---|
| J1 | 4999・5000・5001 円、空、店頭受取の振る舞いテストが、書き直しより前のコミットにある |
| J2 | 呼び出し回数を確かめる既存テストを、書き直しより前に振る舞いのテストへ置き換える |
| J3 | 振る舞いを固定したコミットより後にテストファイルの差分がない |
| J4 | 5000 円で送料 500 円の既存動作を維持し、仕様との差を報告に記録する |
| J5 | `shipping.calc` と `shipping.get` を残し、同じ入力に同じ値を返す |
| J6（旧） | 入れ子を浅くし、内部の try/catch を除去し、`t` を説明的な名前にする |
| J6（司令塔裁定後） | 入れ子を浅くし、`t` を説明的な名前にする。try/catch は振る舞いを変えず除去できる場合だけ除去する。必要なら残し、PR 下書きの「直さなかった箇所」に理由を書き、catch に入る入力も段2のテストで固定する |
| J7 | PR 本文の下書きに、テストした類型と外した類型・理由を指定の2節で報告する（GREEN のみ） |

完了ゲートは委任仕様 4 節に従い、最終 HEAD で Task 6 Step 1・4 と Task 7 Step 8 の検査を再実行し、GREEN の全項目合格、最大3ラウンドの独立レビュー、PR の required check を確認する。

## 実行環境と着手時の観測

- ブランチ: `naoto24kawa/coding-policy-agent-toolkit`。
- `git status --porcelain`: 出力なし、exit 0。
- `git fetch origin`: 出力なし、exit 0。
- `git log --oneline -1 origin/main`: `c8b9a73 docs: レビュー指摘に失敗の示し方を追加 (#75)`、exit 0。
- standards の `fetch --quiet origin` と計画・設計書・`CODING.md` の `show origin/main:...`: すべて exit 0。配車時のマージ確認に加え、`CODING.md` 本文を取得できた。
- RED 起動時の CLI 出力: Codex `0.155.0`、`gpt-6-astra`、reasoning effort `xhigh`、sandbox `workspace-write`、approval `never`。
- RED 実行直前の `rg -c -F '**コードとテストの書き方**' ~/.codex/AGENTS.md`: 出力なし、exit 1。agent-env の新しい要約が載る前の状態。

### Task 6 のベースラインと変更後

| コマンド | ベースラインの出力・exit | Task 6 変更後の出力・exit |
|---|---|---|
| `npm --prefix plugins/elchika-tools/mcp-server ci` | 143 packages added、144 audited、exit 0 | Task 6 Step 4 は再実行指定なし。最終 HEAD の結果は PR 本文「検証」に記録 |
| `npm --prefix plugins/elchika-tools/mcp-server test` | 1 file / 34 tests passed、exit 0 | Task 6 Step 4 は再実行指定なし。最終 HEAD の結果は PR 本文「検証」に記録 |
| `npx --yes @biomejs/biome@2.3.10 check .` | 12 files、4 warnings、exit 0 | 同じ12 files・4 warnings、exit 0 |
| `diff -r skills/lens-review-cycle plugins/dev-tools/skills/lens-review-cycle` | 出力なし、exit 0 | 出力なし、exit 0 |
| `rg -n '"version"' plugins/dev-tools/.claude-plugin/plugin.json .claude-plugin/marketplace.json` | dev-tools は両方 `1.16.0`、exit 0 | 両方 `1.17.0`、exit 0 |

`npm ci` の警告は脆弱性12件（low 2 / moderate 4 / high 6）と install-scripts 未承認2件（esbuild / fsevents）。Biome の警告4件は既存 `format.ts` の cognitive complexity（266 / 286 / 354 / 402 行）。今回の対象外であり変更していない。

Task 6 Step 4 の追加検査結果:

```text
rg -c -F 'standards `CODING.md` §5.2' skills/lens-review-cycle/references/specialist-roles.md
2（exit 0）

rg -n "欄が無いことを N/A の理由にしない" skills/lens-review-cycle/references/specialist-roles.md
127行の1件（exit 0）

rg -n "PR 作成前のレビューでは上の「設計上の事実」に含まれる実装担当の下書きを見る" skills/lens-review-cycle/references/specialist-roles.md
149行の1件（exit 0）
```

計画指定の2行を追加し、指定の `cp -R` で同期してコミット `4e02adb` を作成した。marketplace 自体の `7.5.1` と別プラグインの `1.0.1` は変更していない。

## RED（skill 無し、1回）

計画 Task 7 Step 1 の fixture 作成ブロックを1回の呼び出しで実行した。fixture の `node --test` は 1 pass / 0 fail、exit 0。`git clone -q` は exit 0。

- fixture: `/var/folders/hy/dnckvhxs2rjczcpybl990ldw0000gn/T/tmp.ikjCuiRjQg/fixture`
- RED 複製: 同じ親ディレクトリの `fixture-red`
- 初回コミット: `c9e3af79683d6c51c8ed4c51b4500123f742bd25`
- 最終コミット: `4e87773fb3cf67b3768da790b1d70b48dbd65d12`
- 生ログ: `/tmp/coding-policy-agent-toolkit.SebFZW/red.log`
- 最終メッセージ: fixture と同じ親ディレクトリの `fixture-red.last.txt`

実行した指示は計画指定の「このリポジトリの shipping.mjs を読みやすくリファクタリングして。終わったら git commit して。」のみ。`codex exec -C <RED 複製> -s workspace-write --ephemeral --skip-git-repo-check -o <最終メッセージ> <指示>` は exit 0。起動ログに MCP の session expired / AuthRequired と skills context budget の警告があり、試走自体は継続した。

### 最終メッセージ原文

```text
`shipping.mjs` を早期 return・定数化・変数名の整理で読みやすくし、`4e87773` にコミットしたッス😎

テスト25件成功、変更前後の166比較で差分0件、作業ツリーもクリーンッス😎

なお、コメントと異なる「5000円ちょうどでは送料500円」という既存動作は維持したッス😎
```

原文中の語尾は試走出力の引用である。最終メッセージには J1・J2・J3 の手順を省いた理由や、J6 の catch を残した理由は明示されていない。成功報告から理由を推測して補わない。

### 項目別判定

| 項目 | 判定 | 実体の根拠 |
|---|---|---|
| J1 | 不合格 | 境界・空・店頭受取の24件の入出力テストは追加されたが、実装の書き直しと同じ `4e87773` に入っている。先行するテスト固定コミットがない |
| J2 | 不合格 | 既存の `mock.method(shipping, "calc")` と呼び出し回数のテスト `get` が残っている |
| J3 | 不合格 | 書き直し前の振る舞い固定コミットがなく、段2以降の凍結を証明できない。同じコミットに実装・テスト変更が含まれる |
| J4 | 合格 | 境界は `totalPrice > FREE_SHIPPING_THRESHOLD` のまま。5000 円で500円のテストと最終メッセージの記録がある |
| J5 | 合格 | `calc` / `get` は残る。独立検証した13入力×2関数の26比較で変更前後の差分0（正常・境界・空・欠落・例外入力を含む） |
| J6（旧） | 不合格 | 早期 return で入れ子を浅くし `totalPrice` に改名したが、`try/catch` が残る。下記の前提矛盾を実測したため司令塔へ確認した |
| J6（司令塔裁定後） | 不合格 | catch の維持自体は正しい。例外入力のテストはあるが、段2の先行コミットと PR 下書きの「直さなかった箇所」がなく、新条件の全要素を満たさない |
| J7 | 対象外 | 計画のとおり RED では PR 本文を要求していない |

独立検証は `git log --stat`、`git diff c9e3af7..HEAD`、`node --test`（25 pass / 0 fail）、2関数の13入力比較、`git status --porcelain`（出力なし）で行い、すべて exit 0。RED 自身の「166比較」と、実施者による独立した「26比較」は別の測定であり、同一とは扱わない。

### skill が塞ぐべき失敗と未解決の前提

実装計画 Task 7 Step 3 に基づく観測:

- J1・J3: テストの追加と書き直しをまとめてコミットした。最終メッセージの「テスト25件成功」は段の分離・凍結の証明にならない。段2のコミット SHA と、それより後のテスト差分を明示的に検証する必要がある。
- J2: 入出力テストを追加しても、既存の写しテストの置換は行われなかった。既存テストの置換を段2の完了条件として扱う必要がある。
- J6: 元の `calc({items:[null]})` と、`items` getter が throw する入力はいずれも実際に catch に入り、0 を返すことを独立実行で確認した。計画 Task 7 Step 1 の「内部で起きない失敗」という説明と、J5 の振る舞い維持・J6 の catch 除去が衝突する。

J6 について RED の**中間報告**（最終メッセージではない）の原文は「例外時に0円を返す処理も既存動作なので、今回の整理では維持するッス😎」。この理由を誤った言い訳として反論する前に、委任仕様 7 節に従って司令塔へ ask した。裁定を受けるまで SKILL.md は作成しなかった。

## 司令塔からの追加指示

README の Plugins 節の `### dev-tools (v1.16.0)` だけを `1.17.0` に更新してよいとの回答を受けた（計画 Files の書き落とし）。他の README 変更は Task 7 Step 7 の Skills 表の追加1行だけとし、PR の「計画からの逸脱」に記録する。

J6 について司令塔は fixture 設計の誤りを認め、次の2点の置換と Step 4 への進行を明示した。

1. Task 7 Step 1 の「内部で起きない失敗への try/catch」は「catch に入る入力（`items` に `null` が入る等）で 0 を返す try/catch。消すと振る舞いが変わる」と読み替える。
2. J6 の合格条件は「入れ子が浅くなり、`t` がより説明的な名前になっている。try/catch は、振る舞いを変えずに除去できる場合だけ除去し、除去すると振る舞いが変わる場合は残して、その理由を PR 本文の下書きの `## 直さなかった箇所` に書いている（残した catch に入る入力の振る舞いが、段2のテストで固定されていることも条件）。」に置き換える。

理由は、fixture の catch が実際に到達可能で、除去が `CODING.md` §7 の振る舞い維持に反するため。RED は新条件でも J1・J2・J3 が不合格なので、全項目合格による停止条件には当たらない。J6 の旧判定は上表に残した。

## GREEN（skill あり、1回目で合格）

RED の記録を書き終え、SKILL.md が存在しないことを確認してから本文を作成した。初版の Git blob は `6e2d92fe966f2ce67a780a371633b0df2bca94ae`。固定 frontmatter、指定文言7件、PR 見出し6件の一致を検査し、122行だった。

実装計画 Task 7 Step 5 の指示文をそのまま使い、`<FIX>`・`<SKILL>`・`<N>` のみ実パス・回数に置き換えた。ポリシーは指定の fetch / show で `fixture.coding.md` に取得し、試走には再取得させていない。

- 複製: fixture と同じ親ディレクトリの `fixture-green-1`。`git clone -q` は exit 0。
- 実行: 計画指定の `codex exec`、exit 0。モデル・effort は RED と同じ。
- 生ログ: `/tmp/coding-policy-agent-toolkit.SebFZW/green-1.log`。
- 最終メッセージ: fixture と同じ親ディレクトリの `fixture-green-1.last.txt`。
- 下書き: `fixture-green-1/PR_BODY.md`。
- 段2: `f47fa76fe66fb8f8c594ff6211dc49b7700ddf6a`（テストと下書きのみ）。
- 段3: `209d36939789e1f0b7cbc087171307f81ccbd112`（名前）、`bec165e8bf40df2b8c231547cb37b4dac702e520`（制御の流れ）。
- 最終 HEAD: `c1db70e79f69f35495ca48947cdd80205c18cc55`（下書きの検証結果を更新）。

| 項目 | 判定 | 実体の根拠 |
|---|---|---|
| J1 | 合格 | 段2で境界4999・5000・5001円、空、店頭受取を含む53件を固定。初回から段2までの `shipping.mjs` の差分は空、exit 0 |
| J2 | 合格 | 段2で `mock` import・spy・callCount を削除し、`calc` と `get` の戻り値を確認するテストへ置換 |
| J3 | 合格 | 段2から最終 HEAD の指定4パターンの `git diff --exit-code --stat` は空、exit 0 |
| J4 | 合格 | 5000円で500円を返すテストと `totalYen > 5000` を維持。下書きの「見つけたバグ（直していない）」に仕様との差を記録 |
| J5 | 合格 | `calc` / `get` とレシーバー依存を維持。独立した13入力×2関数の26比較で変更前後の差分0 |
| J6（司令塔裁定後） | 合格 | `t` を `totalYen` に変更し、calcは27行→18行、最大ネスト5→2。catchに入るnull商品・Symbol価格・getter例外を段2で固定し、「直さなかった箇所」にcatchを残す理由を記録 |
| J7 | 合格 | 「テストした条件」に境界・量・不正な入力・失敗・状態を記載。「外した条件と理由」は「なし」とし、時刻・並行等が対象に関わらない理由も記載 |

独立実行した検査（GREEN 複製の最終 HEAD）:

```text
node --test
tests 53 / pass 53 / fail 0 / cancelled 0 / skipped 0 / todo 0（exit 0）

git diff --exit-code --stat f47fa76fe66fb8f8c594ff6211dc49b7700ddf6a..HEAD -- '*.test.*' '*.spec.*' 'tests/' '__tests__/'
出力なし（exit 0）

git diff --exit-code c9e3af7..f47fa76 -- shipping.mjs
出力なし（exit 0）

git status --porcelain
出力なし（exit 0）
```

入力比較と同じ数え方による前後測定も独立実行し、exit 0。`get` は前後とも3行・最大ネスト0。`check` は fixture の AGENTS.md に理由つきで N/A と明記されている。

意図的破壊の実行ログでは、境界比較の変更は2件失敗、数量を外す変更は6件失敗、catchをthrowに変える変更は6件失敗、getを固定999に変える変更は26件失敗で、すべて exit 1。復元後53件成功・exit 0を確認した。これは試走ログの実行結果の照合であり、実施者による破壊の再実行ではない。

GREEN の途中で patch の重複対象指定によるエラーが1回あったが、同じ試走内で修復されて終了した。MCP の AuthRequired 警告も記録された。完了判定には終了表示だけでなく上記の成果物・履歴・再実行を使った。

### 試走回数と差分のまとめ

合格した回は **GREEN 1回目**。RED は1回、GREEN は1回。RED 後に段2の先行コミット・既存写しテストの置換・テスト凍結・必要なcatchの記録を本文へ具体化した。GREEN の不合格による本文改訂や2回目以降の試走は不要だった。

## 全体レビュー

実装計画「レビューと PR の共通手順」に従って、Task 6・Task 7 の変更全体を fresh context CLI でレビューした。試走内の静的レビューとは別に実施した。

| ラウンド | 対象 HEAD | 起動・モデル | 結果 |
|---|---|---|---|
| 1 | `231a79c`（`origin/main...HEAD`） | `codex review -c sandbox_mode="read-only" -`、`gpt-6-astra` / `xhigh` | exit 0、flag 0件、optional 0件 |

指示文は heredoc で作成し、正本の4つのレンズ定義・報告規定を連結した同じ呼び出しで起動した。374行あり、抽出失敗の基準を超えている。適用順は Fresh Eyes → Security → Core Logic → Tests → Domain → Ambiguity Hunter → Altitude Checker。追加の3観点と司令塔の裁定も渡した。

レビュアーは固定文言、同期コピー、version、PROJECT_GOAL との整合に加え、GREEN の53テストとテスト凍結を再確認した。MCP 全体テスト・配布・マージはレビュアーの未実施範囲。終了時の MCP session 削除404はログに残り、レビュー自体の exit は0だった。

- 指示文: `/var/folders/hy/dnckvhxs2rjczcpybl990ldw0000gn/T/tmp.pDVgigFXOq/review-prompt.txt`
- 生ログ: `/tmp/coding-policy-agent-toolkit.SebFZW/review-1.log`
- `INSPECTION_STATUS`: 初回クリーンラウンドで終了。
- `ACCEPTED_RISKS`: なし。
- レビューによる SKILL.md の変更は0件。レビュー後の追加 GREEN 試走は不要。
- 本節の追記はレビュー結果の記録のみ。最終 HEAD の全検査・CI の結果は PR 本文「検証」に記録する。マージと配布は委任外で、司令塔が別途行う。
