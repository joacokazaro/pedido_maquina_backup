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

function formatSoloFecha(fecha) {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleDateString("es-AR");
}

function formatMoneda(valor, currency) {
  if (valor === null || valor === undefined || valor === "") return "-";
  const num = Number(valor);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function AdminMaquinaHistorial() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [maquina, setMaquina] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [eventuales, setEventuales] = useState([]);
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
        setEventuales(data.eventuales || []);
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
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
        >
          ← Volver
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
                <p>
                  <span className="font-semibold">Fecha compra:</span> {formatSoloFecha(maquina.fechaCompra)}
                </p>
                <p>
                  <span className="font-semibold">Empresa:</span> {maquina.empresa || "-"}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold">Proveedor / N° factura:</span> {maquina.proveedorFactura || "-"}
                </p>
                <p>
                  <span className="font-semibold">Año:</span> {maquina.anio ?? "-"}
                </p>
                <p>
                  <span className="font-semibold">Antigüedad:</span> {maquina.antiguedad ?? "-"}
                </p>
                <p>
                  <span className="font-semibold">Amortización:</span> {maquina.amortizacion ?? "-"}
                </p>
                <p>
                  <span className="font-semibold">Servicio amortización:</span> {maquina.servicioAmortizacion?.nombre || "-"}
                </p>
                <p>
                  <span className="font-semibold">Valor usada USD:</span> {formatMoneda(maquina.valorUsadaDolares, "USD")}
                </p>
                <p>
                  <span className="font-semibold">Valor usada ARS:</span> {formatMoneda(maquina.valorUsadaPesos, "ARS")}
                </p>
                <p>
                  <span className="font-semibold">Valor nueva USD:</span> {formatMoneda(maquina.valorNuevaDolares, "USD")}
                </p>
                <p>
                  <span className="font-semibold">Valor nueva ARS:</span> {formatMoneda(maquina.valorNuevaPesos, "ARS")}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold">Origen info:</span> {maquina.origenInfo || "-"}
                </p>
                <p className="md:col-span-2">
                  <span className="font-semibold">Comentarios:</span> {maquina.comentarios || "-"}
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

          <div className="my-6 border-t border-gray-200" />

          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              Participó en {eventuales.length} eventual{eventuales.length === 1 ? "" : "es"}
            </h2>
          </div>

          {eventuales.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
              Esta máquina todavía no figura en ningún eventual.
            </p>
          ) : (
            <div className="space-y-3">
              {eventuales.map((eventual) => (
                <div
                  key={eventual.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1 text-sm text-gray-700">
                      <p className="text-base font-semibold text-gray-900">
                        Eventual #{eventual.id} - {eventual.nombre}
                      </p>
                      <p>
                        <span className="font-medium">Estado:</span> {formatEstado(eventual.estado)}
                      </p>
                      <p>
                        <span className="font-medium">Fecha alta:</span> {formatFecha(eventual.createdAt)}
                      </p>
                      <p>
                        <span className="font-medium">Fecha inicio:</span> {formatFecha(eventual.fechaInicio)}
                      </p>
                      <p>
                        <span className="font-medium">Fecha fin:</span> {formatFecha(eventual.fechaFin)}
                      </p>
                      <p>
                        <span className="font-medium">Supervisor:</span> {eventual.supervisor?.nombre || eventual.supervisor?.username || "-"}
                      </p>
                      <p>
                        <span className="font-medium">Kit:</span> {eventual.kit?.nombre || "-"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/admin/eventuales/${encodeURIComponent(eventual.id)}`)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                    >
                      Ver eventual
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