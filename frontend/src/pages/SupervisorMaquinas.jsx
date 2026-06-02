import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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

export default function SupervisorMaquinas() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [servicioFiltro, setServicioFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/supervisores/${user.id}/maquinas`);
        if (!res.ok) {
          throw new Error("No se pudieron cargar las máquinas del supervisor");
        }

        const data = await res.json();
        setPayload(data);
      } catch (e) {
        console.error(e);
        setError("Error cargando las máquinas");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.id]);

  const servicios = useMemo(() => {
    const base = Array.isArray(payload?.supervisor?.servicios)
      ? payload.supervisor.servicios
      : [];

    return [...base].sort((a, b) =>
      (a.nombre || "").localeCompare(b.nombre || "", undefined, { sensitivity: "base" })
    );
  }, [payload]);

  const maquinas = useMemo(() => {
    const maquinasFijas = Array.isArray(payload?.maquinasFijas) ? payload.maquinasFijas : [];
    const maquinasTemporales = Array.isArray(payload?.maquinasTemporales)
      ? payload.maquinasTemporales
      : [];

    const merged = new Map();

    for (const maquina of maquinasFijas) {
      merged.set(maquina.id, {
        ...maquina,
        origen: "FIJA",
        servicioActual: maquina.servicio || null,
        pedido: null,
      });
    }

    for (const maquina of maquinasTemporales) {
      const prev = merged.get(maquina.id);
      merged.set(maquina.id, {
        ...(prev || {}),
        ...maquina,
        origen: prev ? "FIJA_CON_MOVIMIENTO" : "TEMPORAL",
        servicio: prev?.servicio || maquina.servicio || null,
        servicioActual: maquina.servicioActual || prev?.servicioActual || maquina.servicio || null,
      });
    }

    let data = Array.from(merged.values());

    if (servicioFiltro) {
      data = data.filter((maquina) => String(maquina.servicio?.id || "") === servicioFiltro);
    }

    if (estadoFiltro) {
      data = data.filter((maquina) => maquina.estado === estadoFiltro);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((maquina) => {
        const campos = [
          maquina.id,
          maquina.tipo,
          maquina.modelo,
          maquina.serie,
          maquina.servicio?.nombre,
          maquina.servicioActual?.nombre,
        ];

        return campos.some((valor) => valor?.toLowerCase().includes(q));
      });
    }

    return data.sort((a, b) => {
      const servicioComp = (a.servicioActual?.nombre || "").localeCompare(
        b.servicioActual?.nombre || "",
        undefined,
        { sensitivity: "base" }
      );

      if (servicioComp !== 0) return servicioComp;

      const tipoComp = (a.tipo || "").localeCompare(b.tipo || "", undefined, {
        sensitivity: "base",
      });

      if (tipoComp !== 0) return tipoComp;

      return (a.id || "").localeCompare(b.id || "", undefined, { numeric: true });
    });
  }, [payload, servicioFiltro, estadoFiltro, search]);

  if (loading) return <div className="p-4">Cargando máquinas...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow transition text-gray-700 text-sm font-medium"
      >
        ← Volver
      </button>

      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mis máquinas</h1>
          <p className="text-xs text-gray-600">
            Máquinas de tus servicios asignados y préstamos activos asociados a tu usuario.
          </p>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow p-3 mb-4 space-y-3">
        <input
          className="w-full p-2.5 rounded-xl border text-sm"
          placeholder="Buscar por servicio, máquina, modelo o n° de serie..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="flex-1 p-2 rounded-xl border text-xs"
            value={servicioFiltro}
            onChange={(e) => setServicioFiltro(e.target.value)}
          >
            <option value="">Todos mis servicios</option>
            {servicios.map((servicio) => (
              <option key={servicio.id} value={String(servicio.id)}>
                {servicio.nombre}
              </option>
            ))}
          </select>

          <select
            className="flex-1 p-2 rounded-xl border text-xs"
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
          >
            {ESTADOS.map((estado) => (
              <option key={estado.value} value={estado.value}>
                {estado.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {maquinas.map((maquina) => {
          return (
            <Link
              key={maquina.id}
              to={`/supervisor/maquinas/${encodeURIComponent(maquina.id)}`}
              className="block bg-white rounded-2xl shadow px-4 py-3 transition hover:shadow-md hover:ring-1 hover:ring-blue-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase">{maquina.tipo}</p>
                  <p className="text-xs text-gray-500">
                    Código: <b>{maquina.id}</b>
                  </p>
                  {maquina.modelo && <p className="text-xs text-gray-600 mt-1">{maquina.modelo}</p>}
                  <p className="text-xs text-gray-600 mt-2">
                    Servicio original: <b>{maquina.servicio?.nombre || "-"}</b>
                  </p>
                  {maquina.pedido && maquina.servicioActual?.id !== maquina.servicio?.id && (
                    <p className="text-xs text-gray-600">
                      Servicio actual: <b>{maquina.servicioActual?.nombre || "-"}</b>
                    </p>
                  )}
                </div>

                <span className={estadoBadgeClass(maquina.estado)}>{maquina.estado}</span>
              </div>
            </Link>
          );
        })}

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