import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

export default function AdminEventualesPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isReadOnly = rolUpper === "COORDINADOR" || rolUpper === "CONSULTOR";
  const [recientes, setRecientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/admin/eventuales`);
        const data = await res.json().catch(() => []);
        setRecientes(Array.isArray(data) ? data.slice(0, 5) : []);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const sections = [
    {
      title: "Historial de eventuales",
      description: "Filtrá y auditá cambios, incluyendo componentes por tipo de máquina y vehículos utilizados.",
      to: "/admin/eventuales/historial",
      icon: "🗂",
    },
    ...(isReadOnly
      ? []
      : [{
      title: "Registrar eventual",
      description: "Creá un eventual y cargá componentes usados: tipos de máquina con cantidad y vehículos puntuales.",
      to: "/admin/eventuales/nuevo",
      icon: "➕",
    }]),
  ];

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-10">
      <button
        onClick={() => navigate("/admin")}
        className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
      >
        ← Volver al panel
      </button>

      <header className="mx-auto mb-8 max-w-4xl text-center">
        <h1 className="text-3xl font-extrabold text-gray-800">Panel de eventuales</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gestioná altas de eventuales y el historial completo de sus cambios.
        </p>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.title}
            to={section.to}
            className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="mb-4 block text-5xl">{section.icon}</span>
            <h2 className="mb-2 text-xl font-bold text-gray-800">{section.title}</h2>
            <p className="text-sm text-gray-500">{section.description}</p>
          </Link>
        ))}
      </div>

      <section className="mx-auto mt-10 max-w-5xl rounded-2xl bg-white p-6 shadow">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Eventuales recientes</h2>
            <p className="text-sm text-gray-500">Acceso rapido a los ultimos registros cargados.</p>
          </div>
          <Link to="/admin/eventuales/historial" className="text-sm font-semibold text-blue-700">
            Ver todos
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando eventuales...</p>
        ) : recientes.length === 0 ? (
          <p className="text-sm text-gray-500">Todavia no hay eventuales cargados.</p>
        ) : (
          <div className="space-y-3">
            {recientes.map((eventual) => (
              <Link
                key={eventual.id}
                to={`/admin/eventuales/${eventual.id}`}
                className="block rounded-xl border border-gray-200 p-4 transition hover:border-blue-200 hover:bg-blue-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{eventual.nombre}</p>
                    <p className="text-xs text-gray-500">
                      Supervisor: {eventual.supervisor?.nombre || eventual.supervisor?.username || "-"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {String(eventual.estado).toLowerCase() === "activo" ? (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">ACTIVO</span>
                    ) : String(eventual.estado).toLowerCase() === "finalizado" ? (
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase text-slate-700">FINALIZADO</span>
                    ) : (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase text-rose-700">{String(eventual.estado).toUpperCase()}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
