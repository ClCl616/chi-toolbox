type VerifiedUser = {
  email?: string;
  email_confirmed_at?: string;
  is_anonymous?: boolean;
} | null;

/** Only pass a user returned by the Auth server, never client metadata or decoded cookies. */
export function isLmsOwner(user: VerifiedUser, owner: string | undefined) {
  return !!(
    owner?.trim() &&
    user?.email_confirmed_at &&
    !user.is_anonymous &&
    user.email?.trim().toLowerCase() === owner.trim().toLowerCase()
  );
}

export function sameSiteRequest(request: Request, site: string) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  let expected: string;
  try {
    expected = new URL(site).origin;
  } catch {
    return false;
  }
  const origin = request.headers.get('origin');
  return request.method === 'GET'
    ? !origin || origin === expected
    : origin === expected;
}
