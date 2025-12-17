import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

const MACHINE_TYPES = [
  "LUSTRADORA",
  "SOPLADORA",
  "HIDROLAVADORA",
  "LAVADORA",
  "ASPIRADORA",
  "MOTOGUADAÑA",
  "CARGADOR",
  "BOMBA DESINFECCION"
];

export default function CreatePedido() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cantidades, setCantidades] = useState(
    MACHINE_TYPES.reduce((acc, tipo) => {
      acc[tipo] = 0;
      return acc;
    }, {})
  );

  const [servicio, setServicio] = useState("");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  function cambiarCantidad(tipo, delta) {
    setCantidades((prev) => {
      const nueva = { ...prev };
      const actual = nueva[tipo] ?? 0;
      nueva[tipo] = Math.max(0, actual + delta);
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

    if (!servicio.trim()) {
      setMensaje("Ingresá el servicio donde se utilizarán las máquinas.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}
/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorUsername: user.username,
          itemsSolicitados,
          servicio: servicio.trim(),
          observacion: observacion.trim()
        })
      });

      const data = await res.json();

      setMensaje(`Pedido creado: ${data.pedido.id}`);

      setCantidades(
        MACHINE_TYPES.reduce((acc, tipo) => {
          acc[tipo] = 0;
          return acc;
        }, {})
      );
      setServicio("");
      setObservacion("");

      setTimeout(() => navigate("/supervisor"), 1200);
    } catch (err) {
      console.error(err);
      setMensaje("Ocurrió un error al crear el pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">

      {/* BOTÓN VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg 
                   bg-white border border-gray-200 shadow-sm 
                   hover:shadow transition text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">Nuevo pedido</h1>
      <p className="text-sm text-gray-600 mb-4">
        Seleccioná la cantidad de máquinas que necesitás.
      </p>

      <div className="space-y-4">
        {MACHINE_TYPES.map((tipo) => (
          <div
            key={tipo}
            className="bg-white rounded-xl shadow flex items-center justify-between px-4 py-3"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-base">{tipo}</span>
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

      {/* SERVICIO (OBLIGATORIO) */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-1">
          Servicio donde se utilizarán las máquinas *
        </label>

        <input
          type="text"
          value={servicio}
          onChange={(e) => setServicio(e.target.value)}
          placeholder="Ej: Supermercado Córdoba - Turno noche"
          className="w-full bg-white rounded-xl shadow p-3 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none"
        />
      </div>

      {/* OBSERVACIÓN */}
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">
          Observaciones(fechas, motivos, etc.)
        </label>

        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          placeholder="Agregar comentarios acerca del pedido"
          className="w-full bg-white rounded-xl shadow p-3 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-400 focus:outline-none"
          rows={3}
        />
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
