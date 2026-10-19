# Review Cycle Log Format

サイクルの成果物はレビュードキュメント（standards DOCS_OPS §3「呼び名」）であり、1 サイクル 1 ファイルで書き切り、後から書き換えない。

完了したレビューサイクルの学習を、対象リポジトリの `.docs/reviews/cycles/<cycle-id>.md` へ1サイクル1ファイルで保存する。`cycle-id` は `state.md` の安定 ID を使い、`YYYY-MM-DD-` で始まる安全な単一ファイル名成分に限定する。既存の `.docs/reviews/review-cycle-log.md` は読み取り専用の legacy 履歴として残し、新規追記しない。

## エントリフォーマット

```markdown
<!-- review-cycle:start {cycle-id} -->
## {YYYY-MM-DD} {対象の概要}
- **Cycle ID**: {state.md に保存した安定 ID}
- **対象 HEAD**: {サイクル完了時の git rev-parse HEAD}
- **総ラウンド数**: N
- **終了理由**: 全員 LGTM / 堂々巡り / ラウンド上限超過
- **レンズ別 flag 件数**: Security {n} / Core Logic {n} / Tests {n} / Domain {n} / Fresh Eyes {n} / Ambiguity {n|-} / Altitude {n|-}
- **確定した偽陽性**:
  - `{対象パスの JSON 配列 or N/A}` — {主張の概要} — {理由の要約}
<!-- review-cycle:end {cycle-id} -->
```

偽陽性が0件の場合は `- なし` と記録する。文章仕様を含まず #6 / #7 を起動しなかった場合は、それぞれの件数を `-` とする。

## パスの安全性

`cycle-id` は `^[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Za-z0-9][A-Za-z0-9._-]*$` に一致し、改行・パス区切りを含まないことを、ファイルパスへ展開する前に検証する。書込先の basename が `<cycle-id>.md` と一致し、正規化した親ディレクトリが対象リポジトリ内の `.docs/reviews/cycles/` であることも確認する。不一致は fail-closed で停止する。

書込時は `.docs`、`.docs/reviews`、`.docs/reviews/cycles` の既存 path component が symlink でなくディレクトリであることを確認する。最終ファイルと一時ファイルが既に存在する場合は symlink を拒否し、通常ファイル以外を fail-closed で拒否する。一時ファイルは同じ `cycles/` 内へ排他的かつ symlink を追跡しない方法で作る。

carry-over の読み取りでは、新方式と legacy の両方で `.docs` から読取対象までの既存 path component が symlink でない実ディレクトリであることを確認し、読取対象は symlink でない通常ファイルに限定する。拒否または判定不能な新方式の path・候補は完全ファイルとして数えず、候補が0件なら legacy へフォールバックする。legacy の path・対象も拒否または判定不能なら読み取らず、理由を1行記録して空の FP レジストリで開始する（読み取り側は fail-open）。

## 書込手順

1. `state.md` を `terminal-pending` にし、cycle ID を確定する。
2. `git rev-parse HEAD` で対象 HEAD を取得する。
3. 全ラウンドの findings ファイルを集計し、各レンズの flag 件数を数える。
4. `fp-registry.md` から確定した偽陽性の対象 JSON、主張、理由を省略・再解釈せず転記する。
5. `.docs/reviews/cycles/` を作り、書込先を `.docs/reviews/cycles/<cycle-id>.md` とする。同じ cycle ID の完全な start / end marker を持つファイルが既にあれば一時ファイルを作らず手順8へ進む。対象ファイルに start marker だけがあるなど不完全な場合は fail-closed で停止する。
6. 書込先が無ければ、完全なエントリを同ディレクトリ内の排他的に作成した `.<cycle-id>.tmp-*` へ書いて、start / end marker と cycle ID を検証する。一時ファイルは carry-over の候補になる `.md` と区別する。
7. 書込先が無いことを再確認し、検証済みの一時ファイルを `.docs/reviews/cycles/<cycle-id>.md` へ rename する。再確認時に書込先が存在した場合は手順5と同じ完全性判定を行う。
8. `.docs/reviews/cycles/<cycle-id>.md` から同じ cycle ID の完全なエントリを読み返し、`state.md` を `log-appended` にしてから `$REVIEW_DIR` を削除する。

記録ファイルをコミットするときは、`git add` でこのファイルを stage したあと、コミットの前に `git diff --cached --check` を単独で実行し、出力なし・exit 0 であることを確かめる。末尾の余分な空行（`new blank line at EOF`）や行末の空白が出たら、その空白だけを直して stage し直し、同じ検査を通してからコミットする。コミットの前に空白だけを直すことは記録した結果を変えないので、冒頭の「後から書き換えない」には当たらない（実例: 2 つの委任で、レビュー記録の末尾に空行が 1 つ多く入った。1 回目はコミットのあとの `git diff --check` で見つかり、直すコミットを足した。2 回目はコミットの前のこの検査で見つかり、コミットの前に直せた。どちらの worker も、直すことが「後から書き換えない」に反しないかを ask した）

`terminal-pending` から再開した場合、同じ cycle ID の完全なファイルが既にあれば再書込せず `log-appended` へ進む。これにより rename 成功後・cleanup 前の中断を冪等に再開する。

レンズ別件数は後から有効性を実測する材料に留め、レンズ構成を自動変更する入力には使わない。

## 最新エントリ

carry-over でいう「最新エントリ」は、`.docs/reviews/cycles/` 内でファイル名の cycle ID と一致する完全な start / end marker を持つ通常の `.md` ファイルのうち、ファイル名の辞書順で最大のものを指す。cycle ID が `YYYY-MM-DD-` で始まり、同名がないことを前提とする。symlink と部分ファイルは候補にしない。

`cycles/` が無い、または完全なファイルが1つも無い場合だけ、legacy の `.docs/reviews/review-cycle-log.md` にある完全なエントリのうちファイル末尾に最も近いものへフォールバックする。legacy にも完全なエントリが無い場合は、理由を1行記録して carry-over をスキップし、空の FP レジストリでサイクルを開始する（読み取り側は fail-open）。最新エントリ以外の偽陽性は候補にしない。carry-over の安全条件と FP への変換は `references/fp-registry-format.md` を参照する。
