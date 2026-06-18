import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { buildMachineTypeOptions } from "../constants/maquinas";

const ESTADOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "reparacion",
  "baja"
];

const EMPRESAS = ["Pulizia", "Pazar"];

function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toNullableNumber(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export default function AdminMaquinaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const esEdicion = Boolean(id);
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isReadOnly = rolUpper === "COORDINADOR" || rolUpper === "CONSULTOR";

  const [form, setForm] = useState({
    id: "",
    tipo: "",
    modelo: "",
    serie: "",
    estado: "disponible",
    servicioId: "",
    fechaCompra: "",
    proveedorFactura: "",
    empresa: "",
    anio: "",
    amortizacion: "",
    antiguedad: "",
    valorUsadaDolares: "",
    valorUsadaPesos: "",
    valorNuevaDolares: "",
    valorNuevaPesos: "",
    origenInfo: "",
    servicioAmortizacionId: "",
    comentarios: ""
  });

  const [servicios, setServicios] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [asignacion, setAsignacion] = useState(null);
  const [loading, setLoading] = useState(esEdicion);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [maqRes, servRes, maqsRes] = await Promise.all([
          esEdicion
            ? fetch(`${API_BASE}/admin/maquinas/${encodeURIComponent(id)}`)
            : Promise.resolve(null),
          fetch(`${API_BASE}/servicios`),
          fetch(`${API_BASE}/admin/maquinas`)
        ]);

        const maqs = await maqsRes.json();

        if (esEdicion) {
          const data = await maqRes.json();
          setForm({
            id: data.id,
            tipo: data.tipo,
            modelo: data.modelo,
            serie: data.serie || "",
            estado: data.estado,
            servicioId: data.servicio?.id || "",
            fechaCompra: toDateInputValue(data.fechaCompra),
            proveedorFactura: data.proveedorFactura || "",
            empresa: data.empresa || "",
            anio: data.anio ?? "",
            amortizacion: data.amortizacion ?? "",
            antiguedad: data.antiguedad ?? "",
            valorUsadaDolares: data.valorUsadaDolares ?? "",
            valorUsadaPesos: data.valorUsadaPesos ?? "",
            valorNuevaDolares: data.valorNuevaDolares ?? "",
            valorNuevaPesos: data.valorNuevaPesos ?? "",
            origenInfo: data.origenInfo || "",
            servicioAmortizacionId: data.servicioAmortizacion?.id || "",
            comentarios: data.comentarios || ""
          });
          setAsignacion(data.asignacion || null);
          setTipos(buildMachineTypeOptions(maqs, data.tipo));
        } else {
          setTipos(buildMachineTypeOptions(maqs, ""));
        }

        setServicios(await servRes.json());
      } catch (e) {
        console.error(e);
        setError("Error cargando datos");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [esEdicion, id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleDelete() {
    try {
      const res = await fetch(`${API_BASE}/admin/maquinas/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error eliminando máquina");
      }

      navigate("/admin/maquinas");
    } catch (e) {
      setError(e.message || "Error eliminando máquina");
    } finally {
      setConfirmDeleteOpen(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isReadOnly) return;
    setSaving(true);
    setError("");

    if (!esEdicion && String(form.id || "").trim() === "") {
      setSaving(false);
      setError("El código (id) es obligatorio");
      return;
    }

    if (String(form.tipo || "").trim() === "" || String(form.modelo || "").trim() === "" || String(form.servicioId || "").trim() === "") {
      setSaving(false);
      setError("Tipo, modelo y servicio son obligatorios");
      return;
    }

    try {
      const payload = {
        tipo: form.tipo,
        modelo: form.modelo,
        serie: form.serie,
        estado: form.estado,
        servicioId: form.servicioId ? Number(form.servicioId) : null,
        fechaCompra: form.fechaCompra || null,
        proveedorFactura: form.proveedorFactura || null,
        empresa: form.empresa || null,
        anio: form.anio === "" ? null : Number(form.anio),
        amortizacion: form.amortizacion === "" ? null : Number(form.amortizacion),
        valorUsadaDolares: toNullableNumber(form.valorUsadaDolares),
        valorUsadaPesos: toNullableNumber(form.valorUsadaPesos),
        valorNuevaDolares: toNullableNumber(form.valorNuevaDolares),
        valorNuevaPesos: toNullableNumber(form.valorNuevaPesos),
        origenInfo: form.origenInfo || null,
        servicioAmortizacionId: form.servicioAmortizacionId ? Number(form.servicioAmortizacionId) : null,
        comentarios: form.comentarios || null,
      };

      if (!esEdicion) {
        payload.id = String(form.id).trim();
      }

      const res = await fetch(
        esEdicion
          ? `${API_BASE}/admin/maquinas/${encodeURIComponent(id)}`
          : `${API_BASE}/admin/maquinas`,
        {
          method: esEdicion ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error guardando");
      }

      navigate("/admin/maquinas");
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Cargando máquina...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <header className="mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
        >
          ← Volver
        </button>
        <h1 className="text-lg font-bold">
          {esEdicion ? "Editar máquina" : "Nueva máquina"}
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-4 space-y-3">
        {isReadOnly ? (
          <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded">Modo solo lectura.</p>
        ) : null}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}

        {asignacion && (
          <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-xl text-xs">
            <p><b>Asignada a servicio:</b> {asignacion.servicio}</p>
            <p><b>Pedido:</b> {asignacion.pedidoId}</p>
          </div>
        )}

        {esEdicion && (
          <button
            type="button"
            onClick={() => navigate(`/admin/maquinas/${encodeURIComponent(id)}/pedidos-historicos`)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 font-medium text-slate-700"
          >
            Pedidos y servicios históricos
          </button>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Código (id)</label>
          <input
            name="id"
            value={form.id}
            onChange={handleChange}
            disabled={esEdicion || isReadOnly}
            className={`w-full p-2 rounded-xl border ${esEdicion ? "bg-gray-100" : "bg-white"}`}
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Tipo</label>
          <select
            name="tipo"
            value={form.tipo}
            onChange={handleChange}
            disabled={isReadOnly}
            className="w-full p-2 rounded-xl border"
          >
            <option value="">— Seleccionar tipo —</option>
            {tipos.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Modelo</label>
          <input name="modelo" value={form.modelo} onChange={handleChange} disabled={isReadOnly} className="w-full p-2 rounded-xl border" />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Serie</label>
          <input name="serie" value={form.serie} onChange={handleChange} disabled={isReadOnly} className="w-full p-2 rounded-xl border" />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Servicio</label>
          <select name="servicioId" value={form.servicioId} onChange={handleChange} disabled={isReadOnly} className="w-full p-2 rounded-xl border">
            <option value="">— Seleccionar servicio —</option>
            {servicios.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-gray-600">Estado</label>
          <select name="estado" value={form.estado} onChange={handleChange} disabled={isReadOnly} className="w-full p-2 rounded-xl border">
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Datos de compra y valuación</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Fecha de compra</label>
              <input
                type="date"
                name="fechaCompra"
                value={form.fechaCompra}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Empresa</label>
              <select
                name="empresa"
                value={form.empresa}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              >
                <option value="">— Seleccionar empresa —</option>
                {EMPRESAS.map((empresa) => (
                  <option key={empresa} value={empresa}>{empresa}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Proveedor / N° factura</label>
              <input
                name="proveedorFactura"
                value={form.proveedorFactura}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Año</label>
              <input
                type="number"
                name="anio"
                value={form.anio}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Antigüedad (años)</label>
              <input
                name="antiguedad"
                value={form.anio === "" ? "" : Math.max(new Date().getFullYear() - Number(form.anio), 0)}
                disabled
                className="w-full p-2 rounded-xl border bg-gray-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Amortización (int)</label>
              <input
                type="number"
                name="amortizacion"
                value={form.amortizacion}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Servicio para amortización</label>
              <select
                name="servicioAmortizacionId"
                value={form.servicioAmortizacionId}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              >
                <option value="">— Sin servicio específico —</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Valor usada (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="valorUsadaDolares"
                value={form.valorUsadaDolares}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Valor herramienta usada (pesos)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="valorUsadaPesos"
                value={form.valorUsadaPesos}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Valor herramienta nueva (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="valorNuevaDolares"
                value={form.valorNuevaDolares}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Valor herramienta nueva (pesos)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="valorNuevaPesos"
                value={form.valorNuevaPesos}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Origen info</label>
              <input
                name="origenInfo"
                value={form.origenInfo}
                onChange={handleChange}
                disabled={isReadOnly}
                className="w-full p-2 rounded-xl border"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Comentarios</label>
              <textarea
                name="comentarios"
                value={form.comentarios}
                onChange={handleChange}
                disabled={isReadOnly}
                rows={3}
                className="w-full p-2 rounded-xl border"
              />
            </div>
          </div>
        </div>

        {!isReadOnly ? (
          <button disabled={saving} className="w-full bg-blue-600 text-white py-2.5 rounded-xl">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        ) : null}
      </form>

      {esEdicion && !isReadOnly && (
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          className="mt-4 w-full bg-red-600 text-white py-2.5 rounded-xl"
        >
          Eliminar
        </button>
      )}

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Eliminar máquina"
        message={`¿Confirmás eliminar la máquina ${form.id || id}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
