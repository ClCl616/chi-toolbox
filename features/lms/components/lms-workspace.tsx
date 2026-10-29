import Link from 'next/link';
import { CircleHelp, Unplug } from 'lucide-react';
import {
  ToolboxPageHeader,
  ToolboxState,
} from '@/shared/components/toolbox-ui';
import styles from './lms-workspace.module.css';

export function LmsWorkspace({ tab }: { tab: 'news' | 'assignments' }) {
  return (
    <>
      <ToolboxPageHeader
        title="LMS"
        action={
          <span className={styles.connection}>
            <Unplug size={15} aria-hidden="true" />
            미연결
          </span>
        }
      />
      <nav className={styles.tabs} aria-label="LMS 보기">
        <Link
          href="/toolbox/lms"
          aria-current={tab === 'news' ? 'page' : undefined}
        >
          새 소식
        </Link>
        <Link
          href="/toolbox/lms/assignments"
          aria-current={tab === 'assignments' ? 'page' : undefined}
        >
          남은 과제
        </Link>
      </nav>
      <ToolboxState
        kind="unconnected"
        title={
          tab === 'news'
            ? 'LMS 소식을 기다리고 있어요'
            : '과제를 확인하려면 연결이 필요해요'
        }
      >
        {tab === 'news'
          ? 'LMS 연결 후 새로 올라오거나 변경된 소식이 이곳에 쌓입니다. 아직 수집한 정보가 없어요.'
          : 'LMS 연결 후 남은 과제와 제출 기한을 확인할 수 있어요. 실제 과제 제출은 LMS에서 진행합니다.'}
      </ToolboxState>
      <div className={styles.footer}>
        <span>
          <CircleHelp size={15} aria-hidden="true" />
          LMS 연결 기능은 준비 중입니다.
        </span>
        <span>
          마지막 수집 <span aria-label="수집 이력 없음">—</span>
        </span>
      </div>
    </>
  );
}
