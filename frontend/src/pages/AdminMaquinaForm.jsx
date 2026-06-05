import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import ConfirmModal from "../components/ConfirmModal";

const ESTADOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "reparacion",
  "baja"
];

function buildTiposOptions(maquinas, tipoActual) {
  return Array.from(
    new Set([...(maquinas || []).map(maquina => maquina.tipo).filter(Boolean), tipoActual].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export default function AdminMaquinaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const esEdicion = Boolean(id);

  const [form, setForm] = useState({
    id: "",
    tipo: "",
    modelo: "",
    serie: "",
    estado: "disponible",
    servicioId: ""
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
            servicioId: data.servicio?.id || ""
          });
          setAsignacion(data.asignacion || null);
          setTipos(buildTiposOptions(maqs, data.tipo));
        } else {
          setTipos(buildTiposOptions(maqs, ""));
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
            Pedidos históricos
          </button>
        )}

        <input
          name="id"
          value={form.id}
          onChange={handleChange}
          disabled={esEdicion}
          className={`w-full p-2 rounded-xl border ${esEdicion ? "bg-gray-100" : "bg-white"}`}
          placeholder="Código (id)"
        />

        <select
          name="tipo"
          value={form.tipo}
          onChange={handleChange}
          className="w-full p-2 rounded-xl border"
        >
          <option value="">— Seleccionar tipo —</option>
          {tipos.map(tipo => (
            <option key={tipo} value={tipo}>{tipo}</option>
          ))}
        </select>
        <input name="modelo" value={form.modelo} onChange={handleChange} className="w-full p-2 rounded-xl border" placeholder="Modelo" />
        <input name="serie" value={form.serie} onChange={handleChange} className="w-full p-2 rounded-xl border" placeholder="Serie" />

        <select name="servicioId" value={form.servicioId} onChange={handleChange} className="w-full p-2 rounded-xl border">
          <option value="">— Seleccionar servicio —</option>
          {servicios.map(s => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>

        <select name="estado" value={form.estado} onChange={handleChange} className="w-full p-2 rounded-xl border">
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <button disabled={saving} className="w-full bg-blue-600 text-white py-2.5 rounded-xl">
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </form>

      {esEdicion && (
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
