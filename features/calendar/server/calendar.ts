import { withAuth } from '@/shared/server/with-auth';
import { NextResponse } from 'next/server';
export const GET = withAuth(async (_request, { supabase }) => {
  const [events, checks, tasks, sleep, timer] = await Promise.all([
    supabase.from('calendar_events').select('*'),
    supabase.from('routine_checks').select('id,checked_on,routines(title)'),
    supabase.from('daily_tasks').select('id,title,task_date,completed'),
    supabase
      .from('sleep_logs')
      .select('id,slept_at,woke_at,quality,note')
      .not('woke_at', 'is', null),
    supabase
      .from('focus_sessions')
      .select('id,task,completed_at,duration_seconds'),
  ]);
  for (const item of [events, checks, tasks, sleep, timer])
    if (item.error) throw item.error;
  const records = [
    ...(events.data ?? []).map((x) => ({
      id: x.id,
      date: x.event_date,
      type: '일정',
      title: x.title,
      detail: x.notes ?? '',
    })),
    ...(checks.data ?? []).map((x) => ({
      id: x.id,
      date: x.checked_on,
      type: '루틴',
      title:
        (Array.isArray(x.routines)
          ? x.routines[0]?.title
          : (x.routines as { title?: string } | null)?.title) ?? '반복 루틴',
      detail: '완료',
    })),
    ...(tasks.data ?? []).map((x) => ({
      id: x.id,
      date: x.task_date,
      type: '할 일',
      title: x.title,
      detail: x.completed ? '완료' : '예정',
    })),
    ...(sleep.data ?? []).map((x) => ({
      id: x.id,
      date: x.slept_at.slice(0, 10),
      type: '수면',
      title: '수면 기록',
      detail: x.note ?? '',
    })),
    ...(timer.data ?? []).map((x) => ({
      id: x.id,
      date: x.completed_at.slice(0, 10),
      type: '타이머',
      title: x.task || '타이머',
      detail: `${Math.round(x.duration_seconds / 60)}분`,
    })),
  ];
  return NextResponse.json({ records, events: events.data ?? [] });
});
