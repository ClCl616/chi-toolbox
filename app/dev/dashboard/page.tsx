import { ToolboxShell } from '@/shell/toolbox/toolbox-shell';
import { ToolboxHome } from '@/shell/toolbox/toolbox-home';
export const metadata = { title: '대시보드' };
export default function DevDashboardPage() {
  return (
    <ToolboxShell dashboardHref="/dev/dashboard">
      <ToolboxHome preview />
    </ToolboxShell>
  );
}
