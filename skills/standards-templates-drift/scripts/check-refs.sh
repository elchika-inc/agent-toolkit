#!/usr/bin/env bash
# standards と templates の相互参照の実在だけを検査する。checkout は変更しない。
set -uo pipefail

usage() {
  cat <<'HELP'
使い方: bash scripts/check-refs.sh [--standards <path>] [--templates <path>]
  --standards  standards の checkout（省略時は STANDARDS_ROOT）
  --templates  templates の checkout（省略時は TEMPLATES_ROOT）
  --help       この説明を表示する
環境変数も省略した場合は ~/projects/elchika-inc/standards と
~/projects/elchika-inc/templates を使う。
終了コード: 0=両方向に参照があり不在なし、1=不在あり、2=判定不能
HELP
}

die() {
  printf '判定不能: %s\n' "$*" >&2
  exit 2
}

standards_root=${STANDARDS_ROOT:-"$HOME/projects/elchika-inc/standards"}
templates_root=${TEMPLATES_ROOT:-"$HOME/projects/elchika-inc/templates"}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --standards|--templates)
      if [ "$#" -lt 2 ] || [ -z "$2" ] || [[ "$2" == --* ]]; then
        die "$1 にはパスが必要"
      fi
      if [ "$1" = --standards ]; then
        standards_root=$2
      else
        templates_root=$2
      fi
      shift 2
      ;;
    --help)
      usage
      exit $?
      ;;
    *) die "未知の引数: $1" ;;
  esac
done

for root in "$standards_root" "$templates_root"; do
  if [ ! -d "$root" ] || [ ! -r "$root" ] || [ ! -x "$root" ]; then
    die "checkout が無い・ディレクトリでない・読み取れない: $root"
  fi
done

indeterminate=0
path_count=0
path_missing=0
section_count=0
section_missing=0
refs=''

# grep の非一致（exit 1）と処理エラーを区別し、エラー時の部分出力を集計しない。
extract_refs() {
  local result
  if refs=$(grep "$@"); then
    return 0
  else
    result=$?
    refs=''
    if [ "$result" -eq 1 ]; then
      return 0
    fi
    printf '判定不能: 参照抽出に失敗（grep exit %s、集計未完了）\n' "$result" >&2
    indeterminate=1
    return 1
  fi
}

printf '== 方向 1: standards → templates のパス ==\n'
if extract_refs -rhoE --include='*.md' --exclude-dir=.git 'templates/blob/main/[A-Za-z0-9_./-]+' -- "$standards_root"; then
  if [ -z "$refs" ]; then
    printf '判定不能: 方向 1 の参照が 0 件\n' >&2
    indeterminate=1
  else
    if ! refs=$(LC_ALL=C sort -u <<< "$refs"); then
      die '方向 1 の重複除外に失敗'
    fi
    while IFS= read -r ref; do
      path_count=$((path_count + 1))
      path=${ref#templates/blob/main/}
      if test -e "$templates_root/$path"; then
        printf '実在: %s\n' "$path"
      else
        printf '不在: %s\n' "$path"
        path_missing=$((path_missing + 1))
      fi
    done <<< "$refs"
  fi
fi
printf '参照数=%s 不在数=%s（重複除外）\n' "$path_count" "$path_missing"

printf '\n== 方向 2: templates → standards の節 ==\n'
if extract_refs -rhoE '(DOCS_OPS|AI_FIRST|ARCHITECTURE|DESIGN|PROJECT_RULES|PRODUCT_PLAYBOOK)(\.md)? ?§[0-9]+' -- "$templates_root/README.md" "$templates_root/AGENTS.md" "$templates_root/.docs" "$templates_root/_base"; then
  if [ -z "$refs" ]; then
    printf '判定不能: 方向 2 の参照が 0 件\n' >&2
    indeterminate=1
  else
    if ! refs=$(sed -E 's/\.md//; s/ ?§/ §/' <<< "$refs"); then
      die '方向 2 の正規化に失敗'
    fi
    if ! refs=$(LC_ALL=C sort -u <<< "$refs"); then
      die '方向 2 の重複除外に失敗'
    fi
    while IFS= read -r ref; do
      section_count=$((section_count + 1))
      document=${ref% §*}
      section=${ref##*§}
      document_file="$standards_root/$document.md"
      if [ ! -e "$document_file" ]; then
        printf '不在: %s\n' "$ref"
        section_missing=$((section_missing + 1))
      elif grep -nE "^## ${section}\." -- "$document_file" >/dev/null; then
        printf '実在: %s\n' "$ref"
      else
        result=$?
        if [ "$result" -eq 1 ]; then
          printf '不在: %s\n' "$ref"
          section_missing=$((section_missing + 1))
        else
          printf '判定不能: %s の見出し検索に失敗（grep exit %s）\n' "$ref" "$result" >&2
          indeterminate=1
        fi
      fi
    done <<< "$refs"
  fi
fi
printf '参照数=%s 不在数=%s（重複除外）\n' "$section_count" "$section_missing"

printf '\n合計: 参照数=%s 不在数=%s（重複除外）\n' "$((path_count + section_count))" "$((path_missing + section_missing))"
if [ "$indeterminate" -ne 0 ]; then
  printf '判定不能: 未集計・未確認の参照があり得るため、この集計で準拠と報告しない\n' >&2
  exit 2
fi
if [ "$((path_missing + section_missing))" -gt 0 ]; then
  exit 1
fi
exit 0
