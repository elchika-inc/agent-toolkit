# Durable State

レビューサイクルの進行状態を `REVIEW_DIR` へ落とし、中断後に同一対象から再開するための構造と規則。`REVIEW_DIR` の作成、state 更新、レビュアー応答の分割、findings の書き込みはすべてオーケストレータが行う。レビュアーにはこのディレクトリへの書き込みもアクセスも要求しない。

## REVIEW_DIR の作成と安全検査

```bash
# このスニペットはオーケストレータが実行する
# worktree ごとの決定的パスを選ぶ
_worktree=$(git rev-parse --show-toplevel)
_wt=$(basename "$_worktree")
REVIEW_DIR="/tmp/review-cycle-${_wt}"

# 新規作成時は他ユーザーから読めない mode にする
if [ ! -e "$REVIEW_DIR" ]; then
  (umask 077 && mkdir "$REVIEW_DIR") || {
    printf 'review-cycle: REVIEW_DIR を作成できません: %s\n' "$REVIEW_DIR" >&2
    return 1 2>/dev/null || exit 1
  }
fi

# 再利用前に symlink・所有者・mode を fail-closed で検証する
_review_dir_ok=$(find "$REVIEW_DIR" -prune -type d -user "$(id -un)" -perm 700 -print 2>/dev/null)
if [ ! -d "$REVIEW_DIR" ] || [ -L "$REVIEW_DIR" ] || [ "$_review_dir_ok" != "$REVIEW_DIR" ]; then
  printf 'review-cycle: 安全でない REVIEW_DIR を拒否します: %s\n' "$REVIEW_DIR" >&2
  return 1 2>/dev/null || exit 1
fi

# cycle ファイルへの書き出し確認後、同じ安全検査を再実行してクリーンアップする
_review_dir_ok=$(find "$REVIEW_DIR" -prune -type d -user "$(id -un)" -perm 700 -print 2>/dev/null)
if [ ! -d "$REVIEW_DIR" ] || [ -L "$REVIEW_DIR" ] || [ "$_review_dir_ok" != "$REVIEW_DIR" ]; then
  printf 'review-cycle: cleanup 前の安全検査に失敗しました: %s\n' "$REVIEW_DIR" >&2
  return 1 2>/dev/null || exit 1
fi
rm -rf "$REVIEW_DIR"
```

main checkout では worktree basename が通常リポジトリ名になり、Orca 等の分離 worktree では worktree ディレクトリ名になる。同一 worktree 内で branch を切り替えた場合の古い状態は、下記の対象 HEAD・対象ファイル比較で退避する。

## 構造

```
$REVIEW_DIR/
  state.md
  fp-registry.md
  round-1/<role>.md
  round-2/<role>.md
```

`state.md` には次を記録する。

- 現ラウンド番号と状態（未完了 / 完了）
- 対象ファイルのリポジトリ相対パス一覧（集合比較できるよう辞書順）
- 対象 HEAD
- cycle ID と phase（`active` / `paused` / `terminal-pending` / `log-appended`）
- worktree の絶対パスと、対象ファイルごとの content fingerprint
- 修正事項ごとの状態（`pending` / `applied`）
- 判断レンズへの差し戻しにした指摘ごとの概要と理由（SKILL.md のステップ 4。継続判定で数えないため、再開しても失わないように残す）
- ラウンドごと・ロールごとの reviewer 試行回数（0 / 1 / 2）、書き込み試行回数（0 / 1 / 2）、結果状態（pending / response-received / findings-persisted / failed）

`paused` は specialist の再試行失敗、findings の書き込み失敗、またはユーザー中断で意図的に保持した状態を指し、cycle ファイルへの書込も cleanup も行わない。これによりクラッシュで `active` のまま残った状態と区別できる。`terminal-pending` / `log-appended` は終了処理の checkpoint であり、前者は cycle ファイルの書込前、後者は `.docs/reviews/cycles/<cycle-id>.md` の完全性を読み返して確認した後を表す。

新しいラウンドでは `$REVIEW_DIR/round-N/` を作成した後、最初の role をディスパッチする前に、同じ `state.md` 更新で round を N に進め、全 role の reviewer 試行回数と書き込み試行回数を0、結果状態を `pending` として初期化する。この checkpoint の書き込みと読み返しに成功するまでは前ラウンドの state を正とし、新ラウンドをディスパッチしない。

## 再開判定

存在する通常ファイルの fingerprint は `present:<git hash-object -- path>`、存在しない削除対象は `absent` と記録する。対象パスの種別を判定できない場合は fail-closed で停止する。開始時に `state.md` の対象 HEAD、対象ファイル集合、worktree の絶対パス、content fingerprint を今回の値と比較する。

| 条件 | 動作 |
|---|---|
| すべて一致 | 再開する。完了済みラウンドをスキップし、未完了ラウンドでは有効な findings ファイルがあるロールを再ディスパッチしない |
| `state.md` はあるがいずれかが不一致 | `mv "$REVIEW_DIR" "${REVIEW_DIR}-abandoned-$(date +%s)"` で退避し、新規開始する |
| `state.md` が無い | 壊れた残骸として同様に退避し、新規開始する |

新規開始時はディレクトリと空の `fp-registry.md` を作り、最初のディスパッチ前に安定した cycle ID と `state.md` を書く。cycle ID は `YYYY-MM-DD-` で始まる安全な単一ファイル名成分とし、詳細な文字集合と path 検証は `references/cycle-log-format.md` を正本とする。ディスパッチ前に reviewer 試行回数を増やし、role の応答ブロック到着時に `response-received`、role 別ファイルへの書き込みと検証後にだけ `findings-persisted` へ更新する。再開時は valid findings がなく reviewer 試行回数が1なら2回目を実行し、2なら結果状態を `failed` へ更新して未完のまま停止する。valid findings があれば `state.md` の状態より実体を優先し、再ディスパッチせず `findings-persisted` へ回復する。

修正は `pending` を先に記録し、修正前 fingerprint と検証可能な期待状態も保存する。再開時は一般の fingerprint 不一致判定より先に `pending` を確認する。現在値が修正前 fingerprint と一致すれば再実行し、期待状態を満たせば `applied` と新 fingerprint を checkpoint する。どちらでもなければ状態を保持したまま fail-closed で停止する。`pending` がない説明不能な fingerprint 不一致だけを abandoned へ退避する。

## レビュアー応答の分割と永続化

レビュアーには role ごとに次の境界を1組だけ返させる。

```text
<<<LENS_FINDINGS role="<role>">>>
<findings 本文>
<<<END_LENS_FINDINGS>>>
```

role は `fresh-eyes`、`security`、`core-logic`、`tests`、`domain`、条件付きで `ambiguity-hunter`、`altitude-checker` のいずれかに限る。オーケストレータは期待する role の集合、重複、開始・終了境界の対応、本文の非空に加え、後述する findings ファイルの有効性（先頭行の結論形式と flag 件数整合を含む）を永続化の前後で検証する。有効なブロックは境界行だけを除き、本文の文字・順序・改行を変えず `$REVIEW_DIR/round-N/<role>.md` へ書く。要約、言い換え、複数 role の結合、optional の削除をしない。

ブロック欠落・重複・未知 role・境界不正・空本文は、その role の findings が返らなかったものとして扱う。有効な role は先に別ファイルへ保存し、失敗した role だけを1回再依頼する。再依頼の応答にも同じ境界と検証を適用する。同一セッション内の再依頼でも有効な応答を得られず reviewer 試行回数が2へ達した場合は、当該 role の結果状態を `failed` へ更新して `paused` で停止する。

role 別ファイルへ書く直前に当該 role の書き込み試行回数を増やし、書き込みと検証が成功した後にだけ結果状態を `findings-persisted` へ更新する。書き込みに失敗したら、同じ未変更ブロックの書き込みだけを1回再試行する。2回目も失敗した場合は結果状態を `failed` へ更新して `paused` で停止し、可能なら `state.md` に失敗 role と書き込み試行回数を記録する。ユーザーへの報告には、失敗 role、保存先、原文が未永続化であること、正確なエラー、書き込み試行回数、保持できた `REVIEW_DIR`、再開時に当該 role を再取得する必要があることを含める。`state.md` 自体へ書けない場合も同じ情報を直接報告し、LGTM 扱いで続行しない。

## findings ファイルの有効性

有効な findings ファイルは、次をすべて満たすものに限る。

- 存在し、読取可能で、空でない
- 結論が `LGTM`、`LGTM／optional: ...`、または1件以上の flag のいずれかとして解釈できる
- 先頭行が `LGTM`、`LGTM／optional: ...`、または `flag N件` のいずれかである
- `flag N件` の場合、N と findings 内の `[ISSUE]` / `[AMBIGUITY]` / `[ALTITUDE]` ブロック数が一致する

条件を満たさないファイルは未作成と同じ失敗として扱い、ロール別の1回だけの再ディスパッチ規則へ送る。
