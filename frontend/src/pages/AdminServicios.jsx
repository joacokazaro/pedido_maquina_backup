import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function AdminServicios() {
  const navigate = useNavigate();
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/admin/servicios`)
      .then(r => r.json())
      .then(data => setServicios(data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">Cargando servicios...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <header className="mb-4 flex justify-between">
        <h1 className="text-2xl font-bold">Servicios</h1>
        <button
          onClick={() => navigate("/admin")}
          className="text-xs text-blue-600 underline"
        >
          Volver
        </button>
      </header>

      <div className="space-y-2">
        {servicios.map(s => (
          <button
            key={s.id}
            onClick={() => navigate(`/admin/servicios/${s.id}`)}
            className="w-full bg-white rounded-xl shadow px-4 py-3 flex justify-between"
          >
            <span className="font-semibold">{s.nombre}</span>
            <span className="text-xs text-gray-600">
              {s.maquinas} máquinas
            </span>
          </button>
        ))}
      </div>

      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => navigate("/admin/servicios/nuevo")}
          className="w-14 h-14 rounded-full bg-orange-600 text-white text-2xl"
        >
          +
        </button>
      </div>
    </div>
  );
}
