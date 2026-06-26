import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import { formatDateOnly, formatDateTime } from "../utils/date";

export default function SupervisorEventualDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [eventual, setEventual] = useState(null);
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.username) return;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/eventuales/${encodeURIComponent(id)}?username=${encodeURIComponent(user.username)}`);
        if (!res.ok) throw new Error("No se pudo cargar el eventual");
        const data = await res.json();
        setEventual(data);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando eventual");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, user?.username]);

  async function saveObservation() {
    try {
      setSaving(true);
      setError("");
      const res = await fetch(`${API_BASE}/eventuales/${encodeURIComponent(id)}/observaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: user?.username, observacion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo registrar la observacion");
      setObservacion("");
      setEventual(data);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error guardando observacion");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Cargando eventual...</div>;
  if (error || !eventual) return <div className="p-4 text-red-600">{error || "Eventual no encontrado"}</div>;

  const maquinas = Array.isArray(eventual.componentesActuales?.maquinasUtilizadas) ? eventual.componentesActuales.maquinasUtilizadas : [];
  const vehiculos = Array.isArray(eventual.componentesActuales?.vehiculos) ? eventual.componentesActuales.vehiculos : [];
  const isActivo = String(eventual.estado || "").toLowerCase() === "activo";
  const observacionesPosteriores = (Array.isArray(eventual.historial) ? eventual.historial : [])
    .filter((entry) => ["SUPERVISOR_OBSERVACION", "ADMIN_OBSERVACION_POSTERIOR", "COORDINADOR_OBSERVACION_POSTERIOR"].includes(entry?.accion))
    .map((entry) => ({
      id: `${entry.id}-${entry.accion}`,
      autor: entry.usuario?.nombre || entry.usuario?.username || "-",
      fecha: entry.fecha,
      mensaje: String(entry?.detalle?.observacion || "").trim(),
    }))
    .filter((entry) => entry.mensaje)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
      <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm">
        ← Volver
      </button>

      <div className="rounded-2xl bg-white p-5 shadow space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{eventual.nombre}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700">{eventual.estado}</span>
        </div>
        <p className="text-sm text-gray-600">Supervisor: <b>{eventual.supervisor?.nombre || eventual.supervisor?.username || "-"}</b></p>
        <p className="text-sm text-gray-600">Inicio: <b>{formatDateOnly(eventual.fechaInicio)}</b> · Fin: <b>{formatDateOnly(eventual.fechaFin)}</b></p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Componentes utilizados</h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Maquinas por tipo</p>
            {maquinas.length === 0 ? (
              <p className="text-sm text-gray-500">Sin maquinas cargadas.</p>
            ) : (
              <div className="space-y-2">
                {maquinas.map((item, idx) => (
                  <div key={`${item.tipo}-${idx}`} className="rounded-lg border p-3 text-sm">
                    <p className="font-semibold text-gray-900">{item.tipo}</p>
                    <p className="text-xs text-gray-500">Cantidad: {item.cantidad}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Vehiculos</p>
            {vehiculos.length === 0 ? (
              <p className="text-sm text-gray-500">Sin vehiculos cargados.</p>
            ) : (
              <div className="space-y-2">
                {vehiculos.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-semibold text-gray-900">{item.vehiculo} {item.id}</p>
                    <p className="text-xs text-gray-500">{item.modelo} · {item.patente || "sin patente"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {eventual.legacyComponentes ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Datos legados de componentes (solo lectura)</p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">
            {JSON.stringify(eventual.legacyComponentes, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Observaciones posteriores</h2>

        {observacionesPosteriores.length === 0 ? (
          <p className="text-sm text-gray-500">No hay observaciones registradas.</p>
        ) : (
          <div className="space-y-2">
            {observacionesPosteriores.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">{item.autor} · {formatDateTime(item.fecha)}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{item.mensaje}</p>
              </article>
            ))}
          </div>
        )}

        {isActivo ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Agregar observación</p>
            <textarea
              rows={4}
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
              className="w-full rounded-xl border p-3 text-sm"
              placeholder="Escribe una observación para el historial..."
            />
            <div className="flex justify-end">
              <button onClick={saveObservation} disabled={saving || !observacion.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
                {saving ? "Guardando..." : "Guardar observación"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Solo podés agregar observaciones cuando el eventual está activo.
          </div>
        )}
      </div>
    </div>
  );
}
