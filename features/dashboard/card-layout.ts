export type DashboardCardId = 'news' | 'assignments';
export type DashboardCard = { id: DashboardCardId; visible: boolean };
export const dashboardStorageKey = 'chi-toolbox-dashboard-layout-v1';
export const defaultCardLayout: DashboardCard[] = [
  { id: 'news', visible: true },
  { id: 'assignments', visible: true },
];

// Local preferences contain presentation choices only, never LMS/account data.
export function parseCardLayout(value: string | null): DashboardCard[] {
  if (!value) return defaultCardLayout;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== defaultCardLayout.length)
      return defaultCardLayout;
    const cards: DashboardCard[] = [];
    for (const entry of parsed) {
      if (
        typeof entry !== 'object' ||
        entry === null ||
        !('id' in entry) ||
        !('visible' in entry)
      )
        return defaultCardLayout;
      if (
        (entry.id !== 'news' && entry.id !== 'assignments') ||
        typeof entry.visible !== 'boolean' ||
        cards.some((card) => card.id === entry.id)
      )
        return defaultCardLayout;
      cards.push({ id: entry.id, visible: entry.visible });
    }
    return cards;
  } catch {
    return defaultCardLayout;
  }
}

export function moveCard(
  cards: DashboardCard[],
  source: DashboardCardId,
  target: DashboardCardId,
): DashboardCard[] {
  if (source === target) return cards;
  const from = cards.findIndex((card) => card.id === source);
  const to = cards.findIndex((card) => card.id === target);
  if (from < 0 || to < 0) return cards;
  const next = [...cards];
  const [card] = next.splice(from, 1);
  next.splice(to, 0, card);
  return next;
}
