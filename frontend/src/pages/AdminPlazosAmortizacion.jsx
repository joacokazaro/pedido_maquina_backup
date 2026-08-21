import { useEffect, useMemo, useRef, useState } from "react";
import BotonVolver from "../components/BotonVolver";
import ConfirmModal from "../components/ConfirmModal";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";

function sortByNombre(items) {
  return [...items].sort((a, b) =>
    String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {
      sensitivity: "base",
      numeric: true,
    })
  );
}

const FILTROS_TIPO = [
  { value: "TODOS", label: "Todos" },
  { value: "SIN_ASIGNAR", label: "Sin asignar" },
  { value: "OTRO_PLAZO", label: "En otro plazo" },
];

function IconBuscar(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconAlerta(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function AdminPlazosAmortizacion() {

  const { hasRole } = useAuth();
  const isReadOnly = hasRole("COORDINADOR") || hasRole("CONSULTOR") || hasRole("TALLER");

  const [plazos, setPlazos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [meses, setMeses] = useState("");
  const [selectedTipoIds, setSelectedTipoIds] = useState([]);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveConfirm, setSaveConfirm] = useState(null);
  const [deleteErrorModal, setDeleteErrorModal] = useState("");
  const [search, setSearch] = useState("");
  const [tipoSearch, setTipoSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("TODOS");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const formRef = useRef(null);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_BASE}/admin/maquinas/plazos-amortizacion`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error cargando plazos de amortizacion");
      }

      setPlazos(Array.isArray(data?.plazos) ? data.plazos : []);
      setTipos(Array.isArray(data?.tipos) ? sortByNombre(data.tipos) : []);
    } catch (e) {
      setError(e.message || "Error cargando plazos de amortizacion");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const plazoById = useMemo(() => new Map(plazos.map((plazo) => [plazo.id, plazo])), [plazos]);

  const tipoToPlazo = useMemo(() => {
    const map = new Map();
    tipos.forEach((tipo) => {
      if (tipo.plazoAmortizacionId) {
        map.set(tipo.id, plazoById.get(tipo.plazoAmortizacionId) || null);
      }
    });
    return map;
  }, [tipos, plazoById]);

  const tiposSinAsignar = useMemo(
    () => sortByNombre(tipos.filter((tipo) => !tipo.plazoAmortizacionId)),
    [tipos]
  );

  const plazosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? plazos.filter((plazo) => {
          const byNombre = String(plazo.nombre || "").toLowerCase().includes(q);
          const byMeses = String(plazo.meses || "").includes(q);
          const byTipos = (plazo.tiposMaquina || []).some((tipo) => String(tipo.nombre || "").toLowerCase().includes(q));
          return byNombre || byMeses || byTipos;
        })
      : [...plazos];

    return base.sort((a, b) => {
      const mesesDiff = Number(a.meses || 0) - Number(b.meses || 0);
      if (mesesDiff !== 0) return mesesDiff;
      return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    });
  }, [plazos, search]);

  const tiposSelectorFiltrados = useMemo(() => {
    const q = tipoSearch.trim().toLowerCase();
    let base = sortByNombre(tipos);

    if (q) {
      base = base.filter((tipo) => String(tipo.nombre || "").toLowerCase().includes(q));
    }

    if (tipoFiltro === "SIN_ASIGNAR") {
      base = base.filter((tipo) => !tipo.plazoAmortizacionId);
    } else if (tipoFiltro === "OTRO_PLAZO") {
      base = base.filter((tipo) => tipo.plazoAmortizacionId && tipo.plazoAmortizacionId !== (editing?.id || null));
    }

    return base;
  }, [tipos, tipoSearch, tipoFiltro, editing]);

  function resetForm() {
    setNombre("");
    setMeses("");
    setSelectedTipoIds([]);
    setEditing(null);
    setTipoSearch("");
    setTipoFiltro("TODOS");
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function irATiposSinAsignar() {
    if (isReadOnly) return;
    resetForm();
    setTipoFiltro("SIN_ASIGNAR");
    scrollToForm();
  }

  function startEdit(plazo) {
    setEditing(plazo);
    setNombre(plazo.nombre || "");
    setMeses(String(plazo.meses || ""));
    setSelectedTipoIds((plazo.tiposMaquina || []).map((tipo) => tipo.id));
    setTipoSearch("");
    setTipoFiltro("TODOS");
    scrollToForm();
  }

  function toggleTipo(tipoId) {
    setSelectedTipoIds((prev) => {
      if (prev.includes(tipoId)) {
        return prev.filter((id) => id !== tipoId);
      }
      return [...prev, tipoId];
    });
  }

  function getTiposReasignados(tipoIds, currentPlazoId = null) {
    const tipoById = new Map(tipos.map((tipo) => [tipo.id, tipo]));
    const movidos = [];

    tipoIds.forEach((tipoId) => {
      const plazoActual = plazos.find(
        (plazo) => plazo.id !== currentPlazoId && (plazo.tiposMaquina || []).some((tipo) => tipo.id === tipoId)
      );
      if (!plazoActual) return;

      const tipo = tipoById.get(tipoId);
      movidos.push({
        tipoNombre: tipo?.nombre || "(Sin nombre)",
        plazoNombre: plazoActual.nombre || "(Sin nombre)",
      });
    });

    return sortByNombre(movidos.map((item) => ({ id: `${item.tipoNombre}-${item.plazoNombre}`, nombre: item.tipoNombre, ...item })));
  }

  function save(e) {
    e.preventDefault();
    if (isReadOnly) return;

    const payload = {
      nombre: String(nombre || "").trim(),
      meses: Number(meses),
      tipoIds: selectedTipoIds,
    };

    const tiposReasignados = getTiposReasignados(selectedTipoIds, editing?.id || null);
    const isCreate = !editing;

    const lines = [
      isCreate
        ? `Se va a crear el plazo "${payload.nombre || "(Sin nombre)"}" con ${payload.meses || 0} meses.`
        : `Se van a guardar los cambios del plazo "${payload.nombre || "(Sin nombre)"}".`,
    ];

    if (tiposReasignados.length > 0) {
      lines.push("");
      lines.push("Atencion: estos tipos ya estan asignados en otros plazos y se moveran automaticamente:");
      tiposReasignados.forEach((item) => {
        lines.push(`- ${item.tipoNombre} (actual: ${item.plazoNombre})`);
      });
    }

    setSaveConfirm({
      title: isCreate ? "Confirmar creacion" : "Confirmar cambios",
      message: lines.join("\n"),
      payload,
      editingId: editing?.id || null,
    });
  }

  async function confirmSave() {
    if (!saveConfirm) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch(
        saveConfirm.editingId
          ? `${API_BASE}/admin/maquinas/plazos-amortizacion/${saveConfirm.editingId}`
          : `${API_BASE}/admin/maquinas/plazos-amortizacion`,
        {
          method: saveConfirm.editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveConfirm.payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error guardando plazo");
      }

      resetForm();
      setSaveConfirm(null);
      await load();
    } catch (e) {
      setError(e.message || "Error guardando plazo");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget || isReadOnly) return;

    try {
      setError("");
      const res = await fetch(`${API_BASE}/admin/maquinas/plazos-amortizacion/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error eliminando plazo");
      }

      setDeleteTarget(null);
      await load();
    } catch (e) {
      setDeleteTarget(null);
      setDeleteErrorModal(e.message || "Error eliminando plazo");
    }
  }

  if (loading) return <div className="p-4">Cargando plazos de amortizacion...</div>;

  const actionBtnBase =
    "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition";
  const actionBtnMuted = `${actionBtnBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`;

  const totalAsignados = tipos.length - tiposSinAsignar.length;

  return (
    <div className="min-h-screen bg-kazaro-mist p-4 pb-24">
      <BotonVolver />

      <header className="mb-4">
        <h1 className="font-display text-2xl font-bold text-kazaro-deep">Plazos de amortizacion</h1>
        <p className="text-xs text-slate-500">
          Agrupa los tipos de maquina por plazo y revisa de un vistazo a que grupo pertenece cada uno.
        </p>
      </header>

      {error && (
        <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* RESUMEN */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Plazos</p>
          <p className="mt-1 text-2xl font-extrabold text-kazaro-deep">{plazos.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tipos de maquina</p>
          <p className="mt-1 text-2xl font-extrabold text-kazaro-deep">{tipos.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Asignados</p>
          <p className="mt-1 text-2xl font-extrabold text-kazaro-green">{totalAsignados}</p>
        </div>
        <div
          className={`rounded-2xl p-3 shadow-sm ring-1 ${
            tiposSinAsignar.length > 0 ? "bg-amber-50 ring-amber-200" : "bg-white ring-slate-200/60"
          }`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sin asignar</p>
          <p className={`mt-1 text-2xl font-extrabold ${tiposSinAsignar.length > 0 ? "text-amber-600" : "text-kazaro-green"}`}>
            {tiposSinAsignar.length}
          </p>
        </div>
      </div>

      {/* ALERTA DE TIPOS SIN ASIGNAR */}
      {tiposSinAsignar.length > 0 ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <IconAlerta className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-amber-800">
                  {tiposSinAsignar.length} tipo{tiposSinAsignar.length === 1 ? "" : "s"} de maquina sin plazo asignado
                </p>
                <p className="text-xs text-amber-700">
                  No tienen amortizacion calculada hasta que se agreguen a un plazo.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tiposSinAsignar.map((tipo) => (
                    <span
                      key={tipo.id}
                      className="rounded-full border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-700"
                    >
                      {tipo.nombre}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {!isReadOnly ? (
              <button
                type="button"
                onClick={irATiposSinAsignar}
                className="flex-none rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
              >
                Asignar ahora
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-kazaro-green/30 bg-kazaro-green/10 p-3 text-xs font-semibold text-kazaro-green">
          <IconCheck className="h-4 w-4 flex-none" />
          Todos los tipos de maquina estan asignados a un plazo
        </div>
      )}

      {!isReadOnly ? (
        <form ref={formRef} onSubmit={save} className="mb-4 scroll-mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
          <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-kazaro-ice text-kazaro-blue">
              {editing ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                {editing ? `Editar plazo: ${editing.nombre}` : "Crear nuevo plazo"}
              </h2>
              <p className="text-xs text-slate-500">
                {editing ? "Modifica los datos y la asignacion de tipos." : "Definí el nombre, los meses y los tipos que agrupa."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl border p-3"
              placeholder="Nombre del plazo"
            />

            <input
              type="number"
              min="1"
              value={meses}
              onChange={(e) => setMeses(e.target.value)}
              className="w-full rounded-xl border p-3"
              placeholder="Cantidad de meses"
            />
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">Tipos de maquina asociados</p>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">
                Seleccionados: {selectedTipoIds.length}
              </span>
            </div>

            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={tipoSearch}
                onChange={(e) => setTipoSearch(e.target.value)}
                className="w-full flex-1 rounded-xl border p-2 text-sm"
                placeholder="Filtrar tipos..."
              />
              <div className="flex flex-none gap-1 rounded-lg bg-slate-200/70 p-1">
                {FILTROS_TIPO.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setTipoFiltro(f.value)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                      tipoFiltro === f.value ? "bg-white text-kazaro-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {tiposSelectorFiltrados.map((tipo) => {
                  const selected = selectedTipoIds.includes(tipo.id);
                  const asignadoA = tipoToPlazo.get(tipo.id);
                  const esOtroPlazo = asignadoA && asignadoA.id !== (editing?.id || null);

                  return (
                    <button
                      type="button"
                      key={tipo.id}
                      onClick={() => toggleTipo(tipo.id)}
                      className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-1.5 text-left text-xs font-semibold transition ${
                        selected
                          ? "border-kazaro-blue bg-kazaro-blue text-white shadow-sm"
                          : esOtroPlazo
                            ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                            : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
                      }`}
                    >
                      <span className="leading-tight">{tipo.nombre}</span>
                      {selected ? (
                        <span className="text-[10px] font-medium text-white/80">Seleccionado</span>
                      ) : esOtroPlazo ? (
                        <span className="text-[10px] font-medium text-slate-400">Ya asignado: {asignadoA.nombre}</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-600">Sin asignar</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {tiposSelectorFiltrados.length === 0 && (
                <p className="py-4 text-center text-xs text-slate-400">No hay tipos que coincidan con el filtro.</p>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-kazaro-blue" /> Seleccionado para este plazo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-300" /> Ya asignado a otro plazo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Sin asignar
              </span>
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-kazaro-blue p-3 font-semibold text-white transition hover:bg-kazaro-deep disabled:bg-kazaro-blue/40"
            >
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear plazo"}
            </button>

            {editing ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border px-4 py-3"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
          Modo solo lectura.
        </p>
      )}

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200/60">
        <IconBuscar className="h-5 w-5 flex-none text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
          placeholder="Buscar por nombre, meses o tipo..."
        />
        <span className="flex-none rounded-full bg-kazaro-ice px-3 py-1 text-xs font-semibold text-kazaro-deep">
          {plazosFiltrados.length} plazo{plazosFiltrados.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2">
        {plazosFiltrados.map((plazo) => {
          const cantidadTipos = (plazo.tiposMaquina || []).length;

          return (
            <div
              key={plazo.id}
              className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-bold text-slate-800">{plazo.nombre}</p>
                    <span className="rounded-full bg-kazaro-ice px-2 py-0.5 text-[11px] font-semibold text-kazaro-deep">
                      {plazo.meses} {Number(plazo.meses) === 1 ? "mes" : "meses"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {cantidadTipos} tipo{cantidadTipos === 1 ? "" : "s"} de maquina asignado{cantidadTipos === 1 ? "" : "s"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cantidadTipos > 0 ? (
                      sortByNombre(plazo.tiposMaquina || []).map((tipo) => (
                        <span key={tipo.id} className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                          {tipo.nombre}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-dashed border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-400">
                        Sin tipos asignados todavia
                      </span>
                    )}
                  </div>
                </div>

                {!isReadOnly ? (
                  <div className="flex flex-none gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(plazo)}
                      className={actionBtnMuted}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(plazo)}
                      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {plazosFiltrados.length === 0 && (
          <div className="mt-6 text-center text-sm text-gray-500">
            No hay plazos que coincidan con la busqueda
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(saveConfirm)}
        title={saveConfirm?.title || "Confirmar"}
        message={saveConfirm?.message || ""}
        confirmLabel={saving ? "Guardando..." : saveConfirm?.editingId ? "Guardar" : "Crear"}
        cancelLabel="Cancelar"
        onCancel={() => {
          if (!saving) setSaveConfirm(null);
        }}
        onConfirm={confirmSave}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar plazo"
        message={`Confirmas eliminar el plazo ${deleteTarget?.nombre || ""}? Solo se puede eliminar si no tiene tipos asociados.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
      />

      <ConfirmModal
        open={Boolean(deleteErrorModal)}
        title="No se pudo eliminar"
        message={deleteErrorModal}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setDeleteErrorModal("")}
      />
    </div>
  );
}
