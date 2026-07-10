import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import { formatDateOnly } from "../utils/date";
import FondoKazaro from "../components/FondoKazaro";

const FILTROS = ["TODOS", "activo", "finalizado", "cancelado"];

export default function SupervisorMisEventuales() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [eventuales, setEventuales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("TODOS");

  useEffect(() => {
    if (!user?.username) return;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (filtro !== "TODOS") params.set("estado", filtro);

        const res = await fetch(`${API_BASE}/eventuales/mis/${encodeURIComponent(user.username)}?${params.toString()}`);
        if (!res.ok) throw new Error("No se pudieron cargar tus eventuales");
        const data = await res.json();
        setEventuales(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando eventuales");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user?.username, search, filtro]);

  if (!user?.username) {
    return <div className="p-4">Cargando usuario...</div>;
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <FondoKazaro />
      <button
        onClick={() => navigate("/supervisor")}
        className="mb-4 self-start text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Volver al panel
      </button>

      <header className="mb-6 text-center">
        <h1 className="text-3xl font-extrabold text-gray-800">Mis eventuales</h1>
        <p className="mt-2 text-sm text-gray-600">Eventuales asignados a tu supervisión con detalle de componentes utilizados.</p>
      </header>

      <div className="mx-auto mb-4 max-w-3xl rounded-2xl bg-white p-3 shadow space-y-3">
        <input
          className="w-full rounded-xl border p-2.5 text-sm"
          placeholder="Buscar por eventual u observaciones..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex flex-wrap justify-center gap-2">
          {FILTROS.map((estado) => (
            <button
              key={estado}
              onClick={() => setFiltro(estado)}
              className={filtro === estado ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white" : "rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"}
            >
              {estado === "TODOS" ? "Todos" : estado}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-center text-sm text-gray-500">Cargando eventuales...</div> : null}
      {error ? <div className="text-center text-sm text-red-600">{error}</div> : null}

      <div className="mx-auto max-w-3xl space-y-4">
        {eventuales.map((eventual) => (
          <Link key={eventual.id} to={`/supervisor/eventuales/${eventual.id}`} className="block rounded-2xl bg-white p-5 shadow hover:shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-gray-900">{eventual.nombre}</p>
                <p className="text-xs text-gray-500">
                  Inicio: {formatDateOnly(eventual.fechaInicio)}
                  {" · "}
                  Fin: {formatDateOnly(eventual.fechaFin)}
                </p>
                {/* Observaciones y resumen de componentes se muestran en detalle e historial */}
              </div>
              <span className={eventual.estado === "activo" ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700" : eventual.estado === "finalizado" ? "rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700" : "rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase text-rose-700"}>
                {eventual.estado}
              </span>
            </div>
          </Link>
        ))}

        {!loading && !eventuales.length ? (
          <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow">
            No tenes eventuales que coincidan con el filtro actual.
          </div>
        ) : null}
      </div>
    </div>
  );
}
