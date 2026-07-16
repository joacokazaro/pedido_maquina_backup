import React from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  hideCancel = false,
  requireComment = false,
  commentPlaceholder = 'Escribe un comentario...',
  initialComment = '',
  tone = 'default',
  children = null,
}) {
  const [comment, setComment] = React.useState(initialComment || "");
  const dialogRef = React.useRef(null);

  React.useEffect(() => {
    setComment(initialComment || "");
  }, [initialComment, open]);

  React.useEffect(() => {
    if (!open) return;

    dialogRef.current?.focus();

    function handleKeyDown(e) {
      if (e.key === 'Escape' && !hideCancel) {
        onCancel && onCancel();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, hideCancel, onCancel]);

  if (!open) return null;

  function handleConfirm() {
    if (requireComment) {
      onConfirm && onConfirm(String(comment || "").trim());
    } else {
      onConfirm && onConfirm();
    }
  }

  const canConfirm = !requireComment || String(comment || "").trim().length > 0;
  const confirmClassName =
    tone === 'danger'
      ? canConfirm
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-red-300 cursor-not-allowed'
      : canConfirm
        ? 'bg-blue-600 hover:bg-blue-700'
        : 'bg-blue-300 cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'confirm-modal-title' : undefined}
        aria-describedby={message ? 'confirm-modal-message' : undefined}
        tabIndex={-1}
        className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 outline-none"
      >
        {title && <h3 id="confirm-modal-title" className="text-lg font-semibold mb-2 text-gray-800">{title}</h3>}
        <p id="confirm-modal-message" className="text-sm text-gray-700 mb-4 whitespace-pre-line">{message}</p>
        {children ? <div className="mb-4">{children}</div> : null}

        {requireComment && (
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Comentario obligatorio</label>
            <textarea
              className="w-full p-2 border rounded-lg"
              rows={3}
              placeholder={commentPlaceholder}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        )}

        <div className={`${hideCancel ? 'flex justify-center' : 'flex justify-end'} gap-3`}>
          {!hideCancel ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg text-white ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
