import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseOptions, requireOptions, ArgumentError, writeJson, isMain } from "./lib/io.mjs";

const exec = promisify(execFile);
export function parsePorts(value) {
  const ports = value.split(",").map(Number);
  if (ports.some((port) => !Number.isInteger(port) || port < 1 || port > 65535)) throw new ArgumentError("ポートは 1〜65535");
  return [...new Set(ports)];
}
export async function inspectPorts(ports) {
  const reasons = [];
  const measured = [];
  for (const port of ports) {
    let result;
    try { result = { ...await exec("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { timeout: 10_000 }), code: 0 }; }
    catch (error) { result = { code: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }; }
    if (result.stderr.trim() || ![0, 1].includes(result.code) || result.code === 1 && result.stdout.trim() || result.code === 0 && !result.stdout.trim()) {
      measured.push({ port, listening: null });
      reasons.push(`ポート ${port}: lsof による確認ができない`);
    } else {
      const listening = result.code === 0;
      measured.push({ port, listening });
      if (listening) reasons.push(`ポート ${port}: LISTEN 中`);
    }
  }
  return { ports: measured, reasons };
}
function validateSecretPaths(names) {
  for (const name of names) {
    if (!name || path.isAbsolute(name) || name.split(/[\\/]/).includes("..")) throw new ArgumentError("秘密のファイルは worktree 内の相対パスで指定");
  }
  return names;
}
export async function secretFiles(worktree, explicit = []) {
  const { stdout } = await exec("git", ["-C", worktree, "ls-files", "-oi", "--exclude-standard", "-z", "--", ":(glob)**/.env*", ":(glob)**/.dev.vars*"], { timeout: 10_000, maxBuffer: 8 * 1024 * 1024 });
  const automatic = stdout.split("\0").filter((name) => /^(?:\.dev\.vars|\.env)/.test(path.basename(name)));
  const names = [...new Set([...automatic, ...explicit])].sort();
  const records = [];
  for (const name of validateSecretPaths(names)) {
    try {
      const content = await fs.readFile(path.join(worktree, name));
      records.push({ path: name, exists: true, sha256: createHash("sha256").update(content).digest("hex") });
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("秘密のファイルのハッシュを計算できない");
      records.push({ path: name, exists: false, sha256: null });
    }
  }
  return records;
}
export async function inspect(worktree, expectSha, ports, secrets = []) {
  const result = { head: null, expectSha, headMatches: false, clean: false, ports: [], secretFiles: [], ok: false, reasons: [] };
  try {
    result.head = (await exec("git", ["-C", worktree, "rev-parse", "HEAD"], { timeout: 10_000 })).stdout.trim();
    result.headMatches = result.head === expectSha;
    result.clean = !(await exec("git", ["-C", worktree, "status", "--porcelain"], { timeout: 10_000 })).stdout.trim();
    result.secretFiles = await secretFiles(worktree, secrets);
  } catch { result.reasons.push("worktree の HEAD・状態・秘密のハッシュの点検に失敗"); }
  const listening = await inspectPorts(ports);
  result.ports = listening.ports;
  result.reasons.push(...listening.reasons);
  if (!result.headMatches) result.reasons.push("HEAD が期待した SHA と違う");
  if (!result.clean) result.reasons.push("worktree が clean ではない");
  result.ok = result.reasons.length === 0;
  return result;
}
export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseOptions(argv, { worktree: "string", "expect-sha": "string", ports: "string", "secret-files": "string", out: "string" });
    requireOptions(options, ["worktree", "expect-sha", "ports", "out"]);
    if (!/^[0-9a-f]{40}$/.test(options["expect-sha"])) throw new ArgumentError("40 桁の SHA が必要");
    const secrets = validateSecretPaths(options["secret-files"]?.split(",") ?? []);
    const result = await inspect(path.resolve(options.worktree), options["expect-sha"], parsePorts(options.ports), secrets);
    await writeJson(path.resolve(options.out), result);
    console.log(`点検: ${result.ok ? "通過" : "未通過"}`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof ArgumentError ? error.message : "点検を完了できない");
    return error instanceof ArgumentError ? 2 : 1;
  }
}
if (isMain(import.meta.url)) process.exitCode = await main();
