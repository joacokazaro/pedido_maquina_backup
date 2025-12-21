import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function AdminServicios() {
  const navigate = useNavigate();

  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [search, setSearch] = useState("");
  const [filtroMaquinas, setFiltroMaquinas] = useState("TODOS");
  const [orden, setOrden] = useState("NOMBRE_ASC");

  // eliminar
  const [servicioAEliminar, setServicioAEliminar] = useState(null);

  /* =========================
     CARGAR SERVICIOS
  ========================== */
  useEffect(() => {
    fetch(`${API_BASE}/admin/servicios`)
      .then(r => r.json())
      .then(data => setServicios(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  /* =========================
     ELIMINAR SERVICIO
  ========================== */
  async function eliminarServicio() {
    if (!servicioAEliminar) return;

    try {
      const res = await fetch(
        `${API_BASE}/admin/servicios/${servicioAEliminar.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error eliminando servicio");
      }

      setServicios(prev =>
        prev.filter(s => s.id !== servicioAEliminar.id)
      );

      setServicioAEliminar(null);
    } catch (e) {
      console.error(e);
      setServicioAEliminar(null);
    }
  }

  /* =========================
     FILTROS + ORDEN
  ========================== */
  const serviciosFiltrados = useMemo(() => {
    let lista = [...servicios];

    // 🔍 búsqueda simple
    if (search.trim()) {
      const t = search.toLowerCase();
      lista = lista.filter(s =>
        s.nombre.toLowerCase().includes(t)
      );
    }

    // 📦 filtro por máquinas
    if (filtroMaquinas === "CON") {
      lista = lista.filter(s => s.maquinas > 0);
    }
    if (filtroMaquinas === "SIN") {
      lista = lista.filter(s => s.maquinas === 0);
    }

    // ↕️ orden
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

  if (loading) {
    return <div className="p-4">Cargando servicios...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* HEADER */}
      <header className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          Servicios ({serviciosFiltrados.length})
        </h1>
        <button
          onClick={() => navigate("/admin")}
          className="text-xs text-blue-600 underline"
        >
          Volver
        </button>
      </header>

      {/* FILTROS */}
      <div className="bg-white rounded-xl shadow p-3 mb-4 space-y-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar servicio…"
          className="w-full border rounded-lg p-2 text-sm"
        />

        <div className="flex gap-2">
          <select
            value={filtroMaquinas}
            onChange={e => setFiltroMaquinas(e.target.value)}
            className="flex-1 border rounded-lg p-2 text-sm"
          >
            <option value="TODOS">Todos</option>
            <option value="CON">Con máquinas</option>
            <option value="SIN">Sin máquinas</option>
          </select>

          <select
            value={orden}
            onChange={e => setOrden(e.target.value)}
            className="flex-1 border rounded-lg p-2 text-sm"
          >
            <option value="NOMBRE_ASC">Nombre A–Z</option>
            <option value="NOMBRE_DESC">Nombre Z–A</option>
            <option value="MAQUINAS_ASC">Máquinas ↑</option>
            <option value="MAQUINAS_DESC">Máquinas ↓</option>
          </select>
        </div>
      </div>

      {/* LISTA */}
      <div className="space-y-2">
        {serviciosFiltrados.map(s => (
          <div
            key={s.id}
            className="bg-white rounded-xl shadow px-4 py-3
                       flex justify-between items-center"
          >
            <button
              onClick={() => navigate(`/admin/servicios/${s.id}`)}
              className="text-left flex-1"
            >
              <div className="font-semibold">{s.nombre}</div>
              <div className="text-xs text-gray-600">
                {s.maquinas} máquinas
              </div>
            </button>

            <button
              onClick={() => setServicioAEliminar(s)}
              className="ml-3 text-xs text-red-600 hover:underline"
            >
              Eliminar
            </button>
          </div>
        ))}

        {serviciosFiltrados.length === 0 && (
          <div className="text-sm text-gray-500 text-center mt-6">
            No hay servicios que coincidan con los filtros
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-4 right-4">
        <button
          onClick={() => navigate("/admin/servicios/nuevo")}
          className="w-14 h-14 rounded-full bg-orange-600
                     text-white text-2xl shadow-lg"
        >
          +
        </button>
      </div>

      {/* MODAL ELIMINAR */}
      {servicioAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">

            <h2 className="text-lg font-bold text-red-600 mb-3">
              ⚠ Eliminar servicio
            </h2>

            <p className="text-sm text-gray-700 mb-3">
              Estás por eliminar el servicio:
            </p>

            <p className="text-sm font-semibold mb-4">
              {servicioAEliminar.nombre}
            </p>

            <p className="text-sm text-red-600 font-semibold mb-4">
              Esta acción es permanente y no se puede deshacer.
            </p>

            <p className="text-xs text-gray-600 mb-6">
              Solo es posible eliminar servicios que no tengan máquinas asociadas.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setServicioAEliminar(null)}
                className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>

              <button
                onClick={eliminarServicio}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
