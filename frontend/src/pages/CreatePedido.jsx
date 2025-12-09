import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

// Podés ajustar esta lista según tus tipos reales del Excel
const MACHINE_TYPES = [
  "LUSTRADORA",
  "SOPLADORA",
  "HIDROLAVADORA",
  "LAVADORA",
  "ASPIRADORA",
  "MOTOGUADAÑA"
];

export default function CreatePedido() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Un estado por tipo
  const [cantidades, setCantidades] = useState(
    MACHINE_TYPES.reduce((acc, tipo) => {
      acc[tipo] = 0;
      return acc;
    }, {})
  );

  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  function cambiarCantidad(tipo, delta) {
    setCantidades((prev) => {
      const nueva = { ...prev };
      const actual = nueva[tipo] ?? 0;
      const valor = actual + delta;
      nueva[tipo] = valor < 0 ? 0 : valor;
      return nueva;
    });
  }

  async function handleCrear() {
    setMensaje("");

    const itemsSolicitados = Object.entries(cantidades)
      .filter(([_, cantidad]) => cantidad > 0)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }));

    if (itemsSolicitados.length === 0) {
      setMensaje("Seleccioná al menos 1 máquina para pedir.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("http://localhost:3000/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorId: user.id,
          itemsSolicitados
        })
      });

      const data = await res.json();

      setMensaje(`Pedido creado: ${data.pedido.id}`);
      // Reseteo de cantidades
      setCantidades(
        MACHINE_TYPES.reduce((acc, tipo) => {
          acc[tipo] = 0;
          return acc;
        }, {})
      );

      // Opcional: volver al home del supervisor después de unos segundos
      setTimeout(() => {
        navigate("/supervisor");
      }, 1200);
    } catch (err) {
      console.error(err);
      setMensaje("Ocurrió un error al crear el pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Nuevo pedido</h1>
      <p className="text-sm text-gray-600 mb-4">
        Seleccioná la cantidad de máquinas que necesitás.  
        Pensado para usar desde el celular: usá los botones + y −.
      </p>

      <div className="space-y-4">
        {MACHINE_TYPES.map((tipo) => (
          <div
            key={tipo}
            className="bg-white rounded-xl shadow flex items-center justify-between px-4 py-3"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-base">{tipo}</span>
              {/* Si querés agregar descripción por tipo, lo podemos hacer acá */}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => cambiarCantidad(tipo, -1)}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-xl leading-none"
              >
                −
              </button>
              <span className="text-xl w-8 text-center">
                {cantidades[tipo]}
              </span>
              <button
                type="button"
                onClick={() => cambiarCantidad(tipo, 1)}
                className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl leading-none"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {mensaje && (
        <div className="mt-4 text-sm text-center text-blue-700 bg-blue-100 rounded-lg py-2">
          {mensaje}
        </div>
      )}

      <button
        onClick={handleCrear}
        disabled={loading}
        className="mt-6 w-full bg-green-600 disabled:bg-green-400 text-white font-semibold py-3 rounded-xl shadow-md"
      >
        {loading ? "Creando pedido..." : "Crear Pedido"}
      </button>
    </div>
  );
}
