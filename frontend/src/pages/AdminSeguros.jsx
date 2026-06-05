import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import { API_BASE } from "../services/apiBase";

export default function AdminSeguros() {
  const navigate = useNavigate();
  const [seguros, setSeguros] = useState([]);
  const [nombre, setNombre] = useState("");
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    const res = await fetch(`${API_BASE}/admin/seguros`);
    const data = await res.json().catch(() => []);
    setSeguros(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      setError("");
      const res = await fetch(
        editing ? `${API_BASE}/admin/seguros/${editing.id}` : `${API_BASE}/admin/seguros`,
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error guardando seguro");
      }

      setNombre("");
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message || "Error guardando seguro");
    }
  }

  async function remove() {
    if (!deleteTarget) return;

    try {
      setError("");
      const res = await fetch(`${API_BASE}/admin/seguros/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error eliminando seguro");
      }
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e.message || "Error eliminando seguro");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <h1 className="mb-4 text-2xl font-bold">Seguros</h1>

      {error && <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div>}

      <div className="mb-4 rounded-2xl bg-white p-4 shadow space-y-3">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-xl border p-3" placeholder="Nombre del seguro" />
        <div className="flex gap-2">
          <button onClick={save} className="flex-1 rounded-xl bg-blue-600 p-3 font-semibold text-white">{editing ? "Guardar cambios" : "Crear seguro"}</button>
          {editing && (
            <button onClick={() => { setEditing(null); setNombre(""); }} className="rounded-xl border px-4 py-3">
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {seguros.map((seguro) => (
          <div key={seguro.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow">
            <div>
              <p className="font-semibold">{seguro.nombre}</p>
              <p className="text-xs text-gray-500">Vehículos asociados: {seguro.vehiculosCount}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditing(seguro); setNombre(seguro.nombre); }} className="rounded-lg border px-3 py-2 text-sm">Editar</button>
              <button onClick={() => setDeleteTarget(seguro)} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white">Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar seguro"
        message={`¿Confirmás eliminar el seguro ${deleteTarget?.nombre || ""}?`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
    </div>
  );
}
