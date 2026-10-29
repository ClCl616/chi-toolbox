import test from 'node:test';
import assert from 'node:assert/strict';
import { folderTrail } from '../../features/files/folder-tree.ts';
const folder = (id, parent_id) => ({
  id,
  name: id,
  parent_id,
  deleted_at: null,
  trash_root_id: null,
});
test('folder breadcrumbs preserve ancestry and tolerate stale or cyclic trees', () => {
  const tree = [folder('root', null), folder('child', 'root')];
  assert.deepEqual(
    folderTrail(tree, 'child').map((x) => x.id),
    ['root', 'child'],
  );
  assert.deepEqual(folderTrail(tree, null), []);
  assert.deepEqual(folderTrail(tree, 'gone'), []);
  assert.deepEqual(
    folderTrail([folder('a', 'b'), folder('b', 'a')], 'a').map((x) => x.id),
    ['b', 'a'],
  );
});
