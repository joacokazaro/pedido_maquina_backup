import { useEffect, useMemo, useRef, useState } from "react";

/*
  Vista previa de los insumos que se van a importar (eventual o informe de
  servicio). Muestra cada pedido de la app de Insumos con sus ítems y deja
  elegir qué incluir, porque no siempre se factura todo lo pedido. Al confirmar
  devuelve las claves de los ítems elegidos ("<pedidoId>:<posición>"); el
  backend vuelve a consultar la API y se queda solo con esas.
*/

function formatMonto(valor) {
  return (Number(valor) || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function seleccionInicial(pedidos) {
  return new Set(pedidos.flatMap((p) => p.items.filter((it) => it.seleccionado !== false).map((it) => it.clave)));
}

function abiertosIniciales(pedidos) {
  const cantidadItems = pedidos.reduce((acc, p) => acc + p.items.length, 0);
  return cantidadItems <= 30 ? new Set(pedidos.map((p) => p.pedidoId)) : new Set();
}

function Checkbox({ checked, indeterminate = false, onChange, label, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-kazaro-blue ${className}`}
    />
  );
}

export default function SeleccionInsumosModal({ open, cargando, error, vista, importando, onCancel, onConfirm }) {
  const pedidos = useMemo(() => (Array.isArray(vista?.pedidos) ? vista.pedidos : []), [vista]);
  const todasLasClaves = useMemo(() => pedidos.flatMap((p) => p.items.map((it) => it.clave)), [pedidos]);
  const subtotalPorClave = useMemo(() => {
    const mapa = new Map();
    for (const p of pedidos) for (const it of p.items) mapa.set(it.clave, Number(it.subtotal) || 0);
    return mapa;
  }, [pedidos]);

  // Cada vista previa nueva arranca con lo que propone el backend (todo, o
  // lo que quedó incluido en la importación anterior). Con pocos ítems se
  // muestra todo desplegado. Se recalcula durante el render al cambiar la
  // vista (patrón "ajustar estado ante un cambio de props" de React).
  const [pedidosBase, setPedidosBase] = useState(pedidos);
  const [seleccion, setSeleccion] = useState(() => seleccionInicial(pedidos));
  const [abiertos, setAbiertos] = useState(() => abiertosIniciales(pedidos));
  if (pedidosBase !== pedidos) {
    setPedidosBase(pedidos);
    setSeleccion(seleccionInicial(pedidos));
    setAbiertos(abiertosIniciales(pedidos));
  }

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape" && !importando) onCancel?.();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, importando, onCancel]);

  if (!open) return null;

  const totalSeleccionado = [...seleccion].reduce((acc, clave) => acc + (subtotalPorClave.get(clave) || 0), 0);
  const todoSeleccionado = todasLasClaves.length > 0 && seleccion.size === todasLasClaves.length;
  const nadaSeleccionado = seleccion.size === 0;

  function alternar(claves, incluir) {
    setSeleccion((prev) => {
      const siguiente = new Set(prev);
      for (const clave of claves) {
        if (incluir) siguiente.add(clave);
        else siguiente.delete(clave);
      }
      return siguiente;
    });
  }

  function alternarAbierto(pedidoId) {
    setAbiertos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(pedidoId)) siguiente.delete(pedidoId);
      else siguiente.add(pedidoId);
      return siguiente;
    });
  }

  const sinServicio = vista && !vista.servicioIds?.length;
  const sinPedidos = vista && vista.servicioIds?.length > 0 && pedidos.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seleccion-insumos-titulo"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <header className="border-b border-gray-100 px-5 py-4">
          <h3 id="seleccion-insumos-titulo" className="text-lg font-semibold text-kazaro-navy">
            Elegí qué insumos incluir
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Estos son los pedidos de la app de Insumos para el servicio{" "}
            <b className="text-gray-700">{vista?.servicioNombre || "…"}</b>
            {vista?.desde && vista?.hasta ? ` entre ${vista.desde} y ${vista.hasta}` : ""}. Destildá lo que no se
            factura; solo lo tildado queda en el informe y en el PDF.
          </p>
          {vista?.importacionAnterior ? (
            <p className="mt-1 text-xs text-amber-700">
              Ya hay una importación anterior: vienen destildados los ítems que esa vez se excluyeron. Al confirmar se
              reemplaza.
            </p>
          ) : null}
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cargando ? (
            <p className="py-8 text-center text-sm text-gray-500">Consultando la app de Insumos…</p>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>
          ) : sinServicio ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No se encontró ningún servicio con nombre "{vista.servicioNombre}" en la plataforma de insumos. Podés
              confirmar igual para dejar registrado que no hay insumos, o revisar que el nombre coincida exactamente.
            </p>
          ) : sinPedidos ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              El servicio existe en la plataforma de insumos pero no tiene pedidos
              {vista?.desde ? " en el período" : ""}.
            </p>
          ) : vista ? (
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-kazaro-blue/30 bg-kazaro-ice/60 px-3 py-2.5">
                <Checkbox
                  checked={todoSeleccionado}
                  indeterminate={!todoSeleccionado && !nadaSeleccionado}
                  onChange={() => alternar(todasLasClaves, !todoSeleccionado)}
                  label="Incluir todo"
                />
                <span className="text-sm font-semibold text-kazaro-navy">Incluir todo</span>
                <span className="ml-auto text-xs text-gray-600">
                  {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"} · {todasLasClaves.length} ítem
                  {todasLasClaves.length === 1 ? "" : "s"} · {formatMonto(vista.total)}
                </span>
              </label>

              {pedidos.map((pedido) => {
                const claves = pedido.items.map((it) => it.clave);
                const elegidos = claves.filter((c) => seleccion.has(c));
                const completo = claves.length > 0 && elegidos.length === claves.length;
                const abierto = abiertos.has(pedido.pedidoId);
                const totalElegido = elegidos.reduce((acc, c) => acc + (subtotalPorClave.get(c) || 0), 0);

                return (
                  <div key={pedido.pedidoId} className="rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <Checkbox
                        checked={completo}
                        indeterminate={elegidos.length > 0 && !completo}
                        onChange={() => alternar(claves, !completo)}
                        label={`Incluir el pedido ${pedido.numero}`}
                      />
                      <button
                        type="button"
                        onClick={() => alternarAbierto(pedido.pedidoId)}
                        aria-expanded={abierto}
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 text-left"
                      >
                        <span className="text-sm font-semibold text-gray-900">Pedido {pedido.numero}</span>
                        <span className="text-xs text-gray-500">
                          {pedido.fechaHoraArgentina}
                          {pedido.solicitante ? ` · ${pedido.solicitante}` : ""}
                          {pedido.estado ? ` · ${pedido.estado}` : ""}
                        </span>
                        {pedido.nota ? <span className="w-full truncate text-xs italic text-gray-500">{pedido.nota}</span> : null}
                      </button>
                      <span className="whitespace-nowrap text-right text-sm">
                        <b className="text-gray-900">{formatMonto(totalElegido)}</b>
                        {!completo ? <span className="block text-[11px] text-gray-400">de {formatMonto(pedido.total)}</span> : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => alternarAbierto(pedido.pedidoId)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-kazaro-blue hover:bg-kazaro-mist"
                      >
                        {abierto ? "Ocultar" : `Ver ${claves.length} ítem${claves.length === 1 ? "" : "s"}`}
                      </button>
                    </div>

                    {abierto ? (
                      <ul className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50/60">
                        {pedido.items.map((item) => (
                          <li key={item.clave}>
                            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 pl-9">
                              <Checkbox
                                checked={seleccion.has(item.clave)}
                                onChange={(e) => alternar([item.clave], e.target.checked)}
                                label={`Incluir ${item.insumo}`}
                              />
                              <span
                                className={`min-w-0 flex-1 text-sm ${seleccion.has(item.clave) ? "text-gray-800" : "text-gray-400 line-through"}`}
                              >
                                {item.insumo}
                                {item.codigo ? <span className="ml-1 text-[11px] text-gray-400">({item.codigo})</span> : null}
                              </span>
                              <span className="whitespace-nowrap text-xs text-gray-500">
                                {item.cantidad} × {formatMonto(item.precioUnitario)}
                              </span>
                              <span className="w-28 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                                {formatMonto(item.subtotal)}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-kazaro-mist px-5 py-3">
          <div className="text-sm">
            {vista && !cargando && !error ? (
              <>
                <span className="text-gray-500">Se incluye: </span>
                <b className="text-kazaro-navy">{formatMonto(totalSeleccionado)}</b>
                <span className="text-gray-500">
                  {" "}
                  ({seleccion.size} de {todasLasClaves.length} ítem{todasLasClaves.length === 1 ? "" : "s"})
                </span>
              </>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={importando}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm?.([...seleccion])}
              disabled={!vista || cargando || Boolean(error) || importando}
              className="rounded-lg bg-kazaro-blue px-4 py-2 text-sm font-semibold text-white hover:bg-kazaro-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importando
                ? "Importando…"
                : todasLasClaves.length === 0
                  ? "Confirmar sin insumos"
                  : todoSeleccionado
                    ? "Importar todo"
                    : nadaSeleccionado
                      ? "Importar sin insumos"
                      : "Importar lo seleccionado"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
