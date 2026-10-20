import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { temp } from "./helpers.mjs";
import { command, repository, listen, freePort } from "./local-helpers.mjs";
import { main } from "../scripts/scan-artifacts.mjs";
const script = fileURLToPath(new URL("../scripts/scan-artifacts.mjs", import.meta.url));

test("scan-artifacts: 署名付きの URL を仕込んだファイル → exit 1・出力に jwt= も URL の本体も無い", async (t) => {
  const dir = await temp(t); const url = "https://private-user-images.githubusercontent.com/example.png?jwt=synthetic&X-Amz-Signature=synthetic"; await fs.writeFile(path.join(dir,"leak.txt"), url); const p = await command(process.execPath, [script,"--dir",dir], { cwd: dir }); assert.equal(p.code, 1); assert.match(p.stdout, /leak.txt/); assert.ok(!p.stdout.includes("jwt=")); assert.ok(!p.stdout.includes(url));
});

test("scan-artifacts: 何も無い → exit 0", async (t) => {
  const dir = await temp(t); await fs.writeFile(path.join(dir,"safe.txt"), "安全な合成データ"); const p = await command(process.execPath, [script,"--dir",dir], { cwd: dir }); assert.equal(p.code, 0);
});
