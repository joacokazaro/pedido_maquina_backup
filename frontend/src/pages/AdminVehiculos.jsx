import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "baja", label: "Baja" },
];

export default function AdminVehiculos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isReadOnly = rolUpper === "COORDINADOR" || rolUpper === "CONSULTOR";
  const [vehiculos, setVehiculos] = useState([]);
  const [seguros, setSeguros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [seguroFiltro, setSeguroFiltro] = useState("");
  const [conductorFiltro, setConductorFiltro] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [vehiculosRes, segurosRes, usuariosRes] = await Promise.all([
          fetch(`${API_BASE}/admin/vehiculos`),
          fetch(`${API_BASE}/admin/seguros`),
          fetch(`${API_BASE}/admin-users?activo=true`),
        ]);

        if (!vehiculosRes.ok || !segurosRes.ok || !usuariosRes.ok) {
          throw new Error("No se pudieron cargar los datos de vehículos");
        }

        const [vehiculosData, segurosData, usuariosData] = await Promise.all([
          vehiculosRes.json(),
          segurosRes.json(),
          usuariosRes.json(),
        ]);

        setVehiculos(Array.isArray(vehiculosData) ? vehiculosData : []);
        setSeguros(Array.isArray(segurosData) ? segurosData : []);
        setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando vehículos");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const empresas = useMemo(
    () => Array.from(new Set(vehiculos.map((item) => item.empresa).filter(Boolean))).sort(),
    [vehiculos]
  );

  const filtered = useMemo(() => {
    let data = [...vehiculos];

    if (estadoFiltro) data = data.filter((item) => item.estado === estadoFiltro);
    if (empresaFiltro) data = data.filter((item) => item.empresa === empresaFiltro);
    if (seguroFiltro) data = data.filter((item) => String(item.seguro?.id || "") === seguroFiltro);
    if (conductorFiltro) data = data.filter((item) => String(item.conductorActual?.id || "") === conductorFiltro);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((item) =>
        [
          item.id,
          item.empresa,
          item.vehiculo,
          item.patente,
          item.modelo,
          item.numeroPoliza,
          item.seguro?.nombre,
          item.conductorActual?.nombre,
          item.conductorActual?.username,
        ].some((value) => value?.toLowerCase().includes(q))
      );
    }

    return data.sort((a, b) => {
      return String(a.id || "").localeCompare(String(b.id || ""), undefined, { numeric: true, sensitivity: "base" });
    });
  }, [vehiculos, estadoFiltro, empresaFiltro, seguroFiltro, conductorFiltro, search]);

  if (loading) return <div className="p-4">Cargando vehículos...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vehículos</h1>
          <p className="text-xs text-gray-600">ABM, asignación de conductores y catálogo vehicular.</p>
        </div>

        <div className="flex gap-2">
          {!isReadOnly ? (
            <>
              <button
                onClick={() => navigate("/admin/vehiculos/importar")}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-amber-300"
              >
                Importar Excel
              </button>
              <button
                onClick={() => navigate("/admin/seguros")}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm"
              >
                Seguros
              </button>
            </>
          ) : null}
          <a
            href={`${API_BASE}/admin/vehiculos/export`}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Exportar Excel
          </a>
        </div>
      </header>

      <div className="mb-4 rounded-2xl bg-white p-3 shadow space-y-3">
        <input
          className="w-full rounded-xl border p-2.5 text-sm"
          placeholder="Buscar por ID, empresa, patente, modelo, seguro o conductor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid gap-2 md:grid-cols-4">
          <select className="rounded-xl border p-2 text-xs" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            {ESTADOS.map((estado) => (
              <option key={estado.value} value={estado.value}>{estado.label}</option>
            ))}
          </select>

          <select className="rounded-xl border p-2 text-xs" value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}>
            <option value="">Todas las empresas</option>
            {empresas.map((empresa) => (
              <option key={empresa} value={empresa}>{empresa}</option>
            ))}
          </select>

          <select className="rounded-xl border p-2 text-xs" value={seguroFiltro} onChange={(e) => setSeguroFiltro(e.target.value)}>
            <option value="">Todos los seguros</option>
            {seguros.map((seguro) => (
              <option key={seguro.id} value={String(seguro.id)}>{seguro.nombre}</option>
            ))}
          </select>

          <select className="rounded-xl border p-2 text-xs" value={conductorFiltro} onChange={(e) => setConductorFiltro(e.target.value)}>
            <option value="">Todos los conductores</option>
            {usuarios.map((usuario) => (
              <option key={usuario.id} value={String(usuario.id)}>
                {usuario.nombre || usuario.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((vehiculo) => (
          <button
            key={vehiculo.id}
            onClick={() => navigate(`/admin/vehiculos/${encodeURIComponent(vehiculo.id)}`)}
            className="w-full rounded-2xl bg-white px-4 py-3 text-left shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase">{vehiculo.vehiculo}</p>
                <p className="text-xs text-gray-500">ID: <b>{vehiculo.id}</b> · Patente: <b>{vehiculo.patente}</b></p>
                <p className="mt-1 text-xs text-gray-600">{vehiculo.empresa} · {vehiculo.modelo}</p>
                <p className="text-xs text-gray-500">Póliza: <b>{vehiculo.numeroPoliza || "-"}</b></p>
                <p className="mt-1 text-xs text-gray-500">Seguro: <b>{vehiculo.seguro?.nombre || "-"}</b></p>
                <p className="text-xs text-gray-500">Conductor: <b>{vehiculo.conductorActual?.nombre || vehiculo.conductorActual?.username || "Sin asignar"}</b></p>
              </div>

              <span className={vehiculo.estado === "activo" ? "rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold uppercase text-green-700" : "rounded-full bg-gray-200 px-2 py-1 text-[10px] font-semibold uppercase text-gray-600"}>
                {vehiculo.estado}
              </span>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">No hay vehículos que coincidan con los filtros.</div>
        )}
      </div>

      {!isReadOnly ? (
        <button
          onClick={() => navigate("/admin/vehiculos/nuevo")}
          className="fixed bottom-4 right-4 h-14 w-14 rounded-full bg-blue-600 text-2xl text-white shadow-lg"
        >
          +
        </button>
      ) : null}
    </div>
  );
}
