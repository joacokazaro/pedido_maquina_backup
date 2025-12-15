import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function AsignarMaquinas() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pedido, setPedido] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [justificacion, setJustificacion] = useState("");
  const [showJustificacion, setShowJustificacion] = useState(false);
  const [alerta, setAlerta] = useState("");

  const [solicitado, setSolicitado] = useState({});

  /* =========================
     CARGA INICIAL
  ========================== */
  useEffect(() => {
    fetch(`http://localhost:3000/pedidos/${id}`)
      .then((r) => r.json())
      .then((p) => {
        setPedido(p);

        const sol = {};
        (p.itemsSolicitados ?? []).forEach(
          (i) => (sol[i.tipo] = i.cantidad)
        );
        setSolicitado(sol);
      });

    fetch("http://localhost:3000/maquinas")
      .then((r) => r.json())
      .then(setMaquinas);
  }, [id]);

  if (!pedido) return <div className="p-6">Cargando...</div>;

  /* =========================
     FILTROS
  ========================== */
  const tipos = [
    ...new Set(
      maquinas.map((m) => m.tipo).filter((t) => t && t !== "")
    ),
  ];

  const filtradas = maquinas.filter((m) => {
    if (m.estado !== "disponible") return false;

    const texto = filtroTexto.toLowerCase();
    const cumpleTexto =
      m.id.toLowerCase().includes(texto) ||
      m.tipo.toLowerCase().includes(texto) ||
      (m.modelo ?? "").toLowerCase().includes(texto);

    const cumpleTipo =
      filtroTipo === "TODOS" || m.tipo === filtroTipo;

    return cumpleTexto && cumpleTipo;
  });

  /* =========================
     SELECCIÓN
  ========================== */
  function toggleSeleccion(m) {
    if (seleccion.some((s) => s.id === m.id)) {
      setSeleccion(seleccion.filter((s) => s.id !== m.id));
    } else {
      setSeleccion([...seleccion, m]);
    }
  }

  function requiresJustification() {
    const asignadosPorTipo = {};

    seleccion.forEach((m) => {
      asignadosPorTipo[m.tipo] =
        (asignadosPorTipo[m.tipo] || 0) + 1;
    });

    for (const tipo in solicitado) {
      const sol = solicitado[tipo];
      const asig = asignadosPorTipo[tipo] || 0;
      if (sol !== asig) return true;
    }

    return false;
  }

  /* =========================
     ACCIÓN PRINCIPAL
  ========================== */
  async function confirmarAsignacion() {
    setAlerta("");

    if (seleccion.length === 0) {
      setAlerta(
        "Debés seleccionar al menos 1 máquina para continuar."
      );
      return;
    }

    const necesita = requiresJustification();

    if (necesita && justificacion.trim() === "") {
      setShowJustificacion(true);
      return;
    }

    await fetch(
      `http://localhost:3000/pedidos/${id}/asignar`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asignadas: seleccion.map((m) => m.id),
          justificacion: necesita ? justificacion : null,
          usuario: "deposito",
        }),
      }
    );

    navigate(`/deposito/pedido/${id}`);
  }

  function cerrarJustificacion() {
    setShowJustificacion(false);
    // opcional: limpiar texto
    // setJustificacion("");
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">

      {/* VOLVER */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg
                   bg-white border border-gray-200 shadow-sm
                   hover:shadow transition text-gray-700 text-sm font-medium"
      >
        <span className="text-lg">←</span> Volver
      </button>

      <h1 className="text-2xl font-bold mb-4">
        Asignar máquinas
      </h1>

      {/* FILTRO TIPO */}
      <div className="mb-4 space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Tipo de máquina
        </label>
        <select
          className="w-full p-3 rounded-xl border border-gray-300 bg-white"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="TODOS">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* BUSCADOR */}
      <input
        className="w-full mb-4 p-3 rounded-xl border border-gray-300"
        placeholder="Buscar por código, tipo o modelo..."
        value={filtroTexto}
        onChange={(e) => setFiltroTexto(e.target.value)}
      />

      {/* LISTA */}
      <div className="space-y-3">
        {filtradas.map((m) => {
          const selected = seleccion.some(
            (s) => s.id === m.id
          );
          return (
            <div
              key={m.id}
              onClick={() => toggleSeleccion(m)}
              className={`p-4 rounded-xl shadow cursor-pointer ${
                selected
                  ? "bg-green-100 border border-green-400"
                  : "bg-white"
              }`}
            >
              <p className="text-sm font-semibold uppercase tracking-wide">
                {m.tipo}
              </p>
              <p className="mt-1 text-base font-bold">
                Código: {m.id}
              </p>
              {m.modelo && (
                <p className="mt-1 text-xs text-gray-600">
                  {m.modelo}
                </p>
              )}
            </div>
          );
        })}

        {filtradas.length === 0 && (
          <p className="text-sm text-gray-500">
            No hay máquinas disponibles que coincidan
            con el filtro.
          </p>
        )}
      </div>

      {/* ALERTA */}
      {alerta && (
        <div className="mt-4 text-center text-sm bg-red-100 text-red-700 py-2 rounded-xl">
          {alerta}
        </div>
      )}

      {/* BARRA INFERIOR */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t shadow-lg p-4">
        <p className="text-sm mb-2 text-gray-700">
          Seleccionadas: <b>{seleccion.length}</b>
        </p>

        <button
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
          onClick={confirmarAsignacion}
        >
          Confirmar asignación
        </button>
      </div>

      {/* MODAL JUSTIFICACIÓN */}
      {showJustificacion && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4"
          onClick={cerrarJustificacion}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-3">
              Justificación requerida
            </h2>

            <p className="text-sm text-gray-600 mb-3">
              La cantidad asignada no coincide con lo
              solicitado. Es necesario justificar la
              diferencia.
            </p>

            <textarea
              className="w-full p-2 border rounded-lg mb-4"
              rows="3"
              value={justificacion}
              onChange={(e) =>
                setJustificacion(e.target.value)
              }
              placeholder="Escribí la justificación..."
            />

            <div className="flex gap-2">
              <button
                className="w-1/2 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold"
                onClick={cerrarJustificacion}
              >
                Cancelar
              </button>

              <button
                className="w-1/2 bg-blue-600 text-white py-2 rounded-lg font-semibold"
                onClick={confirmarAsignacion}
              >
                Guardar y continuar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
