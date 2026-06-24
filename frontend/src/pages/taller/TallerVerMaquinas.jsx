import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../services/apiBase";
import { useAuth } from "../../context/AuthContext";
import { buildActorHeaders } from "../../utils/authHeaders";

export default function TallerVerMaquinas() {
  const { user } = useAuth();
  const actorHeaders = useMemo(() => buildActorHeaders(user), [user]);

  const [maquinas, setMaquinas] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [maquinasRes, historialRes] = await Promise.all([
        fetch(`${API_BASE}/admin/maquinas`, { headers: actorHeaders }),
        fetch(`${API_BASE}/admin/taller/maquinas/historial?limit=300`, { headers: actorHeaders }),
      ]);

      const data = await maquinasRes.json().catch(() => []);
      const historialData = await historialRes.json().catch(() => []);

      if (!maquinasRes.ok) throw new Error(data?.error || "No se pudo cargar maquinas");
      if (!historialRes.ok) throw new Error(historialData?.error || "No se pudo cargar historial de taller");

      const ingresoPorId = new Map();
      for (const entry of Array.isArray(historialData) ? historialData : []) {
        const id = entry?.maquina?.id;
        if (entry?.accion === "ingreso" && id && !ingresoPorId.has(id)) {
          ingresoPorId.set(id, entry.createdAt);
        }
      }

      const soloTaller = Array.isArray(data)
        ? data
            .filter((item) => item.estado === "taller")
            .map((item) => ({ ...item, ingresoTallerAt: ingresoPorId.get(item.id) || null }))
        : [];
      setMaquinas(soloTaller);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error cargando taller");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user?.username]);

  const filtradas = useMemo(() => {
    if (!search.trim()) return maquinas;
    const q = search.trim().toLowerCase();
    return maquinas.filter((item) =>
      [item.id, item.tipo, item.modelo, item.serie, item.servicio?.nombre]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [maquinas, search]);

  if (loading) return <div className="p-4">Cargando maquinas en taller...</div>;

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/admin/taller/ver" className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow">
            ← Ver Taller
          </Link>
          <Link to="/admin/taller/registrar/maquinas" className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            Registrar ingreso/egreso
          </Link>
        </div>

        <header className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">Ver Taller - Maquinas</h1>
          <p className="mt-1 text-sm text-gray-600">Listado completo de maquinas actualmente en taller.</p>
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-gray-500">Total en taller</p>
            <p className="text-2xl font-bold text-amber-700">{maquinas.length}</p>
          </div>
        </header>

        {error ? <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        <input
          className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm"
          placeholder="Buscar maquinas en taller..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="space-y-2">
        {filtradas.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-sm">
            <p><b>{item.id}</b> · {item.tipo} · {item.modelo || "-"}</p>
            <p className="text-gray-600">Serie: {item.serie || "-"}</p>
            <p className="text-gray-600">Servicio: {item.servicio?.nombre || "-"}</p>
            <p className="text-gray-600">Ingreso a taller: {item.ingresoTallerAt ? new Date(item.ingresoTallerAt).toLocaleString("es-AR") : "-"}</p>
          </div>
        ))}
        {!filtradas.length ? <div className="rounded-xl border bg-white p-3 text-sm text-gray-500">No hay maquinas en taller.</div> : null}
        </div>
      </div>
    </div>
  );
}
