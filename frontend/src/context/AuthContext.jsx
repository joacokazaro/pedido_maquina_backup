import { createContext, useContext, useState, useEffect, useRef } from "react";
import { loginRequest } from "../services/api";
import { useNavigate } from "react-router-dom";
import { io as ioClient } from "socket.io-client";
import { API_BASE } from "../services/apiBase";

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
        const u = JSON.parse(savedUser);
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

    setUser(data.user);
    localStorage.setItem("authUser", JSON.stringify(data.user));

    initSocket(data.user);

    // Redirección por rol
    if (data.user.rol === "SUPERVISOR") navigate("/supervisor");
    if (data.user.rol === "DEPOSITO") navigate("/deposito");
    if (data.user.rol === "ADMIN") navigate("/admin");
  }

  function logout() {
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading, // 👈 CLAVE
        socket,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
