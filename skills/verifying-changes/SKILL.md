---
name: verifying-changes
description: 'PR・昇格 PR・本番デプロイのあとに、司令塔から配車された確認役が動作を確かめ、実測記録を基に結果を分類して GitHub へ残すときに使う。PR・昇格・本番の確認は verifying-changes、検証資料をリポジトリへ残す依頼は documenting-verification が扱う。'
---

# 変更の動作確認

確認役は事実を `results.json` に書く。分類・判定と GitHub への書き込みはスクリプト、独立した完了確認は司令塔が行う。実装担当の証跡を根拠にしない。PR 本文から読むのは成功基準と検証手順だけ。

Node 24・`gh`・`playwright-cli` を使う。スクリプトはこの skill の `scripts/` にある。インストール先は `~/.agents/skills/verifying-changes/`。参照先は用途に応じて読む。

- 結果を書く前: [結果の項目](references/results.md)
- 比較の回数と分類を確認するとき: [分類と判定](references/triage.md)
- C を実行する前: [本番の見張り](references/production-guard.md)
- 司令塔の配車と完了ゲート: [司令塔の手順](references/coordinator.md)

## 入力

配車の仕様から次を受け取る。不足や矛盾は Orca の `ask` で司令塔へ返す。

| 入力 | 内容 |
|---|---|
| kind | A: PR、B: 昇格 PR、C: 本番 |
| リポジトリ・PR・Task ID | `owner/name`、PR 番号、Orca の Task ID |
| 対象の SHA | A: PR head、B: 昇格用ブランチの先端、C: `production` の先端（昇格 PR の merge commit） |
| 比較の相手 | A: head と main の merge-base、B: production の先端、C: 無し |
| 証跡の置き場 | `~/orca/artifacts/verifying-changes/<owner>-<name>/<runId>/`。worktree の外 |
| runId | `YYYYMMDD-HHMMSS-kind-PR番号` |
| モード | `dry-run`（既定）または明示された `write` |
| 時間の上限 | 暫定 A 60 分・B 120 分・C 20 分。配車で指定された値を使う |
| C の追加情報 | deploy workflow のファイル名、本番の対象と許可 host、許す書き込み |
| やり直し | 前回の results.json の場所、確認範囲（前回以降の差分の影響範囲と前回の発見、または成功基準の行と前回の発見） |

証跡は PR のブランチに commit しない。画像は必ず自分で見てから添付候補にする。実データの個人情報・秘密が写っている画像は添付しない。判定の初期値は成功ではない。

## A と B の手順

1. 対象の `AGENTS.md` の `## エージェント連携` を読む。宣言と実物の違いは `category: "declaration"` の発見にする。
2. 確認用 worktree を対象 SHA に合わせ、点検する。exit 1 なら自分で環境を変更せず `ask` で止まる。

   ```bash
   node <skill>/scripts/preflight.mjs --worktree <worktree> --expect-sha <対象SHA> --ports <ポート一覧> --out <置き場>/preflight.json
   ```

   `.dev.vars*`・`.env*` の未追跡・無視ファイルは自動でハッシュを記録する。それ以外に保護するファイルがあれば `--secret-files <worktreeからの相対パス,…>` を足す。
3. ダミーの env を証跡の置き場に作る。キー名・起動方法・初期化は宣言に従い、ローカルデータの置き場を SHA ごとに分ける。wrangler は必ず `--env-file <worktree外のダミー>` を付ける。起動出力の `Using secrets defined in` の行がダミーを指し、`.dev.vars` を含まないことを確かめる。web の API 接続先も起動ポートに合わせる（宣言が `VITE_API_URL` を使うならそれを渡す）。起動ログへ秘密を出さない。
4. 宣言した URL と CORS の到達を確認する。`--url` の直後の `--origin` はその URL の検査に対応する。

   ```bash
   node <skill>/scripts/reach-check.mjs --url <APIのURL> --origin <webのOrigin> --out <置き場>/reach.json
   ```

   exit 1 は `declaration` または `environment` の発見にして `ask` で止まる。CLI だけの検証には到達確認は不要。
5. A は差分の影響する route と PR の成功基準、B は全 route × 両テーマを範囲にする。やり直しでは配車の範囲を使う。
6. 宣言の `browser`・`http`・`cli` を実行し、マトリクスを作る。ブラウザの道具の cwd は証跡の置き場の下。表示・操作・console/通信・a11y・キーボードを混同しない。関連 Issue が bug、PR の title が `fix:`・`fix(` で始まる、または PR のラベルに bug がある場合は、直したはずの症状を `fixChecks` に記録する。
7. `product` の発見と `fixChecks` ごとに、見つけた回とは別に head で 3 回確かめる。`environment` と `declaration` は繰り返さない。
8. head で 1 回以上起きた `product` と、すべての `fixChecks` は比較の相手でも 3 回確かめる。自分が起動したプロセスを止めて `git switch --detach <比較SHA>` し、依存を入れ直し、head と別のデータ置き場を初期化する。終わったら対象の head に戻す。途中でやめた場合は実際の回数と `aborted.reason` を残す。
9. `results.json` を書く。時間上限に達したら `timedOut: true` とし、未確認の行を `skip` と理由で残す。成功基準の skip は宣言済みの未検証経路でも承認にならない。
10. 自分が起動したプロセスとブラウザを閉じる。**確認対象 worktree を cwd にして**片付けを検査する。

    ```bash
    node <skill>/scripts/cleanup-check.mjs --preflight <置き場>/preflight.json --ports <使用したポート一覧> --session <専用session> --out <置き場>/cleanup.json
    ```

    session を渡さない場合、`browserClosed` は null。ブラウザ終了の実測を `results.json` の `cleanup.browserClosed` に記録する。
11. `node <skill>/scripts/scan-artifacts.mjs --dir <置き場>` を実行する。exit 1/2 なら内容を表示・投稿せず、原因を司令塔に報告する。
12. `node <skill>/scripts/publish.mjs --results <置き場>/results.json` を実行する。配車が `write` の場合だけ `--write` を足す。書き込み失敗は `operation-errors.json` を読み、成功記録を消さずに再開する。
13. `worker_done` で結果の置き場と各スクリプトの exit、実測の範囲、未確認事項を報告する。失敗を成功として送らず、preamble の taskId・dispatchId・送信回数に従う。

## C の手順

本番を開くのは `production-check.mjs` だけ。確認役が別のブラウザや curl で直接本番を開かない。

1. 対象リポジトリの宣言から、対象・許可 host・許す書き込みを取り、置き場へ `targets.json` を作る。各項目は `{ name, kind: "page" | "http", url, expectStatus, expectSelectors: [] }`。
2. 最初はすべての対象を直下へ記録する。**C の対象 SHA は production の先端（merge commit）**を使う。

   ```bash
   node <skill>/scripts/production-check.mjs --repo <owner/name> --expect-sha <productionのSHA> --deploy-workflow <workflow.yml> --targets <置き場>/targets.json --allow-hosts <host[:port],…> --out <置き場> --run-id <runId> --budget-seconds <残り秒数>
   ```

   宣言が許す GraphQL query のみ、`--allow-write POST:<URLの前方一致>` を足せる。`--remote` と `VERIFYING_CHANGES_GH` の差し替えは自己テスト専用。本番では使わない。
   exit 1 なら別の手段で本番を開かず、記録を報告して止まる。
3. 記録と画像を読み、`product` の発見に `target`（対象の name）を書く。発見ごとに、見つけた回とは別にちょうど 3 回、その対象だけの targets ファイルでスクリプトを回す。出力先は `<置き場>/reruns/<発見id>-<n>/`、run-id は同じ値。**直下の production-log.json を上書きしない**。
   各回の `--budget-seconds` は C 全体の残り時間。全体の上限で `timedOut: true`。やり直し中の exit 1（別の deploy が入るなど）はそこで中断し、実際に回せた回数を `headRuns.tried`、理由を `aborted.reason` に書く。
4. `results.json` を作る。見張りが止めた通信、宣言で予期した未ログインの 401 など、宣言した本番 host 以外のエラーは製品の発見に数えない。
5. `scan-artifacts.mjs --dir <置き場>` を実行し、exit 0 を確かめる。
6. `publish.mjs --results <置き場>/results.json`（明示された write だけ `--write`）を実行する。
7. `worker_done` で記録と各 exit を報告する。C では preflight・reach-check・cleanup-check は使わない。

本番のブラウザはリダイレクトをたどらない。3xx は応答と移動先を記録して止める。宣言の対象にはリダイレクトしない URL を書き、リダイレクトする URL を対象にするなら期待の応答に 3xx を書く。リダイレクトしたページの selector は未確認（null）、画像・a11y は null になり得る。

## 再開と上限

`published.json` を消さず、同じ runId・同じ結果で publish を再実行する。添付は GitHub の目印も照合し、Issue は同じ指紋を照合する。読み取りの一過性エラーは最大 2 回再試行、書き込みの不明な成否は自動で再送しない。失敗はファイルに残り、独立した操作は続く。

再現は各側 3 回、新規 Issue は 1 run 5 件、添付は 1 コメント 50 枚。上限で省いた内容はまとめに残す。確認と修正の往復は司令塔が 3 回で止める。中止・操舵は Orca の連絡とプロセスの SIGINT/SIGTERM を使い、自分の session だけを片付ける。

## してはいけないこと

**GitHub への書き込みは publish.mjs だけで行う**。

- リポジトリのファイルを編集する、commit・push する（比較のための detach と head 復帰だけを行う）。
- `gh` で直接コメント・起票・ラベル・本文の編集をする。
- 本物の鍵のファイルを使う・表示する、秘密を argv・ログ・結果に書く。
- wrangler を `--env-file` なしで起動する。
- 自分が起動していないプロセスを止める。
- 確認していない画像を添付する、署名付き URL を出す。
- この配車で `documenting-verification` を使う。

## ask で止まる条件

点検・到達で止まった、宣言どおりに起動できない、指示と実態が矛盾する場合は、影響する作業を止め Orca の `ask` で司令塔へ報告する。失敗を握りつぶして結果を 0 件にしない。
