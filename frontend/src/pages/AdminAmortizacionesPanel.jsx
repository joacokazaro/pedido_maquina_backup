import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import { buildActorHeaders } from "../utils/authHeaders";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../hooks/usePaginacion";
import SearchableSelect from "../components/SearchableSelect";

const ESTADOS = [
  { value: "", label: "Estado maquina: todos" },
  { value: "disponible", label: "Disponible" },
  { value: "asignada", label: "Asignada" },
  { value: "no_devuelta", label: "No devuelta" },
  { value: "fuera_servicio", label: "Fuera de servicio" },
  { value: "taller", label: "En taller" },
  { value: "baja", label: "Baja" },
];

const ESTADOS_AMORTIZACION = [
  { value: "", label: "Estado amortizacion: todos" },
  { value: "AMORTIZADA", label: "Amortizada" },
  { value: "NO_AMORTIZADA", label: "No amortizada" },
  { value: "SIN_DATOS", label: "Sin datos" },
];

function chunkArray(values, size) {
  const result = [];
  for (let i = 0; i < values.length; i += size) {
    result.push(values.slice(i, i + size));
  }
  return result;
}

function addMonths(date, months) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function monthDiff(fromDate, toDate) {
  const years = toDate.getUTCFullYear() - fromDate.getUTCFullYear();
  const months = toDate.getUTCMonth() - fromDate.getUTCMonth();
  return years * 12 + months;
}

function parseDateOnlyUTC(raw) {
  if (!raw) return null;
  const value = String(raw);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDate(date) {
  if (!date) return "-";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function estadoAmortizacionBadgeClass(value) {
  if (value === "AMORTIZADA") {
    return "rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase text-emerald-700";
  }
  if (value === "NO_AMORTIZADA") {
    return "rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase text-amber-700";
  }
  return "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase text-slate-600";
}

function estadoMaquinaBadgeClass(value) {
  const v = String(value || "").toLowerCase();
  if (v === "disponible") return "bg-green-100 text-green-700";
  if (v === "asignada") return "bg-blue-100 text-blue-700";
  if (v === "no_devuelta") return "bg-yellow-100 text-yellow-700";
  if (v === "fuera_servicio") return "bg-orange-100 text-orange-700";
  if (v === "taller") return "bg-purple-100 text-purple-700";
  if (v === "baja") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function computeVencimientoInfo(fechaCompra, amortizacionMeses) {
  if (!fechaCompra || !Number.isInteger(amortizacionMeses) || amortizacionMeses <= 0) {
    return {
      vencimientoFecha: null,
      mesesRestantes: null,
      proximamente: false,
    };
  }

  const compraDate = parseDateOnlyUTC(fechaCompra);
  if (!compraDate) {
    return {
      vencimientoFecha: null,
      mesesRestantes: null,
      proximamente: false,
    };
  }

  const vencimientoFecha = addMonths(compraDate, amortizacionMeses);
  const now = new Date();
  const hoy = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const mesesRestantes = monthDiff(hoy, vencimientoFecha);

  return {
    vencimientoFecha,
    mesesRestantes,
    proximamente: mesesRestantes >= 0,
  };
}

export default function AdminAmortizacionesPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const [recalcSummary, setRecalcSummary] = useState(null);

  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [servicioFiltro, setServicioFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [estadoAmortizacionFiltro, setEstadoAmortizacionFiltro] = useState("");
  const [soloProximos, setSoloProximos] = useState(false);
  const [ventanaMeses, setVentanaMeses] = useState("3");

  const tiposUnicos = useMemo(
    () => Array.from(new Set(items.map((m) => m.tipo).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const serviciosUnicos = useMemo(
    () =>
      Array.from(new Set(items.map((m) => m.servicio?.nombre).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [items]
  );

  const filtered = useMemo(() => {
    const ventana = Number(ventanaMeses);

    return items
      .filter((m) => {
        if (tipoFiltro && m.tipo !== tipoFiltro) return false;
        if (servicioFiltro && String(m.servicio?.nombre || "") !== servicioFiltro) return false;
        if (estadoFiltro && m.estado !== estadoFiltro) return false;
        if (estadoAmortizacionFiltro && m.estadoAmortizacion !== estadoAmortizacionFiltro) return false;

        if (soloProximos) {
          if (m.mesesRestantes === null) return false;
          if (m.mesesRestantes < 0) return false;
          if (Number.isFinite(ventana) && m.mesesRestantes > ventana) return false;
        }

        if (search.trim()) {
          const q = search.toLowerCase();
          const contains =
            String(m.id || "").toLowerCase().includes(q) ||
            String(m.tipo || "").toLowerCase().includes(q) ||
            String(m.modelo || "").toLowerCase().includes(q) ||
            String(m.serie || "").toLowerCase().includes(q) ||
            String(m.servicio?.nombre || "").toLowerCase().includes(q);

          if (!contains) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.vencimientoFecha && b.vencimientoFecha) {
          return a.vencimientoFecha.getTime() - b.vencimientoFecha.getTime();
        }
        if (a.vencimientoFecha) return -1;
        if (b.vencimientoFecha) return 1;
        const byTipo = String(a.tipo || "").localeCompare(String(b.tipo || ""));
        if (byTipo !== 0) return byTipo;
        return String(a.id || "").localeCompare(String(b.id || ""), undefined, { numeric: true });
      });
  }, [
    items,
    tipoFiltro,
    servicioFiltro,
    estadoFiltro,
    estadoAmortizacionFiltro,
    soloProximos,
    ventanaMeses,
    search,
  ]);

  const resumen = useMemo(() => {
    return {
      total: items.length,
      amortizadas: items.filter((m) => m.estadoAmortizacion === "AMORTIZADA").length,
      noAmortizadas: items.filter((m) => m.estadoAmortizacion === "NO_AMORTIZADA").length,
      sinDatos: items.filter((m) => m.estadoAmortizacion === "SIN_DATOS").length,
      proximos: items.filter((m) => m.mesesRestantes !== null && m.mesesRestantes >= 0 && m.mesesRestantes <= 3)
        .length,
    };
  }, [items]);

  const paginacion = usePaginacion(filtered, {
    tamanoInicial: 25,
    reinicio: [search, tipoFiltro, servicioFiltro, estadoFiltro, estadoAmortizacionFiltro, soloProximos, ventanaMeses],
  });

  async function fetchMaquinaDetalles(ids) {
    const chunks = chunkArray(ids, 20);
    const result = [];

    for (const chunk of chunks) {
      const responses = await Promise.all(
        chunk.map(async (id) => {
          const res = await fetch(`${API_BASE}/admin/maquinas/${encodeURIComponent(id)}`, {
            headers: buildActorHeaders(user),
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.error || `No se pudo obtener la maquina ${id}`);
          }

          return data;
        })
      );

      result.push(...responses);
    }

    return result;
  }

  async function loadPanel() {
    try {
      setLoading(true);
      setError("");

      const recalcRes = await fetch(`${API_BASE}/admin/maquinas/amortizacion/recalcular`, {
        method: "POST",
        headers: {
          ...buildActorHeaders(user),
        },
      });

      const recalcData = await recalcRes.json().catch(() => ({}));
      if (!recalcRes.ok) {
        throw new Error(recalcData?.error || "No se pudo recalcular el estado de amortizacion");
      }

      setRecalcSummary(recalcData?.resumen || null);

      const listRes = await fetch(`${API_BASE}/admin/maquinas`, {
        headers: buildActorHeaders(user),
      });
      const listData = await listRes.json().catch(() => []);

      if (!listRes.ok) {
        throw new Error(listData?.error || "No se pudo obtener el listado de maquinas");
      }

      const ids = (Array.isArray(listData) ? listData : []).map((m) => m.id).filter(Boolean);
      const details = ids.length ? await fetchMaquinaDetalles(ids) : [];

      const normalized = details.map((item) => {
        const amortizacionMeses = Number.isInteger(item?.amortizacion)
          ? item.amortizacion
          : Number.isFinite(Number(item?.amortizacion))
            ? Number(item.amortizacion)
            : null;

        const vencimiento = computeVencimientoInfo(item?.fechaCompra, amortizacionMeses);

        return {
          ...item,
          amortizacionMeses,
          vencimientoFecha: vencimiento.vencimientoFecha,
          mesesRestantes: vencimiento.mesesRestantes,
          proximamente: vencimiento.proximamente,
          estadoVencimiento: item?.estadoAmortizacion === "AMORTIZADA" ? "Amortizada" : "No amortizada",
        };
      });

      setItems(normalized);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error cargando panel de amortizaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPanel();
  }, [user?.username]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate("/admin/maquinas")}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver a máquinas
      </button>

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Panel de amortizaciones</h1>
          <p className="text-xs text-gray-600">
            Al abrir esta vista se recalcula amortización y se listan datos de detalle desde /admin/maquinas/:id.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPanel}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-200"
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar panel"}
        </button>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {recalcSummary ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Recalculo ejecutado. Total: {recalcSummary.total ?? 0} | Amortizadas: {recalcSummary.amortizada ?? 0} |
          No amortizadas: {recalcSummary.noAmortizada ?? 0} | Sin datos: {recalcSummary.sinDatos ?? 0}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">Total</p>
          <p className="text-base font-bold text-gray-900">{resumen.total}</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">Amortizadas</p>
          <p className="text-base font-bold text-emerald-700">{resumen.amortizadas}</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">No amortizadas</p>
          <p className="text-base font-bold text-amber-700">{resumen.noAmortizadas}</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">Sin datos</p>
          <p className="text-base font-bold text-slate-700">{resumen.sinDatos}</p>
        </div>
        <div className="rounded-xl bg-white px-3 py-2 shadow">
          <p className="text-gray-500">Proximos (3 meses)</p>
          <p className="text-base font-bold text-indigo-700">{resumen.proximos}</p>
        </div>
      </div>

      <div className="mb-4 space-y-3 rounded-2xl bg-white p-3 shadow">
        <input
          className="w-full rounded-xl border p-2.5 text-sm"
          placeholder="Buscar por codigo, tipo, modelo, serie o servicio..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="grid gap-2 md:grid-cols-5">
          <SearchableSelect className="rounded-xl border p-2 text-xs" value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value)}>
            <option value="">Todos los tipos</option>
            {tiposUnicos.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </SearchableSelect>

          <SearchableSelect
            className="rounded-xl border p-2 text-xs"
            value={servicioFiltro}
            onChange={(event) => setServicioFiltro(event.target.value)}
          >
            <option value="">Servicio: todos</option>
            {serviciosUnicos.map((servicio) => (
              <option key={servicio} value={servicio}>
                {servicio}
              </option>
            ))}
          </SearchableSelect>

          <SearchableSelect className="rounded-xl border p-2 text-xs" value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)}>
            {ESTADOS.map((estado) => (
              <option key={estado.value || "todos"} value={estado.value}>
                {estado.label}
              </option>
            ))}
          </SearchableSelect>

          <SearchableSelect
            className="rounded-xl border p-2 text-xs"
            value={estadoAmortizacionFiltro}
            onChange={(event) => setEstadoAmortizacionFiltro(event.target.value)}
          >
            {ESTADOS_AMORTIZACION.map((estado) => (
              <option key={estado.value || "todos"} value={estado.value}>
                {estado.label}
              </option>
            ))}
          </SearchableSelect>

          <SearchableSelect
            className="rounded-xl border p-2 text-xs"
            value={ventanaMeses}
            onChange={(event) => setVentanaMeses(event.target.value)}
            disabled={!soloProximos}
          >
            <option value="1">Proximos 1 mes</option>
            <option value="3">Proximos 3 meses</option>
            <option value="6">Proximos 6 meses</option>
            <option value="12">Proximos 12 meses</option>
          </SearchableSelect>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={soloProximos}
            onChange={(event) => setSoloProximos(event.target.checked)}
          />
          Mostrar solo proximos vencimientos
        </label>
      </div>

      {loading ? <div className="p-3 text-sm text-gray-600">Cargando panel de amortizaciones...</div> : null}

      {!loading ? (
        <div className="space-y-2">
          {paginacion.visibles.map((m) => (
            <div
              key={m.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/admin/maquinas/${encodeURIComponent(m.id)}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/admin/maquinas/${encodeURIComponent(m.id)}`);
                }
              }}
              className="cursor-pointer rounded-2xl bg-white px-4 py-3 shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold uppercase">{m.tipo || "-"}</p>
                  <p className="text-xs text-gray-500">
                    Codigo: <b>{m.id}</b>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${estadoMaquinaBadgeClass(m.estado)}`}>
                    {m.estado || "-"}
                  </span>
                  <span className={estadoAmortizacionBadgeClass(m.estadoAmortizacion)}>{m.estadoAmortizacionLabel || "Sin datos"}</span>
                </div>
              </div>

              <div className="mt-2 grid gap-1 text-xs text-gray-600 md:grid-cols-2">
                <p>
                  Servicio: <b>{m.servicio?.nombre || "-"}</b>
                </p>
                <p>
                  Modelo: <b>{m.modelo || "-"}</b>
                </p>
                <p>
                  Fecha compra: <b>{formatDate(parseDateOnlyUTC(m.fechaCompra))}</b>
                </p>
                <p>
                  Plazo amortizacion: <b>{m.amortizacionMeses ?? "-"} meses</b>
                </p>
                <p>
                  Vencimiento estimado: <b>{formatDate(m.vencimientoFecha)}</b>
                </p>
                <p>
                  Estado vencimiento: <b>{m.estadoVencimiento}</b>
                </p>
              </div>
            </div>
          ))}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
              No hay maquinas para los filtros seleccionados.
            </div>
          ) : null}

          <Paginacion
            pagina={paginacion.pagina}
            totalPaginas={paginacion.totalPaginas}
            total={paginacion.total}
            tamano={paginacion.tamano}
            onPagina={paginacion.irAPagina}
            onTamano={paginacion.cambiarTamano}
            etiqueta="maquinas"
          />
        </div>
      ) : null}
    </div>
  );
}
