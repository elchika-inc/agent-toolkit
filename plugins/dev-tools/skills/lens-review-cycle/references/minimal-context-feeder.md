# Minimal Context Feeder

`code-review-graph` はレビュー対象の理解を速める補助機構であり、レビューゲートそのものではない。

## 起動条件

対象ファイルにコードが1つ以上含まれる場合だけ起動する。

文章仕様だけをレビューする場合はスキップする。

## 呼び出し

全 specialist のディスパッチ前に、user スコープの MCP サーバー `code-review-graph` のツールを①②の順で各1回だけ呼ぶ。①が失敗したら②は呼ばず、fail-open フォールバックへ進む。

① graph が無ければ作り、あれば増分更新する。引数は指定しない（`full_rebuild=False`）。graph は `<repo>/.code-review-graph/graph.db` に作られ、同ディレクトリの `.gitignore` により git には現れない。

```text
mcp__code-review-graph__build_or_update_graph_tool()
```

② レビュー対象のコンテキストを取得する。

```text
mcp__code-review-graph__get_minimal_context_tool(
  task="review",
  changed_files=[レビュー対象のリポジトリ相対パス]
)
```

`repo_root` は省略し、MCP サーバーの cwd（セッションのリポジトリ）から解決する。②の `status` が `"ok"` の場合だけ、応答の `summary`・`risk`・`communities`・`flows_affected` を各 specialist のプロンプトへ次の見出しで添える。`next_tool_suggestions`・`_graph` は渡さない。

```markdown
## まず読むべき起点（code-review-graph）

- summary: {返された要約}
- risk: {返されたリスク}
- communities: {返された影響 community}
- flows_affected: {返された影響 flow}

これは読み始める起点であり、レビュー範囲の制約ではありません。必要なら他のファイルも読んでください。
```

## fail-open フォールバック

次の場合は呼び出し結果を使わず、理由を1行記録して現行のレビュー動作を継続する。

- ①の構築・更新が失敗した
- ②の `status` が `"ok"` でない（`not_ready` の `reason` が `missing_graph`・`empty_graph`・`stale_graph` のいずれでも）
- MCP サーバーが未接続
- ツール呼び出しに失敗した

記録例:

```text
code-review-graph: 構築・更新に失敗したためスキップ。現行のレビュー動作を継続する。
code-review-graph: missing_graph のためスキップ。現行のレビュー動作を継続する。
code-review-graph: empty_graph のためスキップ。現行のレビュー動作を継続する。
code-review-graph: stale_graph のためスキップ。現行のレビュー動作を継続する。
code-review-graph: MCP 未接続のためスキップ。現行のレビュー動作を継続する。
code-review-graph: ツール呼び出しに失敗したためスキップ。現行のレビュー動作を継続する。
```

この場で `full_rebuild=true` を指定したり、レビューを停止したり、起点を「これ以外は読むな」という制約へ変えたりしない。
