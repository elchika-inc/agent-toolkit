import fs from "node:fs/promises";
import path from "node:path";
import { readResults, ResultsError } from "./lib/results.mjs";
import { decideVerdict } from "./lib/triage.mjs";
import { createGh, fetchRemote } from "./lib/gh.mjs";
import { planOperations, evidenceMarker } from "./lib/plan.mjs";
import { renderSummary, renderIssue, renderEvidenceBody, replaceBodySection, extractAttachmentUrls, verdictLabel } from "./lib/render.mjs";
import { writeJson, readOptional, parseOptions, requireOptions, ArgumentError, isMain } from "./lib/io.mjs";

async function countReruns(dir, results) {
  const counts = {};
  let entries;
  try { entries = await fs.readdir(path.join(dir, "reruns"), { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return counts; throw error; }
  for (const finding of results.findings.filter((item) => item.category === "product")) {
    counts[finding.id] = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || !new RegExp(`^${finding.id}-[1-3]$`).test(entry.name)) continue;
      const log = await readOptional(path.join(dir, "reruns", entry.name, "production-log.json"));
      if (log?.deployCheck?.ok === true && log.deployCheck.productionSha === results.targetSha && log.deployCheck.remote === `https://github.com/${results.repo}.git` && log.deployCheck.ghBin === "gh" && log.targets?.some((target) => target.name === finding.target && target.skipped === null)) counts[finding.id]++;
    }
  }
  return counts;
}
async function measure(dir, results, gh) {
  const measured = { preflight: null, reach: null, production: null, reruns: {}, pr: null };
  if (results.kind === "C") {
    measured.production = await readOptional(path.join(dir, "production-log.json"));
    measured.reruns = await countReruns(dir, results);
  } else {
    measured.preflight = await readOptional(path.join(dir, "preflight.json"));
    measured.reach = await readOptional(path.join(dir, "reach.json"));
    if (results.kind === "A") {
      const pr = JSON.parse(await gh.read(["pr", "view", String(results.pr), "--repo", results.repo, "--json", "title,labels"]));
      if (typeof pr.title !== "string" || !Array.isArray(pr.labels)) throw new Error("PR の情報の形式が不正");
      measured.pr = { title: pr.title, labels: pr.labels.map((label) => label.name) };
    }
  }
  return measured;
}
function naResults(options) {
  requireOptions(options, ["na", "repo", "pr", "kind", "sha", "out"]);
  if (!["A", "B"].includes(options.kind) || !/^[\w.-]+\/[\w.-]+$/.test(options.repo) || !/^[1-9]\d*$/.test(options.pr) || !/^[0-9a-f]{40}$/.test(options.sha)) throw new ArgumentError("N/A の引数が不正");
  return { kind: options.kind, repo: options.repo, pr: Number(options.pr), targetSha: options.sha, taskId: "N/A", runId: `na-${options.kind}-${options.pr}-${options.sha}`, matrix: [], findings: [], fixChecks: [], unverified: [] };
}
async function publish(options) {
  const results = options.na ? naResults(options) : await readResults(options.results);
  if (/private-user-images\.githubusercontent\.com|X-Amz-Signature=/i.test(JSON.stringify(results) + (options.na ?? ""))) throw new ResultsError("results", "署名付き URL を含むため書き出せない");
  const dir = path.resolve(options.na ? options.out : path.dirname(options.results));
  await fs.mkdir(path.join(dir, "rendered"), { recursive: true });
  const gh = createGh({ write: options.write === true });
  const remote = await fetchRemote(gh, results);
  const verdict = options.na ? { verdict: "undetermined", reasons: [] } : decideVerdict(results, await measure(dir, results, gh));
  const publishedFile = path.join(dir, "published.json");
  const published = await readOptional(publishedFile) ?? { summaryCommentId: null, evidence: [], issues: [], bodyEdited: false };
  // 添付作成後・チェックポイント更新前に落ちた場合も、GitHub の目印から回復する。
  for (const comment of remote.comments) {
    const match = comment.body?.split("\n")[0].match(/^<!-- verifying-changes:evidence run=([\w-]+) part=(\d+) -->$/);
    if (match?.[1] === results.runId && !published.evidence.some((item) => item.part === Number(match[2]))) published.evidence.push({ part: Number(match[2]), commentId: comment.id, urls: Object.fromEntries(extractAttachmentUrls(comment.body)) });
  }
  const operations = planOperations(results, verdict, remote, published);
  await writeJson(path.join(dir, "planned-operations.json"), operations);
  const errors = [];
  const cleanup = await readOptional(path.join(dir, "cleanup.json"));
  const summary = operations.find((op) => op.op.endsWith("summary"));
  for (const known of summary.known) if (!published.issues.some((item) => item.fp === known.fp)) published.issues.push(known);
  const context = () => ({ ...verdict, na: options.na, results, cleanup, notices: summary.notices, attachments: Object.assign({}, ...published.evidence.map((item) => item.urls)), issues: [...published.issues, ...operations.filter((op) => op.op.endsWith("issue") && !published.issues.some((item) => item.fp === op.fp)).map((op) => ({ fp: op.fp, number: op.number ?? null, action: op.op }))] });
  for (let index = 0; index < operations.length; index++) {
    const op = operations[index];
    const file = path.join(dir, "rendered", `${String(index + 1).padStart(2, "0")}-${op.op}.md`);
    try {
      let body = "", title;
      if (op.op.endsWith("summary")) body = renderSummary(results, context());
      else if (op.op === "create-evidence") body = renderEvidenceBody(results.runId, op.part);
      else if (op.op.endsWith("issue")) ({ body, title } = renderIssue(op.finding, { ...context(), ...op }));
      else if (op.op === "edit-body") {
        const link = published.summaryCommentId ? `https://github.com/${results.repo}/pull/${results.pr}#issuecomment-${published.summaryCommentId}` : "（未投稿）";
        const content = `対象 SHA: ${results.targetSha}\n判定: ${options.na ? `N/A（${options.na}）` : verdictLabel(results.kind, verdict.verdict)}\nまとめ: ${link}`;
        body = replaceBodySection(remote.prBody ?? "", op.target, results.kind, content);
        if (body === null) throw new Error("昇格 PR の見出しまたは目印が無い・不正");
      }
      if (body) await fs.writeFile(file, body, { mode: 0o600 });
      if (!options.write) continue;
      const repo = ["--repo", results.repo];
      if (op.op === "create-label") await gh.write(["label", "create", op.name, ...repo]);
      else if (op.op === "create-evidence") {
        const args = ["pr", "comment", String(results.pr), ...repo, "--body-file", file];
        const names = new Set();
        for (const relative of op.files) {
          const real = await fs.realpath(path.join(dir, relative));
          const realDir = await fs.realpath(dir);
          const name = path.basename(relative);
          if (!real.startsWith(realDir + path.sep) || names.has(name) || /[#\r\n]/.test(name)) throw new Error("添付の場所または名前が不正");
          names.add(name);
          args.push("--attach", `${real}#${name}`);
        }
        await gh.write(args);
        const refreshed = await fetchRemote(gh, results);
        const comment = refreshed.comments.find((item) => item.body?.split("\n")[0] === evidenceMarker(results.runId, op.part));
        if (!comment) throw new Error("投稿した添付の実体を取得できない");
        published.evidence.push({ part: op.part, commentId: comment.id, urls: Object.fromEntries(extractAttachmentUrls(comment.body)) });
      } else if (op.op === "create-issue") {
        const output = await gh.write(["issue", "create", ...repo, "--title", title, "--body-file", file, ...op.labels.flatMap((label) => ["--label", label])]);
        const number = Number(output.trim().match(/\/issues\/(\d+)$/)?.[1]);
        if (!number) throw new Error("作成した Issue の番号を取得できない");
        published.issues.push({ fp: op.fp, number, action: op.op });
      } else if (op.op === "comment-issue") {
        await gh.write(["issue", "comment", String(op.number), ...repo, "--body-file", file]);
        published.issues.push({ fp: op.fp, number: op.number, action: op.op });
      } else if (op.op === "create-summary") {
        const output = await gh.write(["pr", "comment", String(results.pr), ...repo, "--body-file", file]);
        const id = Number(output.trim().match(/#issuecomment-(\d+)$/)?.[1]);
        if (!id) throw new Error("作成したまとめの ID を取得できない");
        published.summaryCommentId = id;
      } else if (op.op === "update-summary") {
        await gh.write(["api", "-X", "PATCH", `repos/${results.repo}/issues/comments/${op.commentId}`, "-F", `body=@${file}`]);
        published.summaryCommentId = op.commentId;
      } else if (op.op === "edit-body") {
        await gh.write(["pr", "edit", String(results.pr), ...repo, "--body-file", file]);
        published.bodyEdited = true;
      }
      await writeJson(publishedFile, published);
    } catch (error) {
      // 失敗した操作を残し、他の Issue・まとめなど独立した操作を続ける。
      errors.push({ op: op.op, index, message: "操作が失敗した。認証・通信・入力と再開用の記録を確認する" });
      console.error(`${op.op}: 操作が失敗`);
    }
  }
  await writeJson(path.join(dir, "operation-errors.json"), errors);
  return errors.length ? 1 : 0;
}
export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseOptions(argv, { results: "string", write: "boolean", na: "string", repo: "string", pr: "string", kind: "string", sha: "string", out: "string" });
    if (Boolean(options.results) === Boolean(options.na)) throw new ArgumentError("--results か --na の一方が必要");
    return await publish(options);
  } catch (error) {
    console.error(error instanceof ResultsError || error instanceof ArgumentError ? error.message : "書き込み処理を続行できない（入力・GitHub の読み取り・保存先を確認）");
    return error instanceof ArgumentError ? 2 : 1;
  }
}
if (isMain(import.meta.url)) process.exitCode = await main();
