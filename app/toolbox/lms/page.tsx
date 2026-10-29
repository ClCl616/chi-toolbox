import { LmsWorkspace } from '@/features/lms/components/lms-workspace';

export const metadata = { title: 'LMS 새 소식' };
export default function LmsPage() {
  return <LmsWorkspace tab="news" />;
}
