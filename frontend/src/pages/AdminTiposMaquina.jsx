import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import TipoMaquinaReferenciasModal from "../components/TipoMaquinaReferenciasModal";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

export default function AdminTiposMaquina() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isReadOnly = rolUpper === "COORDINADOR" || rolUpper === "CONSULTOR";

  const [tipos, setTipos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [referenciasModal, setReferenciasModal] = useState({
    open: false,
    mode: "view",
    tipoId: "",
    tipoNombre: "",
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/admin/maquinas/tipos`);
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(data.error || "Error cargando tipos de maquinas");
      }

      setTipos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Error cargando tipos de maquinas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const tiposFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const lista = q
      ? tipos.filter((tipo) => tipo.nombre.toLowerCase().includes(q))
      : [...tipos];

    return lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [tipos, search]);

  function resetForm() {
    setNombre("");
    setEditing(null);
  }

  function openReferenciasModal(tipo, mode = "view") {
    setReferenciasModal({
      open: true,
      mode,
      tipoId: String(tipo?.id || ""),
      tipoNombre: tipo?.nombre || "",
    });
  }

  function closeReferenciasModal() {
    setReferenciasModal({
      open: false,
      mode: "view",
      tipoId: "",
      tipoNombre: "",
    });
  }

  async function save(e) {
    e.preventDefault();
    if (isReadOnly) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch(
        editing
          ? `${API_BASE}/admin/maquinas/tipos/${editing.id}`
          : `${API_BASE}/admin/maquinas/tipos`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error guardando tipo");
      }

      resetForm();
      await load();
    } catch (e) {
      setError(e.message || "Error guardando tipo");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget || isReadOnly) return;

    try {
      setError("");
      const res = await fetch(`${API_BASE}/admin/maquinas/tipos/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Error eliminando tipo");
      }

      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e.message || "Error eliminando tipo");
    }
  }

  if (loading) return <div className="p-4">Cargando tipos de maquinas...</div>;

  const actionBtnBase =
    "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition";
  const actionBtnMuted =
    `${actionBtnBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`;
  const actionBtnSoft =
    `${actionBtnBase} border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200`;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        {"<-"} Volver
      </button>

      <header className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Tipos de maquinas</h1>
            <p className="text-xs text-gray-600">ABM de tipos disponibles para el parque de maquinas</p>
          </div>
        </div>
      </header>

      {!isReadOnly ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReferenciasModal({ open: true, mode: "upload", tipoId: "", tipoNombre: "" })}
              className={actionBtnSoft}
            >
              Cargar referencias
            </button>
          </div>

          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
            Subidas asociadas por tipo
          </span>
        </div>
      ) : null}

      {error && (
        <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isReadOnly ? (
        <form onSubmit={save} className="mb-4 rounded-2xl bg-white p-4 shadow space-y-3">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border p-3"
            placeholder="Nombre del tipo"
          />

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 p-3 font-semibold text-white disabled:bg-blue-300"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear tipo"}
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
          placeholder="Buscar tipo..."
        />
      </div>

      <div className="space-y-2">
        {tiposFiltrados.map((tipo) => (
          <div
            key={tipo.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{tipo.nombre}</p>
              <p className="text-xs text-gray-500">
                Maquinas asociadas: {tipo.maquinasCount}
              </p>
              <p className="text-xs text-gray-500">
                Referencias cargadas: {tipo.referenciasCount || 0}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openReferenciasModal(tipo, "view")}
                className={actionBtnMuted}
              >
                Ver referencias
              </button>

              {!isReadOnly ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(tipo);
                      setNombre(tipo.nombre);
                    }}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(tipo)}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
                  >
                    Eliminar
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ))}

        {tiposFiltrados.length === 0 && (
          <div className="mt-6 text-center text-sm text-gray-500">
            No hay tipos que coincidan con la busqueda
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar tipo"
        message={`Confirmas eliminar el tipo ${deleteTarget?.nombre || ""}? Solo se puede eliminar si no tiene maquinas asociadas.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
      />

      <TipoMaquinaReferenciasModal
        open={referenciasModal.open}
        mode={referenciasModal.mode}
        tipos={tipos}
        tipoInicialId={referenciasModal.tipoId}
        tipoInicialNombre={referenciasModal.tipoNombre}
        canEdit={!isReadOnly}
        onClose={closeReferenciasModal}
        onSaved={async () => {
          await load();
        }}
      />
    </div>
  );
}
