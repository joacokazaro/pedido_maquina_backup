import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" />;
  }

  if (!allowedRoles.includes(user.rol)) {
    return <Navigate to="/" />;
  }

  return children;
}
