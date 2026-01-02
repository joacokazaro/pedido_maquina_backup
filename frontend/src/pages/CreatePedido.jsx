import { useEffect, useMemo, useRef, useState } from "react";
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

  // 🔎 buscador servicios
  const [servicioQuery, setServicioQuery] = useState("");
  const [openServicios, setOpenServicios] = useState(false);
  const comboRef = useRef(null);

  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  // DESTINO
const [destino, setDestino] = useState("DEPOSITO"); // "DEPOSITO" | "SUPERVISOR"
const [supervisores, setSupervisores] = useState([]);
const [supervisorDestinoUsername, setSupervisorDestinoUsername] = useState("");


// buscador supervisores
const [supervisorQuery, setSupervisorQuery] = useState("");
const [openSupervisores, setOpenSupervisores] = useState(false);
const comboSupRef = useRef(null);


  /* =========================
     CARGAR SERVICIOS
  ========================== */
  useEffect(() => {
  if (!user?.username) return;

  // ✅ si es supervisor: solo sus servicios
  // ✅ si fuera admin (si alguna vez lo usás acá): todos los servicios
  const url =
    user?.rol === "SUPERVISOR"
      ? `${API_BASE}/pedidos/usuarios/${encodeURIComponent(user.username)}/servicios`
      : `${API_BASE}/servicios`;


  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data)) setServicios(data);
      else setServicios([]);
    })
    .catch(() => setServicios([]));
}, [user?.username, user?.rol]);


useEffect(() => {
  if (!user?.username) return;

  fetch(`${API_BASE}/supervisores`)
    .then((r) => r.json())
    .then((data) => {
      const arr = Array.isArray(data) ? data : (data.supervisores || []);
      // opcional: que no aparezca el mismo supervisor logueado
      const filtrados = arr.filter((s) => String(s.username) !== String(user.username));
      setSupervisores(filtrados);
    })
    .catch(() => setSupervisores([]));
}, [user?.username]);


useEffect(() => {
  function onDown(e) {
    if (!comboSupRef.current) return;
    if (!comboSupRef.current.contains(e.target)) setOpenSupervisores(false);
  }
  document.addEventListener("mousedown", onDown);
  return () => document.removeEventListener("mousedown", onDown);
}, []);




  // Cerrar dropdown si clickeás afuera
  useEffect(() => {
    function onDown(e) {
      if (!comboRef.current) return;
      if (!comboRef.current.contains(e.target)) {
        setOpenServicios(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Si ya hay servicioId, precargar el texto en el input (por si vuelve a renderizar)
  useEffect(() => {
    if (!servicioId) return;
    const s = servicios.find((x) => String(x.id) === String(servicioId));
    if (s && servicioQuery.trim() === "") {
      setServicioQuery(s.nombre);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicioId, servicios]);

const supervisoresFiltrados = useMemo(() => {
  const q = supervisorQuery.trim().toLowerCase();
  if (!q) return supervisores;
  return supervisores.filter((s) => {
    const nombre = (s.nombre || "").toLowerCase();
    const username = (s.username || "").toLowerCase();
    return nombre.includes(q) || username.includes(q);
  });
}, [supervisores, supervisorQuery]);

function seleccionarSupervisorDestino(s) {
  setSupervisorDestinoId(String(s.id ?? s.username)); 
  // si tu backend usa id numérico, usá s.id
  // si usa username, usá s.username
  setSupervisorQuery(s.nombre ? `${s.nombre} (${s.username})` : s.username);
  setOpenSupervisores(false);
}

function limpiarSupervisorDestino() {
  setSupervisorDestinoId("");
  setSupervisorQuery("");
  setOpenSupervisores(false);
}


  const serviciosFiltrados = useMemo(() => {
    const q = servicioQuery.trim().toLowerCase();
    if (!q) return servicios;
    return servicios.filter((s) => (s.nombre || "").toLowerCase().includes(q));
  }, [servicios, servicioQuery]);

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

  function seleccionarServicio(s) {
    setServicioId(String(s.id));
    setServicioQuery(s.nombre);
    setOpenServicios(false);
  }

  function limpiarServicio() {
    setServicioId("");
    setServicioQuery("");
    setOpenServicios(false);
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

    if (destino === "SUPERVISOR" && !supervisorDestinoUsername) {
  setMensaje("Seleccioná el supervisor destino.");
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
      servicioId: Number(servicioId),
      observacion: observacion.trim() || null,

      destino,
      supervisorDestinoUsername:
        destino === "SUPERVISOR" ? supervisorDestinoUsername : null,
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
      setServicioQuery("");
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

      {/* DESTINO DEL PEDIDO */}
<div className="mb-6">
  <label className="block text-sm font-medium mb-2">
    ¿A quién le hacés el pedido? *
  </label>

  <div className="grid grid-cols-2 gap-3">
    <button
      type="button"
      onClick={() => {
        setDestino("DEPOSITO");
        setSupervisorDestinoUsername("");
        setSupervisorQuery("");
      }}
      className={`rounded-xl p-4 shadow border transition text-left
        ${
          destino === "DEPOSITO"
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
        }`}
    >
      <div className="font-semibold text-lg">Depósito</div>
    </button>

    <button
      type="button"
      onClick={() => setDestino("SUPERVISOR")}
      className={`rounded-xl p-4 shadow border transition text-left
        ${
          destino === "SUPERVISOR"
            ? "bg-blue-600 text-white border-blue-600"
            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
        }`}
    >
      <div className="font-semibold text-lg">Supervisor</div>
    </button>
  </div>
</div>


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

              <span className="text-xl w-8 text-center">{cantidades[tipo]}</span>

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

      {/* SUPERVISOR DESTINO (solo si aplica) */}
{destino === "SUPERVISOR" && (
  <div className="mb-6" ref={comboSupRef}>
    <label className="block text-sm font-medium mb-1">
      Supervisor destino *
    </label>

    <div className="relative">
      <input
        value={supervisorQuery}
        onChange={(e) => {
          setSupervisorQuery(e.target.value);
          setOpenSupervisores(true);
          setSupervisorDestinoUsername("");
        }}
        onFocus={() => setOpenSupervisores(true)}
        placeholder="Escribí para buscar…"
        className="w-full bg-white rounded-xl shadow p-3 text-sm
                   border border-gray-300 focus:ring-2
                   focus:ring-blue-400 focus:outline-none pr-20"
      />

      <div className="absolute inset-y-0 right-2 flex items-center gap-2">
        {supervisorQuery && (
          <button
            type="button"
            onClick={() => {
              setSupervisorDestinoUsername("");
              setSupervisorQuery("");
              setOpenSupervisores(false);
            }}
            className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          >
            ✕
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpenSupervisores((p) => !p)}
          className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
        >
          ▾
        </button>
      </div>

      {openSupervisores && (
        <div className="absolute z-20 mt-2 w-full bg-white rounded-xl shadow-lg
                        border border-gray-200 overflow-hidden">
          <div className="max-h-72 overflow-auto">
            {supervisoresFiltrados.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">
                No hay resultados
              </div>
            ) : (
              supervisoresFiltrados.map((s) => {
                const selected =
                  supervisorDestinoUsername === s.username;

                return (
                  <button
                    key={s.username}
                    type="button"
                    onClick={() => {
                      setSupervisorDestinoUsername(s.username);
                      setSupervisorQuery(
                        s.nombre
                          ? `${s.nombre} (${s.username})`
                          : s.username
                      );
                      setOpenSupervisores(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50
                      ${selected ? "bg-blue-50" : "bg-white"}`}
                  >
                    <div className="font-medium text-gray-800">
                      {s.nombre || s.username}
                    </div>
                    <div className="text-xs text-gray-500">
                      @{s.username}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>

    <div className="mt-2 text-xs text-gray-500">
      {supervisorDestinoUsername
        ? "Supervisor seleccionado correctamente."
        : "Elegí el supervisor al que le vas a pedir las máquinas."}
    </div>
  </div>
)}

       
      {/* SERVICIO (BUSCABLE) */}
      <div className="mt-6" ref={comboRef}>
        <label className="block text-sm font-medium mb-1">
          Servicio donde se utilizarán las máquinas *
        </label>

        <div className="relative">
          <input
            value={servicioQuery}
            onChange={(e) => {
              setServicioQuery(e.target.value);
              setOpenServicios(true);
              // si el usuario edita el texto, invalidamos la selección anterior
              setServicioId("");
            }}
            onFocus={() => setOpenServicios(true)}
            placeholder="Escribí para buscar…"
            className="w-full bg-white rounded-xl shadow p-3 text-sm
                       border border-gray-300 focus:ring-2
                       focus:ring-blue-400 focus:outline-none pr-20"
          />

          {/* Botones derecha */}
          <div className="absolute inset-y-0 right-2 flex items-center gap-2">
            {servicioQuery && (
              <button
                type="button"
                onClick={limpiarServicio}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                title="Limpiar"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpenServicios((p) => !p)}
              className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
              title="Abrir/cerrar"
            >
              ▾
            </button>
          </div>

          {openServicios && (
            <div
              className="absolute z-20 mt-2 w-full bg-white rounded-xl shadow-lg
                         border border-gray-200 overflow-hidden"
            >
              <div className="max-h-72 overflow-auto">
                {serviciosFiltrados.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">
                    No hay resultados para “{servicioQuery}”
                  </div>
                ) : (
                  serviciosFiltrados.map((s) => {
                    const selected = String(s.id) === String(servicioId);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => seleccionarServicio(s)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50
                          ${selected ? "bg-blue-50" : "bg-white"}`}
                      >
                        <div className="font-medium text-gray-800">
                          {s.nombre}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* mini feedback de selección */}
        <div className="mt-2 text-xs text-gray-500">
          {servicioId ? (
            <span>
              Seleccionado:{" "}
              <span className="text-gray-800 font-medium">{servicioQuery}</span>
            </span>
          ) : (
            <span>Tip: escribí parte del nombre y elegí de la lista.</span>
          )}
        </div>
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
