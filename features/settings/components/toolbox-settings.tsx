import Link from 'next/link';
import {
  ToolboxPageHeader,
  ToolboxState,
} from '@/shared/components/toolbox-ui';
import ui from '@/shared/components/toolbox-ui.module.css';

export function ToolboxSettings() {
  return (
    <>
      <ToolboxPageHeader title="설정" />
      <ToolboxState
        kind="empty"
        title="나에게 맞는 도구함을 준비하고 있어요"
        action={
          <Link className={ui.button} href="/toolbox">
            대시보드로 이동
          </Link>
        }
      >
        지금은 대시보드에서 카드 표시와 순서를 바꿀 수 있어요. 카드 설정은 이
        브라우저에만 저장되며, 계정 동기화와 LMS 연결 설정은 준비 중입니다.
      </ToolboxState>
    </>
  );
}
