import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:13002';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Only local servers allowed.');
await mkdir('work/qa', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.TEST_BROWSER ?? 'chromium',
});
const errors = [];
const apiRequests = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  });
  await context.route('**/api/**', (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  // Old hidden-card preferences must neither hide cards nor be deleted.
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem(
      'chi-toolbox-dashboard-layout-v1',
      '[{"id":"news","visible":false},{"id":"assignments","visible":false}]',
    );
  });
  await page.goto(`${base}/toolbox`);
  await page
    .getByRole('link', { name: '새 소식 · 미연결', exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole('button', { name: '카드 편집' }).count(),
    0,
  );
  assert.equal(await page.locator('[data-card]').count(), 2);
  assert.equal(
    await page.getByText('필요한 카드만, 원하는 순서로.').count(),
    0,
  );
  await page.screenshot({ path: 'work/qa/toolbox-canvas-desktop.png' });
  await page
    .getByRole('link', { name: '새 소식 · 미연결', exact: true })
    .click();
  await page.getByRole('heading', { name: 'LMS 미연결' }).waitFor();
  await page
    .getByRole('navigation', { name: 'LMS 보기' })
    .getByRole('link', { name: '남은 과제' })
    .click();
  await page.waitForURL('**/toolbox/lms/assignments');
  await page.reload();
  await page.getByRole('heading', { name: 'LMS 미연결' }).waitFor();
  await page.goBack();
  await page.waitForURL('**/toolbox/lms');

  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [820, 900],
    [821, 900],
    [1440, 900],
    [1920, 1080],
    [740, 390],
    [1440, 500],
  ]) {
    await page.setViewportSize({ width, height });
    for (const path of [
      '/toolbox',
      '/toolbox/lms',
      '/toolbox/lms/assignments',
      '/toolbox/settings',
    ]) {
      await page.goto(`${base}${path}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Page horizontal overflow ${width} ${path}`,
      );
    }
    for (const count of [1, 2, 3, 4, 5, 6, 7, 10, 16]) {
      await page.goto(`${base}/toolbox`);
      const canvas = page.getByRole('region', { name: '대시보드 카드' });
      await canvas.waitFor();
      // Layout-only fixtures: clone empty card DOM, never add sample records to the app.
      await canvas.evaluate((element, size) => {
        const original = element.firstElementChild;
        while (element.children.length < size)
          element.append(original.cloneNode(true));
        while (element.children.length > size)
          element.lastElementChild.remove();
      }, count);
      const metrics = await canvas.evaluate((element) => ({
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        height: element.clientHeight,
        scrollHeight: element.scrollHeight,
        pageHeight: document.documentElement.scrollHeight,
        viewport: innerHeight,
        lastHeight: element.lastElementChild.getBoundingClientRect().height,
      }));
      assert.ok(
        metrics.pageHeight <= metrics.viewport + 1,
        `Vertical page scroll ${width}x${height}/${count}: ${JSON.stringify(metrics)}`,
      );
      assert.ok(
        metrics.scrollHeight <= metrics.height + 1,
        `Vertical canvas overflow ${width}x${height}/${count}`,
      );
      assert.ok(metrics.lastHeight > 90, 'Card must remain legible');
      if (count === 2 && height >= 600)
        assert.ok(
          metrics.scrollWidth <= metrics.width + 1,
          `Two cards must fit ${width}`,
        );
      if (count >= 7) {
        assert.ok(
          metrics.scrollWidth > metrics.width,
          `Canvas must expand for ${count} cards`,
        );
        await canvas.hover();
        await page.mouse.wheel(0, 180);
        await page.waitForFunction(
          () =>
            document.querySelector('[aria-label="대시보드 카드"]').scrollLeft >
            0,
        );
        await canvas.locator('a').last().focus();
        const last = await canvas.locator('a').last().boundingBox();
        const bounds = await canvas.boundingBox();
        assert.ok(
          last.x < bounds.x + bounds.width && last.x + last.width > bounds.x,
          'Focused card must scroll into view',
        );
      }
      if (width === 390 && count === 2)
        await page.screenshot({ path: 'work/qa/toolbox-canvas-mobile.png' });
      if (width === 1440 && height === 900 && count === 7)
        await page.screenshot({
          path: 'work/qa/toolbox-canvas-overflow-test.png',
        });
    }
  }
  assert.deepEqual(apiRequests, []);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: 4 routes, 8 viewport sizes, 1–16 cards, no vertical scroll, wheel and focus navigation, no API calls.',
  );
} finally {
  await browser.close();
}
