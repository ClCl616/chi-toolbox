export type StoredFile = {
  folder_id: string | null;
  trash_root_id: string | null;
  id: string;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  deleted_at: string | null;
  purge_started_at: string | null;
  url: string | null;
};
export type DriveFolder = {
  id: string;
  name: string;
  parent_id: string | null;
  deleted_at: string | null;
  trash_root_id: string | null;
};
