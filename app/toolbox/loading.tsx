import { ToolboxState } from '@/shared/components/toolbox-ui';

export default function ToolboxLoading() {
  return (
    <ToolboxState kind="loading" title="화면을 준비하고 있어요">
      잠시만 기다려 주세요.
    </ToolboxState>
  );
}
