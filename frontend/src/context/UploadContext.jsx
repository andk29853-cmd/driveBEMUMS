import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { api } from '../lib/api';
import { uploadToPresignedUrl } from '../lib/upload';
import { emitDriveChange } from '../lib/events';
import { useToast } from './ToastContext';
import FolderPickerModal from '../components/FolderPickerModal';

const UploadContext = createContext(null);
const CONCURRENCY = 3;
let uid = 0;

export function UploadProvider({ children }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null); // folder yang sedang dibuka
  const [pickerOpen, setPickerOpen] = useState(false);

  const inputRef = useRef(null);
  const targetFolderRef = useRef(null);
  const queueRef = useRef([]);
  const activeRef = useRef(0);
  const batchRef = useRef({ ok: 0, fail: 0 });
  const controllers = useRef({});

  const update = useCallback((id, patch) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  const runOne = useCallback(
    async (item) => {
      update(item.id, { status: 'uploading', progress: 0 });
      let fileId;
      try {
        // 1) Minta Presigned URL (backend memvalidasi kuota & memilih bucket)
        const res = await api.post('/files/upload-url', {
          folderId: item.folderId,
          name: item.name,
          size: item.size,
          mimeType: item.file.type || 'application/octet-stream',
        });
        fileId = res.fileId;
        update(item.id, { bucket: res.bucket?.name });

        // 2) Upload langsung browser → bucket
        const ctl = uploadToPresignedUrl(res.upload, item.file, (p) => update(item.id, { progress: p }));
        controllers.current[item.id] = ctl;
        await ctl.promise;

        // 3) Konfirmasi ke backend → verifikasi & hitung kuota
        update(item.id, { status: 'finalizing', progress: 100 });
        await api.post(`/files/${fileId}/complete`);
        update(item.id, { status: 'done' });
        batchRef.current.ok++;
        emitDriveChange({ type: 'upload', folderId: item.folderId });
      } catch (err) {
        if (fileId) api.post(`/files/${fileId}/abort`).catch(() => {});
        if (err.aborted) {
          update(item.id, { status: 'canceled', error: 'Dibatalkan' });
        } else {
          batchRef.current.fail++;
          update(item.id, { status: 'error', error: err.message });
          const quota = err.data?.details?.code === 'QUOTA_EXCEEDED';
          toast.error(err.message, { title: quota ? 'Kuota folder penuh' : `Gagal mengunggah "${item.name}"` });
        }
      } finally {
        delete controllers.current[item.id];
      }
    },
    [toast, update]
  );

  const pump = useCallback(() => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length) {
      const item = queueRef.current.shift();
      activeRef.current++;
      runOne(item).finally(() => {
        activeRef.current--;
        if (!queueRef.current.length && activeRef.current === 0) {
          const { ok } = batchRef.current;
          if (ok > 0) toast.success(`${ok} file berhasil diunggah.`, { title: 'Upload selesai' });
          batchRef.current = { ok: 0, fail: 0 };
        }
        pump();
      });
    }
  }, [runOne, toast]);

  const addFiles = useCallback(
    (fileList, folderId) => {
      const files = Array.from(fileList || []);
      if (!files.length || !folderId) return;
      const newItems = files.map((file) => ({
        id: ++uid,
        file,
        name: file.name,
        size: file.size,
        folderId,
        progress: 0,
        status: 'queued',
      }));
      setItems((list) => [...list, ...newItems]);
      queueRef.current.push(...newItems);
      pump();
    },
    [pump]
  );

  /** Buka dialog pilih file. Jika folder belum ditentukan, tampilkan pemilih folder. */
  const openFilePicker = useCallback(
    (folderId) => {
      const target = folderId || currentFolder?.id;
      if (!target) {
        setPickerOpen(true);
        return;
      }
      targetFolderRef.current = target;
      inputRef.current?.click();
    },
    [currentFolder]
  );

  const cancel = (id) => {
    const ctl = controllers.current[id];
    if (ctl) ctl.abort();
    else {
      queueRef.current = queueRef.current.filter((i) => i.id !== id);
      update(id, { status: 'canceled', error: 'Dibatalkan' });
    }
  };

  const clearFinished = () =>
    setItems((list) => list.filter((i) => ['queued', 'uploading', 'finalizing'].includes(i.status)));

  return (
    <UploadContext.Provider
      value={{ items, addFiles, openFilePicker, cancel, clearFinished, currentFolder, setCurrentFolder }}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files, targetFolderRef.current);
          e.target.value = '';
        }}
      />
      <FolderPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Unggah ke folder mana?"
        onSelect={(folder) => {
          setPickerOpen(false);
          targetFolderRef.current = folder.id;
          inputRef.current?.click();
        }}
      />
    </UploadContext.Provider>
  );
}

export const useUpload = () => useContext(UploadContext);
