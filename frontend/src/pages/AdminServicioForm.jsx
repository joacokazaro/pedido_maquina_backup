import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function AdminServicioForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const esEdicion = Boolean(id);

  const [nombre, setNombre] = useState("");
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(esEdicion);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!esEdicion) return;

    fetch(`${API_BASE}/admin/servicios/${id}`)
      .then(r => r.json())
      .then(data => {
        setNombre(data.nombre || "");
        setMaquinas(data.maquinas || []);
      })
      .catch(() => setError("Error cargando servicio"))
      .finally(() => setLoading(false));
  }, [id, esEdicion]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        esEdicion
          ? `${API_BASE}/admin/servicios/${id}`
          : `${API_BASE}/admin/servicios`,
        {
          method: esEdicion ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre }),
        }
      );

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error guardando");
      }

      navigate("/admin/servicios");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="text-xs text-blue-600 underline mb-3"
      >
        Volver
      </button>

      <h1 className="text-lg font-bold mb-3">
        {esEdicion ? "Editar servicio" : "Nuevo servicio"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow p-4 space-y-3"
      >
        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
            {error}
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1">
            Nombre del servicio
          </label>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full p-2 border rounded-xl"
          />
        </div>

        <button
          disabled={saving}
          className="w-full bg-orange-600 text-white py-2 rounded-xl font-semibold"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </form>

      {esEdicion && maquinas.length > 0 && (
        <div className="bg-white mt-4 rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Máquinas del servicio</h2>
          {maquinas.map(m => (
            <div
              key={m.id}
              className="text-xs bg-gray-50 p-2 rounded mb-1"
            >
              {m.tipo} — {m.id} ({m.estado})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
