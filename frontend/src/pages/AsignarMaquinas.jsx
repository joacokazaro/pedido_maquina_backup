import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

const ESTADO_UI = {
  disponible: {
    badge: "Disponible",
    detalle: "Se puede seleccionar para este pedido.",
    card: "border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md",
    badgeClass: "border border-emerald-200 bg-emerald-100 text-emerald-700",
    indicator: "bg-emerald-500",
  },
  asignada: {
    badge: "Prestada",
    detalle: "No se puede seleccionar mientras siga asignada.",
    card: "border-amber-200 bg-amber-50/80",
    badgeClass: "border border-amber-200 bg-amber-100 text-amber-800",
    indicator: "bg-amber-500",
  },
  no_devuelta: {
    badge: "No devuelta",
    detalle: "Figura pendiente de devolucion.",
    card: "border-rose-200 bg-rose-50/80",
    badgeClass: "border border-rose-200 bg-rose-100 text-rose-700",
    indicator: "bg-rose-500",
  },
  fuera_servicio: {
    badge: "Fuera de servicio",
    detalle: "No esta disponible para prestar.",
    card: "border-slate-200 bg-slate-100/80",
    badgeClass: "border border-slate-300 bg-slate-200 text-slate-700",
    indicator: "bg-slate-500",
  },
  reparacion: {
    badge: "En reparacion",
    detalle: "No esta disponible para prestar.",
    card: "border-orange-200 bg-orange-50/80",
    badgeClass: "border border-orange-200 bg-orange-100 text-orange-700",
    indicator: "bg-orange-500",
  },
  baja: {
    badge: "Baja",
    detalle: "No esta disponible para prestar.",
    card: "border-zinc-300 bg-zinc-100/80",
    badgeClass: "border border-zinc-300 bg-zinc-200 text-zinc-700",
    indicator: "bg-zinc-500",
  },
};

function normalizarEstado(estado) {
  return ESTADO_UI[estado] ? estado : "fuera_servicio";
}

function esSeleccionable(maquina) {
  return maquina.estado === "disponible";
}

function descripcionPedidoActivo(maquina) {
  if (!maquina.pedidoActivo?.id) return null;

  const pedidoId = maquina.pedidoActivo.id;
  const supervisor =
    maquina.pedidoActivo.supervisorNombre ||
    maquina.pedidoActivo.supervisor;
  const titular = maquina.pedidoActivo.titular;

  if (maquina.pedidoActivo.destino === "SUPERVISOR" && titular) {
    return `Prestada en ${pedidoId} para ${titular}.`;
  }

  if (supervisor) {
    return `Prestada en ${pedidoId} solicitada por ${supervisor}.`;
  }

  return `Prestada en ${pedidoId}.`;
}

export default function AsignarMaquinas() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [justificacion, setJustificacion] = useState("");
  const [observacion, setObservacion] = useState("");
  const [showJustificacion, setShowJustificacion] = useState(false);
  const [alerta, setAlerta] = useState("");
  const [serviciosUsuario, setServiciosUsuario] = useState([]);
  const [solicitado, setSolicitado] = useState({});
  const { user } = useAuth();

  useEffect(() => {
    fetch(`${API_BASE}/pedidos/${id}`)
      .then((r) => r.json())
      .then((p) => {
        setPedido(p);

        const sol = {};
        (p.itemsSolicitados ?? []).forEach((item) => {
          sol[item.tipo] = item.cantidad;
        });
        setSolicitado(sol);
      });

    fetch(`${API_BASE}/maquinas`)
      .then((r) => r.json())
      .then(setMaquinas);

    fetch(`${API_BASE}/servicios/usuario/${user.username}`)
      .then(async (r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;
        setServiciosUsuario(data.map((servicio) => servicio.id));
      })
      .catch(console.error);
  }, [id, user.username]);

  if (!pedido) return <div className="p-6">Cargando...</div>;

  const tipos = [
    ...new Set(maquinas.map((m) => m.tipo).filter((t) => t && t !== "")),
  ];

  const filtradas = maquinas
    .filter((m) => {
      if (
        ["SUPERVISOR", "DEPOSITO"].includes(pedido.destino) &&
        !serviciosUsuario.includes(m.servicioId)
      ) {
        return false;
      }

      const texto = filtroTexto.toLowerCase();
      const cumpleTexto =
        m.id.toLowerCase().includes(texto) ||
        m.tipo.toLowerCase().includes(texto) ||
        (m.modelo ?? "").toLowerCase().includes(texto);

      const cumpleTipo =
        filtroTipo === "TODOS" || m.tipo === filtroTipo;

      return cumpleTexto && cumpleTipo;
    })
    .sort((a, b) => {
      const aSeleccionable = esSeleccionable(a);
      const bSeleccionable = esSeleccionable(b);

      if (aSeleccionable !== bSeleccionable) {
        return aSeleccionable ? -1 : 1;
      }

      return a.id.localeCompare(b.id, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

  function toggleSeleccion(maquina) {
    if (!esSeleccionable(maquina)) return;

    if (seleccion.some((item) => item.id === maquina.id)) {
      setSeleccion(seleccion.filter((item) => item.id !== maquina.id));
      return;
    }

    setSeleccion([...seleccion, maquina]);
  }

  function requiresJustification() {
    const asignadosPorTipo = {};

    seleccion.forEach((maquina) => {
      asignadosPorTipo[maquina.tipo] =
        (asignadosPorTipo[maquina.tipo] || 0) + 1;
    });

    for (const tipo in solicitado) {
      const cantidadSolicitada = solicitado[tipo];
      const cantidadAsignada = asignadosPorTipo[tipo] || 0;
      if (cantidadSolicitada !== cantidadAsignada) return true;
    }

    return false;
  }

  async function confirmarAsignacion() {
    setAlerta("");

    if (seleccion.length === 0) {
      setAlerta("Debes seleccionar al menos 1 maquina para continuar.");
      return;
    }

    const necesitaJustificacion = requiresJustification();

    if (necesitaJustificacion && justificacion.trim() === "") {
      setShowJustificacion(true);
      return;
    }

    await fetch(`${API_BASE}/pedidos/${id}/asignar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asignadas: seleccion.map((maquina) => maquina.id),
        justificacion: necesitaJustificacion ? justificacion : null,
        observacion:
          observacion && String(observacion).trim().length > 0
            ? observacion
            : null,
        usuario: user.username,
      }),
    });

    navigate(-1);
  }

  function cerrarJustificacion() {
    setShowJustificacion(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-32">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        <span className="text-lg">←</span> Volver
      </button>

      <h1 className="mb-4 text-2xl font-bold">Asignar maquinas</h1>

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-800">
          Pedido solicitado
        </h2>

        {Object.keys(solicitado).length === 0 ? (
          <p className="text-sm text-gray-500">
            Este pedido no tiene items solicitados.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(solicitado).map(([tipo, cantidad]) => {
              const asignadasTipo = seleccion.filter(
                (maquina) => maquina.tipo === tipo
              ).length;

              return (
                <div
                  key={tipo}
                  className="rounded-lg border bg-gray-50 px-3 py-2"
                >
                  <p className="text-xs uppercase tracking-wide text-gray-600">
                    {tipo}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {asignadasTipo} / {cantidad}
                    <span className="text-xs font-normal text-gray-500">
                      {" "}
                      asignadas
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-4 space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Tipo de maquina
        </label>
        <select
          className="w-full rounded-xl border border-gray-300 bg-white p-3"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="TODOS">Todos los tipos</option>
          {tipos.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </div>

      <input
        className="mb-4 w-full rounded-xl border border-gray-300 p-3"
        placeholder="Buscar por codigo, tipo o modelo..."
        value={filtroTexto}
        onChange={(e) => setFiltroTexto(e.target.value)}
      />

      <div className="space-y-3">
        {filtradas.map((maquina) => {
          const selected = seleccion.some((item) => item.id === maquina.id);
          const servicioLabel = maquina.servicio || "Sin servicio";
          const estadoKey = normalizarEstado(maquina.estado);
          const estadoUI = ESTADO_UI[estadoKey];
          const selectable = esSeleccionable(maquina);
          const detallePrestamo = descripcionPedidoActivo(maquina);

          return (
            <div
              key={maquina.id}
              onClick={() => toggleSeleccion(maquina)}
              className={[
                "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition",
                selectable ? "cursor-pointer" : "cursor-not-allowed opacity-95",
                selected
                  ? "border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-200"
                  : estadoUI.card,
              ].join(" ")}
            >
              <div
                className={[
                  "absolute left-0 top-0 h-full w-1.5",
                  selected ? "bg-emerald-500" : estadoUI.indicator,
                ].join(" ")}
              />

              <div className="flex flex-col gap-3 pl-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-800">
                      {maquina.tipo}
                    </p>

                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        selected
                          ? "border border-emerald-200 bg-emerald-100 text-emerald-700"
                          : estadoUI.badgeClass,
                      ].join(" ")}
                    >
                      {selected ? "Seleccionada" : estadoUI.badge}
                    </span>

                    {maquina.pedidoActivo?.id && !selected && (
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Pedido {maquina.pedidoActivo.id}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-lg font-bold text-slate-950">
                    Codigo: {maquina.id}
                  </p>

                  {maquina.modelo && (
                    <p className="mt-1 text-sm text-slate-600">
                      {maquina.modelo}
                    </p>
                  )}

                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.15em] text-slate-500">
                    Servicio
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    {servicioLabel}
                  </p>
                </div>

                <div className="sm:max-w-xs sm:text-right">
                  <p className="text-sm font-medium text-slate-700">
                    {selected
                      ? "Lista para asignar en este pedido."
                      : detallePrestamo || estadoUI.detalle}
                  </p>

                  {!selectable && maquina.pedidoActivo?.id && (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                      Prestada en el pedido {maquina.pedidoActivo.id}
                    </p>
                  )}

                  {!selectable && !maquina.pedidoActivo?.id && (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Estado actual: {estadoUI.badge}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filtradas.length === 0 && (
          <p className="text-sm text-gray-500">
            No hay maquinas que coincidan con el filtro.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Observacion (opcional)
        </label>
        <textarea
          className="w-full rounded-lg border p-3"
          rows={3}
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          placeholder="Agregar una observacion opcional..."
        />
      </div>

      {alerta && (
        <div className="mt-4 rounded-xl bg-red-100 py-2 text-center text-sm text-red-700">
          {alerta}
        </div>
      )}

      <div className="fixed bottom-0 left-0 w-full border-t bg-white/95 p-4 shadow-lg backdrop-blur">
        <p className="mb-2 text-sm text-gray-700">
          Seleccionadas: <b>{seleccion.length}</b>
        </p>

        <button
          className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700"
          onClick={confirmarAsignacion}
        >
          Confirmar asignacion
        </button>
      </div>

      {showJustificacion && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 p-4"
          onClick={cerrarJustificacion}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-lg font-bold">Justificacion requerida</h2>

            <p className="mb-3 text-sm text-gray-600">
              La cantidad asignada no coincide con lo solicitado. Es necesario
              justificar la diferencia.
            </p>

            <textarea
              className="mb-4 w-full rounded-lg border p-2"
              rows="3"
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Escribi la justificacion..."
            />

            <div className="flex gap-2">
              <button
                className="w-1/2 rounded-lg border border-gray-300 py-2 font-semibold text-gray-700"
                onClick={cerrarJustificacion}
              >
                Cancelar
              </button>

              <button
                className="w-1/2 rounded-lg bg-blue-600 py-2 font-semibold text-white"
                onClick={confirmarAsignacion}
              >
                Guardar y continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
