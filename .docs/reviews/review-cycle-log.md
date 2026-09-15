<!-- review-cycle:start task_498b3b724b06-ctx_f2cfb8c7aac4 -->
## 2026-08-17 parallel-review-cycle durable state 化
- **Cycle ID**: task_498b3b724b06-ctx_f2cfb8c7aac4
- **対象 HEAD**: 081bd3a256a28eb31d3a7020b359569d5da93250
- **総ラウンド数**: 3
- **終了理由**: ラウンド上限超過
- **レンズ別 flag 件数**: Security 8 / Core Logic 4 / Tests 4 / Domain 10 / Fresh Eyes 2 / Ambiguity 11 / Altitude 0
- **確定した偽陽性**:
  - なし
<!-- review-cycle:end task_498b3b724b06-ctx_f2cfb8c7aac4 -->

<!-- review-cycle:start task_1111ebc23234-ctx_158d064a3b65 -->
## 2026-08-17 guarantee-interview スキル新設
- **Cycle ID**: task_1111ebc23234-ctx_158d064a3b65
- **対象 HEAD**: a3b4507（基点 402f0b8）
- **総ラウンド数**: 3
- **終了理由**: 委任仕様が定めた上限3ラウンドに到達（R3 の flag は修正済み・検証ラウンドは未実施）
- **レンズ別 flag 件数**（R1 / R2 / R3）: Security 4/4/3 ・ Core Logic 4/3/2 ・ Tests 5/3/2 ・ Domain 1/1/1 ・ Fresh Eyes 4/2/2 ・ Ambiguity 4/3/3 ・ Altitude 5/1/1
- **確定した偽陽性**:
  - なし
- **特記**: 2件の指摘が設計文書側の欠陥に由来したため ask で司令塔へ差し戻した。1件は委任仕様の陳腐化（行数）、1件は設計文書 §5 の門の条件1が `partial` を排除する内部矛盾で、司令塔が設計文書 §5・§6 を改訂した。
- **複数レンズが独立収束した指摘**: 追認以外の裁定を裁定文書へ残す義務の欠落（R1・4レンズ）／裏付けテスト不在時の行き先（R1・3レンズ）／`<面>` の導出元が入口 B で存在しない（R3・3レンズ）
<!-- review-cycle:end task_1111ebc23234-ctx_158d064a3b65 -->

<!-- review-cycle:start task_8c06784a5283-ctx_ef6dfd530166 -->
## 2026-08-25 product-design-lens スキル新設
- **Cycle ID**: task_8c06784a5283-ctx_ef6dfd530166
- **対象 HEAD**: b0a9f4f6c389c5bdb08ee61d7a6937587b232288（基点 160e3b0f30fb31cc790d71658c4887034ed2d4a3）
- **総ラウンド数**: 2
- **終了理由**: R1のflag 5件を修正後、R2で全レンズflag 0のクリーンラウンドを通過
- **レンズ別 flag 件数**（R1 / R2）: Fresh Eyes 1/0 ・ Security 1/0 ・ Core Logic 1/0 ・ Tests 1/0 ・ Domain 0/0 ・ Ambiguity Hunter 1/0 ・ Altitude Checker 0/0
- **確定した偽陽性**:
  - なし
- **受容したflag**:
  - なし
- **optional**: Domain 1件（R1・R2で継続）。marketplace.jsonのdev-tools説明文へproduct-design-lensを列挙する案は、明示要件・整合性契約の対象外で機能上の破綻も無いため変更しない。
<!-- review-cycle:end task_8c06784a5283-ctx_ef6dfd530166 -->

<!-- review-cycle:start 2026-09-15-standards-templates-drift -->
## 2026-09-15 standards と templates の相互参照検査スキル
- **Cycle ID**: 2026-09-15-standards-templates-drift
- **対象 HEAD**: 9b537ac527e96555a1fe8517293133abf00e8ea1（未コミット実装 29 ファイル）
- **総ラウンド数**: 1
- **終了理由**: 初回から全 7 レンズの flag 0、Key Commands の check / test は各 exit 0
- **レンズ別 flag 件数**: Fresh Eyes 0 / Security 0 / Core Logic 0 / Tests 0 / Domain 0 / Ambiguity Hunter 0 / Altitude Checker 0
- **確定した偽陽性**: なし
- **optional**: 2 件（fixture 共通化、参照先文書不在ケース）。詳細と原文は [サイクル記録](cycles/2026-09-15-standards-templates-drift.md) を参照。
- **実施方法**: Orca 起動が consumer_fenced で失敗したため、委任仕様 §5 に従い tools / MCP / hooks 無効の fresh context レビュアー 1 名を使用。
- **記録根拠**: [設計「検証」](../plans/standards-templates-drift-skill-design.md#検証)と委任仕様 §2.7 に従い、本索引にも追加した。
<!-- review-cycle:end 2026-09-15-standards-templates-drift -->
