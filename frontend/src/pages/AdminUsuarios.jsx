import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [search, setSearch] = useState("");
  const [rol, setRol] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (rol) params.append("rol", rol.toLowerCase());

    const url =
      params.toString().length > 0
        ? `${API_BASE}/admin-users?${params.toString()}`
        : `${API_BASE}/admin-users`;

    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    setUsuarios(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, [search, rol]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-3 py-2 rounded-lg bg-white border shadow text-sm"
      >
        ← Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">Usuarios</h1>

      {/* BUSCAR */}
      <input
        className="w-full p-3 mb-3 border rounded-xl"
        placeholder="Buscar por nombre o usuario"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* FILTRO ROL */}
      <select
        className="w-full p-3 mb-4 border rounded-xl bg-white"
        value={rol}
        onChange={(e) => setRol(e.target.value)}
      >
        <option value="">Todos</option>
        <option value="ADMIN">ADMIN</option>
        <option value="SUPERVISOR">SUPERVISOR</option>
        <option value="DEPOSITO">DEPOSITO</option>
      </select>

      {/* LISTA */}
      <div className="space-y-3">
        {usuarios.map((u) => (
          <div
            key={u.username}
            onClick={() => navigate(`/admin/usuarios/${u.username}`)}
            className="bg-white rounded-xl shadow p-4 cursor-pointer"
          >
            <p className="font-bold">{u.nombre}</p>
            <p className="text-sm text-gray-600">@{u.username}</p>

            <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
              {u.rol}
            </span>

            {!u.activo && (
              <span className="ml-2 text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                Inactivo
              </span>
            )}
          </div>
        ))}
      </div>

      {/* NUEVO */}
      <button
        onClick={() => navigate("/admin/usuarios/nuevo")}
        className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg"
      >
        + Nuevo
      </button>
    </div>
  );
}
