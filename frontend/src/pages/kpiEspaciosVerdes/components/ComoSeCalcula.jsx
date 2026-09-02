/**
 * Bloque "cómo se calcula" que acompaña a cada KPI. Va siempre visible y no
 * plegado: un indicador cuyo cálculo hay que adivinar no se usa para decidir.
 *
 * `formula` es la cuenta en una línea; `notas` son las salvedades que cambian
 * la lectura del número (qué queda afuera, qué supuesto se está haciendo).
 */
export default function ComoSeCalcula({ formula, notas = [], fuente }) {
  return (
    <section className="rounded-2xl border border-kazaro-ice bg-kazaro-mist/70 p-4 sm:p-6">
      <h4 className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-kazaro-deep">
        <svg className="h-4 w-4 text-kazaro-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 8h8M8 12h5M8 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Cómo se calcula
      </h4>

      <p className="mt-3 rounded-xl border border-kazaro-ice bg-white px-4 py-3 text-center font-display text-sm font-bold text-kazaro-navy sm:text-base">
        {formula}
      </p>

      {notas.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {notas.map((nota, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-600">
              <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-kazaro-sky" />
              <span>{nota}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {fuente ? (
        <p className="mt-3 border-t border-kazaro-ice pt-2.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">Fuente del dato:</span> {fuente}
        </p>
      ) : null}
    </section>
  );
}
