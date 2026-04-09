import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "disponible", label: "Disponible" },
  { value: "asignada", label: "Asignada" },
  { value: "no_devuelta", label: "No devuelta" },
  { value: "fuera_servicio", label: "Fuera de servicio" },
  { value: "reparacion", label: "En reparación" },
  { value: "baja", label: "Baja" },
];

export default function DepositoServicioDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [servicio, setServicio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/servicios/catalogo/${id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo cargar el servicio");
        }

        const data = await res.json();
        if (!cancelled) {
          setServicio(data);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setServicio(null);
          setError(e.message || "Error cargando servicio");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const maquinas = useMemo(() => {
    let data = Array.isArray(servicio?.maquinas) ? [...servicio.maquinas] : [];

    if (tipoFiltro) data = data.filter((m) => m.tipo === tipoFiltro);
    if (estadoFiltro) data = data.filter((m) => m.estado === estadoFiltro);

    if (search.trim()) {
      const termino = search.toLowerCase();
      data = data.filter((m) =>
        m.id?.toLowerCase().includes(termino) ||
        m.tipo?.toLowerCase().includes(termino) ||
        m.modelo?.toLowerCase().includes(termino) ||
        m.serie?.toLowerCase().includes(termino) ||
        m.asignacion?.pedidoId?.toLowerCase().includes(termino)
      );
    }

    data.sort((a, b) => {
      const tipoComp = (a.tipo || "").localeCompare(b.tipo || "");
      return tipoComp !== 0
        ? tipoComp
        : (a.id || "").localeCompare(b.id || "", undefined, { numeric: true });
    });

    return data;
  }, [servicio, tipoFiltro, estadoFiltro, search]);

  const tipos = useMemo(() => {
    return Array.from(new Set((servicio?.maquinas || []).map((m) => m.tipo).filter(Boolean))).sort();
  }, [servicio]);

  if (loading) return <div className="p-4">Cargando servicio...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 sm:pr-20">
      <div className="mb-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow transition text-gray-700 text-sm font-medium"
        >
          <span className="text-lg leading-none">←</span>
          Volver
        </button>
      </div>

      <div className="mb-4">
        <h1 className="text-lg font-bold">
          {servicio?.nombre || "Servicio"}
        </h1>
        <p className="text-xs text-gray-600 mt-1">
          Vista de solo lectura para depósito.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-4 space-y-3 mb-4">
        <div className="text-sm text-gray-600">
          Máquinas asociadas: <span className="font-semibold text-gray-900">{servicio?.maquinas?.length || 0}</span>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full p-2 border rounded-xl text-sm"
          placeholder="Buscar por código, tipo, modelo, serie o pedido..."
        />

        <div className="flex gap-2">
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            className="flex-1 p-2 border rounded-xl text-sm"
          >
            <option value="">Todos los tipos</option>
            {tipos.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="flex-1 p-2 border rounded-xl text-sm"
          >
            {ESTADOS.map((estado) => (
              <option key={estado.value} value={estado.value}>{estado.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {maquinas.map((maquina) => (
          <div key={maquina.id} className="bg-white rounded-xl shadow p-4">
            <div className="flex justify-between gap-3 items-start">
              <div>
                <div className="font-semibold uppercase">{maquina.tipo}</div>
                <div className="text-xs text-gray-500">Código: {maquina.id}</div>
              </div>

              <span className={estadoBadgeClass(maquina.estado)}>{maquina.estado}</span>
            </div>

            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <p>Modelo: <b>{maquina.modelo || "-"}</b></p>
              <p>Serie: <b>{maquina.serie || "-"}</b></p>
              <p>Pedido activo: <b>{maquina.asignacion?.pedidoId || "-"}</b></p>
            </div>
          </div>
        ))}

        {maquinas.length === 0 && (
          <div className="text-sm text-gray-500 text-center mt-6">
            No hay máquinas que coincidan con los filtros actuales.
          </div>
        )}
      </div>
    </div>
  );
}

function estadoBadgeClass(estado) {
  const base = "px-2 py-1 rounded-full text-[10px] font-semibold uppercase h-fit";

  switch (estado) {
    case "disponible":
      return `${base} bg-green-100 text-green-700`;
    case "asignada":
      return `${base} bg-blue-100 text-blue-700`;
    case "no_devuelta":
      return `${base} bg-red-100 text-red-700`;
    case "fuera_servicio":
      return `${base} bg-orange-100 text-orange-700`;
    case "reparacion":
      return `${base} bg-yellow-100 text-yellow-700`;
    case "baja":
      return `${base} bg-gray-200 text-gray-500`;
    default:
      return `${base} bg-gray-100 text-gray-600`;
  }
}