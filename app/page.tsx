import { AppShell } from '@/shell/app-shell';
import { DashboardWorkspace } from '@/shell/dashboard-workspace';

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardWorkspace />
    </AppShell>
  );
}
