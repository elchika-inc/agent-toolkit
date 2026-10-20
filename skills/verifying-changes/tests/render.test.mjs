import test from "node:test";
import assert from "node:assert/strict";
import { renderSummary, renderIssue, renderEvidenceBody, replaceBodySection, extractAttachmentUrls } from "../scripts/lib/render.mjs";
import { results, finding } from "./helpers.mjs";
const r = results();
const ctx = { verdict: "approve", reasons: ["確認済み"], results: r, fp: "abcdef012345" };

test("まとめコメントの 1 行目が <!-- verifying-changes:summary kind=A -->", () => assert.equal(renderSummary(r, ctx).split("\n")[0], "<!-- verifying-changes:summary kind=A -->"));

test("まとめコメントに対象の SHA・判定と理由・Orca の Task ID が入る", () => { const text = renderSummary(r, ctx); for (const value of [r.targetSha, "承認してよい", "確認済み", r.taskId]) assert.ok(text.includes(value)); });

test("C の判定の表示が 問題なし / 失敗 / 判定できない", () => { for (const [verdict, label] of [["approve", "問題なし"], ["reject", "失敗"], ["undetermined", "判定できない"]]) assert.ok(renderSummary({ ...r, kind: "C" }, { ...ctx, verdict }).includes(label)); });

test("Issue の本文に <!-- verifying-changes:fp=<12 桁> --> と再現した SHA が入る", () => { const text = renderIssue(finding({ base: [3, 1] }), ctx).body; assert.ok(text.includes("<!-- verifying-changes:fp=abcdef012345 -->")); assert.ok(text.includes(r.baseSha)); });

test("replaceBodySection: 見出しの下に目印が無い → 次の ## の直前に挿入", () => { const text = replaceBodySection("冒頭\n## 本番前の確認\n人の行\n## 次\n後ろ\n", "本番前の確認", "B", "追加"); assert.match(text, /人の行[\s\S]*追加[\s\S]*## 次/); assert.ok(text.startsWith("冒頭\n")); });

test("replaceBodySection: 目印がある → 目印の間だけを置き換え、ほかの行は同じ", () => { const start = "冒頭\n## 本番前の確認\n人の行\n<!-- verifying-changes:B:start -->"; const end = "<!-- verifying-changes:B:end -->\n## 次\n後ろ\n"; assert.equal(replaceBodySection(start + "\n古い\n" + end, "本番前の確認", "B", "新しい"), start + "\n新しい\n" + end); });

test("replaceBodySection: 見出しが無い → null", () => assert.equal(replaceBodySection("## 別の見出し\n", "本番前の確認", "B", "内容"), null));

test("extractAttachmentUrls: ![a.png](https://github.com/user-attachments/assets/<uuid>) と <img alt=\"b.png\" src=\"…\"> の両方を拾う", () => { const a = "https://github.com/user-attachments/assets/00000000-0000-0000-0000-000000000001"; const b = "https://github.com/user-attachments/assets/00000000-0000-0000-0000-000000000002"; assert.deepEqual(extractAttachmentUrls(`![a.png](${a}) <img alt="b.png" src="${b}">`), new Map([["a.png", a], ["b.png", b]])); });
