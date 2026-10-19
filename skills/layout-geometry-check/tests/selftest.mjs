import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const fixtureRoot = fileURLToPath(new URL("./fixtures/", import.meta.url));
const check = fileURLToPath(new URL("../scripts/check.mjs", import.meta.url));
const self = fileURLToPath(import.meta.url);
const directory = await mkdtemp(join(tmpdir(), "geometry-selftest-"));
let server;
let passed = 0;
const runProcess = async (command, args, options = {}) => {
  try { return { ...await exec(command, args, { timeout: 180_000, maxBuffer: 4 * 1024 * 1024, ...options }), code: 0 }; }
  catch (error) { if (typeof error.code !== "number") throw error; return error; }
};
const report = (name) => { passed++; console.log(`合格 ${passed}: ${name}`); };
const findingSet = (findings) => [...new Set(findings.map(({ rule, key, width }) => JSON.stringify({ rule, key, width })))].sort();

try {
  try { await exec("playwright-cli", ["--version"], { timeout: 15_000 }); }
  catch (error) {
    console.error(`playwright-cli を起動できません: ${error.message}`);
    process.exitCode = 2;
  }
  if (!process.exitCode) {
    server = createServer(async (request, response) => {
      const name = new URL(request.url, "http://127.0.0.1").pathname.slice(1);
      if (name === "redirect") { response.writeHead(302, { Location: "/negative.html" }); response.end(); return; }
      if (!/^[a-z0-9-]+\.html$/.test(name)) { response.writeHead(404); response.end("見つかりません"); return; }
      try {
        const html = await readFile(join(fixtureRoot, name));
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(html);
      } catch (error) {
        console.error(`fixture を配れません: ${error.message}`);
        response.writeHead(500);
        response.end("fixture 読み込み失敗");
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let serial = 0;
    const run = async (url, extra = [], options = {}) => {
      const out = join(directory, `result-${++serial}.json`);
      const execution = await runProcess(process.execPath, [check, "--url", url, "--out", out, ...extra], options);
      const result = JSON.parse(await readFile(out, "utf8"));
      assert.equal(execution.code, { ok: 0, "new-findings": 1, undecidable: 2 }[result.verdict], execution.stderr);
      return { result, execution };
    };
    const results = new Map();
    for (const file of (await readdir(fixtureRoot)).filter((file) => file.endsWith(".expected.json")).sort()) {
      const name = file.replace(".expected.json", "");
      const expected = JSON.parse(await readFile(join(fixtureRoot, file), "utf8"));
      const { result, execution } = await run(`${base}/${name}.html`, ["--rules", expected.rules.join(",")]);
      assert.equal(execution.code, expected.exit, `${name}: ${result.reason}\n${execution.stderr}`);
      assert.deepEqual(findingSet(result.findings), findingSet(expected.findings), `${name}: finding 集合`);
      if (expected.atReference) assert.deepEqual(findingSet(result.info.atReference), findingSet(expected.atReference), name);
      if (expected.incomparable) assert.deepEqual(result.info.incomparable, expected.incomparable, name);
      if (expected.unscanned) assert.deepEqual(result.info.unscanned, expected.unscanned, name);
      if (expected.checked) assert.ok(Object.values(result.checked).every((count) => count === expected.checked), `${name}: ${JSON.stringify(result.checked)}`);
      if (expected.exit === 0) assert.ok(Object.values(result.checked).every((count) => count > 0), name);
      results.set(name, result);
      report(`${name}: 終了コードと finding の過不足を検査`);
    }

    const { result: excluded } = await run(`${base}/r1.html`, ["--rules", "R1", "--exclude", '[data-testid="wide"]']);
    assert.equal(excluded.verdict, "undecidable");
    report("除外で対象が0個 → 判定不能");

    for (const url of ["file:///tmp/layout-fixture.html", `${base}/404`, `${base}/redirect`]) {
      const { execution } = await run(url);
      assert.equal(execution.code, 2, url);
      report(`${url}: 判定不能`);
    }
    const missing = await runProcess(process.execPath, [self], { env: { ...process.env, PATH: directory } });
    assert.equal(missing.code, 2, missing.stderr);
    report("PATH に playwright-cli が無い → 自己テスト終了コード2");

    const current = results.get("r1");
    const baseline = join(directory, "baseline.json");
    const compare = async (value, expectedCode, text) => {
      await writeFile(baseline, JSON.stringify(value));
      const { execution } = await run(`${base}/r1.html`, ["--rules", "R1", "--baseline", baseline]);
      assert.equal(execution.code, expectedCode, execution.stderr);
      if (text) assert.ok(execution.stdout.includes(text), execution.stdout);
      assert.deepEqual(JSON.parse(await readFile(baseline, "utf8")), value, "明示更新なしで基準線を書き換えない");
    };
    await compare(current, 0);
    report("結果と同じ基準線 → 終了コード0");
    await compare({ ...current, findings: [] }, 1);
    report("結果に新規 finding → 終了コード1");
    await compare({ ...current, findings: [...current.findings, { rule: "R1", key: "過去にだけあった要素", width: 320 }] }, 0, "減少 1 件");
    report("結果から finding が減った → 終了コード0、減少を表示");

    const newBaseline = join(directory, "new-baseline.json");
    const updated = await run(`${base}/r1.html`, ["--rules", "R1", "--baseline", newBaseline, "--update-baseline", "--color-scheme", "dark"]);
    assert.equal(updated.execution.code, 0);
    assert.deepEqual(JSON.parse(await readFile(newBaseline, "utf8")), updated.result);
    report("明示更新 → 基準線を保存、dark の実行成功");

    const helperSession = `geometry-helper-${randomUUID().slice(0, 8)}`;
    const helperCli = async (...args) => {
      const { stdout } = await exec("playwright-cli", [`-s=${helperSession}`, ...args], { cwd: directory, timeout: 120_000 });
      assert.ok(!/^### Error/m.test(stdout), stdout);
      return stdout;
    };
    try {
      await helperCli("open");
      const helperFile = join(directory, "helper.js");
      const detectorPath = fileURLToPath(new URL("../scripts/detect.js", import.meta.url));
      await writeFile(helperFile, `async page => {
        await page.goto(${JSON.stringify(`${base}/roots.html`)});
        await page.addScriptTag({ path: ${JSON.stringify(detectorPath)} });
        return await page.evaluate(() => {
          const detector = window.layoutGeometryCheck;
          const host = document.querySelector('[data-testid="open"]');
          const style = document.createElement('style');
          style.textContent = '@keyframes pulse { to { opacity: 0.5; } } div { animation: pulse 1s infinite; }';
          host.shadowRoot.append(style);
          detector.freezeAnimations();
          return { unscanned: detector.scan({width:innerWidth,isReference:true}).info.unscanned,
            animation: getComputedStyle(host.shadowRoot.querySelector('div')).animationName };
        });
      }`);
      const stdout = await helperCli("run-code", `--filename=${helperFile}`);
      const parsed = JSON.parse(stdout.match(/^### Result\r?\n([\s\S]*?)(?=^### |$(?![\s\S]))/m)[1]);
      assert.deepEqual(parsed.unscanned, { closedShadowRoot: null, iframe: 1 });
      assert.equal(parsed.animation, "none");
      report("移動後に helper を読み込む → 閉じた root は未計測、開いた root のアニメーションを停止");
    } finally {
      await helperCli("close");
    }
    console.log(`自己テスト: ${passed} 件合格`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
