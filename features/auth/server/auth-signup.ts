import { v2ReturnPath } from '../return-path';
import { NextResponse } from 'next/server';
import { createClient } from '@/shared/server/server';
export async function POST(request: Request) {
  try {
    const { email, password, screen, returnTo } = (await request.json()) as {
      email?: unknown;
      screen?: unknown;
      returnTo?: unknown;
      password?: unknown;
    };
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      password.length < 8
    )
      return NextResponse.json(
        { message: '올바른 이메일과 8자 이상의 비밀번호를 입력해주세요.' },
        { status: 400 },
      );
    const supabase = await createClient();
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback${screen === 'v2' ? '?screen=v2&next=' + encodeURIComponent(v2ReturnPath(typeof returnTo === 'string' ? returnTo : null)) : ''}`,
      },
    });
    if (error)
      return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, signedIn: Boolean(data.session) });
  } catch {
    return NextResponse.json(
      { message: 'Supabase 연결이 아직 설정되지 않았습니다.' },
      { status: 503 },
    );
  }
}
