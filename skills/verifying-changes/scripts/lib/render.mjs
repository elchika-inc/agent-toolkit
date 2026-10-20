import path from "node:path";
import { classifyFinding } from "./triage.mjs";
import { summaryMarker, evidenceMarker } from "./plan.mjs";
import { redact } from "./io.mjs";

const plain = (value) => redact(value).replaceAll("|", "\\|").replace(/[\r\n]+/g, " ");
export function verdictLabel(kind, verdict) {
  return (kind === "C" ? { approve: "問題なし", reject: "失敗", undetermined: "判定できない" } : { approve: "承認してよい", reject: "承認しない", undetermined: "判定できない" })[verdict];
}
function evidenceLinks(files, attachments = {}) {
  return files.map((file) => {
    const url = attachments instanceof Map ? attachments.get(path.basename(file)) : attachments[path.basename(file)];
    return url ? `[${plain(file)}](${url})` : `${plain(file)}（未投稿）`;
  }).join(" / ");
}
export function renderSummary(results, ctx) {
  const lines = [summaryMarker(results.kind), "", `対象 SHA: ${results.targetSha}`, `判定: ${ctx.na ? `N/A（${plain(ctx.na)}）` : verdictLabel(results.kind, ctx.verdict)}`, `Orca Task ID: ${results.taskId}`];
  for (const reason of ctx.reasons ?? []) lines.push(`- ${plain(reason)}`);
  lines.push("", "## マトリクス", "", "| 場所 | 成功基準 | 結果 | 証跡 |", "|---|---|---|---|");
  for (const row of results.matrix) lines.push(`| ${plain(row.surface)} | ${row.successCriterion ? "はい" : "いいえ"} | ${Object.entries(row.cells).map(([key, value]) => `${plain(key)}: ${value}`).join(" / ")}${row.skipReason ? ` (${plain(row.skipReason)})` : ""} | ${evidenceLinks(row.evidence, ctx.attachments)} |`);
  lines.push("", "## 発見", "");
  for (const finding of results.findings) lines.push(`- ${finding.id}: ${plain(finding.title)} — ${classifyFinding(finding, results.kind)} / ${plain(finding.surface)} / head ${runs(finding.headRuns)} / 比較 ${runs(finding.baseRuns)} / ${evidenceLinks(finding.evidence, ctx.attachments)}`);
  lines.push("", "## 修正の比較", "");
  for (const fix of results.fixChecks) lines.push(`- ${plain(fix.criterion)}: head ${runs(fix.headRuns)} / 比較 ${runs(fix.baseRuns)}`);
  lines.push("", "## 確かめなかったこと", "");
  for (const item of results.unverified) lines.push(`- ${plain(item.item)}: ${plain(item.reason)}（宣言済み: ${item.declaredUnverifiable ? "はい" : "いいえ"}）`);
  lines.push("", "## Issue", "");
  for (const issue of ctx.issues ?? []) lines.push(`- ${issue.fp}: ${issue.number ? `[#${issue.number}](https://github.com/${results.repo}/issues/${issue.number})` : "（未起票）"} / ${issue.action}`);
  for (const notice of ctx.notices ?? []) lines.push(`- ${plain(notice)}`);
  lines.push("", "## 片付け", "");
  const failed = Object.entries(ctx.cleanup ?? {}).filter(([, value]) => value === false).map(([key]) => key);
  lines.push(ctx.cleanup ? failed.length ? `未通過: ${failed.join(", ")}` : "false の項目なし" : "片付けの記録なし");
  return lines.join("\n") + "\n";
}
const runs = (value) => value ? `${value.occurred}/${value.tried}` : "未実施";
export function renderIssue(finding, ctx) {
  const classification = ctx.classification ?? classifyFinding(finding, ctx.results.kind);
  const reproducedSha = classification.startsWith("pre-existing") ? ctx.results.baseSha : ctx.results.targetSha;
  const lines = [`<!-- verifying-changes:fp=${ctx.fp} -->`, "", `分類: ${classification}`, `再現した SHA: ${reproducedSha}`, `確認した PR: #${ctx.results.pr}`, `場所: ${plain(finding.surface)}`, `重さ: ${plain(finding.severity)}`, `Orca Task ID: ${ctx.results.taskId}`, `head: ${runs(finding.headRuns)} / 比較: ${runs(finding.baseRuns)}`, "", "## 手順", "", ...finding.steps.map((step, i) => `${i + 1}. ${plain(step)}`), "", `期待: ${plain(finding.expected)}`, `実際: ${plain(finding.actual)}`, "", evidenceLinks(finding.evidence, ctx.attachments)];
  if (ctx.recurrence) lines.push(`再発: 元の Issue #${ctx.recurrence}`);
  if (finding.candidatePrs?.length) lines.push(`原因の候補（未確定）: ${finding.candidatePrs.map((n) => `#${n}`).join(", ")}`);
  return { title: `${ctx.recurrence ? "[再発] " : ""}${classification.endsWith("-flaky") ? "[不安定] " : ""}${plain(finding.title)}`, body: lines.join("\n") + "\n" };
}
export function renderEvidenceBody(runId, part) {
  return `${evidenceMarker(runId, part)}\n\n確認済みの証跡（${part}）\n`;
}
export function replaceBodySection(body, heading, kind, content) {
  const lines = body.split("\n");
  const index = lines.findIndex((line) => line.trimEnd() === `## ${heading}`);
  if (index < 0) return null;
  const startOffset = lines.slice(0, index + 1).join("\n").length;
  const nextIndex = lines.findIndex((line, i) => i > index && /^## /.test(line));
  const endOffset = nextIndex < 0 ? body.length : lines.slice(0, nextIndex).join("\n").length + 1;
  const section = body.slice(startOffset, endOffset);
  const start = `<!-- verifying-changes:${kind}:start -->`;
  const end = `<!-- verifying-changes:${kind}:end -->`;
  const a = section.indexOf(start), b = section.indexOf(end);
  if ((a < 0) !== (b < 0) || a >= 0 && b < a) return null;
  if (a >= 0) return body.slice(0, startOffset + a + start.length) + `\n${content}\n` + body.slice(startOffset + b);
  return body.slice(0, endOffset) + `${body.slice(0, endOffset).endsWith("\n") ? "" : "\n"}\n${start}\n${content}\n${end}\n\n` + body.slice(endOffset);
}
export function extractAttachmentUrls(body) {
  const urls = new Map();
  const accept = (name, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" && parsed.host === "github.com" && parsed.pathname.startsWith("/user-attachments/assets/") && !parsed.search) urls.set(name, url);
    } catch { /* 添付ではない文字列は採用しない。 */ }
  };
  for (const match of body.matchAll(/!\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)) accept(match[1], match[2]);
  for (const match of body.matchAll(/<img\b[^>]*>/gi)) {
    const alt = match[0].match(/\balt=["']([^"']*)["']/i);
    const src = match[0].match(/\bsrc=["']([^"']*)["']/i);
    if (alt && src) accept(alt[1], src[1]);
  }
  return urls;
}
