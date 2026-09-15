---
name: standards-templates-drift
description: 'standards と templates のドリフト、相互参照チェック、templates drift、standards-templates-drift、パス参照の実在、節番号の実在を確認したい依頼で使用される。両 checkout の相互参照が指すパスと節番号を照合し、不在と判定不能を報告するスキル。'
---

# standards と templates の相互参照チェック

## 目的

次の 2 方向の参照の実在を検査し、方向別の参照数・不在数と不在の一覧を報告する。

1. standards の Markdown が `templates/blob/main/<path>` で指す、templates 内のパス。
2. templates の `README.md`・`AGENTS.md`・`.docs`・`_base` が `<文書名>(.md)? ?§N` で指す、standards の節番号。

検査対象の文書名は `DOCS_OPS`・`AI_FIRST`・`ARCHITECTURE`・`DESIGN`・`PROJECT_RULES`・`PRODUCT_PLAYBOOK`、見出しは `## N.` の書式とする。詳細は同梱の [scripts/check-refs.sh](scripts/check-refs.sh) にある。

意味的ドリフト（雛形の記述と規定本文のずれ）は対象外。`standards_version` を上げる際に standards の CHANGELOG の差分を読む経路へ委ねる。この検査で規定本文との整合まで確認したとは報告しない。

## 前提

Bash、`git`、`grep`、`sed`、`sort` と、standards / templates の両 checkout が必要。検査は手元のファイルを読み、修正・checkout の更新・マージはしない。

引数の指定が環境変数より優先され、両方省略した場合は以下の既定パスを使う。相対パスはコマンドを実行するディレクトリから解決される。

| 引数 | 環境変数 | 既定パス |
|---|---|---|
| `--standards` | `STANDARDS_ROOT` | `~/projects/elchika-inc/standards` |
| `--templates` | `TEMPLATES_ROOT` | `~/projects/elchika-inc/templates` |

使用するパスを決め、両 checkout で `git fetch origin` を実行する。続いて HEAD と `origin/main` の SHA、差分の有無、作業ツリーの変更を確認する。以下は既定パスの例であり、別のパスを使う場合は同じ対象へ置き換える。

```bash
git -C ~/projects/elchika-inc/standards fetch origin
git -C ~/projects/elchika-inc/standards rev-parse HEAD origin/main
git -C ~/projects/elchika-inc/standards rev-list --left-right --count HEAD...origin/main
git -C ~/projects/elchika-inc/standards status --short
git -C ~/projects/elchika-inc/templates fetch origin
git -C ~/projects/elchika-inc/templates rev-parse HEAD origin/main
git -C ~/projects/elchika-inc/templates rev-list --left-right --count HEAD...origin/main
git -C ~/projects/elchika-inc/templates status --short
```

各コマンドを個別に実行して出力と終了コードを確認する。HEAD と `origin/main` に差があれば、結果に「checkout が古い」と併記し、先行・遅延の件数も残す。作業ツリーに変更がある場合も明記する。自動で pull / reset しない。fetch の一過性エラーは 1 回だけ再試行し、失敗が続く、または差分を確認できない場合は「判定不能」として理由を報告する。

## 手順

以下のスクリプトはこの skill ディレクトリから実行する。別の場所からはスクリプトの実際のパスを指定する。引数の説明は `bash scripts/check-refs.sh --help` で確認できる。

### 1. self-check を先に通す

```bash
bash scripts/self-check.sh
```

exit 0 と `self-check: PASS` を確認する。正例の成功、壊れたパス・節の検出、空走ガードを fixture で検証する。未実行・失敗・出力欠落なら「判定不能」とし、準拠判定へ進まない。原因と実行出力を報告する。

### 2. 両 checkout を検査する

```bash
bash scripts/check-refs.sh --standards ~/projects/elchika-inc/standards --templates ~/projects/elchika-inc/templates
```

出力と終了コードを保存する。コマンドを pipe で加工せず、各方向の `実在:` / `不在:` と `参照数=N 不在数=M（重複除外）`、最後の合計を確認する。件数は固定値と比較せず、その checkout での実測値として扱う。

| 終了コード | 判定 | 条件 |
|---|---|---|
| 0 | 準拠 | self-check 通過済みで、両方向に 1 件以上の参照があり、不在がない |
| 1 | 違反 | 不在のパスまたは節がある |
| 2 | 判定不能 | checkout 不正、いずれかの方向の参照 0 件、抽出・検索等のエラー |

中断・想定外の終了コード・必要な出力の欠落も判定不能とする。判定不能と不在が併存した場合は判定不能を優先し、得られた不在情報は併記する。未完了の集計や self-check 未通過の不在 0 件を準拠と報告しない。参照の追加・移動・節の修正は行わない。

### 3. レポートする

```text
判定: 準拠 / 違反 / 判定不能
対象: standards と templates の checkout パス・HEAD・origin/main
鮮度: fetch の成否、先行/遅延、作業ツリーの変更（差があれば「checkout が古い」）
self-check: 終了コードと PASS の確認結果
方向 1（standards → templates）: 参照数、 不在数（重複除外）
  不在のパス一覧 / なし / 未集計（理由）
方向 2（templates → standards）: 参照数、 不在数（重複除外）
  不在の文書・節番号一覧 / なし / 未集計（理由）
合計: 参照数、不在数（未完了なら明記）
check-refs: 終了コード
判定不能の理由: 該当時にコマンドとエラーを記載
```

結果の記録先は templates の `.docs/STATUS.md`「達成状況」にある相互参照の該当行。レポートを渡し、記録更新が依頼された作業で確認日・測定した件数・判定をその行へ反映するよう案内する。このスキルは STATUS.md を含めファイルを変更しない。数値は実行時に測定し、スキルへ固定しない。
