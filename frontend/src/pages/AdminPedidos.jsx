import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminPedidos() {
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [search, setSearch] = useState("");

  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // ============================
  // CARGAR PEDIDOS
  // ============================
  useEffect(() => {
    loadPedidos();
  }, []);

  async function loadPedidos() {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/admin/pedidos");
      const data = await res.json();
      setPedidos(data);
    } catch (err) {
      console.error("Error cargando pedidos:", err);
    }
    setLoading(false);
  }

  // ============================
  // FILTRO + BUSCADOR
  // ============================
  function filtrarPedidos() {
    return pedidos.filter((p) => {
      const coincideEstado =
        estadoFiltro === "TODOS" || p.estado === estadoFiltro;

      const texto = search.toLowerCase();

      const coincideTexto =
        p.id.toLowerCase().includes(texto) ||
        (p.supervisorName || "").toLowerCase().includes(texto);

      return coincideEstado && coincideTexto;
    });
  }

  // ============================
  // CAMBIO FORZADO DE ESTADO
  // ============================
  async function forzarEstado(id, nuevoEstado) {
    if (!nuevoEstado) return;

    await fetch(`http://localhost:3000/admin/pedidos/${id}/estado`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: nuevoEstado })
    });

    await loadPedidos();
    setShowModal(false);
  }

  const estados = [
    "TODOS",
    "PENDIENTE_PREPARACION",
    "PREPARADO",
    "ENTREGADO",
    "CERRADO"
  ];

  if (loading) {
    return <div className="p-6">Cargando pedidos...</div>;
  }

  return (
    <div className="p-4 min-h-screen bg-gray-50 pb-24">

      {/* BOTÓN VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg 
                 bg-white border border-gray-200 shadow-sm 
                 hover:shadow transition text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">Gestión de Pedidos</h1>

      {/* FILTROS */}
      <div className="space-y-3 mb-4">

        <input
          className="w-full p-3 rounded-xl border border-gray-300"
          placeholder="Buscar por código o supervisor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="w-full p-3 rounded-xl border border-gray-300 bg-white"
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
        >
          {estados.map((e) => (
            <option key={e} value={e}>
              {e.replace("_", " ")}
            </option>
          ))}
        </select>

      </div>

      {/* LISTA DE PEDIDOS */}
      <div className="space-y-3">
        {filtrarPedidos().map((p) => (
          <div
            key={p.id}
            className="bg-white shadow p-4 rounded-xl cursor-pointer"
            onClick={() => {
              setSelectedPedido(p);
              setShowModal(true);
            }}
          >
            <div className="flex justify-between items-center">
              <span className="font-bold">{p.id}</span>

              <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                {p.estado.replace("_", " ")}
              </span>
            </div>

            <p className="text-gray-600 text-sm mt-1">
              Supervisor: {p.supervisorName ?? `ID ${p.supervisorId ?? "?"}`}
            </p>

            <p className="text-xs text-gray-500 mt-1">
              Items: {p.itemsSolicitados.length}
            </p>
          </div>
        ))}
      </div>

      {/* ============================
          MODAL DETALLE
      ============================ */}
      {showModal && selectedPedido && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">

            <h2 className="text-xl font-bold mb-3">
              Pedido {selectedPedido.id}
            </h2>

            <p className="text-sm text-gray-600 mb-3">
              Estado actual:{" "}
              <b>{selectedPedido.estado.replace("_", " ")}</b>
            </p>

            {/* HISTORIAL */}
            <h3 className="font-semibold mb-2">Historial</h3>

            <div className="max-h-60 overflow-y-auto mb-4 border p-3 rounded space-y-4">

              {selectedPedido.historial.map((h, idx) => (
                <div key={idx} className="text-sm border-b pb-3">

                  <p className="font-bold">{h.accion.replace("_", " ")}</p>
                  <p className="text-xs text-gray-500 mb-2">
                    {new Date(h.fecha).toLocaleString()}
                  </p>

                  {/* DETALLES BONITOS */}
                  {h.detalle && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs text-gray-700 space-y-2">

                      {/* Máquinas asignadas */}
                      {"asignadas" in h.detalle && (
                        <div>
                          <p className="font-semibold">Máquinas asignadas:</p>
                          <ul className="list-disc ml-4 space-y-1">
                            {h.detalle.asignadas.map((m, i) => (
                              <li key={i}>
                                <b>{m.tipo}</b> — {m.id}
                                <br />
                                {m.modelo && (
                                  <span className="text-gray-500">{m.modelo}</span>
                                )}
                                {m.serie && (
                                  <>
                                    <br />
                                    <span className="text-gray-400">
                                      Serie: {m.serie}
                                    </span>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Solicitado */}
                      {"solicitado" in h.detalle && (
                        <div>
                          <p className="font-semibold">Solicitado:</p>
                          <ul className="list-disc ml-4">
                            {Object.entries(h.detalle.solicitado).map(([tipo, cant]) => (
                              <li key={tipo}>{tipo}: {cant}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {/* Justificación */}
                      {h.detalle.justificacion && (
                        <div>
                          <p className="font-semibold">Justificación:</p>
                          <p>{h.detalle.justificacion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

            </div>

            {/* CAMBIO DE ESTADO */}
            <select
              className="w-full p-3 border rounded-xl mb-3"
              onChange={(e) =>
                forzarEstado(selectedPedido.id, e.target.value)
              }
            >
              <option value="">Cambiar estado...</option>
              {estados
                .filter((e) => e !== "TODOS")
                .map((e) => (
                  <option key={e} value={e}>
                    {e.replace("_", " ")}
                  </option>
                ))}
            </select>

            <button
              className="w-full py-2 bg-red-600 text-white rounded-xl"
              onClick={() => setShowModal(false)}
            >
              Cerrar
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
