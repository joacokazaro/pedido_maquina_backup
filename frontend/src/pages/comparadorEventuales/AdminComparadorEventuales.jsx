import { useCallback, useEffect, useState } from "react";
import BotonVolver from "../../components/BotonVolver";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../services/apiBase";
import { buildActorHeaders } from "../../utils/authHeaders";
import SimilitudTab from "./SimilitudTab";
import VersusTab from "./VersusTab";

const TABS = [
  { clave: "versus", titulo: "Versus", descripcion: "Compará dos eventuales finalizados lado a lado." },
  { clave: "similitud", titulo: "Buscar similares", descripcion: "Describí un trabajo y encontrá los eventuales más parecidos." },
];

export default function AdminComparadorEventuales() {
  const { user } = useAuth();
  const [tab, setTab] = useState("versus");
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");
      const res = await fetch(`${API_BASE}/admin/eventuales/comparador/candidatos`, {
        headers: buildActorHeaders(user),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error obteniendo los eventuales");
      setDatos(data);
    } catch (e) {
      setError(e.message || "Error obteniendo los eventuales");
    } finally {
      setCargando(false);
    }
  }, [user]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8">
      <BotonVolver>Volver al panel</BotonVolver>

      <header className="mx-auto mb-6 max-w-[1200px] overflow-hidden rounded-3xl bg-gradient-to-br from-kazaro-navy via-kazaro-deep to-[#0a4a63] px-6 py-8 text-white shadow-xl sm:px-10 sm:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-kazaro-green">
          Servicios eventuales · Espacios Verdes
        </p>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-5xl">Comparador</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-200">
          Trabaja sobre los eventuales de Espacios Verdes ya finalizados
          {datos ? ` (${datos.eventuales.length} disponibles)` : ""}.
        </p>
      </header>

      <div className="mx-auto max-w-[1200px]">
        <div role="tablist" className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.clave}
              type="button"
              role="tab"
              aria-selected={tab === t.clave}
              onClick={() => setTab(t.clave)}
              className={`rounded-xl px-5 py-2.5 text-left transition ${
                tab === t.clave
                  ? "bg-kazaro-navy text-white shadow"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-kazaro-sky"
              }`}
            >
              <span className="block font-display text-sm font-extrabold">{t.titulo}</span>
              <span className={`block text-xs ${tab === t.clave ? "text-slate-300" : "text-slate-400"}`}>{t.descripcion}</span>
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="h-64 animate-pulse rounded-3xl bg-white/80" />
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-display text-lg font-bold text-red-800">No se pudo cargar el comparador</p>
            <p className="mt-2 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={cargar}
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              Reintentar
            </button>
          </div>
        ) : tab === "versus" ? (
          <VersusTab eventuales={datos.eventuales} user={user} />
        ) : (
          <SimilitudTab catalogo={datos.catalogo} user={user} />
        )}
      </div>
    </div>
  );
}
