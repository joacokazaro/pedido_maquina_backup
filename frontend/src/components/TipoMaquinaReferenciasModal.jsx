import { useEffect, useMemo, useState } from "react";
import ConfirmModal from "./ConfirmModal";
import { API_BASE } from "../services/apiBase";

function createEmptyRow() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    file: null,
    descripcion: "",
  };
}

function normalizeId(value) {
  return String(value || "");
}

export default function TipoMaquinaReferenciasModal({
  open,
  mode = "upload",
  tipos = [],
  tipoInicialId = "",
  tipoInicialNombre = "",
  canEdit = false,
  onClose,
  onSaved,
}) {
  const [selectedTipoId, setSelectedTipoId] = useState(normalizeId(tipoInicialId));
  const [rows, setRows] = useState([createEmptyRow()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [referencias, setReferencias] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const tipoSeleccionado = useMemo(
    () => tipos.find((tipo) => String(tipo.id) === selectedTipoId) || null,
    [tipos, selectedTipoId]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const initialId =
      mode === "view"
        ? normalizeId(tipoInicialId) || normalizeId(tipos[0]?.id || "")
        : normalizeId(tipoInicialId) || "";
    setSelectedTipoId(initialId);
    setRows([createEmptyRow()]);
    setLoading(false);
    setSaving(false);
    setError("");
    setSuccess("");
    setReferencias([]);
    setCurrentIndex(0);
    setEditingId(null);
    setEditDescripcion("");
    setEditFile(null);
    setEditSaving(false);
    setDeleteId(null);
    setConfirmDialog(null);
  }, [open, tipoInicialId, tipos]);

  useEffect(() => {
    if (!open || mode !== "view" || !selectedTipoId) {
      return;
    }

    let alive = true;

    async function loadReferencias() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/admin/maquinas/tipos/${selectedTipoId}/referencias`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || "Error cargando referencias");
        }

        if (!alive) return;
        const lista = Array.isArray(data?.referencias) ? data.referencias : [];
        setReferencias(lista);
        setCurrentIndex(0);
        setEditingId(null);
        setEditDescripcion("");
        setEditFile(null);
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Error cargando referencias");
        setReferencias([]);
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    loadReferencias();

    return () => {
      alive = false;
    };
  }, [open, mode, selectedTipoId]);

  useEffect(() => {
    if (!open) return;

    const current = referencias[currentIndex];
    if (!current || editingId !== current.id) {
      return;
    }

    setEditDescripcion(current.descripcion || "");
    setEditFile(null);
  }, [open, currentIndex, referencias, editingId]);

  function addRow() {
    setRows((prev) => [...prev, createEmptyRow()]);
  }

  function removeRow(rowId) {
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== rowId);
      return next.length > 0 ? next : [createEmptyRow()];
    });
  }

  function updateRow(rowId, patch) {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function closeConfirmDialog() {
    setConfirmDialog(null);
  }

  async function executeUpload(items, tipoId) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const created = [];
      for (const row of items) {
        const formData = new FormData();
        formData.append("file", row.file);
        formData.append("descripcion", String(row.descripcion || "").trim());

        const res = await fetch(`${API_BASE}/admin/maquinas/tipos/${tipoId}/referencias`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Error cargando referencias");
        }

        created.push(data);
      }

      setRows([createEmptyRow()]);
      setSuccess(`${created.length} referencia${created.length === 1 ? " cargada" : "s cargadas"}`);
      onSaved?.(tipoId, created);
    } catch (e) {
      setError(e.message || "Error cargando referencias");
    } finally {
      setSaving(false);
    }
  }

  async function submitUpload(e) {
    e.preventDefault();

    const tipoId = Number(selectedTipoId);
    if (!Number.isInteger(tipoId) || tipoId <= 0) {
      setError("Seleccioná un tipo de máquina");
      return;
    }

    const items = rows.filter((row) => row.file || String(row.descripcion || "").trim());
    if (!items.length) {
      setError("Agregá al menos una imagen con descripción");
      return;
    }

    for (const row of items) {
      if (!row.file) {
        setError("Hay una fila sin imagen");
        return;
      }

      const descripcion = String(row.descripcion || "").trim();
      if (!descripcion) {
        setError("Cada imagen necesita una descripción breve");
        return;
      }
    }

    setConfirmDialog({
      type: "upload",
      title: "Confirmar carga",
      message:
        items.length === 1
          ? `Vas a cargar 1 referencia para ${tipoSeleccionado?.nombre || "este tipo"}.` +
            "\n\nRevisá que la imagen y la descripción estén correctas antes de confirmar."
          : `Vas a cargar ${items.length} referencias para ${tipoSeleccionado?.nombre || "este tipo"}.` +
            "\n\nRevisá que las imágenes y descripciones estén correctas antes de confirmar.",
      confirmLabel: "Cargar",
      tone: "default",
      onConfirm: async () => {
        closeConfirmDialog();
        await executeUpload(items, tipoId);
      },
    });
  }

  async function executeSaveEdit(reference, descripcion, file) {
    try {
      setEditSaving(true);
      setError("");

      const formData = new FormData();
      formData.append("descripcion", descripcion);
      if (file) {
        formData.append("file", file);
      }

      const res = await fetch(
        `${API_BASE}/admin/maquinas/tipos/${selectedTipoId}/referencias/${reference.id}`,
        {
          method: "PUT",
          body: formData,
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error actualizando referencia");
      }

      setEditingId(null);
      setEditDescripcion("");
      setEditFile(null);
      await onSaved?.(Number(selectedTipoId), [data]);

      const reload = await fetch(`${API_BASE}/admin/maquinas/tipos/${selectedTipoId}/referencias`);
      const reloadData = await reload.json().catch(() => ({}));
      if (reload.ok) {
        setReferencias(Array.isArray(reloadData?.referencias) ? reloadData.referencias : []);
        setCurrentIndex((prev) => Math.min(prev, Math.max((reloadData?.referencias?.length || 1) - 1, 0)));
      }
    } catch (e) {
      setError(e.message || "Error actualizando referencia");
    } finally {
      setEditSaving(false);
    }
  }

  async function saveEdit() {
    const current = referencias[currentIndex];
    if (!current || !selectedTipoId) {
      return;
    }

    const descripcion = String(editDescripcion || "").trim();
    if (!descripcion) {
      setError("La descripción no puede quedar vacía");
      return;
    }

    setConfirmDialog({
      type: "edit",
      title: "Confirmar cambios",
      message:
        editFile
          ? "Vas a actualizar la descripción y reemplazar la imagen de esta referencia.\n\nConfirmá solo si estás seguro de los cambios."
          : "Vas a actualizar la descripción de esta referencia.\n\nConfirmá solo si estás seguro de los cambios.",
      confirmLabel: "Guardar cambios",
      tone: "default",
      onConfirm: async () => {
        closeConfirmDialog();
        await executeSaveEdit(current, descripcion, editFile);
      },
    });
  }

  async function deleteCurrent() {
    const current = referencias[currentIndex];
    if (!current || !selectedTipoId) {
      return;
    }

    setConfirmDialog({
      type: "delete",
      title: "Eliminar referencia",
      message:
        `Vas a eliminar la referencia ${currentIndex + 1} de ${referencias.length}.\n\n` +
        "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      tone: "danger",
      onConfirm: async () => {
        try {
          setDeleteId(current.id);
          setError("");

          const res = await fetch(
            `${API_BASE}/admin/maquinas/tipos/${selectedTipoId}/referencias/${current.id}`,
            { method: "DELETE" }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || "Error eliminando referencia");
          }

          const reload = await fetch(`${API_BASE}/admin/maquinas/tipos/${selectedTipoId}/referencias`);
          const reloadData = await reload.json().catch(() => ({}));
          const lista = Array.isArray(reloadData?.referencias) ? reloadData.referencias : [];
          setReferencias(lista);
          setCurrentIndex((prev) => Math.min(prev, Math.max(lista.length - 1, 0)));
          setEditingId(null);
          setEditDescripcion("");
          setEditFile(null);
          onSaved?.(Number(selectedTipoId));
        } catch (e) {
          setError(e.message || "Error eliminando referencia");
        } finally {
          setDeleteId(null);
        }
      },
    });
  }

  if (!open) return null;

  const current = referencias[currentIndex] || null;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < referencias.length - 1;
  const panelTitle = mode === "view" ? "Ver referencias" : "Cargar referencias";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{panelTitle}</h2>
            <p className="text-sm text-gray-600">
              {mode === "view"
                ? "Carrusel de imágenes con su descripción breve."
                : "Subí fotos asociadas al tipo de máquina seleccionado."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[360px_1fr]">
          <aside className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-slate-50 p-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Tipo de máquina
            </label>

            {mode === "upload" ? (
              <select
                className="mb-3 rounded-xl border border-gray-200 bg-white p-3 text-sm"
                value={selectedTipoId}
                onChange={(e) => setSelectedTipoId(e.target.value)}
              >
                <option value="">Seleccionar tipo...</option>
                {tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 text-sm font-medium text-gray-700">
                {tipoInicialNombre || tipoSeleccionado?.nombre || "Tipo seleccionado"}
              </div>
            )}

            {mode === "upload" ? (
              <form className="flex min-h-0 flex-1 flex-col" onSubmit={submitUpload}>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {rows.map((row, index) => (
                    <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Imagen {index + 1}
                        </p>
                        {rows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="text-xs font-semibold text-red-600 hover:text-red-700"
                          >
                            Quitar
                          </button>
                        ) : null}
                      </div>

                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="mb-3 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                        onChange={(e) => updateRow(row.id, { file: e.target.files?.[0] || null })}
                      />

                      <textarea
                        value={row.descripcion}
                        onChange={(e) => updateRow(row.id, { descripcion: e.target.value })}
                        className="min-h-24 w-full rounded-xl border border-gray-200 p-3 text-sm"
                        placeholder="Descripción breve"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Agregar otra foto
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {saving ? "Guardando..." : "Cargar referencias"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-dashed border-gray-300 bg-white p-4">
                {loading ? (
                  <div className="text-sm text-gray-600">Cargando referencias...</div>
                ) : referencias.length === 0 ? (
                  <div className="text-sm text-gray-600">Todavía no hay referencias cargadas para este tipo.</div>
                ) : (
                  <div className="space-y-3">
                    {referencias.map((referencia, index) => (
                      <button
                        type="button"
                        key={referencia.id}
                        onClick={() => setCurrentIndex(index)}
                        className={`flex w-full gap-3 rounded-2xl border p-2 text-left transition ${
                          index === currentIndex ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <img
                          src={referencia.imageUrl}
                          alt={referencia.descripcion}
                          className="h-16 w-16 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{referencia.descripcion}</p>
                          <p className="text-xs text-gray-500">Referencia #{index + 1}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>

          <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white p-4">
            {error ? (
              <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}
            {success && mode === "upload" ? (
              <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
            ) : null}

            {mode === "view" ? (
              loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-600">Cargando...</div>
              ) : referencias.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-sm text-gray-600">
                  No hay referencias para mostrar.
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{current?.descripcion}</p>
                      <p className="text-xs text-gray-500">
                        {currentIndex + 1} de {referencias.length}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!canGoPrev}
                        onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        disabled={!canGoNext}
                        onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, referencias.length - 1))}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                    <img
                      src={current?.imageUrl}
                      alt={current?.descripcion || "Referencia"}
                      className="max-h-[52vh] w-full rounded-2xl object-contain"
                    />
                  </div>

                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-gray-700">
                        <p className="font-medium">Descripción</p>
                        <p className="text-sm text-gray-600">{current?.descripcion}</p>
                      </div>

                      {canEdit ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(current.id);
                              setEditDescripcion(current.descripcion || "");
                              setEditFile(null);
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={deleteCurrent}
                            disabled={deleteId === current.id}
                            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-red-300"
                          >
                            {deleteId === current.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {editingId === current?.id ? (
                      <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                        <p className="mb-3 text-sm font-semibold text-blue-900">Editar referencia</p>
                        <textarea
                          value={editDescripcion}
                          onChange={(e) => setEditDescripcion(e.target.value)}
                          className="mb-3 min-h-24 w-full rounded-xl border border-blue-200 p-3 text-sm"
                          placeholder="Descripción breve"
                        />
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="mb-3 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-gray-50"
                          onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditDescripcion("");
                              setEditFile(null);
                            }}
                            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={editSaving}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                          >
                            {editSaving ? "Guardando..." : "Guardar cambios"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-slate-50 text-center text-sm text-gray-600">
                Seleccioná un tipo de máquina, cargá una o varias fotos y guardá las referencias.
              </div>
            )}
          </section>
        </div>

        <ConfirmModal
          open={Boolean(confirmDialog)}
          title={confirmDialog?.title || "Confirmar acción"}
          message={confirmDialog?.message || "Confirmá la acción para continuar."}
          confirmLabel={confirmDialog?.confirmLabel || "Confirmar"}
          cancelLabel="Cancelar"
          tone={confirmDialog?.tone || "default"}
          onCancel={closeConfirmDialog}
          onConfirm={confirmDialog?.onConfirm}
        />
      </div>
    </div>
  );
}
