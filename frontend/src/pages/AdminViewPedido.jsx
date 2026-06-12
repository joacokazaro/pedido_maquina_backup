import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import HistorialPedido from "../components/HistorialPedido";
import { useAuth } from "../context/AuthContext";


export default function AdminViewPedido() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pedido, setPedido] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [seleccion, setSeleccion] = useState([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  /* ============================
        CARGAR PEDIDO
  ============================ */
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [pedidoRes, maquinasRes, serviciosRes] = await Promise.all([
          fetch(`${API_BASE}/pedidos/${encodeURIComponent(id)}`),
          fetch(`${API_BASE}/admin/maquinas`),
          fetch(`${API_BASE}/servicios`),
        ]);

        if (!pedidoRes.ok) throw new Error("No se pudo cargar el pedido");
        if (!maquinasRes.ok) throw new Error("No se pudieron cargar las máquinas");
        if (!serviciosRes.ok) throw new Error("No se pudieron cargar los servicios");

        const [pedidoData, maquinasData, serviciosData, vehiculosData] = await Promise.all([
          pedidoRes.json(),
          maquinasRes.json(),
          serviciosRes.json(),
          fetch(`${API_BASE}/admin/vehiculos`).then((r) => r.json()),
        ]);

        setPedido(pedidoData);
        setObservacion(pedidoData.observacion || "");
        setServicioId(String(pedidoData.servicioId || ""));
        setSeleccion((pedidoData.itemsAsignados || []).map((item) => item.id));
        const maquinasArr = Array.isArray(maquinasData) ? maquinasData.map(m => ({ ...m, esVehiculo: false })) : [];
        const vehiculosArr = Array.isArray(vehiculosData) ? vehiculosData.map(v => ({ ...v, esVehiculo: true, asignacion: v.asignacionActual })) : [];
        setMaquinas([...maquinasArr, ...vehiculosArr]);
        setServicios(Array.isArray(serviciosData) ? serviciosData : []);
      } catch (err) {
        console.error(err);
        setError("Error cargando el pedido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const editable = ["PENDIENTE_PREPARACION", "PREPARADO", "ENTREGADO"].includes(pedido?.estado);

  /* ============================
        HELPERS
  ============================ */
  function estadoLabel(estado) {
    return estado.replaceAll("_", " ");
  }

  function toggleMaquina(maquinaId) {
    setSeleccion((prev) =>
      prev.includes(maquinaId)
        ? prev.filter((item) => item !== maquinaId)
        : [...prev, maquinaId]
    );
  }

  const maquinasFiltradas = useMemo(() => {
    const texto = search.trim().toLowerCase();

    return maquinas
      .filter((maquina) => {
        const estaSeleccionada = seleccion.includes(maquina.id);
        const disponible = maquina.estado === "disponible";
        const bloqueadaPorOtroPedido =
          maquina.asignacion?.pedidoId && maquina.asignacion.pedidoId !== pedido?.id;

        if (!estaSeleccionada && (!disponible || bloqueadaPorOtroPedido)) {
          return false;
        }

        if (!texto) return true;

        return [
          maquina.id,
          maquina.tipo,
          maquina.modelo,
          maquina.serie,
          maquina.servicio?.nombre,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(texto));
      })
      .sort((a, b) => {
        const aSelected = seleccion.includes(a.id);
        const bSelected = seleccion.includes(b.id);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return String(a.id).localeCompare(String(b.id), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [maquinas, pedido?.id, search, seleccion]);

  if (loading) {
    return <div className="p-6">Cargando pedido…</div>;
  }

  if (error || !pedido) {
    return <div className="p-6 text-red-500">{error || "Pedido no encontrado"}</div>;
  }

  async function guardarCambios() {
    if (!user?.username) return;

    setSaving(true);
    setError("");

    try {
      const maquinasSeleccionadas = seleccion.filter(sid => maquinas.some(m => m.id === sid && !m.esVehiculo));
      const vehiculosSeleccionadas = seleccion.filter(sid => maquinas.some(m => m.id === sid && m.esVehiculo));

      const res = await fetch(`${API_BASE}/admin/pedidos/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: user.username,
          observacion,
          servicioId: Number(servicioId),
          asignadas: maquinasSeleccionadas,
          vehiculos: vehiculosSeleccionadas,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el pedido");
      }

      setEditando(false);

      const pedidoRes = await fetch(`${API_BASE}/pedidos/${encodeURIComponent(id)}`);
      if (!pedidoRes.ok) throw new Error("No se pudo recargar el pedido");
      const pedidoData = await pedidoRes.json();
      setPedido(pedidoData);
      setObservacion(pedidoData.observacion || "");
      setServicioId(String(pedidoData.servicioId || ""));
      setSeleccion((pedidoData.itemsAsignados || []).map((item) => item.id));
    } catch (err) {
      console.error(err);
      setError(err.message || "Error guardando cambios");
    } finally {
      setSaving(false);
    }
  }

  /* ============================
        RENDER
  ============================ */
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-white border border-gray-200 shadow-sm hover:shadow
                   text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      {/* HEADER */}
<h1 className="text-2xl font-bold mb-1">Pedido {pedido.id}</h1>

<div className="text-sm text-gray-600 mb-2 space-y-1">
  <p>
    Solicitante:{" "}
    <b>{pedido.supervisorName ?? pedido.supervisor ?? "—"}</b>
  </p>
  <p>
      Titular: <b>{pedido.titular ?? "—"}</b>
  </p>
</div>


      <span className="inline-block px-4 py-1.5 rounded-full bg-gray-200 text-gray-800 text-sm font-semibold mb-4">
        {estadoLabel(pedido.estado)}
      </span>

      {editable && (
        <div className="mb-4 flex gap-2">
          {!editando ? (
            <button
              onClick={() => setEditando(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Editar pedido
            </button>
          ) : (
            <>
              <button
                onClick={guardarCambios}
                disabled={saving}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                onClick={() => {
                  setEditando(false);
                  setObservacion(pedido.observacion || "");
                  setServicioId(String(pedido.servicioId || ""));
                  setSeleccion((pedido.itemsAsignados || []).map((item) => item.id));
                  setSearch("");
                }}
                disabled={saving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}

      {!editable && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Este pedido ya salió de la etapa editable. Solo se permite edición admin hasta entregado inclusive.
        </div>
      )}

      {/* SERVICIO */}
      {pedido.servicio && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-green-500">
          <h2 className="text-lg font-semibold mb-1">Servicio</h2>
          <p className="text-sm text-gray-700">{pedido.servicio}</p>
        </div>
      )}

      {/* OBSERVACIÓN SUPERVISOR */}
      {pedido.observacion && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 border-l-4 border-blue-500">
          <h2 className="text-lg font-semibold mb-1">Observación inicial</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {pedido.observacion}
          </p>
        </div>
      )}

      {editando && (
        <div className="bg-white rounded-xl shadow p-4 mb-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-800">
              Servicio
            </label>
            <select
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
              className="w-full rounded-lg border p-3 text-sm"
            >
              <option value="">Seleccionar servicio</option>
              {servicios.map((servicio) => (
                <option key={servicio.id} value={servicio.id}>
                  {servicio.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-800">
              Observación
            </label>
            <textarea
              rows={3}
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="w-full rounded-lg border p-3 text-sm"
              placeholder="Observación del pedido"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Máquinas asignadas</h2>
              <span className="text-xs text-gray-500">{seleccion.length} seleccionada(s)</span>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, tipo, modelo, serie o servicio..."
              className="mb-3 w-full rounded-lg border p-2 text-sm"
            />

            <div className="max-h-96 space-y-2 overflow-auto">
              {maquinasFiltradas.map((maquina) => {
                const checked = seleccion.includes(maquina.id);

                return (
                  <label
                    key={maquina.id}
                    className={`block cursor-pointer rounded-xl border p-3 ${
                      checked ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {maquina.tipo} - {maquina.id}
                        </div>
                        <div className="text-xs text-gray-600">
                          {maquina.modelo || "Sin modelo"}
                          {maquina.serie ? ` | Serie: ${maquina.serie}` : ""}
                        </div>
                        <div className="text-xs text-gray-500">
                          Servicio: {maquina.servicio?.nombre || "-"}
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMaquina(maquina.id)}
                        className="mt-1 h-4 w-4"
                      />
                    </div>
                  </label>
                );
              })}

              {maquinasFiltradas.length === 0 && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                  No hay máquinas libres o asignadas a este pedido que coincidan con la búsqueda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================
          MÁQUINAS SOLICITADAS
      ============================ */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas solicitadas</h2>

        {(pedido.itemsSolicitados || []).length === 0 ? (
          <p className="text-sm text-gray-500">No hay máquinas solicitadas.</p>
        ) : (
          pedido.itemsSolicitados.map((i, idx) => (
            <div
              key={idx}
              className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm mb-1"
            >
              <span>{i.tipo}</span>
              <span className="font-bold">{i.cantidad}</span>
            </div>
          ))
        )}
      </div>

      {/* ============================
          MÁQUINAS ASIGNADAS
      ============================ */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <h2 className="text-lg font-semibold mb-2">Máquinas asignadas</h2>

        {(pedido.itemsAsignados || []).length === 0 ? (
          <p className="text-sm text-gray-500">No hay máquinas asignadas.</p>
        ) : (
          pedido.itemsAsignados.map((m, idx) => (
            <div key={idx} className="bg-gray-50 px-3 py-2 rounded-lg text-sm mb-1">
              <p className="font-semibold">
                {m.tipo} — {m.id}
              </p>
              <p className="text-xs text-gray-600">{m.modelo}</p>
              {m.serie && (
                <p className="text-xs text-gray-500">Serie: {m.serie}</p>
              )}
            </div>
          ))
        )}
      </div>
      <HistorialPedido historial={pedido.historial} />
    </div>
  );
}
