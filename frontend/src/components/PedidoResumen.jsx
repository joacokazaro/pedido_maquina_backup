export default function PedidoResumen({ pedido }) {
  if (!pedido) return null;

  return (
    <>
      {/* ESTADO */}
      <span className="inline-block mb-3 px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">
        {pedido.estado.replace("_", " ")}
      </span>

      {/* SERVICIO */}
      {pedido.servicio && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-green-500">
          <h2 className="text-lg font-semibold mb-1">Servicio</h2>
          <p className="text-sm text-gray-700">{pedido.servicio}</p>
        </div>
      )}

      {/* OBSERVACIÓN DEL SUPERVISOR */}
      {pedido.observacion && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-1">
            Observación del supervisor
          </h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {pedido.observacion}
          </p>
        </div>
      )}

      {/* MÁQUINAS SOLICITADAS */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">
          Máquinas solicitadas
        </h2>

        {(pedido.itemsSolicitados ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">
            No hay máquinas solicitadas.
          </p>
        ) : (
          pedido.itemsSolicitados.map((i, idx) => (
            <div
              key={idx}
              className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm"
            >
              <span>{i.tipo}</span>
              <span className="font-bold">{i.cantidad}</span>
            </div>
          ))
        )}
      </div>

      {/* MÁQUINAS ASIGNADAS */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">
          Máquinas asignadas
        </h2>

        {(pedido.itemsAsignados ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">
            No hay máquinas asignadas.
          </p>
        ) : (
          pedido.itemsAsignados.map((m, idx) => (
            <div key={idx} className="bg-gray-50 px-3 py-2 rounded-lg text-sm">
              <p className="font-semibold">
                {m.tipo} — {m.id}
              </p>
              <p className="text-xs text-gray-600">{m.modelo}</p>
              <p className="text-xs text-gray-500">
                Serie: {m.serie}
              </p>
            </div>
          ))
        )}
      </div>
    </>
  );
}
