import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function AdminUsuarioForm() {
  const navigate = useNavigate();
  const { username } = useParams();
  const isEdit = Boolean(username);

  const [form, setForm] = useState({
    username: "",
    nombre: "",
    rol: "SUPERVISOR",
    password: "",
  });

  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) return;

    async function load() {
      const res = await fetch(`${API_BASE}/admin-users/${username}`);
      const data = await res.json();

      setForm({
        username: data.username,
        nombre: data.nombre || "",
        rol: data.rol,
        password: "",
      });
    }

    load();
  }, [isEdit, username]);

  async function save() {
    setError("");

    if (!isEdit && form.password.trim() === "") {
      setError("La contraseña es obligatoria");
      return;
    }

    const payload = {
      nombre: form.nombre,
      rol: form.rol.toLowerCase(),
    };

    if (!isEdit) payload.username = form.username;
    if (form.password.trim()) payload.password = form.password;

    const res = await fetch(
      isEdit
        ? `${API_BASE}/admin-users/${username}`
        : `${API_BASE}/admin-users`,
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Error guardando usuario");
      return;
    }

    navigate("/admin/usuarios");
  }

  async function eliminarUsuario() {
    setError("");

    const res = await fetch(
      `${API_BASE}/admin-users/${username}`,
      { method: "DELETE" }
    );

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Error eliminando usuario");
      setShowDelete(false);
      return;
    }

    navigate("/admin/usuarios");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-32 relative">

      {/* VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 px-3 py-2 rounded-lg bg-white border shadow text-sm"
      >
        ← Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">
        {isEdit ? "Editar usuario" : "Nuevo usuario"}
      </h1>

      {/* ERROR */}
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-red-100 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* USERNAME */}
      <input
        placeholder="Usuario"
        disabled={isEdit}
        className={`w-full p-3 mb-3 border rounded-xl ${
          isEdit ? "bg-gray-100 cursor-not-allowed" : "bg-white"
        }`}
        value={form.username}
        onChange={(e) =>
          setForm({ ...form, username: e.target.value })
        }
      />

      {/* NOMBRE */}
      <input
        placeholder="Nombre completo"
        className="w-full p-3 mb-3 border rounded-xl bg-white"
        value={form.nombre}
        onChange={(e) =>
          setForm({ ...form, nombre: e.target.value })
        }
      />

      {/* ROL */}
      <select
        className="w-full p-3 mb-3 border rounded-xl bg-white"
        value={form.rol}
        onChange={(e) =>
          setForm({ ...form, rol: e.target.value })
        }
      >
        <option value="ADMIN">ADMIN</option>
        <option value="SUPERVISOR">SUPERVISOR</option>
        <option value="DEPOSITO">DEPOSITO</option>
      </select>

      {/* PASSWORD */}
      <input
        type="password"
        placeholder={
          isEdit
            ? "Contraseña (dejar vacío para no cambiar)"
            : "Contraseña"
        }
        className="w-full p-3 mb-3 border rounded-xl bg-white"
        value={form.password}
        onChange={(e) =>
          setForm({ ...form, password: e.target.value })
        }
      />

      {/* GUARDAR */}
      <button
        onClick={save}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-semibold shadow"
      >
        Guardar
      </button>

      {/* ELIMINAR */}
      {isEdit && (
        <button
          onClick={() => setShowDelete(true)}
          className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl font-semibold shadow"
        >
          Eliminar usuario
        </button>
      )}

      {/* MODAL ELIMINAR */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">
              Eliminar usuario
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Esta acción es irreversible.  
              ¿Seguro que querés eliminar el usuario
              <b> @{form.username}</b>?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 p-2 rounded-lg border"
              >
                Cancelar
              </button>

              <button
                onClick={eliminarUsuario}
                className="flex-1 p-2 rounded-lg bg-red-600 text-white"
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
