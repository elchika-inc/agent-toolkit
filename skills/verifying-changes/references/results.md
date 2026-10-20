# 結果のファイル

`results.json` は確認した事実だけを記録する。分類・判定・指紋はスクリプトが計算する。`readResults` が型・必須項目を検証し、不正なら場所を示す `ResultsError` で止まる。最小の例は同梱の `tests/fixtures/results/valid-a.json`。値はすべて合成データである。

| 項目 | 内容 |
|---|---|
| `schema` | `verifying-changes/results-v1` |
| `kind` | `A`（PR）、`B`（昇格 PR）、`C`（本番） |
| `repo`, `pr` | `owner/name` と正の PR 番号 |
| `targetSha`, `baseSha` | 40 桁の SHA。C の `baseSha` は null |
| `runId` | `YYYYMMDD-HHMMSS-kind-PR番号` |
| `taskId` | Orca の Task ID |
| `startedAt`, `finishedAt` | ISO 8601 の日時 |
| `checkTypes` | `browser`・`http`・`cli` の配列 |
| `environment` | `urls`・`tools` は文字列の配列、`viewport` は画面幅などの文字列（該当しなければ `N/A`） |
| `timedOut` | 全体の時間上限に達した場合 true |
| `aborted` | 通常 null。中断した場合 `{ "reason": "理由" }` |
| `matrix` | 下表の行の配列。空の場合は判定できない |
| `fixChecks` | 修正の比較。A のバグ修正で使用し、それ以外は空配列 |
| `findings` | 発見の配列 |
| `unverified` | `{ item, reason, declaredUnverifiable }` の配列。最後の項目は真偽値 |
| `cleanup` | `{ browserClosed: true または false }` |
| `includedPrs` | B のみ必須。`{ number, files: [変更ファイル] }` の配列 |

## マトリクスの行

`{ surface, successCriterion, cells, skipReason, evidence }`。
`surface` は経路、`successCriterion` は成功基準の行かを示す真偽値。
`cells` の値は `pass` / `fail` / `skip`。ブラウザでは `light`, `dark`, `console`, `a11y`, `keyboard` など、C は `status`, `selectors`, `console` を使う。
`skipReason` は理由または null。`evidence` は置き場内の相対パスの配列。
`fail` の行には、正規化後に同じ `surface` になる発見が必要。

## 発見と再現

各発見は `id`, `title`, `category`, `surface`, `symptom`, `key`, `severity`, `steps`, `expected`, `actual`, `evidence`, `headRuns`, `baseRuns` を持つ。

- `id` は一意の英数字・下線・ハイフン（例: `F1`）。
- `category`: `product` / `environment` / `declaration`。
- `symptom`: `console` / `network` / `layout` / `a11y` / `keyboard` / `behavior` / `expectation` / `declaration`。
- `steps` と `evidence` は文字列の配列。`key` は同じ問題を識別する症状の要点。
- B の `candidatePrs` は原因の候補の PR 番号の配列（候補が無ければ空）。
- C の `product` は `target`（本番の `targets[].name`）も持つ。

回数は `{ tried, occurred }`。見つけた回を含めず、別に 3 回確かめる。
`product` の `headRuns.tried` と `fixChecks` の両側の `tried` は 3。
A・B の `product` が head で 1 回以上起きた場合、`baseRuns.tried` も 3。
再現しない発見と C の `baseRuns`、環境・宣言の両側は null にできる。
`timedOut: true` または `aborted` があるときだけ、未実施を null、途中の回数を 0〜3 で記録できる。
不足した回数は `incomplete` として扱い、起票しない。
`fixChecks` の項目は `{ criterion, headRuns, baseRuns }`。

## 実測の記録との境界

点検・到達・本番の記録をこのファイルへ写しても判定には使われない。
判定に使うのは別ファイルの `preflight.json`・`reach.json`・直下の `production-log.json`。
C の再現回数は `reruns/<id>-<n>/production-log.json` と照合する。
秘密・個人情報・署名付き URL をどの項目にも書かない。
