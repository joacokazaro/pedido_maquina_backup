import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BotonVolver from "../components/BotonVolver";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import { formatDateOnly, formatDateTime } from "../utils/date";
import { REQUEST_RESOURCE_TYPES, buildMachineTypeOptions } from "../constants/maquinas";
import FondoKazaro from "../components/FondoKazaro";

export default function SupervisorEventualDetalle() {
  const { id } = useParams();
  const { user } = useAuth();

  const [eventual, setEventual] = useState(null);
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Rol: solo supervisor_limpieza puede cargar componentes y disparar pedidos
  const rolesUpper = Array.isArray(user?.roles)
    ? user.roles.map((r) => String(r || "").toUpperCase())
    : [];
  const rolPrimario = String(user?.rol || "").toUpperCase();
  const esSupervisorLimpieza =
    rolesUpper.includes("SUPERVISOR_LIMPIEZA") || rolPrimario === "SUPERVISOR_LIMPIEZA";

  // Recursos del supervisor + selección de componentes
  const [supervisorMaquinas, setSupervisorMaquinas] = useState([]);
  const [supervisorVehiculos, setSupervisorVehiculos] = useState([]);
  const [maquinasSel, setMaquinasSel] = useState([]); // [{id, tipo}]
  const [vehiculosSel, setVehiculosSel] = useState([]); // [id]
  const [savingComp, setSavingComp] = useState(false);
  const [compMsg, setCompMsg] = useState("");

  // Modales (bottom-sheets) de selección
  const [maqModalOpen, setMaqModalOpen] = useState(false);
  const [maqBusqueda, setMaqBusqueda] = useState("");
  const [maqTemp, setMaqTemp] = useState(() => new Set());
  const [vehModalOpen, setVehModalOpen] = useState(false);
  const [vehTemp, setVehTemp] = useState(() => new Set());

  // Pedido para el eventual
  const [pedidoOpen, setPedidoOpen] = useState(false);
  const [cantidades, setCantidades] = useState({});
  const [availableTipos, setAvailableTipos] = useState([]);
  const [otroTipo, setOtroTipo] = useState("");
  const [otroCantidad, setOtroCantidad] = useState(1);
  const [otros, setOtros] = useState([]);
  const [pedidoObs, setPedidoObs] = useState("");
  const [pedidoDestino, setPedidoDestino] = useState("DEPOSITO");
  const [supervisoresDestino, setSupervisoresDestino] = useState([]);
  const [supervisorDestinoUsername, setSupervisorDestinoUsername] = useState("");
  const [creandoPedido, setCreandoPedido] = useState(false);
  const [pedidoMsg, setPedidoMsg] = useState("");
  const [pedidoError, setPedidoError] = useState("");

  const supervisorId = eventual?.supervisor?.id || null;

  async function cargarEventual() {
    const res = await fetch(
      `${API_BASE}/eventuales/${encodeURIComponent(id)}?username=${encodeURIComponent(user.username)}`
    );
    if (!res.ok) throw new Error("No se pudo cargar el eventual");
    return res.json();
  }

  useEffect(() => {
    if (!user?.username) return;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await cargarEventual();
        setEventual(data);

        // Inicializar selección desde los componentes actuales
        const maqs = Array.isArray(data.componentesActuales?.maquinasUtilizadas)
          ? data.componentesActuales.maquinasUtilizadas
          : [];
        const selMaq = [];
        for (const grupo of maqs) {
          const ids = Array.isArray(grupo.maquinaIds) ? grupo.maquinaIds : [];
          for (const mid of ids) selMaq.push({ id: mid, tipo: grupo.tipo });
        }
        setMaquinasSel(selMaq);
        setVehiculosSel(
          Array.isArray(data.componentesActuales?.vehiculoIds) ? data.componentesActuales.vehiculoIds : []
        );
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando eventual");
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.username]);

  // Recursos del supervisor (solo si puede editar)
  useEffect(() => {
    if (!esSupervisorLimpieza || !supervisorId) return;

    let cancelado = false;
    async function loadRecursos() {
      try {
        const [maqRes, vehRes] = await Promise.all([
          fetch(`${API_BASE}/supervisores/${encodeURIComponent(supervisorId)}/maquinas`),
          fetch(`${API_BASE}/supervisores/${encodeURIComponent(supervisorId)}/vehiculos`),
        ]);
        const maqData = maqRes.ok ? await maqRes.json() : null;
        const vehData = vehRes.ok ? await vehRes.json() : null;
        if (cancelado) return;

        const fijas = Array.isArray(maqData?.maquinasFijas) ? maqData.maquinasFijas : [];
        const idsFijas = new Set(fijas.map((m) => m.id));
        const prestadas = (Array.isArray(maqData?.maquinasTemporales) ? maqData.maquinasTemporales : [])
          .filter(
            (m) =>
              m?.pedido?.tipo === "PEDIDO" &&
              m?.pedido?.estado === "ENTREGADO" &&
              !idsFijas.has(m.id)
          )
          .map((m) => ({ ...m, esPrestamo: true }));
        setSupervisorMaquinas([...fijas, ...prestadas]);
        setSupervisorVehiculos(Array.isArray(vehData?.vehiculos) ? vehData.vehiculos : []);
      } catch (e) {
        console.error(e);
      }
    }
    loadRecursos();
    return () => {
      cancelado = true;
    };
  }, [esSupervisorLimpieza, supervisorId]);

  // Tipos para "Otro" y supervisores destino (para pedidos)
  useEffect(() => {
    if (!esSupervisorLimpieza) return;

    fetch(`${API_BASE}/admin/maquinas/tipos`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableTipos(data.map((t) => t.nombre).filter(Boolean));
        } else {
          setAvailableTipos(buildMachineTypeOptions([]));
        }
      })
      .catch(() => setAvailableTipos(buildMachineTypeOptions([])));

    fetch(`${API_BASE}/supervisores`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const arr = Array.isArray(data) ? data : data.supervisores || [];
        setSupervisoresDestino(arr.filter((s) => String(s.username) !== String(user?.username)));
      })
      .catch(() => setSupervisoresDestino([]));
  }, [esSupervisorLimpieza, user?.username]);

  async function saveObservation() {
    try {
      setSaving(true);
      setError("");
      const res = await fetch(`${API_BASE}/eventuales/${encodeURIComponent(id)}/observaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: user?.username, observacion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo registrar la observacion");
      setObservacion("");
      setEventual(data);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error guardando observacion");
    } finally {
      setSaving(false);
    }
  }

  /* ===== Componentes ===== */
  const maquinasResumen = useMemo(() => {
    const grupos = new Map();
    for (const m of maquinasSel) {
      const key = m.tipo || "Sin tipo";
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(m.id);
    }
    return Array.from(grupos.entries())
      .map(([tipo, ids]) => ({ tipo, cantidad: ids.length, maquinaIds: ids }))
      .sort((a, b) => a.tipo.localeCompare(b.tipo));
  }, [maquinasSel]);

  const maqGrupos = useMemo(() => {
    const term = maqBusqueda.trim().toLowerCase();
    const filtradas = supervisorMaquinas.filter((m) => {
      if (!term) return true;
      return [m.id, m.tipo, m.modelo, m.serie, m.servicio?.nombre].some((v) =>
        String(v || "").toLowerCase().includes(term)
      );
    });
    const grupos = new Map();
    for (const m of filtradas) {
      const key = m.tipo || "Sin tipo";
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(m);
    }
    return Array.from(grupos.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [supervisorMaquinas, maqBusqueda]);

  function vehiculoLabel(vid) {
    const v =
      supervisorVehiculos.find((x) => String(x.id) === String(vid)) ||
      (eventual?.componentesActuales?.vehiculos || []).find((x) => String(x.id) === String(vid));
    if (!v) return String(vid);
    return `${v.vehiculo || "Vehículo"} ${v.id}${v.patente ? ` · ${v.patente}` : ""}`;
  }

  function abrirSelectorMaquinas() {
    setMaqTemp(new Set(maquinasSel.map((m) => m.id)));
    setMaqBusqueda("");
    setMaqModalOpen(true);
  }

  function toggleMaquina(mid) {
    setMaqTemp((prev) => {
      const next = new Set(prev);
      if (next.has(mid)) next.delete(mid);
      else next.add(mid);
      return next;
    });
  }

  function toggleGrupoMaquinas(grupo) {
    setMaqTemp((prev) => {
      const next = new Set(prev);
      const todas = grupo.every((m) => next.has(m.id));
      grupo.forEach((m) => (todas ? next.delete(m.id) : next.add(m.id)));
      return next;
    });
  }

  function confirmarMaquinas() {
    setMaquinasSel(
      supervisorMaquinas
        .filter((m) => maqTemp.has(m.id))
        .map((m) => ({ id: m.id, tipo: m.tipo }))
    );
    setMaqModalOpen(false);
  }

  function abrirSelectorVehiculos() {
    setVehTemp(new Set(vehiculosSel.map((v) => String(v))));
    setVehModalOpen(true);
  }

  function toggleVehiculo(vid) {
    setVehTemp((prev) => {
      const next = new Set(prev);
      const key = String(vid);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function confirmarVehiculos() {
    setVehiculosSel(Array.from(vehTemp));
    setVehModalOpen(false);
  }

  async function guardarComponentes() {
    try {
      setSavingComp(true);
      setCompMsg("");
      setError("");
      const res = await fetch(`${API_BASE}/eventuales/${encodeURIComponent(id)}/componentes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: user?.username,
          maquinasUtilizadas: maquinasResumen.map((g) => ({
            tipo: g.tipo,
            cantidad: g.cantidad,
            maquinaIds: g.maquinaIds,
          })),
          vehiculoIds: vehiculosSel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudieron guardar los componentes");
      setEventual(data);
      setCompMsg("Componentes guardados correctamente.");
    } catch (e) {
      console.error(e);
      setError(e.message || "Error guardando componentes");
    } finally {
      setSavingComp(false);
    }
  }

  /* ===== Pedido ===== */
  function abrirPedido() {
    setCantidades(REQUEST_RESOURCE_TYPES.reduce((acc, t) => ({ ...acc, [t]: 0 }), {}));
    setOtros([]);
    setOtroTipo("");
    setOtroCantidad(1);
    setPedidoObs("");
    setPedidoDestino("DEPOSITO");
    setSupervisorDestinoUsername("");
    setPedidoError("");
    setPedidoOpen(true);
  }

  function cambiarCantidad(tipo, delta) {
    setCantidades((prev) => ({ ...prev, [tipo]: Math.max(0, (prev[tipo] || 0) + delta) }));
  }

  function agregarOtro() {
    if (!otroTipo) {
      setPedidoError('Seleccioná un tipo para "Otro".');
      return;
    }
    setPedidoError("");
    setOtros((prev) => {
      const existe = prev.find((o) => o.tipo === otroTipo);
      if (existe) {
        return prev.map((o) =>
          o.tipo === otroTipo ? { ...o, cantidad: Number(o.cantidad) + Number(otroCantidad || 1) } : o
        );
      }
      return [...prev, { tipo: otroTipo, cantidad: Number(otroCantidad || 1) }];
    });
    setOtroTipo("");
    setOtroCantidad(1);
  }

  async function crearPedido() {
    const items = Object.entries(cantidades)
      .filter(([, c]) => c > 0)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }));
    otros.forEach((o) => {
      if (o.tipo && Number(o.cantidad) > 0) items.push({ tipo: o.tipo, cantidad: Number(o.cantidad) });
    });

    if (items.length === 0) {
      setPedidoError("Seleccioná al menos 1 máquina para pedir.");
      return;
    }
    if (pedidoDestino === "SUPERVISOR" && !supervisorDestinoUsername) {
      setPedidoError("Seleccioná el supervisor destino.");
      return;
    }

    try {
      setCreandoPedido(true);
      setPedidoError("");
      const res = await fetch(`${API_BASE}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supervisorUsername: user?.username,
          itemsSolicitados: items,
          eventualId: Number(id),
          observacion: pedidoObs.trim() || null,
          destino: pedidoDestino,
          supervisorDestinoUsername: pedidoDestino === "SUPERVISOR" ? supervisorDestinoUsername : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error creando el pedido");

      setPedidoOpen(false);
      setPedidoMsg(`Pedido ${data.pedido?.id || ""} creado.`);
      const actualizado = await cargarEventual();
      setEventual(actualizado);
    } catch (e) {
      console.error(e);
      setPedidoError(e.message || "Error creando el pedido");
    } finally {
      setCreandoPedido(false);
    }
  }

  if (loading) return <div className="p-4">Cargando eventual...</div>;
  if (error && !eventual) return <div className="p-4 text-red-600">{error}</div>;
  if (!eventual) return <div className="p-4 text-red-600">Eventual no encontrado</div>;

  const maquinasLectura = Array.isArray(eventual.componentesActuales?.maquinasUtilizadas)
    ? eventual.componentesActuales.maquinasUtilizadas
    : [];
  const maquinasDePedidos = Array.isArray(eventual.maquinasDePedidos) ? eventual.maquinasDePedidos : [];
  const pedidosComplementarios = Array.isArray(eventual.pedidosComplementarios)
    ? eventual.pedidosComplementarios
    : [];
  const isActivo = String(eventual.estado || "").toLowerCase() === "activo";
  const puedeEditar = esSupervisorLimpieza && isActivo;

  const observacionesPosteriores = (Array.isArray(eventual.historial) ? eventual.historial : [])
    .filter((entry) =>
      ["SUPERVISOR_OBSERVACION", "ADMIN_OBSERVACION_POSTERIOR", "COORDINADOR_OBSERVACION_POSTERIOR"].includes(
        entry?.accion
      )
    )
    .map((entry) => ({
      id: `${entry.id}-${entry.accion}`,
      autor: entry.usuario?.nombre || entry.usuario?.username || "-",
      fecha: entry.fecha,
      mensaje: String(entry?.detalle?.observacion || "").trim(),
    }))
    .filter((entry) => entry.mensaje)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  return (
    <div className="min-h-screen p-4 pb-24 space-y-4 max-w-2xl mx-auto">
      <FondoKazaro />
      <BotonVolver className="" />

      {error ? (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {pedidoMsg ? (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pedidoMsg}</div>
      ) : null}

      {/* HEADER */}
      <div className="rounded-2xl bg-white p-5 shadow space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{eventual.nombre}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700">
            {eventual.estado}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          Supervisor: <b>{eventual.supervisor?.nombre || eventual.supervisor?.username || "-"}</b>
        </p>
        <p className="text-sm text-gray-600">
          Inicio: <b>{formatDateOnly(eventual.fechaInicio)}</b> · Fin: <b>{formatDateOnly(eventual.fechaFin)}</b>
        </p>
      </div>

      {/* MÁQUINAS */}
      <div className="rounded-2xl bg-white p-5 shadow space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Máquinas utilizadas</h2>
          {puedeEditar ? (
            <button
              onClick={abrirSelectorMaquinas}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Cargar
            </button>
          ) : null}
        </div>

        {(puedeEditar ? maquinasResumen : maquinasLectura).length === 0 ? (
          <p className="text-sm text-gray-500">Sin máquinas cargadas.</p>
        ) : (
          <div className="space-y-2">
            {(puedeEditar ? maquinasResumen : maquinasLectura).map((item, idx) => (
              <div key={`${item.tipo}-${idx}`} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">{item.tipo}</p>
                  <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">
                    {item.cantidad}
                  </span>
                </div>
                {Array.isArray(item.maquinaIds) && item.maquinaIds.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.maquinaIds.map((mid) => (
                      <span
                        key={mid}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
                      >
                        {mid}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {maquinasDePedidos.length > 0 ? (
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              De pedidos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {maquinasDePedidos.map((g) => (
                <span
                  key={g.tipo}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm"
                >
                  {g.tipo}: {g.cantidad}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* VEHÍCULOS */}
      <div className="rounded-2xl bg-white p-5 shadow space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Vehículos utilizados</h2>
          {puedeEditar ? (
            <button
              onClick={abrirSelectorVehiculos}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Cargar
            </button>
          ) : null}
        </div>

        {(puedeEditar ? vehiculosSel : eventual.componentesActuales?.vehiculoIds || []).length === 0 ? (
          <p className="text-sm text-gray-500">Sin vehículos cargados.</p>
        ) : (
          <div className="space-y-2">
            {(puedeEditar
              ? vehiculosSel
              : eventual.componentesActuales?.vehiculoIds || []
            ).map((vid) => (
              <div key={vid} className="rounded-lg border p-3 text-sm font-medium text-gray-800">
                {vehiculoLabel(vid)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GUARDAR COMPONENTES */}
      {puedeEditar ? (
        <div className="space-y-2">
          {compMsg ? (
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{compMsg}</div>
          ) : null}
          <button
            onClick={guardarComponentes}
            disabled={savingComp}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow disabled:bg-emerald-300"
          >
            {savingComp ? "Guardando..." : "Guardar componentes"}
          </button>
        </div>
      ) : null}

      {/* PEDIDO */}
      {puedeEditar ? (
        <div className="rounded-2xl bg-white p-5 shadow space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Pedido para el eventual</h2>
            <button
              onClick={abrirPedido}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            >
              Crear pedido
            </button>
          </div>

          {pedidosComplementarios.length === 0 ? (
            <p className="text-sm text-gray-500">No hay pedidos disparados para este eventual.</p>
          ) : (
            <div className="space-y-2">
              {pedidosComplementarios.map((p) => (
                <div key={p.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900">{p.id}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">
                      {p.estado}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Destino: {p.destino === "SUPERVISOR" ? "Supervisor" : "Depósito"}
                    {Array.isArray(p.maquinas) && p.maquinas.length > 0
                      ? ` · ${p.maquinas.length} máquina(s)`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {eventual.legacyComponentes ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Datos legados de componentes (solo lectura)</p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-slate-700">
            {JSON.stringify(eventual.legacyComponentes, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* OBSERVACIONES */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Observaciones posteriores</h2>

        {observacionesPosteriores.length === 0 ? (
          <p className="text-sm text-gray-500">No hay observaciones registradas.</p>
        ) : (
          <div className="space-y-2">
            {observacionesPosteriores.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs text-slate-500">
                  {item.autor} · {formatDateTime(item.fecha)}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{item.mensaje}</p>
              </article>
            ))}
          </div>
        )}

        {isActivo ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
            <p className="text-sm font-semibold text-slate-800">Agregar observación</p>
            <textarea
              rows={4}
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
              className="w-full rounded-xl border p-3 text-sm"
              placeholder="Escribe una observación para el historial..."
            />
            <div className="flex justify-end">
              <button
                onClick={saveObservation}
                disabled={saving || !observacion.trim()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300"
              >
                {saving ? "Guardando..." : "Guardar observación"}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Solo podés agregar observaciones cuando el eventual está activo.
          </div>
        )}
      </div>

      {/* ===== BOTTOM-SHEET: MÁQUINAS ===== */}
      {maqModalOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
          <div className="mt-auto flex max-h-[92vh] flex-col rounded-t-2xl bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-base font-bold text-gray-900">Seleccionar máquinas</h3>
              <button onClick={() => setMaqModalOpen(false)} className="text-2xl leading-none text-gray-500">
                ×
              </button>
            </div>
            <div className="border-b p-3">
              <input
                value={maqBusqueda}
                onChange={(e) => setMaqBusqueda(e.target.value)}
                placeholder="Buscar por tipo, id, modelo, servicio…"
                className="w-full rounded-xl border p-3 text-sm"
              />
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {maqGrupos.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">No tenés máquinas asignadas.</p>
              ) : (
                maqGrupos.map(([tipo, grupo]) => {
                  const todas = grupo.every((m) => maqTemp.has(m.id));
                  return (
                    <div key={tipo} className="rounded-xl border">
                      <button
                        onClick={() => toggleGrupoMaquinas(grupo)}
                        className="flex w-full items-center justify-between gap-2 rounded-t-xl bg-slate-50 px-3 py-2 text-left"
                      >
                        <span className="text-sm font-semibold text-gray-800">{tipo}</span>
                        <span className="text-xs font-semibold text-blue-700">
                          {todas ? "Quitar todas" : "Elegir todas"}
                        </span>
                      </button>
                      <div className="divide-y">
                        {grupo.map((m) => {
                          const sel = maqTemp.has(m.id);
                          return (
                            <button
                              key={m.id}
                              onClick={() => toggleMaquina(m.id)}
                              className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left ${
                                sel ? "bg-blue-50" : m.esPrestamo ? "bg-amber-50" : "bg-white"
                              }`}
                            >
                              <div>
                                <p className="flex items-center gap-2 text-sm font-medium text-gray-800">
                                  <span>{m.id}</span>
                                  {m.esPrestamo ? (
                                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                                      Préstamo
                                    </span>
                                  ) : null}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {m.modelo || "-"} {m.servicio?.nombre ? `· ${m.servicio.nombre}` : ""}
                                </p>
                              </div>
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-md border text-xs ${
                                  sel ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t p-3">
              <button
                onClick={confirmarMaquinas}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white"
              >
                Confirmar selección ({maqTemp.size})
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== BOTTOM-SHEET: VEHÍCULOS ===== */}
      {vehModalOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
          <div className="mt-auto flex max-h-[92vh] flex-col rounded-t-2xl bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-base font-bold text-gray-900">Seleccionar vehículos</h3>
              <button onClick={() => setVehModalOpen(false)} className="text-2xl leading-none text-gray-500">
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {supervisorVehiculos.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">No tenés vehículos asignados.</p>
              ) : (
                supervisorVehiculos.map((v) => {
                  const sel = vehTemp.has(String(v.id));
                  return (
                    <button
                      key={v.id}
                      onClick={() => toggleVehiculo(v.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left ${
                        sel ? "bg-blue-50" : "bg-white"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {v.vehiculo} {v.id}
                        </p>
                        <p className="text-xs text-gray-500">
                          {v.modelo || "-"} {v.patente ? `· ${v.patente}` : "· sin patente"}
                        </p>
                      </div>
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-md border text-xs ${
                          sel ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t p-3">
              <button
                onClick={confirmarVehiculos}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white"
              >
                Confirmar selección ({vehTemp.size})
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== BOTTOM-SHEET: PEDIDO ===== */}
      {pedidoOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
          <div className="mt-auto flex max-h-[92vh] flex-col rounded-t-2xl bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="text-base font-bold text-gray-900">Nuevo pedido</h3>
              <button onClick={() => setPedidoOpen(false)} className="text-2xl leading-none text-gray-500">
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Destino */}
              <div>
                <p className="mb-2 text-sm font-medium">¿A quién le hacés el pedido?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setPedidoDestino("DEPOSITO");
                      setSupervisorDestinoUsername("");
                    }}
                    className={`rounded-xl border p-3 text-sm font-semibold ${
                      pedidoDestino === "DEPOSITO"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    Depósito
                  </button>
                  <button
                    onClick={() => setPedidoDestino("SUPERVISOR")}
                    className={`rounded-xl border p-3 text-sm font-semibold ${
                      pedidoDestino === "SUPERVISOR"
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    Supervisor
                  </button>
                </div>
                {pedidoDestino === "SUPERVISOR" ? (
                  <select
                    value={supervisorDestinoUsername}
                    onChange={(e) => setSupervisorDestinoUsername(e.target.value)}
                    className="mt-2 w-full rounded-xl border p-3 text-sm"
                  >
                    <option value="">Elegí el supervisor destino…</option>
                    {supervisoresDestino.map((s) => (
                      <option key={s.username} value={s.username}>
                        {s.nombre ? `${s.nombre} (${s.username})` : s.username}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              {/* Cantidades */}
              <div className="space-y-2">
                {REQUEST_RESOURCE_TYPES.map((tipo) => (
                  <div
                    key={tipo}
                    className="flex items-center justify-between rounded-xl border px-3 py-2"
                  >
                    <span className="text-sm font-semibold">{tipo}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => cambiarCantidad(tipo, -1)}
                        className="h-9 w-9 rounded-full border border-gray-300 text-lg"
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{cantidades[tipo] || 0}</span>
                      <button
                        onClick={() => cambiarCantidad(tipo, 1)}
                        className="h-9 w-9 rounded-full bg-blue-600 text-lg text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Otro */}
              <div className="rounded-xl border p-3 space-y-2">
                <p className="text-sm font-semibold">Otro</p>
                <div className="flex items-center gap-2">
                  <select
                    value={otroTipo}
                    onChange={(e) => setOtroTipo(e.target.value)}
                    className="flex-1 rounded-xl border p-2 text-sm"
                  >
                    <option value="">Seleccioná un tipo</option>
                    {availableTipos.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setOtroCantidad((c) => Math.max(1, (c || 1) - 1))}
                    className="h-9 w-9 rounded-full border border-gray-300 text-lg"
                  >
                    −
                  </button>
                  <span className="w-6 text-center">{otroCantidad}</span>
                  <button
                    onClick={() => setOtroCantidad((c) => (c || 1) + 1)}
                    className="h-9 w-9 rounded-full bg-blue-600 text-lg text-white"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={agregarOtro}
                  className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white"
                >
                  Agregar
                </button>
                {otros.length > 0 ? (
                  <div className="space-y-1">
                    {otros.map((o, idx) => (
                      <div
                        key={`${o.tipo}-${idx}`}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">
                          {o.tipo} × {o.cantidad}
                        </span>
                        <button
                          onClick={() => setOtros((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Observación */}
              <div>
                <label className="mb-1 block text-sm font-medium">Observaciones</label>
                <textarea
                  rows={3}
                  value={pedidoObs}
                  onChange={(e) => setPedidoObs(e.target.value)}
                  placeholder="Fechas, motivos, etc."
                  className="w-full rounded-xl border p-3 text-sm"
                />
              </div>

              {pedidoError ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{pedidoError}</div>
              ) : null}
            </div>

            <div className="border-t p-3">
              <button
                onClick={crearPedido}
                disabled={creandoPedido}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:bg-emerald-300"
              >
                {creandoPedido ? "Creando..." : "Crear pedido"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
