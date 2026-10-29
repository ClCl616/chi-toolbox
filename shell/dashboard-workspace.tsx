'use client';
import { TabsContent } from '@/shared/ui/tabs';
import { workspaces } from './workspaces';
export function DashboardWorkspace() {
  return workspaces.map(({ id, component: Workspace }) => (
    <TabsContent
      key={id}
      className={`tab-view view-${id}`}
      value={id}
      keepMounted
    >
      <Workspace />
    </TabsContent>
  ));
}
