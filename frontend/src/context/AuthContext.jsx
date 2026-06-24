import { createContext, useContext, useState, useEffect, useRef } from "react";
import { loginRequest } from "../services/api";
import { useNavigate } from "react-router-dom";
import { io as ioClient } from "socket.io-client";
import { API_BASE } from "../services/apiBase";
import ConfirmModal from "../components/ConfirmModal";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  function initSocket(u) {
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      let socketUrl;
      if (typeof API_BASE === "string" && API_BASE.startsWith("http")) {
        socketUrl = API_BASE.replace(/\/api\/?$/, "");
      } else if (window.location.hostname === "localhost" && window.location.port === "5173") {
        socketUrl = "http://localhost:3000";
      } else {
        socketUrl = undefined;
      }

      const s = socketUrl ? ioClient(socketUrl) : ioClient();
      socketRef.current = s;
      setSocket(s);

      s.on("connect", () => {
        console.log("socket connected:", s.id);
        if (u?.rol === "DEPOSITO") s.emit("join", { room: "DEPOSITO" });
        if (u?.username) s.emit("join", { room: `USER:${u.username}` });
      });

      s.on("connect_error", (err) => console.error("socket connect_error:", err));

      s.on("pedido:created", (payload) => {
        window.dispatchEvent(new CustomEvent("pedido:created", { detail: payload }));
      });
      s.on("pedido:updated", (payload) => {
        window.dispatchEvent(new CustomEvent("pedido:updated", { detail: payload }));
      });
      s.on("notificacion:created", (payload) => {
        window.dispatchEvent(new CustomEvent("notificacion:created", { detail: payload }));
      });
    } catch (e) {
      console.error("Socket init error:", e);
    }
  }

  // 🔁 Restaurar sesión
  useEffect(() => {
    const savedUser = localStorage.getItem("authUser");

    if (savedUser) {
      try {
        const uraw = JSON.parse(savedUser);
        const u = { ...uraw, rol: String(uraw.rol || "").toUpperCase() };
        setUser(u);
        initSocket(u);
      } catch {
        localStorage.removeItem("authUser");
      }
    }

    setLoading(false);
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  async function login(username, password) {
    const data = await loginRequest(username, password);

    const normalized = { ...data.user, rol: String(data.user.rol || "").toUpperCase() };
    setUser(normalized);
    localStorage.setItem("authUser", JSON.stringify(normalized));

    initSocket(normalized);

    // Redirección por rol
    const rol = String(normalized.rol || "").toUpperCase();
    if (rol === "SUPERVISOR") navigate("/supervisor");
    if (rol === "DEPOSITO") navigate("/deposito");
    if (rol === "ADMIN") navigate("/admin");
    if (rol === "COORDINADOR") navigate("/admin");
    if (rol === "CONSULTOR") navigate("/admin");
    if (rol === "TALLER") navigate("/admin");
  }

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  function doLogout() {
    setUser(null);
    localStorage.removeItem("authUser");
    try {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    } catch {}
    navigate("/");
  }

  function logout() {
    // immediate logout (kept for backward compatibility)
    doLogout();
  }

  function confirmLogout() {
    setLogoutConfirmOpen(true);
  }

  function handleCancelLogout() {
    setLogoutConfirmOpen(false);
  }

  function handleConfirmLogout() {
    setLogoutConfirmOpen(false);
    doLogout();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading, // 👈 CLAVE
        socket,
        login,
          logout,
          confirmLogout,
      }}
    >
        {children}

        <ConfirmModal
          open={logoutConfirmOpen}
          title="Confirmar cierre de sesión"
          message="¿Estás seguro que querés salir?"
          onCancel={handleCancelLogout}
          onConfirm={handleConfirmLogout}
          confirmLabel="Salir"
          cancelLabel="Cancelar"
          tone="danger"
        />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
