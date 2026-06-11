import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import { toDateInputValue } from "../utils/date";

const ESTADOS = ["activo", "finalizado", "cancelado"];

const TIPOS_TRABAJO = [
  { value: "PODA_MENOR_2M", label: "Poda < 2mtrs" },
  { value: "PODA_ALTURA", label: "Poda en altura" },
  { value: "RETIRO_PODA", label: "Retiro de Poda" },
  { value: "DESMALEZADO", label: "Desmalezado" },
  { value: "DESMONTE", label: "Desmonte" },
  { value: "CORTE_CESPED", label: "Corte de Cesped" },
  { value: "CORTE_BARRIDO", label: "Corte y Barrido" },
  { value: "OTRO", label: "Otro" },
];

const UNIDADES_MEDIDA = [
  { value: "UNIDAD", label: "Unidad" },
  { value: "M2", label: "M2" },
  { value: "M3", label: "M3" },
  { value: "METROS_LINEALES", label: "Metros lineales" },
  { value: "HORAS", label: "Horas" },
];

function emptyTrabajo() {
  return { tipo: "", label: "", descripcionOtro: "", cantidad: "", unidadMedida: "", unidadLabel: "" };
}

function emptyServicioExtra() {
  return { descripcion: "", cantidad: "", unidadMedida: "", unidadLabel: "" };
}

function stripSupervisorTaggedLines(text) {
  const value = String(text || "");
  if (!value.trim()) return "";

  const lines = value.split("\n");
  const filtered = lines.filter((line) => !/^\s*\[[^\]]+\]\s+[^:]+:\s+.+$/.test(line.trim()));
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function getSupervisorObservaciones(historial) {
  if (!Array.isArray(historial)) return [];

  return historial
    .filter((entry) => entry?.accion === "SUPERVISOR_OBSERVACION")
    .map((entry) => ({
      id: entry.id,
      fecha: entry.fecha,
      autor: entry.usuario?.nombre || entry.usuario?.username || "Supervisor",
      texto: entry.detalle?.observacion || "",
    }))
    .filter((item) => item.texto);
}

function hasSupervisorFinalizado(historial) {
  if (!Array.isArray(historial)) return false;
  return historial.some((entry) => entry?.accion === "SUPERVISOR_FINALIZO_EVENTUAL");
}

function getAdminObservacionesPosteriores(historial) {
  if (!Array.isArray(historial)) return [];

  return historial
    .filter((entry) => entry?.accion === "ADMIN_OBSERVACION_POSTERIOR")
    .map((entry) => ({
      id: entry.id,
      fecha: entry.fecha,
      autor: entry.usuario?.nombre || entry.usuario?.username || "Admin",
      texto: entry.detalle?.observacion || "",
    }))
    .filter((item) => item.texto);
}

function getCoordinadorObservacionesPosteriores(historial) {
  if (!Array.isArray(historial)) return [];

  return historial
    .filter((entry) => entry?.accion === "COORDINADOR_OBSERVACION_POSTERIOR")
    .map((entry) => ({
      id: entry.id,
      fecha: entry.fecha,
      autor: entry.usuario?.nombre || entry.usuario?.username || "Coordinador",
      texto: entry.detalle?.observacion || "",
    }))
    .filter((item) => item.texto);
}

export default function AdminEventualForm({ modoFinalizacionCoordinador = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const userRolUpper = String(user?.rol || "").toUpperCase();
  const isCoordinadorFinalizacion = Boolean(modoFinalizacionCoordinador && userRolUpper === "COORDINADOR" && isEdit);
  const isCoordinador = userRolUpper === "COORDINADOR";
  const canEditTrabajosRealizados = isCoordinadorFinalizacion || isEdit;
  const [trabajosSavedAt, setTrabajosSavedAt] = useState(null);
  const [savedFlag, setSavedFlag] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    supervisorId: "",
    kitId: "",
    estado: "activo",
    fechaInicio: "",
    fechaFin: "",
    observaciones: "",
    observacionesPosteriores: "",
  });
  const [eventualActual, setEventualActual] = useState(null);
  const [catalogo, setCatalogo] = useState({ maquinas: [], vehiculos: [] });
  const [supervisores, setSupervisores] = useState([]);
  const [kits, setKits] = useState([]);
  const [maquinaIds, setMaquinaIds] = useState([]);
  const [vehiculoIds, setVehiculoIds] = useState([]);
  const [machineSearch, setMachineSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [bloqueos, setBloqueos] = useState([]);
  const [selectedKitDetail, setSelectedKitDetail] = useState(null);
  const previousKitIdRef = useRef("");
  const [successOpen, setSuccessOpen] = useState(false);
  const [supervisorObservaciones, setSupervisorObservaciones] = useState([]);
  const [adminObservacionesPosteriores, setAdminObservacionesPosteriores] = useState([]);
  const [coordinadorObservacionesPosteriores, setCoordinadorObservacionesPosteriores] = useState([]);
  const [bloquearObservacionesPrevias, setBloquearObservacionesPrevias] = useState(false);
  const [componentesModalOpen, setComponentesModalOpen] = useState(false);
  const [trabajosRealizados, setTrabajosRealizados] = useState([]);
  const [serviciosExtrasSubcontratados, setServiciosExtrasSubcontratados] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const requests = [
          fetch(`${API_BASE}/admin/kits/catalogo`),
          fetch(`${API_BASE}/supervisores/catalogo`),
          fetch(`${API_BASE}/admin/kits?activo=true`),
        ];

        if (isEdit) {
          requests.unshift(fetch(`${API_BASE}/admin/eventuales/${encodeURIComponent(id)}`));
        }

        const responses = await Promise.all(requests);
        if (responses.some((response) => !response.ok)) {
          throw new Error("No se pudieron cargar los datos del eventual");
        }

        const payloads = await Promise.all(responses.map((response) => response.json()));
        const eventual = isEdit ? payloads[0] : null;
        const catalogoData = isEdit ? payloads[1] : payloads[0];
        const supervisoresData = isEdit ? payloads[2] : payloads[1];
        const kitsData = isEdit ? payloads[3] : payloads[2];

        setCatalogo(catalogoData || { maquinas: [], vehiculos: [] });
        setSupervisores(Array.isArray(supervisoresData) ? supervisoresData : []);
        const kitsBase = Array.isArray(kitsData) ? kitsData : [];
        const eventualKit = eventual?.kit || null;
        const hasEventualKit = eventualKit && kitsBase.some((kit) => Number(kit.id) === Number(eventualKit.id));
        setKits(hasEventualKit || !eventualKit ? kitsBase : [...kitsBase, eventualKit]);

        if (eventual) {
          setEventualActual(eventual);
          setSupervisorObservaciones(getSupervisorObservaciones(eventual.historial));
          setAdminObservacionesPosteriores(getAdminObservacionesPosteriores(eventual.historial));
          setCoordinadorObservacionesPosteriores(getCoordinadorObservacionesPosteriores(eventual.historial));
          setBloquearObservacionesPrevias(hasSupervisorFinalizado(eventual.historial));
          setForm({
            nombre: eventual.nombre || "",
            supervisorId: eventual.supervisor?.id ? String(eventual.supervisor.id) : "",
            kitId: eventual.kit?.id ? String(eventual.kit.id) : "",
            estado: eventual.estado || "activo",
            fechaInicio: toDateInputValue(eventual.fechaInicio),
            fechaFin: toDateInputValue(eventual.fechaFin),
            observaciones: stripSupervisorTaggedLines(eventual.observaciones || ""),
            observacionesPosteriores: "",
          });
          setMaquinaIds(eventual.componentesUtilizados?.maquinaIds || (eventual.kit?.maquinas || []).map((item) => item.id));
          setVehiculoIds(eventual.componentesUtilizados?.vehiculoIds || (eventual.kit?.vehiculos || []).map((item) => item.id));
          previousKitIdRef.current = eventual.kit?.id ? String(eventual.kit.id) : "";
                  setTrabajosRealizados(Array.isArray(eventual.trabajosRealizados) ? eventual.trabajosRealizados : []);
                  setServiciosExtrasSubcontratados(Array.isArray(eventual.serviciosExtrasSubcontratados) ? eventual.serviciosExtrasSubcontratados : []);
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

  const selectedKit = useMemo(
    () => kits.find((kit) => String(kit.id) === String(form.kitId)) || null,
    [kits, form.kitId]
  );

  const allowHistoricalKitSelection = isEdit && String(form.estado || "").toLowerCase() === "finalizado";

  const kitsDisponibles = useMemo(() => {
    return (kits || []).filter((kit) => {
      const isCurrent = isEdit && Number(kit.id) === Number(form.kitId);
      if (isCurrent) return true;

      const enUsoPorOtro = kit.eventualActivo && (!isEdit || Number(kit.eventualActivo.id) !== Number(id));
      if (enUsoPorOtro && !allowHistoricalKitSelection) return false;

      if (kit.bloqueadoParaAsignacion && !allowHistoricalKitSelection) return false;
      return true;
    });
  }, [kits, isEdit, form.kitId, id, allowHistoricalKitSelection]);

  const kitNoDisponiblePorUso = useMemo(() => {
    if (allowHistoricalKitSelection) return false;
    if (!selectedKit?.eventualActivo) return false;
    if (!isEdit) return true;
    return Number(selectedKit.eventualActivo.id) !== Number(id);
  }, [selectedKit, isEdit, id, allowHistoricalKitSelection]);

  useEffect(() => {
    if (!form.kitId) {
      setSelectedKitDetail(null);
      return;
    }

    let cancelled = false;

    async function loadKitDetail() {
      try {
        const res = await fetch(`${API_BASE}/admin/kits/${encodeURIComponent(form.kitId)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setSelectedKitDetail(data);
      } catch {
        if (!cancelled) setSelectedKitDetail(null);
      }
    }

    loadKitDetail();

    return () => {
      cancelled = true;
    };
  }, [form.kitId]);

  useEffect(() => {
    const currentKitId = String(form.kitId || "");
    if (currentKitId === previousKitIdRef.current) return;

    if (currentKitId) {
      const detailKitId = String(selectedKitDetail?.id || "");
      // Esperar a tener el detalle del kit actualmente seleccionado.
      if (!detailKitId || detailKitId !== currentKitId) return;
    }

    previousKitIdRef.current = currentKitId;

    if (!currentKitId) {
      setMaquinaIds([]);
      setVehiculoIds([]);
      return;
    }

    setMaquinaIds((selectedKitDetail?.maquinas || []).map((item) => item.id));
    setVehiculoIds((selectedKitDetail?.vehiculos || []).map((item) => item.id));
  }, [form.kitId, selectedKitDetail]);

  function hasInvalidDateRange() {
    if (!form.fechaInicio || !form.fechaFin) return false;
    return form.fechaFin < form.fechaInicio;
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleSelection(setter, currentValues, value) {
    setter(currentValues.includes(value) ? currentValues.filter((item) => item !== value) : [...currentValues, value]);
  }

  function sortById(items) {
    return [...items].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: "base" }));
  }

  const maquinasFiltradas = useMemo(() => {
    const query = machineSearch.trim().toLowerCase();
    return sortById(catalogo.maquinas || []).filter((item) => {
      if (!query) return true;
      return [item.id, item.tipo, item.modelo, item.serie, item.kitActual?.nombre]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [catalogo.maquinas, machineSearch]);

  const vehiculosFiltrados = useMemo(() => {
    const query = vehicleSearch.trim().toLowerCase();
    return sortById(catalogo.vehiculos || []).filter((item) => {
      if (!query) return true;
      return [item.id, item.vehiculo, item.modelo, item.patente, item.kitActual?.nombre]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [catalogo.vehiculos, vehicleSearch]);

  const maquinasSeleccionadas = useMemo(
    () => sortById((catalogo.maquinas || []).filter((item) => maquinaIds.includes(item.id))),
    [catalogo.maquinas, maquinaIds]
  );

  const vehiculosSeleccionados = useMemo(
    () => sortById((catalogo.vehiculos || []).filter((item) => vehiculoIds.includes(item.id))),
    [catalogo.vehiculos, vehiculoIds]
  );

  async function submit() {
    try {
      setSaving(true);
      setError("");
      setBloqueos([]);

      if (hasInvalidDateRange()) {
        throw new Error("La fecha de finalización no puede ser menor a la fecha de inicio");
      }

      if (canEditTrabajosRealizados) {
        if (form.estado === "finalizado" && trabajosRealizados.length === 0) {
          throw new Error("Debe cargar al menos un trabajo realizado para finalizar el eventual");
        }
        for (let i = 0; i < trabajosRealizados.length; i++) {
          const t = trabajosRealizados[i];
          if (!t.tipo) throw new Error(`Trabajo ${i + 1}: seleccioná el tipo de trabajo`);
          if (!t.cantidad || Number(t.cantidad) <= 0) throw new Error(`Trabajo ${i + 1}: la cantidad debe ser mayor a 0`);
          if (!t.unidadMedida) throw new Error(`Trabajo ${i + 1}: seleccioná la unidad de medida`);
          if (t.tipo === "OTRO" && !String(t.descripcionOtro || "").trim()) throw new Error(`Trabajo ${i + 1}: ingresá la descripción para tipo "Otro"`);
        }
        for (let i = 0; i < serviciosExtrasSubcontratados.length; i++) {
          const s = serviciosExtrasSubcontratados[i];
          if (!String(s.descripcion || "").trim()) throw new Error(`Servicio extra ${i + 1}: ingresá la descripción`);
          if (!s.cantidad || Number(s.cantidad) <= 0) throw new Error(`Servicio extra ${i + 1}: la cantidad debe ser mayor a 0`);
          if (!s.unidadMedida) throw new Error(`Servicio extra ${i + 1}: seleccioná la unidad de medida`);
        }
      }

      const response = await fetch(
        isEdit ? `${API_BASE}/admin/eventuales/${encodeURIComponent(id)}` : `${API_BASE}/admin/eventuales`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuario: user?.username,
            nombre: form.nombre,
            supervisorId: Number(form.supervisorId),
            kitId: form.kitId ? Number(form.kitId) : null,
            estado: form.estado,
            fechaInicio: form.fechaInicio || null,
            fechaFin: form.fechaFin || null,
            observaciones: form.observaciones,
            observacionesPosteriores: isEdit ? form.observacionesPosteriores : undefined,
            maquinaIds: isEdit ? maquinaIds : undefined,
            vehiculoIds: isEdit ? vehiculoIds : undefined,
            trabajosRealizados: canEditTrabajosRealizados ? trabajosRealizados.map((t) => ({
              ...t,
              label: TIPOS_TRABAJO.find((x) => x.value === t.tipo)?.label || t.tipo,
              unidadLabel: UNIDADES_MEDIDA.find((x) => x.value === t.unidadMedida)?.label || t.unidadMedida,
              cantidad: Number(t.cantidad),
            })) : undefined,
            serviciosExtrasSubcontratados: canEditTrabajosRealizados ? serviciosExtrasSubcontratados.map((s) => ({
              ...s,
              unidadLabel: UNIDADES_MEDIDA.find((x) => x.value === s.unidadMedida)?.label || s.unidadMedida,
              cantidad: Number(s.cantidad),
            })) : undefined,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (Array.isArray(data.bloqueos)) {
          setBloqueos(data.bloqueos);
        }
        throw new Error(data.error || "No se pudo guardar el eventual");
      }

      // mark trabajos as saved visually
      setTrabajosSavedAt(new Date());
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 3000);
      setSuccessOpen(true);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || "Error guardando eventual");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    await submit();
  }

  if (loading) return <div className="p-4">Cargando eventual...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
      >
        ← Volver
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isCoordinadorFinalizacion ? "Finalizar eventual" : isEdit ? "Corregir eventual" : "Nuevo eventual"}</h1>
          <p className="text-sm text-gray-600">
            {isCoordinadorFinalizacion
              ? "Completá la información complementaria para el cierre."
              : isEdit
                ? "El admin puede corregir nombre, supervisor, kit, estado, fechas y observaciones."
                : "Crea un eventual y asigna un kit si ya esta definido."}
          </p>
        </div>
        {eventualActual ? (
          <button
            onClick={() => navigate(`/admin/eventuales/${eventualActual.id}`)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            Ver detalle
          </button>
        ) : null}
      </div>

      {error ? <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {kitNoDisponiblePorUso ? (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          El kit seleccionado ya esta asociado al eventual activo {selectedKit?.eventualActivo?.nombre}.
        </div>
      ) : null}
      {allowHistoricalKitSelection && selectedKit?.eventualActivo && Number(selectedKit?.eventualActivo?.id) !== Number(id) ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          El kit seleccionado está en uso en otro eventual activo, pero se permite porque este eventual está finalizado.
        </div>
      ) : null}
      {selectedKit?.bloqueadoParaAsignacion && form.estado === "activo" ? (
        <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          El kit seleccionado no puede asignarse porque tiene componentes bloqueados.
        </div>
      ) : null}

      {canEditTrabajosRealizados ? (
        <div className="mb-1 flex items-center gap-3">
          <span className="flex-1 border-t border-slate-200" />
          <span className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-extrabold uppercase tracking-widest text-slate-600 md:text-base">Información del eventual</span>
          <span className="flex-1 border-t border-slate-200" />
        </div>
      ) : null}

      <div className="rounded-2xl bg-white p-4 shadow space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
          <input
            className={`w-full rounded-xl border p-3 text-sm ${isCoordinadorFinalizacion ? "bg-slate-100 text-slate-600" : ""}`}
            value={form.nombre}
            onChange={(event) => updateField("nombre", event.target.value)}
            disabled={isCoordinadorFinalizacion}
          />
        </div>

        <div className={`rounded-2xl border p-4 ${isCoordinadorFinalizacion ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Estado del eventual</p>
              <p className="text-xs text-slate-600">
                {isCoordinadorFinalizacion
                  ? "Confirmá el estado final del eventual y completá observaciones de coordinación."
                  : "Definí si el eventual sigue activo, se corrige como finalizado o se cancela."}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${String(form.estado) === "finalizado" ? "bg-emerald-100 text-emerald-700" : String(form.estado) === "activo" ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"}`}>
              {form.estado || "sin estado"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Supervisor responsable</label>
            <select className="w-full rounded-xl border p-3 text-sm" value={form.supervisorId} onChange={(event) => updateField("supervisorId", event.target.value)}>
              <option value="">Seleccionar supervisor</option>
              {supervisores.map((supervisor) => (
                <option key={supervisor.id} value={String(supervisor.id)}>
                  {supervisor.nombre || supervisor.username}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
            <select
              className={`w-full rounded-xl border-2 p-3.5 text-base font-bold uppercase shadow-sm transition ${
                String(form.estado) === "finalizado"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : String(form.estado) === "cancelado"
                    ? "border-rose-500 bg-rose-50 text-rose-800"
                    : "border-blue-500 bg-blue-50 text-blue-800"
              }`}
              value={form.estado}
              onChange={(event) => updateField("estado", event.target.value)}
            >
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>
        </div>
        </div>

        <div className={`rounded-2xl border p-4 ${isCoordinadorFinalizacion ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-slate-50/80"}`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Kit y componentes</p>
              <p className="text-xs text-slate-600">
                {allowHistoricalKitSelection
                  ? "En estado finalizado podés asociar un kit actualmente en uso para dejar trazabilidad histórica correcta."
                  : "Seleccioná el kit operativo y, en edición, ajustá qué componentes se usaron realmente."}
              </p>
            </div>
          </div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Kit</label>
          <select className="w-full rounded-xl border p-3 text-sm" value={form.kitId} onChange={(event) => updateField("kitId", event.target.value)}>
            <option value="">Sin kit</option>
            {kitsDisponibles.map((kit) => (
              <option key={kit.id} value={String(kit.id)}>
                {kit.nombre} {kit.bloqueadoParaAsignacion ? "(bloqueado)" : ""} {kit.eventualActivo && (!isEdit || Number(kit.eventualActivo.id) !== Number(id)) ? `(en uso por ${kit.eventualActivo.nombre})` : ""}
              </option>
            ))}
          </select>

          {form.kitId ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">Componentes del eventual</p>
                  <p className="text-xs text-slate-500">
                    {isEdit ? "Visualizá y ajustá lo realmente utilizado desde el modal." : "Composición del kit seleccionado."}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {selectedKitDetail ? (
                    <span className="text-xs text-slate-500">
                      {(selectedKitDetail.maquinas || []).length} máquinas · {(selectedKitDetail.vehiculos || []).length} vehículos
                    </span>
                  ) : null}
                  {isEdit ? (
                    <button
                      type="button"
                      onClick={() => setComponentesModalOpen(true)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Editar componentes
                    </button>
                  ) : null}
                </div>
              </div>

              {!selectedKitDetail ? (
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                  Cargando composición del kit...
                </div>
              ) : (
                <div className="mt-3 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Máquinas usadas</p>
                    {maquinasSeleccionadas.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay máquinas seleccionadas.</p>
                    ) : (
                      <div className="space-y-2">
                        {maquinasSeleccionadas.map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                            <p className="text-sm font-semibold text-slate-900">{item.tipo} {item.id}</p>
                            <p className="text-xs text-slate-500">{item.modelo} · {item.serie || "Sin serie"}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Vehículos usados</p>
                    {vehiculosSeleccionados.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay vehículos seleccionados.</p>
                    ) : (
                      <div className="space-y-2">
                        {vehiculosSeleccionados.map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                            <p className="text-sm font-semibold text-slate-900">{item.vehiculo} {item.id}</p>
                            <p className="text-xs text-slate-500">{item.modelo} · {item.patente}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedKitDetail?.bloqueadoParaAsignacion ? <p className="mt-3 text-xs text-rose-700">{selectedKitDetail.bloqueos?.[0]?.mensaje}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de inicio</label>
            <input type="date" className="w-full rounded-xl border p-3 text-sm" value={form.fechaInicio} onChange={(event) => updateField("fechaInicio", event.target.value)} />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de fin</label>
            <input type="date" className="w-full rounded-xl border p-3 text-sm" value={form.fechaFin} onChange={(event) => updateField("fechaFin", event.target.value)} />
          </div>
        </div>

        {hasInvalidDateRange() ? (
          <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
            La fecha de finalización no puede ser menor a la fecha de inicio.
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones previas</label>
          <textarea
            rows={5}
            className="w-full rounded-xl border p-3 text-sm disabled:bg-slate-100 disabled:text-slate-500"
            value={form.observaciones}
            onChange={(event) => updateField("observaciones", event.target.value)}
            disabled={Boolean(isCoordinadorFinalizacion || (isEdit && bloquearObservacionesPrevias))}
          />
        </div>

        {isEdit && (bloquearObservacionesPrevias || isCoordinadorFinalizacion) ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {isCoordinadorFinalizacion ? "Observación de coordinación" : "Observaciones posteriores"}
            </label>
            <textarea
              rows={4}
              className="w-full rounded-xl border p-3 text-sm"
              value={form.observacionesPosteriores || ""}
              onChange={(event) => updateField("observacionesPosteriores", event.target.value)}
            />
          </div>
        ) : null}

        {supervisorObservaciones.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Observaciones del supervisor (solo lectura)</p>
            <div className="space-y-2">
              {supervisorObservaciones.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <p className="text-xs text-slate-500">{item.autor}</p>
                  <p className="mt-1 whitespace-pre-line text-slate-700">{item.texto}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {adminObservacionesPosteriores.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Observaciones posteriores ya registradas</p>
            <div className="space-y-2">
              {adminObservacionesPosteriores.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <p className="text-xs text-slate-500">{item.autor}</p>
                  <p className="mt-1 whitespace-pre-line text-slate-700">{item.texto}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {coordinadorObservacionesPosteriores.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Observaciones de coordinación ya registradas</p>
            <div className="space-y-2">
              {coordinadorObservacionesPosteriores.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <p className="text-xs text-slate-500">{item.autor}</p>
                  <p className="mt-1 whitespace-pre-line text-slate-700">{item.texto}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

      </div>

      {isEdit && form.kitId && componentesModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Editar componentes usados</h2>
                <p className="text-sm text-slate-500">Ajustá las máquinas y vehículos realmente usados.</p>
              </div>
              <button
                type="button"
                onClick={() => setComponentesModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-4 space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {maquinaIds.length}
                    </span>
                    <h3 className="text-sm font-semibold text-blue-900">Máquinas incluidas</h3>
                  </div>
                  {maquinasSeleccionadas.length === 0 ? (
                    <p className="text-xs italic text-blue-500">Ninguna máquina seleccionada</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {maquinasSeleccionadas.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-sm"
                        >
                          <span>{item.tipo ? `${item.tipo} ${item.id}` : item.id}</span>
                          {item.modelo ? <span className="font-normal text-blue-500">· {item.modelo}</span> : null}
                          <button
                            type="button"
                            onClick={() => toggleSelection(setMaquinaIds, maquinaIds, item.id)}
                            className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="Quitar"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {vehiculoIds.length}
                    </span>
                    <h3 className="text-sm font-semibold text-emerald-900">Vehículos incluidos</h3>
                  </div>
                  {vehiculosSeleccionados.length === 0 ? (
                    <p className="text-xs italic text-emerald-500">Ningún vehículo seleccionado</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {vehiculosSeleccionados.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm"
                        >
                          <span>{item.vehiculo ? `${item.vehiculo} ${item.id}` : item.id}</span>
                          {item.modelo ? <span className="font-normal text-emerald-500">· {item.modelo}</span> : null}
                          <button
                            type="button"
                            onClick={() => toggleSelection(setVehiculoIds, vehiculoIds, item.id)}
                            className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                            title="Quitar"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Máquinas disponibles</h3>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">{maquinaIds.length} sel.</span>
                  </div>
                  <input
                    value={machineSearch}
                    onChange={(event) => setMachineSearch(event.target.value)}
                    placeholder="Buscar máquinas..."
                    className="mb-3 w-full rounded-xl border p-2.5 text-sm"
                  />
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {maquinasFiltradas.map((item) => {
                      const checked = maquinaIds.includes(item.id);
                      return (
                        <label key={item.id} className={`block cursor-pointer rounded-xl border p-3 transition-colors ${checked ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-slate-50"}`}>
                          <div className="flex gap-3">
                            <input type="checkbox" checked={checked} onChange={() => toggleSelection(setMaquinaIds, maquinaIds, item.id)} className="mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{item.tipo} {item.id}</p>
                              <p className="text-xs text-gray-500">{item.modelo} · {item.serie || "Sin serie"}</p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Vehículos disponibles</h3>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">{vehiculoIds.length} sel.</span>
                  </div>
                  <input
                    value={vehicleSearch}
                    onChange={(event) => setVehicleSearch(event.target.value)}
                    placeholder="Buscar vehículos..."
                    className="mb-3 w-full rounded-xl border p-2.5 text-sm"
                  />
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {vehiculosFiltrados.map((item) => {
                      const checked = vehiculoIds.includes(item.id);
                      return (
                        <label key={item.id} className={`block cursor-pointer rounded-xl border p-3 transition-colors ${checked ? "border-emerald-300 bg-emerald-50" : "border-gray-200 hover:bg-slate-50"}`}>
                          <div className="flex gap-3">
                            <input type="checkbox" checked={checked} onChange={() => toggleSelection(setVehiculoIds, vehiculoIds, item.id)} className="mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{item.vehiculo} {item.id}</p>
                              <p className="text-xs text-gray-500">{item.modelo} · {item.patente}</p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setComponentesModalOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setComponentesModalOpen(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Aplicar cambios
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={successOpen}
        title={isCoordinadorFinalizacion ? "Información guardada" : "Eventual creado"}
        message={isCoordinadorFinalizacion ? "Los cambios se guardaron correctamente." : "El eventual se guardó con éxito."}
        onCancel={() => navigate('/admin/eventuales')}
        onConfirm={() => navigate('/admin/eventuales')}
        confirmLabel="Ir a eventuales"
        hideCancel={true}
      />

      {canEditTrabajosRealizados ? (
        <>
          <div className="mt-4 flex items-center gap-3">
                    <span className="flex-1 border-t border-slate-200" />
                    <span className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-extrabold uppercase tracking-widest text-slate-600 md:text-base">Información de los trabajos realizados</span>
                    <span className="flex-1 border-t border-slate-200" />
          </div>

          <div className="rounded-2xl bg-white p-4 shadow space-y-6">

                    {/* ── Trabajos realizados ── */}
                    <div>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="text-base font-semibold text-gray-900">Trabajos realizados</h2>
                            {trabajosSavedAt ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">✓ Guardado</span>
                            ) : null}
                          </div>
                          {form.estado === "finalizado" ? (
                            <p className="text-xs text-gray-500">Obligatorio al finalizar. Cargá al menos un renglón.</p>
                          ) : (
                            <p className="text-xs text-gray-500">Opcional si el eventual se cancela.</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setTrabajosRealizados((prev) => [...prev, emptyTrabajo()])}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                        >
                          + Agregar trabajo
                        </button>
                      </div>

                      {trabajosRealizados.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                          No hay trabajos cargados. Hacé clic en "Agregar trabajo" para empezar.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {trabajosRealizados.map((trabajo, idx) => (
                            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trabajo {idx + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => setTrabajosRealizados((prev) => prev.filter((_, i) => i !== idx))}
                                  className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                >
                                  Eliminar
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-3">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-700">Tipo de trabajo</label>
                                  <select
                                    className="w-full rounded-xl border p-2.5 text-sm"
                                    value={trabajo.tipo}
                                    onChange={(e) => {
                                      const tipo = e.target.value;
                                      setTrabajosRealizados((prev) => prev.map((item, i) => i === idx ? { ...item, tipo, descripcionOtro: tipo !== "OTRO" ? "" : item.descripcionOtro } : item));
                                    }}
                                  >
                                    <option value="">Seleccionar tipo...</option>
                                    {TIPOS_TRABAJO.map((t) => (
                                      <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-700">Cantidad</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="w-full rounded-xl border p-2.5 text-sm"
                                    value={trabajo.cantidad}
                                    onChange={(e) => setTrabajosRealizados((prev) => prev.map((item, i) => i === idx ? { ...item, cantidad: e.target.value } : item))}
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-700">Unidad de medida</label>
                                  <select
                                    className="w-full rounded-xl border p-2.5 text-sm"
                                    value={trabajo.unidadMedida}
                                    onChange={(e) => setTrabajosRealizados((prev) => prev.map((item, i) => i === idx ? { ...item, unidadMedida: e.target.value } : item))}
                                  >
                                    <option value="">Seleccionar unidad...</option>
                                    {UNIDADES_MEDIDA.map((u) => (
                                      <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {trabajo.tipo === "OTRO" ? (
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-700">Descripción del trabajo (obligatoria)</label>
                                  <input
                                    type="text"
                                    className="w-full rounded-xl border p-2.5 text-sm"
                                    placeholder="Describí brevemente el trabajo realizado..."
                                    value={trabajo.descripcionOtro}
                                    onChange={(e) => setTrabajosRealizados((prev) => prev.map((item, i) => i === idx ? { ...item, descripcionOtro: e.target.value } : item))}
                                  />
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── Servicios extras subcontratados ── */}
                    <div className="border-t border-slate-100 pt-5">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="text-base font-semibold text-gray-900">Servicios extras subcontratados</h2>
                          <p className="text-xs text-gray-500">Opcional. Si cargás un renglón, debe estar completo.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setServiciosExtrasSubcontratados((prev) => [...prev, emptyServicioExtra()])}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          + Agregar servicio extra
                        </button>
                      </div>

                      {serviciosExtrasSubcontratados.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                          No hay servicios extras cargados.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {serviciosExtrasSubcontratados.map((servicio, idx) => (
                            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Servicio extra {idx + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => setServiciosExtrasSubcontratados((prev) => prev.filter((_, i) => i !== idx))}
                                  className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                >
                                  Eliminar
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="md:col-span-1">
                                  <label className="mb-1 block text-xs font-medium text-gray-700">Descripción</label>
                                  <input
                                    type="text"
                                    className="w-full rounded-xl border p-2.5 text-sm"
                                    placeholder="Descripción del servicio..."
                                    value={servicio.descripcion}
                                    onChange={(e) => setServiciosExtrasSubcontratados((prev) => prev.map((item, i) => i === idx ? { ...item, descripcion: e.target.value } : item))}
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-700">Cantidad</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="w-full rounded-xl border p-2.5 text-sm"
                                    value={servicio.cantidad}
                                    onChange={(e) => setServiciosExtrasSubcontratados((prev) => prev.map((item, i) => i === idx ? { ...item, cantidad: e.target.value } : item))}
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-medium text-gray-700">Unidad de medida</label>
                                  <select
                                    className="w-full rounded-xl border p-2.5 text-sm"
                                    value={servicio.unidadMedida}
                                    onChange={(e) => setServiciosExtrasSubcontratados((prev) => prev.map((item, i) => i === idx ? { ...item, unidadMedida: e.target.value } : item))}
                                  >
                                    <option value="">Seleccionar unidad...</option>
                                    {UNIDADES_MEDIDA.map((u) => (
                                      <option key={u.value} value={u.value}>{u.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

          </div>
        </>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2 rounded-2xl bg-white p-4 shadow">
        <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
          Cancelar
        </button>
        <button onClick={save} disabled={saving || (kitNoDisponiblePorUso && !isCoordinador) || hasInvalidDateRange()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
          {saving ? "Guardando..." : savedFlag ? "Guardado" : isCoordinadorFinalizacion ? "Guardar información complementaria" : isEdit ? "Guardar correccion" : "Crear eventual"}
        </button>
      </div>
    </div>
  );
}
