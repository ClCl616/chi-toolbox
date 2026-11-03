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
  const url = new URL(dev ? '/dev/login' : '/login', origin);
  url.searchParams.set('error', error);
  if (next !== '/') url.searchParams.set('returnTo', next);
  return url;
}
