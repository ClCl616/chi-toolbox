'use client';
import Link from 'next/link';
import {
  ToolboxPageHeader,
  ToolboxState,
} from '@/shared/components/toolbox-ui';
import { useLms } from '../use-lms';
import {
  assignmentGroup,
  effectiveDeadline,
  displayTime,
  unreadCounts,
} from '../model';
import { LmsFeed } from './lms-feed';
import styles from './lms-workspace.module.css';

export function LmsWorkspace({ tab }: { tab: 'news' | 'assignments' }) {
  const { snapshot, readIds, loading, error, now } = useLms();
  const counts = unreadCounts(snapshot?.events ?? [], readIds);
  const status = !snapshot
    ? '미연결'
    : snapshot.status === 'healthy'
      ? '연결됨'
      : snapshot.status === 'login_required'
        ? '로그인 필요'
        : '갱신 확인 필요';
  const groups = [
    ['pending', '남은 과제'],
    ['overdue', '기한 지난 과제'],
    ['unknown', '확인 필요한 과제'],
  ] as const;
  const assignments = [...(snapshot?.assignments ?? [])].sort(
    (a, b) =>
      (Date.parse(effectiveDeadline(a) ?? '') || Infinity) -
      (Date.parse(effectiveDeadline(b) ?? '') || Infinity),
  );
  return (
    <>
      <ToolboxPageHeader
        title="LMS"
        action={<span className={styles.connection}>{status}</span>}
      />
      <nav className={styles.tabs} aria-label="LMS 보기">
        <Link
          href="/toolbox/lms"
          aria-current={tab === 'news' ? 'page' : undefined}
        >
          새 소식{counts.news > 0 && ` ${counts.news}`}
          {counts.system > 0 && (
            <span className={styles.systemCount}>
              상태 알림 {counts.system}
            </span>
          )}
        </Link>
        <Link
          href="/toolbox/lms/assignments"
          aria-current={tab === 'assignments' ? 'page' : undefined}
        >
          남은 과제
        </Link>
      </nav>
      {error && <output className={styles.error}>{error}</output>}
      {loading && !snapshot ? (
        <ToolboxState title="LMS 정보를 불러오는 중" kind="loading" />
      ) : !snapshot ? (
        <ToolboxState kind="unconnected" title="LMS 미연결">
          수집 PC에서 로그인 후 수집을 시작해 주세요.
        </ToolboxState>
      ) : tab === 'news' ? (
        <LmsFeed />
      ) : !snapshot.assignmentsReady ? (
        <ToolboxState kind="empty" title="과제 수집 대기 중">
          첫 과제 수집이 완료되면 표시됩니다.
        </ToolboxState>
      ) : (
        <div className={styles.assignmentGroups}>
          {groups.map(([key, title]) => {
            const items = assignments.filter(
              (item) => assignmentGroup(item, now) === key,
            );
            return (
              <section key={key} aria-label={title}>
                <h2>
                  {title} <span>{items.length}</span>
                </h2>
                {items.length === 0 ? (
                  <p className={styles.emptyGroup}>해당하는 과제가 없어요.</p>
                ) : (
                  <ul>
                    {items.map((item) => (
                      <li key={item.id}>
                        <span className={styles.meta}>
                          {item.course}
                          {item.stale ? ' · 이전 수집 정보' : ''}
                        </span>
                        <h3>{item.title}</h3>
                        <p className={styles.due}>
                          {effectiveDeadline(item)
                            ? `마감 ${displayTime(effectiveDeadline(item))}`
                            : item.deadlineText
                              ? `마감 ${item.deadlineText} · 시간대 확인 필요`
                              : '마감 시각 확인 필요'}
                          {item.submitted === null
                            ? ' · 제출 상태 확인 필요'
                            : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
      <div className={styles.footer}>
        <span>30분 간격 자동 수집</span>
        <span>마지막 성공 {displayTime(snapshot?.lastSuccess ?? null)}</span>
      </div>
    </>
  );
}
