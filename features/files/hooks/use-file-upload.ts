'use client';
import { useRef, useState } from 'react';
import { apiRequest } from '@/shared/hooks/use-api';
export function useFileUpload(
  folder: string | null,
  onComplete: () => Promise<void>,
  onStart: () => void,
) {
  const input = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<
    Array<{ name: string; status: string }>
  >([]);
  async function upload(files: File[]) {
    if (uploading.current || !files.length) return;
    uploading.current = true;
    setBusy(true);
    onStart();
    setUploads(files.map((file) => ({ name: file.name, status: '대기' })));
    for (const [index, file] of files.entries()) {
      const status = (value: string) =>
        setUploads((items) =>
          items.map((item, i) =>
            i === index ? { ...item, status: value } : item,
          ),
        );
      try {
        if (file.size > 500 * 1024 * 1024) throw new Error('500MB 초과');
        status('업로드 중');
        const form = new FormData();
        form.append('file', file);
        if (folder) form.append('folder_id', folder);
        await apiRequest('/api/files', { method: 'POST', body: form });
        status('완료');
      } catch (error) {
        status(error instanceof Error ? error.message : '실패');
      }
    }
    await onComplete();
    uploading.current = false;
    setBusy(false);
    if (input.current) input.current.value = '';
  }

  return { input, busy, uploads, upload };
}
