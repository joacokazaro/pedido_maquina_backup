import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BotonVolver from "../components/BotonVolver";
import { API_BASE } from "../services/apiBase";
import { formatDateOnly } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../hooks/usePaginacion";
import SearchableSelect from "../components/SearchableSelect";

export default function AdminEventualesHistorial() {

  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isReadOnly = rolUpper === "COORDINADOR" || rolUpper === "CONSULTOR";
  const [eventuales, setEventuales] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [supervisorFiltro, setSupervisorFiltro] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [eventualesRes, supervisoresRes] = await Promise.all([
          fetch(`${API_BASE}/admin/eventuales`),
          fetch(`${API_BASE}/supervisores/catalogo`),
        ]);

        const [eventualesData, supervisoresData] = await Promise.all([
          eventualesRes.json().catch(() => []),
          supervisoresRes.json().catch(() => []),
        ]);

        setEventuales(Array.isArray(eventualesData) ? eventualesData : []);
        setSupervisores(Array.isArray(supervisoresData) ? supervisoresData : []);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return eventuales.filter((item) => {
      if (estadoFiltro && item.estado !== estadoFiltro) return false;
      if (supervisorFiltro && String(item.supervisor?.id || "") !== supervisorFiltro) return false;
      if (!query) return true;

      return [
        item.nombre,
        item.supervisor?.nombre,
        item.supervisor?.username,
        item.observaciones,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [eventuales, search, estadoFiltro, supervisorFiltro]);

  const paginacion = usePaginacion(filtered, {
    reinicio: [search, estadoFiltro, supervisorFiltro],
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <BotonVolver>Volver al panel de eventuales</BotonVolver>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial de eventuales</h1>
          <p className="text-sm text-gray-600">Listado completo con filtros por estado, supervisor y baja logica.</p>
        </div>
        {!isReadOnly ? (
          <Link to="/admin/eventuales/nuevo" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Nuevo eventual
          </Link>
        ) : null}
      </div>

      <div className="mb-4 rounded-2xl bg-white p-3 shadow space-y-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre, supervisor u observaciones..."
          className="w-full rounded-xl border p-2.5 text-sm"
        />
        <div className="grid gap-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Estado
            </label>
            <SearchableSelect className="w-full rounded-xl border p-2 text-sm" value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="finalizado">Finalizado</option>
              <option value="cancelado">Cancelado</option>
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Supervisor
            </label>
            <SearchableSelect className="w-full rounded-xl border p-2 text-sm" value={supervisorFiltro} onChange={(event) => setSupervisorFiltro(event.target.value)}>
              <option value="">Todos los supervisores</option>
              {supervisores.map((supervisor) => (
                <option key={supervisor.id} value={String(supervisor.id)}>
                  {supervisor.nombre || supervisor.username}
                </option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Resultados
            </label>
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              {filtered.length} eventual{filtered.length === 1 ? "" : "es"}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando eventuales...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow">
          No hay eventuales que coincidan con los filtros.
        </div>
      ) : (
        <div className="space-y-3">
          {paginacion.visibles.map((item) => (
            <Link
              key={item.id}
              to={`/admin/eventuales/${item.id}`}
              className="block rounded-2xl bg-white p-4 shadow transition hover:shadow-lg"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{item.nombre}</h2>
                    {!item.activo ? (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase text-red-700">
                        baja logica
                      </span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700">
                      {item.estado}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Supervisor: {item.supervisor?.nombre || item.supervisor?.username || "Sin asignar"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Componentes: {item.resumenComponentes?.tiposMaquina || 0} tipo(s) de máquina · {item.resumenComponentes?.vehiculos || 0} vehículo(s)
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>Inicio: {formatDateOnly(item.fechaInicio)}</p>
                  <p>Fin: {formatDateOnly(item.fechaFin)}</p>
                  <p>{item.historial?.length || 0} movimientos</p>
                </div>
              </div>
            </Link>
          ))}

          <Paginacion
            pagina={paginacion.pagina}
            totalPaginas={paginacion.totalPaginas}
            total={paginacion.total}
            tamano={paginacion.tamano}
            onPagina={paginacion.irAPagina}
            onTamano={paginacion.cambiarTamano}
            etiqueta="eventuales"
          />
        </div>
      )}
    </div>
  );
}
