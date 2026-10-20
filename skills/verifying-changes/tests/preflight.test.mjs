import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { temp } from "./helpers.mjs";
import { command, repository, listen, freePort } from "./local-helpers.mjs";
import { main } from "../scripts/preflight.mjs";
const script = fileURLToPath(new URL("../scripts/preflight.mjs", import.meta.url));
async function setup(t, change = async () => {}) {
  const r = await repository(t); const port = await freePort();
  const out = path.join(r.dir, "preflight.json");
  const context = { ...r, port, out, expect: r.sha, env: process.env };
  await change(context);
  const run = await command(process.execPath, [script, "--worktree", r.worktree, "--expect-sha", context.expect, "--ports", String(context.port), "--out", out], { cwd: r.dir, env: context.env });
  return { ...context, ...run, log: JSON.parse(await fs.readFile(out, "utf8")) };
}

test("clean・HEAD 一致・空いたポート → ok true・exit 0", async (t) => {
  const p = await setup(t); assert.equal(p.code, 0); assert.equal(p.log.ok, true);
});

test("HEAD が --expect-sha と違う → headMatches false・ok false・exit 1", async (t) => {
  const p = await setup(t, async c => { c.expect = "e".repeat(40); }); assert.equal(p.code, 1); assert.equal(p.log.headMatches, false); assert.equal(p.log.ok, false);
});

test("LISTEN しているポート → ok false・exit 1", async (t) => {
  const s = await listen(t); const p = await setup(t, async c => { c.port = s.port; }); assert.equal(p.code, 1); assert.equal(p.log.ok, false);
});

test("worktree に未コミットの変更 → ok false・exit 1", async (t) => {
  const p = await setup(t, async c => fs.writeFile(path.join(c.worktree,"untracked.txt"), "変更")); assert.equal(p.code, 1); assert.equal(p.log.ok, false);
});

test("無視されている .dev.vars と .env.local を自動で拾い sha256 を記録する", async (t) => {
  const p = await setup(t, async c => { for (const file of [".dev.vars", ".env.local"]) await fs.writeFile(path.join(c.worktree,file), "SYNTHETIC_VALUE=example-value"); }); assert.deepEqual(p.log.secretFiles.map(x => x.path).sort(), [".dev.vars", ".env.local"]); for (const file of p.log.secretFiles) assert.match(file.sha256, /^[0-9a-f]{64}$/);
});

test("秘密のファイルの中身の文字列が stdout にも出力のファイルにも無く、sha256 はある", async (t) => {
  const secret = "SYNTHETIC_VALUE=never-display-example"; const p = await setup(t, async c => fs.writeFile(path.join(c.worktree,".dev.vars"), secret)); assert.ok(!p.stdout.includes(secret)); assert.ok(!p.stderr.includes(secret)); assert.ok(!JSON.stringify(p.log).includes(secret)); assert.match(p.log.secretFiles[0].sha256, /^[0-9a-f]{64}$/);
});

test("lsof の代わりに exit 2 を返す偽物を PATH に置く → ok false・理由に lsof", async (t) => {
  const p = await setup(t, async c => { const bin = path.join(c.dir,"bin"); await fs.mkdir(bin); await fs.writeFile(path.join(bin,"lsof"), "#!/bin/sh\nexit 2\n", { mode: 0o755 }); c.env = { ...process.env, PATH: `${bin}:${process.env.PATH}` }; }); assert.equal(p.code, 1); assert.equal(p.log.ok, false); assert.match(p.log.reasons.join(" "), /lsof/);
});
