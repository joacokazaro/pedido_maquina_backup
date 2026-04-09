import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function DepositoServicios() {
  const navigate = useNavigate();

  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filtroMaquinas, setFiltroMaquinas] = useState("TODOS");
  const [orden, setOrden] = useState("NOMBRE_ASC");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/servicios/catalogo`);
        if (!res.ok) throw new Error("No se pudieron cargar los servicios");

        const data = await res.json();
        if (!cancelled) {
          setServicios(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setServicios([]);
          setError("Error cargando servicios");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const serviciosFiltrados = useMemo(() => {
    let lista = [...servicios];

    if (search.trim()) {
      const termino = search.toLowerCase();
      lista = lista.filter((s) => s.nombre.toLowerCase().includes(termino));
    }

    if (filtroMaquinas === "CON") {
      lista = lista.filter((s) => s.maquinas > 0);
    }
    if (filtroMaquinas === "SIN") {
      lista = lista.filter((s) => s.maquinas === 0);
    }

    switch (orden) {
      case "NOMBRE_DESC":
        lista.sort((a, b) => b.nombre.localeCompare(a.nombre));
        break;
      case "MAQUINAS_ASC":
        lista.sort((a, b) => a.maquinas - b.maquinas);
        break;
      case "MAQUINAS_DESC":
        lista.sort((a, b) => b.maquinas - a.maquinas);
        break;
      default:
        lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    return lista;
  }, [servicios, search, filtroMaquinas, orden]);

  if (loading) return <div className="p-4">Cargando servicios...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <header className="mb-4 flex justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Máquinas en Servicio</h1>
          <p className="text-xs text-gray-600 mt-1">
            Catálogo de servicios con acceso de solo lectura para depósito.
          </p>
        </div>

        <button
          onClick={() => navigate("/deposito")}
          className="text-xs text-blue-600 underline"
        >
          Volver
        </button>
      </header>

      <div className="bg-white rounded-xl shadow p-3 mb-4 space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar servicio..."
          className="w-full border rounded-lg p-2 text-sm"
        />

        <div className="flex gap-2">
          <select
            value={filtroMaquinas}
            onChange={(e) => setFiltroMaquinas(e.target.value)}
            className="flex-1 border rounded-lg p-2 text-sm"
          >
            <option value="TODOS">Todos</option>
            <option value="CON">Con máquinas</option>
            <option value="SIN">Sin máquinas</option>
          </select>

          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            className="flex-1 border rounded-lg p-2 text-sm"
          >
            <option value="NOMBRE_ASC">Nombre A-Z</option>
            <option value="NOMBRE_DESC">Nombre Z-A</option>
            <option value="MAQUINAS_ASC">Máquinas ↑</option>
            <option value="MAQUINAS_DESC">Máquinas ↓</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {serviciosFiltrados.map((servicio) => (
          <button
            key={servicio.id}
            onClick={() => navigate(`/deposito/servicios/${servicio.id}`)}
            className="w-full bg-white rounded-xl shadow px-4 py-3 flex justify-between items-center text-left"
          >
            <div>
              <div className="font-semibold">{servicio.nombre}</div>
              <div className="text-xs text-gray-600">
                {servicio.maquinas} máquinas asociadas
              </div>
            </div>

            <span className="text-xs font-semibold text-gray-400 uppercase">
              Ver
            </span>
          </button>
        ))}

        {serviciosFiltrados.length === 0 && (
          <div className="text-sm text-gray-500 text-center mt-6">
            No hay servicios que coincidan con los filtros.
          </div>
        )}
      </div>
    </div>
  );
}