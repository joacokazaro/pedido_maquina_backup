import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  // ⛔️ Mientras se restaura sesión, NO redirigir
  if (loading) {
    return null; // o loader si querés
  }

  // Sin sesión (deslogueado, sesión vencida o de la versión anterior): al login, no a una página en blanco.
  if (user === null) {
    return <Navigate to="/" replace />;
  }

  const userRolesUpper = Array.isArray(user?.roles)
    ? user.roles.map((r) => String(r || "").toUpperCase())
    : [];
  const userRolUpper = String(user?.rol || "").toUpperCase();
  const allowedUpper = (Array.isArray(allowedRoles) ? allowedRoles : []).map((r) => String(r || "").toUpperCase());

  const hasRole = allowedUpper.some((role) =>
    userRolesUpper.includes(role) || userRolUpper === role
  );

  if (!hasRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}
