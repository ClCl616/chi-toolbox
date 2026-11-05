import { returnPath, v2ReturnPath, loginFailureUrl } from '../return-path';
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/server/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const dev = ['dev', 'v2'].includes(url.searchParams.get('screen') ?? '');
  const next = dev
    ? v2ReturnPath(url.searchParams.get('next'))
    : returnPath(url.searchParams.get('next'));
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
