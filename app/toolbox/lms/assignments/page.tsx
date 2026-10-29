import { LmsWorkspace } from '@/features/lms/components/lms-workspace';

export const metadata = { title: '남은 과제' };
export default function AssignmentsPage() {
  return <LmsWorkspace tab="assignments" />;
}
