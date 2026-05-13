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

export default function DepositoMaquinas() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allMaquinas, setAllMaquinas] = useState([]);
  const [serviciosUsuario, setServiciosUsuario] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  useEffect(() => {
    if (!user?.username) return;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [maquinasRes, serviciosRes] = await Promise.all([
          fetch(`${API_BASE}/admin/maquinas`),
          fetch(`${API_BASE}/servicios/usuario/${encodeURIComponent(user.username)}`),
        ]);

        if (!maquinasRes.ok || !serviciosRes.ok) {
          throw new Error("No se pudieron cargar las máquinas");
        }

        const maquinasData = await maquinasRes.json();
        const serviciosData = await serviciosRes.json();

        setAllMaquinas(Array.isArray(maquinasData) ? maquinasData : []);
        setServiciosUsuario(Array.isArray(serviciosData) ? serviciosData.map((s) => s.id) : []);
      } catch (e) {
        console.error(e);
        setError("Error cargando máquinas");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.username]);

  const maquinas = useMemo(() => {
    let data = allMaquinas.filter((m) => serviciosUsuario.includes(m.servicio?.id));

    if (tipoFiltro) data = data.filter((m) => m.tipo === tipoFiltro);
    if (estadoFiltro) data = data.filter((m) => m.estado === estadoFiltro);

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((m) =>
        m.id?.toLowerCase().includes(q) ||
        m.tipo?.toLowerCase().includes(q) ||
        m.modelo?.toLowerCase().includes(q) ||
        m.serie?.toLowerCase().includes(q) ||
        m.servicio?.nombre?.toLowerCase().includes(q) ||
        m.asignacion?.servicio?.nombre?.toLowerCase().includes(q) ||
        m.asignacion?.pedidoId?.toLowerCase().includes(q)
      );
    }

    return data.sort((a, b) => {
      const tipoComp = (a.tipo || "").localeCompare(b.tipo || "");
      return tipoComp !== 0 ? tipoComp : (a.id || "").localeCompare(b.id || "", undefined, { numeric: true });
    });
  }, [allMaquinas, serviciosUsuario, tipoFiltro, estadoFiltro, search]);

  const tiposUnicos = useMemo(
    () => Array.from(new Set(maquinas.map((m) => m.tipo).filter(Boolean))).sort(),
    [maquinas]
  );

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
            Máquinas de los servicios asignados a tu usuario.
          </p>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow p-3 mb-4 space-y-3">
        <input
          className="w-full p-2.5 rounded-xl border text-sm"
          placeholder="Buscar por código, tipo, modelo, serie, servicio o pedido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex gap-2">
          <select
            className="flex-1 p-2 rounded-xl border text-xs"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {tiposUnicos.map((tipo) => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>

          <select
            className="flex-1 p-2 rounded-xl border text-xs"
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
          >
            {ESTADOS.map((estado) => (
              <option key={estado.value} value={estado.value}>{estado.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {maquinas.map((m) => (
          <div
            key={m.id}
            className="bg-white rounded-2xl shadow px-4 py-3"
          >
            <div className="flex justify-between gap-3">
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

            <div className="mt-2 text-xs text-gray-600 space-y-0.5">
              <p>
                Servicio original: <b>{m.servicio?.nombre || "-"}</b>
              </p>

              {m.asignacion ? (
                <>
                  <p>
                    Servicio de préstamo: <b>{m.asignacion.servicio?.nombre || "-"}</b>
                  </p>
                  <p>
                    Pedido activo:{" "}
                    {m.asignacion.pedidoId ? (
                      <Link
                        to={`/deposito/pedido/${encodeURIComponent(m.asignacion.pedidoId)}`}
                        className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-800"
                      >
                        {m.asignacion.pedidoId}
                      </Link>
                    ) : (
                      <b>-</b>
                    )}
                  </p>
                </>
              ) : (
                <p>
                  Pedido activo: <b>-</b>
                </p>
              )}
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
    case "disponible": return `${base} bg-green-100 text-green-700`;
    case "asignada": return `${base} bg-blue-100 text-blue-700`;
    case "no_devuelta": return `${base} bg-red-100 text-red-700`;
    case "fuera_servicio": return `${base} bg-orange-100 text-orange-700`;
    case "reparacion": return `${base} bg-yellow-100 text-yellow-700`;
    case "baja": return `${base} bg-gray-200 text-gray-500`;
    default: return `${base} bg-gray-100 text-gray-600`;
  }
}