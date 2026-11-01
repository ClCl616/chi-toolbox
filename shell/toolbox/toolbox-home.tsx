'use client';
import { ToolboxDashboard } from '@/features/dashboard/components/toolbox-dashboard';
import { useLms } from '@/features/lms/use-lms';
import { assignmentGroup, unreadCounts } from '@/features/lms/model';
import { LmsAccess } from '@/features/lms/components/lms-access';
import { ToolboxPageHeader } from '@/shared/components/toolbox-ui';

export function ToolboxHome() {
  const { snapshot, readIds, error, now, access } = useLms();
  if (access)
    return (
      <>
        <ToolboxPageHeader title="대시보드" />
        <LmsAccess access={access} />
      </>
    );
  const counts = unreadCounts(snapshot?.events ?? [], readIds);
  return (
    <ToolboxDashboard
      newsCount={snapshot ? counts.news : null}
      systemCount={counts.system}
      assignmentCount={
        snapshot?.assignmentsReady
          ? snapshot.assignments.filter(
              (item) => assignmentGroup(item, now) === 'pending',
            ).length
          : null
      }
      status={
        error || (snapshot?.status && snapshot.status !== 'healthy')
          ? '갱신 확인 필요'
          : snapshot
            ? '마지막 수집 기준'
            : '미연결'
      }
    />
  );
}
