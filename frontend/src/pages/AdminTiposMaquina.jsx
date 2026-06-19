import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
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
        <h1 className="text-2xl font-bold">Tipos de maquinas</h1>
        <p className="text-xs text-gray-600">ABM de tipos disponibles para el parque de maquinas</p>
      </header>

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
            className="flex items-center justify-between rounded-2xl bg-white p-4 shadow"
          >
            <div>
              <p className="font-semibold">{tipo.nombre}</p>
              <p className="text-xs text-gray-500">
                Maquinas asociadas: {tipo.maquinasCount}
              </p>
            </div>

            {!isReadOnly ? (
              <div className="flex gap-2">
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
              </div>
            ) : null}
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
    </div>
  );
}
