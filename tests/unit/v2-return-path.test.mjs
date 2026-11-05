import test from 'node:test';
import assert from 'node:assert/strict';
import {
  v2ReturnPath,
  returnPath,
  loginFailureUrl,
} from '../../features/auth/return-path.ts';
test('v2 return targets stay in known workspace routes and preserve query/hash', () => {
  for (const value of [
    null,
    'https://evil.invalid',
    '//evil.invalid',
    '/v2/login',
    '/v2/signup',
    '/v2/../login',
    '/v2/%2e%2e/login',
    '/v2/lms/../../login',
    '/v2/unknown',
    '/\\evil.invalid',
    '/\tevil.invalid',
  ])
    assert.equal(v2ReturnPath(value), '/v2/dashboard', String(value));
  assert.equal(
    v2ReturnPath('/v2/lms/assignments?view=open#top'),
    '/v2/lms/assignments?view=open#top',
  );
  assert.equal(v2ReturnPath('/toolbox/lms/assignments'), '/v2/lms/assignments');
  assert.equal(v2ReturnPath('/dev/dashboard'), '/v2/dashboard');
  assert.equal(returnPath('/?view=files'), '/?view=files');
  assert.equal(
    loginFailureUrl('https://example.invalid', 'callback', '/v2/lms', true)
      .pathname,
    '/v2/login',
  );
  assert.equal(
    loginFailureUrl('https://example.invalid', 'callback', '/').pathname,
    '/login',
  );
});
