import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";

function sortById(items) {
  return [...items].sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true, sensitivity: "base" }));
}

export default function AdminKitForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isReadOnly = rolUpper === "COORDINADOR" || rolUpper === "CONSULTOR";
  const isEdit = Boolean(id);

  const [catalogo, setCatalogo] = useState({ maquinas: [], vehiculos: [] });
  const [kit, setKit] = useState(null);
  const [nombre, setNombre] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [maquinaIds, setMaquinaIds] = useState([]);
  const [vehiculoIds, setVehiculoIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [machineSearch, setMachineSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [conflictosPendientes, setConflictosPendientes] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [reactivating, setReactivating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const requests = [fetch(`${API_BASE}/admin/kits/catalogo`)];
        if (isEdit) requests.unshift(fetch(`${API_BASE}/admin/kits/${encodeURIComponent(id)}`));

        const responses = await Promise.all(requests);
        if (responses.some((response) => !response.ok)) {
          throw new Error("No se pudo cargar la informacion del kit");
        }

        const payloads = await Promise.all(responses.map((response) => response.json()));
        const detail = isEdit ? payloads[0] : null;
        const catalogoData = isEdit ? payloads[1] : payloads[0];

        setCatalogo(catalogoData || { maquinas: [], vehiculos: [] });

        if (detail) {
          setKit(detail);
          setNombre(detail.nombre || "");
          setObservaciones(detail.observaciones || "");
          setMaquinaIds((detail.maquinas || []).map((item) => item.id));
          setVehiculoIds((detail.vehiculos || []).map((item) => item.id));
        }
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message || "Error cargando kit");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, isEdit]);

  const composicionBloqueada = Boolean(kit?.eventualActivo);

  const maquinas = useMemo(() => {
    const selected = new Set(maquinaIds);
    const query = machineSearch.trim().toLowerCase();

    return sortById(catalogo.maquinas || []).filter((item) => {
      const selectedHere = selected.has(item.id);
      if (query) {
        const matches = [item.id, item.tipo, item.modelo, item.serie, item.kitActual?.nombre]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
        if (!matches) return false;
      }
      if (selectedHere) return true;
      return true;
    });
  }, [catalogo.maquinas, maquinaIds, machineSearch]);

  const vehiculos = useMemo(() => {
    const query = vehicleSearch.trim().toLowerCase();
    return sortById(catalogo.vehiculos || []).filter((item) => {
      if (!query) return true;
      return [item.id, item.vehiculo, item.modelo, item.patente, item.kitActual?.nombre]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [catalogo.vehiculos, vehicleSearch]);

  const maquinasSeleccionadas = useMemo(
    () => sortById((catalogo.maquinas || []).filter((item) => maquinaIds.includes(item.id))),
    [catalogo.maquinas, maquinaIds]
  );

  const vehiculosSeleccionados = useMemo(
    () => sortById((catalogo.vehiculos || []).filter((item) => vehiculoIds.includes(item.id))),
    [catalogo.vehiculos, vehiculoIds]
  );

  function toggle(setter, currentValues, value) {
    setter(currentValues.includes(value) ? currentValues.filter((item) => item !== value) : [...currentValues, value]);
  }

  async function save(confirmarReasignacion = false) {
    if (isReadOnly) return;
    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        isEdit ? `${API_BASE}/admin/kits/${encodeURIComponent(id)}` : `${API_BASE}/admin/kits`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usuario: user?.username,
            nombre,
            observaciones,
            maquinaIds,
            vehiculoIds,
            confirmarReasignacion,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && Array.isArray(data.conflictos) && data.conflictos.length > 0) {
          setConflictosPendientes(data.conflictos);
          return;
        }

        throw new Error(data.error || "No se pudo guardar el kit");
      }

      // show success modal and redirect to kits list on confirm
      setSavedId(data.id);
      setSuccessOpen(true);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || "Error guardando kit");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (isReadOnly) return;
    try {
      const response = await fetch(`${API_BASE}/admin/kits/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "No se pudo dar de baja el kit");
      }
      navigate("/admin/kits");
    } catch (removeError) {
      console.error(removeError);
      setError(removeError.message || "Error dando de baja kit");
    } finally {
      setDeleteOpen(false);
    }
  }

  if (loading) return <div className="p-4">Cargando kit...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
      >
        ← Volver
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? "Editar kit" : "Nuevo kit"}</h1>
          <p className="text-sm text-gray-600">
            Seleccioná maquinas y vehiculos. Cada componente solo puede pertenecer a un kit a la vez.
          </p>
        </div>
        {/* action buttons moved to page end */}
      </div>

      {error ? <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {isReadOnly ? <div className="mb-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">Modo solo lectura.</div> : null}
      {composicionBloqueada ? (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Este kit esta asociado al eventual activo {kit.eventualActivo?.nombre}. La composicion no puede modificarse mientras siga en uso.
        </div>
      ) : null}

      <div className="mb-4 rounded-2xl bg-white p-4 shadow space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
          <input value={nombre} disabled={isReadOnly} onChange={(event) => setNombre(event.target.value)} className="w-full rounded-xl border p-3 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Observaciones</label>
          <textarea
            value={observaciones}
            disabled={isReadOnly}
            onChange={(event) => setObservaciones(event.target.value)}
            rows={4}
            className="w-full rounded-xl border p-3 text-sm"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Descripción de kit</h2>
              <p className="text-sm text-slate-600">Resumen rápido de las máquinas y vehículos asociados actualmente.</p>
            </div>
            <div className="text-xs text-slate-500">
              {maquinasSeleccionadas.length} máquinas · {vehiculosSeleccionados.length} vehículos
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Máquinas asociadas</h3>
              {maquinasSeleccionadas.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay máquinas seleccionadas.</p>
              ) : (
                <div className="space-y-2">
                  {maquinasSeleccionadas.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">{item.tipo} {item.id}</p>
                      <p className="text-xs text-slate-500">{item.modelo} · {item.serie || "Sin serie"}</p>
                      <p className="text-xs text-slate-500">Estado: {item.estado}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white p-3 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Vehículos asociados</h3>
              {vehiculosSeleccionados.length === 0 ? (
                <p className="text-sm text-slate-500">Todavía no hay vehículos seleccionados.</p>
              ) : (
                <div className="space-y-2">
                  {vehiculosSeleccionados.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-semibold text-slate-900">{item.vehiculo} {item.id}</p>
                      <p className="text-xs text-slate-500">{item.modelo} · {item.patente}</p>
                      <p className="text-xs text-slate-500">Estado: {item.estado}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* actions moved to the bottom of the page */}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Maquinas</h2>
            <span className="text-xs text-gray-500">{maquinaIds.length} seleccionadas</span>
          </div>
          <input
            value={machineSearch}
            onChange={(event) => setMachineSearch(event.target.value)}
            placeholder="Buscar maquinas..."
            className="mb-3 w-full rounded-xl border p-2.5 text-sm"
          />
          <div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {maquinas.map((item) => {
              const checked = maquinaIds.includes(item.id);
              const otherKit = item.kitActual && !checked;
              return (
                <label key={item.id} className={`block rounded-xl border p-3 ${checked ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
                  <div className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={composicionBloqueada || isReadOnly}
                      onChange={() => toggle(setMaquinaIds, maquinaIds, item.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{item.tipo} {item.id}</p>
                      <p className="text-xs text-gray-500">{item.modelo} · {item.serie || "Sin serie"}</p>
                      <p className="text-xs text-gray-500">Estado: {item.estado}</p>
                      {item.pedidoActivo ? <p className="text-xs text-amber-700">Prestada en pedido {item.pedidoActivo.id}</p> : null}
                      {otherKit ? <p className="text-xs text-blue-700">Actualmente en kit: {item.kitActual.nombre}</p> : null}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Vehiculos</h2>
            <span className="text-xs text-gray-500">{vehiculoIds.length} seleccionados</span>
          </div>
          <input
            value={vehicleSearch}
            onChange={(event) => setVehicleSearch(event.target.value)}
            placeholder="Buscar vehiculos..."
            className="mb-3 w-full rounded-xl border p-2.5 text-sm"
          />
          <div className="max-h-[28rem] space-y-2 overflow-y-auto">
            {vehiculos.map((item) => {
              const checked = vehiculoIds.includes(item.id);
              const otherKit = item.kitActual && !checked;
              return (
                <label key={item.id} className={`block rounded-xl border p-3 ${checked ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}>
                  <div className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={composicionBloqueada || isReadOnly}
                      onChange={() => toggle(setVehiculoIds, vehiculoIds, item.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{item.vehiculo} {item.id}</p>
                      <p className="text-xs text-gray-500">{item.modelo} · {item.patente}</p>
                      <p className="text-xs text-gray-500">Estado: {item.estado}</p>
                      {otherKit ? <p className="text-xs text-blue-700">Actualmente en kit: {item.kitActual.nombre}</p> : null}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-6 mb-8 flex flex-wrap justify-end gap-2">
        <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700">
          Cancelar
        </button>
        {!isReadOnly && isEdit ? (
          kit && kit.activo === false ? (
            <button
              onClick={async () => {
                try {
                  setReactivating(true);
                  const res = await fetch(`${API_BASE}/admin/kits/${encodeURIComponent(id)}/reactivar`, { method: 'POST' });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data.error || 'No se pudo reactivar el kit');
                  setSavedId(id);
                  setSuccessOpen(true);
                } catch (err) {
                  console.error(err);
                  setError(err.message || 'Error reactivando kit');
                } finally {
                  setReactivating(false);
                }
              }}
              className="rounded-lg border border-green-600 bg-white px-4 py-2 text-sm font-semibold text-green-600"
              disabled={reactivating}
            >
              {reactivating ? 'Reactivando...' : 'Dar de alta'}
            </button>
          ) : (
            <button onClick={() => setDeleteOpen(true)} className="rounded-lg border border-red-600 text-red-600 bg-white px-4 py-2 text-sm font-semibold">
              Eliminar kit
            </button>
          )
        ) : null}
        {!isReadOnly ? (
          <button onClick={() => save(false)} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-blue-300">
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear kit"}
          </button>
        ) : null}
      </div>

      <ConfirmModal
        open={conflictosPendientes.length > 0}
        title="Componentes ya asignados"
        message="Los siguientes componentes ya pertenecen a otro kit. Si continuás, serán movidos al kit actual."
        onCancel={() => setConflictosPendientes([])}
        onConfirm={async () => {
          const conflictos = conflictosPendientes;
          setConflictosPendientes([]);
          if (conflictos.length > 0) {
            await save(true);
          }
        }}
        confirmLabel="Mover componentes"
        cancelLabel="Cancelar"
      >
        <div className="space-y-2">
          {conflictosPendientes.map((item) => (
            <div key={`${item.tipo}-${item.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">{item.nombre}</p>
              <p>Actualmente en: {item.kitOrigen?.nombre || "Otro kit"}</p>
            </div>
          ))}
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={deleteOpen}
        title="Eliminar kit"
        message="La acción hará una baja lógica del kit. No se eliminará físicamente de la base, pero dejará de estar activo."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={remove}
        confirmLabel="Eliminar kit"
        cancelLabel="Cancelar"
        tone="danger"
      />
      <ConfirmModal
        open={successOpen}
        title="Kit guardado"
        message="El kit se guardó con éxito."
        onCancel={() => navigate('/admin/kits')}
        onConfirm={() => navigate('/admin/kits')}
        confirmLabel="Ir a kits"
        hideCancel={true}
      />
    </div>
  );
}
