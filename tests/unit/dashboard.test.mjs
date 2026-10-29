import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultCardLayout,
  moveCard,
  parseCardLayout,
} from '../../features/dashboard/card-layout.ts';

test('dashboard tolerates missing, corrupt, obsolete and duplicate local preferences', () => {
  for (const value of [
    null,
    '',
    '{',
    'null',
    '{}',
    '[1,2]',
    '[{"id":"news","visible":true}]',
    '[{"id":"news","visible":true},{"id":"news","visible":false}]',
    '[{"id":"other","visible":true},{"id":"news","visible":true}]',
    '[{"id":"news","visible":"false"},{"id":"assignments","visible":true}]',
  ]) {
    assert.deepEqual(parseCardLayout(value), defaultCardLayout);
  }
});
test('dashboard preserves order and hidden cards, strips unrelated stored properties', () => {
  const cards = [
    { id: 'assignments', visible: false },
    { id: 'news', visible: false },
  ];
  assert.deepEqual(
    parseCardLayout(
      JSON.stringify(cards.map((card) => ({ ...card, extra: 'ignored' }))),
    ),
    cards,
  );
});
test('reordering is immutable and retains visibility', () => {
  const original = [
    { id: 'news', visible: false },
    { id: 'assignments', visible: true },
  ];
  const moved = moveCard(original, 'news', 'assignments');
  assert.deepEqual(moved, [original[1], original[0]]);
  assert.equal(original[0].id, 'news');
  assert.deepEqual(moveCard(moved, 'news', 'assignments'), original);
  assert.equal(moveCard(original, 'news', 'news'), original);
});
