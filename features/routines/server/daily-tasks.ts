import { withAuth } from '@/shared/server/with-auth';
import { NextResponse } from 'next/server';
export const GET = withAuth(async (_request, { supabase }) => {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .order('task_date', { ascending: false })
    .limit(200);
  if (error) throw error;
  return NextResponse.json({ tasks: data });
});
export const POST = withAuth(async (request, { supabase, user }) => {
  const body = (await request.json()) as Record<string, unknown>;
  const title = (typeof body.title === 'string' ? body.title : '')
    .trim()
    .slice(0, 100);
  if (!title)
    return NextResponse.json(
      { message: '할 일을 입력해주세요.' },
      { status: 400 },
    );
  const task_date = /^\d{4}-\d{2}-\d{2}$/.test(
    typeof body.task_date === 'string' ? body.task_date : '',
  )
    ? typeof body.task_date === 'string'
      ? body.task_date
      : ''
    : new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_tasks')
    .insert({
      user_id: user.id,
      title,
      task_date,
      note:
        (typeof body.note === 'string' ? body.note : '').trim().slice(0, 500) ||
        null,
    })
    .select()
    .single();
  if (error) throw error;
  return NextResponse.json({ task: data }, { status: 201 });
});
export const PATCH = withAuth(async (request, { supabase }) => {
  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id)
    return NextResponse.json(
      { message: '할 일을 선택해주세요.' },
      { status: 400 },
    );
  const completed = Boolean(body.completed);
  const { error } = await supabase
    .from('daily_tasks')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
export const DELETE = withAuth(async (request, { supabase }) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id)
    return NextResponse.json(
      { message: '할 일을 선택해주세요.' },
      { status: 400 },
    );
  const { error } = await supabase.from('daily_tasks').delete().eq('id', id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
