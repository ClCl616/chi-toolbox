import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignmentGroup,
  effectiveDeadline,
  unreadCounts,
  isSnapshot,
} from '../../features/lms/model.ts';
const now = Date.parse('2026-11-02T00:00:00+09:00');
const item = {
  id: '1',
  title: 'test',
  course: 'test',
  submitted: false,
  deadline: '2026-11-03T00:00:00+09:00',
  deadlineText: '',
  extensionAllowed: false,
  extensionDeadline: null,
  stale: false,
};
test('LMS assignment classification respects midnight, unknown values and submission', () => {
  assert.equal(assignmentGroup(item, now), 'pending');
  assert.equal(
    assignmentGroup({ ...item, deadline: '2026-11-02T00:00:00+09:00' }, now),
    'overdue',
  );
  assert.equal(
    assignmentGroup({ ...item, submitted: true, deadline: null }, now),
    'submitted',
  );
  assert.equal(assignmentGroup({ ...item, submitted: null }, now), 'unknown');
  assert.equal(assignmentGroup({ ...item, deadline: null }, now), 'unknown');
  assert.equal(assignmentGroup({ ...item, stale: true }, now), 'pending');
});
test('Only a confirmed extension changes a deadline and never shortens it', () => {
  const extended = {
    ...item,
    deadline: '2026-11-01T00:00:00+09:00',
    extensionDeadline: item.deadline,
  };
  assert.equal(assignmentGroup(extended, now), 'overdue');
  assert.equal(
    assignmentGroup({ ...extended, extensionAllowed: null }, now),
    'overdue',
  );
  assert.equal(
    assignmentGroup({ ...extended, extensionAllowed: true }, now),
    'pending',
  );
  assert.equal(
    effectiveDeadline({
      ...item,
      extensionAllowed: true,
      extensionDeadline: extended.deadline,
    }),
    item.deadline,
  );
});
test('Unread news and system counts stay separate; duplicate read IDs are harmless', () => {
  assert.deepEqual(
    unreadCounts(
      [
        { id: '1', kind: 'news' },
        { id: '2', kind: 'news' },
        { id: '3', kind: 'system' },
      ],
      ['1', '1'],
    ),
    { news: 1, system: 1 },
  );
});
test('Snapshot rejects duplicate IDs, unordered events and ambiguous dates', () => {
  const event = {
    id: 'e1',
    sequence: 1,
    title: 'test',
    kind: 'news',
    course: '',
    category: '',
    body: '',
    detectedAt: '2026-11-02T00:00:00Z',
  };
  const snapshot = {
    version: 1,
    status: 'healthy',
    assignmentsReady: true,
    lastSuccess: event.detectedAt,
    lastAttempt: event.detectedAt,
    events: [event],
    assignments: [item],
  };
  assert.equal(isSnapshot(snapshot), true);
  assert.equal(isSnapshot({ ...snapshot, assignmentsReady: undefined }), false);
  assert.equal(isSnapshot({ ...snapshot, events: [event, event] }), false);
  assert.equal(
    isSnapshot({
      ...snapshot,
      events: [event, { ...event, id: 'e2', sequence: 0 }],
    }),
    false,
  );
  assert.equal(
    isSnapshot({
      ...snapshot,
      assignments: [{ ...item, deadline: '2026-11-03T00:00:00' }],
    }),
    false,
  );
});
