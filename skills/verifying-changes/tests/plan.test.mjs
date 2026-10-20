import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { planOperations } from "../scripts/lib/plan.mjs";
import { renderSummary, renderIssue } from "../scripts/lib/render.mjs";
import { fingerprint } from "../scripts/lib/fingerprint.mjs";
import { results, finding } from "./helpers.mjs";
const empty = JSON.parse(await fs.readFile(new URL("./fixtures/remote/empty.json", import.meta.url), "utf8"));
const verdict = { verdict: "approve", reasons: [] };
function setup() {
  const r = results({ findings: [finding({ base: [3, 1] })] });
  const remote = structuredClone(empty);
  const fp = fingerprint({ repo: r.repo, ...r.findings[0] });
  const issue = { number: 7, body: `<!-- verifying-changes:fp=${fp} -->`, state: "OPEN", stateReason: null, createdAt: "2026-01-01T00:00:00Z" };
  return { r, remote, issue };
}
const ops = (r, remote, published = null) => planOperations(r, verdict, remote, published);
const summary = (operations, r) => renderSummary(r, { ...verdict, ...operations.find((op) => op.op.endsWith("summary")) });

test("まとめコメントが無い → create-summary", () => {
  const { r, remote, issue } = setup(); let published = null;

  const o = ops(r, remote, published);
  assert.ok(o.some(x => x.op === "create-summary"));
});

test("kind=A の目印のコメントがある → そのコメントの id で update-summary", () => {
  const { r, remote, issue } = setup(); let published = null;
  remote.comments = [{ id: 11, body: "<!-- verifying-changes:summary kind=A -->\n本文" }];
  const o = ops(r, remote, published);
  assert.equal(o.find(x => x.op === "update-summary").commentId, 11);
});

test("kind=B の目印しか無いときの A → create-summary", () => {
  const { r, remote, issue } = setup(); let published = null;
  remote.comments = [{ id: 11, body: "<!-- verifying-changes:summary kind=B -->" }];
  const o = ops(r, remote, published);
  assert.ok(o.some(x => x.op === "create-summary"));
});

test("同じ指紋の Issue が OPEN → comment-issue（create-issue は無い）", () => {
  const { r, remote, issue } = setup(); let published = null;
  remote.issues = [issue];
  const o = ops(r, remote, published);
  assert.equal(o.find(x => x.op === "comment-issue").number, 7); assert.ok(!o.some(x => x.op === "create-issue"));
});

test("同じ指紋の Issue が REOPENED で開いている → comment-issue", () => {
  const { r, remote, issue } = setup(); let published = null;
  issue.stateReason = "REOPENED"; remote.issues = [issue];
  const o = ops(r, remote, published);
  assert.ok(o.some(x => x.op === "comment-issue"));
});

test("同じ指紋の Issue が CLOSED/COMPLETED → create-issue で本文に再発と元の番号", () => {
  const { r, remote, issue } = setup(); let published = null;
  issue.state = "CLOSED"; issue.stateReason = "COMPLETED"; remote.issues = [issue];
  const o = ops(r, remote, published);
  const op = o.find(x => x.op === "create-issue"); const body = renderIssue(op.finding, { ...op, results: r }).body; assert.match(body, /再発/); assert.match(body, /#7/);
});

test("同じ指紋の Issue が CLOSED/NOT_PLANNED → Issue の操作なし・まとめに既知（対応しない）", () => {
  const { r, remote, issue } = setup(); let published = null;
  issue.state = "CLOSED"; issue.stateReason = "NOT_PLANNED"; remote.issues = [issue];
  const o = ops(r, remote, published);
  assert.ok(!o.some(x => x.op.endsWith("issue"))); assert.match(summary(o, r), /既知（対応しない）/);
});

test("同じ指紋の Issue が CLOSED/DUPLICATE → Issue の操作なし・まとめに既知", () => {
  const { r, remote, issue } = setup(); let published = null;
  issue.state = "CLOSED"; issue.stateReason = "DUPLICATE"; remote.issues = [issue];
  const o = ops(r, remote, published);
  assert.ok(!o.some(x => x.op.endsWith("issue"))); assert.match(summary(o, r), /既知/);
});

test("同じ指紋の Issue が閉じたものと開いたもので 2 件 → 開いたものに comment-issue", () => {
  const { r, remote, issue } = setup(); let published = null;
  remote.issues = [{ ...issue, number: 8, state: "CLOSED", stateReason: "COMPLETED", createdAt: "2026-02-01" }, issue];
  const o = ops(r, remote, published);
  assert.equal(o.find(x => x.op === "comment-issue").number, 7);
});

test("新しく起票すべき発見が 7 件 → create-issue 5 件・まとめに上限で起票しなかった 2 件", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.findings = Array.from({ length: 7 }, (_, i) => finding({ id: `F${i}`, key: `異常${String.fromCharCode(65+i)}`, base: [3, 1] }));
  const o = ops(r, remote, published);
  assert.equal(o.filter(x => x.op === "create-issue").length, 5); assert.equal(o.find(x => x.op.endsWith("summary")).notices.filter(x => x.includes("上限で起票しなかった")).length, 2);
});

test("issuesComplete が false → create-issue 0 件・まとめに照合できず起票しなかった", () => {
  const { r, remote, issue } = setup(); let published = null;
  remote.issuesComplete = false;
  const o = ops(r, remote, published);
  assert.equal(o.filter(x => x.op === "create-issue").length, 0); assert.match(summary(o, r), /照合できず起票しなかった/);
});

test("A の regression → Issue の操作なし", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.findings = [finding()];
  const o = ops(r, remote, published);
  assert.ok(!o.some(x => x.op.endsWith("issue")));
});

test("B の regression → create-issue で labels に agent-verification と regression・本文に candidatePrs", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.kind = "B"; r.findings = [finding({ candidatePrs: [19, 21] })];
  const o = ops(r, remote, published);
  const op = o.find(x => x.op === "create-issue"); assert.deepEqual(op.labels, ["agent-verification", "regression"]); assert.match(renderIssue(op.finding, { ...op, results: r }).body, /#19/);
});

test("ラベル regression が無いときの B の regression → create-label regression が create-issue より前", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.kind = "B"; r.findings = [finding({ candidatePrs: [] })];
  const o = ops(r, remote, published);
  assert.ok(o.findIndex(x => x.op === "create-label" && x.name === "regression") < o.findIndex(x => x.op === "create-issue"));
});

test("ラベル agent-verification が無い → 先頭に create-label", () => {
  const { r, remote, issue } = setup(); let published = null;

  const o = ops(r, remote, published);
  assert.equal(o[0].op, "create-label"); assert.equal(o[0].name, "agent-verification");
});

test("not-reproduced と regression-flaky と incomplete → Issue の操作なし・まとめに載る", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.findings = [finding({ head: [3, 0], base: null }), finding({ id: "F2", head: [3, 1] }), finding({ id: "F3", head: [1, 1], base: null })];
  const o = ops(r, remote, published);
  assert.ok(!o.some(x => x.op.endsWith("issue"))); for (const c of ["not-reproduced", "regression-flaky", "incomplete"]) assert.ok(summary(o,r).includes(c));
});

test("C の production-observation → Issue の操作なし・まとめに載る", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.kind = "C"; r.findings = [finding({ target: "widgets", base: null })];
  const o = ops(r, remote, published);
  assert.ok(!o.some(x => x.op.endsWith("issue"))); assert.match(summary(o, r), /production-observation/);
});

test("証跡が 51 枚 → create-evidence 2 件（50 枚と 1 枚）", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.matrix[0].evidence = Array.from({ length: 51 }, (_, i) => `image-${i}.png`);
  const o = ops(r, remote, published);
  assert.deepEqual(o.filter(x => x.op === "create-evidence").map(x => x.files.length), [50, 1]);
});

test("GitHub に run=<runId> part=1 の目印のコメントがある → part 1 の create-evidence を飛ばす", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.matrix[0].evidence = ["a.png"]; remote.comments = [{ id: 1, body: `<!-- verifying-changes:evidence run=${r.runId} part=1 -->` }];
  const o = ops(r, remote, published);
  assert.ok(!o.some(x => x.op === "create-evidence"));
});

test("B → edit-body の target が 本番前の確認、C → 本番に出た後の確認", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.kind = "B";
  const o = ops(r, remote, published);
  assert.equal(o.find(x => x.op === "edit-body").target, "本番前の確認"); r.kind = "C"; assert.equal(ops(r,remote).find(x => x.op === "edit-body").target, "本番に出た後の確認");
});

test("published に summaryCommentId と evidence part 1 がある → それらを飛ばす", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.matrix[0].evidence = ["a.png"]; published = { summaryCommentId: 99, evidence: [{ part: 1, commentId: 3, urls: {} }], issues: [], bodyEdited: false };
  const o = ops(r, remote, published);
  assert.ok(!o.some(x => ["create-summary", "create-evidence"].includes(x.op))); assert.equal(o.find(x => x.op === "update-summary").commentId, 99);
});

test("操作の並びが create-label → create-evidence → create-issue/comment-issue → summary → edit-body", () => {
  const { r, remote, issue } = setup(); let published = null;
  r.kind = "B"; r.matrix[0].evidence = ["a.png"];
  const o = ops(r, remote, published);
  assert.deepEqual(o.map(x => x.op), ["create-label", "create-evidence", "create-issue", "create-summary", "edit-body"]);
});
