/**
 * ConfirmDialog — the single destructive-action confirmation primitive.
 *
 * Replaces browser-native window.confirm()/alert() across the admin so that
 * destructive/financial operations are always intentional. Callers must supply
 * an explicit, specific message describing what will happen, the record
 * affected, and whether it is reversible.
 */
import { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  open = false,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger', // 'danger' | 'primary'
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  // Focus the confirm button on open + Escape to cancel + lock scroll.
  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') onCancel && onCancel(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', esc);
    };
  }, [open, onCancel]);

  if (!open) return null;

  const toneClass = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-primary-600 hover:bg-primary-700';

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <h3 id="confirm-dialog-title" className="text-lg font-bold text-gray-900">{title}</h3>
        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm text-white rounded-lg font-medium ${toneClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
