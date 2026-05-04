import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";

function estadoBadgeClass(estado) {
  const base = "inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase";

  switch (estado) {
    case "disponible":
      return `${base} bg-green-100 text-green-700`;
    case "asignada":
      return `${base} bg-blue-100 text-blue-700`;
    case "no_devuelta":
      return `${base} bg-red-100 text-red-700`;
    case "fuera_servicio":
      return `${base} bg-orange-100 text-orange-700`;
    case "reparacion":
      return `${base} bg-yellow-100 text-yellow-700`;
    case "baja":
      return `${base} bg-gray-200 text-gray-600`;
    default:
      return `${base} bg-gray-100 text-gray-600`;
  }
}

function MaquinaCard({ maquina, temporal = false }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase text-gray-800">{maquina.tipo}</p>
          <p className="text-xs text-gray-500">
            Código: <b>{maquina.id}</b>
          </p>
        </div>

        <span className={estadoBadgeClass(maquina.estado)}>{maquina.estado}</span>
      </div>

      <div className="mt-3 space-y-1 text-xs text-gray-600">
        <p>
          Modelo: <b>{maquina.modelo || "-"}</b>
        </p>
        <p>
          Serie: <b>{maquina.serie || "-"}</b>
        </p>
        <p>
          Servicio: <b>{maquina.servicio?.nombre || "-"}</b>
        </p>

        {temporal && (
          <>
            <p>
              Pedido: <b>{maquina.pedido?.id || "-"}</b>
            </p>
            <p>
              Estado pedido: <b>{maquina.pedido?.estado || "-"}</b>
            </p>
            <p>
              Solicitado por: <b>{maquina.pedido?.supervisorSolicitante || "-"}</b>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function DepositoSupervisores() {
  const navigate = useNavigate();

  const [supervisores, setSupervisores] = useState([]);
  const [supervisorId, setSupervisorId] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [loadingCatalogo, setLoadingCatalogo] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogo() {
      try {
        setLoadingCatalogo(true);
        setError("");

        const res = await fetch(`${API_BASE}/supervisores/catalogo`);
        if (!res.ok) throw new Error("No se pudieron cargar los supervisores");

        const data = await res.json();
        if (cancelled) return;

        const lista = Array.isArray(data) ? data : [];
        setSupervisores(lista);

        if (lista.length > 0) {
          setSupervisorId(String(lista[0].id));
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setSupervisores([]);
          setError("Error cargando supervisores");
        }
      } finally {
        if (!cancelled) {
          setLoadingCatalogo(false);
        }
      }
    }

    loadCatalogo();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supervisorId) {
      setDetalle(null);
      return;
    }

    const controller = new AbortController();

    async function loadDetalle() {
      try {
        setLoadingDetalle(true);
        setError("");

        const res = await fetch(`${API_BASE}/supervisores/${supervisorId}/maquinas`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("No se pudo cargar el detalle del supervisor");

        const data = await res.json();
        setDetalle(data);
      } catch (e) {
        if (e.name === "AbortError") return;
        console.error(e);
        setDetalle(null);
        setError("Error cargando las máquinas del supervisor");
      } finally {
        setLoadingDetalle(false);
      }
    }

    loadDetalle();

    return () => controller.abort();
  }, [supervisorId]);

  const supervisorSeleccionado =
    detalle?.supervisor ||
    supervisores.find((item) => String(item.id) === supervisorId) ||
    null;

  const maquinasFijas = Array.isArray(detalle?.maquinasFijas) ? detalle.maquinasFijas : [];
  const maquinasTemporales = Array.isArray(detalle?.maquinasTemporales)
    ? detalle.maquinasTemporales
    : [];

  if (loadingCatalogo) {
    return <div className="p-4">Cargando supervisores...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="mb-4">
        <button
          onClick={() => navigate("/deposito")}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:shadow"
        >
          ← Volver
        </button>
      </div>

      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Máquinas por Supervisor</h1>
        <p className="mt-1 text-sm text-gray-600">
          Seleccioná un supervisor para ver sus máquinas fijas por servicio y las temporales asignadas por pedido.
        </p>
      </header>

      <div className="mb-4 rounded-2xl bg-white p-4 shadow">
        <label className="mb-2 block text-sm font-medium text-gray-700">Supervisor</label>

        <select
          className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm"
          value={supervisorId}
          onChange={(e) => setSupervisorId(e.target.value)}
        >
          {supervisores.map((supervisor) => (
            <option key={supervisor.id} value={supervisor.id}>
              {supervisor.nombre || supervisor.username}
            </option>
          ))}
        </select>

        {supervisorSeleccionado && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {supervisorSeleccionado.nombre || supervisorSeleccionado.username}
                </p>
                <p className="text-sm text-gray-600">@{supervisorSeleccionado.username}</p>
              </div>

              <div className="text-xs text-gray-500">
                Servicios asignados: <b>{supervisorSeleccionado.servicios?.length || 0}</b>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(supervisorSeleccionado.servicios || []).map((servicio) => (
                <span
                  key={servicio.id}
                  className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {servicio.nombre}
                </span>
              ))}

              {(supervisorSeleccionado.servicios || []).length === 0 && (
                <span className="text-sm text-gray-500">No tiene servicios asignados.</span>
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loadingDetalle ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-gray-600 shadow">
          Cargando máquinas del supervisor...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Máquinas fijas</h2>
                <p className="text-xs text-gray-600">
                  Máquinas pertenecientes a los servicios asignados al supervisor.
                </p>
              </div>

              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                {maquinasFijas.length}
              </span>
            </div>

            <div className="space-y-3">
              {maquinasFijas.map((maquina) => (
                <MaquinaCard key={maquina.id} maquina={maquina} />
              ))}

              {maquinasFijas.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                  Este supervisor no tiene máquinas fijas en sus servicios.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Máquinas temporales</h2>
                <p className="text-xs text-gray-600">
                  Máquinas asignadas momentáneamente al supervisor por pedidos activos.
                </p>
              </div>

              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                {maquinasTemporales.length}
              </span>
            </div>

            <div className="space-y-3">
              {maquinasTemporales.map((maquina) => (
                <MaquinaCard key={`${maquina.id}-${maquina.pedido?.id || "tmp"}`} maquina={maquina} temporal />
              ))}

              {maquinasTemporales.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                  No tiene máquinas temporales asignadas por pedido.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}