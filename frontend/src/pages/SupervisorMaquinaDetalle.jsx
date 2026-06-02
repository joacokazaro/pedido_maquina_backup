import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";

const ESTADOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "reparacion",
  "baja",
];

export default function SupervisorMaquinaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [maquina, setMaquina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id || !id) return;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [supervisorRes, maquinaRes] = await Promise.all([
          fetch(`${API_BASE}/supervisores/${user.id}/maquinas`),
          fetch(`${API_BASE}/maquinas/${encodeURIComponent(id)}`),
        ]);

        if (!supervisorRes.ok) {
          throw new Error("No se pudo validar el acceso a la máquina");
        }

        if (!maquinaRes.ok) {
          const data = await maquinaRes.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo cargar la máquina");
        }

        const supervisorData = await supervisorRes.json();
        const maquinaData = await maquinaRes.json();
        const maquinasSupervisor = mergeSupervisorMaquinas(supervisorData);
        const maquinaSupervisor = maquinasSupervisor.find((item) => item.id === id);

        if (!maquinaSupervisor) {
          throw new Error("La máquina no pertenece a tus servicios o préstamos activos");
        }

        setMaquina({
          id: maquinaData.id,
          tipo: maquinaData.tipo,
          modelo: maquinaData.modelo,
          serie: maquinaData.serie || "",
          estado: maquinaData.estado,
          servicioOriginal: maquinaSupervisor.servicio || null,
          servicioActual: maquinaSupervisor.servicioActual || maquinaSupervisor.servicio || null,
          pedido: maquinaSupervisor.pedido || null,
          origen: maquinaSupervisor.origen,
        });
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando la máquina");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, user?.id]);

  const linkPedido = useMemo(() => {
    if (!maquina?.pedido?.id) return null;
    return maquina.pedido.tipo === "PRESTAMO"
      ? `/supervisor/prestamo/${encodeURIComponent(maquina.pedido.id)}`
      : `/supervisor/pedido/${encodeURIComponent(maquina.pedido.id)}`;
  }, [maquina]);

  if (loading) return <div className="p-4">Cargando máquina...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!maquina) return <div className="p-4 text-gray-500">Máquina no encontrada.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <header className="mb-4 flex justify-between">
        <button onClick={() => navigate(-1)} className="text-xs text-blue-600 underline">
          Volver
        </button>
        <h1 className="text-lg font-bold">Detalle de máquina</h1>
        <div />
      </header>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        {maquina.pedido && (
          <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-xl text-xs space-y-1">
            <p>
              <b>Movimiento activo:</b>{" "}
              {maquina.pedido.tipo === "PRESTAMO" ? "Préstamo recibido" : "Pedido propio"}
            </p>
            <p>
              <b>Solicitante:</b> {maquina.pedido.supervisorSolicitante || "-"}
            </p>
            <p>
              <b>Pedido relacionado:</b>{" "}
              {linkPedido ? (
                <Link
                  to={linkPedido}
                  className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-800"
                >
                  {maquina.pedido.id}
                </Link>
              ) : (
                "-"
              )}
            </p>
          </div>
        )}

        <input value={maquina.id} disabled className="w-full p-2 rounded-xl border bg-gray-100" />
        <input value={maquina.tipo} disabled className="w-full p-2 rounded-xl border bg-gray-100" />
        <input value={maquina.modelo} disabled className="w-full p-2 rounded-xl border bg-gray-100" />
        <input value={maquina.serie} disabled className="w-full p-2 rounded-xl border bg-gray-100" placeholder="Sin serie" />
        <input
          value={maquina.servicioOriginal?.nombre || "-"}
          disabled
          className="w-full p-2 rounded-xl border bg-gray-100"
        />

        {maquina.pedido && maquina.servicioActual?.id !== maquina.servicioOriginal?.id && (
          <input
            value={maquina.servicioActual?.nombre || "-"}
            disabled
            className="w-full p-2 rounded-xl border bg-gray-100"
          />
        )}

        <select value={maquina.estado} disabled className="w-full p-2 rounded-xl border bg-gray-100 text-gray-700">
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function mergeSupervisorMaquinas(payload) {
  const maquinasFijas = Array.isArray(payload?.maquinasFijas) ? payload.maquinasFijas : [];
  const maquinasTemporales = Array.isArray(payload?.maquinasTemporales)
    ? payload.maquinasTemporales
    : [];

  const merged = new Map();

  for (const maquina of maquinasFijas) {
    merged.set(maquina.id, {
      ...maquina,
      origen: "FIJA",
      servicioActual: maquina.servicio || null,
      pedido: null,
    });
  }

  for (const maquina of maquinasTemporales) {
    const prev = merged.get(maquina.id);
    merged.set(maquina.id, {
      ...(prev || {}),
      ...maquina,
      origen: prev ? "FIJA_CON_MOVIMIENTO" : "TEMPORAL",
      servicio: prev?.servicio || maquina.servicio || null,
      servicioActual: maquina.servicioActual || prev?.servicioActual || maquina.servicio || null,
    });
  }

  return Array.from(merged.values());
}
