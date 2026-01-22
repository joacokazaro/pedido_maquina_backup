import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

export default function Notificaciones() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const [abierto, setAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.username) return;

    cargarNotificaciones();

    function onCreated(e) {
      const n = e.detail;
      if (!n) return;

      setNotificaciones((prev) => [n, ...prev]);
    }

    window.addEventListener("notificacion:created", onCreated);
    return () => window.removeEventListener("notificacion:created", onCreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  useEffect(() => {
    function onDown(e) {
      if (!abierto) return;
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target)) setAbierto(false);
    }

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [abierto]);

  async function cargarNotificaciones() {
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/notificaciones?username=${encodeURIComponent(
          user.username
        )}`
      );
      if (!res.ok) throw new Error();

      const data = await res.json();
      setNotificaciones(Array.isArray(data) ? data : []);
    } catch {
      setError("Error cargando notificaciones");
    }
  }

  async function marcarLeida(id) {
    try {
      await fetch(`${API_BASE}/notificaciones/${id}/leida`, {
        method: "PUT",
      });
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
      );
    } catch {
      // sin feedback bloqueante
    }
  }

  async function marcarTodasLeidas() {
    const pendientes = notificaciones.filter((n) => !n.leida);
    if (pendientes.length === 0) return;

    try {
      await Promise.all(
        pendientes.map((n) =>
          fetch(`${API_BASE}/notificaciones/${n.id}/leida`, {
            method: "PUT",
          })
        )
      );

      setNotificaciones((prev) =>
        prev.map((n) => ({ ...n, leida: true }))
      );
    } catch {
      // sin feedback bloqueante
    }
  }

  function resolverRutaPedido(n) {
    if (!n?.pedidoId) return null;

    if (user?.rol === "ADMIN") return `/admin/pedido/${n.pedidoId}`;
    if (user?.rol === "DEPOSITO") return `/deposito/pedido/${n.pedidoId}`;

    // SUPERVISOR
    const msg = String(n?.mensaje || "").toLowerCase();
    if (msg.includes("préstamo") || msg.includes("prestamo")) {
      return `/supervisor/prestamo/${n.pedidoId}`;
    }

    return `/supervisor/pedido/${n.pedidoId}`;
  }

  const noLeidas = useMemo(
    () => notificaciones.filter((n) => !n.leida).length,
    [notificaciones]
  );

  function formatFecha(ts) {
    const d = new Date(ts);
    return d.toLocaleString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (!user) return null;

  return (
    <div className="fixed top-4 right-4 z-50" ref={panelRef}>
      <button
        className="relative bg-white border border-gray-200 shadow w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-50"
        onClick={() => setAbierto((v) => !v)}
        title="Notificaciones"
        aria-label="Notificaciones"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute top-full right-0 mt-2 w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <div className="text-sm font-semibold">Notificaciones</div>
            <div className="flex items-center gap-3">
              <button
                onClick={marcarTodasLeidas}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Marcar todas
              </button>
              <button
                onClick={() => setAbierto(false)}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Cerrar
              </button>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 text-xs text-red-600 bg-red-50">
              {error}
            </div>
          )}

          <div className="max-h-[60vh] overflow-auto">
            {notificaciones.length === 0 && (
              <div className="px-3 py-4 text-sm text-gray-500">
                No tenés notificaciones.
              </div>
            )}

            {notificaciones.map((n) => {
              const ruta = resolverRutaPedido(n);

              return (
                <div
                  key={n.id}
                  className={`px-3 py-3 border-b last:border-b-0 ${
                    n.leida ? "bg-white" : "bg-blue-50"
                  }`}
                >
                  <button
                    onClick={async () => {
                      await marcarLeida(n.id);
                      if (ruta) navigate(ruta);
                    }}
                    className="w-full text-left"
                  >
                    <div className="text-sm font-semibold text-gray-800">
                      {n.mensaje}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatFecha(n.createdAt)}
                    </div>
                  </button>

                  {!n.leida && (
                    <div className="mt-2">
                      <button
                        onClick={() => marcarLeida(n.id)}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Marcar como vista
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-3 py-2 text-[11px] text-gray-500">
            Click en una notificación para abrir el pedido.
          </div>
        </div>
      )}
    </div>
  );
}
