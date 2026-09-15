# standards と templates の相互参照検査

## 目的

standards が指す templates 内パスと、templates が指す standards の節番号の実在を、再実行できる共通スキルで検査する。[Issue #71](https://github.com/elchika-inc/agent-toolkit/issues/71) と templates#26 の継続条件に対応する。

## 現状

standards は書式の正本を templates 内ファイルへ委譲し、templates は standards の節番号を参照している。2026-09-13 の司令塔の測定では、重複除外後の参照は前者が 11 件、後者が 12 件で、いずれも実在していた。

実装の土台は templates の[ゴールシート設計「検証」手順 1・2](https://github.com/elchika-inc/templates/blob/d196b0a/.docs/plans/2026-09-13-goal-sheet-success-criteria-design.md#検証)である。この設計ドキュメントは変更しない。

## 決定

- `standards-templates-drift` を新しいスキルにする。`standards-audit` は 1 プロジェクトを standards と比較する道具であり、この対の検査とは対象が異なる。混在させず、同スキルが検査項目を standards の `AUDIT.md` へ委譲する関係を保つ。
- 実行場所に依存しない Bash スクリプト 1 本にまとめ、両 checkout を `--standards` / `--templates` で受け取る。省略時は `STANDARDS_ROOT` / `TEMPLATES_ROOT`、その次に `~/projects/elchika-inc/standards` / `~/projects/elchika-inc/templates` を用いる。
- standards の `*.md`（`.git` を除く）から `templates/blob/main/<path>` を抽出し、templates 内で `test -e` する。
- templates の `README.md`・`AGENTS.md`・`.docs`・`_base` から、`DOCS_OPS|AI_FIRST|ARCHITECTURE|DESIGN|PROJECT_RULES|PRODUCT_PLAYBOOK` の `§N` 参照を抽出する。`.md` と空白を正規化して重複除外し、standards の該当文書に `^## N\.` の見出しがあるか調べる。
- 両方向が 1 件以上で不在 0 なら exit 0、不在ありは exit 1、checkout 不正・参照 0 件・検索などのエラーは exit 2 とする。判定不能が不在と併存した場合は exit 2 を優先し、得られた不在情報も表示する。
- ファイルを変更せず、方向別の実在・不在と重複除外後の集計、最後に合計を表示する。エラーによる未集計を成功の 0 件にしない。
- Bash と標準的な `grep` / `sed` / `sort` で、既存手順の引数化とエラー判定を実装する。ローカル checkout の検査なのでインフラ機能は不要であり、外部ライブラリや独自の Markdown パーサーも必要ない。

### ゴールシート判定

[PROJECT_GOAL「判定手順」](../PROJECT_GOAL.md#判定手順issue-起票時)に沿って判定した。

1. C-001 の改善（共通スキルの追加）であり、`NEW` ではない。
2. N-001 に当たらない。standards の規定を複製せず、standards と templates の相互参照の実在だけを検査する。
3. P-1 に反しない。検査の道具はこのリポジトリ、参照の正本は両リポジトリの実体に置く。

## 却下した案

- `standards-audit` への項目追加: 1 プロジェクトの準拠検査と、standards 自身と templates の対の検査では対象が異なる。
- standards の `AUDIT.md` に検査を置く: 同文書は各プロジェクトの準拠検査の正本であり、この対の検査の置き場とは異なる。P-1 に沿って道具を agent-toolkit に置く。
- templates の `scripts/check-templates.mjs` に追加: 同スクリプトの「実際に起きた失敗だけを検査する」方針に、まだ起きていない参照切れの先回りを混ぜない。

## 裁定

2026-09-13 にオーナーが「ドリフトはスキルにしたい」と指示した（出自種別: 指示）。templates#26 の整備で「相互参照の実在」がゴールシートの継続条件になり、その確認方法の実体としてこのスキルを作る。実装担当識別子は `codex-worker-71`。

2026-09-15、実 checkout の参照件数が委任時の期待値と異なったため司令塔へ確認し、司令塔も同じ checkout・抽出範囲で再測定した。司令塔の指示により検証の期待値を「両方向とも参照数 1 以上・不在 0」とし、測定日と実測件数は PR 本文に記録する。検査対象や抽出規則は変更しない。

## 既知の限界

- 意味的ドリフトは対象外。雛形の記述と規定本文の差は、`standards_version` の更新時に CHANGELOG の差分を読む経路に委ねる。
- 検査対象の文書名とディレクトリ集合、参照の表記、見出しの書式をスクリプトに固定する。standards に文書が増えた場合などは追随が要る。
- 手元のファイルを検査する。実行者が両 checkout を fetch して HEAD と `origin/main` の差と作業ツリーの変更を報告し、差があれば「checkout が古い」と結果へ併記する。スクリプト自体は fetch や更新をしない。
- スキルの各マシンへの追加・配布確認はマージ後の作業であり、この実装 PR の範囲外。

## 検証

### 成功基準（rubric）

- SKILL.md の実在、指定の name / description、description の 1024 文字以内、500 行以下、エージェント固有のスキルパスが無いことを確認する。
- self-check は正例 exit 0、パス不在・節不在は exit 1 と `不在:` 出力、参照 0 件・checkout 不正は exit 2 を検証する。fixture の参照件数を合否へ焼き込まない。リポジトリルートと skill ディレクトリで同じ結果になることを確認する。
- 実 checkout では両方向とも参照数 1 以上・不在 0、exit 0 を期待する。測定日と方向別の実測件数を PR 本文へ記録する。
- 実 checkout の一時コピーでパス参照 1 件、節番号参照 1 件をそれぞれ存在しない値へ変更し、各 exit 1 と不在の検出を確認する。実 checkout は変更しない。
- README の指定行が `standards-sweep` の直後に 1 件だけあること、設計の「裁定」節、変更範囲、レビュー記録を確認する。
- [AGENTS.md「Key Commands」](../../AGENTS.md#key-commands)の check と test を個別に実行し、各 exit 0 を確認する。self-check と実 checkout の集計、負の検査、各検証コマンドの exit code は PR 本文に残す。

### 実行手順

リポジトリルートで次をそれぞれ実行し、出力と終了コードを確認する。

```bash
bash skills/standards-templates-drift/scripts/self-check.sh
```

```bash
bash skills/standards-templates-drift/scripts/check-refs.sh --standards ~/projects/elchika-inc/standards --templates ~/projects/elchika-inc/templates
```

skill ディレクトリでは `bash scripts/self-check.sh` を実行する。

```bash
npx --yes @biomejs/biome@2.3.10 check .
```

```bash
npm --prefix plugins/elchika-tools/mcp-server ci
```

```bash
npm --prefix plugins/elchika-tools/mcp-server test
```

レビューは [AI_FIRST §3](https://github.com/elchika-inc/standards/blob/main/AI_FIRST.md#3-ai-レビューサイクルmust) と委任仕様に従い、1 名が 7 レンズを順に当て、確信度 80% 以上の flag を対象に最大 3 ラウンドで行う。結果は指定のサイクル記録とレビュー索引へ残し、PR から参照する。
