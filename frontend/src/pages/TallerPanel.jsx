import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import { buildActorHeaders } from "../utils/authHeaders";

const ESTADOS = ["", "disponible", "asignada", "no_devuelta", "fuera_servicio", "taller", "baja", "activo"];

export default function TallerPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const canEdit = rolUpper === "ADMIN" || rolUpper === "TALLER";
  const actorHeaders = useMemo(() => buildActorHeaders(user), [user]);

  const [maquinas, setMaquinas] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [historialMaquinas, setHistorialMaquinas] = useState([]);
  const [historialVehiculos, setHistorialVehiculos] = useState([]);

  const [maquinaSearch, setMaquinaSearch] = useState("");
  const [maquinaEstado, setMaquinaEstado] = useState("");
  const [vehiculoSearch, setVehiculoSearch] = useState("");
  const [vehiculoEstado, setVehiculoEstado] = useState("");

  const [selectedMaquinas, setSelectedMaquinas] = useState([]);
  const [selectedVehiculos, setSelectedVehiculos] = useState([]);
  const [observacionMaquinas, setObservacionMaquinas] = useState("");
  const [observacionVehiculos, setObservacionVehiculos] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [maquinasRes, vehiculosRes, historialMRes, historialVRes] = await Promise.all([
        fetch(`${API_BASE}/admin/maquinas`, { headers: actorHeaders }),
        fetch(`${API_BASE}/admin/vehiculos`, { headers: actorHeaders }),
        fetch(`${API_BASE}/admin/taller/maquinas/historial?limit=100`, { headers: actorHeaders }),
        fetch(`${API_BASE}/admin/taller/vehiculos/historial?limit=100`, { headers: actorHeaders }),
      ]);

      const [maquinasData, vehiculosData, historialMData, historialVData] = await Promise.all([
        maquinasRes.json().catch(() => []),
        vehiculosRes.json().catch(() => []),
        historialMRes.json().catch(() => []),
        historialVRes.json().catch(() => []),
      ]);

      if (!maquinasRes.ok || !vehiculosRes.ok || !historialMRes.ok || !historialVRes.ok) {
        throw new Error("No se pudieron cargar los datos del panel de taller");
      }

      setMaquinas(Array.isArray(maquinasData) ? maquinasData : []);
      setVehiculos(Array.isArray(vehiculosData) ? vehiculosData : []);
      setHistorialMaquinas(Array.isArray(historialMData) ? historialMData : []);
      setHistorialVehiculos(Array.isArray(historialVData) ? historialVData : []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error cargando panel de taller");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const maquinasFiltradas = useMemo(() => {
    let data = [...maquinas];
    if (maquinaEstado) data = data.filter((item) => item.estado === maquinaEstado);
    if (maquinaSearch.trim()) {
      const q = maquinaSearch.trim().toLowerCase();
      data = data.filter((item) =>
        [item.id, item.tipo, item.modelo, item.serie, item.servicio?.nombre]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }
    return data;
  }, [maquinas, maquinaSearch, maquinaEstado]);

  const vehiculosFiltrados = useMemo(() => {
    let data = [...vehiculos];
    if (vehiculoEstado) data = data.filter((item) => item.estado === vehiculoEstado);
    if (vehiculoSearch.trim()) {
      const q = vehiculoSearch.trim().toLowerCase();
      data = data.filter((item) =>
        [item.id, item.vehiculo, item.patente, item.modelo, item.empresa]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }
    return data;
  }, [vehiculos, vehiculoSearch, vehiculoEstado]);

  function toggleSelection(type, id) {
    if (type === "maquina") {
      setSelectedMaquinas((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
      return;
    }
    setSelectedVehiculos((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function ejecutarMovimiento(type, accion) {
    const ids = type === "maquina" ? selectedMaquinas : selectedVehiculos;
    const observacion = type === "maquina" ? observacionMaquinas : observacionVehiculos;
    if (!ids.length) {
      setError(`Selecciona al menos ${type === "maquina" ? "una maquina" : "un vehiculo"}`);
      return;
    }

    try {
      setBusy(true);
      setError("");

      const res = await fetch(`${API_BASE}/admin/taller/${type === "maquina" ? "maquinas" : "vehiculos"}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...actorHeaders },
        body: JSON.stringify({ ids, accion, observacion }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo aplicar el movimiento");

      if (type === "maquina") {
        setSelectedMaquinas([]);
        setObservacionMaquinas("");
      } else {
        setSelectedVehiculos([]);
        setObservacionVehiculos("");
      }

      await load();
    } catch (e) {
      console.error(e);
      setError(e.message || "Error aplicando movimiento");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-4">Cargando panel de taller...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <div className="mb-4">
        <h1 className="text-2xl font-bold">Taller</h1>
        <p className="text-sm text-gray-600">Panel para ingreso y egreso masivo de maquinas y vehiculos.</p>
      </div>

      {error ? <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}
      {!canEdit ? <div className="mb-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">Modo solo lectura.</div> : null}

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-white p-3 shadow">
          <p className="text-xs text-gray-500">Maquinas en taller</p>
          <p className="text-2xl font-bold text-amber-700">{maquinas.filter((item) => item.estado === "taller").length}</p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow">
          <p className="text-xs text-gray-500">Vehiculos en taller</p>
          <p className="text-2xl font-bold text-amber-700">{vehiculos.filter((item) => item.estado === "taller").length}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold">Maquinas</h2>
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <input
              className="rounded-xl border p-2 text-sm"
              placeholder="Buscar maquinas..."
              value={maquinaSearch}
              onChange={(e) => setMaquinaSearch(e.target.value)}
            />
            <select className="rounded-xl border p-2 text-sm" value={maquinaEstado} onChange={(e) => setMaquinaEstado(e.target.value)}>
              {ESTADOS.map((estado) => (
                <option key={`m-${estado || "all"}`} value={estado}>{estado || "todos"}</option>
              ))}
            </select>
          </div>

          {canEdit ? (
            <div className="mb-3 space-y-2">
              <textarea
                className="w-full rounded-xl border p-2 text-sm"
                placeholder="Observacion opcional para el lote"
                value={observacionMaquinas}
                onChange={(e) => setObservacionMaquinas(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ejecutarMovimiento("maquina", "ingreso")}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-amber-300"
                >
                  Ingreso masivo
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ejecutarMovimiento("maquina", "egreso")}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-emerald-300"
                >
                  Egreso masivo
                </button>
              </div>
            </div>
          ) : null}

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {maquinasFiltradas.map((item) => (
              <label key={item.id} className="flex items-start gap-2 rounded-xl border p-2 text-sm">
                {canEdit ? (
                  <input
                    type="checkbox"
                    checked={selectedMaquinas.includes(item.id)}
                    onChange={() => toggleSelection("maquina", item.id)}
                    className="mt-1"
                  />
                ) : null}
                <span>
                  <b>{item.id}</b> · {item.tipo} · {item.modelo || "-"}
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-700">{item.estado}</span>
                </span>
              </label>
            ))}
          </div>

          <h3 className="mt-4 mb-2 text-sm font-semibold text-gray-700">Historial de maquinas</h3>
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border p-2 text-xs">
            {historialMaquinas.map((entry) => (
              <div key={entry.id} className="rounded-lg bg-gray-50 p-2">
                <p>
                  <b>{entry.maquina?.id || "-"}</b> · {entry.accion} · {new Date(entry.createdAt).toLocaleString("es-AR")}
                </p>
                <p>Usuario: {entry.usuario?.nombre || entry.usuario?.username || "-"}</p>
                <p>Observacion: {entry.observacion || "-"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <h2 className="mb-3 text-lg font-semibold">Vehiculos</h2>
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <input
              className="rounded-xl border p-2 text-sm"
              placeholder="Buscar vehiculos..."
              value={vehiculoSearch}
              onChange={(e) => setVehiculoSearch(e.target.value)}
            />
            <select className="rounded-xl border p-2 text-sm" value={vehiculoEstado} onChange={(e) => setVehiculoEstado(e.target.value)}>
              {ESTADOS.map((estado) => (
                <option key={`v-${estado || "all"}`} value={estado}>{estado || "todos"}</option>
              ))}
            </select>
          </div>

          {canEdit ? (
            <div className="mb-3 space-y-2">
              <textarea
                className="w-full rounded-xl border p-2 text-sm"
                placeholder="Observacion opcional para el lote"
                value={observacionVehiculos}
                onChange={(e) => setObservacionVehiculos(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ejecutarMovimiento("vehiculo", "ingreso")}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-amber-300"
                >
                  Ingreso masivo
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ejecutarMovimiento("vehiculo", "egreso")}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-emerald-300"
                >
                  Egreso masivo
                </button>
              </div>
            </div>
          ) : null}

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {vehiculosFiltrados.map((item) => (
              <label key={item.id} className="flex items-start gap-2 rounded-xl border p-2 text-sm">
                {canEdit ? (
                  <input
                    type="checkbox"
                    checked={selectedVehiculos.includes(item.id)}
                    onChange={() => toggleSelection("vehiculo", item.id)}
                    className="mt-1"
                  />
                ) : null}
                <span>
                  <b>{item.id}</b> · {item.vehiculo || "Vehiculo"} · {item.patente || "-"}
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-700">{item.estado}</span>
                </span>
              </label>
            ))}
          </div>

          <h3 className="mt-4 mb-2 text-sm font-semibold text-gray-700">Historial de vehiculos</h3>
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border p-2 text-xs">
            {historialVehiculos.map((entry) => (
              <div key={entry.id} className="rounded-lg bg-gray-50 p-2">
                <p>
                  <b>{entry.vehiculo?.id || "-"}</b> · {entry.accion} · {new Date(entry.createdAt).toLocaleString("es-AR")}
                </p>
                <p>Usuario: {entry.usuario?.nombre || entry.usuario?.username || "-"}</p>
                <p>Observacion: {entry.observacion || "-"}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}