import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { temp } from "./helpers.mjs";
import { command, repository, listen, freePort } from "./local-helpers.mjs";
import { main } from "../scripts/reach-check.mjs";
const script = fileURLToPath(new URL("../scripts/reach-check.mjs", import.meta.url));
async function check(t, url, origin) {
  const dir = await temp(t); const out = path.join(dir,"reach.json");
  const result = await command(process.execPath, [script, "--url", url, ...origin ? ["--origin", origin] : [], "--out", out], { cwd: dir });
  return { ...result, log: JSON.parse(await fs.readFile(out,"utf8")) };
}

test("reach-check: 200 で Origin が一致 → ok true", async (t) => {
  const origin = "http://127.0.0.1:3123"; const s = await listen(t, (req,res) => { res.setHeader("Access-Control-Allow-Origin", req.headers.origin); res.end("ok"); }); const p = await check(t, s.url, origin); assert.equal(p.code, 0); assert.equal(p.log.ok, true);
});

test("reach-check: Access-Control-Allow-Origin が別のオリジン → ok false・exit 1", async (t) => {
  const s = await listen(t, (req,res) => { res.setHeader("Access-Control-Allow-Origin", "http://other.example"); res.end("ok"); }); const p = await check(t, s.url, "http://127.0.0.1:3123"); assert.equal(p.code, 1); assert.equal(p.log.ok, false);
});

test("reach-check: 応答が無い → ok false・exit 1", async (t) => {
  const p = await check(t, `http://127.0.0.1:${await freePort()}`); assert.equal(p.code, 1); assert.equal(p.log.ok, false);
});
