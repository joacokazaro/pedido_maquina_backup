import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE } from "../../services/apiBase";
import { buildActorHeaders } from "../../utils/authHeaders";
import { presetRange } from "../../utils/date";
import SeccionTiempoReal from "./SeccionTiempoReal";
import SeccionAvisos from "./SeccionAvisos";
import SeccionPeriodo from "./SeccionPeriodo";

const UMBRALES_DEFAULT = { umbralAmarillo: 5, umbralRojo: 10, diasVentanaVencimiento: 30 };

const TABS = [
  { key: "tiempo-real", label: "Tiempo real" },
  { key: "avisos", label: "Avisos" },
  { key: "periodo", label: "Período" },
];

async function fetchJson(path, user) {
  const res = await fetch(`${API_BASE}${path}`, { headers: buildActorHeaders(user) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Error obteniendo estadísticas");
  return data;
}

export default function AdminEstadisticas() {
  const { user } = useAuth();

  const [tiempoReal, setTiempoReal] = useState(null);
  const [tiempoRealLoading, setTiempoRealLoading] = useState(true);
  const [tiempoRealError, setTiempoRealError] = useState("");

  const [umbrales, setUmbrales] = useState(UMBRALES_DEFAULT);
  const [avisos, setAvisos] = useState(null);
  const [avisosLoading, setAvisosLoading] = useState(true);
  const [avisosError, setAvisosError] = useState("");

  const [rango, setRango] = useState(() => presetRange("30d"));
  const [periodo, setPeriodo] = useState(null);
  const [periodoLoading, setPeriodoLoading] = useState(true);
  const [periodoError, setPeriodoError] = useState("");

  const [activeTab, setActiveTab] = useState(TABS[0].key);

  const cargarTiempoReal = useCallback(async () => {
    try {
      setTiempoRealLoading(true);
      setTiempoRealError("");
      setTiempoReal(await fetchJson("/admin/estadisticas/tiempo-real", user));
    } catch (e) {
      setTiempoRealError(e.message || "Error cargando tiempo real");
    } finally {
      setTiempoRealLoading(false);
    }
  }, [user]);

  const cargarAvisos = useCallback(async () => {
    try {
      setAvisosLoading(true);
      setAvisosError("");
      const params = new URLSearchParams({
        umbralAmarillo: String(umbrales.umbralAmarillo),
        umbralRojo: String(umbrales.umbralRojo),
        diasVentanaVencimiento: String(umbrales.diasVentanaVencimiento),
      });
      setAvisos(await fetchJson(`/admin/estadisticas/avisos?${params.toString()}`, user));
    } catch (e) {
      setAvisosError(e.message || "Error cargando avisos");
    } finally {
      setAvisosLoading(false);
    }
  }, [user, umbrales]);

  const cargarPeriodo = useCallback(async () => {
    try {
      setPeriodoLoading(true);
      setPeriodoError("");
      const params = new URLSearchParams({ desde: rango.desde, hasta: rango.hasta });
      setPeriodo(await fetchJson(`/admin/estadisticas/periodo?${params.toString()}`, user));
    } catch (e) {
      setPeriodoError(e.message || "Error cargando el período");
    } finally {
      setPeriodoLoading(false);
    }
  }, [user, rango]);

  useEffect(() => {
    cargarTiempoReal();
  }, [cargarTiempoReal]);

  useEffect(() => {
    cargarAvisos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  useEffect(() => {
    cargarPeriodo();
  }, [cargarPeriodo]);

  function actualizarSnapshot() {
    cargarTiempoReal();
    cargarAvisos();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <header className="mb-4">
        <h1 className="font-display text-2xl font-bold text-kazaro-navy">Estadísticas</h1>
      </header>

      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-2xl bg-white p-1.5 shadow">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab.key
                ? "bg-gradient-to-r from-kazaro-blue to-kazaro-cyan text-white shadow-md shadow-kazaro-cyan/25"
                : "text-slate-600 hover:bg-kazaro-mist"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "tiempo-real" ? (
          <SeccionTiempoReal data={tiempoReal} loading={tiempoRealLoading} error={tiempoRealError} onActualizar={actualizarSnapshot} />
        ) : null}
        {activeTab === "avisos" ? (
          <SeccionAvisos data={avisos} loading={avisosLoading} error={avisosError} umbrales={umbrales} onUmbralesChange={setUmbrales} />
        ) : null}
        {activeTab === "periodo" ? (
          <SeccionPeriodo data={periodo} loading={periodoLoading} error={periodoError} rango={rango} onRangoChange={setRango} />
        ) : null}
      </div>
    </div>
  );
}
