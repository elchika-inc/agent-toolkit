import test from "node:test";
import assert from "node:assert/strict";
import { classifyFinding, decideVerdict } from "../scripts/lib/triage.mjs";
import { finding as f, results, measured } from "./helpers.mjs";
test("A で head 3/3・比較の相手 0/3 → regression", () => assert.equal(classifyFinding(f({ head: [3, 3], base: [3, 0] }), "A"), "regression"));

test("A で head 2/3・比較の相手 0/3 → regression-flaky", () => assert.equal(classifyFinding(f({ head: [3, 2], base: [3, 0] }), "A"), "regression-flaky"));

test("B で head 3/3・比較の相手 1/3 → pre-existing", () => assert.equal(classifyFinding(f({ head: [3, 3], base: [3, 1] }), "B"), "pre-existing"));

test("A で head 1/3・比較の相手 2/3 → pre-existing-flaky", () => assert.equal(classifyFinding(f({ head: [3, 1], base: [3, 2] }), "A"), "pre-existing-flaky"));

test("head 0/3 → not-reproduced（比較の相手は見ない）", () => assert.equal(classifyFinding(f({ head: [3, 0], base: null }), "A"), "not-reproduced"));

test("category が environment → environment", () => assert.equal(classifyFinding(f({ category: "environment", head: null, base: null }), "A"), "environment"));

test("category が declaration → declaration", () => assert.equal(classifyFinding(f({ category: "declaration", head: null, base: null }), "A"), "declaration"));

test("C で symptom が expectation・head 1/3 → production-failure", () => assert.equal(classifyFinding(f({ symptom: "expectation", head: [3, 1], base: null }), "C"), "production-failure"));

test("C で symptom が console・head 3/3 → production-failure", () => assert.equal(classifyFinding(f({ symptom: "console", base: null }), "C"), "production-failure"));

test("C で symptom が network・head 3/3 → production-failure", () => assert.equal(classifyFinding(f({ symptom: "network", base: null }), "C"), "production-failure"));

test("C で symptom が layout・head 3/3 → production-observation", () => assert.equal(classifyFinding(f({ symptom: "layout", base: null }), "C"), "production-observation"));

test("A で head 3/3・baseRuns が null → incomplete", () => assert.equal(classifyFinding(f({ base: null }), "A"), "incomplete"));

test("timedOut の結果で head 3/3・比較の相手 tried 1 occurred 0 → incomplete（regression ではない）", () => assert.equal(classifyFinding(f({ base: [1, 0] }), "A"), "incomplete"));

test("aborted の結果で head 2/3・baseRuns が null → incomplete", () => assert.equal(classifyFinding(f({ head: [2, 2], base: null }), "B"), "incomplete"));

test("C で head tried 1 → incomplete", () => assert.equal(classifyFinding(f({ head: [1, 1], base: null }), "C"), "incomplete"));

test("regression が 1 件 → reject", () => {
  const r = results(); const m = measured();
  r.findings = [f()];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "reject");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("回数のそろった regression と timedOut が両方 → reject（reject が優先）", () => {
  const r = results(); const m = measured();
  r.findings = [f()]; r.timedOut = true;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "reject");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("incomplete だけ（timedOut） → undetermined（reject ではない）", () => {
  const r = results(); const m = measured();
  r.findings = [f({ base: [1, 0] })]; r.timedOut = true;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("fixChecks で head 3 回中 1 回以上（直っていない） → reject", () => {
  const r = results(); const m = measured();
  r.fixChecks = [{ criterion: "修正", headRuns: { tried: 3, occurred: 1 }, baseRuns: { tried: 3, occurred: 3 } }];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "reject");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("fixChecks で比較の相手 0/3（再現できない） → undetermined", () => {
  const r = results(); const m = measured();
  r.fixChecks = [{ criterion: "修正", headRuns: { tried: 3, occurred: 0 }, baseRuns: { tried: 3, occurred: 0 } }];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("fixChecks の head の tried が 2（timedOut） → undetermined（reject ではない）", () => {
  const r = results(); const m = measured();
  r.fixChecks = [{ criterion: "修正", headRuns: { tried: 2, occurred: 1 }, baseRuns: { tried: 3, occurred: 3 } }]; r.timedOut = true;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("regression-flaky だけ → undetermined", () => {
  const r = results(); const m = measured();
  r.findings = [f({ head: [3, 2] })];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("successCriterion の行に skip → undetermined（宣言の経路に当たっても）", () => {
  const r = results(); const m = measured();
  r.matrix[0].cells.light = "skip"; r.unverified = [{ item: "/widgets", reason: "宣言", declaredUnverifiable: true }];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("成功基準でない行の skip だけ → approve", () => {
  const r = results(); const m = measured();
  r.matrix[0].successCriterion = false; r.matrix[0].cells.light = "skip";
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "approve");
  assert.ok(Array.isArray(decision.reasons));
});

test("A で measured.preflight.ok が false → undetermined", () => {
  const r = results(); const m = measured();
  m.preflight.ok = false;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("B で measured.preflight.head が targetSha と違う → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "B"; m.preflight.head = "c".repeat(40);
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("A で measured.preflight が null（記録が無い） → undetermined", () => {
  const r = results(); const m = measured();
  m.preflight = null;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("A で checkTypes に browser か http があり measured.reach.ok が false → undetermined", () => {
  const r = results(); const m = measured();
  m.reach.ok = false;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("A で checkTypes に browser か http があり measured.reach が null → undetermined", () => {
  const r = results(); const m = measured();
  m.reach = null;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("A で checkTypes が cli だけで measured.reach が null → reach の条件は問わない", () => {
  const r = results(); const m = measured();
  r.checkTypes = ["cli"]; m.reach = null;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "approve");
  assert.ok(Array.isArray(decision.reasons));
});

test("A で measured.pr.title が fix: で始まり fixChecks が空 → undetermined", () => {
  const r = results(); const m = measured();
  m.pr.title = "fix: 表示を直す";
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("A で measured.pr.labels に bug があり fixChecks が空 → undetermined", () => {
  const r = results(); const m = measured();
  m.pr.labels = ["bug"];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("timedOut が true → undetermined", () => {
  const r = results(); const m = measured();
  r.timedOut = true;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("aborted が null でない → undetermined", () => {
  const r = results(); const m = measured();
  r.aborted = { reason: "中断" };
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("A でマトリクスが空 → undetermined", () => {
  const r = results(); const m = measured();
  r.matrix = [];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("B でマトリクスが空 → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "B"; r.matrix = [];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で preflight と reach が null・production が正常 → 点検の条件を問わず approve", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.preflight = null; m.reach = null;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "approve");
  assert.ok(Array.isArray(decision.reasons));
});

test("C で measured.production が null → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production = null;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で production.deployCheck.ok が false → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production.deployCheck.ok = false;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で production.deployCheck.productionSha が targetSha と違う → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production.deployCheck.productionSha = "c".repeat(40);
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で production.guardSelfCheck のどれかが false → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production.guardSelfCheck.mutationBlocked = false;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で production.targets がすべて skipped → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production.targets[0].skipped = "上限";
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で production.targets が空 → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production.targets = [];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で production.deployCheck.remote が既定と違う → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production.deployCheck.remote = "/tmp/example";
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で production.deployCheck.ghBin が gh でない → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production.deployCheck.ghBin = "fake-gh";
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で発見の headRuns.tried が 3・measured.reruns のその発見が 2 → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; r.findings = [f({ base: null, target: "widgets" })]; m.reruns.F1 = 2;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で発見の headRuns.tried が 3・measured.reruns のその発見が 3 → 回数の条件は満たす", () => {
  const r = results(); const m = measured();
  r.kind = "C"; r.findings = [f({ base: null, target: "widgets" })];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "approve");
  assert.ok(Array.isArray(decision.reasons));
});

test("C で production.budgetExceeded が true → undetermined", () => {
  const r = results(); const m = measured();
  r.kind = "C"; m.production.budgetExceeded = true;
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "undetermined");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("pre-existing と not-reproduced だけ → approve", () => {
  const r = results(); const m = measured();
  r.findings = [f({ base: [3, 1] }), f({ head: [3, 0], base: null, id: "F2" })];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "approve");
  assert.ok(Array.isArray(decision.reasons));
});

test("C で production-failure が 1 件 → reject", () => {
  const r = results(); const m = measured();
  r.kind = "C"; r.findings = [f({ symptom: "expectation", base: null, target: "widgets" })];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "reject");
  assert.ok(Array.isArray(decision.reasons));
  assert.ok(decision.reasons.length > 0);
});

test("C で production-observation だけ → approve", () => {
  const r = results(); const m = measured();
  r.kind = "C"; r.findings = [f({ base: null, target: "widgets" })];
  const decision = decideVerdict(r, m);
  assert.equal(decision.verdict, "approve");
  assert.ok(Array.isArray(decision.reasons));
});

for (const category of ["environment", "declaration"]) {
  test(`点検を通過し ${category} の分類だけがある → approve`, () => {
    const r = results();
    r.findings = [f({ category, head: null, base: null })];
    assert.deepEqual(decideVerdict(r, measured()), { verdict: "approve", reasons: [] });
  });
}

test("regression と production-failure → 日本語の判定理由が残る", () => {
  for (const kind of ["A", "C"]) {
    const r = results();
    r.kind = kind;
    r.findings = [f({ symptom: "expectation", ...(kind === "C" ? { base: null, target: "widgets" } : {}) })];
    const decision = decideVerdict(r, measured());
    assert.equal(decision.verdict, "reject");
    assert.match(decision.reasons[0], /[\u3040-\u30ff\u4e00-\u9fff]/);
  }
});
