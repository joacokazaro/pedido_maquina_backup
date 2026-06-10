import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

export default function AdminKits() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isReadOnly = rolUpper === "COORDINADOR" || rolUpper === "CONSULTOR";
  const [kits, setKits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [activoFiltro, setActivoFiltro] = useState("true");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/admin/kits`);
        const data = await res.json().catch(() => []);
        setKits(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return kits.filter((kit) => {
      if (activoFiltro === "true" && !kit.activo) return false;
      if (activoFiltro === "false" && kit.activo) return false;
      if (estadoFiltro && kit.estado !== estadoFiltro) return false;
      if (!query) return true;

      return [
        kit.nombre,
        kit.observaciones,
        kit.eventualActivo?.nombre,
        kit.eventualActivo?.supervisor?.nombre,
        kit.eventualActivo?.supervisor?.username,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [kits, search, estadoFiltro, activoFiltro]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate("/admin/eventuales")}
        className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
      >
        ← Volver al panel de eventuales
      </button>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kits</h1>
          <p className="text-sm text-gray-600">ABMC de kits con exclusividad de maquinas y vehiculos.</p>
        </div>
        {!isReadOnly ? (
          <Link
            to="/admin/kits/nuevo"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Nuevo kit
          </Link>
        ) : null}
      </header>

      <div className="mb-4 rounded-2xl bg-white p-3 shadow space-y-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, observaciones o eventual asociado..."
          className="w-full rounded-xl border p-2.5 text-sm"
        />

        <div className="grid gap-2 md:grid-cols-3">
          <select className="rounded-xl border p-2 text-sm" value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)}>
            <option value="">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="asignado">Asignado</option>
          </select>

          <select className="rounded-xl border p-2 text-sm" value={activoFiltro} onChange={(event) => setActivoFiltro(event.target.value)}>
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Baja logica</option>
          </select>

          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            {filtered.length} kit{filtered.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando kits...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow">
          No hay kits que coincidan con los filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((kit) => (
            <Link
              key={kit.id}
              to={`/admin/kits/${kit.id}`}
              className="block rounded-2xl bg-white p-4 shadow transition hover:shadow-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{kit.nombre}</h2>
                    {!kit.activo ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase text-red-700">
                        baja logica
                      </span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700">
                      {kit.estado}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-gray-600">{kit.observaciones || "Sin observaciones"}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {kit.resumen?.maquinas || 0} maquinas · {kit.resumen?.vehiculos || 0} vehiculos
                  </p>
                  <p className="text-xs text-gray-500">
                    Eventual activo: {kit.eventualActivo?.nombre || "Ninguno"}
                  </p>
                </div>

                <div className="max-w-sm space-y-2 text-right">
                  {kit.bloqueadoParaAsignacion ? (
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Bloqueado para asignacion: {kit.bloqueos?.[0]?.mensaje}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      Disponible para asignar a un eventual.
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
