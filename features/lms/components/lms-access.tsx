import Link from 'next/link';
import { ToolboxState } from '@/shared/components/toolbox-ui';

export function LmsAccess({ access }: { access: 'login' | 'forbidden' }) {
  return access === 'login' ? (
    <ToolboxState
      kind="unconnected"
      title="로그인 후 확인할 수 있어요"
      action={<Link href="/login?returnTo=%2Ftoolbox">로그인</Link>}
    >
      연결된 계정의 LMS 소식과 과제를 확인하세요.
    </ToolboxState>
  ) : (
    <ToolboxState
      kind="unconnected"
      title="이 계정에는 LMS가 연결되어 있지 않아요"
    />
  );
}
