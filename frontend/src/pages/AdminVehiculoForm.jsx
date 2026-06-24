import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";

const ESTADOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "taller",
  "baja",
  "activo",
];

const DATE_FIELDS = [
  { key: "vtoSeguro", label: "Vto. seguro", aplicaKey: "vtoSeguroAplica" },
  { key: "vtoMatafuego", label: "Vto. matafuego", aplicaKey: "vtoMatafuegoAplica" },
  { key: "vtoItv", label: "Vto. ITV", aplicaKey: "vtoItvAplica" },
  { key: "obleaGnc", label: "Oblea GNC", aplicaKey: "obleaGncAplica" },
  { key: "pruebaHidraulicaGnc", label: "Prueba hidráulica GNC", aplicaKey: "pruebaHidraulicaGncAplica" },
];

function toDateInput(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function AdminVehiculoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isReadOnly = rolUpper === "COORDINADOR" || rolUpper === "CONSULTOR" || rolUpper === "TALLER";
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    id: "",
    empresa: "",
    estado: "activo",
    vehiculo: "",
    patente: "",
    modelo: "",
    numeroPoliza: "",
    motor: "",
    chasis: "",
    tipoCobertura: "",
    seguroId: "",
    tarjetaVerde: true,
    vtoSeguro: "",
    vtoSeguroAplica: true,
    vtoMatafuego: "",
    vtoMatafuegoAplica: true,
    vtoItv: "",
    vtoItvAplica: true,
    obleaGnc: "",
    obleaGncAplica: true,
    pruebaHidraulicaGnc: "",
    pruebaHidraulicaGncAplica: true,
  });
  const [seguros, setSeguros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [vehiculo, setVehiculo] = useState(null);
  const [usuarioAsignadoId, setUsuarioAsignadoId] = useState("");
  const [observacionAsignacion, setObservacionAsignacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const requests = [
          fetch(`${API_BASE}/admin/seguros`),
          fetch(`${API_BASE}/admin-users?activo=true`),
        ];

        if (isEdit) {
          requests.unshift(fetch(`${API_BASE}/admin/vehiculos/${encodeURIComponent(id)}`));
        }

        const responses = await Promise.all(requests);
        if (responses.some((response) => !response.ok)) {
          throw new Error("No se pudieron cargar los datos del vehículo");
        }

        const payloads = await Promise.all(responses.map((response) => response.json()));

        const vehiculoData = isEdit ? payloads[0] : null;
        const segurosData = isEdit ? payloads[1] : payloads[0];
        const usuariosData = isEdit ? payloads[2] : payloads[1];

        setSeguros(Array.isArray(segurosData) ? segurosData : []);
        setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);

        if (vehiculoData) {
          setVehiculo(vehiculoData);
          setForm({
            id: vehiculoData.id,
            empresa: vehiculoData.empresa || "",
            estado: vehiculoData.estado || "activo",
            vehiculo: vehiculoData.vehiculo || "",
            patente: vehiculoData.patente || "",
            modelo: vehiculoData.modelo || "",
            numeroPoliza: vehiculoData.numeroPoliza || "",
            motor: vehiculoData.motor || "",
            chasis: vehiculoData.chasis || "",
            tipoCobertura: vehiculoData.tipoCobertura || "",
            seguroId: vehiculoData.seguro?.id ? String(vehiculoData.seguro.id) : "",
            tarjetaVerde: vehiculoData.tarjetaVerde !== false,
            vtoSeguro: toDateInput(vehiculoData.vtoSeguro),
            vtoSeguroAplica: vehiculoData.vtoSeguroAplica !== false,
            vtoMatafuego: toDateInput(vehiculoData.vtoMatafuego),
            vtoMatafuegoAplica: vehiculoData.vtoMatafuegoAplica !== false,
            vtoItv: toDateInput(vehiculoData.vtoItv),
            vtoItvAplica: vehiculoData.vtoItvAplica !== false,
            obleaGnc: toDateInput(vehiculoData.obleaGnc),
            obleaGncAplica: vehiculoData.obleaGncAplica !== false,
            pruebaHidraulicaGnc: toDateInput(vehiculoData.pruebaHidraulicaGnc),
            pruebaHidraulicaGncAplica: vehiculoData.pruebaHidraulicaGncAplica !== false,
          });
        }
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando vehículo");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, isEdit]);

  const usuarioActual = useMemo(() => vehiculo?.conductorActual || null, [vehiculo]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleBooleanChange(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function save() {
    if (isReadOnly) return;
    try {
      setSaving(true);
      setError("");

      const payload = {
        ...form,
        seguroId: Number(form.seguroId),
      };

      const res = await fetch(
        isEdit ? `${API_BASE}/admin/vehiculos/${encodeURIComponent(id)}` : `${API_BASE}/admin/vehiculos`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error guardando vehículo");
      }

      navigate(isEdit ? "/admin/vehiculos" : `/admin/vehiculos/${encodeURIComponent(data.id || form.id)}`);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error guardando vehículo");
    } finally {
      setSaving(false);
    }
  }

  async function assignVehicle() {
    if (isReadOnly) return;
    try {
      setError("");
      const res = await fetch(`${API_BASE}/admin/vehiculos/${encodeURIComponent(id)}/asignaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioId: Number(usuarioAsignadoId),
          asignadoPorId: user?.id,
          observacion: observacionAsignacion,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error asignando vehículo");
      }

      navigate(0);
    } catch (e) {
      setError(e.message || "Error asignando vehículo");
    }
  }

  async function unassignVehicle() {
    if (isReadOnly) return;
    try {
      setError("");
      const res = await fetch(`${API_BASE}/admin/vehiculos/${encodeURIComponent(id)}/asignaciones/actual`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacion: observacionAsignacion }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error desasignando vehículo");
      }

      navigate(0);
    } catch (e) {
      setError(e.message || "Error desasignando vehículo");
    }
  }

  async function deleteVehicle() {
    if (isReadOnly) return;
    try {
      const res = await fetch(`${API_BASE}/admin/vehiculos/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Error dando de baja vehículo");
      }

      navigate("/admin/vehiculos");
    } catch (e) {
      setError(e.message || "Error dando de baja vehículo");
    } finally {
      setDeleteOpen(false);
    }
  }

  if (loading) return <div className="p-4">Cargando vehículo...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? "Editar vehículo" : "Nuevo vehículo"}</h1>
          {isEdit && <p className="text-xs text-gray-600">Gestioná los datos, el seguro y la asignación del conductor.</p>}
        </div>

        {isEdit && (
          <button
            type="button"
            onClick={() => navigate(`/admin/vehiculos/${encodeURIComponent(id)}/historial`)}
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Historial de asignaciones
          </button>
        )}
      </div>

      {isEdit && vehiculo?.pedidoActivo && (
        <div className="mb-4 rounded-lg border-l-4 border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <strong>Prestado en pedido {vehiculo.pedidoActivo.id}</strong>
          {vehiculo.pedidoActivo.conFaltantes ? (
            <span className="ml-2 text-xs font-medium text-amber-700">· Con faltantes</span>
          ) : null}
        </div>
      )}

      {error && <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div>}
      {isReadOnly ? <div className="mb-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">Modo solo lectura.</div> : null}

      <div className="rounded-2xl bg-white p-4 shadow space-y-3">
        <input name="id" disabled={isEdit || isReadOnly} value={form.id} onChange={handleChange} className={`w-full rounded-xl border p-3 ${isEdit ? "bg-gray-100" : "bg-white"}`} placeholder="ID" />
        <input name="empresa" value={form.empresa} disabled={isReadOnly} onChange={handleChange} className="w-full rounded-xl border p-3" placeholder="Empresa" />

        <div className="grid gap-3 md:grid-cols-2">
          <input name="vehiculo" value={form.vehiculo} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3" placeholder="Vehículo" />
          <input name="patente" value={form.patente} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3 uppercase" placeholder="Patente" />
          <input name="modelo" value={form.modelo} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3" placeholder="Modelo" />
          <input name="numeroPoliza" value={form.numeroPoliza} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3" placeholder="Número de póliza" />
          <input name="motor" value={form.motor} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3" placeholder="Motor" />
          <input name="chasis" value={form.chasis} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3" placeholder="Chasis" />
          <input name="tipoCobertura" value={form.tipoCobertura} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3" placeholder="Tipo de cobertura" />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <select name="seguroId" value={form.seguroId} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3 bg-white">
            <option value="">Seleccionar seguro</option>
            {seguros.map((seguro) => (
              <option key={seguro.id} value={String(seguro.id)}>{seguro.nombre}</option>
            ))}
          </select>

          <select name="estado" value={form.estado} disabled={isReadOnly} onChange={handleChange} className="rounded-xl border p-3 bg-white">
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>{estado}</option>
            ))}
          </select>

          <select
            value={form.tarjetaVerde ? "si" : "no"}
            disabled={isReadOnly}
            onChange={(e) => handleBooleanChange("tarjetaVerde", e.target.value === "si")}
            className="rounded-xl border p-3 bg-white"
          >
            <option value="si">Tarjeta verde: Tiene</option>
            <option value="no">Tarjeta verde: No tiene</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {DATE_FIELDS.map((field) => (
            <div key={field.key} className="rounded-xl border p-3">
              <label className="mb-2 block text-sm font-semibold text-gray-700">{field.label}</label>
              <select
                value={form[field.aplicaKey] ? "aplica" : "no_aplica"}
                disabled={isReadOnly}
                onChange={(e) => {
                  const aplica = e.target.value === "aplica";
                  setForm((prev) => ({
                    ...prev,
                    [field.aplicaKey]: aplica,
                    [field.key]: aplica ? prev[field.key] : "",
                  }));
                }}
                className="mb-2 w-full rounded-xl border p-2 bg-white text-sm"
              >
                <option value="aplica">Aplica</option>
                <option value="no_aplica">No aplica</option>
              </select>

              <input
                type="date"
                value={form[field.key]}
                disabled={isReadOnly || !form[field.aplicaKey]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className={`w-full rounded-xl border p-2 ${form[field.aplicaKey] ? "bg-white" : "bg-gray-100"}`}
              />
            </div>
          ))}
        </div>

        {!isReadOnly ? (
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-blue-600 p-3 font-semibold text-white shadow">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        ) : null}
      </div>

      {isEdit && !isReadOnly && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow space-y-3">
          <h2 className="text-lg font-semibold">Asignación de conductor</h2>

          {usuarioActual ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p><b>Asignado a:</b> {usuarioActual.nombre || usuarioActual.username}</p>
              <p><b>Usuario:</b> @{usuarioActual.username}</p>
              <p><b>Vto. carnet:</b> {usuarioActual.vtoCarnetConductor ? new Date(usuarioActual.vtoCarnetConductor).toLocaleDateString("es-AR") : "-"}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">El vehículo no tiene conductor asignado.</p>
          )}

          <textarea
            value={observacionAsignacion}
            onChange={(e) => setObservacionAsignacion(e.target.value)}
            className="w-full rounded-xl border p-3"
            rows={3}
            placeholder="Observación de asignación o desasignación"
          />

          {!usuarioActual && (
            <div className="flex flex-col gap-3 md:flex-row">
              <select value={usuarioAsignadoId} onChange={(e) => setUsuarioAsignadoId(e.target.value)} className="flex-1 rounded-xl border p-3 bg-white">
                <option value="">Seleccionar usuario</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={String(usuario.id)}>
                    {(usuario.nombre || usuario.username)} ({usuario.rol})
                  </option>
                ))}
              </select>

              <button onClick={assignVehicle} disabled={!usuarioAsignadoId} className="rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:bg-green-300">
                Asignar vehículo
              </button>
            </div>
          )}

          {usuarioActual && (
            <button onClick={unassignVehicle} className="w-full rounded-xl bg-orange-600 p-3 font-semibold text-white">
              Desasignar vehículo
            </button>
          )}
        </div>
      )}

      {isEdit && !isReadOnly && (
        <button onClick={() => setDeleteOpen(true)} className="mt-4 w-full rounded-xl bg-red-600 py-3 text-white">
          Dar de baja
        </button>
      )}

      <ConfirmModal
        open={deleteOpen}
        title="Dar de baja vehículo"
        message={`¿Confirmás dar de baja el vehículo ${form.id}? Se cerrará la asignación activa si existe.`}
        confirmLabel="Dar de baja"
        cancelLabel="Cancelar"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={deleteVehicle}
      />
    </div>
  );
}
