import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { EstadoBadge } from "../utils/estadoPedido.jsx";

export default function DepositoHome() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState("TODOS");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPedidos() {
      try {
        const res = await fetch(`${API_BASE}/pedidos`, { signal: controller.signal });
        const data = await res.json();
        const soloDeposito = data.filter((p) => p.destino === "DEPOSITO");
        setPedidos(soloDeposito);
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      }
    }

    loadPedidos();

    const onCreated = (e) => {
      const payload = e.detail;
      if (payload?.destino === "DEPOSITO") {
        // reload list to keep consistency
        loadPedidos();
      }
    };

    const onUpdated = (e) => {
      const payload = e.detail;
      if (payload?.destino === "DEPOSITO") loadPedidos();
    };

    window.addEventListener("pedido:created", onCreated);
    window.addEventListener("pedido:updated", onUpdated);

    return () => {
      controller.abort();
      window.removeEventListener("pedido:created", onCreated);
      window.removeEventListener("pedido:updated", onUpdated);
    };
  }, []);

  /* =========================
     HELPERS
  ========================== */

  function tieneFaltantes(pedido) {
    if (pedido.estado !== "CERRADO") return false;

    const confirmacion = [...(pedido.historial || [])]
      .reverse()
      .find(h => h.accion === "DEVOLUCION_CONFIRMADA");

    const faltantes =
      confirmacion?.detalle?.faltantesConfirmados || [];

    return faltantes.length > 0;
  }

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
      <button
        onClick={() => navigate("/deposito")}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow transition text-gray-700 text-sm font-medium"
      >
        ← Volver al panel
      </button>

      <h1 className="text-3xl font-bold mb-6 text-center">
        Pedidos a gestionar
      </h1>

      {/* FILTROS */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {filtros.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition 
              ${filtro === f.value
                ? f.color
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {pedidosFiltrados.length === 0 && (
        <p className="text-center text-gray-600 mt-4">
          No hay pedidos en esta categoría.
        </p>
      )}

      {/* LISTA */}
      <div className="space-y-4 max-w-xl mx-auto">
        {pedidosFiltrados.map((p) => (
          <Link
            to={`/deposito/pedido/${p.id}`}
            key={p.id}
            className="block bg-white shadow rounded-xl p-4 border border-gray-200 hover:shadow-md transition"
          >
            {/* HEADER CARD */}
            <div className="flex justify-between items-center gap-2">
              <div>
                <h2 className="font-bold text-lg">{p.id}</h2>
                {/** Mostrar nombre completo del solicitante si existe */}
                { (p.supervisorNombre || p.supervisor) && (
                  <p className="text-sm text-gray-600">Solicitado por: {p.supervisorNombre || p.supervisor}</p>
                ) }
              </div>

              <div className="flex items-center gap-2">
                {tieneFaltantes(p) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    ⚠ Con faltantes
                  </span>
                )}

                <EstadoBadge estado={p.estado} />
              </div>
            </div>

            {/* SOLICITADO */}
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
