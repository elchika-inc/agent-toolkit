# FP Registry Format

偽陽性レジストリのフォーマットと運用ルール。

## エントリフォーマット

```markdown
## FP-{N}
**主張**: {スペシャリストが報告した問題の要約（1〜2行）}
**対象**: {偽陽性判定の成立に必要なリポジトリ相対パスの JSON 配列。完全に列挙できない場合は N/A}
**初出**: R{ラウンド番号} #{スペシャリスト番号} ({ロール名})
**判定**: FALSE POSITIVE
**理由**: {なぜ偽陽性か。どこに保護があるか、設計意図は何か、を具体的に}
```

## 例

```markdown
## FP-001
**主張**: implement モードの SKIP count が過小評価される（変更ファイルが reverseFiles に含まれるのに表示されない）
**対象**: ["src/context.ts"]
**初出**: R1 #5 (Fresh Eyes)
**判定**: FALSE POSITIVE
**理由**: 変更ファイルは reverseFiles の depth=0 に含まれており、
  "Changed:" ヘッダーセクションで表示されている。
  totalFiles - reverseFiles.size - forwardFiles.size は
  「Changed + Reverse + Forward = totalFiles - SKIP」を正確に表す。

## FP-002
**主張**: buildFullGraph が WAL モードで別接続と競合する（SQLITE_BUSY）
**対象**: ["src/db.ts"]
**初出**: R2 #3 (Core Logic)
**判定**: FALSE POSITIVE
**理由**: openDb は必ず WAL モードで接続を開く。
  WAL モードでは同一ファイルへの並行接続は安全（reader/writer は非ブロッキング）。
  SQLITE_BUSY は exclusive モードでのみ発生する。
```

## 照合ルール

### マッチとみなす条件

完全一致は不要。以下の条件で「同じ偽陽性」と判定する:

1. **同じロジックへの同じ誤解**: 例「SKIP count が間違っている」という主張はどの表現でも FP-001 にマッチ
2. **同じ前提の欠落**: 例「WAL モードを考慮していない」系はすべて FP-002 にマッチ
3. **同じ保護の見落とし**: 例「db! が危険」という主張は「process.exit(1) で保護済み」という事実で棄却

### マッチしない条件（新規として扱う）

- 新しいファイルや新しいコードパスへの指摘
- 既知の FP と「似ているが別の問題」（例: SKIP count の計算式は同じでも異なるモードの話）
- FP レジストリにある「理由」が現在のコードに当てはまらない（コードが変わった場合）

## スペシャリストへの展開方法

FP レジストリをプロンプトに組み込む際は、以下の形式で埋め込む:

```
## 既知の偽陽性（これらは確認済み・報告不要）

{fp-registry.md の内容をそのまま展開}

上記はすでに「偽陽性」と確認済みです。同じ主張は報告しないでください。
```

## レジストリの成長管理

### いつ追加するか

- スペシャリストの指摘を分析し「これは設計通りで問題ない」と判断したとき（「設計通りに動くと害が出る」という指摘はここに当たらない。扱いは SKILL.md の「偽陽性の判定基準」に従う）
- 複数ラウンドで同じ指摘が繰り返されたとき

### いつ「昇格」させるか

FP レジストリはサイクル終了時に削除される。しかし以下の場合は恒久的な記録に昇格させる:

- **CLAUDE.md の「重要な設計上の事実」セクションへ**: コードベース全体で繰り返す可能性がある設計判断
- **スペシャリストプロンプトの「設計上の事実」へ**: 次サイクルでも同じ誤判定が予想される場合

昇格は設計上の事実を人手で正本化する操作であり、下記の条件付き carry-over とは別レイヤーである。

昇格させることで、次サイクルで FP レジストリを初期化してもゼロから学び直さなくて済む。

## レジストリファイルの管理

`REVIEW_DIR` の決定的パス生成・安全検査・クリーンアップは `references/durable-state.md` を参照する。レジストリ本体の操作は次のとおり。

```bash
# REVIEW_DIR の安全検査を通した後に初期化する
touch "$REVIEW_DIR/fp-registry.md"

# 現在のエントリ数を確認
grep -c "^## FP-" "$REVIEW_DIR/fp-registry.md" 2>/dev/null || echo "0"

# エントリを追加（このファイルの「エントリフォーマット」セクションに従い追記）
```

## 前回ログからの carry-over

`references/cycle-log-format.md` の「最新エントリ」に従い、`.docs/reviews/cycles/` 内で完全 marker を持つファイルの辞書順最大を選び、その偽陽性だけを候補にする。`cycles/` が無い、または完全なファイルが無い場合だけ、legacy の `.docs/reviews/review-cycle-log.md` の末尾に最も近い完全なエントリへフォールバックする。どちらにも候補が無ければ carry-over をスキップする。

carry-over は前サイクルの学習を持ち越す高速化であってゲートではない。ログが読めない、完全な最新エントリを特定できない、エントリを解釈できないといった場合は、理由を1行記録して **carry-over をスキップし、空の FP レジストリでサイクルを開始する**（fail-open）。ここで停止するとログの破損だけでレビュー自体が回らなくなる。

一方、候補が特定できた後の「その FP を引き継ぐか」の判定は fail-closed のままとする。各候補は次の条件をすべて満たす場合だけ初期 `fp-registry.md` へ移す。

1. ログの対象 HEAD が現在のリポジトリに実在する。
   ```bash
   git cat-file -e "${logged_head}^{commit}"
   ```
2. `対象` が `N/A` でなく、有効な JSON 配列として全パスを復元でき、列挙したすべてのパスがログの対象 HEAD から現在の index / worktree までに変更されていない。
   ```bash
   git diff --name-only "${logged_head}..HEAD"
   git diff --name-only "${logged_head}"
   ```
   上記は監査用の全体一覧である。判定は引用表示へ依存せず、各対象パスについて次を実行する。
   ```bash
   git cat-file -e "${logged_head}:${target_path}"
   git diff --quiet "${logged_head}..HEAD" -- "$target_path"
   git diff --quiet "${logged_head}" -- "$target_path"
   git status --porcelain=v1 --untracked-files=all -- "$target_path"
   ```
   `cat-file` またはいずれかの `diff --quiet` が非ゼロ、または `status` が1行でも出力した場合は引き継がない。これにより committed / staged / unstaged / untracked を安全側で判定する。パスに改行がある、JSON を復元できない、またはコマンド結果を解釈できない場合も引き継がない。

コマンド失敗、出力の解釈不能、対象 HEAD 不在、`対象: N/A` はすべて「引き継がない」に倒す。引き継いだエントリの `**初出**` は `carried from {YYYY-MM-DD}` とする。ログ形式は `references/cycle-log-format.md` を参照する。
