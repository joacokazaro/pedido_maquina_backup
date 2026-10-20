import { useLocation, useNavigate } from "react-router-dom";
import { resolverRutaPadre } from "../utils/rutasPadre";
import { useAuth } from "../context/AuthContext";
import { rutaInicioPedidos } from "../constants/roles";

/**
 * Botón "Volver" estandarizado para toda la app.
 *
 * Destino (por orden de prioridad):
 *   1. Si se pasa `to`, navega a esa ruta (override manual, siempre gana).
 *   2. Si no, sube al padre lógico de la ruta actual según el árbol de rutas
 *      (`utils/rutasPadre.js`). Esto es determinístico y evita los bucles de
 *      `navigate(-1)` (rebotar entre las dos últimas pantallas del historial).
 *   3. Si la ruta actual no está en el árbol, cae a `navigate(-1)`.
 *
 * Props:
 *   - `to`: ruta fija opcional (ej. `to="/deposito"`).
 *   - `children`: texto del botón (default "Volver").
 *   - `className`: controla el margen exterior; default "mb-4". Pasar "" para
 *     quitarlo o "mb-5" para ajustarlo (reemplaza el margen, no lo apila).
 */
export default function BotonVolver({ to, children = "Volver", className = "mb-4" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  function handleClick() {
    if (to != null) {
      navigate(to);
      return;
    }
    const padre = resolverRutaPadre(location.pathname);
    if (padre == null) {
      navigate(-1);
      return;
    }
    // Las pantallas `/supervisor/*` también las usa depósito: su "inicio" es otro panel.
    navigate(padre === "/supervisor" ? rutaInicioPedidos(user) : padre);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-kazaro-ice hover:text-kazaro-deep hover:shadow ${className}`}
    >
      <span className="text-lg leading-none">←</span>
      {children}
    </button>
  );
}
