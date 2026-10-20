# スクリプトの分類と判定

`classifyFinding` は最初に category を確認し、`environment`・`declaration` は同名の分類を返す。以下は `product` の分類である。

| 条件（上から判定） | 分類 |
|---|---|
| head の tried が 3 でない・null | incomplete |
| head 0/3 | not-reproduced（比較の相手を見ない） |
| C で symptom が expectation・console・network | production-failure |
| C のそれ以外 | production-observation |
| A・B で base の tried が 3 でない・null | incomplete |
| base 1 回以上、head 3/3 | pre-existing |
| base 1 回以上、head 1〜2/3 | pre-existing-flaky |
| base 0/3、head 3/3 | regression |
| base 0/3、head 1〜2/3 | regression-flaky |

回数不足は時間切れ・中断の結果だけで許される。incomplete は reject にも起票にも使わない。

## 判定の順序

`decideVerdict` は reject の条件、undetermined の条件、approve の順で判定する。当たった条件は reasons にすべて残す。

| 判定 | 条件 |
|---|---|
| reject | regression または C の production-failure がある。あるいは両側の回数がそろった fixChecks の head で 1 回以上再現する |
| undetermined | 上に当たらず、regression-flaky・incomplete、成功基準の行の skip、点検や到達の未通過、時間切れ・中断、空のマトリクス、対象 SHA の不一致、fixChecks の回数不足または比較相手 0/3 のいずれかがある |
| approve | どちらにも当たらない |

A の PR title が `fix:`・`fix(` で始まる、またはラベルが `bug` なら、fixChecks が空の場合も undetermined。PR の title・labels は publish が GitHub から直接読み取る。

A・B は preflight.ok と head、browser/http を含む場合は reach.ok を確認する。CLI だけの場合に reach は要求しない。C は preflight/reach を要求せず、直下の production-log.json を確認する。

C は production の記録なし、deployCheck 未通過・SHA 不一致、remote が `https://github.com/<repo>.git` 以外、ghBin が `gh` 以外、見張りの自己確認 3 項目の未通過、対象が空・すべて skipped、budgetExceeded も undetermined の条件になる。
C の product は発見ごとに実際の rerun 記録の数と headRuns.tried を照合する。不一致は undetermined の条件。

表示は A・B が「承認してよい／承認しない／判定できない」、C が「問題なし／失敗／判定できない」。

## 起票と再開

A の regression はまとめにだけ残す。pre-existing・pre-existing-flaky・declaration と C の production-failure は Issue の候補。B の regression は `agent-verification` と `regression` で起票し、candidatePrs を原因の候補として載せる。not-reproduced・regression-flaky・incomplete・production-observation は起票しない。

指紋は repo・正規化した surface・symptom・正規化した key の SHA-256 先頭 12 桁。同じ指紋が開いていれば一度だけコメントし、完了で閉じていれば再発として新規起票、NOT_PLANNED/DUPLICATE は既知としてまとめる。複数なら開いている新しい Issue を優先する。1000 件で一覧が打ち切られる場合は新規起票せず、照合できなかったことを残す。

新規 Issue は published の作成済み分を含めて 5 件まで。添付は 50 枚ずつ。途中再開では published.json と GitHub の添付目印を照合し、作成済みを飛ばす。まとめは同じ kind のコメントを更新する。
