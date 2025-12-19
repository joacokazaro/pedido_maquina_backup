import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "disponible", label: "Disponible" },
  { value: "asignada", label: "Asignada" },
  { value: "no_devuelta", label: "No devuelta" },
  { value: "fuera_servicio", label: "Fuera de servicio" },
  { value: "reparacion", label: "En reparación" },
  { value: "baja", label: "Baja" }
];

export default function AdminMaquinas() {
  const navigate = useNavigate();

  const [allMaquinas, setAllMaquinas] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [maqsRes, resumenRes] = await Promise.all([
          fetch(`${API_BASE}/admin/maquinas`),
          fetch(`${API_BASE}/admin/maquinas/stock-resumen`)
        ]);

        const maqs = await maqsRes.json();
        const resumenData = await resumenRes.json();

        setAllMaquinas(maqs || []);
        setResumen(resumenData);
      } catch (e) {
        console.error(e);
        setError("Error cargando máquinas");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    let data = [...allMaquinas];

    if (tipoFiltro) data = data.filter(m => m.tipo === tipoFiltro);
    if (estadoFiltro) data = data.filter(m => m.estado === estadoFiltro);

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(m =>
        m.id?.toLowerCase().includes(q) ||
        m.tipo?.toLowerCase().includes(q) ||
        m.modelo?.toLowerCase().includes(q) ||
        m.serie?.toLowerCase().includes(q) ||
        m.servicio?.nombre?.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const t = (a.tipo || "").localeCompare(b.tipo || "");
      return t !== 0 ? t : a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    setFiltered(data);
  }, [allMaquinas, search, tipoFiltro, estadoFiltro]);

  const tiposUnicos = Array.from(
    new Set(allMaquinas.map(m => m.tipo).filter(Boolean))
  ).sort();

  if (loading) return <div className="p-4">Cargando máquinas...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Máquinas</h1>
          <p className="text-xs text-gray-600">Gestión del parque de máquinas</p>
        </div>
        <button onClick={() => navigate("/admin")} className="text-xs text-blue-600 underline">
          Volver
        </button>
      </header>

      {resumen && (
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
          {Object.entries(resumen.porEstado || {}).map(([estado, cant]) => (
            <div key={estado} className="bg-white rounded-xl shadow px-3 py-2 flex justify-between">
              <span className="capitalize">{estado.replace("_", " ")}</span>
              <b>{cant}</b>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-3 mb-4 space-y-3">
        <input
          className="w-full p-2.5 rounded-xl border text-sm"
          placeholder="Buscar por código, tipo, modelo, serie o servicio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="flex gap-2">
          <select
            className="flex-1 p-2 rounded-xl border text-xs"
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {tiposUnicos.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            className="flex-1 p-2 rounded-xl border text-xs"
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value)}
          >
            {ESTADOS.map(e => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(m => (
          <button
            key={m.id}
            onClick={() => navigate(`/admin/maquinas/${encodeURIComponent(m.id)}`)}
            className="w-full text-left bg-white rounded-2xl shadow px-4 py-3"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-sm font-bold uppercase">{m.tipo}</p>
                <p className="text-xs text-gray-500">Código: <b>{m.id}</b></p>
              </div>
              <span className={estadoBadgeClass(m.estado)}>
                {m.estado}
              </span>
            </div>

            {m.modelo && (
              <p className="text-xs text-gray-600 mt-1">{m.modelo}</p>
            )}

            {m.servicio && (
              <p className="text-xs text-gray-500 mt-0.5">
                Servicio: <b>{m.servicio.nombre}</b>
              </p>
            )}
          </button>
        ))}
      </div>

      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => navigate("/admin/maquinas/nueva")}
          className="rounded-full w-14 h-14 bg-blue-600 text-white text-2xl shadow-lg"
        >
          +
        </button>
      </div>
    </div>
  );
}

function estadoBadgeClass(estado) {
  const base = "px-2 py-1 rounded-full text-[10px] font-semibold uppercase";
  switch (estado) {
    case "disponible": return `${base} bg-green-100 text-green-700`;
    case "asignada": return `${base} bg-blue-100 text-blue-700`;
    case "no_devuelta": return `${base} bg-red-100 text-red-700`;
    case "fuera_servicio": return `${base} bg-orange-100 text-orange-700`;
    case "reparacion": return `${base} bg-yellow-100 text-yellow-700`;
    case "baja": return `${base} bg-gray-200 text-gray-500`;
    default: return `${base} bg-gray-100 text-gray-600`;
  }
}
