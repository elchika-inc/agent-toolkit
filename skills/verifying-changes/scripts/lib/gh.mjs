import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout } from "node:timers/promises";

const exec = promisify(execFile);
export class DryRunWriteError extends Error {
  constructor() { super("dry-run では GitHub に書き込めない"); this.name = "DryRunWriteError"; }
}
function isRead(args) {
  if (["issue list", "label list", "pr view", "run list"].includes(args.slice(0, 2).join(" "))) return true;
  if (args[0] !== "api" || args.includes("graphql")) return false;
  for (let i = 1; i < args.length; i++) {
    if (/^(?:-[fF]|--(?:field|raw-field|input)(?:=|$))/.test(args[i])) return false;
    if (["-X", "--method"].includes(args[i])) { if (args[++i] !== "GET") return false; }
    else if (args[i].startsWith("-X") && args[i] !== "-XGET") return false;
    else if (args[i].startsWith("--method=") && args[i] !== "--method=GET") return false;
  }
  return true;
}
export function createGh({ write, bin = process.env.VERIFYING_CHANGES_GH ?? "gh" }) {
  async function call(args) {
    try { return (await exec(bin, args, { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 })).stdout; }
    catch { throw new Error("gh の実行が失敗（応答には秘密が含まれ得るため表示しない）"); }
  }
  return {
    async read(args) {
      if (!isRead(args)) throw new Error("読み取りとして許可されていない gh の操作");
      for (let attempt = 0; ; attempt++) {
        try { return await call(args); }
        catch (error) {
          if (attempt === 2) throw error;
          console.error(`gh の読み取りを再試行: ${attempt + 1}/2`);
          await setTimeout(100 * (attempt + 1));
        }
      }
    },
    async write(args) {
      if (!write) throw new DryRunWriteError();
      // 応答を失った書き込みを盲目的に再送しない。次回の目印照合で回復する。
      return call(args);
    },
  };
}
function pages(text) {
  const arrays = [];
  let start = 0, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "[" || char === "{") depth++;
    else if (char === "]" || char === "}") {
      depth--;
      if (depth === 0) { arrays.push(JSON.parse(text.slice(start, i + 1))); start = i + 1; }
    }
  }
  if (depth !== 0 || quoted || text.slice(start).trim() || !arrays.length || arrays.some((value) => !Array.isArray(value))) throw new Error("GitHub のコメント一覧を解析できない");
  return arrays.flat();
}
export async function fetchRemote(gh, results) {
  const comments = pages(await gh.read(["api", "--paginate", `repos/${results.repo}/issues/${results.pr}/comments`]));
  const issues = JSON.parse(await gh.read(["issue", "list", "--repo", results.repo, "--label", "agent-verification", "--state", "all", "--limit", "1000", "--json", "number,state,stateReason,body,createdAt"]));
  const labels = JSON.parse(await gh.read(["label", "list", "--repo", results.repo, "--limit", "1000", "--json", "name"]));
  if (!Array.isArray(issues) || !Array.isArray(labels)) throw new Error("GitHub の一覧の形式が不正");
  const prBody = results.kind === "A" ? null : JSON.parse(await gh.read(["pr", "view", String(results.pr), "--repo", results.repo, "--json", "body"])).body;
  return { comments, issues, issuesComplete: issues.length < 1000, prBody, labels: labels.map((label) => label.name) };
}
