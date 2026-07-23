import { createContext, useContext, useState, useEffect, useRef } from "react";
import { loginRequest } from "../services/api";
import { useNavigate } from "react-router-dom";
import { io as ioClient } from "socket.io-client";
import { API_BASE } from "../services/apiBase";
import ConfirmModal from "../components/ConfirmModal";
import { ROLES_SUPERVISION } from "../constants/roles";

function normalizeAuthUser(raw) {
  if (!raw) return null;

  const username = String(raw.username || "").trim();
  if (!username) return null;

  const roles = Array.isArray(raw.roles)
    ? Array.from(
        new Set(
          raw.roles
            .map((r) => String(r || "").toUpperCase().trim())
            .filter(Boolean)
        )
      )
    : [];

  const rol = String(raw.rol || roles[0] || "").toUpperCase().trim();
  const normalizedRoles = roles.length > 0 ? roles : rol ? [rol] : [];

  return {
    ...raw,
    username,
    rol,
    roles: normalizedRoles,
  };
}

function hasRole(user, role) {
  const target = String(role || "").toUpperCase().trim();
  if (!target) return false;
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  if (roles.includes(target)) return true;
  return String(user?.rol || "").toUpperCase() === target;
}

function hasAnyRole(user, allowedRoles = []) {
  return (Array.isArray(allowedRoles) ? allowedRoles : []).some((role) =>
    hasRole(user, role)
  );
}

const AuthContext = createContext();
const AUTH_SESSION_VERSION = "3";
const AUTH_SESSION_VERSION_KEY = "authSessionVersion";

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
        if (hasRole(u, "DEPOSITO")) s.emit("join", { room: "DEPOSITO" });
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
    const savedVersion = localStorage.getItem(AUTH_SESSION_VERSION_KEY);

    if (savedUser) {
      try {
        if (savedVersion !== AUTH_SESSION_VERSION) {
          localStorage.removeItem("authUser");
          localStorage.removeItem(AUTH_SESSION_VERSION_KEY);
          throw new Error("auth version mismatch");
        }

        const uraw = JSON.parse(savedUser);
        const u = normalizeAuthUser(uraw);
        if (!u) throw new Error("invalid auth user");
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

    const normalized = normalizeAuthUser(data.user);
    if (!normalized) throw new Error("Respuesta de login inválida");
    setUser(normalized);
    localStorage.setItem("authUser", JSON.stringify(normalized));
    localStorage.setItem(AUTH_SESSION_VERSION_KEY, AUTH_SESSION_VERSION);

    initSocket(normalized);

    // Redirección por rol
    if (hasRole(normalized, "ADMIN") || hasRole(normalized, "COORDINADOR") || hasRole(normalized, "CONSULTOR")) {
      navigate("/admin");
      return;
    }
    if (hasRole(normalized, "DEPOSITO")) {
      navigate("/deposito");
      return;
    }
    if (hasRole(normalized, "TALLER")) {
      navigate("/admin");
      return;
    }
    if (hasAnyRole(normalized, ROLES_SUPERVISION)) {
      navigate("/supervisor");
      return;
    }
    navigate("/");
  }

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  function doLogout() {
    setUser(null);
    localStorage.removeItem("authUser");
    localStorage.removeItem(AUTH_SESSION_VERSION_KEY);
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
        hasRole: (role) => hasRole(user, role),
        hasAnyRole: (roles) => hasAnyRole(user, roles),
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
