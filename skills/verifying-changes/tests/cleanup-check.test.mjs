import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { temp } from "./helpers.mjs";
import { command, repository, listen, freePort } from "./local-helpers.mjs";
import { main } from "../scripts/cleanup-check.mjs";
const script = fileURLToPath(new URL("../scripts/cleanup-check.mjs", import.meta.url));
const preflight = fileURLToPath(new URL("../scripts/preflight.mjs", import.meta.url));
async function setup(t, change) {
  const r = await repository(t); let port = await freePort();
  await fs.writeFile(path.join(r.worktree,".dev.vars"), "SYNTHETIC_VALUE=before");
  const pre = path.join(r.dir,"preflight.json"); const out = path.join(r.dir,"cleanup.json");
  assert.equal((await command(process.execPath, [preflight, "--worktree", r.worktree, "--expect-sha", r.sha, "--ports", String(port), "--out", pre], { cwd: r.worktree })).code, 0);
  port = await change(r) ?? port;
  const result = await command(process.execPath, [script, "--preflight", pre, "--ports", String(port), "--out", out], { cwd: r.worktree });
  return { ...result, log: JSON.parse(await fs.readFile(out,"utf8")) };
}

test("cleanup-check: 秘密のファイルを書き換えた → secretHashesUnchanged false・exit 1", async (t) => {
  const p = await setup(t, async r => { await fs.writeFile(path.join(r.worktree,".dev.vars"), "SYNTHETIC_VALUE=after"); }); assert.equal(p.code, 1); assert.equal(p.log.secretHashesUnchanged, false);
});

test("cleanup-check: HEAD が動いた → headUnchanged false・exit 1", async (t) => {
  const p = await setup(t, async r => { await r.git("-c", "user.name=試験", "-c", "user.email=test@example.invalid", "commit", "--allow-empty", "-m", "次"); }); assert.equal(p.code, 1); assert.equal(p.log.headUnchanged, false);
});

test("cleanup-check: 使ったポートがまだ LISTEN → portsReleased false・exit 1", async (t) => {
  const s = await listen(t); const p = await setup(t, async () => s.port); assert.equal(p.code, 1); assert.equal(p.log.portsReleased, false);
});

test("cleanup-check: 何も変わっていない → ok true・exit 0", async (t) => {
  const p = await setup(t, async () => {}); assert.equal(p.code, 0); assert.equal(p.log.ok, true); assert.equal(p.log.browserClosed, null);
});
