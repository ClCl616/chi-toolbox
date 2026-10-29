import { withAuth } from '@/shared/server/with-auth';
import { NextResponse } from 'next/server';

export const GET = withAuth(async (_request, { supabase }) => {
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('id,task,mode,duration_seconds,completed_at')
    .order('completed_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return NextResponse.json({ sessions: data });
});

export const POST = withAuth(async (request, { supabase, user }) => {
  const body = (await request.json()) as Record<
    string,
    string | number | boolean | null | undefined
  >;
  if (
    typeof body.durationSeconds !== 'number' ||
    body.durationSeconds < 1 ||
    body.durationSeconds > 14_400 ||
    typeof body.mode !== 'string' ||
    !['focus', 'short', 'long'].includes(body.mode)
  )
    return NextResponse.json(
      { message: '잘못된 세션입니다.' },
      { status: 400 },
    );
  const { data, error } = await supabase
    .from('focus_sessions')
    .insert({
      user_id: user.id,
      task: String(body.task ?? '')
        .trim()
        .slice(0, 80),
      mode: body.mode,
      duration_seconds: Math.round(body.durationSeconds),
    })
    .select('id,task,mode,duration_seconds,completed_at')
    .single();
  if (error) throw error;
  return NextResponse.json({ session: data }, { status: 201 });
});

export const DELETE = withAuth(async (request, { supabase }) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id)
    return NextResponse.json(
      { message: '삭제할 기록을 선택해주세요.' },
      { status: 400 },
    );
  const { error } = await supabase.from('focus_sessions').delete().eq('id', id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
