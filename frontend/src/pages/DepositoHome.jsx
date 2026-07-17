import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../services/apiBase";
import { EstadoBadge } from "../utils/estadoPedido.jsx";
import EventualBadge from "../components/EventualBadge";
import Paginacion from "../components/Paginacion";
import { usePaginacion } from "../hooks/usePaginacion";
import SearchableSelect from "../components/SearchableSelect";

export default function DepositoHome() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [filtro, setFiltro] = useState("TODOS");
  const [filtroSupervisor, setFiltroSupervisor] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [filtroFaltantes, setFiltroFaltantes] = useState("TODOS");

  useEffect(() => {
    const controller = new AbortController();

    async function loadPedidos() {
      try {
        const res = await fetch(`${API_BASE}/pedidos`, { signal: controller.signal });
        const data = await res.json();
        const soloDeposito = data.filter((p) => p.destino === "DEPOSITO");
        setPedidos(soloDeposito);
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
      }
    }

    loadPedidos();

    const onCreated = (e) => {
      const payload = e.detail;
      if (payload?.destino === "DEPOSITO") {
        // reload list to keep consistency
        loadPedidos();
      }
    };

    const onUpdated = (e) => {
      const payload = e.detail;
      if (payload?.destino === "DEPOSITO") loadPedidos();
    };

    window.addEventListener("pedido:created", onCreated);
    window.addEventListener("pedido:updated", onUpdated);

    return () => {
      controller.abort();
      window.removeEventListener("pedido:created", onCreated);
      window.removeEventListener("pedido:updated", onUpdated);
    };
  }, []);

  /* =========================
     HELPERS
  ========================== */

  function tieneFaltantes(pedido) {
    if (pedido.estado !== "CERRADO") return false;

    const confirmacion = [...(pedido.historial || [])]
      .reverse()
      .find(h => ["DEVOLUCION_CONFIRMADA", "DEVOLUCION_CONFIRMADA_DIRECTA"].includes(h.accion));

    const faltantes =
      confirmacion?.detalle?.faltantesConfirmados || [];

    return faltantes.length > 0;
  }

  const pedidosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return pedidos.filter((p) => {
      const esCerradoConFaltantes = p.estado === "CERRADO" && tieneFaltantes(p);

      if (filtro === "CERRADO_CON_FALTANTES" && !esCerradoConFaltantes) return false;
      if (
        filtro !== "TODOS" &&
        filtro !== "CERRADO_CON_FALTANTES" &&
        p.estado !== filtro
      ) {
        return false;
      }

      if (filtroSupervisor !== "TODOS") {
        const supervisorPedido = String(p.supervisorNombre || p.supervisor || "").toLowerCase();
        if (supervisorPedido !== filtroSupervisor.toLowerCase()) return false;
      }

      if (filtroFaltantes === "CON_FALTANTES" && !tieneFaltantes(p)) return false;
      if (filtroFaltantes === "SIN_FALTANTES" && tieneFaltantes(p)) return false;

      if (!termino) return true;

      const supervisor = String(p.supervisorNombre || p.supervisor || "").toLowerCase();
      const servicio = String(p.servicio || "").toLowerCase();
      const pedidoId = String(p.id || "").toLowerCase();
      const itemsSolicitados = (p.itemsSolicitados || []).some((item) => {
        const tipo = String(item.tipo || "").toLowerCase();
        const modelo = String(item.modelo || "").toLowerCase();
        const serie = String(item.serie || "").toLowerCase();
        return tipo.includes(termino) || modelo.includes(termino) || serie.includes(termino);
      });
      const itemsAsignados = (p.itemsAsignados || []).some((item) => {
        const id = String(item.id || "").toLowerCase();
        const tipo = String(item.tipo || "").toLowerCase();
        const modelo = String(item.modelo || "").toLowerCase();
        const serie = String(item.serie || "").toLowerCase();
        return id.includes(termino) || tipo.includes(termino) || modelo.includes(termino) || serie.includes(termino);
      });

      return (
        pedidoId.includes(termino) ||
        supervisor.includes(termino) ||
        servicio.includes(termino) ||
        itemsSolicitados ||
        itemsAsignados
      );
    });
  }, [pedidos, filtro, filtroSupervisor, busqueda, filtroFaltantes]);

  const supervisores = useMemo(() => {
    return Array.from(
      new Map(
        pedidos
          .map((p) => String(p.supervisorNombre || p.supervisor || "").trim())
          .filter(Boolean)
          .map((nombre) => [nombre.toLowerCase(), nombre])
      ).values()
    ).sort((a, b) => a.localeCompare(b));
  }, [pedidos]);

  const paginacion = usePaginacion(pedidosFiltrados, {
    reinicio: [busqueda, filtro, filtroSupervisor, filtroFaltantes],
  });

  const filtros = [
    { label: "Todos", value: "TODOS", color: "bg-gray-200 text-gray-700" },
    { label: "Pendientes", value: "PENDIENTE_PREPARACION", color: "bg-yellow-500 text-white" },
    { label: "Preparados", value: "PREPARADO", color: "bg-blue-500 text-white" },
    { label: "Entregados", value: "ENTREGADO", color: "bg-green-500 text-white" },
    { label: "Pend. Confirmación", value: "PENDIENTE_CONFIRMACION", color: "bg-orange-500 text-white" },
    { label: "Cerrados", value: "CERRADO", color: "bg-gray-700 text-white" },
    { label: "Cerrado con faltantes", value: "CERRADO_CON_FALTANTES", color: "bg-red-700 text-white" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <button
        onClick={() => navigate("/deposito")}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow transition text-gray-700 text-sm font-medium"
      >
        ← Volver al panel
      </button>

      <h1 className="text-3xl font-bold mb-6 text-center">
        Pedidos a gestionar
      </h1>

      <div className="max-w-3xl mx-auto mb-6 space-y-3 rounded-2xl bg-white p-4 shadow border border-gray-200">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          placeholder="Buscar por pedido, supervisor, servicio, máquina, modelo o serie..."
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Estado
            </label>
            <SearchableSelect
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            >
              {filtros.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Faltantes
            </label>
            <SearchableSelect
              value={filtroFaltantes}
              onChange={(e) => setFiltroFaltantes(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            >
              <option value="TODOS">Todos los pedidos</option>
              <option value="CON_FALTANTES">Con faltantes</option>
              <option value="SIN_FALTANTES">Sin faltantes</option>
            </SearchableSelect>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Supervisor
            </label>
            <SearchableSelect
              value={filtroSupervisor}
              onChange={(e) => setFiltroSupervisor(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            >
              <option value="TODOS">Todos los supervisores</option>
              {supervisores.map((supervisor) => (
                <option key={supervisor} value={supervisor}>
                  {supervisor}
                </option>
              ))}
            </SearchableSelect>
          </div>
        </div>
      </div>

      {pedidosFiltrados.length === 0 && (
        <p className="text-center text-gray-600 mt-4">
          No hay pedidos en esta categoría.
        </p>
      )}

      {/* LISTA */}
      <div className="space-y-4 max-w-xl mx-auto">
        {paginacion.visibles.map((p) => (
          <Link
            to={`/deposito/pedido/${p.id}`}
            key={p.id}
            className="block bg-white shadow rounded-xl p-4 border border-gray-200 hover:shadow-md transition"
          >
            {/* HEADER CARD */}
            <div className="flex justify-between items-center gap-2">
              <div>
                <h2 className="inline-flex items-center gap-1.5 font-bold text-lg">
                  {p.id}
                  {p.esEventual ? <EventualBadge /> : null}
                </h2>
                {/** Mostrar nombre completo del solicitante si existe */}
                { (p.supervisorNombre || p.supervisor) && (
                  <p className="text-sm text-gray-600">Solicitado por: {p.supervisorNombre || p.supervisor}</p>
                ) }
              </div>

              <div className="flex items-center gap-2">
                {tieneFaltantes(p) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    ⚠ Con faltantes
                  </span>
                )}

                <EstadoBadge estado={p.estado} />
              </div>
            </div>

            {/* SOLICITADO */}
            <div className="mt-2">
              <p className="text-sm text-gray-600">Solicitado:</p>

              <ul className="ml-4 mt-1 text-sm text-gray-800">
                {p.itemsSolicitados.map((i, idx) => (
                  <li key={idx}>
                    {i.tipo} × <b>{i.cantidad}</b>
                  </li>
                ))}
              </ul>
            </div>
          </Link>
        ))}

        <Paginacion
          pagina={paginacion.pagina}
          totalPaginas={paginacion.totalPaginas}
          total={paginacion.total}
          tamano={paginacion.tamano}
          onPagina={paginacion.irAPagina}
          onTamano={paginacion.cambiarTamano}
          etiqueta="pedidos"
        />
      </div>
    </div>
  );
}
