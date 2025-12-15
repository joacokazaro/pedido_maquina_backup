import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function AdminUsuarioForm() {
  const navigate = useNavigate();
  const { username } = useParams();

  const [form, setForm] = useState({
    username: "",
    nombre: "",
    rol: "supervisor",
    activo: true,
    password: "",
  });

  useEffect(() => {
    if (!username) return;

    async function loadUser() {
      const res = await fetch(`${API_BASE}
/admin-users/${username}`);
      const data = await res.json();
      setForm({
        username: data.username,
        nombre: data.nombre,
        rol: data.rol, // ya viene en minúsculas
        activo: data.activo,
        password: "",
      });
    }

    loadUser();
  }, [username]);

  async function save() {
    const payload = {
      username: form.username,
      nombre: form.nombre,
      rol: form.rol.toLowerCase(), // backend lo requiere en minúsculas
      activo: form.activo,
    };

    if (form.password.trim() !== "") {
      payload.password = form.password;
    }

    const method = username ? "PUT" : "POST";
    const url = username
      ? `${API_BASE}
/admin-users/${username}`
      : `${API_BASE}
/admin-users`;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      alert("Error: " + data.message);
      return;
    }

    navigate("/admin/usuarios");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-32">

      {/* BOTÓN VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg 
                   bg-white border border-gray-200 shadow-sm 
                   hover:shadow transition text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">
        {username ? "Editar usuario" : "Nuevo usuario"}
      </h1>

      <input
        placeholder="Usuario"
        className="w-full p-3 mb-3 border rounded-xl bg-white"
        value={form.username}
        onChange={(e) => setForm({ ...form, username: e.target.value })}
      />

      <input
        placeholder="Nombre completo"
        className="w-full p-3 mb-3 border rounded-xl bg-white"
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
      />

      <select
        className="w-full p-3 mb-3 border rounded-xl bg-white"
        value={form.rol}
        onChange={(e) => setForm({ ...form, rol: e.target.value })}
      >
        <option value="admin">ADMIN</option>
        <option value="supervisor">SUPERVISOR</option>
        <option value="deposito">DEPOSITO</option>
      </select>

      <input
        type="password"
        placeholder="Contraseña (dejar vacío para no cambiar)"
        className="w-full p-3 mb-3 border rounded-xl bg-white"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />

      <label className="flex items-center gap-2 mb-3 text-sm">
        <input
          type="checkbox"
          checked={form.activo}
          onChange={(e) => setForm({ ...form, activo: e.target.checked })}
        />
        Activo
      </label>

      <button
        onClick={save}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl mt-4 font-semibold shadow"
      >
        Guardar
      </button>
    </div>
  );
}
