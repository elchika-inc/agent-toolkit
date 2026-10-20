import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
export async function temp(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "verifying-changes-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
export function results(overrides = {}) {
  return { ...structuredClone(sample), ...overrides };
}
export function finding({ head = [3, 3], base = [3, 0], ...rest } = {}) {
  const runs = (value) => value === null ? null : { tried: value[0], occurred: value[1] };
  return { ...structuredClone(sample.findings[0]), headRuns: runs(head), baseRuns: runs(base), ...rest };
}
export function measured() {
  return {
    preflight: { ok: true, head: sample.targetSha, headMatches: true }, reach: { ok: true },
    production: {
      deployCheck: { ok: true, productionSha: sample.targetSha, remote: "https://github.com/example/widget.git", ghBin: "gh" },
      guardSelfCheck: { postBlocked: true, mutationBlocked: true, getAllowed: true },
      targets: [{ name: "widgets", skipped: null }], budgetExceeded: false,
    }, reruns: { F1: 3 }, pr: { title: "feat: 表示を追加", labels: [] },
  };
}
const sample = JSON.parse(await fs.readFile(new URL("./fixtures/results/valid-a.json", import.meta.url), "utf8"));
