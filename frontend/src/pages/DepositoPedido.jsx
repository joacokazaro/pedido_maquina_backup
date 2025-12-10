// src/pages/DepositoPedido.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function DepositoPedido() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`http://localhost:3000/pedidos/${id}`);

        if (!res.ok) throw new Error("No se encontró el pedido");

        const data = await res.json();

        if (!data || typeof data !== "object" || !data.id) {
          throw new Error("Respuesta inválida del servidor");
        }

        setPedido(data);
      } catch (err) {
        setError("Error cargando el pedido");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) return <div className="p-6">Cargando pedido...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  // 🔎 Buscar observación (en pedido directo o en historial.detalle)
  const observacion =
    pedido.observacion ||
    (
      pedido.historial.find(
        (h) => h.detalle && typeof h.detalle.observacion === "string"
      ) || {}
    ).detalle?.observacion ||
    "";

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* Botón volver */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg 
                   bg-white border border-gray-200 shadow-sm 
                   hover:shadow transition text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      {/* Título */}
      <h1 className="text-2xl font-bold mb-1">Pedido {pedido.id}</h1>
      <p className="text-sm text-gray-600 mb-4">
        Supervisor: <b>{pedido.supervisor}</b>
      </p>

      {/* Estado */}
      <div className="mb-4">
        <span className="px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
          {pedido.estado.replace("_", " ")}
        </span>
      </div>

      {/* 📝 Observación del supervisor */}
      {observacion && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-1">Observación del supervisor</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {observacion}
          </p>
        </div>
      )}

      {/* Solicitado */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Solicitado</h2>

        <div className="space-y-2">
          {pedido.itemsSolicitados.map((i, idx) => (
            <div
              key={idx}
              className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm"
            >
              <span>{i.tipo}</span>
              <span className="font-bold">{i.cantidad}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Máquinas asignadas */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas asignadas</h2>

        {pedido.itemsAsignados.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no se asignaron máquinas.</p>
        ) : (
          <div className="space-y-3">
            {pedido.itemsAsignados.map((m, idx) => (
              <div
                key={idx}
                className="bg-gray-50 px-3 py-2 rounded-lg text-sm"
              >
                <p className="font-semibold">{m.tipo} — {m.id}</p>
                <p className="text-xs text-gray-600">{m.modelo}</p>
                <p className="text-xs text-gray-500">Serie: {m.serie}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Historial</h2>

        <div className="space-y-5">
          {pedido.historial.map((h, idx) => (
            <div key={idx} className="flex gap-4">

              {/* Línea temporal */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                {idx !== pedido.historial.length - 1 && (
                  <div className="flex-1 w-0.5 bg-gray-300"></div>
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1">
                <p className="font-semibold text-sm">{h.accion.replace("_", " ")}</p>
                <p className="text-xs text-gray-500 mb-2">
                  {new Date(h.fecha).toLocaleString()}
                </p>

                {h.detalle && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-2">

                    {"asignadas" in h.detalle && (
                      <div>
                        <p className="font-semibold">Máquinas asignadas:</p>
                        <ul className="list-disc ml-5">
                          {h.detalle.asignadas.map((m, i) => (
                            <li key={i}>{m.tipo} – {m.id}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {"solicitado" in h.detalle && (
                      <div>
                        <p className="font-semibold">Solicitado:</p>
                        <ul className="list-disc ml-5">
                          {Object.entries(h.detalle.solicitado).map(([tipo, cant]) => (
                            <li key={tipo}>{tipo}: {cant}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {"asignadoPorTipo" in h.detalle && (
                      <div>
                        <p className="font-semibold">Asignado por tipo:</p>
                        <ul className="list-disc ml-5">
                          {Object.entries(h.detalle.asignadoPorTipo).map(([tipo, cant]) => (
                            <li key={tipo}>{tipo}: {cant}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {h.detalle.observacion && (
                      <div>
                        <p className="font-semibold">Observación:</p>
                        <p>{h.detalle.observacion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACCIONES */}
      <div className="space-y-3 max-w-xl mx-auto">

        {/* Asignar máquinas */}
        <button
          onClick={() => navigate(`/deposito/pedido/${id}/asignar`)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-blue-700 transition"
        >
          Asignar máquinas
        </button>

        {/* PREPARADO */}
        {pedido.estado === "PENDIENTE_PREPARACION" && (
          <button
            onClick={() => marcarEstado(id, "PREPARADO", navigate)}
            className="w-full bg-yellow-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-yellow-700 transition"
          >
            Marcar como PREPARADO
          </button>
        )}

        {/* ENTREGADO */}
        {pedido.estado === "PREPARADO" && (
          <button
            onClick={() => entregarPedido(id, navigate)}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-green-700 transition"
          >
            Marcar como ENTREGADO
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================
   FUNCIONES AUXILIARES
============================ */

async function marcarEstado(id, nuevoEstado, navigate) {
  await fetch(`http://localhost:3000/pedidos/${id}/estado`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      estado: nuevoEstado,
      usuario: "deposito"
    })
  });

  navigate("/deposito");
}

async function entregarPedido(id, navigate) {
  await fetch(`http://localhost:3000/pedidos/${id}/entregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usuario: "deposito"
    })
  });

  navigate("/deposito");
}
