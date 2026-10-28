import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import BotonVolver from "../components/BotonVolver";
import SearchableSelect from "../components/SearchableSelect";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import { buildActorHeaders } from "../utils/authHeaders";
import { formatDateOnly, formatDateTime } from "../utils/date";

export default function AdminInformesServicio() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [servicios, setServicios] = useState([]);
  const [informes, setInformes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [servicioId, setServicioId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState("");

  const [filtroServicioId, setFiltroServicioId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const headers = buildActorHeaders(user);
        const [serviciosRes, informesRes] = await Promise.all([
          fetch(`${API_BASE}/admin/informes-servicio/servicios`, { headers }),
          fetch(`${API_BASE}/admin/informes-servicio`, { headers }),
        ]);
        if (!serviciosRes.ok || !informesRes.ok) {
          const fallida = serviciosRes.ok ? informesRes : serviciosRes;
          const data = await fallida.json().catch(() => ({}));
          throw new Error(data?.error || "No se pudieron cargar los datos");
        }

        const [serviciosData, informesData] = await Promise.all([serviciosRes.json(), informesRes.json()]);
        setServicios(Array.isArray(serviciosData) ? serviciosData : []);
        setInformes(Array.isArray(informesData) ? informesData : []);
      } catch (loadError) {
        console.error(loadError);
        setError(loadError.message || "Error cargando informes");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  async function crearInforme(event) {
    event.preventDefault();
    setErrorCrear("");

    if (!servicioId) return setErrorCrear("Elegí el servicio del informe.");
    if (!fechaDesde || !fechaHasta) return setErrorCrear("Indicá el rango de fechas del informe.");
    if (fechaDesde > fechaHasta) return setErrorCrear("La fecha desde no puede ser posterior a la fecha hasta.");

    try {
      setCreando(true);
      const res = await fetch(`${API_BASE}/admin/informes-servicio`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildActorHeaders(user) },
        body: JSON.stringify({ servicioId: Number(servicioId), fechaDesde, fechaHasta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el informe");

      navigate(`/admin/informes-servicio/${data.id}`);
    } catch (crearError) {
      console.error(crearError);
      setErrorCrear(crearError.message || "Error creando el informe");
    } finally {
      setCreando(false);
    }
  }

  const informesVisibles = filtroServicioId
    ? informes.filter((informe) => String(informe.servicio?.id) === filtroServicioId)
    : informes;

  const inputClass = "w-full rounded-xl border border-slate-300 bg-white p-3 text-sm";

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-5">
      <BotonVolver className="" />

      <div>
        <h1 className="font-display text-2xl font-extrabold text-kazaro-navy">Informes de servicio</h1>
        <p className="text-sm text-slate-600">
          Resumen de un servicio fijo de Espacios Verdes en un rango de fechas: máquinas y vehículos utilizados,
          trabajos, horas, insumos y observaciones.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-800">Nuevo informe</h2>
        <p className="mb-4 text-xs text-slate-500">
          Al crearlo se precargan las máquinas y vehículos de los pedidos entregados al servicio en esas fechas.
        </p>

        <form onSubmit={crearInforme} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label htmlFor="informe-servicio" className="mb-1 block text-sm font-medium text-slate-700">
                Servicio
              </label>
              <SearchableSelect
                id="informe-servicio"
                className={inputClass}
                value={servicioId}
                onChange={(event) => setServicioId(event.target.value)}
                disabled={loading}
              >
                <option value="">Seleccionar servicio...</option>
                {servicios.map((servicio) => (
                  <option key={servicio.id} value={String(servicio.id)}>
                    {servicio.nombre}
                  </option>
                ))}
              </SearchableSelect>
            </div>
            <div>
              <label htmlFor="informe-desde" className="mb-1 block text-sm font-medium text-slate-700">
                Desde
              </label>
              <input
                id="informe-desde"
                type="date"
                className={inputClass}
                value={fechaDesde}
                onChange={(event) => setFechaDesde(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="informe-hasta" className="mb-1 block text-sm font-medium text-slate-700">
                Hasta
              </label>
              <input
                id="informe-hasta"
                type="date"
                className={inputClass}
                value={fechaHasta}
                onChange={(event) => setFechaHasta(event.target.value)}
              />
            </div>
          </div>

          {errorCrear ? <p className="text-sm font-medium text-red-700">{errorCrear}</p> : null}

          <button
            type="submit"
            disabled={creando || loading}
            className="rounded-xl bg-kazaro-blue px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-kazaro-deep disabled:opacity-60"
          >
            {creando ? "Creando..." : "Crear informe"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-slate-800">Informes guardados</h2>
          <div className="w-full sm:w-72">
            <SearchableSelect
              className={inputClass}
              value={filtroServicioId}
              onChange={(event) => setFiltroServicioId(event.target.value)}
            >
              <option value="">Todos los servicios</option>
              {servicios.map((servicio) => (
                <option key={servicio.id} value={String(servicio.id)}>
                  {servicio.nombre}
                </option>
              ))}
            </SearchableSelect>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Cargando informes...</p>
        ) : informesVisibles.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay informes guardados.</p>
        ) : (
          <div className="space-y-3">
            {informesVisibles.map((informe) => (
              <Link
                key={informe.id}
                to={`/admin/informes-servicio/${informe.id}`}
                className="block rounded-xl border border-slate-200 p-4 transition hover:border-kazaro-sky hover:bg-kazaro-mist"
              >
                <p className="font-semibold text-slate-900">{informe.servicio?.nombre}</p>
                <p className="text-xs text-slate-600">
                  Período: {formatDateOnly(informe.fechaDesde)} al {formatDateOnly(informe.fechaHasta)}
                </p>
                <p className="text-xs text-slate-500">
                  Creado por {informe.creadoPor?.nombre || informe.creadoPor?.username || "-"} · Última modificación{" "}
                  {formatDateTime(informe.updatedAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
