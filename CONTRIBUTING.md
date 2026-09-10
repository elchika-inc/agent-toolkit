# Contributing

## Issue と PR

不具合や改善案は [Issue](https://github.com/elchika-inc/agent-toolkit/issues/new) へ、再現手順・期待する挙動・実際の挙動を添えて報告してください。脆弱性の報告は [SECURITY.md](SECURITY.md) の非公開窓口を使ってください。

変更は作業ブランチから `main` 向けの PR として提出し、変更理由・検証結果・関連 Issue があればそのリンクを記載してください。ブランチとマージの規約は [AGENTS.md「Git ワークフロー」](AGENTS.md#git-ワークフロー)、変更の範囲と完了条件は [ゴールシート](.docs/PROJECT_GOAL.md) を参照してください。

## 編集する場所と配布先

| 対象 | 配布先 | 編集手順の正本 |
|---|---|---|
| `skills/` | skills CLI に対応する Claude Code・Codex・Cursor など | [AGENTS.md「skills/ 変更時」](AGENTS.md#skills-変更時) |
| `plugins/` | Claude Code のプラグイン利用者 | [AGENTS.md「plugins/ 変更時」](AGENTS.md#plugins-変更時) |

同期コピーの扱いと version 更新の要否は、対象ごとに上記の手順を確認してください。配布後はコマンドの成功表示だけで判断せず、[AGENTS.md「重要な設計原則」](AGENTS.md#重要な設計原則what-not-to-do) に従って配布先の実ファイルで反映を確認してください。

## 開発と検証

Node.js と npm の前提・セットアップは [README「Development」](README.md#development) と [前提条件](README.md#前提条件) を参照してください。テストと Biome の実行コマンドの正本は [AGENTS.md「Key Commands」](AGENTS.md#key-commands) です。
