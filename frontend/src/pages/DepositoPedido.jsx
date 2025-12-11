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

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* Volver */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg 
                   bg-white border border-gray-200 shadow-sm hover:shadow 
                   text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      {/* Título */}
      <h1 className="text-2xl font-bold mb-1">Pedido {pedido.id}</h1>
      <p className="text-sm text-gray-600 mb-4">Supervisor: <b>{pedido.supervisor}</b></p>

      {/* Estado */}
      <span className="px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
        {pedido.estado.replace("_", " ")}
      </span>

      {/* Servicio */}
      {pedido.servicio && (
        <div className="bg-white rounded-xl shadow p-4 my-4 border-l-4 border-green-500">
          <h2 className="text-lg font-semibold mb-1">Servicio</h2>
          <p className="text-sm text-gray-700">{pedido.servicio}</p>
        </div>
      )}

      {/* Observación inicial */}
      {pedido.observacion && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-1">Observación</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {pedido.observacion}
          </p>
        </div>
      )}

      {/* Máquinas asignadas */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas asignadas</h2>

        {pedido.itemsAsignados.map((m, idx) => (
          <div key={idx} className="bg-gray-50 px-3 py-2 rounded-lg text-sm">
            <p className="font-semibold">{m.tipo} — {m.id}</p>
            <p className="text-xs text-gray-600">{m.modelo}</p>
            <p className="text-xs text-gray-500">Serie: {m.serie}</p>
          </div>
        ))}
      </div>

      {/* HISTORIAL — IGUAL QUE ViewPedido */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Historial</h2>

        <div className="space-y-6">
          {pedido.historial.map((h, idx) => {
            const d = h.detalle || {};

            return (
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

                  <div className="rounded-lg p-3 border bg-gray-50 space-y-3 text-xs">

                    {/* Servicio */}
                    {d.servicio && (
                      <div>
                        <p className="font-semibold">Servicio:</p>
                        <p>{d.servicio}</p>
                      </div>
                    )}

                    {/* Devueltas por supervisor */}
                    {d.devueltas && (
                      <div className="bg-blue-100 border border-blue-400 p-2 rounded">
                        <p className="font-semibold">Devueltas por supervisor:</p>
                        <ul className="list-disc ml-5">
                          {d.devueltas.map((id, i) => <li key={i}>{id}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Faltantes según supervisor */}
                    {d.faltantes && d.faltantes.length > 0 && (
                      <div className="bg-yellow-100 border border-yellow-500 p-2 rounded">
                        <p className="font-semibold">Faltantes según supervisor:</p>
                        <ul className="list-disc ml-5">
                          {d.faltantes.map((id, i) => <li key={i}>{id}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Devueltas confirmadas (Depósito) */}
                    {d.devueltasConfirmadas && (
                      <div className="bg-green-100 border border-green-500 p-2 rounded">
                        <p className="font-semibold">Ingreso confirmado por depósito:</p>
                        <ul className="list-disc ml-5">
                          {d.devueltasConfirmadas.map((id, i) => <li key={i}>{id}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Faltantes confirmados (Depósito) */}
                    {d.faltantesConfirmados && d.faltantesConfirmados.length > 0 && (
                      <div className="bg-red-100 border border-red-500 p-2 rounded">
                        <p className="font-semibold">Faltantes confirmados finales:</p>
                        <ul className="list-disc ml-5 text-red-700">
                          {d.faltantesConfirmados.map((id, i) => <li key={i}>{id}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Observación depósito */}
                    {d.observacion && (
                      <div className="bg-blue-100 border border-blue-400 p-2 rounded">
                        <p className="font-semibold">Observación depósito:</p>
                        <p>{d.observacion}</p>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTONES DE ACCIÓN */}

      {/* Asignar máquinas solo si no está cerrado */}
      {pedido.estado !== "CERRADO" && (
        <button
          onClick={() => navigate(`/deposito/pedido/${id}/asignar`)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-blue-700 transition"
        >
          Asignar máquinas
        </button>
      )}

      {pedido.estado === "PENDIENTE_PREPARACION" && (
        <button
          onClick={() => marcarEstado(id, "PREPARADO", navigate)}
          className="w-full bg-yellow-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-yellow-700 transition"
        >
          Marcar como PREPARADO
        </button>
      )}

      {pedido.estado === "PREPARADO" && (
        <button
          onClick={() => entregarPedido(id, navigate)}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-green-700 transition"
        >
          Marcar como ENTREGADO
        </button>
      )}

      {pedido.estado === "PENDIENTE_CONFIRMACION" && (
        <button
          onClick={() => navigate(`/deposito/pedido/${id}/confirmar`)}
          className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-orange-700 transition"
        >
          Confirmar devolución
        </button>
      )}

    </div>
  );
}

/* AUXILIARES */
async function marcarEstado(id, nuevoEstado, navigate) {
  await fetch(`http://localhost:3000/pedidos/${id}/estado`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ estado: nuevoEstado, usuario: "deposito" }),
  });
  navigate("/deposito");
}

async function entregarPedido(id, navigate) {
  await fetch(`http://localhost:3000/pedidos/${id}/entregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario: "deposito" }),
  });
  navigate("/deposito");
}
