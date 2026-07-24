import { useEffect, useMemo, useState } from "react";
import BotonVolver from "../components/BotonVolver";
import ConfirmModal from "../components/ConfirmModal";
import TipoMaquinaReferenciasModal from "../components/TipoMaquinaReferenciasModal";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../hooks/usePaginacion";

export default function AdminTiposMaquina() {
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

  const paginacion = usePaginacion(tiposFiltrados, { reinicio: [search] });

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
      <BotonVolver />

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
        <form onSubmit={save} className="mb-4 rounded-2xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-kazaro-ice text-kazaro-blue">
              {editing ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {editing ? `Editar tipo: ${editing.nombre}` : "Crear nuevo tipo"}
              </h2>
              <p className="text-xs text-slate-500">
                {editing
                  ? "Modificá el nombre y guardá los cambios."
                  : "Agregá un tipo nuevo al parque de máquinas."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="flex-1 rounded-xl border p-3"
              placeholder="Nombre del tipo"
            />

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:bg-blue-300"
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

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow">
        <svg className="h-5 w-5 flex-none text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          placeholder="Buscar entre los tipos existentes..."
        />
        <span className="flex-none rounded-full bg-kazaro-ice px-3 py-1 text-xs font-semibold text-kazaro-deep">
          {tiposFiltrados.length} tipo{tiposFiltrados.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2">
        {paginacion.visibles.map((tipo) => (
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

      <Paginacion
        pagina={paginacion.pagina}
        totalPaginas={paginacion.totalPaginas}
        total={paginacion.total}
        tamano={paginacion.tamano}
        onPagina={paginacion.irAPagina}
        onTamano={paginacion.cambiarTamano}
        etiqueta="tipos"
      />

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
