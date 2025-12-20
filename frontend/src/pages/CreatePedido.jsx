import { useEffect, useState } from "react";
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
  "BOMBA DESINFECCION",
];

export default function CreatePedido() {
  const { user } = useAuth();
  const navigate = useNavigate();

  /* =========================
     ESTADOS
  ========================== */
  const [cantidades, setCantidades] = useState(
    MACHINE_TYPES.reduce((acc, tipo) => {
      acc[tipo] = 0;
      return acc;
    }, {})
  );

  const [servicios, setServicios] = useState([]);
  const [servicioId, setServicioId] = useState("");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  /* =========================
     CARGAR SERVICIOS
  ========================== */
  useEffect(() => {
    fetch(`${API_BASE}/servicios`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setServicios(data);
        else setServicios([]);
      })
      .catch(() => setServicios([]));
  }, []);

  /* =========================
     HANDLERS
  ========================== */
  function cambiarCantidad(tipo, delta) {
    setCantidades((prev) => {
      const nueva = { ...prev };
      nueva[tipo] = Math.max(0, (nueva[tipo] || 0) + delta);
      return nueva;
    });
  }

  async function handleCrear() {
    setMensaje("");

    if (!user?.username) {
      setMensaje("Sesión inválida. Volvé a iniciar sesión.");
      return;
    }

    const itemsSolicitados = Object.entries(cantidades)
      .filter(([_, cantidad]) => cantidad > 0)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }));

    if (itemsSolicitados.length === 0) {
      setMensaje("Seleccioná al menos 1 máquina para pedir.");
      return;
    }

    if (!servicioId) {
      setMensaje("Seleccioná el servicio donde se utilizarán las máquinas.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorUsername: user.username,
          itemsSolicitados,
          servicioId: Number(servicioId), // 🔑 CLAVE
          observacion: observacion.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error creando el pedido");
      }

      setMensaje(`Pedido creado: ${data.pedido.id}`);

      // reset
      setCantidades(
        MACHINE_TYPES.reduce((acc, tipo) => {
          acc[tipo] = 0;
          return acc;
        }, {})
      );
      setServicioId("");
      setObservacion("");

      setTimeout(() => navigate("/supervisor"), 1200);
    } catch (err) {
      console.error(err);
      setMensaje(err.message || "Ocurrió un error al crear el pedido.");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     RENDER
  ========================== */
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">

      {/* VOLVER */}
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

      {/* MAQUINAS */}
      <div className="space-y-4">
        {MACHINE_TYPES.map((tipo) => (
          <div
            key={tipo}
            className="bg-white rounded-xl shadow flex items-center justify-between px-4 py-3"
          >
            <span className="font-semibold">{tipo}</span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => cambiarCantidad(tipo, -1)}
                className="w-10 h-10 rounded-full border border-gray-300 text-xl"
              >
                −
              </button>

              <span className="text-xl w-8 text-center">
                {cantidades[tipo]}
              </span>

              <button
                type="button"
                onClick={() => cambiarCantidad(tipo, 1)}
                className="w-10 h-10 rounded-full bg-blue-600 text-white text-xl"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* SERVICIO */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-1">
          Servicio donde se utilizarán las máquinas *
        </label>

        <select
          value={servicioId}
          onChange={(e) => setServicioId(e.target.value)}
          className="w-full bg-white rounded-xl shadow p-3 text-sm
                     border border-gray-300 focus:ring-2
                     focus:ring-blue-400 focus:outline-none"
        >
          <option value="">Seleccionar servicio…</option>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* OBSERVACIÓN */}
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">
          Observaciones (fechas, motivos, etc.)
        </label>

        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          placeholder="Agregar comentarios acerca del pedido"
          className="w-full bg-white rounded-xl shadow p-3 text-sm
                     border border-gray-300 focus:ring-2
                     focus:ring-blue-400 focus:outline-none"
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
        className="mt-6 w-full bg-green-600 disabled:bg-green-400
                   text-white font-semibold py-3 rounded-xl shadow-md"
      >
        {loading ? "Creando pedido..." : "Crear Pedido"}
      </button>
    </div>
  );
}
