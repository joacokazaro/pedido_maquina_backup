import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function MainLayout({ children }) {
  const { user, logout, confirmLogout } = useAuth();
  const navigate = useNavigate();
  const isCoordinador = String(user?.rol || "").toUpperCase() === "COORDINADOR";
  const roleHomePath = isCoordinador ? "/admin/eventuales" : "/";

  useEffect(() => {}, [user]);

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-40 border-b border-blue-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-[1600px] items-center justify-between gap-5 px-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(roleHomePath)}
              className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-900 transition hover:bg-blue-100"
            >
              {isCoordinador ? "Coordinación" : "Inicio"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold text-slate-800">{user?.username || "user"}</p>
              <p className="text-xs text-blue-700">{isCoordinador ? "Coordinación" : ""}</p>
            </div>

            <button
              type="button"
              onClick={confirmLogout}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-0 py-0">{children}</main>
    </div>
  );
}
