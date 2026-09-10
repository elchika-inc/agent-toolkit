# agent-toolkit

[![standards](https://img.shields.io/badge/standards-2026--09--10_(rev.92)-blue)](https://github.com/elchika-inc/standards/blob/main/CHANGELOG.md)
[![CI](https://github.com/elchika-inc/agent-toolkit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/elchika-inc/agent-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

エージェント横断のスキル集（[skills.sh](https://www.skills.sh/) 互換）＋ Claude Code プラグインマーケットプレース。
レビュー・検証・設計・運用の道具を共通の正本で保守し、対応するエージェントへ配布する。
standards がルールを持ち、このリポジトリはそれを実行するスキルと、hooks・agents・MCP などのプラグインを提供する。

| 役割 | 対象エージェント | インストール方法 |
|------|----------------|----------------|
| **Skills** (`skills/`) | Claude Code, Codex, Cursor ほか [skills CLI](https://github.com/vercel-labs/skills) 対応エージェント | `npx skills add elchika-inc/agent-toolkit -g` |
| **Plugins** (`plugins/`) | Claude Code 専用（hooks / commands / agents / MCP） | `/plugin marketplace add elchika-inc/agent-toolkit` |

## Getting Started

### 前提条件

- スキルを使うには、Node.js / npm（`npx`）と skills CLI 対応エージェントを用意する。この変更のローカル検証環境は Node.js 24.21.0 / npm 11.19.0。
- プラグインを使うには、プラグイン機能を利用できる Claude Code を用意する。
- MCP サーバーの `package.json` は Node.js `>=18.0.0` を宣言する。ただし開発・テストでは lockfile の Vitest / Vite の要件も満たす必要があるため、Node.js 24 系を使用する。

### インストール

```bash
npx skills add elchika-inc/agent-toolkit -g
```

プラグインの追加コマンドは後述の「Plugins（Claude Code 専用）」を参照する。

### クイックスタート

インストール後、対応エージェントへ「変更したファイルを lens-review-cycle でレビューして」と依頼する。スキルが見つからない場合は `~/.agents/skills/lens-review-cycle/SKILL.md` の実在を確認する。新規スキルの追加には上記の `skills add`、既存スキルの更新には「更新の反映」の `skills update` を使う。

## Skills

`npx skills add elchika-inc/agent-toolkit -g` で全スキルをインストール（`--skill <name>` で個別選択）。

| スキル | 概要 |
|--------|------|
| `lens-review-cycle` | 複数の専門レンズを 1 名のレビュアーに順に当て、指摘ゼロまで反復するレビューサイクル |
| `product-design-lens` | プロダクト構想へ設計レンズを順に当てて判断を訂正する（成果物の欠陥検出は `lens-review-cycle`） |
| `agent-team` | TEAM モードの Role Contract（役割定義）と dev-cycle 連携 |
| `sentinel` | 品質＋セキュリティレビュー（3-vote 偽陽性フィルタ付き） |
| `watch-sentinel` | オープン PR への sentinel レビュー適用 |
| `watch-sprawl` | オープン PR への構造（import graph）分析 |
| `watch-sprawlens-update` | mizchi/sprawlens の上流更新チェック |
| `standards-audit` | elchika-inc/standards 準拠チェック |
| `standards-sweep` | セッション終了前の宙吊り状態の検出（git / 共有状態 / dispatch 済み worker） |
| `documenting-verification` | 動作検証の実行と再現可能な検証資料の作成 |
| `delegation-spec` | worker へ渡す委任仕様の必須7節と検証チェックリスト |
| `dreaming` | ルール文書の棚卸し（肥大化・陳腐化・overfit の剪定） |
| `guarantee-ledger` | 壊してはいけない約束を宣言する保証レコードの文書規約と雛形 checker |
| `guarantee-pin-check` | 保証を意図的に壊して裏付けテストが赤くなることを確認する pin 確認手順 |
| `guarantee-interview` | 出自を持たない振る舞いを人間へ問うて裁定し、保証レコードへ昇格させる手順 |

### 更新の反映

正本はこのリポジトリの `skills/`。各マシンへは skills CLI で配布する。

```bash
# スキルを編集して push したあと、各マシンで
npx skills update -g
```

`~/.agents/skills/` 配下を直接編集しない（`skills update` で上書きされる）。

## Plugins（Claude Code 専用）

```bash
/plugin marketplace add elchika-inc/agent-toolkit
/plugin install dev-tools@naoto24kawa-claude-plugins
/plugin install elchika-tools@naoto24kawa-claude-plugins
```

> マーケットプレース名は既存インストールとの互換性維持のため `naoto24kawa-claude-plugins` のまま。

### dev-tools (v1.14.0)

開発プロセス基盤のオールインワン。

- **site-explorer** — Web アプリの探索的 QA テストと GitHub Issue 自動登録
- **verification-documenter** — 動作検証を実行して手順・結果・エビデンスを再現可能な資料として残すエージェント（証跡の既定保存先は `.docs/reviews/`）
- **guardrails** — エージェントの安全装置。`kill-switch`（STOP ファイルで全ツール緊急停止）/ `path-allowlist`（書込先の制限）/ `rate-fuse`（呼び出し回数の上限）/ `audit-log`（実行の記録）と、hook でなくスキル本体へ組み込むときのパターン集（`hooks/guardrails/`）
  - **既定では配線しない**。ツール実行をブロックする挙動を含むため、使うときに `settings.example.json` を参照して明示的に配線する
- **skills** — `lens-review-cycle` / `product-design-lens`（`skills/` 側が正本、プラグインへは同期コピー）

> v1.6.0 で tmux-manager と agmsg 未読送信フックを撤去した（エージェント間連絡の agmsg → Orca orchestration 移行に伴う。standards rev.63）。

> v1.7.0 で spec（文書生成の9エージェントと専用 references）を撤去した。スキル本体は 2026-06-13 に削除済みで、エージェントは起動経路を失ったまま残置されていた。

### elchika-tools (v1.0.1)

ローカル MCP サーバー。テキスト変換・エンコード/デコード・フォーマット・暗号・生成系の34ユーティリティ。データは外部送信されない。

## Development

リポジトリ未取得の場合は、任意の作業ディレクトリから次の clone と cd を実行する。依存のインストールとコマンドテーブルは、取得したリポジトリのルートで実行する。

```bash
git clone https://github.com/elchika-inc/agent-toolkit.git
cd agent-toolkit
npm --prefix plugins/elchika-tools/mcp-server ci
```

| コマンド | 内容 |
|---------|------|
| dev: N/A | Web UI・開発サーバーなし。MCP のローカル起動は `npm --prefix plugins/elchika-tools/mcp-server start` |
| `npm --prefix plugins/elchika-tools/mcp-server test` | test: Vitest による MCP サーバーのテスト |
| `npx --yes @biomejs/biome@2.3.10 check .` | check: MCP サーバー配下を Biome で検査 |
| deploy: N/A | 本番デプロイ先と deploy コマンドなし。スキル・プラグインは各配布 CLI で更新 |

構成概要:

- `skills/`: エージェント横断スキルの正本。
- `plugins/dev-tools/`: agents / commands / hooks と同期スキル。
- `plugins/elchika-tools/mcp-server/`: TypeScript 製のローカル MCP サーバー。
- `.claude-plugin/marketplace.json`: プラグイン配布定義。
- `.docs/`: ゴールシート、設計・実装計画、アクションキュー、レビュー、リスクレコード。

変更時の同期先・version 更新・配布先の実体確認は [AGENTS.md](AGENTS.md)「重要な設計原則」、完了条件は [ゴールシート](.docs/PROJECT_GOAL.md#donecriteria) を参照する。

## Contributing

Issue・PR の提出と編集・検証の案内は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT License](LICENSE)
