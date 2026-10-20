#!/usr/bin/env node
import fs from "node:fs/promises";

const args = process.argv.slice(2);
const stateFile = process.env.VERIFYING_CHANGES_FAKE_STATE;
if (!stateFile) throw new Error("試験の状態ファイルが必要");
const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
function readOnly(argv) {
  if (["issue list", "label list", "pr view", "run list"].includes(argv.slice(0, 2).join(" "))) return true;
  if (argv[0] !== "api" || argv.includes("graphql")) return false;
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (/^(?:-[fF]|--(?:field|raw-field|input)(?:=|$))/.test(arg)) return false;
    if (arg === "-X" || arg === "--method") { if (argv[++i] !== "GET") return false; }
    else if (arg.startsWith("-X") && arg !== "-XGET") return false;
    else if (arg.startsWith("--method=") && arg !== "--method=GET") return false;
  }
  return true;
}
const write = !readOnly(args);
state.calls ??= [];
state.calls.push({ args, write });
let output = "";
let code = 0;
const value = (flag) => args[args.indexOf(flag) + 1];
const bodyFile = async () => fs.readFile(value("--body-file"), "utf8");
if (write && state.failSummary && args[0] === "pr" && args[1] === "comment" && !args.includes("--attach")) {
  code = 1;
} else if (args[0] === "api" && !write) output = JSON.stringify(state.comments);
else if (args[0] === "issue" && args[1] === "list") output = JSON.stringify(state.issues);
else if (args[0] === "label" && args[1] === "list") output = JSON.stringify(state.labels.map((name) => ({ name })));
else if (args[0] === "pr" && args[1] === "view") output = JSON.stringify(value("--json") === "body" ? { body: state.prBody } : state.pr);
else if (args[0] === "run" && args[1] === "list") output = JSON.stringify((state.runs ?? []).map(({ headSha }) => ({ headSha })));
else if (args[0] === "label" && args[1] === "create") state.labels.push(args[2]);
else if (args[0] === "pr" && args[1] === "comment") {
  let body = await bodyFile();
  args.forEach((arg, index) => { if (arg === "--attach") body += `\n![${args[index + 1].split("#").at(-1)}](https://github.com/user-attachments/assets/00000000-0000-0000-0000-${String(index).padStart(12, "0")})`; });
  const id = 100 + state.comments.length;
  output = `https://github.com/example/widget/pull/17#issuecomment-${id}`;
  state.comments.push({ id, body, html_url: output });
} else if (args[0] === "api" && write) {
  const id = Number(args.find((arg) => /issues\/comments\/\d+$/.test(arg))?.split("/").at(-1));
  const field = value("-F");
  const comment = state.comments.find((item) => item.id === id);
  if (comment) comment.body = await fs.readFile(field.slice("body=@".length), "utf8");
} else if (args[0] === "issue" && args[1] === "create") {
  const number = 200 + state.issues.length;
  state.issues.push({ number, state: "OPEN", stateReason: null, body: await bodyFile(), createdAt: new Date().toISOString() });
  output = `https://github.com/example/widget/issues/${number}`;
} else if (args[0] === "issue" && args[1] === "comment") {
  state.issueComments ??= [];
  state.issueComments.push({ number: Number(args[2]), body: await bodyFile() });
} else if (args[0] === "pr" && args[1] === "edit") state.prBody = await bodyFile();
await fs.writeFile(stateFile, JSON.stringify(state));
if (output) console.log(output);
process.exitCode = code;
