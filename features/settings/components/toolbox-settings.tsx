import {
  ToolboxPageHeader,
  ToolboxState,
} from '@/shared/components/toolbox-ui';

export function ToolboxSettings() {
  return (
    <>
      <ToolboxPageHeader title="설정" />
      <ToolboxState kind="empty" title="설정 항목 없음" />
    </>
  );
}
