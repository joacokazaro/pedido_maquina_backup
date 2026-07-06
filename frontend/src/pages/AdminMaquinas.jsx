import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";
import { buildActorHeaders } from "../utils/authHeaders";

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "disponible", label: "Disponible" },
  { value: "asignada", label: "Asignada" },
  { value: "no_devuelta", label: "No devuelta" },
  { value: "fuera_servicio", label: "Fuera de servicio" },
  { value: "taller", label: "En taller" },
  { value: "baja", label: "Baja" }
];

export default function AdminMaquinas() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("ADMIN");
  const canOperateTaller = hasRole("ADMIN") || hasRole("TALLER");
  const isReadOnly = hasRole("COORDINADOR") || hasRole("CONSULTOR") || hasRole("TALLER");

  const [allMaquinas, setAllMaquinas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [supervisorFiltro, setSupervisorFiltro] = useState("");
  const [supervisores, setSupervisores] = useState([]);
  const [loadingSupervisorFiltro, setLoadingSupervisorFiltro] = useState(false);
  const [supervisorMachineIdsCache, setSupervisorMachineIdsCache] = useState({});
  const [resumen, setResumen] = useState(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkTipoFiltro, setBulkTipoFiltro] = useState("");
  const [bulkEstadoFiltro, setBulkEstadoFiltro] = useState("");
  const [bulkServicioActualFiltro, setBulkServicioActualFiltro] = useState("");
  const [bulkServicioDestinoId, setBulkServicioDestinoId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSummaryOpen, setBulkSummaryOpen] = useState(false);
  const [bulkActivosOpen, setBulkActivosOpen] = useState(false);
  const [bulkSuccessOpen, setBulkSuccessOpen] = useState(false);
  const [bulkPreview, setBulkPreview] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importErrors, setImportErrors] = useState([]);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importSuccessOpen, setImportSuccessOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [maqsRes, resumenRes, serviciosRes, supervisoresRes] = await Promise.all([
        fetch(`${API_BASE}/admin/maquinas`, { headers: buildActorHeaders(user) }),
        fetch(`${API_BASE}/admin/maquinas/stock-resumen`, { headers: buildActorHeaders(user) }),
        fetch(`${API_BASE}/servicios`),
        fetch(`${API_BASE}/supervisores/catalogo`, { headers: buildActorHeaders(user) }),
      ]);

      const maqs = await maqsRes.json().catch(() => []);
      const resumenData = await resumenRes.json().catch(() => null);
      const serviciosData = await serviciosRes.json().catch(() => []);
      const supervisoresData = await supervisoresRes.json().catch(() => []);

      if (!maqsRes.ok) {
        throw new Error(maqs?.error || "Error cargando máquinas");
      }

      if (!resumenRes.ok) {
        throw new Error(resumenData?.error || "Error cargando resumen");
      }

      if (!serviciosRes.ok) {
        throw new Error(serviciosData?.error || "Error cargando servicios");
      }

      if (!supervisoresRes?.ok) {
        throw new Error(supervisoresData?.error || "Error cargando supervisores");
      }

      setAllMaquinas(Array.isArray(maqs) ? maqs : []);
      setResumen(resumenData);
      setServicios(Array.isArray(serviciosData) ? serviciosData : []);
      setSupervisores(Array.isArray(supervisoresData) ? supervisoresData : []);
    } catch (e) {
      console.error(e);
      setError("Error cargando máquinas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [user?.username]);

  useEffect(() => {
    if (!supervisorFiltro) {
      setLoadingSupervisorFiltro(false);
      return;
    }
    if (supervisorMachineIdsCache[supervisorFiltro]) {
      setLoadingSupervisorFiltro(false);
      return;
    }

    const controller = new AbortController();

    async function loadSupervisorScope() {
      try {
        setLoadingSupervisorFiltro(true);
        setError("");

        const res = await fetch(`${API_BASE}/supervisores/${supervisorFiltro}/maquinas`, {
          signal: controller.signal,
          headers: buildActorHeaders(user),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudo obtener el alcance de máquinas del supervisor");
        }

        const maquinasFijas = Array.isArray(data?.maquinasFijas) ? data.maquinasFijas : [];
        const maquinasTemporales = Array.isArray(data?.maquinasTemporales) ? data.maquinasTemporales : [];
        const ids = Array.from(
          new Set([
            ...maquinasFijas.map((m) => m.id),
            ...maquinasTemporales.map((m) => m.id),
          ].filter(Boolean))
        );

        setSupervisorMachineIdsCache((prev) => ({
          ...prev,
          [supervisorFiltro]: ids,
        }));
      } catch (e) {
        if (e.name === "AbortError") return;
        console.error(e);
        setError(e.message || "Error cargando máquinas del supervisor");
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSupervisorFiltro(false);
        }
      }
    }

    loadSupervisorScope();

    return () => controller.abort();
  }, [supervisorFiltro, supervisorMachineIdsCache, user]);

  async function moverTallerIndividual(id, accion) {
    if (!canOperateTaller) return;
    try {
      setError("");
      const res = await fetch(`${API_BASE}/maquinas/${encodeURIComponent(id)}/taller`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...buildActorHeaders(user),
        },
        body: JSON.stringify({ accion }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar taller");

      await loadData();
    } catch (e) {
      console.error(e);
      setError(e.message || "Error actualizando taller");
    }
  }

  useEffect(() => {
    let data = [...allMaquinas];

    if (tipoFiltro) data = data.filter(m => m.tipo === tipoFiltro);
    if (estadoFiltro) data = data.filter(m => m.estado === estadoFiltro);
    if (supervisorFiltro) {
      const scopedIds = new Set(supervisorMachineIdsCache[supervisorFiltro] || []);
      data = data.filter((m) => scopedIds.has(m.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(m =>
        m.id?.toLowerCase().includes(q) ||
        m.tipo?.toLowerCase().includes(q) ||
        m.modelo?.toLowerCase().includes(q) ||
        m.serie?.toLowerCase().includes(q) ||
        m.servicio?.nombre?.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const t = (a.tipo || "").localeCompare(b.tipo || "");
      return t !== 0 ? t : a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    setFiltered(data);
  }, [allMaquinas, search, tipoFiltro, estadoFiltro, supervisorFiltro, supervisorMachineIdsCache]);

  const tiposUnicos = Array.from(
    new Set(allMaquinas.map(m => m.tipo).filter(Boolean))
  ).sort();

  const bulkFiltered = useMemo(() => {
    let data = [...allMaquinas];

    if (bulkTipoFiltro) data = data.filter((m) => m.tipo === bulkTipoFiltro);
    if (bulkEstadoFiltro) data = data.filter((m) => m.estado === bulkEstadoFiltro);
    if (bulkServicioActualFiltro) {
      data = data.filter((m) => String(m.servicio?.id || "") === String(bulkServicioActualFiltro));
    }

    if (bulkSearch.trim()) {
      const q = bulkSearch.toLowerCase();
      data = data.filter((m) =>
        m.id?.toLowerCase().includes(q) ||
        m.tipo?.toLowerCase().includes(q) ||
        m.modelo?.toLowerCase().includes(q) ||
        m.serie?.toLowerCase().includes(q) ||
        m.servicio?.nombre?.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const t = (a.tipo || "").localeCompare(b.tipo || "");
      return t !== 0 ? t : a.id.localeCompare(b.id, undefined, { numeric: true });
    });

    return data;
  }, [allMaquinas, bulkTipoFiltro, bulkEstadoFiltro, bulkServicioActualFiltro, bulkSearch]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function resetBulkState() {
    setBulkSearch("");
    setBulkTipoFiltro("");
    setBulkEstadoFiltro("");
    setBulkServicioActualFiltro("");
    setBulkServicioDestinoId("");
    setSelectedIds([]);
    setBulkPreview(null);
    setBulkResult(null);
    setBulkSummaryOpen(false);
    setBulkActivosOpen(false);
    setBulkSuccessOpen(false);
  }

  function openBulkPanel() {
    resetBulkState();
    setBulkOpen(true);
  }

  function closeBulkPanel() {
    setBulkOpen(false);
    resetBulkState();
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const m of bulkFiltered) next.add(m.id);
      return [...next];
    });
  }

  function clearAllSelected() {
    setSelectedIds([]);
  }

  async function handlePrepareBulkConfirm() {
    if (!selectedIds.length) {
      setError("Seleccioná al menos una máquina para el movimiento masivo.");
      return;
    }
    if (!bulkServicioDestinoId) {
      setError("Seleccioná un servicio destino para continuar.");
      return;
    }

    setBulkBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/maquinas/movimientos-masivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildActorHeaders(user) },
        body: JSON.stringify({
          maquinaIds: selectedIds,
          servicioId: Number(bulkServicioDestinoId),
          dryRun: true,
          confirmarConActivos: false,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo validar el movimiento masivo");
      }

      setBulkPreview(data);
      setBulkSummaryOpen(true);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error validando movimiento masivo");
    } finally {
      setBulkBusy(false);
    }
  }

  async function ejecutarMovimiento(confirmarConActivos) {
    setBulkBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/maquinas/movimientos-masivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildActorHeaders(user) },
        body: JSON.stringify({
          maquinaIds: selectedIds,
          servicioId: Number(bulkServicioDestinoId),
          dryRun: false,
          confirmarConActivos,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo ejecutar el movimiento masivo");
      }

      setBulkSummaryOpen(false);
      setBulkActivosOpen(false);
      setBulkResult(data);
      setBulkSuccessOpen(true);
      await loadData();
    } catch (e) {
      console.error(e);
      setError(e.message || "Error aplicando movimiento masivo");
    } finally {
      setBulkBusy(false);
    }
  }

  function resetImportState() {
    setImportFile(null);
    setImportBusy(false);
    setImportPreview(null);
    setImportErrors([]);
    setImportPreviewOpen(false);
    setImportSuccessOpen(false);
    setImportResult(null);
  }

  function openImportPanel() {
    resetImportState();
    setImportOpen(true);
  }

  function closeImportPanel() {
    setImportOpen(false);
    resetImportState();
  }

  async function handlePreviewImport() {
    if (!importFile) {
      setError("Debés seleccionar un archivo .xlsx para importar.");
      return;
    }

    setImportBusy(true);
    setError("");
    setImportErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch(`${API_BASE}/admin/maquinas/import/preview`, {
        method: "POST",
        headers: {
          ...buildActorHeaders(user),
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportErrors(Array.isArray(data?.detalles) ? data.detalles : []);
        throw new Error(data?.error || "No se pudo validar la importación");
      }

      setImportPreview(data);
      setImportPreviewOpen(true);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error validando importación de máquinas");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleConfirmImport() {
    if (!importFile) {
      setError("Debés seleccionar un archivo .xlsx para importar.");
      return;
    }

    setImportBusy(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch(`${API_BASE}/admin/maquinas/import/confirm`, {
        method: "POST",
        headers: {
          ...buildActorHeaders(user),
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportErrors(Array.isArray(data?.detalles) ? data.detalles : []);
        throw new Error(data?.error || "No se pudo confirmar la importación");
      }

      setImportPreviewOpen(false);
      setImportResult(data);
      setImportSuccessOpen(true);
      await loadData();
    } catch (e) {
      console.error(e);
      setError(e.message || "Error importando máquinas");
    } finally {
      setImportBusy(false);
    }
  }

  async function handleDownloadImportTemplate() {
    setError("");

    try {
      const res = await fetch(`${API_BASE}/admin/maquinas/import/template`, {
        headers: {
          ...buildActorHeaders(user),
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "No se pudo descargar la plantilla");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "plantilla_maquinas.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error descargando plantilla de máquinas");
    }
  }

  if (loading) return <div className="p-4">Cargando máquinas...</div>;

  const actionBtnBase =
    "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition";
  const actionBtnMuted =
    `${actionBtnBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100`;
  const actionBtnSoft =
    `${actionBtnBase} border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200`;
  const actionBtnExcel =
    `${actionBtnBase} border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200`;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-white border border-gray-200 shadow-sm
                   hover:shadow transition text-gray-700 text-sm font-medium"
      >
        ← Volver
      </button>

      <header className="mb-4">
        <div>
          <h1 className="text-2xl font-bold">Máquinas</h1>
          <p className="text-xs text-gray-600">Gestión del parque de máquinas</p>
        </div>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/admin/maquinas/tipos")}
                className={actionBtnMuted}
              >
                Tipos de maquinas
              </button>

              <button
                type="button"
                onClick={() => navigate("/admin/plazos-amortizacion")}
                className={actionBtnMuted}
              >
                Plazos de amortizacion
              </button>
            </>
          ) : null}

          {isAdmin ? (
            <button
              type="button"
              onClick={openBulkPanel}
              className={actionBtnSoft}
            >
              Movimientos masivos
            </button>
          ) : null}

          {isAdmin ? (
            <button
              type="button"
              onClick={() => navigate("/admin/maquinas/amortizaciones")}
              className={actionBtnSoft}
            >
              Panel de amortizaciones
            </button>
          ) : null}

          {isAdmin ? (
            <button
              type="button"
              onClick={openImportPanel}
              className={actionBtnExcel}
            >
              Importar maquinas
            </button>
          ) : null}
        </div>

        {isAdmin ? (
          <a
            href={`${API_BASE}/admin/maquinas/export`}
            className={actionBtnExcel}
          >
            Exportar Excel
          </a>
        ) : null}
      </div>

      {resumen && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Estados</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(resumen.porEstado || {}).map(([estado, cant]) => (
              <div key={estado} className="bg-white rounded-xl shadow px-3 py-2 flex justify-between">
                <span className="capitalize">{estado.replace("_", " ")}</span>
                <b>{cant}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-3 mb-4 space-y-3">
        <input
          className="w-full p-2.5 rounded-xl border text-sm"
          placeholder="Buscar por código, tipo, modelo, serie o servicio..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Tipo de máquina
            </label>
            <select
              className="w-full p-2 rounded-xl border text-xs"
              value={tipoFiltro}
              onChange={e => setTipoFiltro(e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {tiposUnicos.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Estados
            </label>
            <select
              className="w-full p-2 rounded-xl border text-xs"
              value={estadoFiltro}
              onChange={e => setEstadoFiltro(e.target.value)}
            >
              {ESTADOS.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Supervisor
            </label>
            <select
              className="w-full p-2 rounded-xl border text-xs"
              value={supervisorFiltro}
              onChange={(e) => setSupervisorFiltro(e.target.value)}
            >
              <option value="">Todos los supervisores</option>
              {supervisores.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre || s.username}
                </option>
              ))}
            </select>
          </div>

        </div>

        {supervisorFiltro && loadingSupervisorFiltro ? (
          <p className="text-xs text-gray-500">Cargando máquinas fijas y temporales del supervisor seleccionado...</p>
        ) : null}
      </div>

      <div className="space-y-2">
        {filtered.map(m => (
          <div
            key={m.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/admin/maquinas/${encodeURIComponent(m.id)}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(`/admin/maquinas/${encodeURIComponent(m.id)}`);
              }
            }}
            className="w-full cursor-pointer text-left bg-white rounded-2xl shadow px-4 py-3"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-sm font-bold uppercase">{m.tipo}</p>
                <p className="text-xs text-gray-500">Código: <b>{m.id}</b></p>
              </div>
              <span className={estadoBadgeClass(m.estado)}>
                {m.estado}
              </span>
            </div>

            {m.modelo && (
              <p className="text-xs text-gray-600 mt-1">{m.modelo}</p>
            )}

            {m.servicio && (
              <p className="text-xs text-gray-500 mt-0.5">
                Servicio: <b>{m.servicio.nombre}</b>
              </p>
            )}

            {m.estado === "asignada" && (
              <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                <p>
                  Servicio original: <b>{m.servicio?.nombre || "-"}</b>
                </p>
                <p>
                  Servicio de préstamo: <b>{m.asignacion?.servicio?.nombre || "-"}</b>
                </p>
              </div>
            )}

            {canOperateTaller ? (
              <div className="mt-2 flex gap-2">
                {m.estado !== "taller" ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      moverTallerIndividual(m.id, "ingreso");
                    }}
                    className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    Ingreso taller
                  </button>
                ) : null}
                {m.estado === "taller" ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      moverTallerIndividual(m.id, "egreso");
                    }}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    Egreso taller
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!isReadOnly && isAdmin ? (
        <div className="fixed bottom-4 right-4">
          <button
            onClick={() => navigate("/admin/maquinas/nueva")}
            className="rounded-full w-14 h-14 bg-blue-600 text-white text-2xl shadow-lg"
          >
            +
          </button>
        </div>
      ) : null}

      {bulkOpen ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Movimientos masivos</h2>
                  <p className="text-xs text-gray-600">
                    Seleccioná máquinas, elegí un servicio destino y confirmá el movimiento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeBulkPanel}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>

              <div className="grid flex-1 gap-4 overflow-hidden p-4 md:grid-cols-[1fr_320px]">
                <div className="flex min-h-0 flex-col rounded-2xl border border-gray-200">
                  <div className="space-y-2 border-b p-3">
                    <input
                      className="w-full rounded-xl border p-2.5 text-sm"
                      placeholder="Buscar por código, tipo, modelo, serie o servicio..."
                      value={bulkSearch}
                      onChange={(e) => setBulkSearch(e.target.value)}
                    />

                    <div className="grid gap-2 md:grid-cols-3">
                      <select
                        className="rounded-xl border p-2 text-xs"
                        value={bulkTipoFiltro}
                        onChange={(e) => setBulkTipoFiltro(e.target.value)}
                      >
                        <option value="">Todos los tipos</option>
                        {tiposUnicos.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>

                      <select
                        className="rounded-xl border p-2 text-xs"
                        value={bulkEstadoFiltro}
                        onChange={(e) => setBulkEstadoFiltro(e.target.value)}
                      >
                        {ESTADOS.map((e) => (
                          <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                      </select>

                      <select
                        className="rounded-xl border p-2 text-xs"
                        value={bulkServicioActualFiltro}
                        onChange={(e) => setBulkServicioActualFiltro(e.target.value)}
                      >
                        <option value="">Servicio actual: todos</option>
                        {servicios.map((s) => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllFiltered}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Seleccionar filtradas ({bulkFiltered.length})
                      </button>
                      <button
                        type="button"
                        onClick={clearAllSelected}
                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Limpiar selección
                      </button>
                      <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        Seleccionadas: {selectedIds.length}
                      </span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <div className="space-y-2">
                      {bulkFiltered.map((m) => {
                        const checked = selectedSet.has(m.id);
                        const conPedidoActivo = Boolean(m.asignacion?.pedidoId);

                        return (
                          <label
                            key={m.id}
                            className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                              checked ? "border-indigo-300 bg-indigo-50" : "border-gray-200 bg-white"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4"
                              checked={checked}
                              onChange={() => toggleSelected(m.id)}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-bold uppercase text-gray-900">{m.tipo}</p>
                                <div className="flex items-center gap-2">
                                  {conPedidoActivo ? (
                                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
                                      Pedido activo
                                    </span>
                                  ) : null}
                                  <span className={estadoBadgeClass(m.estado)}>{m.estado}</span>
                                </div>
                              </div>
                              <p className="text-xs text-gray-600">Código: <b>{m.id}</b></p>
                              <p className="text-xs text-gray-500">
                                Servicio actual: <b>{m.servicio?.nombre || "-"}</b>
                              </p>
                              {conPedidoActivo ? (
                                <p className="text-xs text-amber-700">
                                  Pedido: <b>{m.asignacion?.pedidoId}</b> ({m.asignacion?.estadoPedido})
                                </p>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <aside className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-900">Resumen del movimiento</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    El proceso es transaccional (todo o nada) y registra historial por cada máquina movida.
                  </p>

                  <div className="mt-4 space-y-2 text-xs">
                    <p className="rounded-lg bg-white px-3 py-2">
                      Seleccionadas: <b>{selectedIds.length}</b>
                    </p>
                    <div>
                      <label className="mb-1 block font-semibold text-slate-700">Servicio destino</label>
                      <select
                        className="w-full rounded-xl border p-2"
                        value={bulkServicioDestinoId}
                        onChange={(e) => setBulkServicioDestinoId(e.target.value)}
                      >
                        <option value="">— Seleccionar servicio —</option>
                        {servicios.map((s) => (
                          <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePrepareBulkConfirm}
                    disabled={bulkBusy || !selectedIds.length || !bulkServicioDestinoId}
                    className="mt-4 w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                  >
                    {bulkBusy ? "Validando..." : "Confirmar movimiento"}
                  </button>
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={bulkSummaryOpen}
        title="Confirmar movimiento masivo"
        message={[
          `Seleccionadas: ${bulkPreview?.resumen?.seleccionadas || 0}`,
          `A mover: ${bulkPreview?.resumen?.paraMover || 0}`,
          `Sin cambios (ya en destino): ${bulkPreview?.resumen?.sinCambios || 0}`,
          `Con pedido activo: ${bulkPreview?.resumen?.conPedidoActivo || 0}`,
          "",
          `Servicio destino: ${bulkPreview?.servicioDestino?.nombre || "-"}`,
        ].join("\n")}
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        onCancel={() => setBulkSummaryOpen(false)}
        onConfirm={() => {
          if ((bulkPreview?.conPedidoActivo || []).length > 0) {
            setBulkSummaryOpen(false);
            setBulkActivosOpen(true);
            return;
          }
          ejecutarMovimiento(false);
        }}
      >
        {(bulkPreview?.sinCambios || []).length > 0 ? (
          <div className="max-h-36 overflow-y-auto rounded-lg border bg-gray-50 p-2 text-xs text-gray-600">
            <p className="mb-1 font-semibold">Sin cambios:</p>
            {(bulkPreview?.sinCambios || []).slice(0, 10).map((m) => (
              <p key={m.id}>• {m.id}</p>
            ))}
            {(bulkPreview?.sinCambios || []).length > 10 ? (
              <p>... y {(bulkPreview?.sinCambios || []).length - 10} más</p>
            ) : null}
          </div>
        ) : null}
      </ConfirmModal>

      <ConfirmModal
        open={bulkActivosOpen}
        title="Máquinas con pedido activo"
        message="Estas máquinas forman parte de un pedido activo. ¿Desea moverlas igualmente?"
        confirmLabel="Sí, mover igualmente"
        cancelLabel="Volver"
        tone="danger"
        onCancel={() => setBulkActivosOpen(false)}
        onConfirm={() => ejecutarMovimiento(true)}
      >
        <div className="max-h-56 overflow-y-auto rounded-lg border bg-amber-50 p-2 text-xs text-amber-900">
          {(bulkPreview?.conPedidoActivo || []).map((m) => (
            <p key={m.id}>
              • {m.id} - Pedido {m.pedidoId} ({m.estadoPedido})
            </p>
          ))}
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={bulkSuccessOpen}
        title="Movimiento masivo completado"
        hideCancel
        confirmLabel="Volver al listado"
        message={[
          `Servicio destino: ${bulkResult?.servicioDestino?.nombre || "-"}`,
          `Máquinas movidas: ${(bulkResult?.movidas || []).length}`,
          `Sin cambios: ${(bulkResult?.sinCambios || []).length}`,
          `Con pedido activo involucradas: ${(bulkResult?.conPedidoActivo || []).length}`,
        ].join("\n")}
        onConfirm={() => {
          setBulkSuccessOpen(false);
          closeBulkPanel();
          navigate("/admin/maquinas");
        }}
      />

      {importOpen ? (
        <div className="fixed inset-0 z-40 bg-black/30">
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Importación masiva de máquinas</h2>
                  <p className="text-xs text-gray-600">
                    Subí un archivo .xlsx para previsualizar y confirmar la importación.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeImportPanel}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cerrar
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-600 mb-2">
                    Reglas: solo .xlsx, máximo 5 MB y hasta 5000 filas.
                  </p>
                  <div className="mb-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleDownloadImportTemplate}
                      className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                    >
                      Descargar plantilla
                    </button>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm"
                  />
                </div>

                {importErrors.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    <p className="font-semibold mb-1">Errores detectados:</p>
                    {importErrors.map((err, idx) => (
                      <p key={`${err}-${idx}`}>• {err}</p>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewImport}
                    disabled={importBusy || !importFile}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {importBusy ? "Validando..." : "Previsualizar importación"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={importPreviewOpen}
        title="Confirmar importación de máquinas"
        message={[
          importPreview?.message || "",
          `Nuevas: ${importPreview?.resumen?.creadas || 0}`,
          `A actualizar: ${importPreview?.resumen?.actualizadas || 0}`,
        ].filter(Boolean).join("\n")}
        confirmLabel={importBusy ? "Importando..." : "Confirmar importación"}
        cancelLabel="Cancelar"
        onCancel={() => setImportPreviewOpen(false)}
        onConfirm={handleConfirmImport}
      />

      <ConfirmModal
        open={importSuccessOpen}
        title="Importación completada"
        hideCancel
        confirmLabel="Volver al listado"
        message={[
          `Detectadas: ${importResult?.resumen?.detectadas || 0}`,
          `Creadas: ${importResult?.resumen?.creadas || 0}`,
          `Actualizadas: ${importResult?.resumen?.actualizadas || 0}`,
        ].join("\n")}
        onConfirm={() => {
          setImportSuccessOpen(false);
          closeImportPanel();
          navigate("/admin/maquinas");
        }}
      />
    </div>
  );
}

function estadoBadgeClass(estado) {
  const base = "px-2 py-1 rounded-full text-[10px] font-semibold uppercase";
  switch (estado) {
    case "disponible": return `${base} bg-green-100 text-green-700`;
    case "asignada": return `${base} bg-blue-100 text-blue-700`;
    case "no_devuelta": return `${base} bg-red-100 text-red-700`;
    case "fuera_servicio": return `${base} bg-orange-100 text-orange-700`;
    case "taller": return `${base} bg-yellow-100 text-yellow-700`;
    case "baja": return `${base} bg-gray-200 text-gray-500`;
    default: return `${base} bg-gray-100 text-gray-600`;
  }
}
