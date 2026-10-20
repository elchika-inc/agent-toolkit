import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { readResults, ResultsError } from "../scripts/lib/results.mjs";
import { finding as f, results, temp } from "./helpers.mjs";
test("fixtures/results/valid-a.json → 読める", async (t) => {
  const r = results();
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  assert.deepEqual(await readResults(file), r);
});

test("headRuns が無い → ResultsError で findings[0].headRuns を名指し", async (t) => {
  const r = results(); delete r.findings[0].headRuns;
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  await assert.rejects(readResults(file), (error) => error instanceof ResultsError && error.message.includes("findings[0].headRuns"));
});

test("kind が D → ResultsError", async (t) => {
  const r = results(); r.kind = "D";
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  await assert.rejects(readResults(file), (error) => error instanceof ResultsError && error.message.includes("kind"));
});

test("schema が results-v0 → ResultsError", async (t) => {
  const r = results(); r.schema = "results-v0";
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  await assert.rejects(readResults(file), (error) => error instanceof ResultsError && error.message.includes("schema"));
});

test("cells の値が ok → ResultsError で matrix[0].cells.light を名指し", async (t) => {
  const r = results(); r.matrix[0].cells.light = "ok";
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  await assert.rejects(readResults(file), (error) => error instanceof ResultsError && error.message.includes("matrix[0].cells.light"));
});

test("fail のセルがある行の surface に発見が 1 件も無い → ResultsError で matrix[0] を名指し", async (t) => {
  const r = results(); r.matrix[0].cells.light = "fail"; r.findings = [];
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  await assert.rejects(readResults(file), (error) => error instanceof ResultsError && error.message.includes("matrix[0]"));
});

test("fail のセルの行が /services/:id/edit・発見が /services/01JABCDEFGHJKMNPQRSTVWXYZ0/edit → 読める", async (t) => {
  const r = results(); r.matrix[0].surface = "/services/:id/edit"; r.matrix[0].cells.light = "fail"; r.findings[0].surface = "/services/01JABCDEFGHJKMNPQRSTVWXYZ0/edit";
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  assert.deepEqual(await readResults(file), r);
});

test("headRuns.tried が 2・timedOut が false → ResultsError で findings[0].headRuns.tried を名指し", async (t) => {
  const r = results(); r.findings[0].headRuns = { tried: 2, occurred: 1 };
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  await assert.rejects(readResults(file), (error) => error instanceof ResultsError && error.message.includes("findings[0].headRuns.tried"));
});

test("A で baseRuns.tried が 1・timedOut が false → ResultsError で findings[0].baseRuns.tried を名指し", async (t) => {
  const r = results(); r.findings[0] = f({ base: [1, 0] });
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  await assert.rejects(readResults(file), (error) => error instanceof ResultsError && error.message.includes("findings[0].baseRuns.tried"));
});

test("headRuns.tried が 2・timedOut が true → 読める（判定は undetermined）", async (t) => {
  const r = results(); r.findings[0].headRuns = { tried: 2, occurred: 0 }; r.timedOut = true;
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  assert.deepEqual(await readResults(file), r);
});

test("A で head 0/3・baseRuns が null → 読める", async (t) => {
  const r = results();
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  assert.deepEqual(await readResults(file), r);
});

test("A で category が declaration・baseRuns が null → 読める", async (t) => {
  const r = results(); r.findings[0].category = "declaration";
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  assert.deepEqual(await readResults(file), r);
});

test("category が environment・headRuns が null → 読める", async (t) => {
  const r = results(); r.findings[0].category = "environment"; r.findings[0].headRuns = null;
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  assert.deepEqual(await readResults(file), r);
});

test("C で aborted があり headRuns.tried が 1 → 読める", async (t) => {
  const r = results(); r.kind = "C"; r.baseSha = null; r.matrix[0].cells = { status: "pass", selectors: "pass", console: "pass" }; r.aborted = { reason: "中断" }; r.findings[0].target = "widgets"; r.findings[0].headRuns = { tried: 1, occurred: 1 };
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  assert.deepEqual(await readResults(file), r);
});

test("aborted が無く headRuns.tried が 1・timedOut が false → ResultsError", async (t) => {
  const r = results(); r.findings[0].headRuns = { tried: 1, occurred: 1 };
  const file = path.join(await temp(t), "results.json");
  await fs.writeFile(file, JSON.stringify(r));
  await assert.rejects(readResults(file), (error) => error instanceof ResultsError && error.message.includes("findings[0].headRuns.tried"));
});
