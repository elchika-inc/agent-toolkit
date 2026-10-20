export function classifyFinding(finding, kind) {
  if (finding.category !== "product") return finding.category;
  const { headRuns: head, baseRuns: base } = finding;
  if (!head || head.tried !== 3) return "incomplete";
  if (head.occurred === 0) return "not-reproduced";
  if (kind === "C") {
    return ["expectation", "console", "network"].includes(finding.symptom)
      ? "production-failure" : "production-observation";
  }
  if (!base || base.tried !== 3) return "incomplete";
  const classification = base.occurred > 0 ? "pre-existing" : "regression";
  return classification + (head.occurred < 3 ? "-flaky" : "");
}

export function decideVerdict(results, measured) {
  const rejected = [];
  const unknown = [];
  for (const finding of results.findings) {
    const classification = classifyFinding(finding, results.kind);
    if (classification === "regression") rejected.push(`${finding.id}: 今回の変更で毎回再現する問題`);
    if (classification === "production-failure") rejected.push(`${finding.id}: 本番で期待との違い・console・通信の失敗を再現`);
    if (["incomplete", "regression-flaky"].includes(classification)) unknown.push(`${finding.id}: ${classification} のため判定できない`);
  }
  for (const fix of results.fixChecks) {
    if (fix.headRuns?.tried !== 3 || fix.baseRuns?.tried !== 3) {
      unknown.push(`${fix.criterion}: 修正の比較回数が不足`);
    } else {
      if (fix.headRuns.occurred > 0) rejected.push(`${fix.criterion}: 直したはずの症状が head で再現`);
      if (fix.baseRuns.occurred === 0) unknown.push(`${fix.criterion}: 比較の相手で再現しない`);
    }
  }
  if (!results.matrix.length) unknown.push("マトリクスが空");
  for (const row of results.matrix) {
    if (row.successCriterion && Object.values(row.cells).includes("skip")) unknown.push(`${row.surface}: 成功基準の未確認`);
  }
  if (results.timedOut) unknown.push("時間の上限に到達");
  if (results.aborted !== null) unknown.push(`途中で中断: ${results.aborted.reason}`);
  if (results.kind !== "C") {
    if (measured.preflight?.ok !== true) unknown.push("点検が未通過");
    if (measured.preflight?.head !== results.targetSha) unknown.push("点検の HEAD と対象の SHA が不一致");
    if (results.checkTypes.some((type) => ["browser", "http"].includes(type)) && measured.reach?.ok !== true) unknown.push("到達の確認が未通過");
    if (results.kind === "A") {
      if (!measured.pr) unknown.push("PR の情報を取得できない");
      const bugfix = /^fix[:(]/.test(measured.pr?.title ?? "") || measured.pr?.labels.includes("bug");
      if (bugfix && !results.fixChecks.length) unknown.push("バグ修正の PR に修正の比較が無い");
    }
  } else {
    const production = measured.production;
    if (production?.deployCheck?.ok !== true) unknown.push("本番の SHA の確認が未通過");
    if (production?.deployCheck?.productionSha !== results.targetSha) unknown.push("本番の SHA と対象の SHA が不一致");
    if (production?.deployCheck?.remote !== `https://github.com/${results.repo}.git` || production?.deployCheck?.ghBin !== "gh") unknown.push("本番の確認に試験用の差し替えがある");
    if (!["postBlocked", "mutationBlocked", "getAllowed"].every((key) => production?.guardSelfCheck?.[key] === true)) unknown.push("通信の見張りの自己確認が未通過");
    if (!production?.targets?.length || production.targets.every((target) => target.skipped !== null)) unknown.push("本番の対象を一つも確かめられていない");
    if (production?.budgetExceeded) unknown.push("本番の確認が時間の上限に到達");
    for (const finding of results.findings.filter((item) => item.category === "product")) {
      if ((measured.reruns?.[finding.id] ?? 0) !== finding.headRuns?.tried) unknown.push(`${finding.id}: 本番のやり直しの実測回数が不一致`);
    }
  }
  return { verdict: rejected.length ? "reject" : unknown.length ? "undetermined" : "approve", reasons: [...rejected, ...unknown] };
}
