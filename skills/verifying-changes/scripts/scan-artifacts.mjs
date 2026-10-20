import fs from "node:fs/promises";
import path from "node:path";
import { parseOptions, requireOptions, ArgumentError, isMain } from "./lib/io.mjs";

export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseOptions(argv, { dir: "string" });
    requireOptions(options, ["dir"]);
    const root = path.resolve(options.dir);
    const matches = [];
    async function scan(dir) {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) throw new Error("リンクは検査できない");
        if (entry.isDirectory()) { await scan(file); continue; }
        if (!entry.isFile()) throw new Error("通常ファイルでない証跡");
        const content = await fs.readFile(file);
        const rules = [
          ["private-user-images", "private-user-images.githubusercontent.com"],
          ["signed-query", "X-Amz-Signature="],
        ];
        for (const [rule, needle] of rules) if (content.includes(Buffer.from(needle))) matches.push({ path: path.relative(root, file), rule });
      }
    }
    await scan(root);
    for (const match of matches) console.log(JSON.stringify(match));
    return matches.length ? 1 : 0;
  } catch (error) {
    console.error(error instanceof ArgumentError ? error.message : "証跡の検査を完了できない");
    return error instanceof ArgumentError ? 2 : 1;
  }
}
if (isMain(import.meta.url)) process.exitCode = await main();
