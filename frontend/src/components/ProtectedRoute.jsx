import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  // ⛔️ Mientras se restaura sesión, NO redirigir
  if (user === null) {
    return null; // o loader si querés
  }

  if (!allowedRoles.includes(user.rol)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
