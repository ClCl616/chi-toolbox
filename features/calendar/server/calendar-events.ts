import { withAuth } from '@/shared/server/with-auth';
import { errorMessage } from '@/shared/server/auth';
import { eventInput } from '@/features/calendar/calendar';
import { NextResponse } from 'next/server';
export const GET = withAuth(async (_request, { supabase }) => {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .order('event_date')
    .limit(300);
  if (error) throw error;
  return NextResponse.json({ events: data });
});
const write = (editing: boolean) =>
  withAuth(async (request, { supabase, user }) => {
    const body = await request.json();
    let values;
    try {
      values = eventInput(body);
    } catch (error) {
      return NextResponse.json(
        { message: errorMessage(error) },
        { status: 400 },
      );
    }
    if (editing && typeof body.id !== 'string')
      return NextResponse.json(
        { message: '일정을 선택해주세요.' },
        { status: 400 },
      );
    const query = editing
      ? supabase
          .from('calendar_events')
          .update(values)
          .eq('id', body.id)
          .eq('user_id', user.id)
      : supabase
          .from('calendar_events')
          .insert({ ...values, user_id: user.id });
    const { data, error } = await query.select().single();
    if (error) throw error;
    return NextResponse.json({ event: data }, { status: editing ? 200 : 201 });
  });
export const POST = write(false);
export const PATCH = write(true);
export const DELETE = withAuth(async (request, { supabase }) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id)
    return NextResponse.json(
      { message: '일정을 선택해주세요.' },
      { status: 400 },
    );
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
