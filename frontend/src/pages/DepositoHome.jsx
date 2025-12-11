import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function DepositoHome() {
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState("TODOS");

  useEffect(() => {
    fetch("http://localhost:3000/pedidos")
      .then(res => res.json())
      .then(data => {
        setPedidos(data);
      });
  }, []);

  const pedidosFiltrados = pedidos.filter((p) => {
    if (filtro === "TODOS") return true;
    return p.estado === filtro;
  });

  const filtros = [
    { label: "Todos", value: "TODOS", color: "bg-gray-200 text-gray-700" },
    { label: "Pendientes", value: "PENDIENTE_PREPARACION", color: "bg-yellow-500 text-white" },
    { label: "Preparados", value: "PREPARADO", color: "bg-blue-500 text-white" },
    { label: "Entregados", value: "ENTREGADO", color: "bg-green-500 text-white" },
    { label: "Pend. Confirmación", value: "PENDIENTE_CONFIRMACION", color: "bg-orange-500 text-white" },
    { label: "Cerrados", value: "CERRADO", color: "bg-gray-700 text-white" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Pedidos a gestionar</h1>

      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {filtros.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition 
              ${filtro === f.value ? f.color : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pedidosFiltrados.length === 0 && (
        <p className="text-center text-gray-600 mt-4">No hay pedidos en esta categoría.</p>
      )}

      <div className="space-y-4 max-w-xl mx-auto">
        {pedidosFiltrados.map((p) => (
          <Link
            to={`/deposito/pedido/${p.id}`}
            key={p.id}
            className="block bg-white shadow rounded-xl p-4 border border-gray-200 hover:shadow-md transition"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">{p.id}</h2>

              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  p.estado === "PENDIENTE_PREPARACION"
                    ? "bg-yellow-100 text-yellow-800"
                    : p.estado === "PREPARADO"
                    ? "bg-blue-100 text-blue-800"
                    : p.estado === "ENTREGADO"
                    ? "bg-green-100 text-green-700"
                    : p.estado === "PENDIENTE_CONFIRMACION"
                    ? "bg-orange-200 text-orange-800"
                    : p.estado === "CERRADO"
                    ? "bg-gray-300 text-gray-800"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {p.estado.replace("_", " ")}
              </span>
            </div>

            <div className="mt-2">
              <p className="text-sm text-gray-600">Solicitado:</p>

              <ul className="ml-4 mt-1 text-sm text-gray-800">
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
