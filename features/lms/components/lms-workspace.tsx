import Link from 'next/link';
import { Unplug } from 'lucide-react';
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
      <ToolboxState kind="unconnected" title="LMS 미연결">
        연결 기능 준비 중
      </ToolboxState>
      <div className={styles.footer}>
        <span>
          마지막 수집 <span aria-label="수집 이력 없음">—</span>
        </span>
      </div>
    </>
  );
}
