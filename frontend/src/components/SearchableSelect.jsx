import { Children, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
  Reemplazo drop-in de <select>: mismo contrato (value, onChange con event.target.{name,value},
  disabled, className, hijos <option>), pero abre un panel con buscador para filtrar opciones
  escribiendo, sin scrollear listas largas.
*/

function textoDeNodo(node) {
  if (node === null || node === undefined || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textoDeNodo).join("");
  if (isValidElement(node)) return textoDeNodo(node.props.children);
  return "";
}

function aplanarOpciones(children, acumulado = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const label = textoDeNodo(child.props.children).trim();
      acumulado.push({
        value: child.props.value !== undefined ? String(child.props.value) : label,
        label,
        disabled: Boolean(child.props.disabled),
      });
      return;
    }
    if (child.props?.children) aplanarOpciones(child.props.children, acumulado);
  });
  return acumulado;
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function SearchableSelect({
  value,
  onChange,
  disabled = false,
  className = "",
  name,
  children,
  placeholder = "Buscar...",
  ...rest
}) {
  const opciones = useMemo(() => aplanarOpciones(children), [children]);

  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resaltada, setResaltada] = useState(0);
  const [posicion, setPosicion] = useState(null);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  const valorActual = value === undefined || value === null ? "" : String(value);
  const seleccionada = opciones.find((opcion) => opcion.value === valorActual) || null;

  const filtradas = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    if (!termino) return opciones;
    return opciones.filter((opcion) => normalizar(opcion.label).includes(termino));
  }, [opciones, busqueda]);

  function calcularPosicion() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const altoPanel = 300;
    const espacioAbajo = window.innerHeight - rect.bottom;
    const haciaArriba = espacioAbajo < altoPanel && rect.top > espacioAbajo;
    setPosicion({
      left: rect.left,
      width: rect.width,
      top: haciaArriba ? null : rect.bottom + 4,
      bottom: haciaArriba ? window.innerHeight - rect.top + 4 : null,
    });
  }

  function abrir() {
    if (disabled) return;
    setBusqueda("");
    setResaltada(Math.max(0, opciones.findIndex((opcion) => opcion.value === valorActual)));
    calcularPosicion();
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    triggerRef.current?.focus();
  }

  function elegir(opcion) {
    if (!opcion || opcion.disabled) return;
    setAbierto(false);
    triggerRef.current?.focus();
    if (opcion.value !== valorActual) {
      onChange?.({ target: { name, value: opcion.value } });
    }
  }

  useEffect(() => {
    if (!abierto) return undefined;

    inputRef.current?.focus();

    function onClickAfuera(event) {
      if (panelRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      setAbierto(false);
    }
    function onReposicionar() {
      calcularPosicion();
    }

    document.addEventListener("mousedown", onClickAfuera);
    window.addEventListener("resize", onReposicionar);
    window.addEventListener("scroll", onReposicionar, true);
    return () => {
      document.removeEventListener("mousedown", onClickAfuera);
      window.removeEventListener("resize", onReposicionar);
      window.removeEventListener("scroll", onReposicionar, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const item = panelRef.current?.querySelector(`[data-indice="${resaltada}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [resaltada, abierto]);

  function onTeclaTrigger(event) {
    if (disabled) return;
    if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      abrir();
    }
  }

  function onTeclaInput(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      cerrar();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setResaltada((prev) => Math.min(prev + 1, filtradas.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setResaltada((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      elegir(filtradas[resaltada] || filtradas[0]);
    }
  }

  return (
    <>
      <button
        {...rest}
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={onTeclaTrigger}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        className={`flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${seleccionada && seleccionada.value !== "" ? "" : "text-slate-400"}`}>
          {seleccionada ? seleccionada.label || " " : " "}
        </span>
        <svg
          className="h-4 w-4 flex-none text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {abierto && posicion
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[1300] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{
                left: posicion.left,
                width: Math.max(posicion.width, 180),
                top: posicion.top ?? "auto",
                bottom: posicion.bottom ?? "auto",
                maxHeight: 300,
              }}
            >
              <div className="border-b border-slate-100 p-2">
                <input
                  ref={inputRef}
                  value={busqueda}
                  onChange={(event) => {
                    setBusqueda(event.target.value);
                    setResaltada(0);
                  }}
                  onKeyDown={onTeclaInput}
                  placeholder={placeholder}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
                />
              </div>
              <div role="listbox" className="flex-1 overflow-y-auto p-1">
                {filtradas.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-slate-400">Sin resultados</p>
                ) : (
                  filtradas.map((opcion, indice) => {
                    const esSeleccionada = opcion.value === valorActual;
                    const esResaltada = indice === resaltada;
                    return (
                      <button
                        type="button"
                        key={`${opcion.value}-${indice}`}
                        data-indice={indice}
                        role="option"
                        aria-selected={esSeleccionada}
                        disabled={opcion.disabled}
                        onMouseEnter={() => setResaltada(indice)}
                        onClick={() => elegir(opcion)}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:text-slate-300 ${
                          esSeleccionada
                            ? "bg-blue-600 font-semibold text-white"
                            : esResaltada
                              ? "bg-blue-50 text-slate-800"
                              : "text-slate-700"
                        }`}
                      >
                        {opcion.label || " "}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
