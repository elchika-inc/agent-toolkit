# Project Risk Registry — agent-toolkit（リスクレコード）

受容・保留・撤回したリスクの記録。standards `DOCS_OPS.md` が記録を MUST とするものの置き場でもある。

## 記法

- **ID は再利用しない。** 解決・撤回したエントリも番号を残したまま `Status` を更新する（PR・Issue・他ドキュメントから参照されるため）。新規エントリは常に未使用の最大値+1 を使う。
- **`Status` はこの 4 語だけを使う**:

  | 値 | 意味 |
  |---|---|
  | `open` | リスクが現存し、対応方針が未決 |
  | `accepted` | リスクが現存するが、理由を明示して受容している |
  | `resolved` | 実装で解消済み。解消した PR / コミットを `Resolved` に書く |
  | `withdrawn` | エントリの前提が誤っており、リスクそのものが存在しなかった |

- **記述を訂正するときは黙って書き換えない。** 誤っていた記述・古くなった記述は `**訂正 (YYYY-MM-DD)**` として、旧記述と何がどう変わったかが読み取れる形で残す。事実記述のフィールド（`Description` / `Location`）は直接更新して差分を訂正ブロックで説明してよい。結論のフィールド（`Mitigation` / `Why accepted`）は取り消し線で残す。複数あるときは `**訂正 N (YYYY-MM-DD) — 見出し**` の連番にする。
- **`Reconciled`** は、そのエントリを実装と突合した最終日と突合対象のコミット。`open` / `accepted` のまま実装だけが進むと記録が実態から離れるため、エントリを触る作業のたびに全件を突合して更新する。
- **`anchor`** は、受容が破れたことを受容者以外の何が検知するかを書く（人間の目視・PR diff・実行されたテスト・外部システムの記録など、レビューループの外側にある観測）。受容内容を再記述するだけの別のレビュー結果・計画・記録は anchor にしない。
- **外部参照の陳腐化を確認する**: ID・`Status` を変更したら、それを引用している文書（`rg -n 'RISK-[0-9]{3}' <引用元>` で列挙）を確認する。同時に直せない場合は、当該エントリへ「どの文書が古いままか」を書き残す。

---

## RISK-001: 旧 human-v1 マージ記録の監査判定不能

- **Status**: resolved
- **Date**: 2026-09-10
- **Confidence**: 100%
- **Discovered**: standards rev.90 の準拠監査（2026-09-10、委任元による merged PR の実測）。
- **Location**: elchika-inc/agent-toolkit の merged PR #44 / #45 / #46。
- **Description**: 3件が持つ `agent-merge-verdict/human-v1` は rev.75 で導入され、rev.81 の `human-v2` に置換された旧版。現在の AUDIT.md は `v1` と `human-v2` のみを照合対象とするため、当時正しかった記録を判定できない。
- **Why accepted**: リポジトリ側の文書修正では過去の版と現在の照合条件の差を解消できず、当時の正当な履歴を書き換えるべきではないため受容する。
- **Mitigation**: 過去3件の判定不能を現行 PR の承認確認と区別する。新しい PR は現行のマージ記録形式と `merge_policy: human` に従う。
- **リスクが顕在化する条件**: merged PR 走査が旧版を対象に含め、当時の記録を現行の照合対象だけで不適合と判定する場合。
- **anchor**: なし（resolved のため accepted ではない）。
- **Follow-up**: 起票済みの [elchika-inc/standards#82](https://github.com/elchika-inc/standards/issues/82) が求めた経過措置は standards rev.92 で実装され、対象3件を再評価した。
- **Resolved**: 2026-09-10、standards rev.92 の [DOCS_OPS.md §5「退役版の監査」](https://github.com/elchika-inc/standards/blob/a8ce05d417059a0580ed29c802f125de6d02ea3f/DOCS_OPS.md#5-ブランチ戦略) により解消。委任元の同日実測で、#44 のマージ日 `2026-08-22T12:08:06Z`、#45 の `2026-08-22T12:12:44Z`、#46 の `2026-08-22T16:37:22Z` はいずれも `human-v1` の有効期間（2026-08-17〜2026-08-26、両端を含む）内であり、各 PR の `human-v1` コメントは要求4項目（実装担当識別子・判定時 head・承認した人間・承認の所在）を満たすことを確認した。
- **Reconciled**: 2026-09-10 `8bc97be846da6c1d6ac4b5523fd64c84af7bfb60`（作業開始時の main。外部 PR 記録は委任元の同日実測と突合）。

---

## RISK-002: パッケージマネージャに npm を継続使用

- **Status**: accepted
- **Date**: 2026-09-10
- **Confidence**: 100%
- **Discovered**: standards rev.90 の準拠監査と、委任元によるプラグイン起動コマンドの実測。
- **Location**: `plugins/elchika-tools/.mcp.json`、`plugins/elchika-tools/mcp-server/package-lock.json`。
- **Description**: standards `PROJECT_RULES.md` はパッケージマネージャに pnpm を SHOULD としているが、この MCP サーバーは npm を使用している。
- **Why accepted**: `.mcp.json` の起動コマンドはプラグイン利用者のマシンで `npm install --include=dev --silent` を実行する。pnpm への移行は利用者へ pnpm の導入を要求し、配布物を起動できない環境を生むため、npm を継続する。lockfile のコミットという MUST は `package-lock.json` で満たしている。
- **Mitigation**: `package-lock.json` を維持し、開発・CI では `npm ci` で依存を再現する。
- **anchor**: 人間の PR レビュアーが `plugins/elchika-tools/.mcp.json` の差分を確認し、起動コマンドが `npm install` 以外へ変わったことを検知する。その変更で pnpm 導入を阻む前提が消えた場合、この受容を再評価する。
- **Reconciled**: 2026-10-20 `08ca812f034fb3e79aeb0b8bdd82a307eb80aa90` の `.mcp.json` と `package-lock.json` を照合（起動コマンドは `npm install --include=dev --silent` のまま。`package-lock.json` はある）。

---

## RISK-003: lens-review-cycle の偽陽性の基準で、最後に直した箇条書きを再レビューしていない

- **Status**: accepted
- **Date**: 2026-10-20
- **Confidence**: 100%
- **Discovered**: PR #87（lens-review-cycle の偽陽性の判定基準の直し）のレビューサイクル。上限の第 3 ラウンドに出た flag（Ambiguity Hunter: 前提が成り立ったと言える実測の環境・範囲・時点が定義されていない）を直した修正は、上限に達したため再レビューしていない。レビュー記録は `.docs/reviews/cycles/2026-10-20-fp-spec-harm.md` の ACCEPTED_RISKS。
- **Location**: `skills/lens-review-cycle/SKILL.md` と同期コピー `plugins/dev-tools/skills/lens-review-cycle/SKILL.md` の、「仕様どおりに動くと害が出る」指摘の扱いのうち、「成り立つと確かめられたときだけ、偽陽性にする。」で始まる箇条書き。main には PR #87 のマージコミット `1de88c3fe762827abcf5252104b4c6e16959c6d9` で入った。
- **Description**: この箇条書きは、偽陽性にしてよい「確かめられた」を、(a) 前提が仕様やコードの仕組みで保証されているときと、(b) 害が出る側の環境で測れたときに限り、レビューする側の checkout だけを見て成り立つとしない、と定める。文言はオーケストレータが決め、blob と検索で反映を確かめた。文言の曖昧さと、ほかの手順（継続判定・FP レジストリ・判断レンズへの差し戻し）との噛み合いは、レビューで確かめていない。
- **Why accepted**: 変更は 1 つの箇条書きの置き換えに限られ、直した flag（実測の範囲が定義されていない）に文言が直接答えている。上限を超えてラウンドを足すより、この基準が実際に使われたときの記録を人間が読む経路（anchor）で検知するほうが安い。
- **Mitigation**: 反映は、オーケストレータが origin/main から別に作った想定との blob の一致（`b7854c69e0ee9a4de90168d5eba037c813606a9f`）と、正本と同期コピーの tree の一致で確かめた。
- **リスクが顕在化する条件**: lens-review-cycle を使うサイクルで、オーケストレータがこの箇条書きを読み違え、レビューする側の checkout だけを根拠に「仕様どおりに動くと害が出る」指摘を偽陽性にする。または、仕組みで保証された前提への指摘まで判断レンズへ差し戻す。
- **anchor**: lens-review-cycle を使った PR の diff に載る完了ログ（`.docs/reviews/cycles/<cycle-id>.md`）の「確定した偽陽性」の理由と「判断レンズへの差し戻し」を、マージを承認する人間が読む。理由が (a)・(b) のどちらにも当たらない偽陽性、または保証された前提を差し戻した指摘が見つかったら、この受容は破れている。
- **Follow-up**: 次に `skills/lens-review-cycle/SKILL.md` を変える PR のレビューで、この箇条書きもレビューの対象に含める。flag が 0 なら `resolved` にする。
- **Reconciled**: 2026-10-20 `08ca812f034fb3e79aeb0b8bdd82a307eb80aa90` の `skills/lens-review-cycle/SKILL.md` を照合（「成り立つと確かめられたときだけ、偽陽性にする。」で始まる箇条書きが、正本と同期コピーに 1 つずつある）。
