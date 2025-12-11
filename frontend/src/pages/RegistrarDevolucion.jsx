// src/pages/RegistrarDevolucion.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function RegistrarDevolucion() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [seleccion, setSeleccion] = useState([]); 
  const [justificacion, setJustificacion] = useState("");
  const [mostrarJustificacion, setMostrarJustificacion] = useState(false);

  // usuario cargado en localStorage → nombre o username
  const usuario = localStorage.getItem("username") || "supervisor";

  /** CARGAR PEDIDO */
  useEffect(() => {
    fetch(`http://localhost:3000/pedidos/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setPedido(data);
        setSeleccion(data.itemsAsignados.map((m) => m.id));
      });
  }, [id]);

  if (!pedido) return <div className="p-4">Cargando...</div>;

  const asignadas = pedido.itemsAsignados.map((m) => m.id);

  /** LÓGICA DE SELECCIÓN */
  function toggle(idMaq) {
    if (seleccion.includes(idMaq)) {
      setSeleccion(seleccion.filter((x) => x !== idMaq));
    } else {
      setSeleccion([...seleccion, idMaq]);
    }
  }

  /** REQUIERE JUSTIFICACIÓN */
  function necesitaJustificacion() {
    return seleccion.length !== asignadas.length;
  }

  /** CONFIRMAR DEVOLUCIÓN */
  async function confirmar() {
    const requiere = necesitaJustificacion();

    if (requiere && justificacion.trim() === "") {
      setMostrarJustificacion(true);
      return;
    }

    await fetch(`http://localhost:3000/pedidos/${id}/devolucion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuario,
        devueltas: seleccion,
        justificacion: requiere ? justificacion : null
      }),
    });

    // Ahora no se cierra → queda en PENDIENTE_CONFIRMACION
    alert("Devolución registrada. Esperando confirmación del depósito.");
    navigate(`/supervisor`);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4">Registrar devolución</h1>

      <p className="text-sm text-gray-600 mb-4">
        Seleccioná qué máquinas fueron devueltas.
      </p>

      {/* MÁQUINAS ASIGNADAS */}
      <div className="space-y-3">
        {pedido.itemsAsignados.map((m) => {
          const checked = seleccion.includes(m.id);

          return (
            <label
              key={m.id}
              className={`block p-4 rounded-xl shadow cursor-pointer ${
                checked ? "bg-green-100 border border-green-400" : "bg-white"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{m.tipo} — {m.id}</p>
                  <p className="text-xs text-gray-600">{m.modelo}</p>
                </div>

                <input
                  type="checkbox"
                  className="w-5 h-5"
                  checked={checked}
                  onChange={() => toggle(m.id)}
                />
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-6 text-sm text-gray-700">
        Devueltas: <b>{seleccion.length}</b> / {asignadas.length}
      </div>

      <button
        onClick={confirmar}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold mt-4 shadow"
      >
        Confirmar devolución
      </button>

      {/* MODAL JUSTIFICACIÓN */}
      {mostrarJustificacion && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-3">Justificación requerida</h2>
            <p className="text-sm text-gray-600 mb-3">
              Algunas máquinas no fueron devueltas. Explicá el motivo.
            </p>

            <textarea
              className="w-full p-2 border rounded-lg mb-4"
              rows="3"
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
            />

            <button
              className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold"
              onClick={confirmar}
            >
              Guardar y continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
