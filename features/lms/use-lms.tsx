'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { isSnapshot } from './model';
import type { LmsResponse } from './model';

type Context = LmsResponse & {
  entryTab: 'news' | 'assignments';
  setEntryTab: (tab: 'news' | 'assignments') => void;
  loading: boolean;
  error: string;
  markRead: (id: string) => void;
  now: number;
  access: 'login' | 'forbidden' | null;
};
const LmsContext = createContext<Context | null>(null);
export function LmsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LmsResponse>({
    enabled: false,
    snapshot: null,
    readIds: [],
  });
  const [entryTab, setEntryTab] = useState<'news' | 'assignments'>('news');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const [access, setAccess] = useState<'login' | 'forbidden' | null>(null);
  const pending = useRef(new Set<string>());
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    async function refresh() {
      if (running || document.visibilityState !== 'visible') return;
      running = true;
      try {
        const response = await fetch('/api/toolbox/lms', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) {
          setData({ enabled: false, snapshot: null, readIds: [] });
          setAccess(response.status === 401 ? 'login' : 'forbidden');
          setError('');
          return;
        }
        if (!response.ok) throw new Error();
        const next: LmsResponse = await response.json();
        if (
          typeof next.enabled !== 'boolean' ||
          (next.snapshot !== null && !isSnapshot(next.snapshot)) ||
          !Array.isArray(next.readIds) ||
          !next.readIds.every((id) => typeof id === 'string')
        )
          throw new Error();
        setData((previous) => ({
          ...next,
          readIds: [...new Set([...previous.readIds, ...next.readIds])],
        }));
        setNow(Date.now());
        setAccess(null);
        setError('');
      } catch {
        if (!controller.signal.aborted)
          setError('최신 정보를 불러오지 못했어요. 잠시 후 다시 확인합니다.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
        running = false;
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const markRead = useCallback((id: string) => {
    if (pending.current.has(id)) return;
    pending.current.add(id);
    void fetch('/api/toolbox/lms/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) {
          setData({ enabled: false, snapshot: null, readIds: [] });
          setAccess(response.status === 401 ? 'login' : 'forbidden');
          return;
        }
        if (!response.ok) throw new Error();
        const body = (await response.json()) as { readIds: string[] };
        if (
          !Array.isArray(body.readIds) ||
          !body.readIds.every((id) => typeof id === 'string')
        )
          throw new Error();
        setData((previous) => ({
          ...previous,
          readIds: [...new Set([...previous.readIds, ...body.readIds])],
        }));
      })
      .catch(() =>
        setError(
          '읽음 상태를 저장하지 못했어요. 다음 확인 때 다시 시도합니다.',
        ),
      )
      .finally(() => pending.current.delete(id));
  }, []);
  return (
    <LmsContext.Provider
      value={{ ...data, entryTab, setEntryTab, loading, error, markRead, now, access }}
    >
      {children}
    </LmsContext.Provider>
  );
}
export function useLms() {
  const value = useContext(LmsContext);
  if (!value) throw new Error('LmsProvider required');
  return value;
}
