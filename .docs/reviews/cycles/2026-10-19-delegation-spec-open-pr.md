<!-- review-cycle:start 2026-10-19-delegation-spec-open-pr -->
## 2026-10-19 delegation-spec の PR 作成直前チェック追加

- **Cycle ID**: 2026-10-19-delegation-spec-open-pr
- **対象 HEAD**: 6b2cde57869c006ad862680984499d61928c2785
- **総ラウンド数**: 1
- **終了理由**: 全員 LGTM
- **レンズ別 flag 件数**: Security 0 / Core Logic 0 / Tests 0 / Domain 0 / Fresh Eyes 0 / Ambiguity 0 / Altitude 0
- **確定した偽陽性**:
  - なし
<!-- review-cycle:end 2026-10-19-delegation-spec-open-pr -->

### レビュー対象と実施方法

- 委任仕様: Task ID `task_e08c66537e7e` / Dispatch ID `ctx_e09e9f62014b` 第2〜7節。
- 対象: `skills/delegation-spec/SKILL.md:34` の追加1行。比較基点は `0eff3bfcc059607b8ce4d8380770e0181cc37ff5`（origin/main）。既存115行は変更前とバイト単位で一致。
- 実施規律: [lens-review-cycle](../../../skills/lens-review-cycle/SKILL.md)「ステップ2〜6」、[報告規定](../../../skills/lens-review-cycle/references/specialist-roles.md)、[scope フィルタ](../../../skills/lens-review-cycle/references/agent-output-principles.md)、[記録書式](../../../skills/lens-review-cycle/references/cycle-log-format.md)、[standards AI_FIRST §3](https://github.com/elchika-inc/standards/blob/main/AI_FIRST.md#3-ai-レビューサイクルmust)。委任仕様第5節の最大2ラウンドを適用。
- fresh context の `claude` CLI を1回起動。指定 `sonnet` / `high`、応答の modelUsage は `claude-sonnet-5-5`。ツールなし、strict-mcp-config、safe-mode、permission-mode dontAsk、session persistenceなし。perl の900秒上限を設定し、exit 0、`subtype: success`、`is_error: false`、1 turn、permission_denials 0件。打ち切り・再試行なし。
- 入力は7 roleの順序・報告規定・scopeフィルタ・設計上の事実・空のFPレジストリ・`git diff -U20 origin/main...HEAD`・行番号付き正本全文・末尾の修正済み事項。`wc -c` は72,009 bytes（上限150,000以下）。
- 入力 SHA256: `2c53613b772b3b09b764eb90ef21221fa71cfe8630628a439ac78c9f726e7c89`。
- JSON応答 SHA256: `6a45f02ffa96d5e2f6638ab8ae920881f842de732c777571a29f11c3b2241431`。
- Fresh Eyes → Security → Core Logic → Tests → Domain → Ambiguity Hunter → Altitude Checker の順序、境界が各roleに1個、結論形式、flag件数の整合を検証。境界行だけを除いて7つの findings ファイルへ原文を保存し、再読取でbyte一致を確認。下記へ原文を転記。
- 最新完全ログ `2026-10-16-remove-crg-feeder` は確定FPなし。carry-overなし。対象のfingerprintはレビュー前後で一致。
- R1: flag 0件、optional 7項目。修正0件、受容0件、FP0件、判断レンズへの差し戻し0件。追加行は委任仕様第2節の指定文から変更していない。

### optional 指摘の扱い

以下はレビュアーが入口でoptionalとした指摘で、flagからの格下げはない（正本: scopeフィルタ、standards AI_FIRST §3）。Ambiguity Hunterの2項目は原文が「確信度80%未満」と明記しており、低確信度の参考観測として原文のまま保存する。

1. Core Logic: `gh pr list` の既定取得件数30件。指定文を維持し、30件を超えるopen PR集合への網羅性は今回の検証では測らない。実測R9の出力範囲はPR本文に記録する。
2. Core Logic: 直前確認とPR作成の間の競合の窓。直前再確認による時間差の短縮が今回の変更であり、排他制御は追加しない。
3. Tests: 「量」のテスト除外理由。大量PRの模擬実行は、指定された1行の文書追加の範囲でなく、今回の不在確認はR9の実出力に限定する。PR本文にこの境界を記録する。
4. Domain: 配布先確認の未実施をPR本文へ明記する。委任仕様第3・6節に従い、マージ後に司令塔が配布とblob照合を行う。
5. Ambiguity Hunter: `orca worktree ps` の後の調整方法。追加行の変更は行わない。
6. Ambiguity Hunter: 「同じ対象」と「同じファイル」の語の幅。測る条件は同じファイルと指定済みで、追加行の変更は行わない。
7. Altitude Checker: 一回の実例の将来の整理。今回の指定された例示を維持する。

### 成功基準と検証時点

成功基準の正本は委任仕様第4節R1〜R10、第5節、第6節。R1は検索語が1行、R2は基準行の直後、R3は指定文との完全一致、R4は正本1追加0削除、R5は正本Mと新規レビュー記録Aだけ、R6は500行以下、R7は空白診断なし、R8はcheck・ci・test各exit 0、R9はPR作成直前に同じ正本を変えるopen PRなし、R10はPR CIの `Biome / Test` 成功を確認する。受容を選んだ場合だけrisk-registry追記を許すが、このサイクルでは受容なし。

コミット前の実ファイル検査では、R1相当は34行目1行・exit 0、R2相当は33行目1行・exit 0、R3相当はsed出力1行・exit 0で指定文と目視一致、さらにbyte一致。R4相当の未コミットdiffは1追加0削除、R5相当は正本のみ、R6は116行、R7相当は出力なしで各exit 0。初期状態の検索語は0行・exit 1で、変更前後の検査結果を区別した。

収束の対（正本: standards AI_FIRST §3、AGENTS.md「Key Commands」）は `npx --yes @biomejs/biome@2.3.10 check .` がexit 0・12ファイル・既存の複雑度警告4件、`npm --prefix plugins/elchika-tools/mcp-server ci` がexit 0、`npm --prefix plugins/elchika-tools/mcp-server test` がexit 0・1ファイル34件成功。npm ciは脆弱性15件（low 2 / moderate 4 / high 8 / critical 1）とinstall scripts未承認2件の診断を出したが、依存ファイルは変更していない。

この記録のコミット後にR1〜R8を単独コマンドで再実行し、PR作成直前にR9、作成後にR10を実行する。最終HEADの実測値はPR本文に記録する。本記録はレビュー対象のファイル内容とローカルコマンド実行結果の観測であり、配布先・マージ後の状態は測っていない。UIを持たない変更なのでUI検証は対象外（standards AI_FIRST §3「N/Aの判定」）。

### レンズ別 findings 原文

#### fresh-eyes

LGTM
対象は `skills/delegation-spec/SKILL.md:34` の追加1行です。差分は +1 行だけです。ハンクは `-14,40 +14,41` で、直前の33行目は「背景に、**worker が着手時に自分で観測できる事実**」で始まる既存行です。変更後の全文は116行で、115行に1行足した数と合います。位置は指定どおりで、既存行の改変は見当たりません。

新しい実行コードや独自の検査機構はありません。既存CLIの `gh pr list` と `orca worktree ps` を呼ぶ時点を指定しているだけです。YAGNI や降格理由の欠落に当たる点はありません。

実例の数字を、与えられた時刻と照らしました。09:19:00 の測定から #79 作成の 09:21:25 までは2分25秒、そこから委任の 09:23:53 までは2分28秒です。「2分後」「その2分後」は妥当な丸めです。「配布物が1バイトも違わない」は、配布物の差分0行と整合します。「片方を閉じた」も、#80 をマージして #79 を閉じた事実と整合します。

実例の末尾にある、司令塔が環境から外れた道具を見ていたのに誰が外したかを確かめなかった、という記述は、提供資料だけでは裏付けられません。設計上の事実にあるのは「環境が他者の手で変わった兆し」までです。ただし指定された1行の文言であり、誤りだと疑う根拠もないため、flag にはしません。

33行目の「観測できる事実は背景に書かず rubric に測る手順として置く」とは同じ向きで、矛盾しません。長さも43・44行目と同程度です。

#### security

LGTM
追加行は、`gh pr list --state open --json number,title,files` と `orca worktree ps` を呼ぶ時点を指示する文章だけです。注入・パストラバーサル・認証・秘密情報の経路は増えていません。実鍵形式の値もありません。

他者のPRのタイトルとファイル一覧は第三者が書く入力です。ただしこの行では「同じファイルを変えるPRがあれば作らず ask で止まる」としか使わず、取得内容を実行や解釈に回しません。止まる方向に倒す設計なので、新しい攻撃面にはなりません。

#### core-logic

LGTM／optional: `gh pr list` は既定で30件で打ち切られます。確認から作成までに競合の窓が残ります。
手順の論理は成立しています。司令塔が dispatch 前に測った「0件」は、worker のPR作成時点では古くなりえます。これに対し、PR作成直前に worker が自分で測り、あれば ask で止まる、という構造です。実例の時系列に当てはめると、worker の作成は #79 作成（09:21:25）の後（09:23:53 以降）です。直前確認なら #79 を検出でき、再発を防げます。「あれば作らず ask」は停止方向に倒れるので、安全側です。

optional（flag にしない）:
- `gh pr list` の既定は `--limit 30` です。ただし並行PRは作成順の新しい側に並ぶので、数分差の競合という対象には効きます。open PR が多いリポ向けに `--limit` を明示する余地はあります。
- 確認からPR作成までの数秒の窓は残ります。実例の間隔は約2分で、「直前」という指定で十分に狭まります。

#### tests

LGTM／optional: 設計上の事実が「外した条件と理由」に挙げていない類型に「量」があります。
今回は文章1行の追加で、実行コードがありません。ランタイムテストを足さない理由は、設計上の事実に明記されています。検証計画は、位置、完全一致、既存115行のbyte一致、正本のみ・1追加0削除という限定差分、116行、空白診断、Biome、既存MCPの34件、独立レビューで構成されています。変更の性質に対して、アサーションの対象は適切です。

関わる条件の類型のうち、時刻と並行は理由つきで外されています。実例の時系列も設計上の事実に実測値として残っています。

optional: 「量」は挙げられていません。指示するコマンドの既定件数（30件）に関わるため、`--limit` の件は「外した条件と理由」に一言足しておくと完全になります。この変更は文章であり、挙動の実行検証は R9 の実測が担っています。そのため、flag の根拠にはなりません。

#### domain

LGTM／optional: マージ前の PR 本文に、配布先での反映確認が未了であることを明記してください。
配布・正本とコピーの整合を見ました。変更は正本 `skills/delegation-spec/SKILL.md` だけです。設計上の事実によれば plugin 側の同期コピーは無く、`plugins/` の中身を変えていません。そのため、DoneCriteria の「`plugin.json` と `marketplace.json` の version を同じコミットで上げる」は該当しません。配布識別子や利用契約も変えておらず、P-3 に反しません。

P-1 は満たされています。追加行は standards のルールを複製せず、`gh` と `orca` の呼び出し時点を指示するだけです。この道具側の運用知識は、このリポジトリが正本を持つ範囲です。P-2 も満たされており、正本だけを編集しています。N-001〜N-003 には当たりません。能力としては C-001（共通スキルの更新）の改善に当たります。

`orca worktree ps` は、同ファイル50行目の Orca への言及と同じ前提の中にあります。新しい依存は増えません。

optional: DoneCriteria には「`skills/` を変更したら配布先の実体で反映を確認する」とあります。設計上の事実では、これは「マージ後に司令塔が行う」役割分担です。PR 時点では未達になるので、PR 本文に「配布確認はマージ後に司令塔が実施」と書いておくと、受容の根拠が追えます。追加行自体の不備ではありません。

#### ambiguity-hunter

LGTM／optional: 解釈の幅は2点ありますが、いずれも誤運用には至りません。
対象は追加行 `SKILL.md:34` です。採否基準は明示されています。測る時点は「PRを作る直前」、コマンドは `gh pr list --state open --json number,title,files`、条件は「同じファイルを変えるPR」、結果は「あれば作らず ask で止まる」です。停止規則と、司令塔側の確認時点（dispatch の前）もあり、収束条件の欠落はありません。「数分の差」「数」を除けば閾値のない主観語もありません。

optional（確信度80%未満・誤運用に至らない）:
- `orca worktree ps` で「その範囲を確かめる」の後が書かれていません。同じテーマのセッションがいたとき、委任を止めるのか、範囲を調整するのかは司令塔の判断に委ねられます。ただし ask と司令塔の裁定という既存の運用が受け止めるので、裁量の範囲です。
- 見出し語は「同じ対象」、実測条件は「同じファイル」で、語が揃っていません。実測条件が具体的に書かれているため、worker が迷う余地はありません。

宙吊り参照はなく、重複定義もありません。他の行へのポインタも張っていません。

#### altitude-checker

LGTM／optional: 追加行は単一事象を根拠にしています。ただし誤運用には至りません。
追加行は原則文書ではなく、スキル本文（詳細レイヤー）にあります。機構詳細の居場所として正しい位置です。`gh` と `orca` のコマンドは、既に同ファイルの50行目で Orca や `claude -p` を具体名で扱っているのと同じ抽象度です。脆いハードコードの検出パターンには当たりません。

「一回性の一般化」（パターン#3）の観点では、実例は1件です。ただし判断基準は「測った値は dispatch から作成までの間に古くなる」という一般形で書かれています。実例は括弧内に隔離された例示です。同ファイルは各項目に実例を1件ずつ置く構成で、これも同じ型です。常に効く非自然な地雷として、gotcha の直書きに該当するため、flag にはしません。optional として、同種の事象が再発しないまま長く残るなら、実例を brain のリスクノートへ移すことを検討してください。
