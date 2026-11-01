export type LmsEvent = {
  id: string;
  sequence: number;
  kind: 'news' | 'system';
  title: string;
  course: string;
  category: string;
  body: string;
  detectedAt: string;
};
export type LmsAssignment = {
  id: string;
  course: string;
  title: string;
  submitted: boolean | null;
  deadline: string | null;
  deadlineText: string;
  extensionAllowed: boolean | null;
  extensionDeadline: string | null;
  stale: boolean;
};
export type LmsSnapshot = {
  version: 1;
  status: 'healthy' | 'partial' | 'failed' | 'login_required' | 'unknown';
  lastAttempt: string;
  lastSuccess: string | null;
  assignmentsReady: boolean;
  events: LmsEvent[];
  assignments: LmsAssignment[];
};
export type LmsResponse = {
  enabled: boolean;
  snapshot: LmsSnapshot | null;
  readIds: string[];
};

export function assignmentGroup(
  item: LmsAssignment,
  now = Date.now(),
): 'pending' | 'overdue' | 'unknown' | 'submitted' {
  if (item.submitted === true) return 'submitted';
  if (item.submitted === null) return 'unknown';
  const normal = item.deadline ? Date.parse(item.deadline) : NaN;
  const extended =
    item.extensionAllowed === true && item.extensionDeadline
      ? Date.parse(item.extensionDeadline)
      : NaN;
  const due = Number.isFinite(extended)
    ? Math.max(normal || 0, extended)
    : normal;
  if (!Number.isFinite(due)) return 'unknown';
  return due > now ? 'pending' : 'overdue';
}
export function effectiveDeadline(item: LmsAssignment) {
  if (
    item.extensionAllowed === true &&
    item.extensionDeadline &&
    (!item.deadline ||
      Date.parse(item.extensionDeadline) > Date.parse(item.deadline))
  )
    return item.extensionDeadline;
  return item.deadline;
}
export function unreadCounts(events: LmsEvent[], readIds: string[]) {
  const read = new Set(readIds);
  return events.reduce(
    (counts, event) => {
      if (!read.has(event.id)) counts[event.kind]++;
      return counts;
    },
    { news: 0, system: 0 },
  );
}
export function displayTime(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 100000;
const nullableDate = (v: unknown) =>
  v === null ||
  (typeof v === 'string' &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(v) &&
    Number.isFinite(Date.parse(v)));
export function isSnapshot(v: unknown): v is LmsSnapshot {
  if (
    !record(v) ||
    v.version !== 1 ||
    typeof v.assignmentsReady !== 'boolean' ||
    !['healthy', 'partial', 'failed', 'login_required', 'unknown'].includes(
      String(v.status),
    ) ||
    !nullableDate(v.lastSuccess) ||
    !nullableDate(v.lastAttempt) ||
    !text(v.lastAttempt) ||
    !Array.isArray(v.events) ||
    !Array.isArray(v.assignments)
  )
    return false;
  let sequence = 0;
  const ids = new Set<string>();
  for (const e of v.events) {
    if (
      !record(e) ||
      !text(e.id) ||
      ids.has(e.id) ||
      typeof e.sequence !== 'number' ||
      !Number.isSafeInteger(e.sequence) ||
      e.sequence <= sequence ||
      !['news', 'system'].includes(String(e.kind)) ||
      !text(e.title) ||
      !text(e.course) ||
      !text(e.category) ||
      !text(e.body) ||
      !text(e.detectedAt) ||
      !nullableDate(e.detectedAt)
    )
      return false;
    ids.add(e.id);
    sequence = e.sequence;
  }
  const assignmentIds = new Set<string>();
  return v.assignments.every((a) => {
    if (
      !record(a) ||
      !text(a.id) ||
      assignmentIds.has(a.id) ||
      !text(a.title) ||
      !text(a.course) ||
      ![true, false, null].includes(a.submitted as boolean | null) ||
      ![true, false, null].includes(a.extensionAllowed as boolean | null) ||
      !nullableDate(a.deadline) ||
      !nullableDate(a.extensionDeadline) ||
      !text(a.deadlineText) ||
      typeof a.stale !== 'boolean'
    )
      return false;
    assignmentIds.add(a.id);
    return true;
  });
}
