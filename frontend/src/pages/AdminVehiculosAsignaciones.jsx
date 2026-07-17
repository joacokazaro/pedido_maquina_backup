import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import { buildActorHeaders } from "../utils/authHeaders";
import ConfirmModal from "../components/ConfirmModal";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../hooks/usePaginacion";
import SearchableSelect from "../components/SearchableSelect";

const SIN_ASIGNAR = "__sin_asignar__";

export default function AdminVehiculosAsignaciones() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [vehiculos, setVehiculos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [search, setSearch] = useState("");
  const [empresaFiltro, setEmpresaFiltro] = useState("");
  const [conductorFiltro, setConductorFiltro] = useState("");
  const [estadoAsignacionFiltro, setEstadoAsignacionFiltro] = useState("");

  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [targetUsuarioId, setTargetUsuarioId] = useState("");
  const [observacion, setObservacion] = useState("");

  const [preview, setPreview] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const [vehiculosRes, usuariosRes] = await Promise.all([
        fetch(`${API_BASE}/admin/vehiculos`, { headers: buildActorHeaders(user) }),
        fetch(`${API_BASE}/admin-users?activo=true`),
      ]);

      if (!vehiculosRes.ok || !usuariosRes.ok) {
        throw new Error("No se pudieron cargar los datos de asignaciones");
      }

      const [vehiculosData, usuariosData] = await Promise.all([
        vehiculosRes.json(),
        usuariosRes.json(),
      ]);

      setVehiculos(
        Array.isArray(vehiculosData) ? vehiculosData.filter((v) => v.estado !== "baja") : []
      );
      setUsuarios(Array.isArray(usuariosData) ? usuariosData : []);
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      setError(e.message || "Error cargando asignaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const empresas = useMemo(
    () => Array.from(new Set(vehiculos.map((item) => item.empresa).filter(Boolean))).sort(),
    [vehiculos]
  );

  const filtered = useMemo(() => {
    let data = [...vehiculos];

    if (empresaFiltro) data = data.filter((item) => item.empresa === empresaFiltro);
    if (conductorFiltro) data = data.filter((item) => String(item.conductorActual?.id || "") === conductorFiltro);
    if (estadoAsignacionFiltro === "asignados") data = data.filter((item) => item.conductorActual);
    if (estadoAsignacionFiltro === "sinAsignar") data = data.filter((item) => !item.conductorActual);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((item) =>
        [
          item.id,
          item.empresa,
          item.vehiculo,
          item.patente,
          item.modelo,
          item.conductorActual?.nombre,
          item.conductorActual?.username,
        ].some((value) => value?.toLowerCase().includes(q))
      );
    }

    return data.sort((a, b) =>
      String(a.id || "").localeCompare(String(b.id || ""), undefined, { numeric: true, sensitivity: "base" })
    );
  }, [vehiculos, empresaFiltro, conductorFiltro, estadoAsignacionFiltro, search]);

  const paginacion = usePaginacion(filtered, {
    reinicio: [search, empresaFiltro, conductorFiltro, estadoAsignacionFiltro],
  });

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selectedIds.has(v.id));

  function toggleSelectAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((v) => v.id)));
    }
  }

  function resetOperationState() {
    setPreview(null);
    setConfirmOpen(false);
    setError("");
    setSuccessMsg("");
  }

  async function validar() {
    if (!selectedIds.size) {
      setError("Seleccioná al menos un vehículo");
      return;
    }
    if (targetUsuarioId === "") {
      setError("Elegí un conductor de destino o la opción para quitar asignación");
      return;
    }

    try {
      setValidating(true);
      setError("");
      setSuccessMsg("");

      const res = await fetch(`${API_BASE}/admin/vehiculos/asignaciones-masivas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildActorHeaders(user) },
        body: JSON.stringify({
          vehiculoIds: Array.from(selectedIds),
          usuarioId: targetUsuarioId === SIN_ASIGNAR ? null : Number(targetUsuarioId),
          observacion,
          asignadoPorId: user?.id,
          dryRun: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo validar la asignación masiva");

      setPreview(data);
      setConfirmOpen(true);
    } catch (e) {
      console.error(e);
      setError(e.message || "Error validando asignación masiva");
    } finally {
      setValidating(false);
    }
  }

  async function confirmar() {
    try {
      setApplying(true);
      setError("");

      const res = await fetch(`${API_BASE}/admin/vehiculos/asignaciones-masivas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildActorHeaders(user) },
        body: JSON.stringify({
          vehiculoIds: Array.from(selectedIds),
          usuarioId: targetUsuarioId === SIN_ASIGNAR ? null : Number(targetUsuarioId),
          observacion,
          asignadoPorId: user?.id,
          dryRun: false,
          confirmarReasignacion: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo aplicar la asignación masiva");

      setConfirmOpen(false);
      setPreview(null);
      setSelectedIds(new Set());
      setObservacion("");
      setTargetUsuarioId("");
      setSuccessMsg(data?.message || "Asignaciones aplicadas correctamente");
      load();
    } catch (e) {
      console.error(e);
      setError(e.message || "Error aplicando asignación masiva");
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <div className="p-4">Cargando asignaciones...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
      >
        ← Volver
      </button>

      <header className="mb-3">
        <h1 className="text-2xl font-bold">Asignaciones</h1>
        <p className="text-xs text-gray-600">Listado de conductores asignados y reasignación masiva de vehículos.</p>
      </header>

      {error && <div className="mb-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div>}
      {successMsg && <div className="mb-3 rounded-lg bg-green-100 p-3 text-sm text-green-700">{successMsg}</div>}

      <div className="mb-4 rounded-2xl bg-white p-3 shadow space-y-3">
        <input
          className="w-full rounded-xl border p-2.5 text-sm"
          placeholder="Buscar por ID, empresa, patente, modelo o conductor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Empresa
            </label>
            <SearchableSelect
              className="w-full rounded-xl border p-2 text-xs"
              value={empresaFiltro}
              onChange={(e) => setEmpresaFiltro(e.target.value)}
            >
              <option value="">Todas las empresas</option>
              {empresas.map((empresa) => (
                <option key={empresa} value={empresa}>{empresa}</option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Conductor actual
            </label>
            <SearchableSelect
              className="w-full rounded-xl border p-2 text-xs"
              value={conductorFiltro}
              onChange={(e) => setConductorFiltro(e.target.value)}
            >
              <option value="">Todos los conductores</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={String(usuario.id)}>
                  {usuario.nombre || usuario.username}
                </option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Estado de asignación
            </label>
            <SearchableSelect
              className="w-full rounded-xl border p-2 text-xs"
              value={estadoAsignacionFiltro}
              onChange={(e) => setEstadoAsignacionFiltro(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="asignados">Asignados</option>
              <option value="sinAsignar">Sin asignar</option>
            </SearchableSelect>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 shadow space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-blue-900">
            {selectedIds.size} vehículo{selectedIds.size === 1 ? "" : "s"} seleccionado{selectedIds.size === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={toggleSelectAllFiltered}
            className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            {allFilteredSelected ? "Deseleccionar filtrados" : "Seleccionar todos los filtrados"}
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-blue-800">
              Asignar a
            </label>
            <SearchableSelect
              className="w-full rounded-xl border p-2 text-xs"
              value={targetUsuarioId}
              onChange={(e) => {
                setTargetUsuarioId(e.target.value);
                resetOperationState();
              }}
            >
              <option value="">Elegí una opción...</option>
              <option value={SIN_ASIGNAR}>— Quitar asignación —</option>
              {usuarios.map((usuario) => (
                <option key={usuario.id} value={String(usuario.id)}>
                  {usuario.nombre || usuario.username}
                </option>
              ))}
            </SearchableSelect>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-blue-800">
              Observación (opcional)
            </label>
            <input
              className="w-full rounded-xl border p-2 text-xs"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Motivo del cambio..."
            />
          </div>
        </div>

        <button
          type="button"
          onClick={validar}
          disabled={validating || !selectedIds.size || targetUsuarioId === ""}
          className="w-full rounded-xl bg-blue-600 p-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {validating ? "Validando..." : "Aplicar cambios"}
        </button>
      </div>

      <div className="space-y-2">
        {paginacion.visibles.map((vehiculo) => (
          <label
            key={vehiculo.id}
            className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={selectedIds.has(vehiculo.id)}
              onChange={() => toggleSelected(vehiculo.id)}
            />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase">{vehiculo.vehiculo}</p>
                  <p className="text-xs text-gray-500">
                    ID: <b>{vehiculo.id}</b> · Patente: <b>{vehiculo.patente}</b>
                  </p>
                  <p className="mt-1 text-xs text-gray-600">{vehiculo.empresa} · {vehiculo.modelo}</p>
                </div>
                <span
                  className={
                    vehiculo.conductorActual
                      ? "rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold uppercase text-green-700"
                      : "rounded-full bg-gray-200 px-2 py-1 text-[10px] font-semibold uppercase text-gray-600"
                  }
                >
                  {vehiculo.conductorActual ? "Asignado" : "Sin asignar"}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Conductor actual:{" "}
                <b>{vehiculo.conductorActual?.nombre || vehiculo.conductorActual?.username || "Sin asignar"}</b>
              </p>
            </div>
          </label>
        ))}

        {filtered.length === 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">No hay vehículos que coincidan con los filtros.</div>
        )}
      </div>

      <Paginacion
        pagina={paginacion.pagina}
        totalPaginas={paginacion.totalPaginas}
        total={paginacion.total}
        tamano={paginacion.tamano}
        onPagina={paginacion.irAPagina}
        onTamano={paginacion.cambiarTamano}
        etiqueta="vehículos"
      />

      <ConfirmModal
        open={confirmOpen}
        title="Confirmar asignación masiva"
        message={[
          `Seleccionados: ${preview?.resumen?.seleccionados || 0}`,
          `Nuevas asignaciones: ${preview?.resumen?.nuevas || 0}`,
          `Reasignaciones (cambian de conductor): ${preview?.resumen?.reasignaciones || 0}`,
          `Sin cambios: ${preview?.resumen?.sinCambios || 0}`,
          preview?.resumen?.bajasExcluidas
            ? `Excluidos por estar dados de baja: ${preview.resumen.bajasExcluidas}`
            : null,
          "",
          `Destino: ${preview?.usuarioDestino ? (preview.usuarioDestino.nombre || preview.usuarioDestino.username) : "Quitar asignación"}`,
        ]
          .filter(Boolean)
          .join("\n")}
        confirmLabel={applying ? "Aplicando..." : "Confirmar"}
        cancelLabel="Cancelar"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmar}
      >
        {(preview?.reasignaciones || []).length > 0 ? (
          <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            <p className="font-semibold">Estos vehículos ya tienen otro conductor y serán reasignados:</p>
            {preview.reasignaciones.slice(0, 10).map((v) => (
              <p key={v.id}>• {v.id} — {v.patente} (actual: {v.conductorActual || "-"})</p>
            ))}
            {preview.reasignaciones.length > 10 ? (
              <p>... y {preview.reasignaciones.length - 10} más</p>
            ) : null}
          </div>
        ) : null}
      </ConfirmModal>
    </div>
  );
}
