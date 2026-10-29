'use client';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { apiRequest, useApi } from '@/shared/hooks/use-api';
import { DataNotice } from '@/shared/components/data-notice';
type Routine = {
  id: string;
  title: string;
  active: boolean;
  repeat_type: 'daily' | 'weekly';
  repeat_days: number[];
};
type RoutineCheck = {
  routine_id: string;
  checked_on: string;
  completed_at: string | null;
};
type DailyTask = {
  id: string;
  title: string;
  task_date: string;
  completed: boolean;
  note: string | null;
};
const todayKey = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};
const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
export function RoutinesWorkspace() {
  const routines = useApi<{ routines: Routine[]; checks: RoutineCheck[] }>(
      '/api/routines',
    ),
    tasks = useApi<{ tasks: DailyTask[] }>('/api/daily-tasks');
  const [routineTitle, setRoutineTitle] = useState(''),
    [repeatType, setRepeatType] = useState<'daily' | 'weekly'>('daily'),
    [repeatDays, setRepeatDays] = useState<number[]>([]),
    [taskTitle, setTaskTitle] = useState(''),
    [taskDate, setTaskDate] = useState(todayKey()),
    [taskNote, setTaskNote] = useState(''),
    [pendingAction, setPendingAction] = useState('');
  const todayDate = todayKey(),
    weekday = new Date().getDay(),
    scheduled = (routines.data?.routines ?? []).filter(
      (x) =>
        x.active &&
        (x.repeat_type === 'daily' || x.repeat_days.includes(weekday)),
    ),
    completedRoutineIds = new Set(
      (routines.data?.checks ?? [])
        .filter((x) => x.checked_on === todayDate)
        .map((x) => x.routine_id),
    );
  const toggleDay = (value: number) =>
    setRepeatDays((current) =>
      current.includes(value)
        ? current.filter((x) => x !== value)
        : [...current, value],
    );
  const add = async (
    e: React.SyntheticEvent<HTMLFormElement>,
    kind: 'r' | 't',
  ) => {
    e.preventDefault();
    setPendingAction(kind);
    try {
      await apiRequest(kind === 'r' ? '/api/routines' : '/api/daily-tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          kind === 'r'
            ? {
                title: routineTitle,
                repeat_type: repeatType,
                repeat_days: repeatDays,
              }
            : { title: taskTitle, task_date: taskDate, note: taskNote },
        ),
      });
      if (kind === 'r') {
        setRoutineTitle('');
        setRepeatType('daily');
        setRepeatDays([]);
      } else {
        setTaskTitle('');
        setTaskNote('');
      }
      await (kind === 'r' ? routines : tasks).refresh();
    } finally {
      setPendingAction('');
    }
  };
  const patch = async (
    path: string,
    id: string,
    key: string,
    value: boolean,
    refresh: () => Promise<void>,
  ) => {
    setPendingAction(id);
    try {
      await apiRequest(path, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, [key]: value, date: todayDate }),
      });
      await refresh();
    } finally {
      setPendingAction('');
    }
  };
  const remove = async (path: string, refresh: () => Promise<void>) => {
    await apiRequest(path, { method: 'DELETE' });
    await refresh();
  };
  const completion = (id: string) => {
    const item = (routines.data?.checks ?? []).find(
      (x) => x.routine_id === id && x.checked_on === todayDate,
    );
    return item?.completed_at
      ? new Date(item.completed_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;
  };
  return (
    <div className="workspace-grid morning-grid">
      <section className="workspace-card">
        <div className="section-title">
          <div>
            <p className="card-label">
              <Check size={16} /> 반복 루틴
            </p>
            <h2>
              {scheduled.filter((x) => completedRoutineIds.has(x.id)).length} /{' '}
              {scheduled.length} 완료
            </h2>
          </div>
          <span>오늘 {weekdays[weekday]}요일</span>
        </div>
        <p className="routine-reset-note">
          매일 또는 선택한 요일에 반복할 행동을 관리하고, 완료 날짜와 시간을
          기록하세요.
        </p>
        <form className="stack-form" onSubmit={(e) => add(e, 'r')}>
          <input
            aria-label="새 반복 루틴"
            value={routineTitle}
            onChange={(e) => setRoutineTitle(e.target.value)}
            placeholder="예: 물 마시기"
          />
          <select
            aria-label="루틴 반복 주기"
            value={repeatType}
            onChange={(e) =>
              setRepeatType(e.target.value as 'daily' | 'weekly')
            }
          >
            <option value="daily">매일 반복</option>
            <option value="weekly">요일 반복</option>
          </select>
          {repeatType === 'weekly' && (
            <div className="weekday-picker">
              {weekdays.map((label, index) => (
                <button
                  type="button"
                  className={repeatDays.includes(index) ? 'selected' : ''}
                  onClick={() => toggleDay(index)}
                  key={label}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            className="submit-button"
            disabled={
              !routineTitle ||
              pendingAction === 'r' ||
              (repeatType === 'weekly' && !repeatDays.length)
            }
          >
            <Plus size={16} />
            루틴 추가
          </button>
        </form>
        <DataNotice loading={routines.loading} error={routines.error} />
        <div className="check-list">
          {scheduled.map((x) => (
            <div
              className={`check-row ${completedRoutineIds.has(x.id) ? 'done' : ''}`}
              key={x.id}
            >
              <button
                className="check-button"
                aria-label={x.title + ' 완료 상태 변경'}
                onClick={() =>
                  patch(
                    '/api/routines',
                    x.id,
                    'checked',
                    !completedRoutineIds.has(x.id),
                    routines.refresh,
                  )
                }
              >
                {completedRoutineIds.has(x.id) && <Check size={16} />}
              </button>
              <span>
                {x.title}
                <small>
                  {' '}
                  ·{' '}
                  {x.repeat_type === 'daily'
                    ? '매일'
                    : x.repeat_days.map((v) => weekdays[v]).join('·')}
                </small>
                {completion(x.id) && <small> · {completion(x.id)} 완료</small>}
              </span>
              <button
                className="icon-button"
                aria-label={x.title + ' 삭제'}
                onClick={() =>
                  remove(`/api/routines?id=${x.id}`, routines.refresh)
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="workspace-card">
        <div className="section-title">
          <div>
            <p className="card-label">
              <Check size={16} /> 데일리 할 일
            </p>
            <h2>{taskDate}</h2>
          </div>
        </div>
        <form className="stack-form" onSubmit={(e) => add(e, 't')}>
          <input
            aria-label="새 할 일"
            data-workspace-new
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="예: 서류 제출"
          />
          <input
            aria-label="할 일 날짜"
            type="date"
            value={taskDate}
            onChange={(e) => setTaskDate(e.target.value)}
          />
          <input
            aria-label="할 일 메모"
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            placeholder="메모 (선택)"
          />
          <button
            className="submit-button"
            disabled={!taskTitle || pendingAction === 't'}
          >
            <Plus size={16} />할 일 추가
          </button>
        </form>
        <DataNotice loading={tasks.loading} error={tasks.error} />
        <div className="check-list">
          {(tasks.data?.tasks ?? [])
            .filter((x) => x.task_date === taskDate)
            .map((x) => (
              <div
                className={`check-row ${x.completed ? 'done' : ''}`}
                key={x.id}
              >
                <button
                  className="check-button"
                  onClick={() =>
                    patch(
                      '/api/daily-tasks',
                      x.id,
                      'completed',
                      !x.completed,
                      tasks.refresh,
                    )
                  }
                >
                  {x.completed && <Check size={16} />}
                </button>
                <span>
                  {x.title}
                  {x.note && <small> · {x.note}</small>}
                </span>
                <button
                  className="icon-button"
                  onClick={() =>
                    remove(`/api/daily-tasks?id=${x.id}`, tasks.refresh)
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
