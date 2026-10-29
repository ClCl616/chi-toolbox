import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:13002';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Only local test servers are allowed.');
const key = 'chi-toolbox-dashboard-layout-v1';
await mkdir('work/qa', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.TEST_BROWSER ?? 'chromium',
});
const errors = [];
const apiRequests = [];
async function createContext() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
  });
  await context.route('**/api/**', (route) => {
    apiRequests.push(route.request().url());
    return route.abort();
  });
  context.on('page', (page) =>
    page.on('pageerror', (error) => errors.push(error.message)),
  );
  return context;
}
try {
  const context = await createContext();
  const page = await context.newPage();
  const edit = () =>
    page.getByRole('button', { name: '카드 편집', exact: true });
  const cards = () => page.locator('[data-card]');
  async function assertCards(ids) {
    await page.waitForFunction(
      (expected) =>
        JSON.stringify(
          [...document.querySelectorAll('[data-card]')].map((node) =>
            node.getAttribute('data-card'),
          ),
        ) === JSON.stringify(expected),
      ids,
    );
  }
  await page.goto(`${base}/toolbox`);
  await assertCards(['news', 'assignments']);
  assert.equal(
    await page.locator('[aria-label="연결 전, 집계되지 않음"]').count(),
    2,
  );
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').innerText(), '본문으로 이동');
  await page.keyboard.press('Enter');
  assert.equal(
    await page.locator(':focus').getAttribute('id'),
    'toolbox-content',
  );
  await page.screenshot({
    path: 'work/qa/toolbox-dashboard-desktop.png',
    fullPage: true,
  });

  await page
    .getByRole('link', {
      name: '읽지 않은 LMS 소식 · LMS 연결 필요 · 소식 확인',
      exact: true,
    })
    .click();
  await page
    .getByRole('heading', { name: 'LMS 소식을 기다리고 있어요' })
    .waitFor();
  await page
    .getByRole('navigation', { name: 'LMS 보기' })
    .getByRole('link', { name: '남은 과제', exact: true })
    .click();
  await page
    .getByRole('heading', { name: '과제를 확인하려면 연결이 필요해요' })
    .waitFor();
  assert.ok(page.url().endsWith('/toolbox/lms/assignments'));
  await page.reload();
  await page
    .getByRole('heading', { name: '과제를 확인하려면 연결이 필요해요' })
    .waitFor();
  await page.goBack();
  await page
    .getByRole('heading', { name: 'LMS 소식을 기다리고 있어요' })
    .waitFor();
  await page.screenshot({
    path: 'work/qa/toolbox-lms-desktop.png',
    fullPage: true,
  });
  await page
    .getByRole('navigation', { name: '주 메뉴' })
    .getByRole('link', { name: '대시보드' })
    .click();
  await assertCards(['news', 'assignments']);

  await edit().click();
  await page.getByRole('switch', { name: '읽지 않은 LMS 소식 표시' }).uncheck();
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await assertCards(['news', 'assignments']);
  await edit().click();
  await page.getByRole('button', { name: '남은 과제 앞으로 이동' }).click();
  await page.getByRole('switch', { name: '읽지 않은 LMS 소식 표시' }).uncheck();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await assertCards(['assignments']);
  await page.reload();
  await assertCards(['assignments']);
  await edit().click();
  await page.getByRole('switch', { name: '읽지 않은 LMS 소식 표시' }).check();
  // A mouse can drag; touch and keyboard users have explicit reorder buttons.
  await page
    .locator('[data-card="news"] [draggable="true"]')
    .dragTo(page.locator('[data-card="assignments"] h2'));
  await assertCards(['news', 'assignments']);
  await page.screenshot({
    path: 'work/qa/toolbox-edit-desktop.png',
    fullPage: true,
  });
  await page.getByRole('switch', { name: '읽지 않은 LMS 소식 표시' }).uncheck();
  await page.getByRole('switch', { name: '남은 과제 표시' }).uncheck();
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page
    .getByRole('heading', { name: '표시할 카드를 선택해 주세요' })
    .waitFor();
  await page.reload();
  await page.getByRole('button', { name: '카드 선택', exact: true }).click();
  await page.getByRole('switch', { name: '읽지 않은 LMS 소식 표시' }).check();
  await page.getByRole('switch', { name: '남은 과제 표시' }).check();
  await page.getByRole('button', { name: '저장', exact: true }).click();

  for (const width of [320, 390, 820, 821, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/toolbox',
      '/toolbox/lms',
      '/toolbox/lms/assignments',
      '/toolbox/settings',
    ]) {
      await page.goto(`${base}${path}`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      if (path === '/toolbox') await assertCards(['news', 'assignments']);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `Overflow: ${width} ${path}`,
      );
      const nav = await page
        .getByRole('navigation', { name: '주 메뉴' })
        .boundingBox();
      assert.ok(nav);
      if (width <= 820)
        assert.ok(
          nav.y > 700 && nav.y + nav.height <= 901,
          'Mobile menu must stay at bottom',
        );
      else
        assert.ok(
          nav.x < 240 && nav.width < 240,
          'Desktop menu must stay at left',
        );
      if (width === 390)
        await page.screenshot({
          path: `work/qa/toolbox-${path.split('/').at(-1)}-mobile.png`,
          fullPage: true,
        });
    }
    await page.goto(`${base}/toolbox`);
    await assertCards(['news', 'assignments']);
    await edit().click();
    await page.getByRole('button', { name: '남은 과제 앞으로 이동' }).click();
    await assertCards(['assignments', 'news']);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Edit overflow: ${width}`,
    );
    await page.getByRole('button', { name: '취소', exact: true }).click();
  }
  assert.equal(await cards().count(), 2);
  await context.close();

  const corrupt = await createContext();
  await corrupt.addInitScript((storageKey) => {
    if (location.protocol === 'http:')
      localStorage.setItem(storageKey, '{invalid');
  }, key);
  const corruptedPage = await corrupt.newPage();
  await corruptedPage.goto(`${base}/toolbox`);
  await corruptedPage
    .getByRole('link', { name: /읽지 않은 LMS 소식 ·/ })
    .waitFor();
  assert.equal(await corruptedPage.locator('[data-card]').count(), 2);
  await corrupt.close();

  const blocked = await createContext();
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  const blockedPage = await blocked.newPage();
  await blockedPage.goto(`${base}/toolbox`);
  await blockedPage.getByRole('alert').waitFor();
  await blockedPage
    .getByRole('button', { name: '카드 편집', exact: true })
    .click();
  await blockedPage.getByRole('button', { name: '저장', exact: true }).click();
  assert.match(
    await blockedPage.getByRole('alert').innerText(),
    /저장하지 못했어요/,
  );
  assert.equal(
    await blockedPage
      .getByRole('button', { name: '취소', exact: true })
      .count(),
    1,
  );
  await blocked.close();
  assert.deepEqual(
    apiRequests,
    [],
    'UI foundation must not fetch or mutate API data',
  );
  assert.deepEqual(errors, [], 'No browser runtime/hydration errors');
  console.log(
    'Toolbox: navigation, history, drag/buttons, save/cancel, empty/blocked/corrupt storage and 4 routes × 5 widths passed. No API calls.',
  );
} finally {
  await browser.close();
}
