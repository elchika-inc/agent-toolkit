<!-- review-cycle:start 2026-09-15-standards-templates-drift -->
## 2026-09-15 standards と templates の相互参照検査スキル

- **Cycle ID**: 2026-09-15-standards-templates-drift
- **対象 HEAD**: 9b537ac527e96555a1fe8517293133abf00e8ea1（この HEAD 上の未コミット実装 29 ファイルをレビュー）
- **実装担当**: codex-worker-71
- **総ラウンド数**: 1
- **終了理由**: 初回から全 7 レンズの flag 0、Key Commands の check と test も exit 0
- **レンズ別 flag 件数（R1）**: Fresh Eyes 0 / Security 0 / Core Logic 0 / Tests 0 / Domain 0 / Ambiguity Hunter 0 / Altitude Checker 0
- **確定した偽陽性**: なし
- **ACCEPTED_RISKS**: なし
- **INSPECTION_STATUS**: 確信度 80% 以上の flag 0 件、optional 2 件（fixture 共通化、参照先文書自体が不在のケース追加）
- **判断レンズへの差し戻し**: なし
<!-- review-cycle:end 2026-09-15-standards-templates-drift -->

### 対象と根拠

対象は [新スキル](../../../skills/standards-templates-drift/) 以下の 27 ファイル、[README](../../../README.md) の指定追加行、[設計ドキュメント](../../plans/standards-templates-drift-skill-design.md)。判定の正本は [AI_FIRST §3](https://github.com/elchika-inc/standards/blob/main/AI_FIRST.md#3-ai-レビューサイクルmust)、[PROJECT_GOAL「DoneCriteria」](../../PROJECT_GOAL.md#donecriteria)、[AGENTS.md「スキルの構造規約」](../../../AGENTS.md#スキルの構造規約)および Issue #71 の委任仕様。Domain は同 AGENTS.md「プロジェクトドキュメント」に沿って正本・配布と C-001 / N-001 / P-1 を確認した。

### レビューの実施方法と限界

Orca の `worker-start` は `consumer_fenced`（呼出端末が Run の coordinator ではない）で exit 1 となり、レビュアーを起動できなかった。委任仕様 §5 で許可された代替として fresh context の `claude --print --model sonnet --effort high` を使用した。実際の応答モデルは `claude-haiku-4-5-20251001, claude-sonnet-5`、1 ターン、CLI exit 0、応答の `is_error=false` を確認した。

組込みツールを空にし、MCP を空の strict 設定に限定、safe mode と hooks 無効化、セッション永続化無効化を指定した。対象全ファイルを行番号付きで渡し、1 名が Fresh Eyes → Security → Core Logic → Tests → Domain → Ambiguity Hunter → Altitude Checker の順で静的に確認した。レビュアーによる実行検証は行っていない。実行証跡は以下の実装担当の検証による。

7 レンズの境界・先頭行・件数形式を検証し、境界行以外を原文のまま role 別に保存して再読した。レビュー入力の全ファイルの content fingerprint は rebase 後も一致していた。TypeScript の変更がないためグラフは利用していない。

### 実行検証

- self-check: 14 ケースで期待する終了コードと診断が一致し、リポジトリルート・skill ディレクトリの両方で exit 0。
- 実 checkout（2026-09-15）: standards `4bea5e22d15dd522b8412bb4bd7a6dd9c616542b`、templates `d196b0a42d760bc114e48f9357f03ff3efe7434e`。fetch 後、両方とも HEAD と origin/main が一致し、作業ツリーはクリーン。方向 1 は参照 11・不在 0、方向 2 は参照 14・不在 0、合計 25・不在 0、exit 0。
- 委任当初の方向 2 の期待 12 件との差は司令塔へ ask し、司令塔の同範囲の再測定と 14 件採用の回答を確認した。期待値を固定件数にしない裁定は [設計「裁定」](../../plans/standards-templates-drift-skill-design.md#裁定)へ記録した。
- 実 checkout の一時コピーでパス参照 1 件を不存在パスへ置換: exit 1・不在 1 件。別の一時コピーで `DOCS_OPS §5` を `DOCS_OPS §999999` へ置換: exit 1・不在 1 件。実 checkout のファイル内容ハッシュは両方とも前後不変。
- 補足検証: 空白付きパス、`.git` 除外、Markdown 限定、重複除外を確認。`grep` / `sed` / `sort` の故障注入は各 exit 2。
- SKILL.md: 89 行、description 154 文字、全 6 トリガーを含有、validator exit 0。README は指定位置への 1 行追加だけ。
- `npx --yes @biomejs/biome@2.3.10 check .`: exit 0、12 ファイル検査、変更対象外の `plugins/elchika-tools/mcp-server/src/utils/format.ts` に warning 4 件。
- `npm --prefix plugins/elchika-tools/mcp-server ci`: exit 0、143 パッケージ追加。依存監査 12 件と install scripts の警告は表示されたが、依存関係は変更していない。
- `npm --prefix plugins/elchika-tools/mcp-server test`: exit 0、1 ファイル・34 テスト成功。

### optional の扱い

2 件を記録し、今回の追加仕様には含めない。fixture の繰り返しは指定された 4 対を明瞭に保ち、参照先文書不在は実装上の誤りが指摘されていないため、追加変更は行わない。これらはレビュアーが初めから optional と報告したもので、flag の格下げではない。

### レンズ別所見（原文）

#### fresh-eyes

LGTM／optional: 設計上の事実（exit code優先順位・抽出正規表現・§正規化ルール・ファイル構造前提）は check-refs.sh / self-check.sh / fixtures の実装と付き合わせて独立検証し、いずれも整合していた。optionalとして、fixtures/{positive,missing-path,missing-section,empty} の4ディレクトリがほぼ同一構造（DOCS_OPS.md・README.md・AGENTS.md・.docs/guide.md・_base/agents.md.template）を差分1箇所だけ変えて反復しており、共通部分をテンプレート化する余地はあるが、YAGNI違反や過剰な抽象化ではないため flag にはしない。

#### security

LGTM
$standards_root / $templates_root / $document_file / $path は全箇所で引用符付きで使用されており、grep へ渡す §番号は `[0-9]+` にしか一致しないため展開・注入の余地がない。direction 1 のパス文字クラス `[A-Za-z0-9_./-]+` は理論上 `../` を含み得るが、用途が `test -e`（存在確認のみ、内容非公開）でローカルの信頼された2 checkout を対象とするため、実害のあるセキュリティ脆弱性とは評価しない。

#### core-logic

LGTM
extract_refs の grep exit 1（非一致）と exit 2 以上（エラー）の区別、§正規化（`.md` 除去→空白正規化）が4種の表記揺れ全てで単一形へ収束すること、indeterminate が missing より exit 判定で優先されること（143行目手前のロジック順）を実装から追跡し、いずれも設計通りだった。重複除外（sort -u）は正規化後に行われており、複数ファイルが同一節を指す実運用ケース（例: 11/12件のような集約）とも整合する。

#### tests

LGTM／optional: self-check.sh は exit 0/1/2 の全分岐・優先順位・引数解析・env var 優先順位を広くカバーしている。optionalとして、direction 2 の「参照先の文書ファイル自体が存在しない」分岐（check-refs.sh:114-117）は、現行の missing-section fixture が「文書は存在するが見出し番号が違う」ケースのみを検証しており、この分岐を明示的に踏むケースがない。コードを読む限り正しく実装されているためflagにはしないが、次回fixture追加時の候補として記録に値する。

#### domain

LGTM
skills/standards-templates-drift が正本でありplugins/への同期対象外である点はAGENTS.mdの「整合性の維持対象」表（lens-review-cycle・product-design-lensのみ対象）と一致し、README.mdの追記もstandards-sweep直後の1行のみでscope通り。PROJECT_GOALの判定手順（C-001改善／N-001非該当／P-1非抵触）は設計doc「決定」節のゴールシート判定と一致し、独立検証しても妥当。SKILL.mdはname/description/三人称・トリガー語・1024字以内・500行以内・エージェント固有パス無し・self-check先行・fetchと鮮度報告・三値判定・報告専用・STATUS.md更新手順への言及を全て満たす。design docも目的/現状/決定/却下した案/裁定/既知の限界/検証の7節を規定順で備える。

#### ambiguity-hunter

LGTM
SKILL.mdのfetchリトライは「1回だけ再試行」と数値で明文化され、exit code優先順位（判定不能＞不在）も本文と実装で一致。design doc「現状」節の11/12件という数値は2026-09-13時点の測定と明記された歴史的記述であり、「裁定」節で後日の再測定により閾値を固定件数でなく「1件以上・不在0」に一般化した経緯も明文化されているため、値のドリフトには当たらない。宙吊り参照・重複定義・収束条件欠落・anti-gaming穴は見当たらない。

#### altitude-checker

LGTM
SKILL.mdは抽出regexや正規化の機微詳細をscripts/check-refs.shへ委譲し（「詳細は同梱の...にある」）、本文には判定表・手順・報告フォーマットという原則レベルの情報のみを残しており、right altitudeを保っている。design docの「決定」節も要件に対応する範囲のみを規定しscope excessは見当たらない。
