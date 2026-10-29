export type Note = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  content_type: 'markdown' | 'sticky' | 'drawing';
  category: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
};
export type Draft = Omit<Note, 'created_at' | 'updated_at'>;
