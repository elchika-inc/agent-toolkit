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

async function withGhState(t, check) {
  const dir = await temp(t);
  const stateFile = path.join(dir, "state.json");
  await fs.writeFile(stateFile, JSON.stringify({ comments: [], issues: [], labels: [], calls: [] }));
  const env = { VERIFYING_CHANGES_GH: fake, VERIFYING_CHANGES_FAKE_STATE: stateFile };
  const saved = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    await check(createGh({ write: false }), async () => JSON.parse(await fs.readFile(stateFile, "utf8")));
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("createGh が dry-run で write を呼ばれる → DryRunWriteError・fake の呼び出し 0 回", async (t) => {
  await withGhState(t, async (gh, state) => {
    await assert.rejects(gh.write(["pr", "merge", "17"]), DryRunWriteError);
    assert.equal((await state()).calls.length, 0);
  });
});

test("createGh.read に書き込み系の引数 → 拒否して fake を呼ばない", async (t) => {
  await withGhState(t, async (gh, state) => {
    assert.deepEqual(JSON.parse(await gh.read(["issue", "list"])), []);
    assert.equal((await state()).calls.length, 1);
    for (const args of [
      ["pr", "merge", "17"],
      ["issue", "close", "17"],
      ["api", "-F", "body=@synthetic", "repos/example/widget/issues/comments/1"],
      ["api", "graphql", "-f", "query=query {}"],
      ["api", "-XPATCH", "repos/example/widget/issues/comments/1"],
      ["api", "--method=PATCH", "repos/example/widget/issues/comments/1"],
    ]) await assert.rejects(gh.read(args), /読み取りとして許可されていない/);
    assert.equal((await state()).calls.length, 1);
  });
});
