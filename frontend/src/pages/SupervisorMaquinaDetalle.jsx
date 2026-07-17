import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../services/apiBase";
import FondoKazaro from "../components/FondoKazaro";
import SearchableSelect from "../components/SearchableSelect";

const ESTADOS = [
  "disponible",
  "asignada",
  "no_devuelta",
  "fuera_servicio",
  "taller",
  "baja",
];

function formatFecha(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR");
}

function formatMoneda(value, currency) {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(num);
}

export default function SupervisorMaquinaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [maquina, setMaquina] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id || !id) return;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const [supervisorRes, maquinaRes] = await Promise.all([
          fetch(`${API_BASE}/supervisores/${user.id}/maquinas`),
          fetch(`${API_BASE}/maquinas/${encodeURIComponent(id)}`),
        ]);

        if (!supervisorRes.ok) {
          throw new Error("No se pudo validar el acceso a la máquina");
        }

        if (!maquinaRes.ok) {
          const data = await maquinaRes.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo cargar la máquina");
        }

        const supervisorData = await supervisorRes.json();
        const maquinaData = await maquinaRes.json();
        const maquinasSupervisor = mergeSupervisorMaquinas(supervisorData);
        const maquinaSupervisor = maquinasSupervisor.find((item) => item.id === id);

        if (!maquinaSupervisor) {
          throw new Error("La máquina no pertenece a tus servicios o préstamos activos");
        }

        setMaquina({
          id: maquinaData.id,
          tipo: maquinaData.tipo,
          modelo: maquinaData.modelo,
          serie: maquinaData.serie || "",
          estado: maquinaData.estado,
          fechaCompra: maquinaData.fechaCompra,
          proveedorFactura: maquinaData.proveedorFactura,
          empresa: maquinaData.empresa,
          anio: maquinaData.anio,
          amortizacion: maquinaData.amortizacion,
          antiguedad: maquinaData.antiguedad,
          valorUsadaDolares: maquinaData.valorUsadaDolares,
          valorUsadaPesos: maquinaData.valorUsadaPesos,
          valorNuevaDolares: maquinaData.valorNuevaDolares,
          valorNuevaPesos: maquinaData.valorNuevaPesos,
          origenInfo: maquinaData.origenInfo,
          comentarios: maquinaData.comentarios,
          servicioAmortizacion: maquinaData.servicioAmortizacion || null,
          servicioOriginal: maquinaSupervisor.servicio || null,
          servicioActual: maquinaSupervisor.servicioActual || maquinaSupervisor.servicio || null,
          pedido: maquinaSupervisor.pedido || null,
          origen: maquinaSupervisor.origen,
        });
      } catch (e) {
        console.error(e);
        setError(e.message || "Error cargando la máquina");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, user?.id]);

  const linkPedido = useMemo(() => {
    if (!maquina?.pedido?.id) return null;
    return maquina.pedido.tipo === "PRESTAMO"
      ? `/supervisor/prestamo/${encodeURIComponent(maquina.pedido.id)}`
      : `/supervisor/pedido/${encodeURIComponent(maquina.pedido.id)}`;
  }, [maquina]);

  if (loading) return <div className="p-4">Cargando máquina...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!maquina) return <div className="p-4 text-gray-500">Máquina no encontrada.</div>;

  return (
    <div className="min-h-screen p-4 pb-24">
      <FondoKazaro />
      <header className="mb-4 flex justify-between">
        <button onClick={() => navigate(-1)} className="text-xs text-blue-600 underline">
          Volver
        </button>
        <h1 className="text-lg font-bold">Detalle de máquina</h1>
        <div />
      </header>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3">
        {maquina.pedido && (
          <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-xl text-xs space-y-1">
            <p>
              <b>Movimiento activo:</b>{" "}
              {maquina.pedido.tipo === "PRESTAMO" ? "Préstamo recibido" : "Pedido propio"}
            </p>
            <p>
              <b>Solicitante:</b> {maquina.pedido.supervisorSolicitante || "-"}
            </p>
            <p>
              <b>Pedido relacionado:</b>{" "}
              {linkPedido ? (
                <Link
                  to={linkPedido}
                  className="font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-800"
                >
                  {maquina.pedido.id}
                </Link>
              ) : (
                "-"
              )}
            </p>
          </div>
        )}

        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Código</label>
            <input value={maquina.id} disabled className="w-full p-2 rounded-xl border bg-gray-100" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Tipo</label>
            <input value={maquina.tipo} disabled className="w-full p-2 rounded-xl border bg-gray-100" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Modelo</label>
            <input value={maquina.modelo} disabled className="w-full p-2 rounded-xl border bg-gray-100" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Serie</label>
            <input value={maquina.serie} disabled className="w-full p-2 rounded-xl border bg-gray-100" placeholder="Sin serie" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Servicio original</label>
            <input
              value={maquina.servicioOriginal?.nombre || "-"}
              disabled
              className="w-full p-2 rounded-xl border bg-gray-100"
            />
          </div>

          {maquina.pedido && maquina.servicioActual?.id !== maquina.servicioOriginal?.id && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Servicio actual</label>
              <input
                value={maquina.servicioActual?.nombre || "-"}
                disabled
                className="w-full p-2 rounded-xl border bg-gray-100"
              />
            </div>
          )}
        </div>

        <SearchableSelect value={maquina.estado} disabled className="w-full p-2 rounded-xl border bg-gray-100 text-gray-700">
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </SearchableSelect>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Datos de compra y valuación</h2>

          <div className="grid gap-2 text-xs text-slate-700 md:grid-cols-2">
            <p><b>Fecha de compra:</b> {formatFecha(maquina.fechaCompra)}</p>
            <p><b>Empresa:</b> {maquina.empresa || "-"}</p>
            <p className="md:col-span-2"><b>Proveedor / N° factura:</b> {maquina.proveedorFactura || "-"}</p>
            <p><b>Año:</b> {maquina.anio ?? "-"}</p>
            <p><b>Antigüedad:</b> {maquina.antiguedad ?? "-"}</p>
            <p><b>Amortización:</b> {maquina.amortizacion ?? "-"}</p>
            <p><b>Servicio amortización:</b> {maquina.servicioAmortizacion?.nombre || "-"}</p>
            <p><b>Valor usada USD:</b> {formatMoneda(maquina.valorUsadaDolares, "USD")}</p>
            <p><b>Valor usada ARS:</b> {formatMoneda(maquina.valorUsadaPesos, "ARS")}</p>
            <p><b>Valor nueva USD:</b> {formatMoneda(maquina.valorNuevaDolares, "USD")}</p>
            <p><b>Valor nueva ARS:</b> {formatMoneda(maquina.valorNuevaPesos, "ARS")}</p>
            <p className="md:col-span-2"><b>Origen info:</b> {maquina.origenInfo || "-"}</p>
            <p className="md:col-span-2"><b>Comentarios:</b> {maquina.comentarios || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function mergeSupervisorMaquinas(payload) {
  const maquinasFijas = Array.isArray(payload?.maquinasFijas) ? payload.maquinasFijas : [];
  const maquinasTemporales = Array.isArray(payload?.maquinasTemporales)
    ? payload.maquinasTemporales
    : [];

  const merged = new Map();

  for (const maquina of maquinasFijas) {
    merged.set(maquina.id, {
      ...maquina,
      origen: "FIJA",
      servicioActual: maquina.servicio || null,
      pedido: null,
    });
  }

  for (const maquina of maquinasTemporales) {
    const prev = merged.get(maquina.id);
    merged.set(maquina.id, {
      ...(prev || {}),
      ...maquina,
      origen: prev ? "FIJA_CON_MOVIMIENTO" : "TEMPORAL",
      servicio: prev?.servicio || maquina.servicio || null,
      servicioActual: maquina.servicioActual || prev?.servicioActual || maquina.servicio || null,
    });
  }

  return Array.from(merged.values());
}
