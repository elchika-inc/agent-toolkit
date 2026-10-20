# 司令塔の配車と完了ゲート

この文書の運用規則は、導入計画 Task 9 で standards の `recipes/agent-verification.md` へ置き、Task 10 でここを参照へ切り替える。それまではこの手順を使う。standards 側の置き換えがマージされるまでは、実装担当による動作確認の既存 MUST も引き続き守る。

## 配車とやり直し

| kind | 合図 | 対象・比較 | 範囲 |
|---|---|---|---|
| A | PR 作成・head 更新 | PR head と main の merge-base | 差分が影響する route と成功基準。共有部品なら全ページ |
| B | 昇格 PR 作成・promote ブランチ更新 | 昇格用ブランチ先端と production 先端 | 全 route × 両テーマ |
| C | production push による deploy 成功 | production 先端の merge commit。比較なし | 宣言された本番の対象 |

実装担当の完了ゲート後、A・B の確認役を新しい Orca worktree の対象 SHA で起動する。C は昇格 PR をマージした司令塔が deploy を background で見張り、成功してから配車する。人が直接マージした場合は人から司令塔へ知らせる。

確認役には成功基準と検証手順を渡し、実装担当の証跡を根拠にさせない。A の成功基準は関連 Issue、無ければ PR 本文から取る。バグ修正では比較側で症状が起き、head で起きないことを fixChecks に記録させる。

head が変わったら古い結果では承認・マージしない。前回の results.json と新旧 SHA を渡し、前回からの差分の影響範囲と前回の発見を確かめ直す。main の取り込みだけで、merge-base から head までの PR 自身の差分が前回と同じなら、成功基準の行と前回の発見だけでよい。結果は必ず新しい head に結び付ける。

A で今回の変更による問題が残り続ける場合、確認と修正の往復は最大 3 回で止め、人へ返す。時間は暫定 A 60 分・B 120 分・C 20 分。配車に具体的な上限を書く。タイムアウトは成功に数えない。

並行してよいのは別のリポジトリどうし、またはポートを変更できるリポジトリだけ。ポートを変えられなければ直列にする。司令塔を通らない PR は人から連絡を受けて配車する。マージを頼まれた際は今の head SHA に対する A のまとめコメントを確認し、無ければ配車する。PR を常時見張る仕組みは置かない。

## N/A

変更ファイルがすべて deploy の paths-ignore に当たる文書変更、または実行するものを持たないリポジトリでは配車しない。理由を測って、同じ publish で N/A のまとめを残す。

```bash
node <skill>/scripts/publish.mjs --na <理由> --kind A --repo <owner/name> --pr <番号> --sha <SHA> --out <置き場>
```

既定は dry-run。明示された write の場合だけ `--write` を足す。

## 独立した完了ゲート

worker_done の受信や results.json の自己申告を根拠に通さない。司令塔が以下の実体を直接測り、各記録と突き合わせる。不一致・測定失敗は止める。

### A と B

1. `git -C <確認役のworktree> rev-parse HEAD` を自分で実行し、PR head（B は昇格用ブランチの先端）と比較する。
2. preflight.json の headMatches が true。browser/http を実行した場合は reach.json の ok が true。
3. cleanup.json の ok が true。ブラウザ終了・ポート解放・秘密ファイル不変を確認する。
4. `scan-artifacts.mjs --dir <置き場>` を実行して exit 0。pipe で exit を隠さない。
5. dry-run は planned-operations.json、write は GitHub のコメント・Issue・PR 本文の実物と照合する。

### C

1. `git ls-remote https://github.com/<repo>.git refs/heads/production` を自分で測り、results.json の targetSha と比べる。
2. 直下の production-log.json の deployCheck.ok が true、productionSha が targetSha と一致。remote は `https://github.com/<repo>.git`、ghBin は `gh` のまま。guardSelfCheck の 3 項目がすべて true。
3. reruns を含むすべての production-log.json を読み、requests の blocked:false の method が GET・HEAD・OPTIONS または宣言で許すものだけであることを確認する。各対象の記録と再現回数も突き合わせる。
4. `playwright-cli list --all` を自分で実行し、`vc-<runId>-` で始まる session が残らないことを確かめる。`--all` を省くと司令塔の cwd 以外を見落とす。
5. scan-artifacts の exit 0、planned-operations.json（write は GitHub の実物）を確認する。

C で published.json（dry-run は planned-operations.json）に新しい create-issue があれば「あなた待ち」で人に知らせる。comment-issue だけなら新たな通知はしない。

B で regression が出たときは昇格 PR を閉じずに承認しないまま残す。main への通常 PR で修正または revert し、新しい昇格用ブランチで B をやり直す。原因の PR 候補は断定せずに列挙する。

## 配車の仕様の雛形

`delegation-spec` の必須 7 節を使い、以下の欄を実測値で埋める。kind の違いは表の値と該当の手順へ展開し、不要な選択肢を残さない。

### 1. 背景

- kind: `<A / B / C>`、repo: `<owner/name>`、PR: `<番号>`、Task ID: `<Orca Task ID>`。
- 対象 SHA: `<AはPR head / Bはpromote先端 / Cはproduction先端>`。
- 比較 SHA: `<Aはmainとのmerge-base / Bはproduction先端 / Cは無し>`。
- 宣言の所在と成功基準: `<AGENTS.mdの節、関連IssueまたはPR本文の成功基準>`。
- C: `<deploy workflowファイル名、成功run、対象URL・期待応答・selector、許可host、許す書き込み>`。
- やり直しなら `<前回results.json、新旧SHA、前回以降の差分と発見 / 成功基準の行と発見>`。

### 2. 実施内容（literal）

- `verifying-changes` の該当 kind の手順を順に実行する。
- runId: `<YYYYMMDD-HHMMSS-kind-PR番号>`、置き場: `<worktree外の専用ディレクトリ>`。
- モード: `<dry-run / write>`。時間の上限: `<正の秒数、A3600/B7200/C1200を暫定値として指定>`。
- A/B: `<worktree、ポート、ダミーenvのキー名、SHA別データ置き場、起動と初期化の宣言>`。product と fixChecks は発見時とは別に head で 3 回、必要な比較側で 3 回。
- C: 本番は production-check だけで開く。product の target ごとに別出力先で 3 回。残り時間を毎回渡し、初回の記録を維持する。
- results.json と各検査記録を保存し、scan 後に publish を実行する。

### 3. スコープ外

リポジトリの編集・commit・push、秘密ファイルの利用・表示、本番への書き込み、publish 以外の GitHub 書き込み、他者のプロセス停止、未確認の画像の添付は禁止。C は別のブラウザや curl で本番を開かない。documenting-verification は使わない。

### 4. 検証（rubric）

`results.json` の形式検査、kind ごとの各スクリプトの exit、片付け、scan exit 0、planned-operations（write は published）を残す。成功は自己採点せずスクリプトの判定と上記の司令塔の独立ゲートによる。worker_done に、存在・実行・動作のどこまで確かめたか、実際の回数と未確認を含める。

### 5. レビューサイクル

N/A（成果物は PR ではなく結果のファイル。判定はスクリプトが行い、司令塔が完了ゲートで突き合わせる）。

### 6. 完了条件

結果の置き場と各 exit を worker_done で返す。Orca preamble の taskId・dispatchId を両方付け、成功／失敗を区別して一度だけ送る。GitHub への公開は指定されたモードに従い、PR のマージはしない。

### 7. 制約

指示と実態が矛盾したら止めて ask で報告する。点検・到達の失敗、宣言どおりに起動できない場合も同じ。許された裁量は確認の順番と証跡の説明に限り、kind・比較対象・再現回数・判定・公開モードを変えない。環境制約で遂行できない場合も範囲を返さず ask で判断を待つ。
