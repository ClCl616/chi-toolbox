import type { DriveFolder } from './types';

/** Walk parents once; malformed/stale trees cannot loop forever. */
export function folderTrail(
  folders: DriveFolder[],
  id: string | null,
): DriveFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const seen = new Set<string>();
  const trail: DriveFolder[] = [];
  while (id && !seen.has(id) && trail.length < 34) {
    seen.add(id);
    const folder = byId.get(id);
    if (!folder) break;
    trail.unshift(folder);
    id = folder.parent_id;
  }
  return trail;
}
