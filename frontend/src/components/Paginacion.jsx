import { TAMANOS_PAGINA } from "../hooks/usePaginacion";

function numerosVisibles(pagina, totalPaginas) {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  }

  const numeros = [1];
  const desde = Math.max(2, pagina - 1);
  const hasta = Math.min(totalPaginas - 1, pagina + 1);

  if (desde > 2) numeros.push("...");
  for (let n = desde; n <= hasta; n += 1) numeros.push(n);
  if (hasta < totalPaginas - 1) numeros.push("...");
  numeros.push(totalPaginas);

  return numeros;
}

export default function Paginacion({
  pagina,
  totalPaginas,
  total,
  tamano,
  onPagina,
  onTamano,
  etiqueta = "resultados",
}) {
  if (total === 0) return null;

  const desde = (pagina - 1) * tamano + 1;
  const hasta = Math.min(total, pagina * tamano);

  function cambiarPagina(nueva) {
    if (nueva < 1 || nueva > totalPaginas || nueva === pagina) return;
    onPagina(nueva);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const btnBase =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold transition";
  const btnInactivo = `${btnBase} text-slate-600 hover:bg-kazaro-ice hover:text-kazaro-deep`;
  const btnActivo = `${btnBase} bg-gradient-to-r from-kazaro-blue to-kazaro-cyan text-white shadow-sm`;
  const btnBorde = `${btnBase} border border-slate-200 bg-white text-slate-600 hover:bg-kazaro-ice hover:text-kazaro-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600`;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow ring-1 ring-slate-200/80">
      <p className="text-xs text-slate-500">
        Mostrando <b className="text-slate-700">{desde}–{hasta}</b> de{" "}
        <b className="text-slate-700">{total}</b> {etiqueta}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={btnBorde}
          onClick={() => cambiarPagina(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
        >
          ‹
        </button>

        {numerosVisibles(pagina, totalPaginas).map((n, i) =>
          n === "..." ? (
            <span key={`dots-${i}`} className="px-1.5 text-sm text-slate-400">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={n === pagina ? btnActivo : btnInactivo}
              onClick={() => cambiarPagina(n)}
              aria-current={n === pagina ? "page" : undefined}
            >
              {n}
            </button>
          )
        )}

        <button
          type="button"
          className={btnBorde}
          onClick={() => cambiarPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Página siguiente"
        >
          ›
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-500">
        Ver de a
        <select
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-700 focus:border-kazaro-sky focus:outline-none"
          value={tamano}
          onChange={(e) => onTamano(Number(e.target.value))}
        >
          {TAMANOS_PAGINA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
