import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isLmsOwner,
  sameSiteRequest,
} from '../../features/lms/server/access-policy.ts';
const owner = 'owner@example.invalid';
const user = {
  email: owner,
  email_confirmed_at: '2026-11-02T00:00:00Z',
  is_anonymous: false,
};
test('LMS requires server-verified confirmed owner and rejects metadata impersonation', () => {
  assert.equal(isLmsOwner(user, owner), true);
  assert.equal(isLmsOwner(user, owner.toUpperCase()), true);
  assert.equal(isLmsOwner(null, owner), false);
  assert.equal(isLmsOwner(user, undefined), false);
  assert.equal(
    isLmsOwner({ ...user, email_confirmed_at: undefined }, owner),
    false,
  );
  assert.equal(isLmsOwner({ ...user, is_anonymous: true }, owner), false);
  assert.equal(
    isLmsOwner(
      {
        ...user,
        email: 'other@example.invalid',
        user_metadata: { email: owner },
      },
      owner,
    ),
    false,
  );
});
test('LMS mutations require configured origin and reject cross-site reads', () => {
  const url = 'https://toolbox.example.invalid';
  assert.equal(sameSiteRequest(new Request(url), url), true);
  assert.equal(
    sameSiteRequest(
      new Request(url, { headers: { 'Sec-Fetch-Site': 'cross-site' } }),
      url,
    ),
    false,
  );
  assert.equal(
    sameSiteRequest(new Request(url, { method: 'POST' }), url),
    false,
  );
  assert.equal(
    sameSiteRequest(
      new Request(url, { method: 'POST', headers: { Origin: url } }),
      url,
    ),
    true,
  );
  assert.equal(
    sameSiteRequest(
      new Request(url, {
        method: 'POST',
        headers: { Origin: 'https://other.example.invalid' },
      }),
      url,
    ),
    false,
  );
});
