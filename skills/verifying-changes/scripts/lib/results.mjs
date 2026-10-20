import { readFile } from "node:fs/promises";
import { normalizeSurface } from "./fingerprint.mjs";

export class ResultsError extends Error {
  constructor(location, reason) {
    super(`${location}: ${reason}`);
    this.name = "ResultsError";
  }
}
const fail = (location, reason) => { throw new ResultsError(location, reason); };
const object = (value, location) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(location, "オブジェクトが必要");
};
const string = (value, location) => {
  if (typeof value !== "string" || !value.trim()) fail(location, "空でない文字列が必要");
};
const boolean = (value, location) => {
  if (typeof value !== "boolean") fail(location, "真偽値が必要");
};
const oneOf = (value, options, location) => {
  if (!options.includes(value)) fail(location, "許されていない値");
};
const array = (value, location, check) => {
  if (!Array.isArray(value)) fail(location, "配列が必要");
  value.forEach((item, index) => check(item, `${location}[${index}]`));
};
const strings = (value, location) => array(value, location, string);
const sha = (value, location) => {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/.test(value)) fail(location, "40 桁の SHA が必要");
};
const positiveInteger = (value, location) => {
  if (!Number.isSafeInteger(value) || value < 1) fail(location, "正の整数が必要");
};
const relativePath = (value, location) => {
  string(value, location);
  if (value.startsWith("/") || value.includes("\\") || value.split("/").includes("..")) fail(location, "置き場の中の相対パスが必要");
};

export async function readResults(path) {
  let result;
  try { result = JSON.parse(await readFile(path, "utf8")); }
  catch { fail("results", "JSON ファイルを読めない"); }
  object(result, "results");
  oneOf(result.schema, ["verifying-changes/results-v1"], "schema");
  oneOf(result.kind, ["A", "B", "C"], "kind");
  string(result.repo, "repo");
  if (!/^[\w.-]+\/[\w.-]+$/.test(result.repo)) fail("repo", "owner/name が必要");
  positiveInteger(result.pr, "pr");
  sha(result.targetSha, "targetSha");
  if (result.kind === "C") oneOf(result.baseSha, [null], "baseSha");
  else sha(result.baseSha, "baseSha");
  for (const key of ["runId", "taskId"]) {
    string(result[key], key);
    if (!/^[\w-]+$/.test(result[key])) fail(key, "英数字・ハイフン・下線だけが使用可能");
  }
  for (const key of ["startedAt", "finishedAt"]) {
    string(result[key], key);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(result[key]) || !Number.isFinite(Date.parse(result[key]))) fail(key, "ISO 8601 の日時が必要");
  }
  if (Date.parse(result.finishedAt) < Date.parse(result.startedAt)) fail("finishedAt", "開始より前");
  array(result.checkTypes, "checkTypes", (value, loc) => oneOf(value, ["browser", "http", "cli"], loc));
  if (!result.checkTypes.length) fail("checkTypes", "確認の種類が必要");
  object(result.environment, "environment");
  strings(result.environment.urls, "environment.urls");
  strings(result.environment.tools, "environment.tools");
  string(result.environment.viewport, "environment.viewport");
  boolean(result.timedOut, "timedOut");
  if (result.aborted !== null) {
    object(result.aborted, "aborted");
    string(result.aborted.reason, "aborted.reason");
  }
  const partial = result.timedOut || result.aborted !== null;
  function runs(value, location, required) {
    if (value === null) {
      if (required && !partial) fail(location, "再現回数が必要");
      return;
    }
    object(value, location);
    for (const key of ["tried", "occurred"]) {
      if (!Number.isInteger(value[key]) || value[key] < 0 || value[key] > 3) fail(`${location}.${key}`, "0〜3 の整数が必要");
    }
    if (value.occurred > value.tried) fail(`${location}.occurred`, "試行回数を超えている");
    if (required && !partial && value.tried !== 3) fail(`${location}.tried`, "見つけた回とは別に 3 回が必要");
  }
  const ids = new Set();
  array(result.findings, "findings", (finding, loc) => {
    object(finding, loc);
    for (const key of ["id", "title", "surface", "key", "severity", "expected", "actual"]) string(finding[key], `${loc}.${key}`);
    if (!/^[\w-]+$/.test(finding.id) || ids.has(finding.id)) fail(`${loc}.id`, "一意の安全な識別子が必要");
    ids.add(finding.id);
    oneOf(finding.category, ["product", "environment", "declaration"], `${loc}.category`);
    oneOf(finding.symptom, ["console", "network", "layout", "a11y", "keyboard", "behavior", "expectation", "declaration"], `${loc}.symptom`);
    strings(finding.steps, `${loc}.steps`);
    array(finding.evidence, `${loc}.evidence`, relativePath);
    runs(finding.headRuns, `${loc}.headRuns`, finding.category === "product");
    runs(finding.baseRuns, `${loc}.baseRuns`, finding.category === "product" && result.kind !== "C" && finding.headRuns?.occurred > 0);
    if (result.kind === "B") array(finding.candidatePrs, `${loc}.candidatePrs`, positiveInteger);
    if (result.kind === "C" && finding.category === "product") string(finding.target, `${loc}.target`);
    try { normalizeSurface(finding.surface); } catch { fail(`${loc}.surface`, "場所を解析できない"); }
  });
  array(result.matrix, "matrix", (row, loc) => {
    object(row, loc);
    string(row.surface, `${loc}.surface`);
    boolean(row.successCriterion, `${loc}.successCriterion`);
    object(row.cells, `${loc}.cells`);
    if (!Object.keys(row.cells).length) fail(`${loc}.cells`, "セルが必要");
    for (const [key, value] of Object.entries(row.cells)) oneOf(value, ["pass", "fail", "skip"], `${loc}.cells.${key}`);
    if (result.kind === "C") for (const key of ["status", "selectors", "console"]) oneOf(row.cells[key], ["pass", "fail", "skip"], `${loc}.cells.${key}`);
    if (row.skipReason !== null) string(row.skipReason, `${loc}.skipReason`);
    array(row.evidence, `${loc}.evidence`, relativePath);
    let surface;
    try { surface = normalizeSurface(row.surface); } catch { fail(`${loc}.surface`, "場所を解析できない"); }
    if (Object.values(row.cells).includes("fail") && !result.findings.some((finding) => normalizeSurface(finding.surface) === surface)) fail(loc, "fail に対応する発見が無い");
  });
  array(result.fixChecks, "fixChecks", (fix, loc) => {
    object(fix, loc);
    string(fix.criterion, `${loc}.criterion`);
    runs(fix.headRuns, `${loc}.headRuns`, true);
    runs(fix.baseRuns, `${loc}.baseRuns`, true);
  });
  if (result.kind !== "A" && result.fixChecks.length) fail("fixChecks", "A だけで使用可能");
  if (result.kind === "B") array(result.includedPrs, "includedPrs", (pr, loc) => {
    object(pr, loc); positiveInteger(pr.number, `${loc}.number`); strings(pr.files, `${loc}.files`);
  });
  array(result.unverified, "unverified", (item, loc) => {
    object(item, loc); string(item.item, `${loc}.item`); string(item.reason, `${loc}.reason`); boolean(item.declaredUnverifiable, `${loc}.declaredUnverifiable`);
  });
  object(result.cleanup, "cleanup");
  boolean(result.cleanup.browserClosed, "cleanup.browserClosed");
  return result;
}
