import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

export default function AdminSupervisoresServicios() {
  const navigate = useNavigate();

  const [supervisores, setSupervisores] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [supervisorSel, setSupervisorSel] = useState(null);
  const [seleccionados, setSeleccionados] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");


  /* =========================
     CARGA INICIAL
  ========================== */
  useEffect(() => {
  async function load() {
    try {
      const r1 = await fetch(`${API_BASE}/supervisores`);
      if (!r1.ok) throw new Error("No se pudieron cargar supervisores");
      const data1 = await r1.json();
      setSupervisores(Array.isArray(data1) ? data1 : []);
    } catch (e) {
      setSupervisores([]);
      setError("Error cargando supervisores");
    }

    try {
      const r2 = await fetch(`${API_BASE}/admin/servicios`);
      if (!r2.ok) throw new Error("No se pudieron cargar servicios");
      const data2 = await r2.json();
      setServicios(Array.isArray(data2) ? data2 : []);
    } catch (e) {
      setServicios([]);
      setError("Error cargando servicios");
    }
  }
  load();
}, []);



  /* =========================
     AL SELECCIONAR SUPERVISOR
  ========================== */
  function onSelectSupervisor(e) {
    const id = Number(e.target.value);
    const sup = supervisores.find((s) => s.id === id);

    setSupervisorSel(sup);
    setSeleccionados(sup ? sup.servicios.map((s) => s.id) : []);
  }

  /* =========================
     CHECKBOX SERVICIOS
  ========================== */
  function toggleServicio(id) {
    setSeleccionados((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }

  /* =========================
     GUARDAR
  ========================== */
  async function guardar() {
  if (!supervisorSel) return;

  setGuardando(true);
  setMensaje("");
  setError("");

  try {
    const res = await fetch(
  `${API_BASE}/supervisores/${supervisorSel.id}/servicios`,
  {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ servicioIds: seleccionados }),
  }
);


    if (!res.ok) throw new Error();

    setMensaje("Servicios asignados correctamente");

    // actualizar supervisor en memoria
    setSupervisorSel({
      ...supervisorSel,
      servicios: servicios.filter((s) => seleccionados.includes(s.id)),
    });
  } catch {
    setError("Error al guardar la asignación");
  } finally {
    setGuardando(false);
  }
}


  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      {/* Header */}
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-600 mb-2"
        >
          ← Volver
        </button>

        <h1 className="text-2xl font-bold">Supervisores x Servicios</h1>
        <p className="text-sm text-gray-600">
          Seleccioná un supervisor y asignale los servicios que puede operar.
        </p>
      </div>

      {/* Selector supervisor */}
      <div className="bg-white rounded-2xl shadow p-4 mb-4">
        <label className="block text-sm font-medium mb-2">
          Supervisor
        </label>

        <select
          className="w-full border rounded-lg p-2"
          onChange={onSelectSupervisor}
          defaultValue=""
        >
          <option value="" disabled>
            Seleccionar supervisor
          </option>
          {supervisores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre || s.username}
            </option>
          ))}
        </select>
      </div>

      {/* Servicios asignados (resumen) */}
{supervisorSel && (
  <div className="bg-white rounded-2xl shadow p-4 mb-4">
    <h2 className="text-lg font-semibold mb-2">
      Servicios actualmente asignados
    </h2>

    {supervisorSel.servicios.length === 0 ? (
      <p className="text-sm text-gray-500">
        No tiene servicios asignados.
      </p>
    ) : (
      <ul className="list-disc list-inside text-sm space-y-1">
        {supervisorSel.servicios.map((s) => (
          <li key={s.id}>{s.nombre}</li>
        ))}
      </ul>
    )}
  </div>
)}


      {/* Servicios */}
      {supervisorSel && (
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="text-lg font-semibold mb-3">
            Servicios habilitados
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {servicios.map((srv) => (
              <label
                key={srv.id}
                className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={seleccionados.includes(srv.id)}
                  onChange={() => toggleServicio(srv.id)}
                  className="w-4 h-4"
                />
                <span>{srv.nombre}</span>
              </label>
            ))}
          </div>
          
          {mensaje && (
  <div className="mb-3 rounded-lg bg-green-100 text-green-800 px-4 py-2 text-sm">
    {mensaje}
  </div>
)}

{error && (
  <div className="mb-3 rounded-lg bg-red-100 text-red-800 px-4 py-2 text-sm">
    {error}
  </div>
)}


          <button
            disabled={guardando}
            onClick={guardar}
            className="w-full bg-teal-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar asignación"}
          </button>
        </div>
      )}
    </div>
  );
}
