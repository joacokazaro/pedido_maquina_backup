import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "activo", label: "Activo" },
  { value: "baja", label: "Baja" },
];

export default function SupervisorVehiculos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/supervisores/${user.id}/vehiculos`);
        if (!res.ok) {
          throw new Error("No se pudieron cargar tus vehículos");
        }

        const data = await res.json();
        setPayload(data);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando vehículos");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.id]);

  const empresas = useMemo(
    () => Array.from(new Set((payload?.vehiculos || []).map((item) => item.empresa).filter(Boolean))).sort(),
    [payload]
  );

  const vehiculos = useMemo(() => {
    let data = Array.isArray(payload?.vehiculos) ? [...payload.vehiculos] : [];

    if (estadoFiltro) data = data.filter((item) => item.estado === estadoFiltro);
    if (empresaFiltro) data = data.filter((item) => item.empresa === empresaFiltro);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((item) =>
        [item.id, item.empresa, item.vehiculo, item.patente, item.modelo, item.numeroPoliza, item.seguro?.nombre].some((value) => value?.toLowerCase().includes(q))
      );
    }

    return data.sort((a, b) => {
      const empresaComp = (a.empresa || "").localeCompare(b.empresa || "");
      if (empresaComp !== 0) return empresaComp;
      return (a.vehiculo || "").localeCompare(b.vehiculo || "");
    });
  }, [payload, estadoFiltro, empresaFiltro, search]);

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

      <header className="mb-4">
        <h1 className="text-2xl font-bold">Mis vehículos</h1>
        <p className="text-xs text-gray-600">Vehículos actualmente asignados a tu usuario.</p>
      </header>

      <div className="mb-4 rounded-2xl bg-white p-3 shadow space-y-3">
        <input className="w-full rounded-xl border p-2.5 text-sm" placeholder="Buscar por patente, modelo, empresa o seguro..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <select className="flex-1 rounded-xl border p-2 text-xs" value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}>
            <option value="">Todas las empresas</option>
            {empresas.map((empresa) => <option key={empresa} value={empresa}>{empresa}</option>)}
          </select>
          <select className="flex-1 rounded-xl border p-2 text-xs" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
            {ESTADOS.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {vehiculos.map((vehiculo) => (
          <div key={vehiculo.id} className="rounded-2xl bg-white px-4 py-3 shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase">{vehiculo.vehiculo}</p>
                <p className="text-xs text-gray-500">ID: <b>{vehiculo.id}</b> · Patente: <b>{vehiculo.patente}</b></p>
                <p className="mt-1 text-xs text-gray-600">{vehiculo.empresa} · {vehiculo.modelo}</p>
                <p className="text-xs text-gray-500">Póliza: <b>{vehiculo.numeroPoliza || "-"}</b></p>
                <p className="text-xs text-gray-500">Seguro: <b>{vehiculo.seguro?.nombre || "-"}</b></p>
                <p className="text-xs text-gray-500">Tarjeta verde: <b>{vehiculo.tarjetaVerde ? "Tiene" : "No tiene"}</b></p>
              </div>

              <span className={vehiculo.estado === "activo" ? "rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold uppercase text-green-700" : "rounded-full bg-gray-200 px-2 py-1 text-[10px] font-semibold uppercase text-gray-600"}>
                {vehiculo.estado}
              </span>
            </div>
          </div>
        ))}

        {vehiculos.length === 0 && (
          <div className="mt-6 text-center text-sm text-gray-500">No tenés vehículos asignados actualmente.</div>
        )}
      </div>
    </div>
  );
}