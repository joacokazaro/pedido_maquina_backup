import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function DepositoHome() {
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/pedidos")
      .then(res => res.json())
      .then(data => {
        const filtrados = data.filter(
          p => p.estado === "PENDIENTE_PREPARACION" || p.estado === "PREPARADO"
        );
        setPedidos(filtrados);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Pedidos a gestionar</h1>

      {pedidos.length === 0 && (
        <p className="text-gray-600">No hay pedidos pendientes.</p>
      )}

      <div className="space-y-4">
        {pedidos.map(p => (
          <Link
            to={`/deposito/pedido/${p.id}`}
            key={p.id}
            className="block bg-white shadow rounded-xl p-4 border border-gray-200"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">{p.id}</h2>

              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  p.estado === "PENDIENTE_PREPARACION"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {p.estado.replace("_", " ")}
              </span>
            </div>

            <div className="mt-2">
              <p className="text-sm text-gray-600">Solicitado:</p>

              <ul className="ml-4 mt-1 text-sm">
                {p.itemsSolicitados.map((i, idx) => (
                  <li key={idx}>
                    {i.tipo} × <b>{i.cantidad}</b>
                  </li>
                ))}
              </ul>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
