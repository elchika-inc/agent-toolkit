import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export async function listSessions(prefix) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "verifying-changes-sessions-"));
  try {
    const { stdout, stderr } = await promisify(execFile)("playwright-cli", ["list", "--all"], { cwd: dir, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 });
    if (stderr.trim() || /^### Error/m.test(stdout)) throw new Error("session の一覧を取得できない");
    const section = stdout.split(/^### Browser servers|^### Browsers available/m)[0];
    if (!section.includes("(no browsers)") && !section.includes("### Browsers")) throw new Error("session 一覧の形式が不明");
    return [...new Set([...section.matchAll(/^- ([^\r\n:]+):\r?\n\s+- status: open\b/gm)].map((match) => match[1]).filter((name) => name.startsWith(prefix)))];
  } catch { throw new Error("playwright-cli の全 workspace の session を確認できない"); }
  finally { await fs.rm(dir, { recursive: true, force: true }); }
}
