import { fingerprint } from "./fingerprint.mjs";
import { classifyFinding } from "./triage.mjs";

export const summaryMarker = (kind) => `<!-- verifying-changes:summary kind=${kind} -->`;
export const evidenceMarker = (runId, part) => `<!-- verifying-changes:evidence run=${runId} part=${part} -->`;
export function planOperations(results, verdict, remote, published) {
  const labels = [], evidence = [], issues = [], notices = [], known = [];
  const files = [...new Set([...results.matrix.flatMap((row) => row.evidence), ...results.findings.flatMap((finding) => finding.evidence)])];
  for (let i = 0; i < files.length; i += 50) {
    const part = i / 50 + 1;
    if (published?.evidence.some((item) => item.part === part) || remote.comments.some((comment) => comment.body?.split("\n")[0] === evidenceMarker(results.runId, part))) continue;
    evidence.push({ op: "create-evidence", part, files: files.slice(i, i + 50) });
  }
  const seen = new Set(published?.issues.map((item) => item.fp) ?? []);
  let created = published?.issues.filter((item) => item.action === "create-issue").length ?? 0;
  for (const finding of results.findings) {
    const classification = classifyFinding(finding, results.kind);
    const eligible = ["pre-existing", "pre-existing-flaky", "declaration", "production-failure"].includes(classification) || results.kind === "B" && classification === "regression";
    if (!eligible) continue;
    const fp = fingerprint({ repo: results.repo, ...finding });
    if (seen.has(fp)) continue;
    seen.add(fp);
    const matches = remote.issues.filter((issue) => issue.body?.includes(`<!-- verifying-changes:fp=${fp} -->`));
    matches.sort((a, b) => Number(b.state === "OPEN") - Number(a.state === "OPEN") || Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.number - a.number);
    const existing = matches[0];
    if (existing?.state === "OPEN") {
      issues.push({ op: "comment-issue", number: existing.number, fp, finding, classification });
      continue;
    }
    if (existing && existing.stateReason !== "COMPLETED") {
      const reason = existing.stateReason === "NOT_PLANNED" ? "既知（対応しない）" : "既知";
      notices.push(`${finding.id}: ${reason} #${existing.number}`);
      known.push({ fp, number: existing.number, action: "known" });
      continue;
    }
    if (!remote.issuesComplete) { notices.push(`${finding.id}: 照合できず起票しなかった`); continue; }
    if (created >= 5) { notices.push(`${finding.id}: 上限で起票しなかった`); continue; }
    created++;
    const issueLabels = ["agent-verification", ...(results.kind === "B" && classification === "regression" ? ["regression"] : [])];
    issues.push({ op: "create-issue", fp, finding, classification, labels: issueLabels, recurrence: existing?.number ?? null });
  }
  for (const name of new Set(issues.flatMap((issue) => issue.labels ?? []))) {
    if (!remote.labels.includes(name)) labels.push({ op: "create-label", name });
  }
  const existingSummary = remote.comments.filter((comment) => comment.body?.split("\n")[0] === summaryMarker(results.kind)).sort((a, b) => b.id - a.id)[0];
  const commentId = existingSummary?.id ?? published?.summaryCommentId;
  const summary = { op: commentId ? "update-summary" : "create-summary", ...(commentId ? { commentId } : {}), ...verdict, notices, known };
  const body = results.kind === "A" || published?.bodyEdited ? [] : [{ op: "edit-body", target: results.kind === "B" ? "本番前の確認" : "本番に出た後の確認" }];
  return [...labels, ...evidence, ...issues, summary, ...body];
}
