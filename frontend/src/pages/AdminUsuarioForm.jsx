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
    activo: true,
  });

  const [error, setError] = useState("");
  const [showToggle, setShowToggle] = useState(false);
  const [nextActivo, setNextActivo] = useState(true);

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
        activo: data.activo !== false,
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
      activo: Boolean(form.activo),
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

  async function toggleActivo(nextValue) {
    if (!isEdit) return;
    setError("");

    const res = await fetch(`${API_BASE}/admin-users/${username}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: nextValue }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error || "Error actualizando usuario");
      return;
    }

    setForm((prev) => ({ ...prev, activo: nextValue }));
    setShowToggle(false);
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

      <div className="mb-4">
        <h1 className="text-2xl font-bold">
          {isEdit ? "Editar usuario" : "Nuevo usuario"}
        </h1>
        {isEdit && !form.activo && (
          <p className="text-sm text-red-600 mt-1">Usuario inactivo</p>
        )}
      </div>

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

      {/* ACTIVAR/DESACTIVAR */}
      {isEdit && (
        <button
          onClick={() => {
            setNextActivo(!form.activo);
            setShowToggle(true);
          }}
          className={`w-full mt-4 text-white p-3 rounded-xl font-semibold shadow ${
            form.activo
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {form.activo ? "Desactivar usuario" : "Reactivar usuario"}
        </button>
      )}

      {/* MODAL ACTIVAR/DESACTIVAR */}
      {showToggle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2">
              {nextActivo ? "Reactivar usuario" : "Desactivar usuario"}
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              {nextActivo
                ? "¿Seguro que querés reactivar este usuario?"
                : "¿Seguro que querés desactivar este usuario?"}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowToggle(false)}
                className="flex-1 p-2 rounded-lg border"
              >
                Cancelar
              </button>

              <button
                onClick={() => toggleActivo(nextActivo)}
                className={`flex-1 p-2 rounded-lg text-white ${
                  nextActivo
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {nextActivo ? "Reactivar" : "Desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
