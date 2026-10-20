<!-- review-cycle:start 2026-10-20-fp-spec-harm -->
## 2026-10-20 仕様どおりに動くと害が出る指摘の偽陽性化を防ぐ

- **Cycle ID**: 2026-10-20-fp-spec-harm
- **対象 HEAD**: 0e1eb0ef1e6a8e77806d771dc9e1b85ee5bd260b
- **総ラウンド数**: 3
- **終了理由**: ラウンド上限（3）到達。累計 flag 4 件を司令塔の確定文言で修正した。最後の操作 G は再レビューせず、司令塔が未再レビューのリスクを受容した。クリーンラウンド通過ではない。
- **レンズ別 flag 件数（累計）**: Security 0 / Core Logic 2 / Tests 0 / Domain 0 / Fresh Eyes 0 / Ambiguity 2 / Altitude 0
- **確定した偽陽性**:
  - なし
- **判断レンズへの差し戻し**:
  - なし
- **ACCEPTED_RISKS**: 第 3 ラウンド（上限）の flag を直した最後の修正（操作 G、1 つ目の箇条書きの置き換え）は、再レビューしていない。司令塔が文言を決め、R4 の blob と R4d で反映を確かめた。

### 要求事項と終了判断

手順・報告規定の正本は [lens-review-cycle](../../../skills/lens-review-cycle/SKILL.md)、[specialist-roles](../../../skills/lens-review-cycle/references/specialist-roles.md)、[scope フィルタ](../../../skills/lens-review-cycle/references/agent-output-principles.md)、[サイクル記録形式](../../../skills/lens-review-cycle/references/cycle-log-format.md)。Domain は [AGENTS.md の整合性の維持対象と重要な設計原則](../../../AGENTS.md)、[PROJECT_GOAL の C-001/C-002・N-001〜N-003・P-1〜P-3](../../PROJECT_GOAL.md) を参照した。

委任仕様（Task ID `task_126d5f75a072`、Dispatch ID `ctx_506bfee1fe00`）は literal 変更と blob を固定し、flag は原文を添えて司令塔へ ask する手順だった。司令塔は各 flag を修正対象と裁定し、操作 E・F・G の確定ファイルと blob を指定した。ラウンド上限を 1 → 2 → 3 と変更し、第 3 ラウンド後は操作 G を反映して再レビューせず終了することを明示した。flag の格下げ・偽陽性化は行っていない。

### 実行方法と入力境界

fresh context の Claude CLI を sonnet / high・ツールなし・read-only で各ラウンド 1 回起動した。全 7 role のブロック境界・件数・先頭行を検証し、境界行だけを除いた本文を変更せず role 別ファイルへ保存した。各ラウンドの CLI は exit 0、JSON は `subtype: success`・`is_error: false`・`num_turns: 1`。タイムアウト再試行はなかった。

```bash
perl -e 'alarm shift @ARGV; exec @ARGV' 900 claude --print --model sonnet --effort high --tools '' --strict-mcp-config --safe-mode --no-session-persistence --permission-mode dontAsk --output-format json
```

入力は stdin、JSON 応答は stdout リダイレクトで worktree 固有の REVIEW_DIR に保存した。差分、指定文書の行番号付き全文、AGENTS.md の指定節、背景、共通報告規定と scope フィルタ、7 role のフォーカスを渡した。第 2・3 ラウンドの修正済み事項は末尾へ置き、Fresh Eyes の findings 完成後に参照するよう指示した。

- carry-over: 最新の完全ログ `2026-10-19-layout-geometry-check.md` が同じ行に「なし」と記載していたので、候補 0 件として空の FP レジストリで開始した（司令塔も確認済み）。
- 入力調整: 第 2・3 ラウンドは specialist-roles.md の重複するプロンプトテンプレート、例示、カスタム agent・カスタマイズガイドを除き、冒頭報告規定とフォーカスを保持した。最終入力は第 2 ラウンド 144,196 bytes、第 3 ラウンド 148,265 bytes（司令塔承認済み）。
- 第 1 ラウンドの入力は 98,463 bytes。全入力は wc -c で測定し 150,000 bytes 以下を確認した。
- 初回の carry-over 準備は同一行の「なし」を解釈しない補助処理で exit 1、第 2 ラウンドの初回入力準備は 151,385 bytes で上限検査が exit 1。どちらもレビュー CLI 起動前に停止し、司令塔の承認後にリポジトリ外の準備処理だけを直した。

### ラウンド別結果

セルは flag / optional の件数。optional は独立した懸念・改善提案を数え、正常性の説明と他レンズ flag への単なる参照は数えない。レンズ間・ラウンド間の重複は除かず、原文をすべて後掲する。

| ラウンド | Fresh Eyes | Security | Core Logic | Tests | Domain | Ambiguity Hunter | Altitude Checker |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0 / 3 | 0 / 2 | 1 / 0 | 0 / 0 | 0 / 1 | 1 / 0 | 0 / 2 |
| 2 | 0 / 1 | 0 / 0 | 1 / 0 | 0 / 1 | 0 / 1 | 0 / 3 | 0 / 2 |
| 3 | 0 / 3 | 0 / 1 | 0 / 1 | 0 / 0 | 0 / 2 | 1 / 2 | 0 / 1 |

optional は延べ 26 件。optional だけを理由に変更範囲を広げてはいない。flag 修正と重なる箇所は司令塔が指定した確定文言の変更に含まれる。

| ラウンド | レビュー対象 HEAD | flag の要約 | 司令塔の裁定と反映 |
|---|---|---|---|
| 1 | d98b7914761cc9bd278149f32b4fac945f22ce33 | Core Logic: 環境依存 FP がファイル無変更だけで carry-over される。Ambiguity: 差し戻しの継続判定・記録・前提崩れの表現が未接続。 | 操作 E。対象 N/A、差し戻しの計数・state/cycle log 記録・定型文を追加。736cd47b7d9352cd36848924b66dbd6387849b50。 |
| 2 | 736cd47b7d9352cd36848924b66dbd6387849b50 | Core Logic: 修正済み事項を後読みする Fresh Eyes が差し戻しを再検出し、照合経路がない。 | 操作 F。レビュアーへ渡さず、ステップ 3 で差し戻し済みを照合し、再評価・修正・継続判定・堂々巡り判定から除外。cfbba071571ec87c1902e8b46087ab13b08d0f2c。 |
| 3 | cfbba071571ec87c1902e8b46087ab13b08d0f2c | Ambiguity: 前提が成立したと言える実測の環境・範囲・時点が未定義。 | 操作 G。仕様・コードによる保証か、害が出る側の環境での実測に限定し、レビュー側 checkout だけでは測れないとして差し戻す。0e1eb0ef1e6a8e77806d771dc9e1b85ee5bd260b。未再レビューを ACCEPTED_RISKS に記録。 |

第 3 ラウンドの「2026-08-09 のレビュー時点で、該当 path はクリーンだった」は入力に無い断定で、司令塔も確かめていない。

第 3 ラウンドの Ambiguity Hunter の optional 2 件（書き出し項目の列挙・完了レポートに差し戻しの所在がないこと、ambiguity-hunter.md から SKILL.md への参照がないこと）は修正せず、下の原文に記録した。

### 検証の範囲と rubric

委任仕様の最終 rubric は、正本と同期コピーを含む変更 11 ファイルの指定 blob 一致、R1=0（exit 1）・R2=3・R3=1・R4b=3・R4c=1・R4d=1、同期 tree 一致、指定 11 ファイルと本記録 1 ファイルだけの差分、空白検査、Biome と MCP テスト、PR 直前の競合確認、required CI の成功である。これらは文面の反映・配布物の整合・既存 MCP の実行結果を測る。LLM の将来の判断品質や配布先の反映は、この検査では証明しない。

操作 G 後の段 A では、11 blob が指定値と一致し、R4d は 1 / exit 0。未コミット差分は SKILL.md の 2 ファイルだけで各 1 追加 / 1 削除、空白検査は出力なし / exit 0。Biome は exit 0、Checked 12 files / Found 4 warnings（変更前と同じ）。npm ci は exit 0、MCP テストは exit 0、1 ファイル / 34 テスト成功。最後のコミット後の段 D と PR の段 E・F の実測値は PR 本文へ記録する。

### レビュー原文

#### Round 1

```text
<<<LENS_FINDINGS role="fresh-eyes">>>
LGTM／optional:
- skills/lens-review-cycle/SKILL.md:177 は 1 段落に判定分岐が 5 つある。箇条書きか短文への分割にすると読み違えにくい。
- 同:177 は「1 つ目の基準で偽陽性にしない」と書く一方、後半で「偽陽性にする」と書く。後者の根拠は 3 基準のどれにも当たらず、実質 4 つ目の基準になっている。誤運用には至らないと見て optional とする。
- 「設計通り」（references/fp-registry-format.md:71）と「仕様どおり」（SKILL.md:177）が混在している。
- 設計上の事実「既存の受け皿を再利用する」は方針として妥当。ただし受け皿が継続判定につながっていない点は、Ambiguity Hunter で flag にした。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="security">>>
LGTM／optional:
- SKILL.md:177 の「実測」は、読み取り専用に限るという制約がない。orchestrator は Bash を持つので、前提確認のつもりで対象スクリプトを実行し、破壊的操作に及ぶ余地がある。確信度は 60% 程度。「実測は読み取り専用の確認に限る」の一句を足すとよい。
- 「実測の結果」を FP の理由に書かせる指示は、FP が cycle log（コミット対象）へ出る経路に乗る。コミットできない設定ファイルなどの中身が転記されると漏えいにつながる。結果は有無や件数の要約で書くよう添えるとよい。確信度は 50% 程度。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="core-logic">>>
flag 1件
[ISSUE] skills/lens-review-cycle/SKILL.md:177 と skills/lens-review-cycle/references/fp-registry-format.md:10,105-111
確信度: 80%
問題: SKILL.md:177 は、前提を実測して成り立つと確かめられたら、前提と結果を FP の理由に書いて偽陽性にせよと定める。この前提（特定の発生元の変更しか入らない、など）は、利用者の環境や状態で時間とともに変わる値である。一方、carry-over の可否（fp-registry-format.md:111）は、`対象` のリポジトリ相対パスが前回 HEAD から未変更かだけで決まる。環境状態に依存する FP を `対象: N/A` にせよという指示は、新規定にも `対象` の定義（:10）にもない。
失敗の示し方: サイクル A で「その path には自動生成の変更しか入らない」を実測し、FP-001（`対象: ["scripts/pull.sh"]`）として記録する。後日、`pull.sh` は無変更のまま、利用者がその path に未コミット設定を置く。サイクル B の carry-over は path 未変更として FP-001 を引き継ぐ。同じ害の指摘は Step 3 の FP 照合で即棄却され、実測は再実行されない。元事故（2026-08-09 に FP 化し、10-19 に発覚）と同じ経路が、carry-over で再現する。
修正案:
- fp-registry-format.md の `対象` 定義（:10）か carry-over 節（:105 付近）に、「理由が実測した環境・実行時状態に依存する FP は `対象: N/A` とし、引き継がない」と追記する。
- SKILL.md:177 の末尾に、「この FP は実測したサイクル内でのみ有効。次サイクルへ引き継がず再実測する」と足す。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="tests">>>
LGTM／optional:
- 変更は文章だけで、実行コードはない。R1〜R3 の文言確認と固定 blob 比較で、文面の一致は確認できている。LLM の運用判断の品質は証明されない点は、下書きに明記済み。
- 下書きは「時刻/地域」を対象外としている。ただし変更した判定規則には時間軸がある。実測した前提が後日崩れる点である。この類型は対象外ではなく、Core Logic の flag（carry-over）で扱った。テストの追加を求めるものではない。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="domain">>>
LGTM／optional:
- 同期とバージョンは整合している。
  - skills/ と plugins/dev-tools/skills/ の SKILL.md と fp-registry-format.md は、blob が一致している（d23f0ca→46ec737、e3bf899→543b8d0）。
  - plugin.json、marketplace.json の plugins[].version、README はすべて 1.22.0。version を上げたので、cache の version キーにも新規ディレクトリとして届く。
  - C-001 / C-002 に沿っており、N-001〜N-003 と P-1〜P-3 に反しない。SKILL.md は 276 行（500 行以下）で、参照は 1 階層に収まる。
- DoneCriteria の「配布先の実体で反映確認」は、マージ後に司令塔が行う予定で、現時点では未実施。flag ではない。
- AGENTS.md の Git ワークフローには「marketplace.json の変更はバージョン番号の更新を伴う」とある。トップレベルの `version`（7.5.1）が据え置きなのが過去の慣行どおりか、この資料だけでは確認できない。確信度は 40% 程度で、plugins[].version のことだと読めば問題ない。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="ambiguity-hunter">>>
flag 1件
[AMBIGUITY] skills/lens-review-cycle/SKILL.md:177 / パターン#4 / 確信度85%
問題: 差し戻しの場合は「修正も偽陽性化もせず」完了レポートへ持ち越すとある。しかし、その flag を継続判定（:186-189）でどう数えるかが決まっていない。2 通りに読める。
- (a) flag が残る扱い: 次ラウンドのレビュアーが同じ指摘を再度出す。FP レジストリには無く、修正もしていないので、堂々巡り条件の「修正後も」にも当たらない。R3 の上限まで空回りし、:183 の「積み残さない」とも衝突する。
- (b) 解消扱い: 根拠が書かれていないまま、全レンズ LGTM で Step 6 へ進む。

加えて 3 点が未規定である。
- 「持ち越し」の記録先が完了レポート（チャット）だけに見える。cycle log の記録項目（:198）に差し戻しは無い。cycle-log-format.md は未提供で、未確認。optional に課されるディスク記録の義務も、差し戻しにはない。
- 「成り立たない」（実測で害を確認済み）と「測れない」（未検証）を同じ扱いにしている。:244 の定型文「判断の未検証が残っている」は、前者には当たらない。
- 借用元の `ambiguity-hunter.md` の逆流は、レビュアーが差し戻しを flag として報告する前提である。ここでは orchestrator が判断する。継続判定への接続は、元の文書にも新規定にもない。

明文化案: SKILL.md:177 の末尾に次を足す。
「差し戻した指摘は、継続判定の flag 件数から除き、次ラウンドの『修正済み事項』とは別の『差し戻し済み』として渡す（再報告させない）。`state.md` と `.docs/reviews/cycles/<cycle-id>.md` に、指摘・前提・実測結果（または測れなかった理由）を記録する。実測で前提が崩れたものは『前提崩れ（害を確認済み）』、測れなかったものは『前提未検証』と区別して完了レポートに載せる。」
併せて、完了レポートの定型文（:244）を 2 区分に対応させる。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="altitude-checker">>>
LGTM／optional:
- 今回の追記は、単一事象（agent-env の 1 件）を根拠にしている（パターン#3）。ただし、恒常ルールとして書かれた内容は事象固有の詳細ではなく、一般原則である。事象は「例:」の括弧内に留まっているので、flag にはしない。確信度は 50% 程度。
- SKILL.md:177 の手順（前提の書き出し→実測→記録）は、fp-registry-format.md へ移して SKILL.md にはポインタだけ残す案がある（パターン#2）。ただし、SKILL.md は正本・詳細レイヤー自身である。現状は fp-registry-format.md:71 から SKILL.md へのポインタになっており、誤運用には至らない。
<<<END_LENS_FINDINGS>>>
```

#### Round 2

```text
<<<LENS_FINDINGS role="fresh-eyes">>>
LGTM／optional: 設計上の事実と実ファイルを照合した。重大な欠陥は見つからなかった。

- 4 つのコピー対（`skills/` と `plugins/dev-tools/skills/`）で、diff の index ハッシュが一致している（SKILL.md は d23f0ca..a8ddb89、cycle-log-format.md は eebf9b4..9dd8022、durable-state.md は 3c58c4b..60935b7、fp-registry-format.md は e3bf899..543b8d0）。同期コピーに乖離はない。
- dev-tools の version は marketplace.json、plugin.json、README で 1.22.0 に揃っている。
- 差し戻しが次ラウンドで再浮上する経路は、Fresh Eyes に固有の問題として Core Logic で flag にした（`skills/lens-review-cycle/SKILL.md:181`）。ここでは重複させない。
- optional: `skills/lens-review-cycle/SKILL.md:181` は、cycle ログの書式（`references/cycle-log-format.md:19-20`）に書く内容を二重に述べている。SKILL.md 側は「前提と、成り立たない／測れないのどちらかと、その根拠」まで書く。書式側は「{差し戻した理由}」とだけ書く。矛盾はないが、将来ドリフトしうる。SKILL.md 側を「内容は cycle-log-format.md に従う」に圧縮する余地がある。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="security">>>
LGTM
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="core-logic">>>
flag 1件
[ISSUE] skills/lens-review-cycle/SKILL.md:181（同内容の plugins/dev-tools/skills/lens-review-cycle/SKILL.md 同行。関連: 同ファイル :95, :111, :143-157, :191）
確信度: 82%
問題: 差し戻した指摘を「次ラウンドの『修正済み事項』に載せて再報告させない」としているが、これでは Fresh Eyes に届かない。
- Fresh Eyes は仕様上、修正済み事項を読む前に findings ブロックを完成させる（:95, :111）。そのため差し戻し済みの一覧を見ずに同じ指摘を独立に再検出する。
- ステップ 3 の照合（:146-157）は FP レジストリとの照合だけを定めている。`state.md` の差し戻し一覧との照合はどこにも無い。
- 再報告された指摘は「新規指摘」としてステップ 4 に回る。
- ステップ 4 で同じ指摘を再度実測して再度差し戻すか、「FP レジストリ非該当の同一 flag が 2 ラウンド連続で再出現」（:191）として堂々巡り扱いになる。
- 差し戻しは修正でも FP 化でもない。そのため、差し戻しを再報告するレンズが 1 つでもあると、ステップ 5 の「継続判定で数えない」が実行時に効かなくなる。
失敗の示し方: R1 で Core Logic が「仕様どおりに動くと害が出る」と報告し、実測で害を確かめて差し戻す。R2 の Fresh Eyes は修正済み事項を読めないので、同じ害を再度 flag する。照合の定義が無いので、オーケストレータは次のどちらかに進む。
- この flag を「真の指摘」として扱って再評価する。再評価でも前提の判定は同じなので、また差し戻して R3 まで回る。
- 「同一 flag の 2 ラウンド連続再出現」で堂々巡りとして停止する。他のレンズが全て LGTM でも、終了理由が「堂々巡り」になる。
修正案: ステップ 3 の FP 照合ルールに、`state.md` に記録した差し戻し一覧との照合を加える。例: 「指摘の主張が `state.md` の差し戻し一覧とマッチする（同じ仕様への同じ指摘）→ 差し戻し済みとして、再評価・修正・継続判定への算入をしない」。あわせて、Fresh Eyes にも FP レジストリと同様に差し戻し済み一覧を渡す。ステップ 2 の必須情報（:118-127）に、Fresh Eyes の完成前から参照してよい項目として差し戻し済み一覧を加えれば、「修正済み事項」を後読みにしたまま、差し戻しだけを先に渡せる。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="tests">>>
LGTM／optional: 今回の差分は文章の追記・置換と version 更新、同期コピーだけで、実行コードは増えていない。量・不正入力・時刻・並行の追加 runtime テストは対象外と判断した。

- 文章の同期は、4 つのコピー対で diff の index ハッシュが一致していることを確認できた。
- 提示資料からは、報告された R1〜R4b の判定結果、Biome、Vitest の実行ログは確認できない。判断品質は固定 blob 比較では証明できないという前提どおりであり、flag にはしない。
- 前提崩れの扱いは、差し戻し経路が本文どおり運用できるかに依存する。Core Logic の flag の修正後に、再報告のシナリオ（R1 で差し戻し、R2 の Fresh Eyes が再報告）を文書上で追跡して確認することを勧める。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="domain">>>
LGTM／optional: 同期・version・ゴールシート適合を確認した。

- 正本と同期コピー: `skills/lens-review-cycle` を編集し、`plugins/dev-tools/skills/lens-review-cycle` へ同期している。P-2 と AGENTS.md「skills/ 変更時」3 に適合する。
- version: marketplace.json の dev-tools（1.22.0）、plugin.json（1.22.0）、README の見出し（v1.22.0）が一致している。AGENTS.md「plugins/ 変更時」2 と cache のキー規則（version を据え置くと届かない）に適合する。配布先の cache 実体の確認はマージ後に司令塔が行う前提で、今回の範囲外。
- C-001 / C-002: スキルのインストール・更新の経路と、プラグインへの同期スキルの経路を変えていない。N-001（standards の複製）と N-003（識別子・契約の破壊）にも当たらない。
- P-3: cycle ログに「判断レンズへの差し戻し」欄を足している。既存の legacy ログや旧エントリにこの欄は無いが、carry-over が読むのは「確定した偽陽性」だけである。互換は保たれる。
- optional: DoneCriteria は「flag は修正または明示受容。受容する欠陥はリスクレコードへ」である。SKILL.md:179 は「害を確かめた」指摘を、修正でも受容でもない差し戻しにして完了レポートへ持ち越す。ambiguity-hunter.md の逆流と同じ扱いで、完了レポートと cycle ログに残る。このため新しい穴にはならない。ただし、害が確定した状態で終了する場合の最終受容先（リスクレコード等）は、利用側リポジトリの運用に委ねられている。確信度 50% 程度で、承認済み設計の範囲内として optional に留める。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="ambiguity-hunter">>>
LGTM／optional: 80% 以上の曖昧さは見つからなかった。

- optional（パターン#4、確信度 60%）: ステップ 5 の継続判定表（`skills/lens-review-cycle/SKILL.md:189-194`）に、「差し戻しの flag だけが残ったラウンド」の行が無い。
  - :181 は「継続判定で flag に数えない」と明記しているので、読めば解釈は一意に決まる。
  - ただし、表の「全レンズが LGTM（flag 0）」は文字どおりには差し戻し flag を含むレンズに当てはまらない。
  - 行を足すか、「差し戻しだけの flag は LGTM 相当」と一文を足すと、誤読の余地が消える。
- optional（パターン#5、確信度 55%）: `references/ambiguity-hunter.md:60-64` の収束節は、「明文化」または「明示受容」で消すとしている。差し戻しは第三の経路で、同ファイル :80 の逆流節に書かれている。:181 が継続判定から除外すると明記したので矛盾ではない。ただし収束節に「差し戻しは計数対象外」と一文のポインタがあれば二重定義が減る。今回の差分外のファイルなので optional に留める。
- optional（パターン#3、確信度 55%）: 「測れないとき」（SKILL.md:179）の閾値がない。何をもって測れないとするかは書かれていない。ただし、判定をオーケストレータの裁量に残す意図は読み取れる。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="altitude-checker">>>
LGTM／optional: 誤運用に至る altitude の問題は見つからなかった。

- optional（パターン#3 一回性の一般化、確信度 45%）: 追記の根拠は agent-env の 1 事例だけである。ただし本文には事例を持ち込まず、一般形（仕様が立っている前提を書き出して実測する）で書いてあり、例示も「例:」に収まっている。害の構造は、仕様どおりに動けば害が出るという一般的な形である。一回性の経験則ではないので flag にしない。
- optional（パターン#2 委譲可能な詳細、確信度 40%）: SKILL.md:181 に cycle ログの記載内容が再掲されている。委譲先は `references/cycle-log-format.md` である。ポインタ化すると圧縮できるが、誤運用には至らない。
<<<END_LENS_FINDINGS>>>
```

#### Round 3

```text
<<<LENS_FINDINGS role="fresh-eyes">>>
LGTM／optional: 過剰実装の降格理由欠落はなし。「新しい仕組みは作らない」という設計上の事実は、ほぼ妥当だが厳密には言い過ぎ。
- 設計上の事実の検証: 既存の受け皿（逆流と「判断レンズへの差し戻し」）は使っている。ただし今回の差分は、`state.md` の差し戻し台帳（durable-state.md:58）、ステップ 3 の照合規則（SKILL.md:159）、cycle log の欄（cycle-log-format.md:19-20）を足している。既存の逆流は継続判定からの除外方法を定めていないので、これらは受け皿を動かすために要る。ただし FP レジストリと並走する第二の台帳なので、「新しい仕組みなし」とまでは言えない。
- optional: SKILL.md:183 は 1 段落に 6 つの規則（継続判定から除外、state.md 記録、レビュアーへ渡さない、再照合、cycle 記録への書き方、報告への持ち越し）が入っていて読みにくい。箇条書きに分けると、規則の落とし漏れに気づきやすくなる。
- optional: SKILL.md:179 の「1 つ目の基準」は序数参照。基準の並びが変わると壊れる。基準の名前で呼ぶほうが安全。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="security">>>
LGTM／optional: 注入、パストラバーサル、認可、秘密露出に関わる新規の実行経路はない。runtime code の追加もない。
- optional（確信度 50% 程度）: SKILL.md:180 は、前提と実測の結果を FP レジストリの理由に書かせる。cycle-log-format.md:18,20 と手順 4（:39）は、それを repo 内の `.docs/reviews/cycles/` へ転記させる。ここはコミット対象になる。実測の対象は「環境や運用の状態」で、利用者が意図して入れた設定（秘密を含みうる）のこともある。測定値を書く際に、値そのものでなく有無や要約にとどめ、秘密や環境固有の値を書かない、という一文がない。実測が読み取りだけの操作であるという指定もない。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="core-logic">>>
LGTM／optional: 継続判定、堂々巡り判定、carry-over の論理は整合している。
- 確認した点（SKILL.md:159, 183, 189-196）: 差し戻し済みの指摘は照合でマッチした時点で、再評価、修正、継続判定、堂々巡り判定のどれにも数えない。新規の差し戻しも同じラウンドの継続判定に数えない。`対象: N/A` は fp-registry-format.md:111 の条件 2 で引き継がれない。そのため環境依存の FP が次サイクルへ残ることはない。
- optional: 照合で言い換えを見落とすと、同じ指摘が `state.md` に複数エントリとして積まれる。誤運用ではなく冗長にとどまる。
- 実測の範囲と時点が決まっていない問題は、Ambiguity Hunter の flag に記載した。ここでは重複して挙げない。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="tests">>>
LGTM
- 実行コードも入出力契約も変更していない。そのため runtime テストの追加は不要。
- 各ファイルの本文は、司令塔の改訂済み blob と一致している（正本と同期コピーの blob 識別子も同一）。
- 形式の整合は取れている。cycle-log のエントリ例と 0 件表記（cycle-log-format.md:19-24）が揃っている。durable-state の追記も既存の箇条書きの形に合っている。
- LLM による運用判断の質は、文書レビューでは証明できない。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="domain">>>
LGTM／optional: 配布、同期、version、ゴールシートへの適合は問題なし。
- 正本と同期コピー: SKILL.md、cycle-log-format.md、durable-state.md、fp-registry-format.md の 4 本は、`skills/` と `plugins/dev-tools/skills/` で差分の index 識別子が同一（e994ce0、9dd8022、60935b7、543b8d0）。AGENTS.md の「プラグイン側を直接編集しない」に反していない。
- version: marketplace.json の dev-tools、plugin.json、README の 3 か所がすべて 1.22.0 で揃っている。スキルの中身を変えたので、AGENTS.md の「同じコミットで上げる」にも合う。cache への反映はマージ後の配布確認の範囲で、今回の差分では検証できない。
- C-001 / C-002 に沿った変更で、N-001〜N-003 に当たらない。P-1: standards の検査項目を複製していない。P-2: 正本を編集して同期している。P-3: cycle log の欄追加は後方互換。旧エントリは、完全な start / end marker の条件を満たす限り、欄がなくても carry-over の候補になる。carry-over は「確定した偽陽性」だけを読む。
- optional（確信度 55% 程度）: DoneCriteria と SKILL.md:189 は、確信度 80% 以上の flag を「修正または明示受容」で消すとしている。新しい差し戻しは、害を確認した後も修正も受容もしない第三の出口で、そのまま「全員 LGTM」で終われる（SKILL.md:179-183, 194）。ただし既存の逆流（ambiguity-hunter.md:80）と同じ経路で、完了レポートと cycle log に残り、人間が裁定する。依頼で承認済みの設計なので flag にはしない。
- optional: marketplace.json のトップレベル version（7.5.1）は据え置き。直前のリリースでトップレベルも上げる慣行だったかは、差分からは確認できない。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="ambiguity-hunter">>>
flag 1件
[AMBIGUITY] skills/lens-review-cycle/SKILL.md:179-180（同期コピー plugins/dev-tools/skills/lens-review-cycle/SKILL.md も同じ行） / パターン#1 / 確信度82%
問題: 「前提が今も成り立つかを実測してから」偽陽性にする、とある。しかし何を測れば「成り立つ」と言えるかの基準がない。測る環境、母集団、有効な時点が書かれていない。例に挙がる前提「その path には特定の発生元の変更しか入らない」は、利用者や運用の状態についての不変条件である。オーケストレータは、自分の checkout か 1 台の環境を見て「成り立つ」と判断できてしまう。
- 失敗の示し方: 元の事例では 2026-08-09 のレビュー時点で、該当 path はクリーンだった。同じ手順で測ると前提は成り立つので、`対象: N/A` の FP にして終わり、同じ事故が再発する。事故が起きたのは、利用者が意図した設定を置いた 2026-10-19 だった。
- 時間軸の問題: 実測は 1 時点の標本である。FP は同一サイクル内ではそのまま維持され、`N/A` は次サイクルに引き継がれない。後で前提が崩れても、再レビューがない限り誰も再測定しない。したがって「そのつど測り直す」は、前提の維持を保証する仕組みにならない。
- 「成り立たない／測れない」と「成り立つ」の線引きが、測る側の裁量に委ねられている。
明文化案: SKILL.md:180 の 1 つ目の箇条書きを次のように置き換える。
「成り立つと確かめられたときだけ、偽陽性にする。『確かめられた』は次のどちらかに限る。(a) 前提が仕様・コードの仕組みで保証されていて、利用者の状態に依らず崩れない（保証している箇所を理由に書く）。(b) 害が出る側の環境（利用者・運用の実環境）で測れた（測った環境と日付を理由に書く）。レビュー担当の checkout など単一の観測だけで、利用者や運用の状態についての前提を『成り立つ』としない。その場合は『測れない』として次の箇条書きの差し戻しにする。FP レジストリの理由には、前提、測った環境、日付、結果を書き、`対象` は `N/A` にする。前提は環境や運用の状態なので次のサイクルへは引き継がず、そのつど測り直す（`references/fp-registry-format.md` の carry-over は `N/A` を引き継がない）。」

optional（flag にしない補足）:
- SKILL.md:204 の書き出し項目の列挙（ラウンド数、終了理由、レンズ別 flag 件数、確定した偽陽性）に、差し戻しが入っていない。cycle-log-format.md:39 とステップ 4（:183）が補うので、誤運用までは至らない。完了レポートの様式（SKILL.md:247-250）は件数だけを出し、指摘の概要も cycle log の場所も出さない。`rm -rf "$REVIEW_DIR"` の後は `state.md` が消えるので、利用者が差し戻しの中身を知るには cycle log を探す必要がある。「概要は cycle log を参照」の 1 行があると親切。
- ambiguity-hunter.md:80 は「完了レポートへ持ち越す」とだけ書く。SKILL.md:183 が足した継続判定からの除外と `state.md` 記録への言及はない。矛盾はしない。SKILL.md を参照する一文があると、ずれが起きにくい。
<<<END_LENS_FINDINGS>>>
<<<LENS_FINDINGS role="altitude-checker">>>
LGTM／optional: 委譲済みの機構詳細の二重化や、固有語彙で読者が誤運用に至る箇所はない。
- 配置は適切。差し戻しの規則の正本は SKILL.md のステップ 4（:183）にある。durable-state.md:58 は「SKILL.md のステップ 4」へポインタを張った要約で、fp-registry-format.md:71 も SKILL.md の「偽陽性の判定基準」を指している。正本が複数ある状態にはなっていない。
- 「例: その path には…」は例示で、過剰な一般化の除外対象。
- optional（パターン#3、確信度 50% 程度）: 追加された規則の根拠は agent-env の 1 件の事故だけである。ただし規則は一般原則として書かれていて、事例の具体値は本文に入っていない。複数回の再発の根拠がなくても、害がデータ破壊に及ぶ型なので、現状の書き方で許容できる。
<<<END_LENS_FINDINGS>>>
```

<!-- review-cycle:end 2026-10-20-fp-spec-harm -->
