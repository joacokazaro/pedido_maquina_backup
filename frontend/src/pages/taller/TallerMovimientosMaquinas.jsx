import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../../services/apiBase";
import { useAuth } from "../../context/AuthContext";
import { buildActorHeaders } from "../../utils/authHeaders";
import ConfirmModal from "../../components/ConfirmModal";

const ESTADOS = ["", "disponible", "asignada", "no_devuelta", "fuera_servicio", "taller", "baja"];

export default function TallerMovimientosMaquinas() {
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const canEdit = rolUpper === "ADMIN" || rolUpper === "TALLER";
  const actorHeaders = useMemo(() => buildActorHeaders(user), [user]);

  const [maquinas, setMaquinas] = useState([]);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const [selected, setSelected] = useState([]);
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [pendingAccion, setPendingAccion] = useState("");
  const [lastResult, setLastResult] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/admin/maquinas`, { headers: actorHeaders });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar maquinas");
      setMaquinas(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error cargando maquinas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user?.username]);

  const filtradas = useMemo(() => {
    let data = [...maquinas];
    if (estado) data = data.filter((item) => item.estado === estado);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((item) =>
        [item.id, item.tipo, item.modelo, item.serie, item.servicio?.nombre]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      );
    }
    return data;
  }, [maquinas, search, estado]);

  function toggleSeleccion(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function ejecutarMovimiento(accion) {
    if (!canEdit) return;
    if (!selected.length) {
      setError("Selecciona al menos una maquina");
      return;
    }

    try {
      setBusy(true);
      setError("");

      const res = await fetch(`${API_BASE}/admin/taller/maquinas/movimientos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...actorHeaders,
        },
        body: JSON.stringify({ ids: selected, accion, observacion }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo aplicar el movimiento");

      setLastResult(data);
      setSelected([]);
      setObservacion("");
      setSuccessOpen(true);
      await load();
    } catch (e) {
      console.error(e);
      setError(e.message || "Error aplicando movimiento");
    } finally {
      setBusy(false);
    }
  }

  function onSolicitarAccion(accion) {
    if (!canEdit) return;
    if (!selected.length) {
      setError("Selecciona al menos una maquina");
      return;
    }
    setPendingAccion(accion);
    setConfirmOpen(true);
  }

  if (loading) return <div className="p-4">Cargando movimientos de maquinas...</div>;

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-8 pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link to="/admin/taller/registrar" className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow">
            ← Registrar
          </Link>
          <Link to="/admin/taller/ver/maquinas" className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
            Ver taller maquinas
          </Link>
        </div>

        <header className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-800">Registrar Ingreso / Egreso - Maquinas</h1>
          <p className="mt-1 text-sm text-gray-600">Confirma cada transaccion antes de registrarla.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-gray-500">Filtradas</p>
              <p className="text-xl font-bold text-slate-800">{filtradas.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-gray-500">Seleccionadas</p>
              <p className="text-xl font-bold text-slate-800">{selected.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-gray-500">Estado actual filtro</p>
              <p className="text-xl font-bold text-slate-800">{estado || "todos"}</p>
            </div>
          </div>
        </header>

        {error ? <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div> : null}
        {!canEdit ? <div className="mb-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">Modo solo lectura.</div> : null}

        <div className="mb-3 grid gap-2 md:grid-cols-2">
          <input
            className="rounded-xl border border-gray-200 bg-white p-2 text-sm"
            placeholder="Buscar maquinas..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="rounded-xl border border-gray-200 bg-white p-2 text-sm" value={estado} onChange={(event) => setEstado(event.target.value)}>
            {ESTADOS.map((item) => (
              <option key={item || "all"} value={item}>{item || "todos"}</option>
            ))}
          </select>
        </div>

        {canEdit ? (
          <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <textarea
              className="w-full rounded-xl border border-gray-200 p-2 text-sm"
              placeholder="Observacion opcional para el lote"
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onSolicitarAccion("ingreso")}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-amber-300"
              >
                Registrar ingreso
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSolicitarAccion("egreso")}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:bg-emerald-300"
              >
                Registrar egreso
              </button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
        {filtradas.map((item) => (
          <label key={item.id} className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-sm">
            {canEdit ? (
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggleSeleccion(item.id)}
                className="mt-1"
              />
            ) : null}
            <span>
              <b>{item.id}</b> · {item.tipo} · {item.modelo || "-"}
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase text-gray-700">{item.estado}</span>
            </span>
          </label>
        ))}
          {!filtradas.length ? <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500">No hay maquinas para el filtro aplicado.</div> : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirmar transaccion"
        message={`Se va a registrar ${pendingAccion || "movimiento"} para ${selected.length} maquina(s).`}
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={async () => {
          setConfirmOpen(false);
          await ejecutarMovimiento(pendingAccion);
        }}
      />

      <ConfirmModal
        open={successOpen}
        title="Transaccion exitosa"
        message={`Movimiento aplicado correctamente. Registros actualizados: ${lastResult?.actualizados?.length || 0}.`}
        confirmLabel="Aceptar"
        hideCancel
        onConfirm={() => setSuccessOpen(false)}
      />
    </div>
  );
}
