import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BotonVolver from "../components/BotonVolver";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import { buildActorHeaders } from "../utils/authHeaders";
import SearchableSelect from "../components/SearchableSelect";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../hooks/usePaginacion";

function formatMoneda(valor) {
  if (valor === null || valor === undefined) return "-";
  const num = Number(valor);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(num);
}

const MOTIVO_LABEL = {
  SIN_VALOR_COMPRA: "Sin valor de compra cargado",
  SIN_DATOS: "Datos incompletos (falta fecha de compra o plazo del tipo)",
};

const FILTROS_COSTO = [
  { value: "", label: "Costo: todos" },
  { value: "CON_COSTO", label: "Con costo (> $0)" },
  { value: "SIN_COSTO", label: "Sin costo ($0)" },
];

const FILTROS_DATOS = [
  { value: "", label: "Datos: todos" },
  { value: "INCOMPLETOS", label: "Con datos incompletos" },
  { value: "COMPLETOS", label: "Sin datos incompletos" },
];

const OPCIONES_ORDEN = [
  { value: "COSTO_DESC", label: "Mayor costo primero" },
  { value: "COSTO_ASC", label: "Menor costo primero" },
  { value: "NOMBRE_ASC", label: "Nombre (A-Z)" },
  { value: "MAQUINAS_DESC", label: "Mas maquinas incluidas" },
  { value: "SIN_DATOS_DESC", label: "Mas datos incompletos" },
];

export default function AdminCostosPorServicio() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [servicios, setServicios] = useState([]);
  const [search, setSearch] = useState("");
  const [filtroCosto, setFiltroCosto] = useState("");
  const [filtroDatos, setFiltroDatos] = useState("");
  const [orden, setOrden] = useState("COSTO_DESC");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/admin/maquinas/costos-por-servicio`, {
        headers: buildActorHeaders(user),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error cargando costos por servicio");
      }

      setServicios(Array.isArray(data?.servicios) ? data.servicios : []);
    } catch (e) {
      setError(e.message || "Error cargando costos por servicio");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user?.username]);

  const serviciosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = servicios;

    if (q) {
      base = base.filter((s) => String(s.nombre || "").toLowerCase().includes(q));
    }

    if (filtroCosto === "CON_COSTO") {
      base = base.filter((s) => (s.costoTotalMensual || 0) > 0);
    } else if (filtroCosto === "SIN_COSTO") {
      base = base.filter((s) => !((s.costoTotalMensual || 0) > 0));
    }

    if (filtroDatos === "INCOMPLETOS") {
      base = base.filter((s) => (s.cantidadNoCalculable || 0) > 0);
    } else if (filtroDatos === "COMPLETOS") {
      base = base.filter((s) => (s.cantidadNoCalculable || 0) === 0);
    }

    return [...base].sort((a, b) => {
      switch (orden) {
        case "COSTO_ASC":
          return (a.costoTotalMensual || 0) - (b.costoTotalMensual || 0);
        case "NOMBRE_ASC":
          return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
        case "MAQUINAS_DESC":
          return (b.cantidadMaquinas || 0) - (a.cantidadMaquinas || 0);
        case "SIN_DATOS_DESC":
          return (b.cantidadNoCalculable || 0) - (a.cantidadNoCalculable || 0);
        case "COSTO_DESC":
        default:
          return (b.costoTotalMensual || 0) - (a.costoTotalMensual || 0);
      }
    });
  }, [servicios, search, filtroCosto, filtroDatos, orden]);

  const paginacion = usePaginacion(serviciosFiltrados, {
    tamanoInicial: 10,
    reinicio: [search, filtroCosto, filtroDatos, orden],
  });

  const totales = useMemo(() => {
    return servicios.reduce(
      (acc, s) => {
        acc.costoTotal += s.costoTotalMensual || 0;
        acc.maquinas += s.cantidadMaquinas || 0;
        acc.noCalculables += s.cantidadNoCalculable || 0;
        return acc;
      },
      { costoTotal: 0, maquinas: 0, noCalculables: 0 }
    );
  }, [servicios]);

  if (loading) return <div className="p-4">Cargando costos por servicio...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <BotonVolver>Volver a amortizaciones</BotonVolver>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Costos por servicio</h1>
          <p className="max-w-2xl text-xs text-gray-600">
            Por cada servicio se suma, máquina por máquina, valor de compra ÷ meses de plazo de su tipo — solo de las
            máquinas que todavía NO están amortizadas. Las amortizadas y las dadas de baja no se incluyen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${API_BASE}/admin/maquinas/costos-por-servicio/export`}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-200"
          >
            Exportar Excel
          </a>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-200"
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">Servicios</p>
          <p className="text-base font-bold text-gray-900">{servicios.length}</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">Costo total mensual</p>
          <p className="text-base font-bold text-blue-700">{formatMoneda(totales.costoTotal)}</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">Maquinas incluidas</p>
          <p className="text-base font-bold text-gray-900">{totales.maquinas}</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">Sin datos para calcular</p>
          <p className={`text-base font-bold ${totales.noCalculables > 0 ? "text-amber-700" : "text-gray-900"}`}>
            {totales.noCalculables}
          </p>
        </div>
      </div>

      <div className="mb-4 space-y-3 rounded-2xl bg-white p-3 shadow">
        <input
          className="w-full rounded-xl border p-2.5 text-sm"
          placeholder="Buscar servicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid gap-2 md:grid-cols-3">
          <SearchableSelect
            className="rounded-xl border p-2 text-xs"
            value={filtroCosto}
            onChange={(event) => setFiltroCosto(event.target.value)}
          >
            {FILTROS_COSTO.map((f) => (
              <option key={f.value || "todos"} value={f.value}>
                {f.label}
              </option>
            ))}
          </SearchableSelect>

          <SearchableSelect
            className="rounded-xl border p-2 text-xs"
            value={filtroDatos}
            onChange={(event) => setFiltroDatos(event.target.value)}
          >
            {FILTROS_DATOS.map((f) => (
              <option key={f.value || "todos"} value={f.value}>
                {f.label}
              </option>
            ))}
          </SearchableSelect>

          <SearchableSelect
            className="rounded-xl border p-2 text-xs"
            value={orden}
            onChange={(event) => setOrden(event.target.value)}
          >
            {OPCIONES_ORDEN.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SearchableSelect>
        </div>
      </div>

      <div className="space-y-3">
        {paginacion.visibles.map((servicio) => (
          <ServicioCard key={servicio.servicioId ?? "sin-servicio"} servicio={servicio} />
        ))}

        {serviciosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
            No hay servicios que coincidan con los filtros.
          </div>
        ) : null}
      </div>

      <Paginacion
        pagina={paginacion.pagina}
        totalPaginas={paginacion.totalPaginas}
        total={paginacion.total}
        tamano={paginacion.tamano}
        onPagina={paginacion.irAPagina}
        onTamano={paginacion.cambiarTamano}
        etiqueta="servicios"
      />
    </div>
  );
}

function ServicioCard({ servicio }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sinServicio = servicio.servicioId === null;

  function irAMaquina(id) {
    navigate(`/admin/maquinas/${encodeURIComponent(id)}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  }

  return (
    <div className={`rounded-2xl bg-white p-4 shadow ${sinServicio ? "border border-dashed border-slate-300" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
            {servicio.nombre}
            {sinServicio ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                Sin servicio
              </span>
            ) : null}
          </p>
          <p className="text-xs text-gray-500">
            {servicio.cantidadMaquinas} maquina{servicio.cantidadMaquinas === 1 ? "" : "s"} no amortizada
            {servicio.cantidadMaquinas === 1 ? "" : "s"}
            {servicio.cantidadNoCalculable > 0 ? ` · ${servicio.cantidadNoCalculable} sin datos para calcular` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase text-gray-400">Costo mensual</p>
          <p className="text-xl font-extrabold text-blue-700">{formatMoneda(servicio.costoTotalMensual)}</p>
        </div>
      </div>

      {servicio.maquinas.length > 0 ? (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Maquina</th>
                <th className="px-3 py-2">Calculo</th>
                <th className="px-3 py-2 text-right">Costo mensual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {servicio.maquinas.map((m) => (
                <tr
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => irAMaquina(m.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      irAMaquina(m.id);
                    }
                  }}
                  className="cursor-pointer transition hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <p className="font-semibold text-slate-700">{m.tipo || "-"}</p>
                    <p className="text-[11px] text-slate-400">
                      {m.id}
                      {m.modelo ? ` · ${m.modelo}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {m.costoMensual !== null ? (
                      <span>
                        {formatMoneda(m.valorCompra)} ÷ {m.plazoMeses} meses
                      </span>
                    ) : (
                      <span className="text-amber-700">{MOTIVO_LABEL[m.motivoNoCalculable] || "No calculable"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {m.costoMensual !== null ? formatMoneda(m.costoMensual) : <span className="text-amber-700">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
          Sin maquinas no amortizadas para este servicio.
        </p>
      )}
    </div>
  );
}
