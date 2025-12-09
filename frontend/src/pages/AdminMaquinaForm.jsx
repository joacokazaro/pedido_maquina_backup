import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
    estado: "disponible"
  });
  const [loading, setLoading] = useState(esEdicion);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!esEdicion) return;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(
          `http://localhost:3000/admin/maquinas/${encodeURIComponent(id)}`
        );
        if (!res.ok) {
          throw new Error("No se pudo cargar la máquina");
        }
        const data = await res.json();
        setForm({
          id: data.id || "",
          tipo: data.tipo || "",
          modelo: data.modelo || "",
          serie: data.serie || "",
          estado: data.estado || "disponible"
        });
      } catch (e) {
        console.error(e);
        setError("Error cargando la máquina");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [esEdicion, id]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = esEdicion
        ? `http://localhost:3000/admin/maquinas/${encodeURIComponent(id)}`
        : "http://localhost:3000/admin/maquinas";

      const method = esEdicion ? "PUT" : "POST";

      const body = esEdicion
        ? {
            tipo: form.tipo,
            modelo: form.modelo,
            serie: form.serie,
            estado: form.estado
          }
        : form;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error guardando la máquina");
      }

      navigate("/admin/maquinas");
    } catch (e) {
      console.error(e);
      setError(e.message || "Error guardando la máquina");
    } finally {
      setSaving(false);
    }
  }

  async function handleDarDeBaja() {
    const confirmar = window.confirm(
      "¿Seguro que querés dar de baja esta máquina? (estado = BAJA)"
    );
    if (!confirmar) return;

    try {
      const res = await fetch(
        `http://localhost:3000/admin/maquinas/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw new Error("No se pudo dar de baja la máquina");
      }
      navigate("/admin/maquinas");
    } catch (e) {
      console.error(e);
      setError(e.message || "Error al dar de baja");
    }
  }

  if (loading) {
    return <div className="p-4">Cargando máquina...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* HEADER */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-blue-600 underline"
        >
          Volver
        </button>
        <h1 className="text-lg font-bold">
          {esEdicion ? "Editar máquina" : "Nueva máquina"}
        </h1>
        <div className="w-10" />
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow p-4 space-y-3"
      >
        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">
            {error}
          </p>
        )}

        {/* CÓDIGO */}
        <div>
          <label className="block text-xs font-semibold mb-1">
            Código (ID)
          </label>
          <input
            name="id"
            value={form.id}
            onChange={handleChange}
            disabled={esEdicion} // En edición no tocamos el ID
            className="w-full p-2 rounded-xl border border-gray-300 text-sm disabled:bg-gray-100"
            placeholder="Ej: 3.P.20"
          />
          {!esEdicion && (
            <p className="text-[10px] text-gray-500 mt-1">
              Debe ser único y coincidir con el código real de la máquina.
            </p>
          )}
        </div>

        {/* TIPO */}
        <div>
          <label className="block text-xs font-semibold mb-1">
            Tipo de máquina
          </label>
          <input
            name="tipo"
            value={form.tipo}
            onChange={handleChange}
            className="w-full p-2 rounded-xl border border-gray-300 text-sm"
            placeholder="Ej: MOTOGUADAÑA, LAVADORA, HIDROLAVADORA..."
          />
        </div>

        {/* MODELO */}
        <div>
          <label className="block text-xs font-semibold mb-1">
            Marca / Modelo
          </label>
          <input
            name="modelo"
            value={form.modelo}
            onChange={handleChange}
            className="w-full p-2 rounded-xl border border-gray-300 text-sm"
            placeholder="Ej: STIHL FS-280"
          />
        </div>

        {/* SERIE */}
        <div>
          <label className="block text-xs font-semibold mb-1">
            N° de serie (texto libre)
          </label>
          <input
            name="serie"
            value={form.serie}
            onChange={handleChange}
            className="w-full p-2 rounded-xl border border-gray-300 text-sm"
            placeholder='Ej: "N° SERIE: 371102875" o "S/N"'
          />
        </div>

        {/* ESTADO */}
        <div>
          <label className="block text-xs font-semibold mb-1">
            Estado
          </label>
          <select
            name="estado"
            value={form.estado}
            onChange={handleChange}
            className="w-full p-2 rounded-xl border border-gray-300 text-sm"
          >
            {ESTADOS.map(e => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        {/* BOTONES */}
        <div className="pt-2 space-y-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
          >
            {saving
              ? "Guardando..."
              : esEdicion
              ? "Guardar cambios"
              : "Crear máquina"}
          </button>

          {esEdicion && (
            <button
              type="button"
              onClick={handleDarDeBaja}
              className="w-full bg-red-50 text-red-600 py-2.5 rounded-xl text-xs font-semibold"
            >
              Dar de baja máquina
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
