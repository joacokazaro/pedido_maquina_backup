import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { toDateInputValue } from "../utils/date";

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

function emptyMaquinaRow() {
  return { tipo: "", cantidad: "" };
}

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
  const [tiposMaquina, setTiposMaquina] = useState([]);
  const [vehiculosCatalogo, setVehiculosCatalogo] = useState([]);

  const [maquinasRows, setMaquinasRows] = useState([emptyMaquinaRow()]);
  const [vehiculosRows, setVehiculosRows] = useState([emptyVehiculoRow()]);
  const [legacyComponentes, setLegacyComponentes] = useState(null);

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

        setTiposMaquina(Array.isArray(catalogo?.tiposMaquina) ? catalogo.tiposMaquina : []);
        setVehiculosCatalogo(Array.isArray(catalogo?.vehiculos) ? catalogo.vehiculos : []);
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

          setMaquinasRows(maquinas.length > 0 ? maquinas.map((item) => ({ tipo: item.tipo || "", cantidad: String(item.cantidad || "") })) : [emptyMaquinaRow()]);
          setVehiculosRows(vehiculoIds.length > 0 ? vehiculoIds.map((vehiculoId) => ({ vehiculoId })) : [emptyVehiculoRow()]);

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

  const vehiculosOptions = useMemo(() => {
    return vehiculosCatalogo.map((item) => ({
      value: item.id,
      label: `${item.vehiculo} ${item.id} · ${item.patente || "sin patente"}`,
    }));
  }, [vehiculosCatalogo]);

  const estadoStyles = ESTADO_STYLES[form.estado] || {
    select: "border-slate-300 bg-slate-50 text-slate-800",
    chip: "bg-slate-100 text-slate-800",
  };

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function updateMaquinaRow(index, key, value) {
    setMaquinasRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function addMaquinaRow() {
    setMaquinasRows((prev) => [...prev, emptyMaquinaRow()]);
  }

  function removeMaquinaRow(index) {
    setMaquinasRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
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
    const maquinasUtilizadas = maquinasRows
      .map((row) => ({ tipo: String(row.tipo || "").trim(), cantidad: Number(row.cantidad) }))
      .filter((row) => row.tipo);

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
      supervisorId: Number(form.supervisorId),
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

      <div className="rounded-2xl bg-white p-4 shadow space-y-4">
        <div className="mb-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
            DATOS DEL EVENTUAL
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isCoordinadorFinalizacion ? "Finalizar eventual" : isEdit ? "Corregir eventual" : "Nuevo eventual"}
            </h1>
            <p className="text-sm text-gray-600">
              {isEdit
                ? "Podés corregir datos del eventual y registrar observaciones posteriores."
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

        {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

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
            <label className="mb-1 block text-sm font-medium text-gray-700">Supervisor</label>
            <select
              className="w-full rounded-xl border p-3 text-sm"
              value={form.supervisorId}
              onChange={(event) => updateField("supervisorId", event.target.value)}
              disabled={isCoordinadorFinalizacion}
            >
              <option value="">Seleccionar supervisor</option>
              {supervisores.map((supervisor) => (
                <option key={supervisor.id} value={String(supervisor.id)}>
                  {supervisor.nombre || supervisor.username}
                </option>
              ))}
            </select>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha fin</label>
            <input type="date" className="w-full rounded-xl border p-3 text-sm" value={form.fechaFin} onChange={(event) => updateField("fechaFin", event.target.value)} />
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

      {mostrarComponentes ? (
      <>
      <div className="mb-1 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
          MAQUINARIA UTILIZADA
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/60 to-white p-4 shadow space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Maquinas utilizadas por tipo</h2>
          <button type="button" onClick={addMaquinaRow} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
            Agregar renglon
          </button>
        </div>

        {maquinasRows.map((row, index) => (
          <div key={`maq-${index}`} className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
            <select
              className="rounded-xl border p-2.5 text-sm"
              value={row.tipo}
              onChange={(event) => updateMaquinaRow(index, "tipo", event.target.value)}
            >
              <option value="">Seleccionar tipo</option>
              {tiposMaquina.map((item) => (
                <option key={item.tipo} value={item.tipo}>{item.tipo}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              className="rounded-xl border p-2.5 text-sm"
              placeholder="Cantidad"
              value={row.cantidad}
              onChange={(event) => updateMaquinaRow(index, "cantidad", event.target.value)}
            />
            <button
              type="button"
              onClick={() => removeMaquinaRow(index)}
              className="justify-self-end rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-4 shadow space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Vehiculos utilizados</h2>
          <button type="button" onClick={addVehiculoRow} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
            Agregar renglon
          </button>
        </div>

        {vehiculosRows.map((row, index) => (
          <div key={`veh-${index}`} className="grid gap-2 md:grid-cols-[1fr_auto]">
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
            <button
              type="button"
              onClick={() => removeVehiculoRow(index)}
              className="justify-self-end rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
      </>
      ) : null}

      {!mostrarCamposPosteriores ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Maquinaria, trabajos realizados y servicios extras se completan después, al corregir/finalizar el eventual.
        </div>
      ) : null}

      {mostrarCamposPosteriores ? (
      <>
      <div className="mb-1 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
          DETALLE DE TRABAJOS REALIZADOS
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/60 to-white p-4 shadow space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Trabajos realizados</h2>
          <button type="button" onClick={addTrabajo} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">
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
      </>
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

      <ConfirmModal
        open={confirmOpen}
        title={isEdit ? "Confirmar corrección" : "Confirmar creación"}
        message={isEdit
          ? "Se guardarán las correcciones del eventual y se registrarán en el historial."
          : "Se creará el eventual con la información ingresada."}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={submit}
        confirmLabel={saving ? "Guardando..." : isEdit ? "Guardar corrección" : "Crear eventual"}
        cancelLabel="Cancelar"
      />
    </div>
  );
}
