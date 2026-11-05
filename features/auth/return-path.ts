export function returnPath(value: string | null, fallback = '/') {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return fallback;
  // Browsers strip tabs and newlines when interpreting navigation targets.
  for (const char of value) if (char.charCodeAt(0) < 32) return fallback;
  return value;
}

export function loginFailureUrl(
  origin: string,
  error: string,
  next: string,
  dev = false,
) {
  const url = new URL(dev ? '/v2/login' : '/login', origin);
  url.searchParams.set('error', error);
  if (next !== '/') url.searchParams.set('returnTo', next);
  return url;
}

export function v2ReturnPath(value: string | null) {
  const fallback = '/v2/dashboard';
  const safe = returnPath(value, fallback);
  const aliases: Record<string, string> = {
    '/toolbox': fallback,
    '/dev/dashboard': fallback,
    '/toolbox/lms': '/v2/lms',
    '/toolbox/lms/assignments': '/v2/lms/assignments',
    '/toolbox/settings': '/v2/settings',
  };
  const url = new URL(safe, 'https://local.invalid');
  const pathname = aliases[url.pathname] ?? url.pathname;
  if (
    ![
      '/v2/dashboard',
      '/v2/lms',
      '/v2/lms/assignments',
      '/v2/settings',
    ].includes(pathname)
  )
    return fallback;
  return pathname + url.search + url.hash;
}
