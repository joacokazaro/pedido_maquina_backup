import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { toDateInputValue } from "../utils/date";
import { REQUEST_RESOURCE_TYPES } from "../constants/maquinas";

const ESTILOS_ESTADO_PEDIDO = {
  CERRADO: "bg-slate-200 text-slate-700",
  CANCELADO: "bg-rose-100 text-rose-700",
};

function estiloEstadoPedido(estado) {
  return ESTILOS_ESTADO_PEDIDO[estado] || "bg-amber-100 text-amber-700";
}

const ESTADOS = ["activo", "finalizado", "cancelado"];

const TIPOS_TRABAJO = [
  { value: "PODA_MENOR_2M", label: "Poda < 2mtrs" },
  { value: "PODA_ALTURA", label: "Poda en altura" },
  { value: "RETIRO_PODA", label: "Retiro de poda" },
  { value: "DESMALEZADO", label: "Desmalezado" },
  { value: "DESMONTE", label: "Desmonte" },
  { value: "CORTE_CESPED", label: "Corte de cesped" },
  { value: "CORTE_BARRIDO", label: "Corte y barrido" },
  { value: "OTRO", label: "Otro" },
];

const UNIDADES = [
  { value: "UNIDAD", label: "Unidad" },
  { value: "M2", label: "M2" },
  { value: "M3", label: "M3" },
  { value: "METROS_LINEALES", label: "Metros lineales" },
  { value: "HORAS", label: "Horas" },
];

const ESTADO_STYLES = {
  activo: {
    select: "border-emerald-300 bg-emerald-50 text-emerald-800",
    chip: "bg-emerald-100 text-emerald-800",
  },
  finalizado: {
    select: "border-blue-300 bg-blue-50 text-blue-800",
    chip: "bg-blue-100 text-blue-800",
  },
  cancelado: {
    select: "border-rose-300 bg-rose-50 text-rose-800",
    chip: "bg-rose-100 text-rose-800",
  },
};

function emptyVehiculoRow() {
  return { vehiculoId: "" };
}

function emptyTrabajo() {
  return { tipo: "", label: "", descripcionOtro: "", cantidad: "", unidadMedida: "", unidadLabel: "" };
}

function emptyServicioExtra() {
  return { descripcion: "", cantidad: "", unidadMedida: "", unidadLabel: "" };
}

export default function AdminEventualForm({ modoFinalizacionCoordinador = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const userRolUpper = String(user?.rol || "").toUpperCase();
  const isCoordinadorFinalizacion = Boolean(modoFinalizacionCoordinador && userRolUpper === "COORDINADOR" && isEdit);
  const mostrarComponentes = isEdit || isCoordinadorFinalizacion;
  const mostrarCamposPosteriores = isEdit || isCoordinadorFinalizacion;

  const [form, setForm] = useState({
    nombre: "",
    supervisorId: "",
    estado: "activo",
    fechaInicio: "",
    fechaFin: "",
    observaciones: "",
    observacionesPosteriores: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [supervisores, setSupervisores] = useState([]);
  const [vehiculosCatalogo, setVehiculosCatalogo] = useState([]);

  // Filas guardadas en el eventual ({ tipo, cantidad, maquinaIds }) y selección puntual de máquinas
  const [maquinasRows, setMaquinasRows] = useState([]);
  const [maquinasSeleccionadas, setMaquinasSeleccionadas] = useState([]);
  const [vehiculosRows, setVehiculosRows] = useState([emptyVehiculoRow()]);
  const [legacyComponentes, setLegacyComponentes] = useState(null);

  // Recursos del supervisor asignado (máquinas por servicios + vehículos a cargo)
  const [supervisorMaquinas, setSupervisorMaquinas] = useState([]);
  const [supervisorVehiculos, setSupervisorVehiculos] = useState([]);
  const [cargandoRecursos, setCargandoRecursos] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [seleccionTemp, setSeleccionTemp] = useState(() => new Set());
  const [busquedaMaquina, setBusquedaMaquina] = useState("");
  const prefillVehiculosRef = useRef(false);

  // Pedidos complementarios disparados desde el eventual
  const [tiposMaquina, setTiposMaquina] = useState([]);
  const [pedidosComplementarios, setPedidosComplementarios] = useState([]);
  const [maquinasDePedidos, setMaquinasDePedidos] = useState([]);
  const [pedidoModalOpen, setPedidoModalOpen] = useState(false);
  const [pedidoCantidades, setPedidoCantidades] = useState({});
  const [pedidoOtroTipo, setPedidoOtroTipo] = useState("");
  const [pedidoOtroCantidad, setPedidoOtroCantidad] = useState(1);
  const [pedidoOtros, setPedidoOtros] = useState([]);
  const [pedidoDestino, setPedidoDestino] = useState("DEPOSITO");
  const [pedidoSupervisorDestino, setPedidoSupervisorDestino] = useState("");
  const [pedidoObservacion, setPedidoObservacion] = useState("");
  const [pedidoCreando, setPedidoCreando] = useState(false);
  const [pedidoError, setPedidoError] = useState("");
  const [pedidoExito, setPedidoExito] = useState("");

  const [trabajosRealizados, setTrabajosRealizados] = useState([]);
  const [serviciosExtrasSubcontratados, setServiciosExtrasSubcontratados] = useState([]);
  const [observacionesPosterioresRegistradas, setObservacionesPosterioresRegistradas] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const requests = [
          fetch(`${API_BASE}/admin/eventuales/componentes/catalogo`),
          fetch(`${API_BASE}/supervisores/catalogo`),
        ];

        if (isEdit) {
          requests.unshift(fetch(`${API_BASE}/admin/eventuales/${encodeURIComponent(id)}`));
        }

        const responses = await Promise.all(requests);
        if (responses.some((response) => !response.ok)) {
          throw new Error("No se pudieron cargar los datos");
        }

        const payloads = await Promise.all(responses.map((response) => response.json()));
        const eventual = isEdit ? payloads[0] : null;
        const catalogo = isEdit ? payloads[1] : payloads[0];
        const supervisoresData = isEdit ? payloads[2] : payloads[1];

        setVehiculosCatalogo(Array.isArray(catalogo?.vehiculos) ? catalogo.vehiculos : []);
        setTiposMaquina(Array.isArray(catalogo?.tiposMaquina) ? catalogo.tiposMaquina : []);
        setSupervisores(Array.isArray(supervisoresData) ? supervisoresData : []);

        if (eventual) {
          const observacionesPosteriores = (Array.isArray(eventual.historial) ? eventual.historial : [])
            .filter((entry) => ["ADMIN_OBSERVACION_POSTERIOR", "COORDINADOR_OBSERVACION_POSTERIOR"].includes(entry?.accion))
            .map((entry) => ({
              id: entry.id,
              fecha: entry.fecha,
              usuario: entry.usuario?.nombre || entry.usuario?.username || "-",
              observacion: String(entry?.detalle?.observacion || "").trim(),
            }))
            .filter((entry) => entry.observacion)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

          setForm({
            nombre: eventual.nombre || "",
            supervisorId: eventual.supervisor?.id ? String(eventual.supervisor.id) : "",
            estado: eventual.estado || "activo",
            fechaInicio: toDateInputValue(eventual.fechaInicio),
            fechaFin: toDateInputValue(eventual.fechaFin),
            observaciones: eventual.observaciones || "",
            observacionesPosteriores: "",
          });

          const maquinas = Array.isArray(eventual.componentesActuales?.maquinasUtilizadas)
            ? eventual.componentesActuales.maquinasUtilizadas
            : [];
          const vehiculoIds = Array.isArray(eventual.componentesActuales?.vehiculoIds)
            ? eventual.componentesActuales.vehiculoIds
            : [];

          const rowsGuardadas = maquinas
            .filter((item) => item?.tipo)
            .map((item) => ({
              tipo: item.tipo,
              cantidad: Number(item.cantidad) || 0,
              maquinaIds: Array.isArray(item.maquinaIds) ? item.maquinaIds : [],
            }));
          setMaquinasRows(rowsGuardadas);
          setMaquinasSeleccionadas(
            rowsGuardadas.flatMap((row) => row.maquinaIds.map((maquinaId) => ({ id: maquinaId, tipo: row.tipo })))
          );
          setVehiculosRows(vehiculoIds.length > 0 ? vehiculoIds.map((vehiculoId) => ({ vehiculoId })) : [emptyVehiculoRow()]);

          // Si el eventual ya tiene supervisor pero todavía no cargó vehículos,
          // precargamos los que ese supervisor tiene asignados.
          if (eventual.supervisor?.id && vehiculoIds.length === 0) {
            prefillVehiculosRef.current = true;
          }

          setPedidosComplementarios(Array.isArray(eventual.pedidosComplementarios) ? eventual.pedidosComplementarios : []);
          setMaquinasDePedidos(Array.isArray(eventual.maquinasDePedidos) ? eventual.maquinasDePedidos : []);

          setLegacyComponentes(eventual.legacyComponentes || null);
          setTrabajosRealizados(Array.isArray(eventual.trabajosRealizados) ? eventual.trabajosRealizados : []);
          setServiciosExtrasSubcontratados(Array.isArray(eventual.serviciosExtrasSubcontratados) ? eventual.serviciosExtrasSubcontratados : []);
          setObservacionesPosterioresRegistradas(observacionesPosteriores);
        }
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message || "Error cargando eventual");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, isEdit]);

  // Máquinas (por servicios asignados) y vehículos del supervisor elegido
  useEffect(() => {
    if (!mostrarComponentes) return undefined;

    if (!form.supervisorId) {
      setSupervisorMaquinas([]);
      setSupervisorVehiculos([]);
      return undefined;
    }

    let cancelado = false;

    async function loadRecursosSupervisor() {
      try {
        setCargandoRecursos(true);
        const [maquinasRes, vehiculosRes] = await Promise.all([
          fetch(`${API_BASE}/supervisores/${encodeURIComponent(form.supervisorId)}/maquinas`),
          fetch(`${API_BASE}/supervisores/${encodeURIComponent(form.supervisorId)}/vehiculos`),
        ]);
        const maquinasData = maquinasRes.ok ? await maquinasRes.json() : null;
        const vehiculosData = vehiculosRes.ok ? await vehiculosRes.json() : null;
        if (cancelado) return;

        setSupervisorMaquinas(Array.isArray(maquinasData?.maquinasFijas) ? maquinasData.maquinasFijas : []);

        const vehiculosSupervisor = Array.isArray(vehiculosData?.vehiculos) ? vehiculosData.vehiculos : [];
        setSupervisorVehiculos(vehiculosSupervisor);

        if (prefillVehiculosRef.current) {
          prefillVehiculosRef.current = false;
          setVehiculosRows(
            vehiculosSupervisor.length > 0
              ? vehiculosSupervisor.map((vehiculo) => ({ vehiculoId: vehiculo.id }))
              : [emptyVehiculoRow()]
          );
        }
      } catch (recursosError) {
        console.error(recursosError);
      } finally {
        if (!cancelado) setCargandoRecursos(false);
      }
    }

    loadRecursosSupervisor();
    return () => {
      cancelado = true;
    };
  }, [form.supervisorId, mostrarComponentes]);

  const vehiculosOptions = useMemo(() => {
    return vehiculosCatalogo.map((item) => ({
      value: item.id,
      label: `${item.vehiculo} ${item.id} · ${item.patente || "sin patente"}`,
    }));
  }, [vehiculosCatalogo]);

  // Resumen "Tipo de máquina: cantidad" (conservando qué máquinas se eligieron)
  const resumenMaquinas = useMemo(() => {
    if (maquinasSeleccionadas.length > 0) {
      const grupos = new Map();
      for (const maquina of maquinasSeleccionadas) {
        const key = maquina.tipo || "Sin tipo";
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key).push(maquina.id);
      }
      return Array.from(grupos.entries())
        .map(([tipo, ids]) => ({ tipo, cantidad: ids.length, maquinaIds: ids }))
        .sort((a, b) => a.tipo.localeCompare(b.tipo));
    }

    return maquinasRows.map((row) => ({
      tipo: row.tipo,
      cantidad: row.cantidad,
      maquinaIds: Array.isArray(row.maquinaIds) ? row.maquinaIds : [],
    }));
  }, [maquinasSeleccionadas, maquinasRows]);

  const maquinasModalGrupos = useMemo(() => {
    const term = busquedaMaquina.trim().toLowerCase();
    const filtradas = supervisorMaquinas.filter((maquina) => {
      if (!term) return true;
      return [maquina.id, maquina.tipo, maquina.modelo, maquina.serie, maquina.servicio?.nombre]
        .some((valor) => String(valor || "").toLowerCase().includes(term));
    });

    const grupos = new Map();
    for (const maquina of filtradas) {
      const key = maquina.tipo || "Sin tipo";
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(maquina);
    }
    return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [supervisorMaquinas, busquedaMaquina]);

  const estadoStyles = ESTADO_STYLES[form.estado] || {
    select: "border-slate-300 bg-slate-50 text-slate-800",
    chip: "bg-slate-100 text-slate-800",
  };

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSupervisorChange(value) {
    updateField("supervisorId", value);
    if (mostrarComponentes) {
      // Las máquinas seleccionadas pertenecen al supervisor anterior
      setMaquinasSeleccionadas([]);
      setMaquinasRows([]);
      prefillVehiculosRef.current = Boolean(value);
    }
  }

  function abrirSelectorMaquinas() {
    setSeleccionTemp(new Set(maquinasSeleccionadas.map((maquina) => maquina.id)));
    setBusquedaMaquina("");
    setSelectorOpen(true);
  }

  function toggleSeleccionMaquina(maquinaId) {
    setSeleccionTemp((prev) => {
      const next = new Set(prev);
      if (next.has(maquinaId)) next.delete(maquinaId);
      else next.add(maquinaId);
      return next;
    });
  }

  function toggleGrupoMaquinas(maquinasGrupo) {
    setSeleccionTemp((prev) => {
      const next = new Set(prev);
      const todasSeleccionadas = maquinasGrupo.every((maquina) => next.has(maquina.id));
      maquinasGrupo.forEach((maquina) => {
        if (todasSeleccionadas) next.delete(maquina.id);
        else next.add(maquina.id);
      });
      return next;
    });
  }

  function guardarSeleccionMaquinas() {
    setMaquinasSeleccionadas(
      supervisorMaquinas
        .filter((maquina) => seleccionTemp.has(maquina.id))
        .map((maquina) => ({ id: maquina.id, tipo: maquina.tipo }))
    );
    setSelectorOpen(false);
  }

  /* =========================
     PEDIDO COMPLEMENTARIO
  ========================== */
  const supervisorAsignado = supervisores.find(
    (supervisor) => String(supervisor.id) === String(form.supervisorId)
  );

  // El pedido se crea a nombre del supervisor seleccionado en el formulario,
  // de manera dinámica (igual que sus máquinas y vehículos).
  const puedeCrearPedido = isEdit && Boolean(form.supervisorId);

  // Con pedidos complementarios disparados, el supervisor queda fijado
  const supervisorBloqueado = pedidosComplementarios.length > 0;

  function abrirPedidoModal() {
    setPedidoCantidades(
      REQUEST_RESOURCE_TYPES.reduce((acc, tipo) => {
        acc[tipo] = 0;
        return acc;
      }, {})
    );
    setPedidoOtros([]);
    setPedidoOtroTipo("");
    setPedidoOtroCantidad(1);
    setPedidoDestino("DEPOSITO");
    setPedidoSupervisorDestino("");
    setPedidoObservacion("");
    setPedidoError("");
    setPedidoModalOpen(true);
  }

  function cambiarPedidoCantidad(tipo, delta) {
    setPedidoCantidades((prev) => ({
      ...prev,
      [tipo]: Math.max(0, (prev[tipo] || 0) + delta),
    }));
  }

  function agregarPedidoOtro() {
    if (!pedidoOtroTipo) {
      setPedidoError('Seleccioná un tipo para "Otro".');
      return;
    }
    setPedidoError("");
    setPedidoOtros((prev) => {
      const existente = prev.find((item) => item.tipo === pedidoOtroTipo);
      if (existente) {
        return prev.map((item) =>
          item.tipo === pedidoOtroTipo
            ? { ...item, cantidad: Number(item.cantidad) + Number(pedidoOtroCantidad || 1) }
            : item
        );
      }
      return [...prev, { tipo: pedidoOtroTipo, cantidad: Number(pedidoOtroCantidad || 1) }];
    });
    setPedidoOtroTipo("");
    setPedidoOtroCantidad(1);
  }

  async function refreshPedidosComplementarios() {
    try {
      const res = await fetch(`${API_BASE}/admin/eventuales/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setPedidosComplementarios(Array.isArray(data.pedidosComplementarios) ? data.pedidosComplementarios : []);
      setMaquinasDePedidos(Array.isArray(data.maquinasDePedidos) ? data.maquinasDePedidos : []);
    } catch (refreshError) {
      console.error(refreshError);
    }
  }

  async function crearPedidoComplementario() {
    const items = Object.entries(pedidoCantidades)
      .filter(([, cantidad]) => cantidad > 0)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }));

    pedidoOtros.forEach((item) => {
      if (item.tipo && Number(item.cantidad) > 0) {
        items.push({ tipo: item.tipo, cantidad: Number(item.cantidad) });
      }
    });

    if (items.length === 0) {
      setPedidoError("Seleccioná al menos 1 máquina para pedir.");
      return;
    }
    if (pedidoDestino === "SUPERVISOR" && !pedidoSupervisorDestino) {
      setPedidoError("Seleccioná el supervisor destino.");
      return;
    }
    if (!supervisorAsignado?.username) {
      setPedidoError("El eventual no tiene un supervisor asignado válido.");
      return;
    }

    try {
      setPedidoCreando(true);
      setPedidoError("");

      const res = await fetch(`${API_BASE}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorUsername: supervisorAsignado.username,
          itemsSolicitados: items,
          observacion: pedidoObservacion.trim() || null,
          destino: pedidoDestino,
          supervisorDestinoUsername: pedidoDestino === "SUPERVISOR" ? pedidoSupervisorDestino : null,
          eventualId: Number(id),
          actorUsername: user?.username,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error creando el pedido complementario");
      }

      setPedidoModalOpen(false);
      setPedidoExito(`Pedido complementario ${data.pedido?.id || ""} creado a nombre de ${supervisorAsignado.nombre || supervisorAsignado.username}.`);
      await refreshPedidosComplementarios();
    } catch (pedidoCrearError) {
      console.error(pedidoCrearError);
      setPedidoError(pedidoCrearError.message || "Error creando el pedido complementario");
    } finally {
      setPedidoCreando(false);
    }
  }

  function updateVehiculoRow(index, value) {
    setVehiculosRows((prev) => prev.map((row, i) => (i === index ? { ...row, vehiculoId: value } : row)));
  }

  function addVehiculoRow() {
    setVehiculosRows((prev) => [...prev, emptyVehiculoRow()]);
  }

  function removeVehiculoRow(index) {
    setVehiculosRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function updateTrabajo(index, key, value) {
    setTrabajosRealizados((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function addTrabajo() {
    setTrabajosRealizados((prev) => [...prev, emptyTrabajo()]);
  }

  function removeTrabajo(index) {
    setTrabajosRealizados((prev) => prev.filter((_, i) => i !== index));
  }

  function updateServicio(index, key, value) {
    setServiciosExtrasSubcontratados((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function addServicio() {
    setServiciosExtrasSubcontratados((prev) => [...prev, emptyServicioExtra()]);
  }

  function removeServicio(index) {
    setServiciosExtrasSubcontratados((prev) => prev.filter((_, i) => i !== index));
  }

  function normalizePayload() {
    const maquinasUtilizadas = resumenMaquinas
      .filter((grupo) => grupo.tipo)
      .map((grupo) => ({
        tipo: String(grupo.tipo).trim(),
        cantidad: Number(grupo.cantidad),
        ...(grupo.maquinaIds.length > 0 ? { maquinaIds: grupo.maquinaIds } : {}),
      }));

    const vehiculoIds = vehiculosRows
      .map((row) => String(row.vehiculoId || "").trim())
      .filter(Boolean);

    const trabajos = trabajosRealizados.map((row) => ({
      ...row,
      label: TIPOS_TRABAJO.find((t) => t.value === row.tipo)?.label || row.label || row.tipo,
      unidadLabel: UNIDADES.find((u) => u.value === row.unidadMedida)?.label || row.unidadLabel || row.unidadMedida,
      cantidad: Number(row.cantidad),
    }));

    const servicios = serviciosExtrasSubcontratados.map((row) => ({
      ...row,
      unidadLabel: UNIDADES.find((u) => u.value === row.unidadMedida)?.label || row.unidadLabel || row.unidadMedida,
      cantidad: Number(row.cantidad),
    }));

    return {
      usuario: user?.username,
      nombre: form.nombre,
      supervisorId: form.supervisorId ? Number(form.supervisorId) : null,
      estado: form.estado,
      fechaInicio: form.fechaInicio || null,
      fechaFin: form.fechaFin || null,
      observaciones: form.observaciones,
      observacionesPosteriores: isEdit ? String(form.observacionesPosteriores || "").trim() : undefined,
      maquinasUtilizadas,
      vehiculoIds,
      trabajosRealizados: mostrarCamposPosteriores ? trabajos : undefined,
      serviciosExtrasSubcontratados: mostrarCamposPosteriores ? servicios : undefined,
    };
  }

  function requestSubmit() {
    const requiereSupervisor =
      isCoordinadorFinalizacion ||
      (mostrarCamposPosteriores && (resumenMaquinas.length > 0 || trabajosRealizados.length > 0));

    if (requiereSupervisor && !form.supervisorId) {
      setError("Tenés que asignar un supervisor para completar maquinaria utilizada y trabajos realizados.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (form.estado === "finalizado" && !form.fechaFin) {
      setError("Para finalizar el eventual tenés que indicar la fecha de finalización.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setError("");
    setConfirmOpen(true);
  }

  async function submit() {
    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        isEdit ? `${API_BASE}/admin/eventuales/${encodeURIComponent(id)}` : `${API_BASE}/admin/eventuales`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(normalizePayload()),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "No se pudo guardar el eventual");
      }

      setConfirmOpen(false);
      navigate(isEdit ? `/admin/eventuales/${id}` : "/admin/eventuales/historial");
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || "Error guardando eventual");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Cargando eventual...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
      >
        ← Volver
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isCoordinadorFinalizacion ? "Finalizar eventual" : isEdit ? "Completar datos de eventual" : "Nuevo eventual"}
          </h1>
          <p className="text-sm text-gray-600">
            {isEdit
              ? "Podés completar los datos del eventual y registrar observaciones posteriores."
              : "Completá la información base. Los trabajos y servicios extras se cargan después."}
          </p>
        </div>
        {isEdit ? (
          <button
            type="button"
            onClick={() => navigate(`/admin/eventuales/${id}`)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            Ver detalle
          </button>
        ) : null}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div> : null}

      <section className="overflow-hidden rounded-3xl border-2 border-slate-300/70 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b-2 border-slate-200 bg-slate-100/80 px-4 py-3 sm:px-5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-white">1</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-800">Datos del eventual</h2>
            <p className="text-xs text-slate-500">Nombre, supervisor, estado, fechas y observaciones.</p>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
            <input
              className="w-full rounded-xl border p-3 text-sm"
              value={form.nombre}
              onChange={(event) => updateField("nombre", event.target.value)}
              disabled={isCoordinadorFinalizacion}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Supervisor asignado{mostrarComponentes ? "" : " (opcional)"}
            </label>
            <select
              className="w-full rounded-xl border p-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              value={form.supervisorId}
              onChange={(event) => handleSupervisorChange(event.target.value)}
              disabled={supervisorBloqueado}
            >
              <option value="">Sin asignar</option>
              {supervisores.map((supervisor) => (
                <option key={supervisor.id} value={String(supervisor.id)}>
                  {supervisor.nombre || supervisor.username}
                </option>
              ))}
            </select>
            {supervisorBloqueado ? (
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                El supervisor quedó fijado: el eventual ya tiene pedidos complementarios disparados.
              </p>
            ) : mostrarComponentes && !form.supervisorId ? (
              <p className="mt-1 text-xs font-medium text-amber-600">
                Asigná un supervisor para poder completar maquinaria utilizada y trabajos realizados.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
            <div className="space-y-2">
              <select
                className={`w-full rounded-xl border p-3 text-sm font-semibold uppercase ${estadoStyles.select}`}
                value={form.estado}
                onChange={(event) => updateField("estado", event.target.value)}
              >
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>{estado}</option>
                ))}
              </select>
              <p className="text-xs text-gray-600">Definí si el eventual queda activo, finalizado o cancelado.</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha inicio</label>
            <input type="date" className="w-full rounded-xl border p-3 text-sm" value={form.fechaInicio} onChange={(event) => updateField("fechaInicio", event.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fecha fin{form.estado === "finalizado" ? " (obligatoria para finalizar)" : ""}
            </label>
            <input
              type="date"
              className={`w-full rounded-xl border p-3 text-sm ${
                form.estado === "finalizado" && !form.fechaFin ? "border-amber-400 bg-amber-50" : ""
              }`}
              value={form.fechaFin}
              onChange={(event) => updateField("fechaFin", event.target.value)}
            />
            {form.estado === "finalizado" && !form.fechaFin ? (
              <p className="mt-1 text-xs font-medium text-amber-600">
                Para finalizar el eventual es obligatorio indicar la fecha de finalización.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones previas</label>
          <textarea
            rows={4}
            className="w-full rounded-xl border p-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            value={form.observaciones}
            onChange={(event) => updateField("observaciones", event.target.value)}
            disabled={isEdit || isCoordinadorFinalizacion}
          />
          {isEdit || isCoordinadorFinalizacion ? (
            <p className="mt-1 text-xs text-slate-500">
              Las observaciones previas solo se registran al crear el eventual.
            </p>
          ) : null}
        </div>

        {isEdit ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones posteriores</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border p-3 text-sm"
              value={form.observacionesPosteriores}
              onChange={(event) => updateField("observacionesPosteriores", event.target.value)}
            />

            {observacionesPosterioresRegistradas.length > 0 ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Observaciones posteriores ya registradas</p>
                <div className="space-y-2">
                  {observacionesPosterioresRegistradas.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <p className="text-xs text-slate-500">{item.usuario} · {new Date(item.fecha).toLocaleString("es-AR")}</p>
                      <p className="mt-1 whitespace-pre-line text-slate-700">{item.observacion}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      </section>

      {mostrarComponentes ? (
      <section className="overflow-hidden rounded-3xl border-2 border-blue-300/70 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b-2 border-blue-200 bg-blue-50 px-4 py-3 sm:px-5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">2</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-blue-900">Maquinaria utilizada</h2>
            <p className="text-xs text-blue-700/70">Máquinas y vehículos empleados en el eventual.</p>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">

      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/60 to-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Máquinas utilizadas</h2>
            <p className="text-xs text-gray-500">
              {form.supervisorId
                ? "Seleccioná máquinas del supervisor asignado. El resumen se arma por tipo."
                : "Asigná un supervisor para ver y seleccionar sus máquinas."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={abrirSelectorMaquinas}
              disabled={!form.supervisorId || cargandoRecursos}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 11l3 3 8-8" />
                <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
              </svg>
              {cargandoRecursos ? "Cargando máquinas..." : "Seleccionar máquinas"}
            </button>
            <button
              type="button"
              onClick={abrirPedidoModal}
              disabled={!puedeCrearPedido}
              title={!form.supervisorId ? "Asigná un supervisor para crear un pedido complementario" : ""}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Crear pedido complementario
            </button>
          </div>
        </div>

        {pedidoExito ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <span>{pedidoExito}</span>
            <button type="button" onClick={() => setPedidoExito("")} className="text-xs font-semibold text-emerald-600 hover:text-emerald-800">
              Cerrar
            </button>
          </div>
        ) : null}

        {resumenMaquinas.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-blue-200 bg-white/60 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-600">Sin máquinas seleccionadas</p>
            <p className="mt-1 text-xs text-slate-400">
              {form.supervisorId
                ? 'Usá "Seleccionar máquinas" para elegir las máquinas utilizadas en el eventual.'
                : "Primero asigná un supervisor en los datos del eventual."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {resumenMaquinas.map((grupo) => (
              <div
                key={grupo.tipo}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{grupo.tipo}</p>
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-600 px-2 text-sm font-bold text-white">
                    {grupo.cantidad}
                  </span>
                </div>
                {grupo.maquinaIds.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {grupo.maquinaIds.map((maquinaId) => (
                      <span
                        key={maquinaId}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                      >
                        {maquinaId}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-slate-400">Carga anterior sin detalle de máquinas.</p>
                )}
              </div>
            ))}
          </div>
        )}

        {maquinasDePedidos.length > 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Máquinas por pedidos complementarios
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-700/70">
              Asignadas en los pedidos del eventual: se suman al listado final de máquinas utilizadas.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {maquinasDePedidos.map((grupo) => (
                <div key={`ped-${grupo.tipo}`} className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{grupo.tipo}</p>
                    <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-600 px-2 text-sm font-bold text-white">
                      {grupo.cantidad}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {grupo.maquinaIds.map((maquinaId) => (
                      <span key={maquinaId} className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {maquinaId}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {pedidosComplementarios.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pedidos complementarios del eventual</p>
            <div className="mt-2 space-y-2">
              {pedidosComplementarios.map((pedido) => (
                <div key={pedido.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{pedido.id}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${estiloEstadoPedido(pedido.estado)}`}>
                      {pedido.estado.replaceAll("_", " ")}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {pedido.maquinas.length > 0
                      ? `${pedido.maquinas.length} máquina${pedido.maquinas.length === 1 ? "" : "s"} asignada${pedido.maquinas.length === 1 ? "" : "s"}`
                      : "Sin máquinas asignadas aún"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-4 shadow space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vehículos utilizados</h2>
            <p className="text-xs text-gray-500">
              {form.supervisorId
                ? "Se cargan los vehículos asignados al supervisor. Podés cambiarlos o agregar más."
                : "Podés cargar cualquier vehículo del catálogo."}
            </p>
          </div>
          <button type="button" onClick={addVehiculoRow} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700">
            Agregar vehículo
          </button>
        </div>

        {vehiculosRows.map((row, index) => {
          const esDelSupervisor = supervisorVehiculos.some((vehiculo) => vehiculo.id === row.vehiculoId);
          return (
            <div key={`veh-${index}`} className="grid items-center gap-2 md:grid-cols-[1fr_auto_auto]">
              <select
                className="rounded-xl border p-2.5 text-sm"
                value={row.vehiculoId}
                onChange={(event) => updateVehiculoRow(index, event.target.value)}
              >
                <option value="">Seleccionar vehiculo</option>
                {vehiculosOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {esDelSupervisor ? (
                <span className="justify-self-start rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 md:justify-self-auto">
                  Del supervisor
                </span>
              ) : (
                <span className="hidden md:block" />
              )}
              <button
                type="button"
                onClick={() => removeVehiculoRow(index)}
                className="justify-self-end rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
              >
                Quitar
              </button>
            </div>
          );
        })}
      </div>
        </div>
      </section>
      ) : null}

      {!mostrarCamposPosteriores ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Maquinaria, trabajos realizados y servicios extras se cargan después, al completar los datos o finalizar el eventual.
        </div>
      ) : null}

      {mostrarCamposPosteriores ? (
      <section className="overflow-hidden rounded-3xl border-2 border-violet-300/70 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b-2 border-violet-200 bg-violet-50 px-4 py-3 sm:px-5">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">3</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-violet-900">Detalle de trabajos realizados</h2>
            <p className="text-xs text-violet-700/70">Trabajos ejecutados y servicios extras subcontratados.</p>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">

      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/60 to-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Trabajos realizados</h2>
            {!form.supervisorId ? (
              <p className="text-xs font-medium text-amber-600">
                Asigná un supervisor para poder cargar trabajos realizados.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={addTrabajo}
            disabled={!form.supervisorId}
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Agregar trabajo
          </button>
        </div>

        {trabajosRealizados.length === 0 ? <p className="text-sm text-gray-500">Sin trabajos cargados.</p> : null}

        {trabajosRealizados.map((row, index) => (
          <div key={`tra-${index}`} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trabajo {index + 1}</span>
              <button type="button" onClick={() => removeTrabajo(index)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
                Quitar trabajo
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <select className="rounded-xl border p-2.5 text-sm" value={row.tipo} onChange={(event) => updateTrabajo(index, "tipo", event.target.value)}>
                <option value="">Tipo</option>
                {TIPOS_TRABAJO.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <input type="number" min="1" className="rounded-xl border p-2.5 text-sm" placeholder="Cantidad" value={row.cantidad} onChange={(event) => updateTrabajo(index, "cantidad", event.target.value)} />
              <select className="rounded-xl border p-2.5 text-sm" value={row.unidadMedida} onChange={(event) => updateTrabajo(index, "unidadMedida", event.target.value)}>
                <option value="">Unidad</option>
                {UNIDADES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            {row.tipo === "OTRO" ? (
              <input className="w-full rounded-xl border p-2.5 text-sm" placeholder="Descripcion" value={row.descripcionOtro || ""} onChange={(event) => updateTrabajo(index, "descripcionOtro", event.target.value)} />
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/60 to-white p-4 shadow space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Servicios extras subcontratados</h2>
          <button type="button" onClick={addServicio} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">
            Agregar servicio
          </button>
        </div>

        {serviciosExtrasSubcontratados.length === 0 ? <p className="text-sm text-gray-500">Sin servicios cargados.</p> : null}

        {serviciosExtrasSubcontratados.map((row, index) => (
          <div key={`srv-${index}`} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servicio extra {index + 1}</span>
              <button type="button" onClick={() => removeServicio(index)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700">
                Quitar servicio
              </button>
            </div>

            <input className="w-full rounded-xl border p-2.5 text-sm" placeholder="Descripcion" value={row.descripcion || ""} onChange={(event) => updateServicio(index, "descripcion", event.target.value)} />
            <div className="grid gap-2 md:grid-cols-2">
              <input type="number" min="1" className="rounded-xl border p-2.5 text-sm" placeholder="Cantidad" value={row.cantidad} onChange={(event) => updateServicio(index, "cantidad", event.target.value)} />
              <select className="rounded-xl border p-2.5 text-sm" value={row.unidadMedida} onChange={(event) => updateServicio(index, "unidadMedida", event.target.value)}>
                <option value="">Unidad</option>
                {UNIDADES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
        </div>
      </section>
      ) : null}

      {legacyComponentes ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Datos legados de componentes (solo lectura)</p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">
            {JSON.stringify(legacyComponentes, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
          Cancelar
        </button>
        <button onClick={requestSubmit} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-blue-300">
          {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear eventual"}
        </button>
      </div>

      {pedidoModalOpen ? createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          onClick={() => !pedidoCreando && setPedidoModalOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Crear pedido complementario</h3>
                <p className="text-xs text-slate-500">
                  El pedido se crea a nombre de{" "}
                  <b>{supervisorAsignado?.nombre || supervisorAsignado?.username || "-"}</b> y sigue el circuito
                  normal de pedidos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPedidoModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">Servicio del pedido</p>
                <p className="mt-0.5 text-sm font-semibold text-blue-900">{form.nombre || "Eventual"}</p>
                <p className="text-[11px] text-blue-700/70">
                  Fijado automáticamente: es el eventual para el cual se está pidiendo. No se puede modificar.
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">¿A quién se le hace el pedido?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPedidoDestino("DEPOSITO");
                      setPedidoSupervisorDestino("");
                    }}
                    className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${
                      pedidoDestino === "DEPOSITO"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Depósito
                  </button>
                  <button
                    type="button"
                    onClick={() => setPedidoDestino("SUPERVISOR")}
                    className={`rounded-xl border p-3 text-left text-sm font-semibold transition ${
                      pedidoDestino === "SUPERVISOR"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Otro supervisor
                  </button>
                </div>
              </div>

              {pedidoDestino === "SUPERVISOR" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Supervisor destino *</label>
                  <select
                    className="w-full rounded-xl border p-2.5 text-sm"
                    value={pedidoSupervisorDestino}
                    onChange={(event) => setPedidoSupervisorDestino(event.target.value)}
                  >
                    <option value="">Seleccionar supervisor destino</option>
                    {supervisores
                      .filter((supervisor) => supervisor.username !== supervisorAsignado?.username)
                      .map((supervisor) => (
                        <option key={supervisor.id} value={supervisor.username}>
                          {supervisor.nombre || supervisor.username}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Máquinas solicitadas</p>
                <div className="space-y-2">
                  {REQUEST_RESOURCE_TYPES.map((tipo) => (
                    <div key={tipo} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-sm font-semibold text-slate-800">{tipo}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => cambiarPedidoCantidad(tipo, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-lg text-slate-600 transition hover:bg-slate-50"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-base font-bold text-slate-900">{pedidoCantidades[tipo] || 0}</span>
                        <button
                          type="button"
                          onClick={() => cambiarPedidoCantidad(tipo, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-lg text-white transition hover:bg-blue-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">Otro tipo de máquina</p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="min-w-0 flex-1 rounded-xl border p-2.5 text-sm"
                    value={pedidoOtroTipo}
                    onChange={(event) => setPedidoOtroTipo(event.target.value)}
                  >
                    <option value="">Seleccionar tipo</option>
                    {tiposMaquina.map((item) => (
                      <option key={item.tipo} value={item.tipo}>{item.tipo}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPedidoOtroCantidad((c) => Math.max(1, (c || 1) - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-lg text-slate-600"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{pedidoOtroCantidad}</span>
                    <button
                      type="button"
                      onClick={() => setPedidoOtroCantidad((c) => (c || 1) + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-lg text-white"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={agregarPedidoOtro}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
                    >
                      Agregar
                    </button>
                  </div>
                </div>

                {pedidoOtros.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {pedidoOtros.map((item, index) => (
                      <div key={`${item.tipo}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
                        <span className="font-medium text-slate-800">{item.tipo} × {item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => setPedidoOtros((prev) => prev.filter((_, i) => i !== index))}
                          className="text-xs font-semibold text-red-600 hover:text-red-800"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones (fechas, motivos, etc.)</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border p-2.5 text-sm"
                  value={pedidoObservacion}
                  onChange={(event) => setPedidoObservacion(event.target.value)}
                  placeholder="Agregar comentarios acerca del pedido"
                />
              </div>

              {pedidoError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{pedidoError}</div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setPedidoModalOpen(false)}
                disabled={pedidoCreando}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={crearPedidoComplementario}
                disabled={pedidoCreando}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-emerald-300"
              >
                {pedidoCreando ? "Creando pedido..." : "Crear pedido"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {selectorOpen ? createPortal(
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          onClick={() => setSelectorOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Seleccionar máquinas</h3>
                <p className="text-xs text-slate-500">
                  Máquinas asociadas a los servicios de{" "}
                  <b>
                    {supervisores.find((s) => String(s.id) === String(form.supervisorId))?.nombre ||
                      supervisores.find((s) => String(s.id) === String(form.supervisorId))?.username ||
                      "supervisor"}
                  </b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectorOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="border-b border-slate-100 px-5 py-3">
              <input
                value={busquedaMaquina}
                onChange={(event) => setBusquedaMaquina(event.target.value)}
                placeholder="Buscar por ID, tipo, modelo, serie o servicio..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
              />
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {supervisorMaquinas.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  El supervisor no tiene máquinas asociadas a sus servicios.
                </p>
              ) : maquinasModalGrupos.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No hay máquinas que coincidan con la búsqueda.
                </p>
              ) : (
                maquinasModalGrupos.map(([tipo, maquinasGrupo]) => {
                  const seleccionadasGrupo = maquinasGrupo.filter((maquina) => seleccionTemp.has(maquina.id)).length;
                  const todasSeleccionadas = seleccionadasGrupo === maquinasGrupo.length;
                  return (
                    <div key={tipo}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {tipo}{" "}
                          <span className="font-semibold normal-case text-slate-400">
                            ({seleccionadasGrupo}/{maquinasGrupo.length})
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleGrupoMaquinas(maquinasGrupo)}
                          className="text-xs font-semibold text-blue-600 transition hover:text-blue-800"
                        >
                          {todasSeleccionadas ? "Quitar todas" : "Seleccionar todas"}
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {maquinasGrupo.map((maquina) => {
                          const seleccionada = seleccionTemp.has(maquina.id);
                          return (
                            <button
                              type="button"
                              key={maquina.id}
                              onClick={() => toggleSeleccionMaquina(maquina.id)}
                              className={`rounded-xl border p-3 text-left transition ${
                                seleccionada
                                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                                  : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-900">{maquina.id}</span>
                                <span
                                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-md border transition ${
                                    seleccionada
                                      ? "border-blue-600 bg-blue-600 text-white"
                                      : "border-slate-300 bg-white text-transparent"
                                  }`}
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M5 13l4 4L19 7" />
                                  </svg>
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {maquina.modelo}
                                {maquina.serie ? ` · Serie ${maquina.serie}` : ""}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                {maquina.servicio?.nombre || "Sin servicio"} · {maquina.estado}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3.5">
              <p className="text-sm font-medium text-slate-600">
                {seleccionTemp.size} máquina{seleccionTemp.size === 1 ? "" : "s"} seleccionada{seleccionTemp.size === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectorOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarSeleccionMaquinas}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Guardar selección
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        title={isEdit ? "Confirmar datos del eventual" : "Confirmar creación"}
        message={isEdit
          ? "Se guardarán los datos completados del eventual y se registrarán en el historial."
          : "Se creará el eventual con la información ingresada."}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submit}
        confirmLabel={saving ? "Guardando..." : isEdit ? "Guardar datos" : "Crear eventual"}
        cancelLabel="Cancelar"
      />
    </div>
  );
}
