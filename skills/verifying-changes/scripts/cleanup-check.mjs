import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inspect, parsePorts } from "./preflight.mjs";
import { parseOptions, requireOptions, ArgumentError, writeJson, isMain } from "./lib/io.mjs";

async function browserClosed(session) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "verifying-changes-sessions-"));
  try {
    const { stdout, stderr } = await promisify(execFile)("playwright-cli", ["list", "--all"], { cwd: dir, timeout: 15_000 });
    if (stderr.trim() || /^### Error/m.test(stdout)) return false;
    return !stdout.includes(session);
  } catch { return false; }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
}
export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseOptions(argv, { preflight: "string", ports: "string", session: "string", out: "string" });
    requireOptions(options, ["preflight", "ports", "out"]);
    const before = JSON.parse(await fs.readFile(options.preflight, "utf8"));
    if (!before.head || !Array.isArray(before.secretFiles)) throw new Error("点検の記録が不正");
    // CLI に worktree 引数は無い。確認対象の worktree を cwd にして呼ぶ。
    const after = await inspect(process.cwd(), before.head, parsePorts(options.ports), before.secretFiles.map((file) => file.path));
    const result = {
      headUnchanged: after.head === before.head,
      worktreeClean: after.clean,
      secretHashesUnchanged: JSON.stringify(after.secretFiles) === JSON.stringify(before.secretFiles),
      portsReleased: after.ports.every((port) => port.listening === false),
      browserClosed: options.session ? await browserClosed(options.session) : null,
      ok: false,
    };
    result.ok = after.ok && Object.entries(result).filter(([key]) => key !== "ok").every(([, value]) => value !== false);
    await writeJson(path.resolve(options.out), result);
    console.log(`片付け: ${result.ok ? "通過" : "未通過"}`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof ArgumentError ? error.message : "片付けの確認を完了できない");
    return error instanceof ArgumentError ? 2 : 1;
  }
}
if (isMain(import.meta.url)) process.exitCode = await main();
