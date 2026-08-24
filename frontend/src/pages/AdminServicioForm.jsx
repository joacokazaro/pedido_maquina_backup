import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BotonVolver from "../components/BotonVolver";
import { API_BASE } from "../services/apiBase";
import { useAuth } from "../context/AuthContext";
import SearchableSelect from "../components/SearchableSelect";
import { EstadoMaquinaBadge } from "../utils/estadoMaquina";
import { TIPOS_SERVICIO } from "../constants/tipoServicio";

const ESTADOS = [
  { value: "", label: "Todos los estados" },
  { value: "disponible", label: "Disponible" },
  { value: "asignada", label: "Asignada" },
  { value: "no_devuelta", label: "No devuelta" },
  { value: "fuera_servicio", label: "Fuera de servicio" },
  { value: "taller", label: "En taller" },
  { value: "baja", label: "Baja" },
];

export default function AdminServicioForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isReadOnly = String(user?.rol || "").toUpperCase() === "CONSULTOR";
  const esEdicion = Boolean(id);

  const [nombre, setNombre] = useState("");
  const [idBrowix, setIdBrowix] = useState("");
  const [tipoServicio, setTipoServicio] = useState("");
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(esEdicion);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");

  useEffect(() => {
    if (!esEdicion) return;

    fetch(`${API_BASE}/admin/servicios/${id}`)
      .then(r => r.json())
      .then(data => {
        setNombre(data.nombre || "");
        setIdBrowix(data.idBrowix || "");
        setTipoServicio(data.tipo || "");
        setMaquinas(data.maquinas || []);
      })
      .catch(() => setError("Error cargando servicio"))
      .finally(() => setLoading(false));
  }, [id, esEdicion]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (isReadOnly) return;

    if (!tipoServicio) {
      setError("Debe indicar el tipo del servicio (Limpieza o Espacios Verdes)");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        esEdicion
          ? `${API_BASE}/admin/servicios/${id}`
          : `${API_BASE}/admin/servicios`,
        {
          method: esEdicion ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, idBrowix, tipo: tipoServicio }),
        }
      );

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error guardando");
      }

      navigate("/admin/servicios");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const maquinasFiltradas = useMemo(() => {
    let data = Array.isArray(maquinas) ? [...maquinas] : [];

    if (tipoFiltro) data = data.filter((m) => m.tipo === tipoFiltro);
    if (estadoFiltro) data = data.filter((m) => m.estado === estadoFiltro);

    if (search.trim()) {
      const termino = search.toLowerCase();
      data = data.filter((m) =>
        m.id?.toLowerCase().includes(termino) ||
        m.tipo?.toLowerCase().includes(termino) ||
        m.modelo?.toLowerCase().includes(termino) ||
        m.serie?.toLowerCase().includes(termino) ||
        m.asignacion?.pedidoId?.toLowerCase().includes(termino)
      );
    }

    data.sort((a, b) => {
      const tipoComp = (a.tipo || "").localeCompare(b.tipo || "");
      return tipoComp !== 0
        ? tipoComp
        : (a.id || "").localeCompare(b.id || "", undefined, { numeric: true });
    });

    return data;
  }, [maquinas, tipoFiltro, estadoFiltro, search]);

  const tipos = useMemo(() => {
    return Array.from(new Set((maquinas || []).map((m) => m.tipo).filter(Boolean))).sort();
  }, [maquinas]);

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <BotonVolver />

      <h1 className="text-lg font-bold mb-3">
        {esEdicion ? "Editar servicio" : "Nuevo servicio"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow p-4 space-y-3"
      >
        {isReadOnly ? (
          <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded">Modo solo lectura.</p>
        ) : null}
        {error && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="admin-servicio-form-nombre-del-servicio" className="block text-xs font-semibold mb-1">
            Nombre del servicio
          </label>
          <input id="admin-servicio-form-nombre-del-servicio"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            disabled={isReadOnly}
            className="w-full p-2 border rounded-xl"
          />
        </div>

        <div>
          <label htmlFor="admin-servicio-form-id-browix" className="block text-xs font-semibold mb-1">
            ID Browix
          </label>
          <input id="admin-servicio-form-id-browix"
            value={idBrowix}
            onChange={e => setIdBrowix(e.target.value)}
            disabled={isReadOnly}
            placeholder="Ej: K12"
            className="w-full p-2 border rounded-xl"
          />
        </div>

        <div>
          <label htmlFor="admin-servicio-form-tipo" className="block text-xs font-semibold mb-1">
            Tipo
          </label>
          <SearchableSelect id="admin-servicio-form-tipo"
            value={tipoServicio}
            onChange={e => setTipoServicio(e.target.value)}
            disabled={isReadOnly}
            className="w-full p-2 border rounded-xl"
          >
            <option value="">Seleccionar tipo...</option>
            {TIPOS_SERVICIO.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </SearchableSelect>
        </div>

        {!isReadOnly ? (
          <button
            disabled={saving}
            className="w-full bg-orange-600 text-white py-2 rounded-xl font-semibold"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        ) : null}
      </form>

      {esEdicion && (
        <>
          <div className="bg-white rounded-xl shadow p-4 space-y-3 mt-4 mb-4">
            <div className="text-sm text-gray-600">
              Máquinas asociadas: <span className="font-semibold text-gray-900">{maquinas.length}</span>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-2 border rounded-xl text-sm"
              placeholder="Buscar por código, tipo, modelo, serie o pedido..."
            />

            <div className="flex gap-2">
              <SearchableSelect
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value)}
                className="flex-1 p-2 border rounded-xl text-sm"
              >
                <option value="">Todos los tipos</option>
                {tipos.map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </SearchableSelect>

              <SearchableSelect
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="flex-1 p-2 border rounded-xl text-sm"
              >
                {ESTADOS.map((estado) => (
                  <option key={estado.value} value={estado.value}>{estado.label}</option>
                ))}
              </SearchableSelect>
            </div>
          </div>

          <div className="space-y-2">
            {maquinasFiltradas.map((maquina) => (
              <div key={maquina.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <div className="font-semibold uppercase">{maquina.tipo}</div>
                    <div className="text-xs text-gray-500">Código: {maquina.id}</div>
                  </div>

                  <EstadoMaquinaBadge estado={maquina.estado} className="h-fit" />
                </div>

                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <p>Modelo: <b>{maquina.modelo || "-"}</b></p>
                  <p>Serie: <b>{maquina.serie || "-"}</b></p>
                  <p>Pedido activo: <b>{maquina.asignacion?.pedidoId || "-"}</b></p>
                </div>
              </div>
            ))}

            {maquinasFiltradas.length === 0 && (
              <div className="text-sm text-gray-500 text-center mt-6">
                No hay máquinas que coincidan con los filtros actuales.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
