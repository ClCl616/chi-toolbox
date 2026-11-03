import { returnPath, loginFailureUrl } from '../return-path';
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/server/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dev = url.searchParams.get('screen') === 'dev';
  const next = returnPath(
    url.searchParams.get('next'),
    dev ? '/dev/dashboard' : '/',
  );
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${url.origin}/auth/callback?next=${encodeURIComponent(next)}${dev ? '&screen=dev' : ''}`,
      },
    });
    if (error || !data.url) throw error ?? new Error('OAuth URL이 없습니다.');
    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(
      loginFailureUrl(url.origin, 'google-config', next, dev),
    );
  }
}
