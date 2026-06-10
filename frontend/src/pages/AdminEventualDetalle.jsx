import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import HistorialEventual from "../components/HistorialEventual";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import { formatDateOnly, formatDateTime } from "../utils/date";

const ACTION_LABELS = {
  EVENTUAL_CREADO: "Eventual creado",
  EVENTUAL_CORREGIDO: "Eventual corregido",
  EVENTUAL_BAJA_LOGICA: "Eventual eliminado",
  SUPERVISOR_OBSERVACION: "Observación del supervisor",
  SUPERVISOR_FINALIZO_EVENTUAL: "Supervisor finalizó eventual",
  ADMIN_OBSERVACION_POSTERIOR: "Observación posterior del admin",
};

function formatActionLabel(action) {
  const normalized = String(action || "").trim();
  return ACTION_LABELS[normalized] || normalized.replaceAll("_", " ");
}

function extractObservationItems(historial = []) {
  if (!Array.isArray(historial)) return [];

  const items = [];

  for (const entry of historial) {
    const detalle = typeof entry.detalle === "string" ? (() => {
      try {
        return JSON.parse(entry.detalle);
      } catch {
        return {};
      }
    })() : (entry.detalle || {});

    const autor = entry.usuario?.nombre || entry.usuario?.username || "-";
    const etapa = formatActionLabel(entry.accion);

    if (entry.accion === "SUPERVISOR_OBSERVACION" && detalle?.observacion) {
      items.push({
        id: `${entry.id}-sup`,
        etapa,
        autor,
        fecha: entry.fecha,
        mensaje: String(detalle.observacion).trim(),
        origen: "supervisor",
        tipo: "posterior",
      });
      continue;
    }

    if (entry.accion === "ADMIN_OBSERVACION_POSTERIOR" && detalle?.observacion) {
      items.push({
        id: `${entry.id}-admin-post`,
        etapa,
        autor,
        fecha: entry.fecha,
        mensaje: String(detalle.observacion).trim(),
        origen: "admin",
        tipo: "posterior",
      });
      continue;
    }

    if (entry.accion === "EVENTUAL_CREADO") {
      const mensaje = String(detalle?.inicial?.observacionesPrevias || detalle?.inicial?.observaciones || "").trim();
      if (mensaje) {
        items.push({
          id: `${entry.id}-creado`,
          etapa,
          autor,
          fecha: entry.fecha,
          mensaje,
          origen: "admin",
          tipo: "previa",
        });
      }
      continue;
    }

    if (entry.accion === "EVENTUAL_CORREGIDO") {
      const anterior = String(detalle?.anterior?.observacionesPrevias || detalle?.anterior?.observaciones || "").trim();
      const actual = String(detalle?.actual?.observacionesPrevias || detalle?.actual?.observaciones || "").trim();
      if (actual && actual !== anterior) {
        items.push({
          id: `${entry.id}-corregido`,
          etapa,
          autor,
          fecha: entry.fecha,
          mensaje: actual,
          origen: "admin",
          tipo: "previa",
        });
      }
    }
  }

  return items.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}

export default function AdminEventualDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [eventual, setEventual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isCoordinador = rolUpper === "COORDINADOR";
  const isConsultor = rolUpper === "CONSULTOR";

  const maquinasUtilizadas = eventual?.componentesUtilizados?.maquinas?.length ? eventual.componentesUtilizados.maquinas : (eventual?.kit?.maquinas || []);
  const vehiculosUtilizados = eventual?.componentesUtilizados?.vehiculos?.length ? eventual.componentesUtilizados.vehiculos : (eventual?.kit?.vehiculos || []);
  const observationItems = extractObservationItems(eventual?.historial || []);
  const observacionesPrevias = observationItems.filter((item) => item.tipo === "previa");
  const observacionesPosteriores = observationItems.filter((item) => item.tipo === "posterior");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/admin/eventuales/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("No se pudo cargar el eventual");
        const data = await res.json();
        setEventual(data);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message || "Error cargando eventual");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  async function remove() {
    try {
      setDeleting(true);
      const res = await fetch(`${API_BASE}/admin/eventuales/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: user?.username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo dar de baja el eventual");
      setDeleteModalOpen(false);
      navigate("/admin/eventuales/historial");
    } catch (removeError) {
      console.error(removeError);
      setError(removeError.message || "Error dando de baja eventual");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="p-4">Cargando eventual...</div>;
  if (error || !eventual) return <div className="p-4 text-red-600">{error || "Eventual no encontrado"}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
      >
        ← Volver
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white p-5 shadow">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{eventual.nombre}</h1>
            {String(eventual.estado).toLowerCase() === "activo" ? (
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">ACTIVO</span>
            ) : String(eventual.estado).toLowerCase() === "finalizado" ? (
              <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700">FINALIZADO</span>
            ) : (
              <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase text-rose-700">{String(eventual.estado).toUpperCase()}</span>
            )}
            {/* activo flag kept for logic; display is controlled by `estado` */}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Supervisor responsable: <b>{eventual.supervisor?.nombre || eventual.supervisor?.username || "-"}</b>
          </p>
          <p className="text-sm text-gray-600">
            Inicio: <b>{formatDateOnly(eventual.fechaInicio)}</b>
            {" · "}
            Fin: <b>{formatDateOnly(eventual.fechaFin)}</b>
          </p>
          {/* Las observaciones se muestran en panel lateral por etapa y autor */}
        </div>

        {/* buttons moved to page end */}
      </div>

      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-[0_10px_30px_-18px_rgba(37,99,235,0.45)] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Sección kit
          </h2>
          {eventual.kit ? (
            <span className={eventual.kit.bloqueadoParaAsignacion ? "rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700" : "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700"}>
              {eventual.kit.estado}
            </span>
          ) : null}
        </div>

        {!eventual.kit ? (
          <p className="text-sm text-gray-500">Este eventual no tiene kit asociado actualmente.</p>
        ) : (
          <>
            <div className="rounded-xl border border-blue-100 bg-white/90 p-4">
              <p className="text-base font-semibold text-gray-900">{eventual.kit.nombre}</p>
              {eventual.kit.observaciones ? (
                <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{eventual.kit.observaciones}</p>
              ) : null}
              {eventual.kit.bloqueos?.length ? (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-semibold">Bloqueos actuales</p>
                  <ul className="mt-2 space-y-1">
                    {eventual.kit.bloqueos.map((item) => (
                      <li key={`${item.categoria}-${item.id}`}>{item.mensaje}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-blue-100 bg-white/90 p-3">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Maquinas utilizadas</h3>
                <div className="space-y-2">
                  {maquinasUtilizadas.map((maquina) => (
                    <div key={maquina.id} className="rounded-xl border p-3">
                      <p className="text-sm font-semibold text-gray-900">{maquina.tipo} {maquina.id}</p>
                      <p className="text-xs text-gray-500">{maquina.modelo} · {maquina.serie || "Sin serie"}</p>
                      <p className="text-xs text-gray-500">Estado: {maquina.estado}</p>
                    </div>
                  ))}
                  {!maquinasUtilizadas.length ? <p className="text-sm text-gray-500">Sin maquinas.</p> : null}
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-white/90 p-3">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Vehiculos utilizados</h3>
                <div className="space-y-2">
                  {vehiculosUtilizados.map((vehiculo) => (
                    <div key={vehiculo.id} className="rounded-xl border p-3">
                      <p className="text-sm font-semibold text-gray-900">{vehiculo.vehiculo} {vehiculo.id}</p>
                      <p className="text-xs text-gray-500">{vehiculo.modelo} · {vehiculo.patente}</p>
                      <p className="text-xs text-gray-500">Estado: {vehiculo.estado}</p>
                    </div>
                  ))}
                  {!vehiculosUtilizados.length ? <p className="text-sm text-gray-500">Sin vehiculos.</p> : null}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-white p-3 shadow-[0_10px_30px_-18px_rgba(217,119,6,0.4)]">
            <HistorialEventual historial={eventual.historial} separateObservations />
        </div>

        <aside className="h-fit rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-4 shadow-[0_10px_30px_-18px_rgba(5,150,105,0.38)] space-y-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Observaciones
          </h2>
          <p className="text-xs text-gray-500">Separadas en observaciones previas y posteriores.</p>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Observaciones previas</p>
              {observacionesPrevias.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No hay observaciones previas.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {observacionesPrevias.map((item) => (
                    <article key={item.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{item.etapa}</p>
                        <span className={item.origen === "supervisor" ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700" : "rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase text-blue-700"}>
                          {item.origen}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.autor} · {formatDateTime(item.fecha)}</p>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{item.mensaje}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Observaciones posteriores</p>
              {observacionesPosteriores.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No hay observaciones posteriores.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {observacionesPosteriores.map((item) => (
                    <article key={item.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{item.etapa}</p>
                        <span className={item.origen === "supervisor" ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700" : "rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase text-blue-700"}>
                          {item.origen}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.autor} · {formatDateTime(item.fecha)}</p>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{item.mensaje}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>

      <div className="mt-6 mb-8 flex flex-wrap justify-end gap-2">
        {isCoordinador ? (
          <button
            type="button"
            onClick={() => navigate(`/admin/eventuales/${eventual.id}/finalizar`)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Finalizar eventual
          </button>
        ) : isConsultor ? null : (
          <>
            <button
              onClick={() => navigate(`/admin/eventuales/${eventual.id}/corregir`)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Corregir eventual
            </button>
            {eventual.activo ? (
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Eliminar eventual
              </button>
            ) : null}
          </>
        )}
      </div>

      <ConfirmModal
        open={deleteModalOpen}
        title="Eliminar eventual"
        message={`Vas a eliminar el eventual ${eventual.nombre}. Esta acción lo dejará inactivo y lo moverá al historial.`}
        onCancel={() => {
          if (!deleting) setDeleteModalOpen(false);
        }}
        onConfirm={remove}
        confirmLabel={deleting ? "Eliminando..." : "Eliminar eventual"}
        cancelLabel="Cancelar"
        tone="danger"
      />
    </div>
  );
}
