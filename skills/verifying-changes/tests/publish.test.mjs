import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { main } from "../scripts/publish.mjs";
import { results, finding, measured, temp } from "./helpers.mjs";
const exec = promisify(execFile);
const script = fileURLToPath(new URL("../scripts/publish.mjs", import.meta.url));
const fake = fileURLToPath(new URL("./fixtures/fake-gh.mjs", import.meta.url));
async function setup(t, change = () => {}) {
  const dir = await temp(t);
  const r = results({ findings: [finding({ base: [3, 1] })] });
  const state = JSON.parse(await fs.readFile(new URL("./fixtures/remote/empty.json", import.meta.url), "utf8"));
  const m = measured();
  change(r, state, m);
  const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify(state));
  await fs.writeFile(path.join(dir, "results.json"), JSON.stringify(r));
  for (const key of ["preflight", "reach"]) await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify(m[key]));
  const env = { ...process.env, VERIFYING_CHANGES_GH: fake, VERIFYING_CHANGES_FAKE_STATE: stateFile };
  return { dir, r, stateFile, run: async (args = []) => {
    try { return { ...await exec(process.execPath, [script, ...args.length && args[0] === "--na" ? args : ["--results", path.join(dir,"results.json"), ...args]], { cwd: dir, env }), code: 0 }; }
    catch (e) { return { stdout: e.stdout, stderr: e.stderr, code: e.code }; }
  }, read: async (name) => JSON.parse(await fs.readFile(path.join(dir,name), "utf8")) };
}

test("dry-run → fake-gh が記録した書き込みが 0 回・planned-operations.json がある・exit 0", async (t) => {
  const p = await setup(t); assert.equal((await p.run()).code, 0); assert.equal((await p.read("state.json")).calls.filter(x => x.write).length, 0); assert.ok(Array.isArray(await p.read("planned-operations.json")));
});

test("--write → まとめコメントと Issue を作り published.json を書く", async (t) => {
  const p = await setup(t); assert.equal((await p.run(["--write"])).code, 0); const s = await p.read("published.json"); assert.ok(s.summaryCommentId); assert.equal(s.issues[0].action, "create-issue");
});

test("--write を同じ runId でもう一度 → create は 0 回・まとめは update-summary", async (t) => {
  const p = await setup(t); assert.equal((await p.run(["--write"])).code, 0); let state = await p.read("state.json"); state.calls = []; await fs.writeFile(p.stateFile, JSON.stringify(state)); assert.equal((await p.run(["--write"])).code, 0); state = await p.read("state.json"); assert.ok(!state.calls.some(x => x.write && (x.args.includes("create") || x.args[0] === "pr" && x.args[1] === "comment"))); assert.ok((await p.read("planned-operations.json")).some(x => x.op === "update-summary"));
});

test("--write でまとめの作成が失敗 → ほかの操作は続け、exit 1", async (t) => {
  const p = await setup(t, (r,s) => { s.failSummary = true; r.kind = "B"; r.includedPrs = []; r.findings[0].candidatePrs = []; }); assert.equal((await p.run(["--write"])).code, 1); assert.equal((await p.read("state.json")).issues.length, 1); assert.ok((await p.read("state.json")).calls.some(x => x.args[0] === "pr" && x.args[1] === "edit"));
});

test("昇格 PR の本文に 本番前の確認 の見出しが無い → edit-body は失敗として記録・まとめは作る・exit 1", async (t) => {
  const p = await setup(t, (r,s) => { r.kind = "B"; r.includedPrs = []; r.findings[0].candidatePrs = []; s.prBody = "## 別の見出し\n人の記録"; }); assert.equal((await p.run(["--write"])).code, 1); const s = await p.read("state.json"); assert.equal(s.prBody, "## 別の見出し\n人の記録"); assert.ok(s.comments.some(x => x.body.startsWith("<!-- verifying-changes:summary"))); assert.ok((await p.read("operation-errors.json")).some(x => x.op === "edit-body"));
});

test("コメントの取得に --paginate が付く", async (t) => {
  const p = await setup(t); assert.equal((await p.run()).code, 0); assert.ok((await p.read("state.json")).calls.some(x => x.args[0] === "api" && x.args.includes("--paginate")));
});

test("preflight.json の head が targetSha と違う → まとめの判定が判定できない", async (t) => {
  const p = await setup(t, (r,s,m) => { m.preflight.head = "c".repeat(40); }); assert.equal((await p.run()).code, 0); const files = await fs.readdir(path.join(p.dir,"rendered")); const summary = await fs.readFile(path.join(p.dir,"rendered",files.find(x => x.includes("summary"))), "utf8"); assert.match(summary, /判定できない/);
});

test("A のとき gh pr view --json title,labels を読み、title が fix: で fixChecks が空 → まとめの判定が判定できない", async (t) => {
  const p = await setup(t, (r,s) => { s.pr.title = "fix: 表示を修正"; }); assert.equal((await p.run()).code, 0); assert.ok((await p.read("state.json")).calls.some(x => x.args[0] === "pr" && x.args.includes("title,labels"))); const files = await fs.readdir(path.join(p.dir,"rendered")); assert.match(await fs.readFile(path.join(p.dir,"rendered",files.find(x => x.includes("summary"))), "utf8"), /判定できない/);
});

test("--na → まとめに N/A（理由）・Issue の操作なし", async (t) => {
  const p = await setup(t); assert.equal((await p.run(["--na", "文書だけ", "--repo", "example/widget", "--pr", "17", "--kind", "A", "--sha", "a".repeat(40), "--out", p.dir])).code, 0); const ops = await p.read("planned-operations.json"); assert.ok(!ops.some(x => x.op.endsWith("issue"))); const files = await fs.readdir(path.join(p.dir,"rendered")); assert.match(await fs.readFile(path.join(p.dir,"rendered",files.find(x => x.includes("summary"))), "utf8"), /N\/A（文書だけ）/);
});

test("results.json が不正 → GitHub を 1 回も呼ばずに exit 1", async (t) => {
  const p = await setup(t, r => { delete r.findings[0].headRuns; }); assert.equal((await p.run()).code, 1); assert.equal((await p.read("state.json")).calls?.length ?? 0, 0);
});

test("まとめの作成失敗後に再開 → 本文を未完了として再編集しまとめのリンクを残す", async (t) => {
  const p = await setup(t, (r, state) => {
    state.failSummary = true;
    r.kind = "B"; r.includedPrs = []; r.findings[0].candidatePrs = [];
  });
  assert.equal((await p.run(["--write"])).code, 1);
  assert.match((await p.read("state.json")).prBody, /まとめ: （未投稿）/);
  assert.equal((await p.read("published.json")).bodyEdited, false);
  const state = await p.read("state.json");
  state.failSummary = false;
  await fs.writeFile(p.stateFile, JSON.stringify(state));
  assert.equal((await p.run(["--write"])).code, 0);
  const published = await p.read("published.json");
  assert.equal(published.bodyEdited, true);
  assert.match((await p.read("state.json")).prBody, new RegExp(`#issuecomment-${published.summaryCommentId}`));
  assert.doesNotMatch((await p.read("state.json")).prBody, /未投稿/);
});

test("結果に署名付き URL がある → GitHub を呼ばずに exit 1", async (t) => {
  for (const url of [
    "https://private-user-images.githubusercontent.com/synthetic?jwt=synthetic",
    "https://example.com/synthetic?X-Amz-Signature=synthetic",
  ]) {
    const p = await setup(t, r => { r.findings[0].actual = url; });
    const execution = await p.run(["--write"]);
    assert.equal(execution.code, 1);
    assert.equal((await p.read("state.json")).calls?.length ?? 0, 0);
    assert.ok(!execution.stderr.includes(url));
  }
});

test("再開時の実測で判定が変わる → 本文の判定も最新のまとめと一致する", async (t) => {
  const p = await setup(t, (r, state, m) => {
    r.kind = "B"; r.includedPrs = []; r.findings[0].candidatePrs = [];
    m.preflight.head = "c".repeat(40);
  });
  assert.equal((await p.run(["--write"])).code, 0);
  assert.match((await p.read("state.json")).prBody, /判定できない/);
  await fs.writeFile(path.join(p.dir, "preflight.json"), JSON.stringify(measured().preflight));
  assert.equal((await p.run(["--write"])).code, 0);
  const state = await p.read("state.json");
  assert.match(state.prBody, /判定: 承認してよい/);
  assert.doesNotMatch(state.prBody, /判定できない/);
  assert.match(state.comments.find(c => c.body.startsWith("<!-- verifying-changes:summary")).body, /判定: 承認してよい/);
});
