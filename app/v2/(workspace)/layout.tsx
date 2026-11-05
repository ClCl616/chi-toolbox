import type { ReactNode } from 'react';
import { ToolboxShell } from '@/shell/toolbox/toolbox-shell';

export const metadata = {
  title: '대시보드',
  robots: { index: false, follow: false },
};

export default function ToolboxLayout({ children }: { children: ReactNode }) {
  return <ToolboxShell>{children}</ToolboxShell>;
}
