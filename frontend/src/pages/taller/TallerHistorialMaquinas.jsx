import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../services/apiBase";
import { useAuth } from "../../context/AuthContext";
import { buildActorHeaders } from "../../utils/authHeaders";
import { formatDateTime } from "../../utils/date";
import SearchableSelect from "../../components/SearchableSelect";
import Paginacion from "../../components/Paginacion";
import { usePaginacion } from "../../hooks/usePaginacion";

const ACCION_LABEL = { ingreso: "Ingreso", egreso: "Egreso" };
const ACCION_BADGE = {
  ingreso: "bg-amber-100 text-amber-700",
  egreso: "bg-green-100 text-green-700",
};

export default function TallerHistorialMaquinas() {
  const { user } = useAuth();
  const actorHeaders = useMemo(() => buildActorHeaders(user), [user]);

  const [historial, setHistorial] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [accion, setAccion] = useState("");
  const [tipoMaquina, setTipoMaquina] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  useEffect(() => {
    async function loadCatalogos() {
      try {
        const [maquinasRes, serviciosRes, usuariosRes] = await Promise.all([
          fetch(`${API_BASE}/admin/maquinas`, { headers: actorHeaders }),
          fetch(`${API_BASE}/servicios`),
          fetch(`${API_BASE}/admin-users?activo=true`, { headers: actorHeaders }),
        ]);
        const [maquinasData, serviciosData, usuariosData] = await Promise.all([
          maquinasRes.json().catch(() => []),
          serviciosRes.json().catch(() => []),
          usuariosRes.json().catch(() => []),
        ]);
        setMaquinas(Array.isArray(maquinasData) ? maquinasData : []);
        setServicios(Array.isArray(serviciosData) ? serviciosData : []);
        setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      } catch (e) {
        console.error(e);
      }
    }
    loadCatalogos();
  }, [user?.username]);

  const tiposDisponibles = useMemo(
    () => Array.from(new Set(maquinas.map((item) => item.tipo).filter(Boolean))).sort(),
    [maquinas]
  );

  const maquinasDelTipo = useMemo(
    () => (tipoMaquina ? maquinas.filter((item) => item.tipo === tipoMaquina) : maquinas),
    [maquinas, tipoMaquina]
  );

  function handleTipoChange(event) {
    setTipoMaquina(event.target.value);
    setMaquinaId("");
  }

  useEffect(() => {
    async function loadHistorial() {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ limit: "1000" });
        if (accion) params.set("accion", accion);
        if (tipoMaquina) params.set("tipo", tipoMaquina);
        if (maquinaId) params.set("maquinaId", maquinaId);
        if (servicioId) params.set("servicioId", servicioId);
        if (usuarioId) params.set("usuarioId", usuarioId);
        if (desde) params.set("desde", desde);
        if (hasta) params.set("hasta", hasta);

        const res = await fetch(`${API_BASE}/admin/taller/maquinas/historial?${params.toString()}`, { headers: actorHeaders });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || "No se pudo cargar el historial");
        setHistorial(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando historial");
      } finally {
        setLoading(false);
      }
    }
    loadHistorial();
  }, [user?.username, accion, tipoMaquina, maquinaId, servicioId, usuarioId, desde, hasta]);

  const filtrado = useMemo(() => {
    if (!search.trim()) return historial;
    const q = search.trim().toLowerCase();
    return historial.filter((item) =>
      [item.maquina?.id, item.maquina?.tipo, item.maquina?.modelo, item.maquina?.servicio?.nombre, item.usuario?.username, item.usuario?.nombre, item.observacion]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [historial, search]);

  const paginacion = usePaginacion(filtrado, {
    reinicio: [search, accion, tipoMaquina, maquinaId, servicioId, usuarioId, desde, hasta],
  });

  const hayFiltrosActivos = Boolean(search || accion || tipoMaquina || maquinaId || servicioId || usuarioId || desde || hasta);

  function limpiarFiltros() {
    setSearch("");
    setAccion("");
    setTipoMaquina("");
    setMaquinaId("");
    setServicioId("");
    setUsuarioId("");
    setDesde("");
    setHasta("");
  }

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/admin/taller/ver" className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow">
            ← Ver Taller
          </Link>
          <Link to="/admin/taller/ver/maquinas" className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow">
            Ver actuales en taller
          </Link>
          <Link to="/admin/taller/registrar/maquinas" className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            Registrar ingreso/egreso
          </Link>
        </div>

        <header className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">Historial de Taller - Maquinas</h1>
          <p className="mt-1 text-sm text-gray-600">Todos los ingresos y egresos registrados, con usuario, fecha y hora.</p>
        </header>

        {error ? <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="mb-4 space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <input
            className="w-full rounded-xl border border-gray-200 p-2 text-sm"
            placeholder="Buscar por maquina, usuario u observacion..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Accion</label>
              <SearchableSelect className="w-full rounded-xl border p-2 text-sm" value={accion} onChange={(event) => setAccion(event.target.value)}>
                <option value="">Todas</option>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </SearchableSelect>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tipo</label>
              <SearchableSelect className="w-full rounded-xl border p-2 text-sm" value={tipoMaquina} onChange={handleTipoChange}>
                <option value="">Todos los tipos</option>
                {tiposDisponibles.map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Maquina</label>
              <SearchableSelect className="w-full rounded-xl border p-2 text-sm" value={maquinaId} onChange={(event) => setMaquinaId(event.target.value)}>
                <option value="">{tipoMaquina ? `Todas (${tipoMaquina})` : "Todas las maquinas"}</option>
                {maquinasDelTipo.map((maquina) => (
                  <option key={maquina.id} value={maquina.id}>
                    {maquina.id} · {maquina.modelo || "-"}
                  </option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Servicio</label>
              <SearchableSelect className="w-full rounded-xl border p-2 text-sm" value={servicioId} onChange={(event) => setServicioId(event.target.value)}>
                <option value="">Todos los servicios</option>
                {servicios.map((servicio) => (
                  <option key={servicio.id} value={servicio.id}>{servicio.nombre}</option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Usuario</label>
              <SearchableSelect className="w-full rounded-xl border p-2 text-sm" value={usuarioId} onChange={(event) => setUsuarioId(event.target.value)}>
                <option value="">Todos los usuarios</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>{usuario.nombre || usuario.username}</option>
                ))}
              </SearchableSelect>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Desde</label>
              <input type="date" className="w-full rounded-xl border p-2 text-sm" value={desde} onChange={(event) => setDesde(event.target.value)} />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hasta</label>
              <input type="date" className="w-full rounded-xl border p-2 text-sm" value={hasta} onChange={(event) => setHasta(event.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">{filtrado.length} movimiento{filtrado.length === 1 ? "" : "s"}</p>
            {hayFiltrosActivos ? (
              <button type="button" onClick={limpiarFiltros} className="text-xs font-semibold text-blue-600 hover:underline">
                Limpiar filtros
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-gray-500">Cargando historial...</div>
        ) : (
          <div className="space-y-2">
            {paginacion.visibles.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <b>{entry.maquina?.id || "-"}</b> · {entry.maquina?.tipo || "-"} · {entry.maquina?.modelo || "-"}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ACCION_BADGE[entry.accion] || "bg-slate-100 text-slate-700"}`}>
                    {ACCION_LABEL[entry.accion] || entry.accion}
                  </span>
                </div>
                <p className="text-gray-600">Servicio: {entry.maquina?.servicio?.nombre || "-"}</p>
                <p className="text-gray-600">Fecha: {formatDateTime(entry.createdAt)}</p>
                <p className="text-gray-600">Usuario: {entry.usuario?.nombre || entry.usuario?.username || "-"}</p>
                {entry.observacion ? <p className="text-gray-600">Observacion: {entry.observacion}</p> : null}
              </div>
            ))}
            {!paginacion.visibles.length ? (
              <div className="rounded-xl border bg-white p-3 text-sm text-gray-500">No hay movimientos que coincidan con los filtros.</div>
            ) : null}

            <Paginacion
              pagina={paginacion.pagina}
              totalPaginas={paginacion.totalPaginas}
              total={paginacion.total}
              tamano={paginacion.tamano}
              onPagina={paginacion.irAPagina}
              onTamano={paginacion.cambiarTamano}
              etiqueta="movimientos"
            />
          </div>
        )}
      </div>
    </div>
  );
}
