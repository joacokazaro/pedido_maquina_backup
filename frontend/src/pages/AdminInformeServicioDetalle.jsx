import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import BotonVolver from "../components/BotonVolver";
import ConfirmModal from "../components/ConfirmModal";
import SearchableSelect from "../components/SearchableSelect";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import { buildActorHeaders } from "../utils/authHeaders";
import { formatDateOnly, formatDateTime, toDateInputValue } from "../utils/date";
import { downloadInformeServicioPdf } from "../utils/informeServicioPdf";
import { TIPOS_INSUMO_EXTRA, TIPOS_TRABAJO, UNIDADES, UNIDADES_INSUMO } from "../constants/trabajos";

const INPUT = "w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm";
const BTN_PRIMARIO =
  "rounded-xl bg-kazaro-blue px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-kazaro-deep disabled:opacity-60";
const BTN_SECUNDARIO =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60";
const BTN_QUITAR = "text-xs font-semibold text-rose-600 hover:text-rose-800";

const ORIGEN_LABEL = { PEDIDO: "Pedido", SERVICIO: "Del servicio", MANUAL: "Manual" };
const ORIGEN_STYLE = {
  PEDIDO: "bg-kazaro-ice text-kazaro-deep",
  SERVICIO: "bg-emerald-100 text-emerald-800",
  MANUAL: "bg-amber-100 text-amber-800",
};

function emptyTrabajo() {
  return { tipo: "", label: "", descripcionOtro: "", cantidad: "", unidadMedida: "", unidadLabel: "" };
}

function emptyServicioExtra() {
  return { descripcion: "", cantidad: "", unidadMedida: "", unidadLabel: "", precio: "" };
}

function Seccion({ numero, titulo, descripcion, acciones = null, children }) {
  return (
    <section className="overflow-hidden rounded-3xl border-2 border-slate-300/70 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 bg-slate-100/80 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-kazaro-navy text-sm font-bold text-white">
            {numero}
          </span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-800">{titulo}</h2>
            {descripcion ? <p className="text-xs text-slate-500">{descripcion}</p> : null}
          </div>
        </div>
        {acciones}
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </section>
  );
}

function ChipOrigen({ origen }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ORIGEN_STYLE[origen] || ORIGEN_STYLE.MANUAL}`}>
      {ORIGEN_LABEL[origen] || origen}
    </span>
  );
}

// Modal para sumar máquinas: las asignadas al servicio o cualquiera del inventario.
function SelectorMaquinasModal({ open, onClose, onConfirm, maquinasDelServicio, yaSeleccionadas, headers }) {
  const [tab, setTab] = useState("servicio");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState(() => new Set());
  const [todas, setTodas] = useState([]);
  const [todasCargadas, setTodasCargadas] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("servicio");
      setBusqueda("");
      setSeleccion(new Set());
    }
  }, [open]);

  // El inventario completo se pide recién al entrar a la pestaña "Todas".
  useEffect(() => {
    if (!open || tab !== "todas" || todasCargadas) return undefined;

    let cancelado = false;
    async function load() {
      try {
        setCargando(true);
        const res = await fetch(`${API_BASE}/maquinas`, { headers });
        const data = res.ok ? await res.json() : [];
        if (cancelado) return;
        setTodas((Array.isArray(data) ? data : []).filter((maquina) => maquina.estado !== "baja"));
        setTodasCargadas(true);
      } catch (loadError) {
        console.error(loadError);
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    load();
    return () => {
      cancelado = true;
    };
  }, [open, tab, todasCargadas, headers]);

  const idsDelServicio = useMemo(() => new Set(maquinasDelServicio.map((maquina) => maquina.id)), [maquinasDelServicio]);

  const visibles = useMemo(() => {
    const fuente = tab === "servicio" ? maquinasDelServicio : todas;
    const term = busqueda.trim().toLowerCase();
    return fuente.filter((maquina) => {
      if (!term) return true;
      return [maquina.id, maquina.tipo, maquina.modelo, maquina.serie, maquina.servicio]
        .some((valor) => String(valor || "").toLowerCase().includes(term));
    });
  }, [tab, maquinasDelServicio, todas, busqueda]);

  const porId = useMemo(() => {
    const mapa = new Map();
    for (const maquina of todas) mapa.set(maquina.id, maquina);
    for (const maquina of maquinasDelServicio) mapa.set(maquina.id, maquina);
    return mapa;
  }, [todas, maquinasDelServicio]);

  if (!open) return null;

  function toggle(maquinaId) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(maquinaId)) next.delete(maquinaId);
      else next.add(maquinaId);
      return next;
    });
  }

  function confirmar() {
    const agregadas = Array.from(seleccion)
      .map((maquinaId) => porId.get(maquinaId))
      .filter(Boolean)
      .map((maquina) => ({
        id: maquina.id,
        tipo: maquina.tipo,
        modelo: maquina.modelo,
        serie: maquina.serie,
        estado: maquina.estado,
        origen: idsDelServicio.has(maquina.id) ? "SERVICIO" : "MANUAL",
        pedidoIds: [],
      }));
    onConfirm(agregadas);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-lg font-bold text-kazaro-navy">Agregar máquinas</h3>
          <div className="mt-3 flex gap-2">
            {[
              ["servicio", "Del servicio"],
              ["todas", "Todas las máquinas"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  tab === value ? "bg-kazaro-blue text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            className={`${INPUT} mt-3`}
            placeholder="Buscar por ID, tipo, modelo, serie..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cargando ? (
            <p className="text-sm text-slate-500">Cargando máquinas...</p>
          ) : visibles.length === 0 ? (
            <p className="text-sm text-slate-500">No hay máquinas para mostrar.</p>
          ) : (
            <ul className="space-y-1.5">
              {visibles.map((maquina) => {
                const yaEsta = yaSeleccionadas.has(maquina.id);
                return (
                  <li key={maquina.id}>
                    <label
                      className={`flex items-center gap-3 rounded-xl border p-2.5 text-sm ${
                        yaEsta ? "border-slate-100 bg-slate-50 text-slate-400" : "cursor-pointer border-slate-200 hover:bg-kazaro-mist"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={yaEsta}
                        checked={yaEsta || seleccion.has(maquina.id)}
                        onChange={() => toggle(maquina.id)}
                      />
                      <span className="font-semibold">{maquina.id}</span>
                      <span>{maquina.tipo}</span>
                      <span className="text-slate-500">{maquina.modelo}</span>
                      {maquina.estado && maquina.estado !== "disponible" && maquina.estado !== "asignada" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          {String(maquina.estado).replaceAll("_", " ")}
                        </span>
                      ) : null}
                      {tab === "todas" && maquina.servicio ? (
                        <span className="ml-auto text-xs text-slate-400">{maquina.servicio}</span>
                      ) : null}
                      {yaEsta ? <span className="ml-auto text-xs">ya agregada</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" className={BTN_SECUNDARIO} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={BTN_PRIMARIO} disabled={seleccion.size === 0} onClick={confirmar}>
            Agregar {seleccion.size > 0 ? `(${seleccion.size})` : ""}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function AdminInformeServicioDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const headers = useMemo(() => buildActorHeaders(user), [user]);
  const jsonHeaders = useMemo(() => ({ "Content-Type": "application/json", ...headers }), [headers]);

  const [informe, setInforme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  // Acción en curso ("guardar", "pedidos", "horas-browix", "insumos", "pdf"): deshabilita los botones.
  const [accion, setAccion] = useState("");
  const [dirty, setDirty] = useState(false);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [maquinas, setMaquinas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [trabajos, setTrabajos] = useState([]);
  const [serviciosExtras, setServiciosExtras] = useState([]);
  const [insumosExtras, setInsumosExtras] = useState([]);
  const [nuevaObservacion, setNuevaObservacion] = useState("");

  const [catalogoVehiculos, setCatalogoVehiculos] = useState([]);
  const [vehiculoAAgregar, setVehiculoAAgregar] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(false);

  const aplicarServidor = useCallback((data) => {
    setInforme(data);
    setFechaDesde(toDateInputValue(data.fechaDesde));
    setFechaHasta(toDateInputValue(data.fechaHasta));
    setMaquinas(Array.isArray(data.maquinas) ? data.maquinas : []);
    setVehiculos(Array.isArray(data.vehiculos) ? data.vehiculos : []);
    setTrabajos(Array.isArray(data.trabajosRealizados) ? data.trabajosRealizados : []);
    setServiciosExtras(Array.isArray(data.serviciosExtrasSubcontratados) ? data.serviciosExtrasSubcontratados : []);
    setInsumosExtras(Array.isArray(data.insumosExtras) ? data.insumosExtras : []);
    setNuevaObservacion("");
    setDirty(false);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [informeRes, catalogoRes] = await Promise.all([
          fetch(`${API_BASE}/admin/informes-servicio/${encodeURIComponent(id)}`, { headers }),
          fetch(`${API_BASE}/admin/informes-servicio/catalogo`, { headers }),
        ]);
        const data = await informeRes.json().catch(() => ({}));
        if (!informeRes.ok) throw new Error(data?.error || "No se pudo cargar el informe");

        const catalogo = catalogoRes.ok ? await catalogoRes.json().catch(() => ({})) : {};
        setCatalogoVehiculos(Array.isArray(catalogo?.vehiculos) ? catalogo.vehiculos : []);
        aplicarServidor(data);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message || "Error cargando el informe");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, headers, aplicarServidor]);

  // Cualquier edición del formulario marca cambios sin guardar.
  function editar(setter) {
    return (valor) => {
      setter(valor);
      setDirty(true);
    };
  }
  const editMaquinas = editar(setMaquinas);
  const editVehiculos = editar(setVehiculos);
  const editTrabajos = editar(setTrabajos);
  const editServiciosExtras = editar(setServiciosExtras);
  const editInsumosExtras = editar(setInsumosExtras);

  function buildPayload() {
    const componente = ({ id: componenteId, origen, pedidoIds }) => ({ id: componenteId, origen, pedidoIds });

    return {
      fechaDesde,
      fechaHasta,
      maquinas: maquinas.map(componente),
      vehiculos: vehiculos.map(componente),
      trabajosRealizados: trabajos.map((row) => {
        const descripcionOtro = String(row.descripcionOtro || "").trim();
        return {
          ...row,
          label:
            row.tipo === "OTRO" && descripcionOtro
              ? descripcionOtro
              : TIPOS_TRABAJO.find((t) => t.value === row.tipo)?.label || row.label || row.tipo,
          unidadLabel: UNIDADES.find((u) => u.value === row.unidadMedida)?.label || row.unidadLabel || row.unidadMedida,
          cantidad: Number(row.cantidad),
        };
      }),
      serviciosExtrasSubcontratados: serviciosExtras.map((row) => ({
        ...row,
        unidadLabel: UNIDADES.find((u) => u.value === row.unidadMedida)?.label || row.unidadLabel || row.unidadMedida,
        cantidad: Number(row.cantidad),
        precio: row.precio === "" || row.precio === null || row.precio === undefined ? null : Number(row.precio),
      })),
      insumosExtras: insumosExtras.map((row) => {
        const descripcionOtro = String(row.descripcionOtro || "").trim();
        return {
          ...row,
          label:
            row.tipo === "OTRO" && descripcionOtro
              ? descripcionOtro
              : TIPOS_INSUMO_EXTRA.find((i) => i.value === row.tipo)?.label || row.label || row.tipo,
          unidadLabel:
            UNIDADES_INSUMO.find((u) => u.value === row.unidadMedida)?.label || row.unidadLabel || row.unidadMedida,
          cantidad: Number(row.cantidad),
        };
      }),
      nuevaObservacion: nuevaObservacion.trim() || undefined,
    };
  }

  async function request(path, method, body) {
    const res = await fetch(`${API_BASE}/admin/informes-servicio/${encodeURIComponent(id)}${path}`, {
      method,
      headers: jsonHeaders,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "No se pudo completar la operación");
    return data;
  }

  async function guardarCambios() {
    const data = await request("", "PUT", buildPayload());
    aplicarServidor(data);
    return data;
  }

  // Todas las acciones guardan primero lo que hay en pantalla: las importaciones y el PDF
  // trabajan sobre el informe guardado (rango de fechas incluido).
  async function ejecutar(nombre, fn, mensajeExito = "") {
    try {
      setAccion(nombre);
      setError("");
      setMensaje("");
      await fn();
      if (mensajeExito) setMensaje(mensajeExito);
    } catch (accionError) {
      console.error(accionError);
      setError(accionError.message || "Error inesperado");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setAccion("");
    }
  }

  const onGuardar = () => ejecutar("guardar", guardarCambios, "Cambios guardados.");

  const onTraerPedidos = () =>
    ejecutar(
      "pedidos",
      async () => {
        await guardarCambios();
        aplicarServidor(await request("/recargar-pedidos", "POST"));
      },
      "Se actualizaron las máquinas y vehículos con los pedidos del período."
    );

  const onImportar = (ruta, texto) =>
    ejecutar(
      ruta,
      async () => {
        await guardarCambios();
        aplicarServidor(await request(`/importar-${ruta}`, "POST"));
      },
      texto
    );

  const onPdf = () =>
    ejecutar("pdf", async () => {
      const data = dirty ? await guardarCambios() : informe;
      downloadInformeServicioPdf(data);
    });

  async function eliminar() {
    setConfirmEliminar(false);
    await ejecutar("eliminar", async () => {
      await request("", "DELETE");
      navigate("/admin/informes-servicio");
    });
  }

  function agregarMaquinas(nuevas) {
    const existentes = new Set(maquinas.map((maquina) => maquina.id));
    editMaquinas([...maquinas, ...nuevas.filter((maquina) => !existentes.has(maquina.id))]);
    setSelectorOpen(false);
  }

  function agregarVehiculo() {
    const vehiculo = catalogoVehiculos.find((item) => item.id === vehiculoAAgregar);
    if (!vehiculo || vehiculos.some((item) => item.id === vehiculo.id)) return;
    editVehiculos([...vehiculos, { ...vehiculo, origen: "MANUAL", pedidoIds: [] }]);
    setVehiculoAAgregar("");
  }

  const updateFila = (lista, setter, index, key, value) =>
    setter(lista.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const quitarFila = (lista, setter, index) => setter(lista.filter((_, i) => i !== index));

  const maquinasAgrupadas = useMemo(() => {
    const grupos = new Map();
    for (const maquina of maquinas) {
      const tipo = maquina.tipo || "Sin tipo";
      if (!grupos.has(tipo)) grupos.set(tipo, []);
      grupos.get(tipo).push(maquina);
    }
    return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [maquinas]);

  const idsMaquinas = useMemo(() => new Set(maquinas.map((maquina) => maquina.id)), [maquinas]);

  const opcionesVehiculo = useMemo(
    () => catalogoVehiculos.filter((vehiculo) => !vehiculos.some((item) => item.id === vehiculo.id)),
    [catalogoVehiculos, vehiculos]
  );

  if (loading) return <div className="p-4">Cargando informe...</div>;
  if (!informe) {
    return (
      <div className="space-y-4 p-4">
        <BotonVolver className="" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error || "Informe no encontrado"}
        </div>
      </div>
    );
  }

  const ocupado = Boolean(accion);
  const horasBrowix = informe.horasBrowix;
  const insumosImportados = informe.insumosImportados;
  const supervisores = (informe.supervisores || []).map((s) => s.nombre || s.username).join(", ");

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-28 space-y-4">
      <BotonVolver className="" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-kazaro-navy">Informe de servicio</h1>
          <p className="text-lg font-semibold text-slate-800">{informe.servicio?.nombre}</p>
          <p className="text-xs text-slate-500">
            Creado por {informe.creadoPor?.nombre || informe.creadoPor?.username || "-"} el{" "}
            {formatDateTime(informe.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? <span className="text-xs font-semibold text-amber-700">Cambios sin guardar</span> : null}
          <button type="button" className={BTN_PRIMARIO} disabled={ocupado} onClick={onGuardar}>
            {accion === "guardar" ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>
      ) : null}
      {mensaje ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {mensaje}
        </div>
      ) : null}
      {ocupado && (accion === "horas-browix" || accion === "pedidos") ? (
        <div className="rounded-xl border border-kazaro-sky/40 bg-kazaro-ice p-3 text-sm text-kazaro-deep">
          {accion === "horas-browix"
            ? "Consultando Browix: puede tardar un minuto o más según el rango de fechas."
            : "Trayendo los pedidos del período..."}
        </div>
      ) : null}

      <Seccion numero="1" titulo="Datos del servicio" descripcion="Período del informe y supervisores asignados.">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="inf-desde" className="mb-1 block text-sm font-medium text-slate-700">
              Desde
            </label>
            <input
              id="inf-desde"
              type="date"
              className={INPUT}
              value={fechaDesde}
              onChange={(event) => {
                setFechaDesde(event.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div>
            <label htmlFor="inf-hasta" className="mb-1 block text-sm font-medium text-slate-700">
              Hasta
            </label>
            <input
              id="inf-hasta"
              type="date"
              className={INPUT}
              value={fechaHasta}
              onChange={(event) => {
                setFechaHasta(event.target.value);
                setDirty(true);
              }}
            />
          </div>
        </div>
        <p className="text-sm text-slate-700">
          <span className="font-semibold">Supervisores asignados:</span> {supervisores || "Sin asignar"}
        </p>
        <p className="text-xs text-slate-500">
          Si cambiás las fechas, usá “Traer de los pedidos” e importá de nuevo las horas y los insumos para que
          coincidan con el nuevo período.
        </p>
      </Seccion>

      <Seccion
        numero="2"
        titulo="Pedidos del período"
        descripcion="Pedidos no cancelados entregados al servicio dentro del rango."
        acciones={
          <button type="button" className={BTN_SECUNDARIO} disabled={ocupado} onClick={onTraerPedidos}>
            {accion === "pedidos" ? "Trayendo..." : "Traer de los pedidos"}
          </button>
        }
      >
        {informe.pedidos.length === 0 ? (
          <p className="text-sm text-slate-500">No se entregaron pedidos al servicio en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Pedido</th>
                  <th className="py-2 pr-3">Entrega</th>
                  <th className="py-2 pr-3">Solicitante</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2">Máquinas y vehículos</th>
                </tr>
              </thead>
              <tbody>
                {informe.pedidos.map((pedido) => (
                  <tr key={pedido.id} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3 font-semibold">{pedido.id}</td>
                    <td className="py-2 pr-3">{formatDateTime(pedido.fechaEntrega)}</td>
                    <td className="py-2 pr-3">{pedido.solicitante?.nombre || pedido.solicitante?.username}</td>
                    <td className="py-2 pr-3">{String(pedido.estado).replaceAll("_", " ")}</td>
                    <td className="py-2 text-slate-600">
                      {[
                        ...pedido.maquinas.map((maquina) => `${maquina.tipo} ${maquina.id}`),
                        ...pedido.vehiculos.map((vehiculo) => `${vehiculo.vehiculo} ${vehiculo.id}`),
                      ].join(", ") || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion
        numero="3"
        titulo="Maquinaria utilizada"
        descripcion="Precargada desde los pedidos; podés sumar máquinas del servicio u otras, y quitar las que no corresponden."
        acciones={
          <button type="button" className={BTN_SECUNDARIO} onClick={() => setSelectorOpen(true)}>
            Agregar máquinas
          </button>
        }
      >
        {maquinas.length === 0 ? (
          <p className="text-sm text-slate-500">No hay máquinas cargadas.</p>
        ) : (
          <div className="space-y-4">
            {maquinasAgrupadas.map(([tipo, lista]) => (
              <div key={tipo}>
                <p className="mb-1.5 text-sm font-bold text-slate-800">
                  {tipo} <span className="font-normal text-slate-500">({lista.length})</span>
                </p>
                <ul className="space-y-1.5">
                  {lista.map((maquina) => (
                    <li
                      key={maquina.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      <span className="font-semibold">{maquina.id}</span>
                      <span className="text-slate-600">{maquina.modelo}</span>
                      <ChipOrigen origen={maquina.origen} />
                      {maquina.pedidoIds?.length > 0 ? (
                        <span className="text-xs text-slate-500">{maquina.pedidoIds.join(", ")}</span>
                      ) : null}
                      <button
                        type="button"
                        className={`${BTN_QUITAR} ml-auto`}
                        onClick={() => editMaquinas(maquinas.filter((item) => item.id !== maquina.id))}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion numero="4" titulo="Vehículos utilizados" descripcion="Precargados desde los pedidos; podés sumar cualquier vehículo.">
        {vehiculos.length === 0 ? (
          <p className="text-sm text-slate-500">No hay vehículos cargados.</p>
        ) : (
          <ul className="space-y-1.5">
            {vehiculos.map((vehiculo) => (
              <li
                key={vehiculo.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="font-semibold">{vehiculo.vehiculo}</span>
                <span className="text-slate-600">
                  {vehiculo.id} · {vehiculo.modelo} · {vehiculo.patente || "sin patente"}
                </span>
                <ChipOrigen origen={vehiculo.origen} />
                <button
                  type="button"
                  className={`${BTN_QUITAR} ml-auto`}
                  onClick={() => editVehiculos(vehiculos.filter((item) => item.id !== vehiculo.id))}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1">
            <SearchableSelect className={INPUT} value={vehiculoAAgregar} onChange={(event) => setVehiculoAAgregar(event.target.value)}>
              <option value="">Agregar otro vehículo...</option>
              {opcionesVehiculo.map((vehiculo) => (
                <option key={vehiculo.id} value={vehiculo.id}>
                  {`${vehiculo.vehiculo} ${vehiculo.id} · ${vehiculo.patente || "sin patente"}`}
                </option>
              ))}
            </SearchableSelect>
          </div>
          <button type="button" className={BTN_SECUNDARIO} disabled={!vehiculoAAgregar} onClick={agregarVehiculo}>
            Agregar
          </button>
        </div>
      </Seccion>

      <Seccion
        numero="5"
        titulo="Trabajos realizados"
        acciones={
          <button type="button" className={BTN_SECUNDARIO} onClick={() => editTrabajos([...trabajos, emptyTrabajo()])}>
            Agregar trabajo
          </button>
        }
      >
        {trabajos.length === 0 ? <p className="text-sm text-slate-500">No hay trabajos cargados.</p> : null}
        {trabajos.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <select
                className={INPUT}
                value={row.tipo}
                onChange={(event) => updateFila(trabajos, editTrabajos, index, "tipo", event.target.value)}
              >
                <option value="">Tipo de trabajo...</option>
                {TIPOS_TRABAJO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              {row.tipo === "OTRO" ? (
                <input
                  className={INPUT}
                  placeholder="Descripción"
                  value={row.descripcionOtro || ""}
                  onChange={(event) => updateFila(trabajos, editTrabajos, index, "descripcionOtro", event.target.value)}
                />
              ) : null}
            </div>
            <div className="md:col-span-2">
              <input
                className={INPUT}
                type="number"
                min="0"
                step="any"
                placeholder="Cantidad"
                value={row.cantidad}
                onChange={(event) => updateFila(trabajos, editTrabajos, index, "cantidad", event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <select
                className={INPUT}
                value={row.unidadMedida}
                onChange={(event) => updateFila(trabajos, editTrabajos, index, "unidadMedida", event.target.value)}
              >
                <option value="">Unidad...</option>
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center md:col-span-1">
              <button type="button" className={BTN_QUITAR} onClick={() => quitarFila(trabajos, editTrabajos, index)}>
                Quitar
              </button>
            </div>
          </div>
        ))}
      </Seccion>

      <Seccion
        numero="6"
        titulo="Servicios extras subcontratados"
        acciones={
          <button
            type="button"
            className={BTN_SECUNDARIO}
            onClick={() => editServiciosExtras([...serviciosExtras, emptyServicioExtra()])}
          >
            Agregar servicio extra
          </button>
        }
      >
        {serviciosExtras.length === 0 ? (
          <p className="text-sm text-slate-500">No hay servicios extras cargados.</p>
        ) : null}
        {serviciosExtras.map((row, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <input
                className={INPUT}
                placeholder="Descripción"
                value={row.descripcion}
                onChange={(event) => updateFila(serviciosExtras, editServiciosExtras, index, "descripcion", event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <input
                className={INPUT}
                type="number"
                min="0"
                step="any"
                placeholder="Cantidad"
                value={row.cantidad}
                onChange={(event) => updateFila(serviciosExtras, editServiciosExtras, index, "cantidad", event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <select
                className={INPUT}
                value={row.unidadMedida}
                onChange={(event) => updateFila(serviciosExtras, editServiciosExtras, index, "unidadMedida", event.target.value)}
              >
                <option value="">Unidad...</option>
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <input
                className={INPUT}
                type="number"
                min="0"
                step="any"
                placeholder="Precio (ARS)"
                value={row.precio ?? ""}
                onChange={(event) => updateFila(serviciosExtras, editServiciosExtras, index, "precio", event.target.value)}
              />
            </div>
            <div className="flex items-center md:col-span-1">
              <button
                type="button"
                className={BTN_QUITAR}
                onClick={() => quitarFila(serviciosExtras, editServiciosExtras, index)}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </Seccion>

      <Seccion
        numero="7"
        titulo="Horas de Browix"
        acciones={
          <button type="button" className={BTN_SECUNDARIO} disabled={ocupado} onClick={() => onImportar("horas-browix", "Horas de Browix importadas.")}>
            {accion === "horas-browix" ? "Importando..." : horasBrowix ? "Reimportar horas" : "Importar horas"}
          </button>
        }
      >
        {!horasBrowix ? (
          <p className="text-sm text-slate-500">Todavía no se importaron las horas.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Total:</span> {horasBrowix.totalHoras} hs ·{" "}
              {horasBrowix.cantidadFichajes} fichajes · período {formatDateOnly(horasBrowix.desde)} al{" "}
              {formatDateOnly(horasBrowix.hasta)}
            </p>
            {horasBrowix.categorias?.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Categoría</th>
                    <th className="py-2 text-right">Personas</th>
                    <th className="py-2 text-right">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {horasBrowix.categorias.map((cat) => (
                    <tr key={cat.categoria} className="border-t border-slate-100">
                      <td className="py-1.5">{cat.categoria}</td>
                      <td className="py-1.5 text-right">{cat.cantidadPersonas}</td>
                      <td className="py-1.5 text-right">{cat.totalHoras} hs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">No hay fichajes del servicio en el período.</p>
            )}
            {horasBrowix.erroresCategorizacion?.length > 0 ? (
              <p className="text-xs text-amber-700">
                No se pudo determinar la categoría de {horasBrowix.erroresCategorizacion.length} persona(s); figuran
                como “Sin categoría”.
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              Importado el {formatDateTime(horasBrowix.importadoEn)} por {horasBrowix.importadoPor || "-"}.
            </p>
          </div>
        )}
      </Seccion>

      <Seccion
        numero="8"
        titulo="Insumos"
        descripcion="Pedidos de insumos del servicio dentro del período, más los insumos extras cargados a mano."
        acciones={
          <button type="button" className={BTN_SECUNDARIO} disabled={ocupado} onClick={() => onImportar("insumos", "Insumos importados.")}>
            {accion === "insumos" ? "Importando..." : insumosImportados ? "Reimportar insumos" : "Importar insumos"}
          </button>
        }
      >
        {!insumosImportados ? (
          <p className="text-sm text-slate-500">Todavía no se importaron los insumos.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">Total:</span> $ {Number(insumosImportados.total).toLocaleString("es-AR")}{" "}
              · {insumosImportados.cantidadPedidos} pedido(s) · período {formatDateOnly(insumosImportados.desde)} al{" "}
              {formatDateOnly(insumosImportados.hasta)}
            </p>
            {insumosImportados.insumos?.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Insumo</th>
                    <th className="py-2 text-right">Cantidad</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {insumosImportados.insumos.map((insumo) => (
                    <tr key={`${insumo.codigo}-${insumo.insumo}`} className="border-t border-slate-100">
                      <td className="py-1.5">{insumo.insumo}</td>
                      <td className="py-1.5 text-right">{insumo.cantidad}</td>
                      <td className="py-1.5 text-right">$ {Number(insumo.subtotal).toLocaleString("es-AR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">No hay pedidos de insumos del servicio en el período.</p>
            )}
            <p className="text-xs text-slate-500">
              Importado el {formatDateTime(insumosImportados.importadoEn)} por {insumosImportados.importadoPor || "-"}.
            </p>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Insumos extras (carga manual)</h3>
            <button
              type="button"
              className={BTN_SECUNDARIO}
              onClick={() =>
                editInsumosExtras([
                  ...insumosExtras,
                  { tipo: "", label: "", descripcionOtro: "", cantidad: "", unidadMedida: "", unidadLabel: "" },
                ])
              }
            >
              Agregar insumo extra
            </button>
          </div>
          {insumosExtras.length === 0 ? <p className="text-sm text-slate-500">No hay insumos extras cargados.</p> : null}
          <div className="space-y-2">
            {insumosExtras.map((row, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <select
                    className={INPUT}
                    value={row.tipo}
                    onChange={(event) => updateFila(insumosExtras, editInsumosExtras, index, "tipo", event.target.value)}
                  >
                    <option value="">Insumo...</option>
                    {TIPOS_INSUMO_EXTRA.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  {row.tipo === "OTRO" ? (
                    <input
                      className={INPUT}
                      placeholder="Descripción"
                      value={row.descripcionOtro || ""}
                      onChange={(event) =>
                        updateFila(insumosExtras, editInsumosExtras, index, "descripcionOtro", event.target.value)
                      }
                    />
                  ) : null}
                </div>
                <div className="md:col-span-2">
                  <input
                    className={INPUT}
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Cantidad"
                    value={row.cantidad}
                    onChange={(event) => updateFila(insumosExtras, editInsumosExtras, index, "cantidad", event.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <select
                    className={INPUT}
                    value={row.unidadMedida}
                    onChange={(event) =>
                      updateFila(insumosExtras, editInsumosExtras, index, "unidadMedida", event.target.value)
                    }
                  >
                    <option value="">Unidad...</option>
                    {UNIDADES_INSUMO.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center md:col-span-1">
                  <button
                    type="button"
                    className={BTN_QUITAR}
                    onClick={() => quitarFila(insumosExtras, editInsumosExtras, index)}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion
        numero="9"
        titulo="Observaciones"
        descripcion="Quedan registradas con autor y fecha; no se pueden modificar una vez guardadas."
      >
        {informe.observaciones.length === 0 ? (
          <p className="text-sm text-slate-500">No hay observaciones registradas.</p>
        ) : (
          <ul className="space-y-2">
            {informe.observaciones.map((obs, index) => (
              <li key={index} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500">
                  {obs.autor} · {formatDateTime(obs.fecha)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{obs.texto}</p>
              </li>
            ))}
          </ul>
        )}
        <div>
          <label htmlFor="inf-obs" className="mb-1 block text-sm font-medium text-slate-700">
            Nueva observación
          </label>
          <textarea
            id="inf-obs"
            rows={3}
            className={INPUT}
            value={nuevaObservacion}
            onChange={(event) => {
              setNuevaObservacion(event.target.value);
              setDirty(true);
            }}
            placeholder="Se agrega al informe cuando guardás los cambios."
          />
        </div>
      </Seccion>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          disabled={ocupado}
          onClick={() => setConfirmEliminar(true)}
        >
          Eliminar informe
        </button>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={BTN_PRIMARIO} disabled={ocupado} onClick={onGuardar}>
            {accion === "guardar" ? "Guardando..." : "Guardar cambios"}
          </button>
          <button type="button" className={BTN_SECUNDARIO} disabled={ocupado} onClick={onPdf}>
            {accion === "pdf" ? "Generando..." : "Descargar PDF"}
          </button>
        </div>
      </div>

      <SelectorMaquinasModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onConfirm={agregarMaquinas}
        maquinasDelServicio={informe.maquinasDelServicio || []}
        yaSeleccionadas={idsMaquinas}
        headers={headers}
      />

      <ConfirmModal
        open={confirmEliminar}
        title="Eliminar informe"
        message="El informe dejará de aparecer en el listado. ¿Querés continuar?"
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setConfirmEliminar(false)}
        onConfirm={eliminar}
      />
    </div>
  );
}
