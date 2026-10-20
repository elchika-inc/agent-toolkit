import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { temp } from "./helpers.mjs";

export const exec = promisify(execFile);
export async function command(bin, args, options = {}) {
  try { return { ...await exec(bin, args, { timeout: 30_000, ...options }), code: 0 }; }
  catch (error) { return { stdout: error.stdout ?? "", stderr: error.stderr ?? "", code: error.code }; }
}
export async function repository(t) {
  const dir = await temp(t);
  const worktree = path.join(dir, "repo");
  await fs.mkdir(worktree);
  const git = (...args) => exec("git", ["-C", worktree, ...args]);
  await git("init", "--initial-branch=main");
  await fs.writeFile(path.join(worktree, ".gitignore"), ".env*\n.dev.vars*\n");
  await git("add", ".gitignore");
  await git("-c", "user.name=試験", "-c", "user.email=test@example.invalid", "commit", "-m", "試験用");
  const sha = (await git("rev-parse", "HEAD")).stdout.trim();
  return { dir, worktree, git, sha };
}
export async function listen(t, handler) {
  const server = handler ? http.createServer(handler) : net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
  return { server, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` };
}
export async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
