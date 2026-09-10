# agent-toolkit

## Project Overview

**agent-toolkit** — 2つの配布物を持つモノレポ:

1. **`skills/`** — エージェント横断スキル（skills.sh / vercel-labs/skills CLI 互換）。skills CLI 対応エージェントへ `npx skills add elchika-inc/agent-toolkit -g` で配布される。**スキルの正本はここ**。`~/.agents/skills/` はインストール先であり編集しない。
2. **`plugins/`** — Claude Code Plugin マーケットプレース（`.claude-plugin/marketplace.json` が定義の正本）。

### 4リポジトリ体制での位置づけ

| リポジトリ | 持つもの | 当リポジトリとの関係 |
|---|---|---|
| [standards](https://github.com/elchika-inc/standards) | ルール（原則と MUST） | **ルールの中身を複製しない**。skill は絞り込み・判定・レポート形式だけを持ち、検査項目は standards を読む |
| [templates](https://github.com/elchika-inc/templates) | コピーして使う実体（共通契約・biome.json・legal/ 等） | 直接の依存なし |
| [ui](https://github.com/elchika-inc/ui) | デザインシステム（コンポーネント・トークン） | 直接の依存なし |
| **agent-toolkit**（このリポジトリ） | エージェントの道具（skills / plugins / hooks） | ルールを standards が持ち、それを**実行する道具**をここが持つ |

**ルールと道具は対で動く。** standards から実体を引き取ったら、引き取った側が正本になったことを明記し、移管元のパスを参照し続けない（実例: guardrails 一式を standards から引き取った後も、README と PATTERNS.md が `standards/hooks/guardrails/` を指し続けていた — 2026-08-05 に修正）。

## Tech Stack

- 配布物: Markdown + YAML frontmatter のスキル、JSON のプラグイン定義、シェルの hooks。
- MCP サーバー: TypeScript / Node.js / npm、MCP SDK + Zod、テストは Vitest。Web UI と本番デプロイ環境は持たない。
- standards_version: 2026-09-10 (rev.92)
- branch_policy: protected — `main` は PR 必須で、直 push の bypass は無い（2026-09-10 実測: ruleset `22766205` は active・`bypass_actors` は 0 件・required status check は `Biome / Test`）。
- merge_policy: human — owner 既定（`auto-on-green`）と異なる値を選ぶ理由は、`auto-on-green` が `main` push を起点とする deploy を人間の確認なしに起動させる交換であり、この交換を受け入れるかは CI の有無とは別に判断するため。現時点では全 PR を人間が承認する。

## プロジェクトドキュメント

- [ゴールシート](.docs/PROJECT_GOAL.md): 仕様変更は「判定手順」の3問を通し、`NEW` の能力はゴールシート改訂 PR を先に出す。
- 設計・実装計画は `.docs/plans/` の `-design.md` / `-plan.md` に置く（[DOCS_OPS §3](https://github.com/elchika-inc/standards/blob/main/DOCS_OPS.md#3-docs-構造)）。ツール既定の別の保存先を作らない。
- [リスクレコード](.docs/risk-registry.md): 受け入れた欠陥を記録し、`accepted` には受容者以外の観測を `anchor` として付ける。
- `lens-review-cycle` の Domain レンズは、スキルの配布・正本とコピーの整合、プラグインの version と cache、ゴールシートの C-### / N-### / P-# への適合を見る。

## Key Commands

以下はリポジトリルートから実行する。

- dev: N/A（Web UI・開発サーバーなし。MCP のローカル起動は `npm --prefix plugins/elchika-tools/mcp-server start`）。
- test: `npm --prefix plugins/elchika-tools/mcp-server test`（Vitest。事前に同ディレクトリで `npm ci`）。
- check: `npx --yes @biomejs/biome@2.3.10 check .`（MCP サーバー配下の lint・整形検査。CI でも同じ版を実行）。
- deploy: N/A（本番デプロイ先と deploy コマンドなし。スキル・プラグインの配布は「重要な設計原則」に従う）。

## Architecture

| ディレクトリ・ファイル | 責務 |
|---|---|
| `.github/workflows/ci.yml` | MCP サーバーのテストと Biome 検査 |
| `AGENTS.md` | このリポジトリの継続的な要求事項を置く共通契約の正本（ルール文書） |
| `.claude-plugin/marketplace.json` | マーケットプレース定義。`plugins/` の配布定義の正本 |
| `skills/` | 配布物（ルール文書ではない）。エージェント横断スキルの正本。skills CLI が `skills/<name>/SKILL.md` と `references/` 等を発見する |
| `plugins/` | 配布物（ルール文書ではない）。プラグインの agents / commands / hooks / skills / MCP |
| `plugins/dev-tools/` | `agents/`（site-explorer・verification-documenter）、`commands/`、`hooks/`、`skills/` |
| `plugins/elchika-tools/` | ローカル MCP サーバー（34ツール） |
| `.docs/PROJECT_GOAL.md` | 原則・能力・成功基準・完了条件の正本を置くゴールシート |
| `.docs/risk-registry.md` | リスクの状態・受容理由・anchor と記法の正本を置くリスクレコード |
| `.docs/actions/` | 未完了タスクのアクションキュー |
| `.docs/plans/` | 個別タスクへ閉じた設計・実装計画 |
| `.docs/reviews/` | 時点に依存する観測記録。要求事項に言及するときは正本の文書名と節番号またはリンクを記述ごとに伴わせる（[DOCS_OPS §1](https://github.com/elchika-inc/standards/blob/main/DOCS_OPS.md#1-ドキュメント契約must)） |

### 整合性の維持対象

| 変更箇所 | 同期先 |
|----------|--------|
| skills/ のスキル追加・削除 | README.md のスキル一覧 |
| skills/lens-review-cycle | plugins/dev-tools/skills/lens-review-cycle（同期コピー） |
| skills/product-design-lens | plugins/dev-tools/skills/product-design-lens（同期コピー） |
| marketplace.json の plugins 配列 | README.md のプラグイン一覧 |
| marketplace.json の plugins[].version | plugins/<name>/.claude-plugin/plugin.json の version（同じコミットで同じ値にする。`claude plugin update` はこちらを見る） |
| plugins/<name>/ 配下の内容変更（スキルの同期コピーを含む） | 同じコミットで plugin.json と marketplace.json の version をインクリメント（cache が version キーのため、据え置くと配布先へ届かない） |
| ディレクトリ構造変更 | AGENTS.md の Architecture 表 |
| SKILL.md の「実行モデル」節 | 同じ SKILL.md の frontmatter `model` / `effort` |

## 重要な設計原則（What NOT to Do）

### skills/ 変更時
1. `skills/<name>/` を編集して push
2. 各マシンへ反映する（自動では反映されない）。**既存スキルの更新と新規スキルの追加でコマンドが違う**
   - **既存スキルを変更した** → `npx skills update -g`
   - **スキルを新規追加した** → `npx skills add elchika-inc/agent-toolkit -g`。`update -g` は**インストール済みのスキルしか見ないため、新規スキルは1つも入らない**（2026-08-25 実測。`product-design-lens` 追加時に `update -g` が「✓ Updated 2 skill(s)」と成功表示を出しながら当該スキルを配布しなかった）
3. `lens-review-cycle` または `product-design-lens` を変更したら、それぞれ **`plugins/dev-tools/skills/<name>` へ同期コピー**する（`cp -R skills/<name>/ plugins/dev-tools/skills/<name>/`）。プラグイン側を直接編集しない。**同期コピーしたら `dev-tools` の version も上げる**（「plugins/ 変更時」2 が正本）
4. ルート `README.md` のスキル一覧と整合を取る
5. 反映は**コマンドの成功表示でなく配布先の実体**で確認する（`ls ~/.agents/skills/<name>`）

#### `npx skills add` の既知の挙動（2026-08-25 実測）

- **`elchika-inc/agent-toolkit/<skill-name>` のようなパス指定はできない。** 第3要素は**ブランチ名**として解釈され、`No skills found` で終わる。リポジトリまで（`elchika-inc/agent-toolkit`）を指定する
- **PromptScript 向けに `does not support global skill installation` が全スキル分エラー表示されるが、失敗ではない。** `~/.claude/skills/` と `~/.agents/skills/` へは正常に配置される。エラー表示だけを見て失敗と判断しない

### plugins/ 変更時
1. `plugins/<プラグイン名>/` 配下を編集
2. marketplace.json と plugins/<name>/.claude-plugin/plugin.json のバージョン番号を同じ値にインクリメントする。**追加削除だけでなく、配布物の中身が変わるすべての変更で上げる**（スキル本文の修正・同期コピーを含む）。据え置くと変更が配布先へ届かない（下記「`claude plugin update` の既知の挙動」）
3. ルート `README.md` のプラグイン一覧と整合を取る

#### `claude plugin update` の既知の挙動（2026-08-27 実測）

- **プラグインの実体は version をキーにしたスナップショットである。** `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` へ展開され、**同じ version 番号のディレクトリが既にあると中身を再取得しない**（実測時、`dev-tools/` 配下に 1.6.0〜1.12.0 が併存していた）
- したがって **version を据え置いたまま内容だけ変えると、プラグイン経由の利用者へ永久に届かない。** `claude plugin marketplace update` で marketplace の clone を最新化しても、cache は古いまま残る
- **`claude plugin update <plugin>` の成功表示を反映の根拠にしない。** 書き換えるのはインストール済み version の記録であって cache のファイルではない（2026-08-27 実測。clone を最新版へ更新した状態で `✔ Plugin "dev-tools" updated from 1.11.0 to 1.12.0` と表示され exit 0 だったが、`cache/.../dev-tools/1.12.0/skills/product-design-lens/SKILL.md` は 124行のままで、最新の 130行にならなかった）
- 反映確認は **cache 配下の実ファイル**で行う（`wc -l ~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>/SKILL.md`）

### marketplace.json の name は変更しない
`naoto24kawa-claude-plugins` はローカルの `installed_plugins.json` / `settings.json` にキーとして参照されており、変更すると既存インストールが孤立する。リポジトリ名とは独立。

### スキルの構造規約
- SKILL.md: YAML frontmatter 必須（`name`, `description`）
- description: トリガーワード含有、1024文字以内、三人称形式
- 行数上限: SKILL.md は 500行以下
- 外部参照: 1階層まで（SKILL.md → references/ 等）
- エージェント固有の絶対パスを書かない（`~/.claude/skills/` や `~/.codex/skills/` ではなく `~/.agents/skills/` を参照する）

### Git ワークフロー

- メインブランチ: `main`
- marketplace.json の変更はバージョン番号の更新を伴う
- スキル/エージェント/コマンドは自動検出されるため marketplace.json への個別登録は不要
- エージェントは `main` へ直接コミット・push しない。feature ブランチで変更し、PR を作成して人間のマージ承認を待つ。
