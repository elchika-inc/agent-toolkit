import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createGh } from "./lib/gh.mjs";
import { judgeRequest } from "./lib/guard.mjs";
import { listSessions } from "./lib/sessions.mjs";
import { parseOptions, requireOptions, ArgumentError, writeJson, isMain, redact } from "./lib/io.mjs";

const exec = promisify(execFile);
function safeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new ArgumentError("URL が不正"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || redact(value) !== value) throw new ArgumentError("安全な HTTP URL が必要");
  return url;
}
async function optionsOf(argv) {
  const options = parseOptions(argv, { repo: "string", "expect-sha": "string", "deploy-workflow": "string", targets: "string", "allow-hosts": "string", out: "string", "run-id": "string", remote: "string", "allow-write": "multiple", "budget-seconds": "string" });
  requireOptions(options, ["repo", "expect-sha", "deploy-workflow", "targets", "allow-hosts", "out", "run-id"]);
  if (!/^[\w.-]+\/[\w.-]+$/.test(options.repo) || !/^[0-9a-f]{40}$/.test(options["expect-sha"]) || !/^[\w-]+$/.test(options["run-id"])) throw new ArgumentError("repo・SHA・run-id が不正");
  options.remote ??= `https://github.com/${options.repo}.git`;
  if (options.remote.startsWith("-")) throw new ArgumentError("remote が不正");
  if (/^https?:/.test(options.remote)) safeUrl(options.remote);
  options.out = path.resolve(options.out);
  options.budget = Number(options["budget-seconds"] ?? 1200);
  if (!Number.isFinite(options.budget) || options.budget <= 0) throw new ArgumentError("時間の上限は正の秒数");
  options.policy = { allowHosts: options["allow-hosts"].split(","), allowWrites: [] };
  if (options.policy.allowHosts.some((host) => !host || safeUrl(`http://${host}`).host !== host)) throw new ArgumentError("allow-hosts は host[:port] の一覧");
  for (const entry of options["allow-write"] ?? []) {
    const match = entry.match(/^([A-Za-z]+):(https?:\/\/.+)$/);
    if (!match) throw new ArgumentError("allow-write は METHOD:URL");
    safeUrl(match[2]);
    options.policy.allowWrites.push({ method: match[1].toUpperCase(), urlPrefix: match[2] });
  }
  try { options.targets = JSON.parse(await fs.readFile(options.targets, "utf8")); }
  catch { throw new ArgumentError("targets の JSON を読めない"); }
  if (!Array.isArray(options.targets) || !options.targets.length) throw new ArgumentError("対象は空でない配列");
  const names = new Set();
  for (const target of options.targets) {
    if (!target || !/^[\w-]+$/.test(target.name) || names.has(target.name) || !["page", "http"].includes(target.kind) || !Number.isInteger(target.expectStatus) || target.expectStatus < 100 || target.expectStatus > 599 || !Array.isArray(target.expectSelectors) || target.expectSelectors.some((selector) => typeof selector !== "string" || !selector)) throw new ArgumentError("本番の対象の形式が不正");
    names.add(target.name); safeUrl(target.url);
  }
  return options;
}
async function deployment(options) {
  const result = { ok: false, productionSha: null, deployHeadSha: null, remote: options.remote, ghBin: process.env.VERIFYING_CHANGES_GH ?? "gh" };
  try {
    const { stdout } = await exec("git", ["ls-remote", options.remote, "refs/heads/production"], { timeout: 30_000, maxBuffer: 1024 * 1024 });
    result.productionSha = stdout.match(/^([0-9a-f]{40})\s+refs\/heads\/production\s*$/m)?.[1] ?? null;
    const runs = JSON.parse(await createGh({ write: false }).read(["run", "list", "--repo", options.repo, "--workflow", options["deploy-workflow"], "--branch", "production", "--status", "success", "--limit", "1", "--json", "headSha"]));
    result.deployHeadSha = runs[0]?.headSha ?? null;
    result.ok = result.productionSha === options["expect-sha"] && result.deployHeadSha === options["expect-sha"];
  } catch { console.error("本番の SHA の照合が失敗"); }
  return result;
}
function emptyTarget(target) {
  return { name: target.name, url: target.url, status: null, location: null, selectorsFound: {}, console: [], screenshot: null, a11y: null, skipped: null };
}
async function checkHttp(target, policy, timeout) {
  const record = emptyTarget(target);
  const judgment = judgeRequest({ method: "GET", url: target.url, postData: null, contentType: "" }, policy);
  const request = { target: target.name, method: "GET", url: target.url, status: null, blocked: !judgment.allow, reason: judgment.reason };
  if (!judgment.allow) { record.skipped = judgment.reason; return { record, requests: [request] }; }
  try {
    const response = await fetch(target.url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(Math.max(1, timeout)) });
    record.status = request.status = response.status;
    record.location = response.headers.get("location");
    if (record.location) record.location = redact(record.location);
    await response.body?.cancel();
  } catch (error) { request.reason = error.name === "TimeoutError" ? "応答の時間切れ" : "応答を受け取れない"; }
  return { record, requests: [request] };
}

function pageCode(target, policy, out, timeout) {
  return `async page => {
    const judgeRequest = (${judgeRequest.toString()});
    const redact = (${redact.toString()});
    const target = ${JSON.stringify(target)};
    const policy = ${JSON.stringify(policy)};
    const record = ${JSON.stringify(emptyTarget(target))};
    const requests = [];
    // CLI が自動で保存するタブは about:blank のまま保ち、対象の生ログを出さない。
    const context = await page.context().browser().newContext({ serviceWorkers: 'block' });
    const actual = await context.newPage();
    const timeout = ${timeout};
    let redirected = false;
    const pending = new Set();
    context.on('console', message => record.console.push({ type: message.type(), text: redact(message.text()), url: redact(message.location().url || '') }));
    context.on('weberror', error => record.console.push({ type: 'error', text: redact(error.error().message), url: redact(error.page()?.url() || '') }));
    try {
      await context.addInitScript(() => {
        if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('Service Worker は停止'));
      });
      await context.routeWebSocket('**/*', socket => {
        requests.push({ target: target.name, method: 'WEBSOCKET', url: redact(socket.url()), status: null, blocked: true, reason: 'WebSocket は停止' });
        socket.close();
      });
      await context.route('**/*', route => {
        const work = (async () => {
          const req = route.request();
          const decision = judgeRequest({ method: req.method(), url: req.url(), postData: req.postData(), contentType: req.headers()['content-type'] || '' }, policy);
          const item = { target: target.name, method: req.method(), url: redact(req.url()), status: null, blocked: !decision.allow, reason: decision.reason };
          requests.push(item);
          if (!decision.allow) { await route.abort(); return; }
          try {
            const response = await route.fetch({ maxRedirects: 0, timeout });
            item.status = response.status();
            const navigation = req.isNavigationRequest() && req.frame() === actual.mainFrame();
            if (navigation) { record.status = response.status(); record.location = redact(response.headers().location || '') || null; }
            if (response.status() >= 300 && response.status() < 400) {
              item.blocked = true; item.reason = 'リダイレクトを停止';
              const location = response.headers().location;
              if (location) {
                let destination;
                try { destination = new URL(location, req.url()).href; } catch { destination = location; }
                requests.push({ target: target.name, method: req.method(), url: redact(destination), status: null, blocked: true, reason: 'リダイレクト先への通信を停止' });
              }
              if (navigation) {
                redirected = true;
                for (const selector of target.expectSelectors) record.selectorsFound[selector] = null;
              }
              await route.abort(); return;
            }
            await route.fulfill({ response });
          } catch {
            item.reason = '応答を取得できない';
            await route.abort().catch(() => {});
          }
        })();
        pending.add(work); work.then(() => pending.delete(work), () => pending.delete(work));
        return work;
      });
      try { await actual.goto(target.url, { waitUntil: 'load', timeout }); }
      catch { if (!redirected) record.console.push({ type: 'error', text: '文書の読み込みを完了できない', url: redact(target.url) }); }
      if (!redirected) {
        try { await actual.waitForLoadState('networkidle', { timeout: Math.min(timeout, 1000) }); }
        catch { /* 長く続く通信は上限付きで観測を終える。 */ }
        for (const selector of target.expectSelectors) record.selectorsFound[selector] = await actual.locator(selector).count() > 0;
        try {
          await actual.screenshot({ path: ${JSON.stringify(path.join(out, `${target.name}.png`))}, fullPage: true, timeout });
          record.screenshot = ${JSON.stringify(`${target.name}.png`)};
          record.a11y = redact(await actual.locator('body').ariaSnapshot({ timeout }));
        } catch { record.console.push({ type: 'error', text: '画像または a11y を取得できない', url: redact(target.url) }); }
      }
    } finally {
      await context.close();
      await Promise.allSettled([...pending]);
    }
    return { record, requests };
  }`;
}
function resultFrom(stdout) {
  const match = stdout.match(/^### Result\r?\n([\s\S]*?)(?=^### |$(?![\s\S]))/m);
  if (!match) throw new Error("playwright-cli の結果が無い");
  return JSON.parse(match[1].trim());
}
async function selfCheck(runPage) {
  const received = [];
  const server = http.createServer(async (req, res) => {
    let body = ""; for await (const part of req) body += part;
    received.push({ method: req.method, url: req.url, body });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(req.url === "/" ? `<!doctype html><main>見張りの自己確認</main><script>
      fetch('/write', {method:'POST',body:'synthetic'}).catch(()=>{});
      fetch('/graphql', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'mutation { delete }'})}).catch(()=>{});
      fetch('/read').catch(()=>{});
    </script>` : "ok");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const target = { name: "guard-self-check", kind: "page", url, expectStatus: 200, expectSelectors: ["main"] };
    const result = await runPage(target, { allowHosts: [new URL(url).host], allowWrites: [{ method: "POST", urlPrefix: `${url}/graphql` }] }, 10_000);
    return {
      postBlocked: result.requests.some((item) => item.url === `${url}/write` && item.blocked) && !received.some((item) => item.url === "/write"),
      mutationBlocked: result.requests.some((item) => item.url === `${url}/graphql` && item.blocked) && !received.some((item) => item.url === "/graphql"),
      getAllowed: received.some((item) => item.url === "/read" && item.method === "GET"),
    };
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
async function checkProduction(options) {
  const deadline = Date.now() + options.budget * 1000;
  await fs.mkdir(options.out, { recursive: true });
  const log = { deployCheck: await deployment(options), guardSelfCheck: { postBlocked: false, mutationBlocked: false, getAllowed: false }, budgetExceeded: false, sessionClosed: true, requests: [], targets: [] };
  let code = 1, opened = false;
  const suffix = path.basename(path.dirname(options.out)) === "reruns" ? path.basename(options.out) : "main";
  const session = `vc-${options["run-id"]}-${suffix}`;
  const cwd = await fs.mkdtemp(path.join(options.out, "browser-"));
  const cli = async (...args) => {
    try {
      const { stdout, stderr } = await exec("playwright-cli", [`-s=${session}`, ...args], { cwd, timeout: 60_000, maxBuffer: 32 * 1024 * 1024, signal: args[0] === "close" ? undefined : abort.signal });
      if (stderr.trim() || /^### Error\b/m.test(stdout)) throw new Error();
      return stdout;
    } catch { throw new Error("playwright-cli の実行に失敗"); }
  };
  const interrupted = () => { throw new Error("確認が中断された"); };
  // 中断でも finally で自分の session を閉じる。
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  async function runPage(target, policy, timeout) {
    if (abort.signal.aborted) interrupted();
    const file = path.join(cwd, `${target.name}.js`);
    await fs.writeFile(file, pageCode(target, policy, options.out, timeout), { mode: 0o600 });
    const result = resultFrom(await cli("run-code", `--filename=${file}`));
    if (result.record.a11y !== null) {
      await fs.writeFile(path.join(options.out, `${target.name}.a11y.yml`), result.record.a11y, { mode: 0o600 });
      result.record.a11y = `${target.name}.a11y.yml`;
    }
    return result;
  }
  try {
    if (!log.deployCheck.ok) throw new Error("本番の SHA が一致しない");
    if ((await listSessions(session)).includes(session)) { log.sessionClosed = false; throw new Error("同じ名前の session が既にある"); }
    const config = path.join(cwd, "config.json");
    await writeJson(config, { browser: { isolated: true, contextOptions: { serviceWorkers: "block" } }, outputMode: "stdout" });
    opened = true; log.sessionClosed = false;
    await cli("open", `--config=${config}`);
    log.guardSelfCheck = await selfCheck(runPage);
    if (!Object.values(log.guardSelfCheck).every(Boolean)) throw new Error("通信の見張りの自己確認が不一致");
    for (const target of options.targets) {
      if (abort.signal.aborted) interrupted();
      if (Date.now() >= deadline) {
        log.budgetExceeded = true;
        log.targets.push({ ...emptyTarget(target), skipped: "上限の時間" });
        continue;
      }
      const timeout = Math.max(1, Math.min(15_000, deadline - Date.now()));
      const result = target.kind === "http" ? await checkHttp(target, options.policy, timeout) : await runPage(target, options.policy, timeout);
      log.requests.push(...result.requests);
      log.targets.push(result.record);
      if (Date.now() >= deadline) log.budgetExceeded = true;
      await writeJson(path.join(options.out, "production-log.json"), log);
    }
    code = 0;
  } catch (error) { console.error(error.message); }
  finally {
    if (opened) {
      try { await cli("close"); log.sessionClosed = !(await listSessions(session)).includes(session); }
      catch { log.sessionClosed = false; console.error("自分の session の終了を確認できない"); }
      if (!log.sessionClosed) code = 1;
    }
    await fs.rm(cwd, { recursive: true, force: true });
    process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
    await writeJson(path.join(options.out, "production-log.json"), log);
  }
  return code;
}
export async function main(argv = process.argv.slice(2)) {
  try { return await checkProduction(await optionsOf(argv)); }
  catch (error) {
    console.error(error instanceof ArgumentError ? error.message : "本番の確認を完了できない");
    return error instanceof ArgumentError ? 2 : 1;
  }
}
if (isMain(import.meta.url)) process.exitCode = await main();
