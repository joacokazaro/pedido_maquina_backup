import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  // ⛔️ Mientras se restaura sesión, NO redirigir
  if (user === null) {
    return null; // o loader si querés
  }

  const userRolUpper = String(user?.rol || "").toUpperCase();
  const allowedUpper = (Array.isArray(allowedRoles) ? allowedRoles : []).map((r) => String(r || "").toUpperCase());

  if (!allowedUpper.includes(userRolUpper)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
