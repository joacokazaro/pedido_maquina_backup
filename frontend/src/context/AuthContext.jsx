import { createContext, useContext, useState, useEffect } from "react";
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

  // 🔁 Restaurar sesión
  useEffect(() => {
    const savedUser = localStorage.getItem("authUser");

    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        // establish socket connection for restored session
        try {
          // determine socket server URL during development
          let socketUrl;
          if (typeof API_BASE === "string" && API_BASE.startsWith("http")) {
            socketUrl = API_BASE.replace(/\/api\/?$/, "");
          } else if (window.location.hostname === "localhost" && window.location.port === "5173") {
            socketUrl = "http://localhost:3000";
          } else {
            socketUrl = undefined;
          }

          const s = socketUrl ? ioClient(socketUrl) : ioClient();
          setSocket(s);
          s.on("connect", () => {
            console.log("socket connected (restored):", s.id);
            // join rooms according to role once connected
            if (u.rol === "DEPOSITO") s.emit("join", { room: "DEPOSITO" });
            if (u.rol === "SUPERVISOR") s.emit("join", { room: `USER:${u.username}` });
          });
          s.on("connect_error", (err) => console.error("socket connect_error (restored):", err));

          s.on("pedido:created", (payload) => {
            window.dispatchEvent(new CustomEvent("pedido:created", { detail: payload }));
          });
          s.on("pedido:updated", (payload) => {
            window.dispatchEvent(new CustomEvent("pedido:updated", { detail: payload }));
          });
        } catch (e) {
          // ignore socket errors during restore
        }
      } catch {
        localStorage.removeItem("authUser");
      }
    }

    setLoading(false);
  }, []);

  async function login(username, password) {
    const data = await loginRequest(username, password);

    setUser(data.user);
    localStorage.setItem("authUser", JSON.stringify(data.user));

    // create socket connection and join appropriate room(s)
    try {
      let socketUrl;
      if (typeof API_BASE === "string" && API_BASE.startsWith("http")) {
        socketUrl = API_BASE.replace(/\/api\/?$/, "");
      } else if (window.location.hostname === "localhost" && window.location.port === "5173") {
        socketUrl = "http://localhost:3000";
      } else {
        socketUrl = undefined;
      }

      const s = socketUrl ? ioClient(socketUrl) : ioClient();
      setSocket(s);
      s.on("connect", () => {
        console.log("socket connected:", s.id);
        if (data.user.rol === "DEPOSITO") s.emit("join", { room: "DEPOSITO" });
        if (data.user.rol === "SUPERVISOR") s.emit("join", { room: `USER:${data.user.username}` });
      });
      s.on("connect_error", (err) => console.error("socket connect_error:", err));

      s.on("pedido:created", (payload) => {
        console.log("received socket pedido:created", payload?.id);
        window.dispatchEvent(new CustomEvent("pedido:created", { detail: payload }));
      });
      s.on("pedido:updated", (payload) => {
        console.log("received socket pedido:updated", payload?.id);
        window.dispatchEvent(new CustomEvent("pedido:updated", { detail: payload }));
      });
    } catch (e) {
      console.error("Socket init error:", e);
    }

    // Redirección por rol
    if (data.user.rol === "SUPERVISOR") navigate("/supervisor");
    if (data.user.rol === "DEPOSITO") navigate("/deposito");
    if (data.user.rol === "ADMIN") navigate("/admin");
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("authUser");
    try {
      if (socket) socket.disconnect();
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
