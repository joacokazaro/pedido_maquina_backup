import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import HistorialEventual from "../components/HistorialEventual";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import { formatDateOnly } from "../utils/date";

export default function SupervisorEventualDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [eventual, setEventual] = useState(null);
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const maquinasUtilizadas = eventual?.componentesUtilizados?.maquinas?.length ? eventual.componentesUtilizados.maquinas : (eventual?.kit?.maquinas || []);
  const vehiculosUtilizados = eventual?.componentesUtilizados?.vehiculos?.length ? eventual.componentesUtilizados.vehiculos : (eventual?.kit?.vehiculos || []);

  useEffect(() => {
    if (!user?.username) return;

    async function loadEventual() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/eventuales/${encodeURIComponent(id)}?username=${encodeURIComponent(user.username)}`);
        if (!res.ok) throw new Error("No se pudo cargar el eventual");
        const data = await res.json();
        setEventual(data);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message || "Error cargando eventual");
      } finally {
        setLoading(false);
      }
    }

    loadEventual();
  }, [id, user?.username]);

  async function saveObservation() {
    try {
      setSaving(true);
      setError("");
      const res = await fetch(`${API_BASE}/eventuales/${encodeURIComponent(id)}/observaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: user?.username,
          observacion,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo registrar la observacion");
      setObservacion("");
      setEventual(data);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || "Error guardando observacion");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Cargando eventual...</div>;
  if (error || !eventual) return <div className="p-4 text-red-600">{error || "Eventual no encontrado"}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
      >
        ← Volver
      </button>

      <div className="rounded-2xl bg-white p-5 shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{eventual.nombre}</h1>
              <span className={eventual.estado === "activo" ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700" : eventual.estado === "finalizado" ? "rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700" : "rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase text-rose-700"}>
                {eventual.estado}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600">Supervisor responsable: <b>{eventual.supervisor?.nombre || eventual.supervisor?.username || "-"}</b></p>
            <p className="text-sm text-gray-600">
              Inicio: <b>{formatDateOnly(eventual.fechaInicio)}</b>
              {" · "}
              Fin: <b>{formatDateOnly(eventual.fechaFin)}</b>
            </p>
            {/* Observaciones se muestran solo en el historial */}
          </div>

          {/* Supervisor ya no puede finalizar eventuales */}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Kit actual</h2>
        {!eventual.kit ? (
          <p className="text-sm text-gray-500">Este eventual no tiene kit asociado.</p>
        ) : (
          <>
            <div>
              <p className="text-base font-semibold text-gray-900">{eventual.kit.nombre}</p>
              {eventual.kit.observaciones ? <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{eventual.kit.observaciones}</p> : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Maquinas utilizadas</h3>
                <div className="space-y-2">
                  {maquinasUtilizadas.map((maquina) => (
                    <div key={maquina.id} className="rounded-xl border p-3">
                      <p className="text-sm font-semibold text-gray-900">{maquina.tipo} {maquina.id}</p>
                      <p className="text-xs text-gray-500">{maquina.modelo} · {maquina.serie || "Sin serie"}</p>
                      <p className="text-xs text-gray-500">Estado: {maquina.estado}</p>
                    </div>
                  ))}
                  {!maquinasUtilizadas.length ? <p className="text-sm text-gray-500">Sin maquinas.</p> : null}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Vehiculos utilizados</h3>
                <div className="space-y-2">
                  {vehiculosUtilizados.map((vehiculo) => (
                    <div key={vehiculo.id} className="rounded-xl border p-3">
                      <p className="text-sm font-semibold text-gray-900">{vehiculo.vehiculo} {vehiculo.id}</p>
                      <p className="text-xs text-gray-500">{vehiculo.modelo} · {vehiculo.patente}</p>
                      <p className="text-xs text-gray-500">Estado: {vehiculo.estado}</p>
                    </div>
                  ))}
                  {!vehiculosUtilizados.length ? <p className="text-sm text-gray-500">Sin vehiculos.</p> : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-white p-5 shadow space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Agregar observacion</h2>
        <textarea
          rows={4}
          value={observacion}
          onChange={(event) => setObservacion(event.target.value)}
          className="w-full rounded-xl border p-3 text-sm"
          placeholder="Escribe una observacion para el historial del eventual..."
        />
        <div className="flex justify-end">
          <button onClick={saveObservation} disabled={saving || !observacion.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
            {saving ? "Guardando..." : "Guardar observacion"}
          </button>
        </div>
      </div>

      <HistorialEventual historial={eventual.historial} compact />
    </div>
  );
}
