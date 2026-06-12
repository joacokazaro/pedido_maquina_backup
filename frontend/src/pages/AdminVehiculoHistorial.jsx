import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminVehiculoHistorial() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/admin/vehiculos/${encodeURIComponent(id)}/historial`);
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "No se pudo cargar el historial del vehículo");
        }

        setPayload(data);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando historial");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) return <div className="p-4">Cargando historial...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  const vehiculo = payload?.vehiculo;
  const historial = Array.isArray(payload?.historial) ? payload.historial : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="mx-auto max-w-4xl space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
        >
          ← Volver
        </button>

        <div className="rounded-2xl bg-white p-5 shadow">
          <h1 className="text-2xl font-bold">Historial de asignaciones</h1>
          {vehiculo && (
            <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
              <p><span className="font-semibold">Vehículo:</span> {vehiculo.vehiculo}</p>
              <p><span className="font-semibold">ID:</span> {vehiculo.id}</p>
              <p><span className="font-semibold">Patente:</span> {vehiculo.patente}</p>
              <p><span className="font-semibold">Empresa:</span> {vehiculo.empresa}</p>
              {vehiculo.pedidoActivo ? (
                <p className="col-span-2 text-amber-700">Prestado en pedido <b>{vehiculo.pedidoActivo.id}</b>{vehiculo.pedidoActivo.conFaltantes ? ' · Con faltantes' : ''}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-lg font-semibold">Movimientos</h2>

          {historial.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Todavía no hay asignaciones registradas para este vehículo.</p>
          ) : (
            <div className="space-y-3">
              {historial.map((item) => (
                <div key={item.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">{item.usuario?.nombre || item.usuario?.username || "Usuario"}</p>
                  <p>Desde: <b>{formatDate(item.fechaDesde)}</b></p>
                  <p>Hasta: <b>{formatDate(item.fechaHasta)}</b></p>
                  <p>Asignó: <b>{item.asignadoPor?.nombre || item.asignadoPor?.username || "-"}</b></p>
                  <p>Observación: <b>{item.observacion || "-"}</b></p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
