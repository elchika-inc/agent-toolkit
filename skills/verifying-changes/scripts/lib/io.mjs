import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}
export async function readOptional(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw new Error(`${path.basename(file)} を読めない`); }
}
export function isMain(url) {
  return process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === url;
}
export class ArgumentError extends Error {}
export function parseOptions(argv, definitions) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const name = argv[i].replace(/^--/, "");
    const type = definitions[name];
    if (!argv[i].startsWith("--") || !type) throw new ArgumentError("不明な引数");
    if (type === "boolean") { options[name] = true; continue; }
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new ArgumentError(`--${name} の値が必要`);
    if (type === "multiple") (options[name] ??= []).push(value);
    else options[name] = value;
  }
  return options;
}
export function requireOptions(options, names) {
  for (const name of names) if (!options[name]) throw new ArgumentError(`--${name} は必須`);
}
export function redact(text) {
  return String(text).replace(/https?:\/\/[^\s<>"']*(?:private-user-images\.githubusercontent\.com|X-Amz-Signature=)[^\s<>"']*/gi, "[署名付き URL を削除]");
}
