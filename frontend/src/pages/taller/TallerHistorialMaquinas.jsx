import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../services/apiBase";
import { useAuth } from "../../context/AuthContext";
import { buildActorHeaders } from "../../utils/authHeaders";
import SearchableSelect from "../../components/SearchableSelect";

export default function TallerHistorialMaquinas() {
  const { user } = useAuth();
  const actorHeaders = useMemo(() => buildActorHeaders(user), [user]);

  const [historial, setHistorial] = useState([]);
  const [search, setSearch] = useState("");
  const [accion, setAccion] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/admin/taller/maquinas/historial?limit=300`, { headers: actorHeaders });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar historial de maquinas");
      setHistorial(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error cargando historial");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user?.username]);

  const filtrado = useMemo(() => {
    let data = [...historial];
    if (accion) data = data.filter((item) => item.accion === accion);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((item) =>
        [item.maquina?.id, item.maquina?.tipo, item.maquina?.modelo, item.usuario?.username, item.usuario?.nombre, item.observacion]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }
    return data;
  }, [historial, accion, search]);

  if (loading) return <div className="p-4">Cargando historial de maquinas...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link to="/admin/taller" className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm">
          ← Modulo Taller
        </Link>
        <Link to="/admin/taller/movimientos/maquinas" className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
          Ir a movimientos maquinas
        </Link>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold">Historial - Maquinas</h1>
        <p className="text-sm text-gray-600">Ultimos movimientos registrados de maquinas en taller.</p>
      </div>

      {error ? <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="mb-3 grid gap-2 md:grid-cols-2">
        <input
          className="rounded-xl border p-2 text-sm"
          placeholder="Buscar por equipo, usuario u observacion"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <SearchableSelect className="rounded-xl border p-2 text-sm" value={accion} onChange={(event) => setAccion(event.target.value)}>
          <option value="">todas</option>
          <option value="ingreso">ingreso</option>
          <option value="egreso">egreso</option>
        </SearchableSelect>
      </div>

      <div className="space-y-2">
        {filtrado.map((entry) => (
          <div key={entry.id} className="rounded-xl border bg-white p-3 text-sm">
            <p>
              <b>{entry.maquina?.id || "-"}</b> · {entry.accion} · {new Date(entry.createdAt).toLocaleString("es-AR")}
            </p>
            <p className="text-gray-700">Usuario: {entry.usuario?.nombre || entry.usuario?.username || "-"}</p>
            <p className="text-gray-700">Observacion: {entry.observacion || "-"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
