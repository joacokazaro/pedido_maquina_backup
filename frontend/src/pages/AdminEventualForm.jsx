import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import { toDateInputValue } from "../utils/date";

const ESTADOS = ["activo", "finalizado", "cancelado"];

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

export default function AdminEventualForm({ modoFinalizacionCoordinador = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);
  const userRolUpper = String(user?.rol || "").toUpperCase();
  const isCoordinadorFinalizacion = Boolean(modoFinalizacionCoordinador && userRolUpper === "COORDINADOR" && isEdit);

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
  const [savedId, setSavedId] = useState(null);
  const [supervisorObservaciones, setSupervisorObservaciones] = useState([]);
  const [adminObservacionesPosteriores, setAdminObservacionesPosteriores] = useState([]);
  const [bloquearObservacionesPrevias, setBloquearObservacionesPrevias] = useState(false);
  const [componentesModalOpen, setComponentesModalOpen] = useState(false);

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
        setKits(Array.isArray(kitsData) ? kitsData : []);

        if (eventual) {
          setEventualActual(eventual);
          setSupervisorObservaciones(getSupervisorObservaciones(eventual.historial));
          setAdminObservacionesPosteriores(getAdminObservacionesPosteriores(eventual.historial));
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

  const kitNoDisponiblePorUso = useMemo(() => {
    if (!selectedKit?.eventualActivo) return false;
    if (!isEdit) return true;
    return Number(selectedKit.eventualActivo.id) !== Number(id);
  }, [selectedKit, isEdit, id]);

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
    if (currentKitId && !selectedKitDetail) return;

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
            observacionesPosteriores: isEdit && bloquearObservacionesPrevias ? form.observacionesPosteriores : undefined,
            maquinaIds: isEdit ? maquinaIds : undefined,
            vehiculoIds: isEdit ? vehiculoIds : undefined,
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

      setSavedId(data.id);
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
        <div className="flex items-center gap-2">
          {eventualActual ? (
            <button
              onClick={() => navigate(`/admin/eventuales/${eventualActual.id}`)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Ver detalle
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {kitNoDisponiblePorUso ? (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          El kit seleccionado ya esta asociado al eventual activo {selectedKit?.eventualActivo?.nombre}.
        </div>
      ) : null}
      {selectedKit?.bloqueadoParaAsignacion && form.estado === "activo" ? (
        <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          El kit seleccionado no puede asignarse porque tiene componentes bloqueados.
        </div>
      ) : null}
      {bloqueos.length > 0 ? (
        <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          <p className="font-semibold">Bloqueos detectados</p>
          <ul className="mt-2 space-y-1">
            {bloqueos.map((item) => (
              <li key={`${item.categoria}-${item.id}`}>{item.mensaje}</li>
            ))}
          </ul>
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
          {isCoordinadorFinalizacion ? (
            <p className="mt-1 text-xs text-slate-500">El nombre del eventual no se puede editar en esta instancia.</p>
          ) : null}
        </div>

        {/* Section 2 is rendered at the bottom for coordinators (moved down) */}

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
            <select className="w-full rounded-xl border p-3 text-sm" value={form.estado} onChange={(event) => updateField("estado", event.target.value)}>
              {ESTADOS.map((estado) => (
                <option key={estado} value={estado}>{estado}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Kit</label>
          <select className="w-full rounded-xl border p-3 text-sm" value={form.kitId} onChange={(event) => updateField("kitId", event.target.value)}>
            <option value="">Sin kit</option>
            {kits.map((kit) => (
              <option key={kit.id} value={String(kit.id)}>
                {kit.nombre} {kit.bloqueadoParaAsignacion ? "(bloqueado)" : ""} {kit.eventualActivo && (!isEdit || Number(kit.eventualActivo.id) !== Number(id)) ? `(en uso por ${kit.eventualActivo.nombre})` : ""}
              </option>
            ))}
          </select>
          {!isEdit && form.kitId ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">Composición actual del kit</p>
                  
                </div>
                {selectedKitDetail ? (
                  <span className="text-xs text-slate-500">
                    {(selectedKitDetail.maquinas || []).length} máquinas · {(selectedKitDetail.vehiculos || []).length} vehículos
                  </span>
                ) : null}
              </div>

              {!selectedKitDetail ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">
                  Cargando composición del kit...
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Máquinas del kit</p>
                    {(selectedKitDetail.maquinas || []).length === 0 ? (
                      <p className="text-sm text-slate-500">El kit no tiene máquinas.</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedKitDetail.maquinas || []).map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                            {item.tipo} {item.id}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Vehículos del kit</p>
                    {(selectedKitDetail.vehiculos || []).length === 0 ? (
                      <p className="text-sm text-slate-500">El kit no tiene vehículos.</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedKitDetail.vehiculos || []).map((item) => (
                          <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                            {item.vehiculo} {item.id}
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

          {isEdit && form.kitId ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">Componentes usados en el eventual</p>
                  <p className="text-xs text-slate-500">Editá máquinas y vehículos en un modal para mantener esta vista más simple.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setComponentesModalOpen(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Editar componentes
                </button>
              </div>

              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Máquinas usadas realmente</p>
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
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Vehículos usados realmente</p>
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
          {isCoordinadorFinalizacion ? (
            <p className="mt-1 text-xs text-slate-500">Observaciones previas (solo lectura para Coordinador).</p>
          ) : isEdit && bloquearObservacionesPrevias ? (
            <p className="mt-1 text-xs text-slate-500">Estas observaciones quedan fijas porque el eventual ya fue finalizado por supervisor.</p>
          ) : null}
        </div>

        {isEdit && bloquearObservacionesPrevias ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones posteriores</label>
            <textarea
              rows={4}
              className="w-full rounded-xl border p-3 text-sm"
              value={form.observacionesPosteriores || ""}
              onChange={(event) => updateField("observacionesPosteriores", event.target.value)}
              placeholder="Agregar una observación nueva posterior al cierre del supervisor"
            />
            <p className="mt-1 text-xs text-slate-500">Se registra como una observación nueva, sin editar la observación previa.</p>
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

        <div>
          <p className="text-xs text-slate-500">Las observaciones del supervisor se gestionan solo desde su vista y quedan auditadas en el historial.</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || kitNoDisponiblePorUso || hasInvalidDateRange()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
            {saving ? "Guardando..." : isCoordinadorFinalizacion ? "Guardar información complementaria" : isEdit ? "Guardar correccion" : "Crear eventual"}
          </button>
        </div>
      </div>

      {isEdit && form.kitId && componentesModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Editar componentes usados</h2>
                <p className="text-sm text-slate-500">Estos cambios se aplican al eventual actual. Al guardar, seguís en esta misma vista.</p>
              </div>
              <button
                type="button"
                onClick={() => setComponentesModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
              >
                Cerrar
              </button>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Máquinas seleccionadas: {maquinaIds.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Vehículos seleccionados: {vehiculoIds.length}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Agregar o quitar máquinas</h3>
                    <span className="text-xs text-slate-500">{maquinaIds.length} seleccionadas</span>
                  </div>
                  <input
                    value={machineSearch}
                    onChange={(event) => setMachineSearch(event.target.value)}
                    placeholder="Buscar máquinas..."
                    className="mb-3 w-full rounded-xl border p-2.5 text-sm"
                  />
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {maquinasFiltradas.map((item) => {
                      const checked = maquinaIds.includes(item.id);
                      return (
                        <label key={item.id} className={`block rounded-xl border p-3 ${checked ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
                          <div className="flex gap-3">
                            <input type="checkbox" checked={checked} onChange={() => toggleSelection(setMaquinaIds, maquinaIds, item.id)} />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{item.tipo} {item.id}</p>
                              <p className="text-xs text-gray-500">{item.modelo} · {item.serie || "Sin serie"}</p>
                              {item.kitActual && !checked ? <p className="text-xs text-blue-700">Actualmente en kit: {item.kitActual.nombre}</p> : null}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Agregar o quitar vehículos</h3>
                    <span className="text-xs text-slate-500">{vehiculoIds.length} seleccionados</span>
                  </div>
                  <input
                    value={vehicleSearch}
                    onChange={(event) => setVehicleSearch(event.target.value)}
                    placeholder="Buscar vehículos..."
                    className="mb-3 w-full rounded-xl border p-2.5 text-sm"
                  />
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {vehiculosFiltrados.map((item) => {
                      const checked = vehiculoIds.includes(item.id);
                      return (
                        <label key={item.id} className={`block rounded-xl border p-3 ${checked ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
                          <div className="flex gap-3">
                            <input type="checkbox" checked={checked} onChange={() => toggleSelection(setVehiculoIds, vehiculoIds, item.id)} />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{item.vehiculo} {item.id}</p>
                              <p className="text-xs text-gray-500">{item.modelo} · {item.patente}</p>
                              {item.kitActual && !checked ? <p className="text-xs text-blue-700">Actualmente en kit: {item.kitActual.nombre}</p> : null}
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
        message={isCoordinadorFinalizacion ? "Los cambios se guardaron y seguís en esta vista de finalización." : "El eventual se guardó con éxito."}
        onCancel={() => (isCoordinadorFinalizacion ? setSuccessOpen(false) : navigate('/admin/eventuales/historial'))}
        onConfirm={() => (isCoordinadorFinalizacion ? setSuccessOpen(false) : navigate('/admin/eventuales/historial'))}
        confirmLabel={isCoordinadorFinalizacion ? "Continuar" : "Ir al historial"}
        hideCancel={true}
      />
      {isCoordinadorFinalizacion ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
          <h2 className="text-base font-semibold text-slate-900">Sección 2 · Información complementaria</h2>
          <p className="mt-1 text-sm text-slate-600">Esta sección se desarrollará más adelante.</p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">
            Pendiente de implementación.
          </div>
        </div>
      ) : null}
    </div>
  );
}
