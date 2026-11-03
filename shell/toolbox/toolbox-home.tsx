'use client';
import { ToolboxDashboard } from '@/features/dashboard/components/toolbox-dashboard';
import { useLms } from '@/features/lms/use-lms';
import { assignmentGroup, unreadCounts } from '@/features/lms/model';
import { LmsAccess } from '@/features/lms/components/lms-access';
import { ToolboxPageHeader } from '@/shared/components/toolbox-ui';

export function ToolboxHome({ preview = false }: { preview?: boolean }) {
  const { snapshot, readIds, error, now, access, setEntryTab } = useLms();
  if (access)
    return (
      <>
        <ToolboxPageHeader title="대시보드" />
        <LmsAccess loginHref={preview ? "/dev/login" : undefined} access={access} />
      </>
    );
  const counts = unreadCounts(snapshot?.events ?? [], readIds);
  return (
    <ToolboxDashboard
      assignmentHref={preview ? "/toolbox/lms/assignments" : undefined}
      onOpenCard={setEntryTab}
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
            ? null
            : '미연결'
      }
    />
  );
}
