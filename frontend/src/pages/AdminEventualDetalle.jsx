import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import { formatDateOnly, formatDateTime } from "../utils/date";

export default function AdminEventualDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const rolUpper = String(user?.rol || "").toUpperCase();
  const isConsultor = rolUpper === "CONSULTOR";

  const [eventual, setEventual] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/admin/eventuales/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error("No se pudo cargar el eventual");
        const data = await res.json();
        setEventual(data);
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando eventual");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  async function removeEventual() {
    try {
      setDeleting(true);
      const res = await fetch(`${API_BASE}/admin/eventuales/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: user?.username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo eliminar");
      setDeleteModalOpen(false);
      navigate("/admin/eventuales/historial");
    } catch (e) {
      console.error(e);
      setError(e.message || "Error eliminando eventual");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownloadResumenPdf() {
    try {
      setPdfLoading(true);
      setPdfError("");
      const { downloadEventualResumenPdf } = await import("../utils/eventualPdf");
      downloadEventualResumenPdf(eventual);
    } catch (downloadError) {
      console.error(downloadError);
      setPdfError(downloadError.message || "No se pudo generar el PDF");
    } finally {
      setPdfLoading(false);
    }
  }

  if (loading) return <div className="p-4">Cargando eventual...</div>;
  if (error || !eventual) return <div className="p-4 text-red-600">{error || "Eventual no encontrado"}</div>;

  const maquinas = Array.isArray(eventual.componentesActuales?.maquinasUtilizadas) ? eventual.componentesActuales.maquinasUtilizadas : [];
  const vehiculos = Array.isArray(eventual.componentesActuales?.vehiculos) ? eventual.componentesActuales.vehiculos : [];
  const trabajosRealizados = Array.isArray(eventual.trabajosRealizados) ? eventual.trabajosRealizados : [];
  const serviciosExtras = Array.isArray(eventual.serviciosExtrasSubcontratados) ? eventual.serviciosExtrasSubcontratados : [];
  const isFinalizado = String(eventual.estado || "").toLowerCase() === "finalizado";
  const maquinasDePedidos = Array.isArray(eventual.maquinasDePedidos) ? eventual.maquinasDePedidos : [];
  const pedidosComplementarios = Array.isArray(eventual.pedidosComplementarios) ? eventual.pedidosComplementarios : [];
  const pedidosAbiertos = pedidosComplementarios.filter(
    (pedido) => !["CERRADO", "CANCELADO"].includes(pedido.estado)
  );
  const puedeImprimir = isFinalizado && pedidosAbiertos.length === 0;
  const motivoNoImprimir = !isFinalizado
    ? "Solo podés descargar PDF cuando el eventual está finalizado."
    : pedidosAbiertos.length > 0
      ? `Hay ${pedidosAbiertos.length} pedido${pedidosAbiertos.length === 1 ? "" : "s"} complementario${pedidosAbiertos.length === 1 ? "" : "s"} sin cerrar (${pedidosAbiertos.map((p) => p.id).join(", ")}).`
      : "";
  const historial = Array.isArray(eventual.historial) ? eventual.historial : [];
  const observacionesPrevias = historial
    .flatMap((entry) => {
      if (entry?.accion === "EVENTUAL_CREADO") {
        const mensaje = String(entry?.detalle?.inicial?.observacionesPrevias || entry?.detalle?.inicial?.observaciones || "").trim();
        if (!mensaje) return [];
        return [{
          id: `${entry.id}-creado`,
          autor: entry.usuario?.nombre || entry.usuario?.username || "-",
          fecha: entry.fecha,
          mensaje,
        }];
      }

      if (entry?.accion === "EVENTUAL_CORREGIDO") {
        const anterior = String(entry?.detalle?.anterior?.observacionesPrevias || entry?.detalle?.anterior?.observaciones || "").trim();
        const actual = String(entry?.detalle?.actual?.observacionesPrevias || entry?.detalle?.actual?.observaciones || "").trim();
        if (!actual || actual === anterior) return [];
        return [{
          id: `${entry.id}-corregido`,
          autor: entry.usuario?.nombre || entry.usuario?.username || "-",
          fecha: entry.fecha,
          mensaje: actual,
        }];
      }

      return [];
    })
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const observacionesPosteriores = historial
    .filter((entry) => ["SUPERVISOR_OBSERVACION", "ADMIN_OBSERVACION_POSTERIOR", "COORDINADOR_OBSERVACION_POSTERIOR"].includes(entry?.accion))
    .map((entry) => ({
      id: `${entry.id}-${entry.accion}`,
      autor: entry.usuario?.nombre || entry.usuario?.username || "-",
      fecha: entry.fecha,
      mensaje: String(entry?.detalle?.observacion || "").trim(),
    }))
    .filter((entry) => entry.mensaje)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
      <button onClick={() => navigate(-1)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm">
        ← Volver
      </button>

      <div className="rounded-2xl bg-white p-5 shadow space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{eventual.nombre}</h1>
        </div>
        <p className="text-sm text-gray-600">Supervisor: <b>{eventual.supervisor?.nombre || eventual.supervisor?.username || "Sin asignar"}</b></p>
        <p className="text-sm text-gray-600">Inicio: <b>{formatDateOnly(eventual.fechaInicio)}</b> · Fin: <b>{formatDateOnly(eventual.fechaFin)}</b></p>
        <p className="text-sm text-gray-600">
          Fecha de última modificación:{" "}
          <b>
            {eventual.ultimaModificacion
              ? new Date(eventual.ultimaModificacion).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
              : "-"}
          </b>
        </p>
      </div>

      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Componentes utilizados</h2>

        {pedidosComplementarios.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Pedidos complementarios del eventual</p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {pedidosComplementarios.map((pedido) => (
                <div key={pedido.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
                  <span className="font-semibold text-slate-800">{pedido.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      pedido.estado === "CERRADO"
                        ? "bg-slate-200 text-slate-700"
                        : pedido.estado === "CANCELADO"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {String(pedido.estado).replaceAll("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Maquinas por tipo</p>
            {maquinasDePedidos.length > 0 ? (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Vía pedidos complementarios</p>
                <div className="mt-2 space-y-2">
                  {maquinasDePedidos.map((grupo) => (
                    <div key={`ped-${grupo.tipo}`} className="rounded-lg border border-emerald-200 bg-white p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900">{grupo.tipo}</p>
                        <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">{grupo.cantidad}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {grupo.maquinaIds.map((maquinaId) => (
                          <span key={maquinaId} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {maquinaId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {maquinas.length === 0 && maquinasDePedidos.length === 0 ? (
              <p className="text-sm text-gray-500">Sin maquinas cargadas.</p>
            ) : maquinas.length === 0 ? null : (
              <div className="space-y-2">
                {maquinas.map((item, idx) => (
                  <div key={`${item.tipo}-${idx}`} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">{item.tipo}</p>
                      <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">{item.cantidad}</span>
                    </div>
                    {Array.isArray(item.maquinaIds) && item.maquinaIds.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.maquinaIds.map((maquinaId) => (
                          <span key={maquinaId} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {maquinaId}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Vehiculos</p>
            {vehiculos.length === 0 ? (
              <p className="text-sm text-gray-500">Sin vehiculos cargados.</p>
            ) : (
              <div className="space-y-2">
                {vehiculos.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-semibold text-gray-900">{item.vehiculo} {item.id}</p>
                    <p className="text-xs text-gray-500">{item.modelo} · {item.patente || "sin patente"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Trabajos realizados y servicios extras</h2>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Trabajos realizados</p>
            {trabajosRealizados.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin trabajos cargados.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Trabajo</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Cantidad</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Unidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {trabajosRealizados.map((item, idx) => (
                      <tr key={`trabajo-${idx}`}>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.label || item.tipo}</td>
                        <td className="px-3 py-2 text-right text-gray-900">{item.cantidad}</td>
                        <td className="px-3 py-2 text-gray-600">{item.unidadLabel || item.unidadMedida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Servicios extras subcontratados</p>
            {serviciosExtras.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin servicios extras cargados.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Servicio</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Cantidad</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Unidad</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Precio ($ARS)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {serviciosExtras.map((item, idx) => (
                      <tr key={`servicio-${idx}`}>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.descripcion}</td>
                        <td className="px-3 py-2 text-right text-gray-900">{item.cantidad}</td>
                        <td className="px-3 py-2 text-gray-600">{item.unidadLabel || item.unidadMedida}</td>
                        <td className="px-3 py-2 text-right text-gray-900">
                          {item.precio !== null && item.precio !== undefined && item.precio !== ""
                            ? `$ ${Number(item.precio).toLocaleString("es-AR")}`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Observaciones</h2>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Observaciones previas</p>
            {observacionesPrevias.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No hay observaciones previas registradas.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {observacionesPrevias.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{item.autor} · {formatDateTime(item.fecha)}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{item.mensaje}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Observaciones posteriores</p>
            {observacionesPosteriores.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No hay observaciones posteriores registradas.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {observacionesPosteriores.map((item) => (
                  <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{item.autor} · {formatDateTime(item.fecha)}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{item.mensaje}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {eventual.legacyComponentes ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Datos legados de componentes (solo lectura)</p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">
            {JSON.stringify(eventual.legacyComponentes, null, 2)}
          </pre>
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <div className="relative group">
          <button
            type="button"
            onClick={handleDownloadResumenPdf}
            disabled={pdfLoading || !puedeImprimir}
            title={motivoNoImprimir}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pdfLoading ? "Generando PDF..." : "Descargar PDF resumen"}
          </button>
          {!puedeImprimir ? (
            <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
              {motivoNoImprimir}
            </div>
          ) : null}
        </div>
        {!isConsultor ? (
          <button onClick={() => navigate(`/admin/eventuales/${eventual.id}/completar`)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
            Completar datos de eventual
          </button>
        ) : null}
        {!isConsultor && eventual.activo ? (
          <button onClick={() => setDeleteModalOpen(true)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">
            Eliminar eventual
          </button>
        ) : null}
      </div>

      {pdfError ? <p className="-mt-2 text-sm text-red-600">{pdfError}</p> : null}

      <ConfirmModal
        open={deleteModalOpen}
        title="Eliminar eventual"
        message={`Vas a eliminar el eventual ${eventual.nombre}. Esta acción lo dejará inactivo y lo moverá al historial.`}
        onCancel={() => {
          if (!deleting) setDeleteModalOpen(false);
        }}
        onConfirm={removeEventual}
        confirmLabel={deleting ? "Eliminando..." : "Eliminar eventual"}
        cancelLabel="Cancelar"
        tone="danger"
      />
    </div>
  );
}
