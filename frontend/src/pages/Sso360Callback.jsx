import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Sso360Callback() {
  const { loginCon360 } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = hashParams.get("access_token");

    // Sacar el token de la URL apenas se lee, no dejarlo colgando en el historial del navegador.
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      setError("No se recibió un token válido de Kazaró 360.");
      return;
    }

    loginCon360(token).catch((err) => {
      setError(err.message || "No se pudo iniciar sesión con Kazaró 360.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050f28] px-4 text-center">
      {error ? (
        <div>
          <p className="mb-4 text-sm text-red-300">{error}</p>
          <button
            className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-bold text-white"
            onClick={() => navigate("/")}
          >
            Volver al login
          </button>
        </div>
      ) : (
        <p className="text-sm text-white/80">Iniciando sesión con Kazaró 360…</p>
      )}
    </div>
  );
}
