'use client';
import { useState } from 'react';
import {
  ToolboxPageHeader,
  ToolboxState,
} from '@/shared/components/toolbox-ui';
import { useLms } from '../use-lms';
import { displayTime, unreadCounts } from '../model';
import { LmsFeed } from './lms-feed';
import { LmsAccess } from './lms-access';
import { LmsAssignments } from './lms-assignments';
import styles from './lms-workspace.module.css';

export function LmsWorkspace({ tab: initialTab }: { tab: 'news' | 'assignments' }) {
  const { snapshot, readIds, loading, error, now, access, entryTab } = useLms();
  const [tab, setTab] = useState(initialTab === 'assignments' ? initialTab : entryTab);
  const counts = unreadCounts(snapshot?.events ?? [], readIds);
  const displayName = snapshot?.displayName?.trim();
  const initial = displayName && Array.from(displayName.normalize('NFC'))[0];
  const status = !snapshot ? '미연결'
    : snapshot.status === 'login_required' ? '로그인 필요' : '갱신 확인 필요';
  return (
    <>
      <ToolboxPageHeader
        title="LMS"
        action={snapshot?.status === 'healthy' ? (
          <div className={styles.identity}>
            {initial && <span className={styles.avatar} aria-hidden="true">{initial}</span>}
            <div className={styles.identityText}>
              {displayName && <strong title={displayName}>{displayName}</strong>}
              <span>대전대학교</span>
            </div>
          </div>
        ) : <span className={styles.connection}>{status}</span>}
      />
      <nav className={styles.tabs} aria-label="LMS 보기">
        <button
          type="button"
          onClick={() => setTab('news')}
          aria-pressed={tab === 'news'}
        >
          새 소식{counts.news > 0 && ` ${counts.news}`}
          {counts.system > 0 && (
            <span className={styles.systemCount}>
              상태 알림 {counts.system}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('assignments')}
          aria-pressed={tab === 'assignments'}
        >
          남은 과제
        </button>
      </nav>
      {error && <output className={styles.error}>{error}</output>}
      {access ? (
        <LmsAccess access={access} />
      ) : loading && !snapshot ? (
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
        <LmsAssignments items={snapshot.assignments} now={now} />
      )}
      {snapshot?.lastSuccess && (
        <div className={styles.footer}>
          <span>
            최근 동기화{' '}
            <time dateTime={snapshot.lastSuccess}>
              {displayTime(snapshot.lastSuccess)}
            </time>
          </span>
        </div>
      )}
    </>
  );
}
