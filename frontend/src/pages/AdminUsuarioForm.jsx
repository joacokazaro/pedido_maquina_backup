import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import SearchableSelect from "../components/SearchableSelect";
import { ROLE_LABELS } from "../constants/roles";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: ROLE_LABELS.ADMIN },
  { value: "ENCARGADO_EV", label: ROLE_LABELS.ENCARGADO_EV },
  { value: "SUPERVISOR_LIMPIEZA", label: ROLE_LABELS.SUPERVISOR_LIMPIEZA },
  { value: "DEPOSITO", label: ROLE_LABELS.DEPOSITO },
  { value: "COORDINADOR", label: ROLE_LABELS.COORDINADOR },
  { value: "CONSULTOR", label: ROLE_LABELS.CONSULTOR },
  { value: "TALLER", label: ROLE_LABELS.TALLER },
];

const FUSION_PAIR = ["DEPOSITO", "TALLER"];

export default function AdminUsuarioForm() {
  const navigate = useNavigate();
  const { username } = useParams();
  const isEdit = Boolean(username);

  const [form, setForm] = useState({
    username: "",
    nombre: "",
    roles: ["ENCARGADO_EV"],
    password: "",
    activo: true,
    vtoCarnetConductor: "",
  });

  const [error, setError] = useState("");
  const [showToggle, setShowToggle] = useState(false);
  const [nextActivo, setNextActivo] = useState(true);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleModalMessage, setRoleModalMessage] = useState("");

  useEffect(() => {
    if (!isEdit) return;

    async function load() {
      const res = await fetch(`${API_BASE}/admin-users/${username}`);
      const data = await res.json();

      setForm({
        username: data.username,
        nombre: data.nombre || "",
        roles: Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : [data.rol || "ENCARGADO_EV"],
        password: "",
        activo: data.activo !== false,
        vtoCarnetConductor: data.vtoCarnetConductor ? new Date(data.vtoCarnetConductor).toISOString().slice(0, 10) : "",
      });
    }

    load();
  }, [isEdit, username]);

  const selectedRoles = Array.isArray(form.roles) ? form.roles : [];
  const primaryRole = selectedRoles[0] || "ENCARGADO_EV";
  const secondaryRole = selectedRoles[1] || "";

  function isAllowedRoleCombination(roles) {
    const normalized = Array.from(new Set((Array.isArray(roles) ? roles : []).filter(Boolean)));
    if (normalized.length <= 1) return true;
    if (normalized.length !== 2) return false;
    return normalized.includes("DEPOSITO") && normalized.includes("TALLER");
  }

  function openInvalidCombinationModal() {
    setRoleModalMessage("Esa combinación de roles no es posible. Solo se admite un rol o DEPOSITO + TALLER.");
    setShowRoleModal(true);
  }

  function handlePrimaryRoleChange(role) {
    const normalized = String(role || "").toUpperCase();
    if (!normalized) return;

    setForm((prev) => {
      const currentSecondary = Array.isArray(prev.roles) ? prev.roles[1] : "";
      const candidate = currentSecondary ? [normalized, currentSecondary] : [normalized];

      if (!isAllowedRoleCombination(candidate)) {
        openInvalidCombinationModal();
        return { ...prev, roles: [normalized] };
      }

      return {
        ...prev,
        roles: currentSecondary ? [normalized, currentSecondary] : [normalized],
      };
    });
  }

  function handleSecondaryRoleChange(role) {
    const normalized = String(role || "").toUpperCase();

    setForm((prev) => {
      const currentPrimary = (Array.isArray(prev.roles) ? prev.roles[0] : "") || "ENCARGADO_EV";

      if (!normalized || normalized === currentPrimary) {
        return { ...prev, roles: [currentPrimary] };
      }

      const candidate = [currentPrimary, normalized];
      if (!isAllowedRoleCombination(candidate)) {
        openInvalidCombinationModal();
        return { ...prev, roles: [currentPrimary] };
      }

      return { ...prev, roles: [currentPrimary, normalized] };
    });
  }

  async function save() {
    setError("");

    if (!isEdit && form.password.trim() === "") {
      setError("La contraseña es obligatoria");
      return;
    }

    const payload = {
      nombre: form.nombre,
      roles: (Array.isArray(form.roles) ? form.roles : []).map((r) => String(r || "").toLowerCase()),
      rol: (form.roles?.[0] || "ENCARGADO_EV").toLowerCase(),
      activo: Boolean(form.activo),
      vtoCarnetConductor: form.vtoCarnetConductor || null,
    };

    if (!payload.roles.length) {
      setError("Debes seleccionar al menos un rol");
      return;
    }

    if (!isAllowedRoleCombination(payload.roles.map((r) => String(r || "").toUpperCase()))) {
      openInvalidCombinationModal();
      return;
    }

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
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Usuario</label>
        <input
          disabled={isEdit}
          className={`w-full p-3 border rounded-xl ${
            isEdit ? "bg-gray-100 cursor-not-allowed" : "bg-white"
          }`}
          value={form.username}
          onChange={(e) =>
            setForm({ ...form, username: e.target.value })
          }
        />
      </div>

      {/* NOMBRE */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Nombre completo</label>
        <input
          className="w-full p-3 border rounded-xl bg-white"
          value={form.nombre}
          onChange={(e) =>
            setForm({ ...form, nombre: e.target.value })
          }
        />
      </div>

      {/* ROLES */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Rol principal</label>
        <SearchableSelect
          className="w-full rounded-xl border bg-white p-3"
          value={primaryRole}
          onChange={(event) => handlePrimaryRoleChange(event.target.value)}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </SearchableSelect>

        <label className="mb-1 mt-3 block text-xs font-semibold text-gray-600">Rol adicional (opcional)</label>
        <SearchableSelect
          className="w-full rounded-xl border bg-white p-3"
          value={secondaryRole}
          onChange={(event) => handleSecondaryRoleChange(event.target.value)}
        >
          <option value="">Sin rol adicional</option>
          {ROLE_OPTIONS.filter((role) => role.value !== primaryRole).map((role) => (
            <option key={role.value} value={role.value}>{role.label}</option>
          ))}
        </SearchableSelect>

        <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Roles efectivos: <b>{selectedRoles.join(" + ")}</b>
        </div>
      </div>

      {/* PASSWORD */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-gray-600">Contraseña{isEdit ? " (dejar vacío para no cambiar)" : ""}</label>
        <input
          type="password"
          className="w-full p-3 border rounded-xl bg-white"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
        />
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-gray-600">
          Vto. carnet conductor
        </label>
        <input
          type="date"
          className="w-full rounded-xl border bg-white p-3"
          value={form.vtoCarnetConductor}
          onChange={(e) =>
            setForm({ ...form, vtoCarnetConductor: e.target.value })
          }
        />
      </div>

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

      {/* MODAL COMBINACION INVALIDA */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h2 className="mb-2 text-lg font-bold">Combinación no permitida</h2>
            <p className="mb-4 text-sm text-gray-600">{roleModalMessage}</p>
            <button
              type="button"
              onClick={() => setShowRoleModal(false)}
              className="w-full rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
