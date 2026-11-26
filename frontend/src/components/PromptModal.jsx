import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';

/** Modal input satu baris (folder baru, ganti nama). */
export default function PromptModal({ open, onClose, onSubmit, title, label, initialValue = '', confirmText = 'Simpan', icon, selectBaseName }) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setBusy(false);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const dot = initialValue.lastIndexOf('.');
      if (selectBaseName && dot > 0) el.setSelectionRange(0, dot);
      else el.select();
    }, 50);
  }, [open, initialValue, selectBaseName]);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={icon}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} type="button">
            Batal
          </button>
          <button className="btn-primary" form="prompt-form" type="submit" disabled={busy || !value.trim()}>
            {busy ? 'Menyimpan...' : confirmText}
          </button>
        </>
      }
    >
      <form id="prompt-form" onSubmit={submit}>
        {label && <label className="label">{label}</label>}
        <input ref={inputRef} className="input" value={value} onChange={(e) => setValue(e.target.value)} maxLength={255} />
      </form>
    </Modal>
  );
}
