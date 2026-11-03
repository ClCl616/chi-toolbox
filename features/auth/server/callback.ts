import { returnPath, loginFailureUrl } from '../return-path';
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/server/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const dev = url.searchParams.get('screen') === 'dev';
  const next = returnPath(
    url.searchParams.get('next'),
    dev ? '/dev/dashboard' : '/',
  );
  if (url.searchParams.has('error') || (dev && !code))
    return NextResponse.redirect(
      loginFailureUrl(url.origin, 'callback', next, dev),
    );
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } catch {
      return NextResponse.redirect(
        loginFailureUrl(url.origin, 'callback', next, dev),
      );
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
