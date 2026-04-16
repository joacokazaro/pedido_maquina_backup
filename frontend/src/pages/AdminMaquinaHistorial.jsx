import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

function formatEstado(estado) {
  return String(estado || "").replaceAll("_", " ");
}

function formatFecha(fecha) {
  if (!fecha) return "-";

  return new Date(fecha).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function AdminMaquinaHistorial() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [maquina, setMaquina] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(
          `${API_BASE}/admin/maquinas/${encodeURIComponent(id)}/pedidos-historicos`
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo cargar el historial");
        }

        const data = await res.json();
        setMaquina(data.maquina || null);
        setPedidos(data.pedidos || []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando historial");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) {
    return <div className="p-4">Cargando historial de pedidos...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="mx-auto max-w-4xl space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm text-blue-600 underline"
        >
          Volver
        </button>

        <div className="rounded-2xl bg-white p-5 shadow">
          <h1 className="text-2xl font-bold text-gray-900">Pedidos históricos</h1>
          {maquina && (
            <div className="mt-3 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
              <p>
                <span className="font-semibold">Máquina:</span> {maquina.id}
              </p>
              <p>
                <span className="font-semibold">Tipo:</span> {maquina.tipo}
              </p>
              <p>
                <span className="font-semibold">Modelo:</span> {maquina.modelo}
              </p>
              <p>
                <span className="font-semibold">Serie:</span> {maquina.serie || "-"}
              </p>
              <p>
                <span className="font-semibold">Servicio actual:</span> {maquina.servicio?.nombre || "-"}
              </p>
              <p>
                <span className="font-semibold">Estado:</span> {formatEstado(maquina.estado)}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Participó en {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"}
            </h2>
          </div>

          {pedidos.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
              Esta máquina todavía no figura en ningún pedido.
            </p>
          ) : (
            <div className="space-y-3">
              {pedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1 text-sm text-gray-700">
                      <p className="text-base font-semibold text-gray-900">
                        Pedido {pedido.id}
                      </p>
                      <p>
                        <span className="font-medium">Estado:</span> {formatEstado(pedido.estado)}
                      </p>
                      <p>
                        <span className="font-medium">Fecha:</span> {formatFecha(pedido.createdAt)}
                      </p>
                      <p>
                        <span className="font-medium">Servicio:</span> {pedido.servicio?.nombre || "-"}
                      </p>
                      <p>
                        <span className="font-medium">Solicitante:</span> {pedido.supervisor?.nombre || pedido.supervisor?.username || "-"}
                      </p>
                      <p>
                        <span className="font-medium">Destino:</span> {pedido.destino || "-"}
                      </p>
                      {pedido.supervisorDestinoUsername && (
                        <p>
                          <span className="font-medium">Supervisor destino:</span> {pedido.supervisorDestinoUsername}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/admin/pedido/${encodeURIComponent(pedido.id)}`)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    >
                      Ver pedido
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}