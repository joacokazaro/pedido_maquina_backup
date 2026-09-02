import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carrusel de KPIs. Todas las slides se montan siempre y se desplazan con
 * `translateX` en vez de renderizarse condicionalmente: los `ResponsiveContainer`
 * de Recharts miden 0px de ancho si su contenedor está oculto con `display:none`,
 * y los gráficos saldrían vacíos al llegar a la slide.
 *
 * `slides` es [{ clave, titulo, resumen, contenido }].
 */
export default function Carrusel({ slides }) {
  const [indice, setIndice] = useState(0);
  const total = slides.length;
  const contenedorRef = useRef(null);
  const gestoRef = useRef(null);

  const ir = useCallback(
    (destino) => setIndice(((destino % total) + total) % total),
    [total]
  );
  const anterior = useCallback(() => ir(indice - 1), [ir, indice]);
  const siguiente = useCallback(() => ir(indice + 1), [ir, indice]);

  // Flechas del teclado, salvo cuando el foco está en un campo de texto.
  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") siguiente();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anterior, siguiente]);

  // Swipe horizontal en touch. Solo cuenta si el gesto fue claramente
  // horizontal, para no robarle el scroll vertical a la página.
  function onTouchStart(e) {
    const t = e.touches[0];
    gestoRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e) {
    const inicio = gestoRef.current;
    if (!inicio) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - inicio.x;
    const dy = t.clientY - inicio.y;
    gestoRef.current = null;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) siguiente();
    else anterior();
  }

  const actual = slides[indice];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Acceso directo a cada KPI: con seis slides, ir de a una con las
          flechas es tedioso. */}
      <nav className="mb-4 flex flex-wrap items-center gap-1.5" aria-label="Indicadores">
        {slides.map((slide, i) => (
          <button
            key={slide.clave}
            type="button"
            onClick={() => ir(i)}
            aria-current={i === indice ? "true" : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              i === indice
                ? "bg-gradient-to-r from-kazaro-blue to-kazaro-cyan text-white shadow-md shadow-kazaro-cyan/25"
                : "bg-white text-slate-600 shadow-sm hover:bg-kazaro-ice hover:text-kazaro-deep"
            }`}
          >
            {slide.titulo}
          </button>
        ))}
      </nav>

      <div className="relative">
        {/* Flechas: por fuera del panel en pantallas anchas, flotantes encima
            cuando no hay margen lateral. */}
        <button
          type="button"
          onClick={anterior}
          aria-label={`Indicador anterior: ${slides[(indice - 1 + total) % total].titulo}`}
          className="absolute left-1 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2.5 text-kazaro-deep shadow-lg backdrop-blur transition hover:-translate-x-0.5 hover:border-kazaro-sky hover:text-kazaro-blue focus:outline-none focus:ring-2 focus:ring-kazaro-sky xl:-left-6"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={siguiente}
          aria-label={`Indicador siguiente: ${slides[(indice + 1) % total].titulo}`}
          className="absolute right-1 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-200 bg-white/95 p-2.5 text-kazaro-deep shadow-lg backdrop-blur transition hover:translate-x-0.5 hover:border-kazaro-sky hover:text-kazaro-blue focus:outline-none focus:ring-2 focus:ring-kazaro-sky xl:-right-6"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div
          ref={contenedorRef}
          className="overflow-hidden rounded-3xl"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* `items-stretch` + `h-full` en la tarjeta hacen que todas las slides
              midan lo mismo (lo que mide la más alta). Si cada una tomara su
              propio alto, las flechas —centradas sobre la pista— quedarían a
              media altura en una slide y colgando por debajo del contenido en
              las cortas. */}
          <div
            className="flex items-stretch transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${indice * 100}%)` }}
          >
            {slides.map((slide, i) => (
              <div
                key={slide.clave}
                className="w-full flex-none px-1"
                aria-hidden={i === indice ? undefined : "true"}
                // Las slides que no están a la vista quedan fuera del recorrido
                // por tabulador, pero siguen montadas para que midan bien.
                inert={i !== indice}
              >
                <article className="h-full rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:p-7">
                  <header className="mb-5 border-b border-slate-100 pb-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-kazaro-cyan">
                      Indicador {i + 1} de {total}
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-kazaro-navy sm:text-3xl">
                      {slide.titulo}
                    </h2>
                    {slide.resumen ? (
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{slide.resumen}</p>
                    ) : null}
                  </header>
                  {slide.contenido}
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Puntos de posición. */}
      <div className="mt-5 flex items-center justify-center gap-2.5">
        {slides.map((slide, i) => (
          <button
            key={slide.clave}
            type="button"
            onClick={() => ir(i)}
            aria-label={`Ir a ${slide.titulo}`}
            aria-current={i === indice ? "true" : undefined}
            className={`h-2.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-kazaro-sky focus:ring-offset-2 ${
              i === indice ? "w-8 bg-kazaro-blue" : "w-2.5 bg-slate-300 hover:bg-kazaro-sky"
            }`}
          />
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-slate-400">
        Navegá con las flechas ← → del teclado, deslizando, o tocando el nombre del indicador.
      </p>
      <p className="sr-only" aria-live="polite">
        Mostrando {actual.titulo}, indicador {indice + 1} de {total}.
      </p>
    </div>
  );
}
