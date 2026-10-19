# Playwright の test:e2e に組み込む

検出の正本は、このスキルの `scripts/detect.js`。helper に検出ロジックを写さず、`page.addScriptTag` で読み込んで `page.evaluate` から呼ぶ。
実行の入口は各リポジトリの `test:e2e` に限る。`test` や `pretest` から呼ばず、GitHub Actions でも回さない（standards DOCS_OPS §6 の MUST NOT）。

以下は `@playwright/test` の例。`detectorPath` をインストールしたファイルの絶対パスにする。
移動前の `addInitScript` も入れると、閉じた shadow root の host を記録できる。
移動後の `addScriptTag` だけで読み込んだ場合は、既にある閉じた root の数が分からないため `info.unscanned.closedShadowRoot` は `null`（未計測）になる。

```ts
import { test, expect } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';

const detectorPath = path.join(os.homedir(), '.agents/skills/layout-geometry-check/scripts/detect.js');

test('狭い幅で位置関係が変わる → 候補と未走査情報を記録する', async ({ page }, testInfo) => {
  const url = 'http://127.0.0.1:3000/';
  const widths = [1280, 768, 320];
  await page.setViewportSize({ width: widths[0], height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript({ path: detectorPath });
  const response = await page.goto(url, { waitUntil: 'load' });
  expect(response?.status()).toBeGreaterThanOrEqual(200);
  expect(response?.status()).toBeLessThan(300);
  const canonical = (value: string) => {
    const parsed = new URL(value);
    return parsed.host + parsed.pathname.replace(/\/+$/, '');
  };
  expect(canonical(page.url())).toBe(canonical(url));
  let networkidleTimedOut = false;
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
    networkidleTimedOut = true;
  }
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ path: detectorPath });
  const samples = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      (window as any).layoutGeometryCheck.freezeAnimations();
      const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
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
    const sample = await page.evaluate(({ width, referenceWidth }) => {
      const detector = (window as any).layoutGeometryCheck;
      return detector.scan({ width, isReference: width === referenceWidth, rules: ['R1'], exclude: [], maxIncomparable: 0.3 });
    }, { width, referenceWidth: widths[0] });
    samples.push({ width, ...sample });
    expect(sample.reason).toBe('');
    expect(sample.checked).toBeGreaterThan(0);
  }
  await testInfo.attach('layout-geometry', {
    body: JSON.stringify({ samples, networkidleTimedOut }, null, 2),
    contentType: 'application/json',
  });
});
```

この例は候補と測定範囲を記録する。結果を確認してから、プロジェクト側で承認した基準線と（URL の正規形、規則、キー、幅）の組を比較する。
固定件数を合格条件にしない。基準幅の R2〜R4 は `info.atReference` に残るので、それも確認する。
同じページを読み込み直すと Element の対応表は消える。最大幅から狭い幅まで、1 回の読み込みの中で測る。
dark でも別に実行する。クラスや属性でテーマを変更するアプリは、アプリ側の操作を別途用意する。
