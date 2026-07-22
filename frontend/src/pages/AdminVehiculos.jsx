import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import { buildActorHeaders } from "../utils/authHeaders";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../hooks/usePaginacion";
import SearchableSelect from "../components/SearchableSelect";

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "activo", label: "Activo" },
  { value: "asignada", label: "Prestado (Asignado a pedido)" },
  { value: "taller", label: "En taller" },
  { value: "conFaltantes", label: "Con faltantes" },
  { value: "baja", label: "Baja" },
];

export default function AdminVehiculos() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const canOperateTaller = hasRole("ADMIN") || hasRole("TALLER");
  const isReadOnly = hasRole("COORDINADOR") || hasRole("CONSULTOR") || hasRole("TALLER") || hasRole("DEPOSITO");
  const [vehiculos, setVehiculos] = useState([]);
  const [seguros, setSeguros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [faltanteFiltro, setFaltanteFiltro] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [seguroFiltro, setSeguroFiltro] = useState("");
  const [conductorFiltro, setConductorFiltro] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [vehiculosRes, segurosRes, usuariosRes] = await Promise.all([
          fetch(`${API_BASE}/admin/vehiculos`, { headers: buildActorHeaders(user) }),
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
  }, [user?.username]);

  async function moverTallerIndividual(id, accion) {
    if (!canOperateTaller) return;
    try {
      setError("");
      const res = await fetch(`${API_BASE}/vehiculos/${encodeURIComponent(id)}/taller`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...buildActorHeaders(user),
        },
        body: JSON.stringify({ accion }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar taller");

      navigate(0);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error actualizando taller");
    }
  }

  const empresas = useMemo(
    () => Array.from(new Set(vehiculos.map((item) => item.empresa).filter(Boolean))).sort(),
    [vehiculos]
  );

  const filtered = useMemo(() => {
    let data = [...vehiculos];

    if (estadoFiltro) {
      if (estadoFiltro === "conFaltantes") {
        data = data.filter((item) => item.pedidoActivo?.conFaltantes || item.esFaltante);
      } else {
        data = data.filter((item) => item.estado === estadoFiltro);
      }
    }

    if (faltanteFiltro) {
      if (faltanteFiltro === "si") data = data.filter((item) => item.esFaltante);
      if (faltanteFiltro === "no") data = data.filter((item) => !item.esFaltante);
    }
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

  const paginacion = usePaginacion(filtered, {
    reinicio: [search, estadoFiltro, faltanteFiltro, empresaFiltro, seguroFiltro, conductorFiltro],
  });

  if (loading) return <div className="p-4">Cargando vehículos...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  const actionBtnBase =
    "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition";
  const actionBtnMuted =
    `${actionBtnBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`;
  const actionBtnSoft =
    `${actionBtnBase} border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200`;
  const actionBtnExcel =
    `${actionBtnBase} border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200`;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <header className="mb-3">
        <h1 className="text-2xl font-bold">Vehículos</h1>
        <p className="text-xs text-gray-600">ABM, asignación de conductores y catálogo vehicular.</p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          {isAdmin ? (
            <button
              onClick={() => navigate("/admin/plazos-amortizacion")}
              className={actionBtnMuted}
            >
              Plazos de amortizacion
            </button>
          ) : null}
          {isAdmin && !isReadOnly ? (
            <>
            <button
              onClick={() => navigate("/admin/seguros")}
              className={actionBtnMuted}
            >
              Seguros
            </button>
              <button
                onClick={() => navigate("/admin/vehiculos/asignaciones")}
                className={actionBtnSoft}
              >
                Asignaciones
              </button>
              <button
                onClick={() => navigate("/admin/vehiculos/importar")}
                className={actionBtnExcel}
              >
                Importar Excel
              </button>
            </>
          ) : null}
          <a
            href={`${API_BASE}/admin/vehiculos/export`}
            className={actionBtnExcel}
          >
            Exportar Excel
          </a>
      </div>

      <div className="mb-4 rounded-2xl bg-white p-3 shadow space-y-3">
        <input
          className="w-full rounded-xl border p-2.5 text-sm"
          placeholder="Buscar por ID, empresa, patente, modelo, seguro o conductor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid gap-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Estado
            </label>
            <SearchableSelect className="w-full rounded-xl border p-2 text-xs" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)}>
              {ESTADOS.map((estado) => (
                <option key={estado.value} value={estado.value}>{estado.label}</option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Empresa
            </label>
            <SearchableSelect className="w-full rounded-xl border p-2 text-xs" value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)}>
              <option value="">Todas las empresas</option>
              {empresas.map((empresa) => (
                <option key={empresa} value={empresa}>{empresa}</option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Faltantes
            </label>
            <SearchableSelect className="w-full rounded-xl border p-2 text-xs" value={faltanteFiltro} onChange={(e) => setFaltanteFiltro(e.target.value)}>
              <option value="">Todos</option>
              <option value="si">Faltantes</option>
              <option value="no">No faltantes</option>
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Seguro
            </label>
            <SearchableSelect className="w-full rounded-xl border p-2 text-xs" value={seguroFiltro} onChange={(e) => setSeguroFiltro(e.target.value)}>
              <option value="">Todos los seguros</option>
              {seguros.map((seguro) => (
                <option key={seguro.id} value={String(seguro.id)}>{seguro.nombre}</option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Conductor
            </label>
            <SearchableSelect className="w-full rounded-xl border p-2 text-xs" value={conductorFiltro} onChange={(e) => setConductorFiltro(e.target.value)}>
              <option value="">Todos los conductores</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={String(usuario.id)}>
                  {usuario.nombre || usuario.username}
                </option>
              ))}
            </SearchableSelect>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {paginacion.visibles.map((vehiculo) => (
          <div
            role="button"
            tabIndex={0}
            key={vehiculo.id}
            onClick={() => navigate(`/admin/vehiculos/${encodeURIComponent(vehiculo.id)}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/admin/vehiculos/${encodeURIComponent(vehiculo.id)}`);
              }
            }}
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
                {vehiculo.esFaltante && (
                  <p className="mt-2 text-xs font-semibold text-red-600">Faltante en pedido(s): {vehiculo.faltantePedidos?.join(", ")}</p>
                )}
                {vehiculo.pedidoActivo && (
                  <p className="mt-2 text-xs text-amber-700">Prestado en pedido <b>{vehiculo.pedidoActivo.id}</b> {vehiculo.pedidoActivo.titular ? `para ${vehiculo.pedidoActivo.titular}` : ''}</p>
                )}
                {canOperateTaller ? (
                  <div className="mt-2 flex gap-2">
                    {vehiculo.estado !== "taller" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          moverTallerIndividual(vehiculo.id, "ingreso");
                        }}
                        className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                      >
                        Ingreso taller
                      </button>
                    ) : null}
                    {vehiculo.estado === "taller" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          moverTallerIndividual(vehiculo.id, "egreso");
                        }}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                      >
                        Egreso taller
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <span className={vehiculo.estado === "activo" ? "rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold uppercase text-green-700" : vehiculo.estado === "taller" ? "rounded-full bg-yellow-100 px-2 py-1 text-[10px] font-semibold uppercase text-yellow-700" : "rounded-full bg-gray-200 px-2 py-1 text-[10px] font-semibold uppercase text-gray-600"}>
                {vehiculo.estado}
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">No hay vehículos que coincidan con los filtros.</div>
        )}
      </div>

      <Paginacion
        pagina={paginacion.pagina}
        totalPaginas={paginacion.totalPaginas}
        total={paginacion.total}
        tamano={paginacion.tamano}
        onPagina={paginacion.irAPagina}
        onTamano={paginacion.cambiarTamano}
        etiqueta="vehículos"
      />

      {!isReadOnly && isAdmin ? (
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
