import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createGh, DryRunWriteError } from "../scripts/lib/gh.mjs";
import { temp } from "./helpers.mjs";
const exec = promisify(execFile);
const fake = fileURLToPath(new URL("./fixtures/fake-gh.mjs", import.meta.url));

test("api -F body=@x repos/o/r/issues/comments/1 → 書き込みに数える", async (t) => {
  const dir = await temp(t); const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [] }));
  await exec(fake, ["api", "-F", "body=@x", "repos/o/r/issues/comments/1"], { cwd: dir, env: { ...process.env, VERIFYING_CHANGES_FAKE_STATE: stateFile } });
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(state.calls[0].write, true);
});

test("api graphql -f query=… → 書き込みに数える", async (t) => {
  const dir = await temp(t); const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [] }));
  await exec(fake, ["api", "graphql", "-f", "query=query {}"], { cwd: dir, env: { ...process.env, VERIFYING_CHANGES_FAKE_STATE: stateFile } });
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(state.calls[0].write, true);
});

test("api -XPATCH repos/o/r/issues/comments/1 → 書き込みに数える", async (t) => {
  const dir = await temp(t); const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [] }));
  await exec(fake, ["api", "-XPATCH", "repos/o/r/issues/comments/1"], { cwd: dir, env: { ...process.env, VERIFYING_CHANGES_FAKE_STATE: stateFile } });
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(state.calls[0].write, true);
});

test("api --method=PATCH repos/o/r/issues/comments/1 → 書き込みに数える", async (t) => {
  const dir = await temp(t); const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [] }));
  await exec(fake, ["api", "--method=PATCH", "repos/o/r/issues/comments/1"], { cwd: dir, env: { ...process.env, VERIFYING_CHANGES_FAKE_STATE: stateFile } });
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(state.calls[0].write, true);
});

test("pr merge 1 → 書き込みに数える", async (t) => {
  const dir = await temp(t); const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [] }));
  await exec(fake, ["pr", "merge", "1"], { cwd: dir, env: { ...process.env, VERIFYING_CHANGES_FAKE_STATE: stateFile } });
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(state.calls[0].write, true);
});

test("issue close 1 → 書き込みに数える", async (t) => {
  const dir = await temp(t); const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [] }));
  await exec(fake, ["issue", "close", "1"], { cwd: dir, env: { ...process.env, VERIFYING_CHANGES_FAKE_STATE: stateFile } });
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(state.calls[0].write, true);
});

test("api --paginate repos/o/r/issues/1/comments → 読み取り", async (t) => {
  const dir = await temp(t); const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [] }));
  await exec(fake, ["api", "--paginate", "repos/o/r/issues/1/comments"], { cwd: dir, env: { ...process.env, VERIFYING_CHANGES_FAKE_STATE: stateFile } });
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(state.calls[0].write, false);
});

test("issue list --json … → 読み取り", async (t) => {
  const dir = await temp(t); const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [] }));
  await exec(fake, ["issue", "list", "--json", "number"], { cwd: dir, env: { ...process.env, VERIFYING_CHANGES_FAKE_STATE: stateFile } });
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  assert.equal(state.calls[0].write, false);
});
