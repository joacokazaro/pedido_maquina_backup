import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

const ESTADOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "reparacion",
  "baja"
];

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
  const [asignacion, setAsignacion] = useState(null);
  const [loading, setLoading] = useState(esEdicion);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const [maqRes, servRes] = await Promise.all([
          esEdicion
            ? fetch(`${API_BASE}/admin/maquinas/${encodeURIComponent(id)}`)
            : Promise.resolve(null),
          fetch(`${API_BASE}/servicios`)
        ]);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        esEdicion
          ? `${API_BASE}/admin/maquinas/${encodeURIComponent(id)}`
          : `${API_BASE}/admin/maquinas`,
        {
          method: esEdicion ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipo: form.tipo,
            modelo: form.modelo,
            serie: form.serie,
            estado: form.estado,
            servicioId: form.servicioId || null
          })
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
      <header className="mb-4 flex justify-between">
        <button onClick={() => navigate(-1)} className="text-xs text-blue-600 underline">
          Volver
        </button>
        <h1 className="text-lg font-bold">
          {esEdicion ? "Editar máquina" : "Nueva máquina"}
        </h1>
        <div />
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

        <input disabled value={form.id} className="w-full p-2 rounded-xl border bg-gray-100" />

        <input name="tipo" value={form.tipo} onChange={handleChange} className="w-full p-2 rounded-xl border" placeholder="Tipo" />
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
    </div>
  );
}
