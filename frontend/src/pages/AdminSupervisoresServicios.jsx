import { useEffect, useMemo, useState } from "react";
import BotonVolver from "../components/BotonVolver";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../hooks/usePaginacion";

/* helpers */
function initiales(nombre) {
  if (!nombre) return "?";
  const partes = nombre.trim().split(/\s+/);
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

const PALETTE = [
  "bg-kazaro-blue text-white",
  "bg-kazaro-cyan text-white",
  "bg-kazaro-deep text-white",
  "bg-violet-500 text-white",
  "bg-rose-500 text-white",
  "bg-amber-500 text-white",
  "bg-teal-500 text-white",
];
function avatarColor(id) { return PALETTE[id % PALETTE.length]; }

const FILTROS_SERV = [
  { value: "TODOS", label: "Todos" },
  { value: "ASIGNADOS", label: "Asignados" },
  { value: "NO_ASIGNADOS", label: "No asignados" },
];

export default function AdminSupervisoresServicios() {

  const { user } = useAuth();
  const isReadOnly = String(user?.rol || "").toUpperCase() === "CONSULTOR";

  const [supervisores, setSupervisores] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supervisorSel, setSupervisorSel] = useState(null);
  const [seleccionados, setSeleccionados] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [busqSup, setBusqSup] = useState("");
  const [busqServ, setBusqServ] = useState("");
  const [filtroServ, setFiltroServ] = useState("TODOS");
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);


  /* carga inicial */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [r1, r2] = await Promise.all([
          fetch(`${API_BASE}/supervisores`),
          fetch(`${API_BASE}/admin/servicios`),
        ]);
        const data1 = r1.ok ? await r1.json() : [];
        const data2 = r2.ok ? await r2.json() : [];
        setSupervisores(Array.isArray(data1) ? data1 : []);
        setServicios(Array.isArray(data2) ? data2 : []);
      } catch {
        showToast("err", "Error cargando datos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* toast auto-dismiss */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(tipo, msg) { setToast({ tipo, msg }); }

  /* supervisores filtrados */
  const supFiltrados = useMemo(() => {
    const q = busqSup.toLowerCase().trim();
    if (!q) return supervisores;
    return supervisores.filter((s) =>
      (s.nombre || s.username || "").toLowerCase().includes(q)
    );
  }, [supervisores, busqSup]);

  function seleccionarSupervisor(sup) {
    setSupervisorSel(sup);
    const ids = sup.servicios.map((s) => s.id);
    setSeleccionados(ids);
    setSavedIds(ids);
    setBusqServ("");
    setFiltroServ("TODOS");
  }

  /* servicios filtrados */
  const serviciosFiltrados = useMemo(() => {
    let lista = [...servicios];
    const q = busqServ.toLowerCase().trim();
    if (q) lista = lista.filter((s) => s.nombre.toLowerCase().includes(q));
    if (filtroServ === "ASIGNADOS") lista = lista.filter((s) => seleccionados.includes(s.id));
    if (filtroServ === "NO_ASIGNADOS") lista = lista.filter((s) => !seleccionados.includes(s.id));
    return lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [servicios, busqServ, filtroServ, seleccionados]);

  const paginacion = usePaginacion(serviciosFiltrados, {
    tamanoInicial: 12,
    reinicio: [busqServ, filtroServ, supervisorSel?.id],
  });

  function toggleServicio(id) {
    if (isReadOnly) return;
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleTodos() {
    if (isReadOnly) return;
    const visiblesIds = paginacion.visibles.map((s) => s.id);
    const todosChecked = visiblesIds.every((id) => seleccionados.includes(id));
    if (todosChecked) {
      setSeleccionados((prev) => prev.filter((id) => !visiblesIds.includes(id)));
    } else {
      setSeleccionados((prev) => [...new Set([...prev, ...visiblesIds])]);
    }
  }

  async function guardar() {
    if (isReadOnly || !supervisorSel) return;
    setGuardando(true);
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
      setSavedIds([...seleccionados]);
      setSupervisorSel({ ...supervisorSel, servicios: servicios.filter((s) => seleccionados.includes(s.id)) });
      setSupervisores((prev) =>
        prev.map((s) =>
          s.id === supervisorSel.id
            ? { ...s, servicios: servicios.filter((sv) => seleccionados.includes(sv.id)) }
            : s
        )
      );
      showToast("ok", "Asignacion guardada correctamente");
    } catch {
      showToast("err", "Error al guardar la asignacion");
    } finally {
      setGuardando(false);
    }
  }

  const hayCambios =
    supervisorSel &&
    (seleccionados.length !== savedIds.length ||
      seleccionados.some((id) => !savedIds.includes(id)));


  return (
    <div className="min-h-screen bg-kazaro-mist p-4 pb-28">

      {/* TOAST */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl text-sm font-semibold
            ${toast.tipo === "ok" ? "bg-kazaro-green text-white" : "bg-rose-500 text-white"}`}
        >
          {toast.tipo === "ok" ? "✓" : "✕"} {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <BotonVolver className="mb-5" />

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-kazaro-deep font-display">Supervisores × Servicios</h1>
        <p className="text-sm text-slate-500 mt-1">Seleccioná un supervisor y gestioná los servicios que puede operar.</p>
        {isReadOnly && (
          <span className="mt-2 inline-block text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-md font-medium">Modo solo lectura</span>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Cargando datos…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">

          {/* COLUMNA IZQUIERDA — supervisores */}
          <div className="flex flex-col gap-3">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                Supervisores ({supFiltrados.length})
              </p>

              {/* busqueda */}
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">🔍</span>
                <input
                  value={busqSup}
                  onChange={(e) => setBusqSup(e.target.value)}
                  placeholder="Buscar supervisor…"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-kazaro-sky focus:ring-2 focus:ring-kazaro-sky/20"
                />
              </div>

              {/* lista */}
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {supFiltrados.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">Sin resultados</p>
                )}
                {supFiltrados.map((sup) => {
                  const activo = supervisorSel?.id === sup.id;
                  const cantServ = sup.servicios?.length ?? 0;
                  return (
                    <button
                      key={sup.id}
                      onClick={() => seleccionarSupervisor(sup)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition
                        ${activo ? "bg-kazaro-blue text-white shadow-md" : "hover:bg-kazaro-ice text-slate-700"}`}
                    >
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
                        ${activo ? "bg-white/20 text-white" : avatarColor(sup.id)}`}>
                        {initiales(sup.nombre || sup.username)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${activo ? "text-white" : "text-slate-800"}`}>
                          {sup.nombre || sup.username}
                        </p>
                        <p className={`text-xs truncate ${activo ? "text-white/70" : "text-slate-400"}`}>
                          @{sup.username}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full
                        ${activo ? "bg-white/20 text-white" : cantServ > 0 ? "bg-kazaro-ice text-kazaro-blue" : "bg-slate-100 text-slate-400"}`}>
                        {cantServ}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA — servicios */}
          {!supervisorSel ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 py-20 text-slate-400">
              <div className="text-5xl mb-4 opacity-30">←</div>
              <p className="text-sm font-medium">Seleccioná un supervisor</p>
              <p className="text-xs mt-1">para gestionar sus servicios asignados</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">

              {/* cabecera supervisor */}
              <div className="bg-gradient-to-r from-kazaro-deep to-kazaro-blue rounded-2xl shadow p-5 text-white flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold bg-white/20">
                  {initiales(supervisorSel.nombre || supervisorSel.username)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold font-display truncate">{supervisorSel.nombre || supervisorSel.username}</p>
                  <p className="text-sm text-white/70">@{supervisorSel.username}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-extrabold">{seleccionados.length}</p>
                  <p className="text-xs text-white/70">de {servicios.length} servicios</p>
                </div>
              </div>

              {/* barra de progreso */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 px-5 py-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>Servicios asignados</span>
                  <span className="font-semibold text-kazaro-blue">{seleccionados.length} / {servicios.length}</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-kazaro-blue to-kazaro-cyan rounded-full transition-all duration-500"
                    style={{ width: servicios.length ? `${(seleccionados.length / servicios.length) * 100}%` : "0%" }}
                  />
                </div>
              </div>

              {/* panel servicios */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200/60 p-5">

                {/* filtros */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-sm">🔍</span>
                    <input
                      value={busqServ}
                      onChange={(e) => setBusqServ(e.target.value)}
                      placeholder="Buscar servicio…"
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-kazaro-sky focus:ring-2 focus:ring-kazaro-sky/20"
                    />
                  </div>
                  <div className="flex gap-1.5 bg-slate-100 rounded-lg p-1">
                    {FILTROS_SERV.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setFiltroServ(f.value)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition
                          ${filtroServ === f.value ? "bg-white text-kazaro-blue shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* acciones rapidas */}
                {!isReadOnly && paginacion.visibles.length > 0 && (
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                    <p className="text-xs text-slate-400">{serviciosFiltrados.length} servicios encontrados</p>
                    <button onClick={toggleTodos} className="text-xs font-semibold text-kazaro-blue hover:underline">
                      {paginacion.visibles.every((s) => seleccionados.includes(s.id)) ? "Deseleccionar pagina" : "Seleccionar pagina"}
                    </button>
                  </div>
                )}

                {/* grid */}
                {paginacion.visibles.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">No se encontraron servicios</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {paginacion.visibles.map((srv) => {
                      const checked = seleccionados.includes(srv.id);
                      return (
                        <label
                          key={srv.id}
                          className={`flex items-center gap-3 rounded-xl border p-3.5 transition select-none
                            ${isReadOnly ? "cursor-default" : "cursor-pointer"}
                            ${checked ? "border-kazaro-blue bg-kazaro-ice shadow-sm" : "border-slate-200 bg-white hover:border-kazaro-sky hover:bg-kazaro-mist"}`}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition
                            ${checked ? "bg-kazaro-blue border-kazaro-blue" : "border-slate-300 bg-white"}`}>
                            {checked && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 12 10" fill="none">
                                <path d="M1 5l3.5 4L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <input type="checkbox" checked={checked} onChange={() => toggleServicio(srv.id)} disabled={isReadOnly} className="sr-only" />
                          <span className={`text-sm font-medium leading-tight ${checked ? "text-kazaro-deep" : "text-slate-700"}`}>
                            {srv.nombre}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <Paginacion
                  pagina={paginacion.pagina}
                  totalPaginas={paginacion.totalPaginas}
                  total={paginacion.total}
                  tamano={paginacion.tamano}
                  onPagina={paginacion.irAPagina}
                  onTamano={paginacion.cambiarTamano}
                  etiqueta="servicios"
                  noScroll
                />
              </div>

              {/* barra guardar sticky */}
              {!isReadOnly && (
                <div className={`sticky bottom-4 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-lg transition-all
                  ${hayCambios ? "bg-kazaro-deep ring-2 ring-kazaro-blue/40" : "bg-white ring-1 ring-slate-200/60"}`}>
                  <div>
                    {hayCambios ? (
                      <p className="text-sm font-semibold text-white">Tenés cambios sin guardar</p>
                    ) : (
                      <p className="text-sm text-slate-500">Asignación sincronizada</p>
                    )}
                    <p className={`text-xs mt-0.5 ${hayCambios ? "text-white/70" : "text-slate-400"}`}>
                      {seleccionados.length} servicio{seleccionados.length !== 1 ? "s" : ""} seleccionado{seleccionados.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    disabled={guardando || !hayCambios}
                    onClick={guardar}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition
                      ${hayCambios ? "bg-kazaro-cyan text-white hover:bg-kazaro-sky shadow-md disabled:opacity-60" : "bg-slate-100 text-slate-400 cursor-default"}`}
                  >
                    {guardando ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Guardando…
                      </>
                    ) : "Guardar asignación"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
