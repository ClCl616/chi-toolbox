import { NextResponse } from 'next/server';
import { createClient } from '@/shared/server/server';
export async function POST(request: Request) {
  try {
    const { email, password } = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };
    if (typeof email !== 'string' || typeof password !== 'string')
      return NextResponse.json(
        { message: '이메일과 비밀번호를 확인해주세요.' },
        { status: 400 },
      );
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error && (!error.status || error.status >= 500))
      return NextResponse.json(
        { message: '인증 서비스를 이용할 수 없어요.' },
        { status: 503 },
      );
    if (error)
      return NextResponse.json(
        { message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 },
      );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { message: 'Supabase 연결이 아직 설정되지 않았습니다.' },
      { status: 503 },
    );
  }
}
