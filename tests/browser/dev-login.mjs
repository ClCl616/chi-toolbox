import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:13002';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('Local test server required');
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER ?? 'chromium',
});
try {
  const page = await browser.newPage({ serviceWorkers: 'block' });
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(base + '/v2/login');
    const login = page.getByRole('button', { name: '로그인', exact: true });
    const google = page.getByRole('button', { name: 'Google로 계속하기' });
    const email = page.getByLabel('이메일', { exact: true });
    const password = page.getByLabel('비밀번호', { exact: true });
    await login.waitFor();
    const g = await google.boundingBox(),
      e = await email.boundingBox();
    assert.ok(width === 1440 ? g.x < e.x : g.y > e.y);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );

    await login.click();
    assert.equal(
      await email.evaluate((n) => document.activeElement === n),
      true,
    );
    await page.getByText('이메일을 입력해 주세요.', { exact: true }).waitFor();
    await email.fill('bad');
    await page.getByText('이메일 주소 형식을 확인해 주세요.').waitFor();
    await email.fill('tester@example.test');
    await password.fill('short');
    await page
      .getByRole('button', { name: '비밀번호 표시', exact: true })
      .click();
    assert.equal(await password.getAttribute('type'), 'text');
    assert.equal(await password.inputValue(), 'short');
    await page
      .getByRole('button', { name: '비밀번호 숨기기', exact: true })
      .click();
    assert.equal(await password.getAttribute('type'), 'password');
    let attempts = 0;
    await page.route('**/api/auth/login', async (route) => {
      assert.equal(route.request().postDataJSON().password, 'short');
      attempts++;
      if (attempts === 1) return route.abort();
      if (attempts === 2) return route.fulfill({ status: 401, json: {} });
      if (attempts === 3) return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ status: 200, json: { ok: true } });
    });
    await login.click();
    await page.getByText(/연결하지 못했어요/).waitFor();
    await password.press('Enter');
    await page.getByText('이메일 또는 비밀번호를 확인해 주세요.').waitFor();
    await login.click();
    await page.getByText(/인증 서비스를 이용할 수 없어요/).waitFor();
    assert.equal(await email.inputValue(), 'tester@example.test');
    assert.equal(await password.inputValue(), 'short');
    await login.click();
    await page.waitForURL(base + '/v2/dashboard');
    await page.unroute('**/api/auth/login');
  }
  await page.goto(base + '/v2/login');
  await page.route('**/api/auth/google?*', async (route) => {
    assert.equal(
      new URL(route.request().url()).searchParams.get('next'),
      '/v2/dashboard',
    );
    await route.fulfill({
      status: 302,
      headers: {
        location:
          base +
          '/auth/callback?error=access_denied&next=%2Fv2%2Fdashboard&screen=v2',
      },
    });
  });
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await page
    .getByText('Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.')
    .filter({ visible: true })
    .waitFor();
  assert.equal(
    new URL(page.url()).searchParams.get('returnTo'),
    '/v2/dashboard',
  );
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await page
    .getByRole('button', { name: '계정 만들기', exact: true })
    .waitFor();
  await page.getByRole('button', { name: '계정 만들기' }).waitFor();
  await page.getByRole('button', { name: '로그인으로 돌아가기' }).click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(base + '/v2/login?returnTo=%2Fv2%2Fdashboard');
    await page.getByRole('button', { name: '회원가입', exact: true }).click();
    await page
      .getByRole('button', { name: '계정 만들기', exact: true })
      .waitFor();
    const email = page.getByLabel('이메일', { exact: true });
    const password = page.getByLabel('비밀번호', { exact: true });
    const create = page.getByRole('button', {
      name: '계정 만들기',
      exact: true,
    });
    const g = await page
      .getByRole('button', { name: 'Google로 계속하기' })
      .boundingBox();
    const e = await email.boundingBox();
    assert.ok(width === 1440 ? g.x < e.x : g.y > e.y);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await email.fill('tester@example.test');
    await password.fill('short');
    await create.click();
    await page.getByText('비밀번호를 8자 이상 입력해 주세요.').waitFor();
    await password.fill('test-password');
    await page
      .getByRole('button', { name: '비밀번호 표시', exact: true })
      .click();
    assert.equal(await password.getAttribute('type'), 'text');
    await page.getByRole('button', { name: '로그인으로 돌아가기' }).click();
    assert.equal(await password.getAttribute('type'), 'password');
    assert.equal(await password.inputValue(), '');
    await page.getByRole('button', { name: '회원가입', exact: true }).click();
    await page
      .getByRole('button', { name: '계정 만들기', exact: true })
      .waitFor();
    assert.equal(
      await email.inputValue(),
      'tester@example.test',
      'Email retained between auth routes',
    );
    await password.fill('test-password');
    let attempts = 0;
    await page.route('**/api/auth/signup', (route) => {
      assert.equal(route.request().postDataJSON().email, 'tester@example.test');
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 400, json: {} });
      return route.fulfill({
        status: 200,
        json: { ok: true, signedIn: attempts > 2 },
      });
    });
    await create.click();
    await page
      .getByText('가입하지 못했어요. 입력 내용을 확인해 주세요.')
      .waitFor();
    await create.click();
    await page
      .getByText('가입 요청을 처리했어요. 로그인으로 돌아가 계속해 주세요.')
      .waitFor();
    await create.click();
    await page.waitForURL(base + '/v2/dashboard');
    await page.unroute('**/api/auth/signup');
  }
  await page.goto(base + '/v2/login');
  await page.getByRole('button', { name: '회원가입', exact: true }).click();
  await page
    .getByRole('button', { name: '계정 만들기', exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Google로 계속하기' }).click();
  await page
    .getByText('Google 로그인을 완료하지 못했어요. 다시 시도해 주세요.')
    .filter({ visible: true })
    .waitFor();
  await page.route('**/api/toolbox/lms', (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto(base + '/v2/dashboard');
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await page.waitForURL(base + '/v2/login?returnTo=%2Fv2%2Fdashboard');
  await page.goto(base + '/login');
  await page.getByRole('heading', { name: '반가워요.' }).waitFor();
  const g = await fetch(base + '/api/auth/google?screen=v2', {
    redirect: 'manual',
  });
  const loc = new URL(g.headers.get('location'));
  const cb = new URL(loc.searchParams.get('redirect_to'));
  assert.equal(cb.pathname, '/auth/callback');
  assert.equal(cb.searchParams.get('screen'), 'v2');
  assert.equal(cb.searchParams.get('next'), '/v2/dashboard');
  await page.goto(base + '/v2/signup?returnTo=%2Fv2%2Flms%2Fassignments');
  await page
    .getByRole('button', { name: '계정 만들기', exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole('button', { name: '계정 만들기', exact: true })
    .waitFor();
  await page.getByRole('button', { name: '로그인으로 돌아가기' }).click();
  await page.waitForURL('**/v2/login?returnTo=%2Fv2%2Flms%2Fassignments');
  await page.goBack();
  await page
    .getByRole('button', { name: '계정 만들기', exact: true })
    .waitFor();
  await page.goForward();
  await page.getByRole('button', { name: '로그인', exact: true }).waitFor();
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({ status: 200, json: { ok: true } }),
  );
  await page.getByLabel('이메일', { exact: true }).fill('tester@example.test');
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL(base + '/v2/lms/assignments');
  await page.getByRole('link', { name: '로그인', exact: true }).click();
  await page.waitForURL('**/v2/login?returnTo=%2Fv2%2Flms%2Fassignments');
  for (const target of [
    '/v2/lms/assignments',
    'https://evil.invalid',
    '/v2/../login',
  ]) {
    const response = await fetch(
      base +
        '/auth/callback?error=access_denied&screen=v2&next=' +
        encodeURIComponent(target),
      { redirect: 'manual' },
    );
    const location = new URL(response.headers.get('location'), base);
    assert.equal(location.pathname, '/v2/login');
    assert.equal(
      location.searchParams.get('returnTo'),
      target === '/v2/lms/assignments' ? target : '/v2/dashboard',
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: desktop + mobile login/signup layout, password visibility/reset, validation/focus, failure/retry, signup session/fallback, email return and Google callback/return from both modes.',
  );
} finally {
  await browser.close();
}
