import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [search, setSearch] = useState("");
  const [rol, setRol] = useState("");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (rol) params.append("rol", rol);

      const url =
        params.toString().length > 0
          ? `http://localhost:3000/admin-users?${params.toString()}`
          : `http://localhost:3000/admin-users`;

      const res = await fetch(url);

      if (!res.ok) {
        console.error("Error al cargar usuarios:", res.status);
        return;
      }

      const data = await res.json();
      setUsuarios(data);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    }
  }

  useEffect(() => {
    load();
  }, [search, rol]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* BOTÓN VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg 
                   bg-white border border-gray-200 shadow-sm 
                   hover:shadow transition text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">Usuarios</h1>

      {/* BUSCADOR */}
      <input
        placeholder="Buscar nombre o usuario..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-3 mb-3 border rounded-xl"
      />

      {/* FILTRO ROL */}
      <select
        className="w-full p-3 mb-4 border rounded-xl bg-white"
        value={rol}
        onChange={(e) => setRol(e.target.value)}
      >
        <option value="">Todos los roles</option>
        <option value="admin">ADMIN</option>
        <option value="supervisor">SUPERVISOR</option>
        <option value="deposito">DEPOSITO</option>
      </select>

      {/* LISTADO */}
      <div className="space-y-3">
        {usuarios.map((u) => (
          <div
            key={u.username}
            className="bg-white rounded-xl shadow p-4 cursor-pointer"
            onClick={() => navigate(`/admin/usuarios/${u.username}`)}
          >
            <p className="font-bold">{u.nombre}</p>
            <p className="text-sm text-gray-600">@{u.username}</p>

            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 mt-2 inline-block">
              {u.rol.toUpperCase()}
            </span>

            {!u.activo && (
              <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 ml-2">
                Inactivo
              </span>
            )}
          </div>
        ))}
      </div>

      {/* BOTÓN NUEVO USUARIO */}
      <button
        onClick={() => navigate("/admin/usuarios/nuevo")}
        className="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-full shadow-lg"
      >
        + Nuevo usuario
      </button>

    </div>
  );
}
