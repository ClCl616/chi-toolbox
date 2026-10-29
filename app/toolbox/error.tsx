'use client';

import { ToolboxState } from '@/shared/components/toolbox-ui';
import ui from '@/shared/components/toolbox-ui.module.css';

export default function ToolboxError({ reset }: { reset: () => void }) {
  return (
    <ToolboxState
      kind="error"
      title="화면을 불러오지 못했어요"
      action={
        <button type="button" className={ui.button} onClick={reset}>
          다시 시도
        </button>
      }
    >
      일시적인 문제가 발생했어요. 잠시 후 다시 시도해 주세요.
    </ToolboxState>
  );
}
