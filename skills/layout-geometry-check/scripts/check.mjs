import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const allRules = ["R1", "R2", "R3", "R4"];

function argumentsOf(argv) {
  const options = { widths: [1280, 768, 320], rules: ["R1"], exclude: [], colorScheme: "light", maxIncomparable: 0.3 };
  const names = { "--url": "url", "--widths": "widths", "--exclude": "exclude", "--rules": "rules", "--color-scheme": "colorScheme", "--max-incomparable": "maxIncomparable", "--out": "out", "--baseline": "baseline" };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--update-baseline") { options.updateBaseline = true; continue; }
    if (!names[flag] || argv[i + 1] === undefined || argv[i + 1].startsWith("--")) throw new Error(`不明な引数、または値がありません: ${flag}`);
    const value = argv[++i];
    if (flag === "--exclude") options.exclude.push(value);
    else if (flag === "--widths") options.widths = [...new Set(value.split(",").map(Number))].sort((a, b) => b - a);
    else if (flag === "--rules") options.rules = [...new Set(value.split(","))];
    else if (flag === "--max-incomparable") options.maxIncomparable = Number(value);
    else options[names[flag]] = value;
  }
  if (!options.url || !options.out) throw new Error("--url と --out は必須です");
  if (!options.widths.length || options.widths.some((width) => !Number.isInteger(width) || width <= 0)) throw new Error("幅は正の整数を指定してください");
  if (!options.rules.length || options.rules.some((rule) => !allRules.includes(rule))) throw new Error("規則は R1,R2,R3,R4 から指定してください");
  if (!["light", "dark"].includes(options.colorScheme)) throw new Error("--color-scheme は light または dark です");
  if (!Number.isFinite(options.maxIncomparable) || options.maxIncomparable < 0 || options.maxIncomparable > 1) throw new Error("--max-incomparable は 0〜1 です");
  if (options.updateBaseline && !options.baseline) throw new Error("--update-baseline には --baseline が必要です");
  if (options.baseline && resolve(options.baseline) === resolve(options.out)) throw new Error("結果と基準線の保存先を分けてください");
  return options;
}

function emptyResult(options = {}) {
  return {
    url: options.url || "", finalUrl: "", status: null,
    widths: options.widths || [], referenceWidth: options.widths?.[0] ?? null, rules: options.rules || [],
    checked: Object.fromEntries((options.widths || []).map((width) => [width, 0])), findings: [],
    info: { atReference: [], incomparable: { invisibleAtReference: 0, missingAtReference: 0 }, unscanned: { closedShadowRoot: null, iframe: 0 }, r1Unverified: 0, leftProtrusion: 0, skippedParents: 0, networkidleTimedOut: false },
    verdict: "undecidable", reason: "未実行",
  };
}

const canonicalUrl = (value) => {
  const url = new URL(value);
  return `${url.host}${url.pathname.replace(/\/+$/, "")}`;
};

async function writeJson(path, value) {
  const target = resolve(path);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

function resultFrom(stdout) {
  const match = stdout.match(/^### Result\r?\n([\s\S]*?)(?=^### |$(?![\s\S]))/m);
  if (!match) throw new Error(`playwright-cli の結果がありません: ${stdout.slice(0, 2000)}`);
  try { return JSON.parse(match[1].trim()); }
  catch { throw new Error(`playwright-cli の結果を JSON として読めません（出力 ${Buffer.byteLength(stdout)} bytes）`); }
}

async function measure(options, result) {
  if (!["http:", "https:"].includes(new URL(options.url).protocol)) throw new Error("http: または https: の URL を指定してください");
  const directory = await mkdtemp(join(tmpdir(), "layout-geometry-"));
  const session = `geometry-${randomUUID().slice(0, 8)}`;
  let failure;
  const interruption = new AbortController();
  const stop = () => interruption.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const cli = async (...args) => {
    const { stdout, stderr } = await exec("playwright-cli", [`-s=${session}`, ...args], { cwd: directory, timeout: 120_000, maxBuffer: 32 * 1024 * 1024, signal: args[0] === "close" ? undefined : interruption.signal });
    if (/^### Error\b/m.test(stdout)) throw new Error(stdout);
    if (stderr.trim()) process.stderr.write(stderr);
    return stdout;
  };
  const run = async (name, code) => {
    const filename = join(directory, `${name}.js`);
    await writeFile(filename, code, { mode: 0o600 });
    const stdout = await cli("run-code", `--filename=${filename}`);
    console.log(`測定 ${name}: 返却 ${Buffer.byteLength(stdout)} bytes`);
    return resultFrom(stdout);
  };
  try {
    await cli("open");
    const detector = await readFile(new URL("./detect.js", import.meta.url), "utf8");
    await run("prepare", `async page => {
      await page.setViewportSize({ width: ${options.widths[0]}, height: 900 });
      await page.emulateMedia({ colorScheme: ${JSON.stringify(options.colorScheme)} });
      await page.addInitScript({ content: ${JSON.stringify(detector)} });
      page.__layoutStatus = null;
      page.on('response', response => {
        if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) page.__layoutStatus = response.status();
      });
      return { prepared: true };
    }`);
    await cli("goto", options.url);
    const navigation = await run("navigation", `async page => {
      await page.waitForLoadState('load');
      let networkidleTimedOut = false;
      try { await page.waitForLoadState('networkidle', { timeout: 5000 }); }
      catch (error) { if (error.name !== 'TimeoutError') throw error; networkidleTimedOut = true; }
      await page.evaluate(() => document.fonts.ready);
      return { finalUrl: page.url(), status: page.__layoutStatus, networkidleTimedOut };
    }`);
    result.finalUrl = navigation.finalUrl;
    result.status = navigation.status;
    result.info.networkidleTimedOut = navigation.networkidleTimedOut;
    if (!(result.status >= 200 && result.status < 300)) throw new Error(`HTTP ステータスが 2xx ではありません: ${result.status}`);
    if (canonicalUrl(options.url) !== canonicalUrl(result.finalUrl)) throw new Error(`移動先の host または pathname が異なります: ${result.finalUrl}`);
    for (const width of options.widths) {
      const sample = await run(`width-${width}`, `async page => {
        await page.setViewportSize({ width: ${width}, height: 900 });
        await page.evaluate(async () => {
          window.layoutGeometryCheck.freezeAnimations();
          const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
          await frame(); await frame();
          const until = performance.now() + 1000;
          let previous = '';
          do {
            const size = document.documentElement.scrollWidth + ',' + document.documentElement.scrollHeight;
            if (size === previous) break;
            previous = size;
            await frame();
          } while (performance.now() < until);
        });
        return await page.evaluate(options => window.layoutGeometryCheck.scan(options), ${JSON.stringify({ width, rules: options.rules, exclude: options.exclude, isReference: width === options.widths[0], maxIncomparable: options.maxIncomparable })});
      }`);
      result.checked[width] = sample.checked;
      result.findings.push(...sample.findings);
      result.info.atReference.push(...sample.info.atReference);
      for (const key of ["invisibleAtReference", "missingAtReference"]) result.info.incomparable[key] += sample.info.incomparable[key];
      for (const key of ["r1Unverified", "leftProtrusion", "skippedParents"]) result.info[key] += sample.info[key];
      for (const key of ["closedShadowRoot", "iframe"]) {
        const value = sample.info.unscanned[key];
        result.info.unscanned[key] = value === null ? null : Math.max(result.info.unscanned[key] || 0, value);
      }
      if (sample.reason) throw new Error(sample.reason);
    }
    result.verdict = "ok";
    result.reason = "";
  } catch (error) {
    failure = error;
  } finally {
    try { await cli("close"); }
    catch (error) { failure = new Error(`${failure ? `${failure.message}; ` : ""}ブラウザ終了失敗: ${error.message}`); }
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await rm(directory, { recursive: true, force: true });
  }
  if (failure) throw failure;
}

async function compare(options, result) {
  let baseline;
  if (options.baseline) {
    try { baseline = JSON.parse(await readFile(options.baseline, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  if (baseline === undefined) {
    console.log("基準線なし");
  } else {
    if (!baseline || baseline.verdict === "undecidable" || typeof baseline.url !== "string" || !Array.isArray(baseline.findings)) throw new Error("基準線の形式が不正です");
    const keys = (report) => new Set(report.findings.map((finding) => {
      if (!allRules.includes(finding.rule) || typeof finding.key !== "string" || !Number.isInteger(finding.width)) throw new Error("基準線の finding が不正です");
      return JSON.stringify([canonicalUrl(report.url), finding.rule, finding.key, finding.width]);
    }));
    const before = keys(baseline);
    const after = keys(result);
    const added = [...after].filter((key) => !before.has(key));
    const removed = [...before].filter((key) => !after.has(key));
    console.log(`基準線との差分: 新規 ${added.length} 件、減少 ${removed.length} 件`);
    if (added.length) result.verdict = "new-findings";
  }
  if (options.updateBaseline) {
    await writeJson(options.baseline, result);
    console.log(`基準線を保存: ${options.baseline}`);
  }
}

let options;
let result;
try {
  options = argumentsOf(process.argv.slice(2));
  result = emptyResult(options);
  await measure(options, result);
  await compare(options, result);
} catch (error) {
  result ||= emptyResult(options);
  result.verdict = "undecidable";
  result.reason = error.message;
  console.error(result.reason);
}
try {
  const out = options?.out || process.argv[process.argv.indexOf("--out") + 1];
  if (process.argv.includes("--out") && out) await writeJson(out, result);
} catch (error) {
  result.verdict = "undecidable";
  console.error(`結果の保存に失敗: ${error.message}`);
}
console.log(`判定: ${result.verdict}、finding ${result.findings.length} 件`);
process.exitCode = { ok: 0, "new-findings": 1, undecidable: 2 }[result.verdict];
