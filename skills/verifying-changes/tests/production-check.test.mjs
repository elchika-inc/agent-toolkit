import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { main } from "../scripts/production-check.mjs";
import { listSessions } from "../scripts/lib/sessions.mjs";
import { temp } from "./helpers.mjs";
import { exec, command, repository, listen } from "./local-helpers.mjs";
const script = fileURLToPath(new URL("../scripts/production-check.mjs", import.meta.url));
const sessionsUrl = new URL("../scripts/lib/sessions.mjs", import.meta.url).href;
const fake = fileURLToPath(new URL("./fixtures/fake-gh.mjs", import.meta.url));
async function listFrom(cwd, prefix) {
  const code = `import { listSessions } from ${JSON.stringify(sessionsUrl)}; console.log(JSON.stringify(await listSessions(${JSON.stringify(prefix)})));`;
  return JSON.parse((await exec(process.execPath, ["--input-type=module", "-e", code], { cwd })).stdout);
}
async function setup(t, fixture = "normal") {
  let cleanup;
  t.after(async () => { if (cleanup) await cleanup(); });
  const r = await repository(t); const requests = [], foreignRequests = [];
  const foreign = await listen(t, (req, res) => { foreignRequests.push(req.url); res.end("合成"); });
  const html = (await fs.readFile(new URL(`./fixtures/production/${fixture}.html`, import.meta.url), "utf8")).replaceAll("__FOREIGN_URL__", foreign.url);
  const local = await listen(t, async (req,res) => {
    let body = ""; for await (const part of req) body += part;
    requests.push({ method: req.method, url: req.url, body });
    if (req.url === "/redirect") { res.writeHead(302, { Location: foreign.url + "/private" }); res.end(); }
    else if (req.url === "/same-redirect") { res.writeHead(302, { Location: "/destination" }); res.end(); }
    else if (req.url === "/resource-redirect") { res.writeHead(302, { Location: foreign.url + "/private" }); res.end(); }
    else if (req.url === "/graphql-redirect") { res.writeHead(307, { Location: "/destination" }); res.end(); }
    else if (req.url === "/slow") setTimeout(() => res.end("遅い応答"), 2000);
    else if (req.url === "/unexpected") { res.writeHead(503); res.end("合成の失敗"); }
    else if (req.url === "/graphql") { res.setHeader("Content-Type", "application/json"); res.end('{"data":{"viewer":{"id":"example"}}}'); }
    else { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html); }
  });
  let upgrades = 0;
  local.server.on("upgrade", (req,socket) => { upgrades++; socket.destroy(); });
  await r.git("branch", "production");
  const remote = path.join(r.dir,"remote.git");
  await exec("git", ["clone", "--bare", r.worktree, remote]);
  const stateFile = path.join(r.dir,"state.json");
  await fs.writeFile(stateFile, JSON.stringify({ runs: [{ headSha: r.sha }], calls: [] }));
  const out = path.join(r.dir,"output"); const targetsFile = path.join(r.dir,"targets.json");
  const runId = `test-${randomUUID().slice(0,8)}`; const session = `vc-${runId}-main`;
  const cwd = await temp(t);
  const env = { ...process.env, VERIFYING_CHANGES_GH: fake, VERIFYING_CHANGES_FAKE_STATE: stateFile };
  cleanup = async () => { if ((await listFrom(cwd, `vc-${runId}-`)).includes(session)) await exec("playwright-cli", [`-s=${session}`, "close"], { cwd }); };
  const target = { name: "sample", kind: "page", url: local.url, expectStatus: 200, expectSelectors: ["main"] };
  return { ...r, local, foreign, requests, foreignRequests, upgrades: () => upgrades, out, runId, session, cwd, target, stateFile,
    run: async (extra = [], targets = [target]) => {
      await fs.writeFile(targetsFile, JSON.stringify(targets));
      const result = await command(process.execPath, [script, "--repo", "example/widget", "--expect-sha", r.sha, "--deploy-workflow", "deploy.yml", "--targets", targetsFile, "--allow-hosts", `127.0.0.1:${local.port}`, "--out", out, "--run-id", runId, "--remote", remote, ...extra], { cwd, env, timeout: 90_000 });
      const log = JSON.parse(await fs.readFile(path.join(out,"production-log.json"), "utf8"));
      return { ...result, log };
    },
  };
}

test("bare リポジトリの production が --expect-sha と違う → exit 1・deployCheck.ok false・試験のサーバーへの到達は 0 件", async (t) => {
  const p = await setup(t); const r = await p.run(["--expect-sha", "e".repeat(40)]); assert.equal(r.code, 1); assert.equal(r.log.deployCheck.ok, false); assert.equal(p.requests.length, 0);
});

test("fake-gh の headSha が --expect-sha と違う → exit 1・試験のサーバーへの到達は 0 件", async (t) => {
  const p = await setup(t); await fs.writeFile(p.stateFile, JSON.stringify({ runs: [{ headSha: "e".repeat(40) }] })); const r = await p.run(); assert.equal(r.code, 1); assert.equal(p.requests.length, 0);
});

test("通常の実行 → deployCheck.ok true・guardSelfCheck が 3 つとも true", async (t) => {
  const p = await setup(t); const r = await p.run(); assert.equal(r.code, 0, r.stderr); assert.equal(r.log.deployCheck.ok, true); assert.deepEqual(r.log.guardSelfCheck, { postBlocked: true, mutationBlocked: true, getAllowed: true }); assert.equal(r.log.targets[0].selectorsFound.main, true); assert.ok((await fs.stat(path.join(p.out,r.log.targets[0].screenshot))).size > 0); assert.ok((await fs.readFile(path.join(p.out,r.log.targets[0].a11y),"utf8")).includes("main")); const scan = fileURLToPath(new URL("../scripts/scan-artifacts.mjs", import.meta.url)); assert.equal((await command(process.execPath, [scan, "--dir", p.out], { cwd: p.cwd })).code, 0, "出力した証跡の検査");
});

test("読み込み時に POST するページ → requests に blocked で残り、サーバーが受け取った POST は 0 件", async (t) => {
  const p = await setup(t,"post"); const r = await p.run(); assert.equal(r.code, 0, r.stderr); assert.ok(r.log.requests.some(x => x.target === "sample" && x.method === "POST" && x.blocked)); assert.equal(p.requests.filter(x => x.method === "POST").length, 0);
});

test("allow-write POST:http://127.0.0.1:<port>/graphql のときの mutation → サーバーが受け取った mutation は 0 件", async (t) => {
  const p = await setup(t,"mutation"); const r = await p.run(["--allow-write", `POST:${p.local.url}/graphql`]); assert.equal(r.code, 0, r.stderr); assert.equal(p.requests.filter(x => x.body.includes("mutation")).length, 0); assert.ok(r.log.requests.some(x => x.target === "sample" && x.method === "POST" && x.blocked));
});

test("allow-write POST:http://127.0.0.1:<port>/graphql のときの query → サーバーが受け取る", async (t) => {
  const p = await setup(t,"query"); const r = await p.run(["--allow-write", `POST:${p.local.url}/graphql`]); assert.equal(r.code, 0, r.stderr); assert.ok(p.requests.some(x => x.body.includes("query")));
});

test("allow-hosts にない host への通信 → blocked で残り、そのサーバーへの到達は 0 件", async (t) => {
  const p = await setup(t,"foreign"); const r = await p.run(); assert.equal(r.code, 0, r.stderr); assert.ok(r.log.requests.some(x => x.url.startsWith(p.foreign.url) && x.blocked)); assert.equal(p.foreignRequests.length, 0);
});

test("WebSocket を開くページ → サーバーへの WebSocket の接続は 0 件", async (t) => {
  const p = await setup(t,"websocket"); const r = await p.run(); assert.equal(r.code, 0, r.stderr); assert.equal(p.upgrades(), 0); assert.ok(r.log.requests.some(x => x.method === "WEBSOCKET" && x.blocked));
});

test("http の対象で期待と違う応答 → status が残り exit 0", async (t) => {
  const p = await setup(t); const r = await p.run([], [{ ...p.target, kind: "http", url: p.local.url + "/unexpected" }]); assert.equal(r.code, 0, r.stderr); assert.equal(r.log.targets[0].status, 503);
});

test("http の対象が allow-hosts にない host への 302 → location が残り、その host への到達は 0 件", async (t) => {
  const p = await setup(t); const r = await p.run([], [{ ...p.target, kind: "http", url: p.local.url + "/redirect" }]); assert.equal(r.code, 0, r.stderr); assert.equal(r.log.targets[0].location, p.foreign.url + "/private"); assert.equal(p.foreignRequests.length, 0);
});

test("--budget-seconds 1 で遅い対象 → 残りが skipped・budgetExceeded true・exit 0", async (t) => {
  const p = await setup(t); const r = await p.run(["--budget-seconds","1"], [{ ...p.target, kind: "http", url: p.local.url + "/slow" }, { ...p.target, name: "remaining", kind: "http" }]); assert.equal(r.code, 0, r.stderr); assert.equal(r.log.budgetExceeded, true); assert.equal(r.log.targets[1].skipped, "上限の時間");
});

test("listSessions: vc-<runId>- で始まる session をわざと開いたまま、別の cwd から呼ぶ → その名前を返す（陽性対照）", async (t) => {
  const p = await setup(t); await exec("playwright-cli", [`-s=${p.session}`,"open"], { cwd: p.cwd, timeout: 30000 }); const other = await temp(t); assert.ok((await listFrom(other, `vc-${p.runId}-`)).includes(p.session));
});

test("同じ名前の session が開いたまま → 本番を開かずに exit 1", async (t) => {
  const p = await setup(t); await exec("playwright-cli", [`-s=${p.session}`,"open"], { cwd: p.cwd, timeout: 30000 }); const r = await p.run(); assert.equal(r.code, 1); assert.equal(p.requests.length, 0); assert.ok((await listFrom(p.cwd, `vc-${p.runId}-`)).includes(p.session));
});

test("終わったあと、別の cwd から listSessions('vc-<runId>-') → 空・production-log.json の sessionClosed が true", async (t) => {
  const p = await setup(t); const r = await p.run(); assert.equal(r.code, 0, r.stderr); const other = await temp(t); assert.deepEqual(await listFrom(other, `vc-${p.runId}-`), []); assert.equal(r.log.sessionClosed, true);
});


test("ページの対象が allow-hosts にない host へ 302 → targets に status 302 と location が残り、その host への到達は 0 件", async (t) => {
  const p = await setup(t);
  const r = await p.run([], [{ ...p.target, url: p.local.url + "/redirect" }]);
  assert.equal(p.foreignRequests.length, 0, "移動先への到達数");
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.log.targets[0].status, 302);
  assert.equal(r.log.targets[0].location, p.foreign.url + "/private");
  assert.equal(r.log.targets[0].selectorsFound.main, null);
});

test("ページの対象が allow-hosts の中の別の path へ 302 → 移動先への到達は 0 件", async (t) => {
  const p = await setup(t);
  const r = await p.run([], [{ ...p.target, url: p.local.url + "/same-redirect" }]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(p.requests.filter(x => x.url === "/destination").length, 0);
  assert.equal(r.log.targets[0].status, 302);
});

test("ページの中のサブリソースが allow-hosts にない host へ 302 → requests に blocked で残り、その host への到達は 0 件", async (t) => {
  const p = await setup(t, "resource-redirect");
  const r = await p.run();
  assert.equal(r.code, 0, r.stderr);
  assert.equal(p.foreignRequests.length, 0);
  assert.ok(r.log.requests.some(x => x.blocked && x.url === p.foreign.url + "/private" && x.reason.includes("リダイレクト")));
});

test("allow-write の POST が 307 を返す → 移動先への到達は 0 件", async (t) => {
  const p = await setup(t, "post-redirect");
  const r = await p.run(["--allow-write", `POST:${p.local.url}/graphql-redirect`]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(p.requests.some(x => x.method === "POST" && x.url === "/graphql-redirect"));
  assert.equal(p.requests.filter(x => x.url === "/destination").length, 0);
});
