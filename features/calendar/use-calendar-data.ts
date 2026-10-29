'use client';
import { useEffect } from 'react';
import { useApi } from '@/shared/hooks/use-api';
import { dataChangedEvent } from '@/shared/lib/data-events';
import type { CalendarEvent } from './calendar';

export type CalendarRecord = {
  id: string;
  date: string;
  type: string;
  title: string;
  detail: string;
  event?: CalendarEvent;
};
const sources = new Set([
  '/api/routines',
  '/api/daily-tasks',
  '/api/sleep-logs',
  '/api/focus-sessions',
]);

export function useCalendarData() {
  const data = useApi<{ records: CalendarRecord[]; events: CalendarEvent[] }>(
    '/api/calendar',
  );
  const refresh = data.refresh;
  useEffect(() => {
    const changed = (event: Event) => {
      if (sources.has((event as CustomEvent<string>).detail)) void refresh();
    };
    window.addEventListener(dataChangedEvent, changed);
    return () => window.removeEventListener(dataChangedEvent, changed);
  }, [refresh]);
  return data;
}
