import React from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = 'Aceptar',
  cancelLabel = 'Cancelar',
  requireComment = false,
  commentPlaceholder = 'Escribe un comentario...',
  initialComment = ''
}) {
  if (!open) return null;

  const [comment, setComment] = React.useState(initialComment || "");

  React.useEffect(() => {
    setComment(initialComment || "");
  }, [initialComment, open]);

  function handleConfirm() {
    if (requireComment) {
      onConfirm && onConfirm(String(comment || "").trim());
    } else {
      onConfirm && onConfirm();
    }
  }

  const canConfirm = !requireComment || String(comment || "").trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6">
        {title && <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">{title}</h3>}
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{message}</p>

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

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 rounded-lg text-white ${canConfirm ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-300 cursor-not-allowed'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
