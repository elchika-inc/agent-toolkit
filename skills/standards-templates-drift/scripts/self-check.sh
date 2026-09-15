#!/usr/bin/env bash
# 参照検査の正例・負例を実行し、終了コードと診断の有無を検証する。
set -uo pipefail

if ! script_dir=$(cd -- "${BASH_SOURCE[0]%/*}" && pwd -P); then
  printf 'self-check: スクリプトの場所を解決できない\n' >&2
  exit 1
fi
fixtures="$script_dir/../fixtures"
failed=0

check_case() {
  local label="$1" expected="$2" diagnostic="$3" output actual
  shift 3
  output=$(bash "$script_dir/check-refs.sh" "$@" 2>&1)
  actual=$?
  printf '\n== %s ==\n%s\nexit=%s（期待=%s）\n' "$label" "$output" "$actual" "$expected"
  if [ "$actual" -ne "$expected" ]; then
    printf 'FAIL: %s の終了コードが一致しない\n' "$label" >&2
    failed=1
  fi
  if [ -n "$diagnostic" ]; then
    if ! grep -E -- "$diagnostic" <<< "$output" >/dev/null; then
      printf 'FAIL: %s の診断が無い: %s\n' "$label" "$diagnostic" >&2
      failed=1
    fi
  fi
}

check_case '正例' 0 '^実在:' --standards "$fixtures/positive/standards" --templates "$fixtures/positive/templates"
check_case '負例 A: パス不在' 1 '^不在:' --standards "$fixtures/missing-path/standards" --templates "$fixtures/missing-path/templates"
check_case '負例 B: 節不在' 1 '^不在:' --standards "$fixtures/missing-section/standards" --templates "$fixtures/missing-section/templates"
check_case '負例 C: 両方向の参照なし' 2 '判定不能' --standards "$fixtures/empty/standards" --templates "$fixtures/empty/templates"
check_case 'checkout 不在' 2 '判定不能' --standards "$fixtures/does-not-exist" --templates "$fixtures/positive/templates"
check_case 'checkout がファイル' 2 '判定不能' --standards "$fixtures/positive/standards/README.md" --templates "$fixtures/positive/templates"
check_case '方向 1 のみ参照なし' 2 '判定不能' --standards "$fixtures/empty/standards" --templates "$fixtures/positive/templates"
check_case '方向 2 のみ参照なし' 2 '判定不能' --standards "$fixtures/positive/standards" --templates "$fixtures/empty/templates"
check_case '検索対象の欠落による grep エラー' 2 '判定不能' --standards "$fixtures/positive/standards" --templates "$fixtures/positive/standards"
check_case 'help' 0 '使い方' --help
check_case '引数の値なし' 2 '判定不能' --standards
check_case '未知の引数' 2 '判定不能' --unknown

STANDARDS_ROOT="$fixtures/positive/standards" TEMPLATES_ROOT="$fixtures/positive/templates" check_case '環境変数' 0 '^実在:'
STANDARDS_ROOT="$fixtures/does-not-exist" TEMPLATES_ROOT="$fixtures/does-not-exist" check_case '引数は環境変数より優先' 0 '^実在:' --standards "$fixtures/positive/standards" --templates "$fixtures/positive/templates"

if [ "$failed" -ne 0 ]; then
  printf '\nself-check: FAIL\n'
  exit 1
fi
printf '\nself-check: PASS\n'
exit 0
