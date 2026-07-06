import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

function sortByNombre(items) {
  return [...items].sort((a, b) =>
    String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
      sensitivity: "base",
      numeric: true,
    })
  );
}

export default function AdminPlazosAmortizacion() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isReadOnly = hasRole("COORDINADOR") || hasRole("CONSULTOR") || hasRole("TALLER");

  const [plazos, setPlazos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [meses, setMeses] = useState("");
  const [selectedTipoIds, setSelectedTipoIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveConfirm, setSaveConfirm] = useState(null);
  const [deleteErrorModal, setDeleteErrorModal] = useState("");
  const [search, setSearch] = useState("");
  const [tipoSearch, setTipoSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/admin/maquinas/plazos-amortizacion`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error cargando plazos de amortizacion");
      }

      setPlazos(Array.isArray(data?.plazos) ? data.plazos : []);
      setTipos(Array.isArray(data?.tipos) ? sortByNombre(data.tipos) : []);
    } catch (e) {
      setError(e.message || "Error cargando plazos de amortizacion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const plazosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? plazos.filter((plazo) => {
          const byNombre = String(plazo.nombre || "").toLowerCase().includes(q);
          const byMeses = String(plazo.meses || "").includes(q);
          const byTipos = (plazo.tiposMaquina || []).some((tipo) => String(tipo.nombre || "").toLowerCase().includes(q));
          return byNombre || byMeses || byTipos;
        })
      : [...plazos];

    return base.sort((a, b) => {
      const mesesDiff = Number(a.meses || 0) - Number(b.meses || 0);
      if (mesesDiff !== 0) return mesesDiff;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    });
  }, [plazos, search]);

  const tiposFiltrados = useMemo(() => {
    const q = tipoSearch.trim().toLowerCase();
    if (!q) return sortByNombre(tipos);
    return sortByNombre(
      tipos.filter((tipo) => String(tipo.nombre || "").toLowerCase().includes(q))
    );
  }, [tipos, tipoSearch]);

  function resetForm() {
    setNombre("");
    setMeses("");
    setSelectedTipoIds([]);
    setEditing(null);
    setTipoSearch("");
  }

  function toggleTipo(tipoId) {
    setSelectedTipoIds((prev) => {
      if (prev.includes(tipoId)) {
        return prev.filter((id) => id !== tipoId);
      }
      return [...prev, tipoId];
    });
  }

  function getTiposReasignados(tipoIds, currentPlazoId = null) {
    const tipoById = new Map(tipos.map((tipo) => [tipo.id, tipo]));
    const movidos = [];

    tipoIds.forEach((tipoId) => {
      const plazoActual = plazos.find(
        (plazo) => plazo.id !== currentPlazoId && (plazo.tiposMaquina || []).some((tipo) => tipo.id === tipoId)
      );
      if (!plazoActual) return;

      const tipo = tipoById.get(tipoId);
      movidos.push({
        tipoNombre: tipo?.nombre || "(Sin nombre)",
        plazoNombre: plazoActual.nombre || "(Sin nombre)",
      });
    });

    return sortByNombre(movidos.map((item) => ({ id: `${item.tipoNombre}-${item.plazoNombre}`, nombre: item.tipoNombre, ...item })));
  }

  function save(e) {
    e.preventDefault();
    if (isReadOnly) return;

    const payload = {
      nombre: String(nombre || "").trim(),
      meses: Number(meses),
      tipoIds: selectedTipoIds,
    };

    const tiposReasignados = getTiposReasignados(selectedTipoIds, editing?.id || null);
    const isCreate = !editing;

    const lines = [
      isCreate
        ? `Se va a crear el plazo \"${payload.nombre || "(Sin nombre)"}\" con ${payload.meses || 0} meses.`
        : `Se van a guardar los cambios del plazo \"${payload.nombre || "(Sin nombre)"}\".`,
    ];

    if (tiposReasignados.length > 0) {
      lines.push("");
      lines.push("Atencion: estos tipos ya estan asignados en otros plazos y se moveran automaticamente:");
      tiposReasignados.forEach((item) => {
        lines.push(`- ${item.tipoNombre} (actual: ${item.plazoNombre})`);
      });
    }

    setSaveConfirm({
      title: isCreate ? "Confirmar creacion" : "Confirmar cambios",
      message: lines.join("\n"),
      payload,
      editingId: editing?.id || null,
    });
  }

  async function confirmSave() {
    if (!saveConfirm) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch(
        saveConfirm.editingId
          ? `${API_BASE}/admin/maquinas/plazos-amortizacion/${saveConfirm.editingId}`
          : `${API_BASE}/admin/maquinas/plazos-amortizacion`,
        {
          method: saveConfirm.editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveConfirm.payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error guardando plazo");
      }

      resetForm();
      setSaveConfirm(null);
      await load();
    } catch (e) {
      setError(e.message || "Error guardando plazo");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget || isReadOnly) return;

    try {
      setError("");
      const res = await fetch(`${API_BASE}/admin/maquinas/plazos-amortizacion/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error eliminando plazo");
      }

      setDeleteTarget(null);
      await load();
    } catch (e) {
      setDeleteTarget(null);
      setDeleteErrorModal(e.message || "Error eliminando plazo");
    }
  }

  if (loading) return <div className="p-4">Cargando plazos de amortizacion...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <header className="mb-4">
        <h1 className="text-2xl font-bold">Plazos de amortizacion</h1>
        <p className="text-xs text-gray-600">ABM de plazos y asignacion de tipos de maquina</p>
      </header>

      {error && (
        <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isReadOnly ? (
        <form onSubmit={save} className="mb-4 rounded-2xl bg-white p-4 shadow space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl border p-3"
              placeholder="Nombre del plazo"
            />

            <input
              type="number"
              min="1"
              value={meses}
              onChange={(e) => setMeses(e.target.value)}
              className="w-full rounded-xl border p-3"
              placeholder="Cantidad de meses"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">Tipos de maquina asociados</p>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">
                Seleccionados: {selectedTipoIds.length}
              </span>
            </div>

            <input
              value={tipoSearch}
              onChange={(e) => setTipoSearch(e.target.value)}
              className="mb-2 w-full rounded-xl border p-2 text-sm"
              placeholder="Filtrar tipos..."
            />

            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
              <div className="grid gap-2 md:grid-cols-3">
              {tiposFiltrados.map((tipo) => {
                const selected = selectedTipoIds.includes(tipo.id);
                return (
                  <button
                    type="button"
                    key={tipo.id}
                    onClick={() => toggleTipo(tipo.id)}
                    className={`rounded-lg border px-3 py-1.5 text-left text-xs font-semibold transition ${
                      selected
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {tipo.nombre}
                  </button>
                );
              })}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:bg-blue-300"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear plazo"}
            </button>

            {editing ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border px-4 py-3"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
          Modo solo lectura.
        </p>
      )}

      <div className="mb-4 rounded-2xl bg-white p-3 shadow">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border p-2.5 text-sm"
          placeholder="Buscar por nombre, meses o tipo..."
        />
      </div>

      <div className="space-y-2">
        {plazosFiltrados.map((plazo) => (
          <div
            key={plazo.id}
            className="rounded-2xl bg-white p-4 shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{plazo.nombre}</p>
                <p className="text-xs text-gray-500">{plazo.meses} meses</p>
                <p className="mt-2 text-xs text-gray-600">
                  Tipos: {(plazo.tiposMaquina || []).length}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sortByNombre(plazo.tiposMaquina || []).map((tipo) => (
                    <span key={tipo.id} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      {tipo.nombre}
                    </span>
                  ))}
                </div>
              </div>

              {!isReadOnly ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(plazo);
                      setNombre(plazo.nombre || "");
                      setMeses(String(plazo.meses || ""));
                      setSelectedTipoIds((plazo.tiposMaquina || []).map((tipo) => tipo.id));
                    }}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(plazo)}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
                  >
                    Eliminar
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {plazosFiltrados.length === 0 && (
          <div className="mt-6 text-center text-sm text-gray-500">
            No hay plazos que coincidan con la busqueda
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(saveConfirm)}
        title={saveConfirm?.title || "Confirmar"}
        message={saveConfirm?.message || ""}
        confirmLabel={saving ? "Guardando..." : saveConfirm?.editingId ? "Guardar" : "Crear"}
        cancelLabel="Cancelar"
        onCancel={() => {
          if (!saving) setSaveConfirm(null);
        }}
        onConfirm={confirmSave}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar plazo"
        message={`Confirmas eliminar el plazo ${deleteTarget?.nombre || ""}? Solo se puede eliminar si no tiene tipos asociados.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
      />

      <ConfirmModal
        open={Boolean(deleteErrorModal)}
        title="No se pudo eliminar"
        message={deleteErrorModal}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setDeleteErrorModal("")}
      />
    </div>
  );
}
