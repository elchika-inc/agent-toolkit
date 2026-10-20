import path from "node:path";
import { ArgumentError, writeJson, isMain, redact } from "./lib/io.mjs";

export async function main(argv = process.argv.slice(2)) {
  try {
    const checks = [];
    let out;
    for (let i = 0; i < argv.length; i++) {
      const flag = argv[i], value = argv[++i];
      if (!value || value.startsWith("--")) throw new ArgumentError("引数の値が必要");
      if (flag === "--url") {
        let url;
        try { url = new URL(value); } catch { throw new ArgumentError("URL が不正"); }
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || redact(value) !== value) throw new ArgumentError("安全な HTTP URL が必要");
        checks.push({ url: value, status: null, origin: null, allowOrigin: null, ok: false });
      } else if (flag === "--origin" && checks.length) checks.at(-1).origin = value;
      else if (flag === "--out") out = value;
      else throw new ArgumentError("不明な引数または --origin の順序が不正");
    }
    if (!checks.length || !out) throw new ArgumentError("--url と --out は必須");
    for (const check of checks) {
      try {
        const response = await fetch(check.url, { headers: check.origin ? { Origin: check.origin } : {}, redirect: "manual", signal: AbortSignal.timeout(10_000) });
        check.status = response.status;
        check.allowOrigin = response.headers.get("access-control-allow-origin");
        check.ok = response.status < 500 && (!check.origin || [check.origin, "*"].includes(check.allowOrigin));
        await response.body?.cancel();
      } catch { check.ok = false; }
    }
    const ok = checks.every((check) => check.ok);
    await writeJson(path.resolve(out), { checks, ok });
    console.log(`到達: ${ok ? "通過" : "未通過"}`);
    return ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof ArgumentError ? error.message : "到達の確認を完了できない");
    return error instanceof ArgumentError ? 2 : 1;
  }
}
if (isMain(import.meta.url)) process.exitCode = await main();
