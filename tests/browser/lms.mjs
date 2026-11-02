import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { chromium } from 'playwright';
const base = process.env.TEST_BASE_URL;
const data = process.env.TOOLBOX_LMS_DATA;
if (
  !base ||
  !['127.0.0.1', 'localhost'].includes(new URL(base).hostname) ||
  !data
)
  throw new Error('Isolated local test server required');
const now = Date.now();
const date = (offset) => new Date(now + offset * 86400000).toISOString();
const events = Array.from({ length: 18 }, (_, i) => ({
  id: `event:${i + 1}`,
  sequence: i + 1,
  kind: i >= 16 ? 'system' : 'news',
  title:
    i === 16
      ? '수집 실패 알림'
      : i === 17
        ? '수집 복구 알림'
        : `테스트 소식 ${i + 1}`,
  course: '테스트 과목',
  category: i >= 16 ? '상태 알림' : '공지',
  body: '테스트 전용 본문',
  detectedAt: date(-1),
}));
const item = {
  id: 'a',
  course: '테스트 과목',
  title: '남은 과제 테스트',
  submitted: false,
  deadline: date(1),
  deadlineText: '',
  extensionAllowed: false,
  extensionDeadline: null,
  stale: false,
};
const snapshot = {
  version: 1,
  status: 'healthy',
  assignmentsReady: true,
  lastAttempt: date(0),
  lastSuccess: date(0),
  events,
  assignments: [
    item,
    { ...item, id: 'b', title: '기한 지난 테스트', deadline: date(-1) },
    { ...item, id: 'c', title: '미확인 테스트', submitted: null },
    { ...item, id: 'd', title: '제출 완료 테스트', submitted: true },
  ],
};
const initialReads = events.slice(0, 12).map((e) => e.id);
await writeFile(join(data, 'snapshot.json'), JSON.stringify(snapshot));
await writeFile(join(data, 'read.json'), JSON.stringify(initialReads));
const request = (path, options) =>
  fetch(`${base}/api/toolbox/lms${path}`, options);
assert.equal((await (await request('')).json()).enabled, true);
assert.equal(
  (
    await (
      await request('', { headers: { Origin: 'https://example.invalid' } })
    ).json()
  ).enabled,
  false,
);
const foreignHost = await new Promise((resolve, reject) => {
  const req = httpRequest(
    `${base}/api/toolbox/lms`,
    { headers: { Host: 'example.invalid' } },
    (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => resolve(JSON.parse(body)));
    },
  );
  req.on('error', reject);
  req.end();
});
assert.equal(foreignHost.enabled, false);
assert.equal(
  (await request('/read', { method: 'POST', body: '{"ids":[]}' })).status,
  403,
);
const post = (ids) =>
  request('/read', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
await Promise.all([post(['event:13']), post(['event:14', 'nonexistent'])]);
const merged = (await (await request('')).json()).readIds;
assert.ok(
  merged.includes('event:13') &&
    merged.includes('event:14') &&
    !merged.includes('nonexistent'),
);
await writeFile(join(data, 'read.json'), JSON.stringify(initialReads));
await mkdir('work/qa', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER ?? 'chromium',
  headless: true,
});
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/toolbox`);
  await page
    .getByRole('link', { name: '새 소식 · 4 · 상태 알림 2', exact: true })
    .waitFor();
  await page
    .getByRole('link', { name: '남은 과제 · 1', exact: true })
    .waitFor();
  await page.screenshot({ path: 'work/qa/lms-dashboard-test.png' });
  await page.getByRole('link', { name: '남은 과제 · 1', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/toolbox/lms' && !url.search && !url.hash);
  for (const title of ['남은 과제 테스트', '기한 지난 테스트', '미확인 테스트'])
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
  assert.equal(await page.getByText('제출 완료 테스트').count(), 0);
  assert.deepEqual(
    (await (await request('')).json()).readIds,
    initialReads,
    'Assignment tab must not read feed',
  );
  await page
    .getByRole('navigation', { name: 'LMS 보기' })
    .getByRole('button', { name: /새 소식/ })
    .click();
  await page.locator('[data-read-id="event:13"]').waitFor();
  await page.waitForFunction(() => {
    const r = document
      .querySelector('[data-read-id="event:13"]')
      .getBoundingClientRect();
    return r.top >= 0 && r.bottom < innerHeight;
  });
  await page
    .getByRole('article')
    .filter({ hasText: '테스트 소식 13' })
    .getByText('읽음', { exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole('link', { name: 'LMS에서 열기' }).count(),
    0,
  );
  assert.equal(await page.getByRole('button', { name: /수집/ }).count(), 0);
  await page.screenshot({ path: 'work/qa/lms-feed-test.png' });
  // Mark every visible message by scrolling. Expanding the body is not required.
  for (const event of events.slice(12)) {
    const header = page.locator(`[data-read-id="${event.id}"]`);
    await header.evaluate((element) =>
      element.scrollIntoView({ block: 'center' }),
    );
    await header.getByText('읽음', { exact: true }).waitFor();
  }
  await page.goto(`${base}/toolbox`);
  await page.getByRole('link', { name: '새 소식 · 0', exact: true }).waitFor();
  assert.equal(await page.getByText(/상태 알림/).count(), 0);
  // A failed save must not reduce unread counts or lose the next revisit position.
  await writeFile(join(data, 'read.json'), JSON.stringify(initialReads));
  await context.route('**/api/toolbox/lms/read', (route) =>
    route.fulfill({ status: 503, json: { error: 'Synthetic test failure' } }),
  );
  await page.goto(`${base}/toolbox/lms`);
  await page
    .getByText('읽음 상태를 저장하지 못했어요.', { exact: false })
    .waitFor();
  assert.deepEqual((await (await request('')).json()).readIds, initialReads);
  await context.unroute('**/api/toolbox/lms/read');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/toolbox/lms/assignments`);
  await page
    .getByRole('heading', { name: '남은 과제 테스트', exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: 'work/qa/lms-assignments-mobile-test.png' });
  // Empty categories disappear, but unknown tasks must not disappear with missing deadlines.
  await writeFile(
    join(data, 'snapshot.json'),
    JSON.stringify({
      ...snapshot,
      assignments: [
        item,
        { ...item, id: 'next', title: '다음 과제', deadline: date(2) },
        { ...item, id: 'later', title: '나중 과제', deadline: date(6) },
      ],
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await page.getByRole('heading', { name: '나중 과제', exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole('region', { name: '기한 지난 과제', exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole('region', { name: '확인 필요한 과제', exact: true })
      .count(),
    0,
  );
  await page.screenshot({ path: 'work/qa/lms-assignment-cards-test.png' });
  for (const width of [320, 390, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Assignment overflow at ${width}`,
    );
  }
  await writeFile(
    join(data, 'snapshot.json'),
    JSON.stringify({ ...snapshot, assignments: [] }),
  );
  await page.reload();
  await page
    .getByRole('heading', { name: '남은 과제가 없어요', exact: true })
    .waitFor();
  assert.equal(await page.locator('[data-group]').count(), 0);
  await writeFile(
    join(data, 'snapshot.json'),
    JSON.stringify({
      ...snapshot,
      events: [{ ...events[0], body: '   ', course: '', category: '' }],
    }),
  );
  await page.goto(`${base}/toolbox/lms`);
  await page.getByRole('article').waitFor();
  assert.equal(
    await page.locator('details').count(),
    0,
    'No empty details control',
  );
  assert.equal(
    await page.getByRole('article').locator('p').count(),
    0,
    'No empty metadata',
  );
  await context.route('**/api/toolbox/lms', (route) =>
    route.fulfill({ status: 401, json: { error: 'login required' } }),
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await page
    .getByRole('heading', { name: '로그인 후 확인할 수 있어요' })
    .waitFor();
  assert.equal(
    await page.getByRole('article').count(),
    0,
    'Expired session clears cached private data',
  );
  await context.unroute('**/api/toolbox/lms');
  await context.route('**/api/toolbox/lms', (route) =>
    route.fulfill({ status: 403, json: { error: 'not owner' } }),
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await page
    .getByRole('heading', { name: '이 계정에는 LMS가 연결되어 있지 않아요' })
    .waitFor();
  assert.equal(await page.getByRole('article').count(), 0);
  await context.unroute('**/api/toolbox/lms');
  // Broken snapshots fail closed rather than publishing empty data as success.
  await writeFile(join(data, 'snapshot.json'), '{broken');
  assert.equal((await request('')).status, 503);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: local API isolation, concurrent reads, independent counts, visible read/save/revisit, assignments, no external LMS links or collect button, mobile layout.',
  );
} finally {
  await browser.close();
}
