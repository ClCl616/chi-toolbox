import { withAuth } from '@/shared/server/with-auth';
import { NextResponse } from 'next/server';
export const GET = withAuth(async (_request, { supabase, user }) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return NextResponse.json({
    profile: {
      email: user.email ?? '',
      displayName: data?.display_name ?? '',
      createdAt: user.created_at,
    },
  });
});
export const PATCH = withAuth(async (request, { supabase, user }) => {
  const body = await request.json().catch(() => null);
  if (
    typeof body?.displayName !== 'string' ||
    !body.displayName.trim() ||
    body.displayName.trim().length > 60
  )
    return NextResponse.json(
      { message: '이름은 1~60자로 입력해주세요.' },
      { status: 400 },
    );
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: body.displayName.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
