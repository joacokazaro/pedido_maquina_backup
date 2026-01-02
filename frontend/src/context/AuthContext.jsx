import { createContext, useContext, useState, useEffect } from "react";
import { loginRequest } from "../services/api";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 🔁 Restaurar sesión
  useEffect(() => {
    const savedUser = localStorage.getItem("authUser");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
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

    // Redirección por rol
    if (data.user.rol === "SUPERVISOR") navigate("/supervisor");
    if (data.user.rol === "DEPOSITO") navigate("/deposito");
    if (data.user.rol === "ADMIN") navigate("/admin");
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("authUser");
    navigate("/");
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading, // 👈 CLAVE
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
