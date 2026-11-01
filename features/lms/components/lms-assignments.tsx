'use client';
import { ClipboardList, Clock3, CircleAlert, CircleHelp } from 'lucide-react';
import { ToolboxState } from '@/shared/components/toolbox-ui';
import { assignmentGroup, effectiveDeadline, displayTime } from '../model';
import type { LmsAssignment } from '../model';
import styles from './lms-workspace.module.css';

function daysUntil(deadline: string, now: number) {
  const localDay = (value: number) =>
    Math.floor((value + 9 * 3600000) / 86400000);
  return localDay(Date.parse(deadline)) - localDay(now);
}

export function LmsAssignments({
  items,
  now,
}: {
  items: LmsAssignment[];
  now: number;
}) {
  const groups = [
    ['pending', '남은 과제'],
    ['overdue', '기한 지난 과제'],
    ['unknown', '확인 필요한 과제'],
  ] as const;
  const sorted = [...items].sort(
    (a, b) =>
      (Date.parse(effectiveDeadline(a) ?? '') || Infinity) -
      (Date.parse(effectiveDeadline(b) ?? '') || Infinity),
  );
  if (!sorted.some((item) => assignmentGroup(item, now) !== 'submitted'))
    return <ToolboxState kind="empty" title="남은 과제가 없어요" />;
  return (
    <div className={styles.assignmentGroups}>
      {groups.map(([group, title]) => {
        const tasks = sorted.filter(
          (item) => assignmentGroup(item, now) === group,
        );
        if (!tasks.length) return null;
        return (
          <section key={group} aria-label={title} data-group={group}>
            <h2 className={styles.groupTitle}>
              <span className={styles.icon}>
                <ClipboardList size={22} aria-hidden="true" />
              </span>
              {title}
              <span className={styles.count}>{tasks.length}</span>
            </h2>
            <ul
              className={
                group === 'pending'
                  ? styles.assignmentGrid
                  : styles.assignmentList
              }
            >
              {tasks.map((item) => {
                const deadline = effectiveDeadline(item);
                const days = deadline ? daysUntil(deadline, now) : null;
                const label =
                  group === 'overdue'
                    ? '기한 지남'
                    : group === 'unknown'
                      ? item.submitted === null
                        ? '제출 상태 확인 필요'
                        : '마감 시각 확인 필요'
                      : days === 0
                        ? '오늘 마감'
                        : `${days}일 남음`;
                const BadgeIcon =
                  group === 'overdue'
                    ? CircleAlert
                    : group === 'unknown'
                      ? CircleHelp
                      : Clock3;
                const tone =
                  group === 'pending'
                    ? days === 0
                      ? 'today'
                      : 'upcoming'
                    : group;
                return (
                  <li
                    key={item.id}
                    className={styles.assignmentCard}
                    data-tone={tone}
                  >
                    <div className={styles.taskHeading}>
                      <span className={styles.icon}>
                        <ClipboardList size={21} aria-hidden="true" />
                      </span>
                      <div>
                        {item.course.trim() && (
                          <p className={styles.meta}>{item.course}</p>
                        )}
                        <h3>{item.title}</h3>
                      </div>
                    </div>
                    <div className={styles.taskStatus}>
                      <span className={styles.badge} data-tone={tone}>
                        <BadgeIcon size={16} aria-hidden="true" />
                        {label}
                      </span>
                      {item.stale && (
                        <span className={styles.meta}>이전 수집 정보</span>
                      )}
                    </div>
                    {(deadline || item.deadlineText.trim()) && (
                      <div className={styles.deadline}>
                        <span className={styles.meta}>마감일</span>
                        {deadline ? (
                          <time dateTime={deadline}>
                            {displayTime(deadline)}
                          </time>
                        ) : (
                          <span>{item.deadlineText} · 시간대 확인 필요</span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
