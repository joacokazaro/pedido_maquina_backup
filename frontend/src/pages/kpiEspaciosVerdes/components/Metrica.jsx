import { useEffect, useRef, useState } from "react";
import { formatNumero } from "../formato";

function prefiereMenosMovimiento() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

/**
 * Cuenta desde 0 hasta `valor` al montar. Lo que vive en el estado es el
 * **progreso** (0 a 1), no el número: así el estado solo se toca dentro del
 * `requestAnimationFrame` y nunca de forma sincrónica dentro del efecto, que
 * dispararía renders en cascada.
 *
 * Respeta `prefers-reduced-motion`: si el usuario pidió menos movimiento, el
 * progreso arranca en 1 y el número aparece directo en su valor final.
 */
function useConteo(valor, activo = true, duracion = 900) {
  const [progreso, setProgreso] = useState(() => (activo && !prefiereMenosMovimiento() ? 0 : 1));
  const rafRef = useRef(0);

  useEffect(() => {
    if (!activo || !Number.isFinite(valor) || prefiereMenosMovimiento()) return undefined;

    const inicio = performance.now();
    const paso = (ahora) => {
      const avance = Math.min(1, (ahora - inicio) / duracion);
      // easeOutCubic: arranca rápido y frena, que es como se lee un contador.
      setProgreso(1 - (1 - avance) ** 3);
      if (avance < 1) rafRef.current = requestAnimationFrame(paso);
    };
    rafRef.current = requestAnimationFrame(paso);

    return () => cancelAnimationFrame(rafRef.current);
  }, [valor, activo, duracion]);

  return Number.isFinite(valor) ? valor * progreso : valor;
}

const TONOS = {
  navy: "text-kazaro-navy",
  blue: "text-kazaro-blue",
  green: "text-emerald-700",
  amber: "text-amber-700",
  slate: "text-slate-600",
};

/** Número destacado con su etiqueta. `decimales` fuerza la precisión. */
export default function Metrica({ valor, unidad, etiqueta, ayuda, tono = "navy", decimales, animar = true, tamano = "normal" }) {
  const mostrado = useConteo(Number(valor), animar && Number.isFinite(Number(valor)));
  const hayDato = valor !== null && valor !== undefined && Number.isFinite(Number(valor));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-kazaro-sky hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</p>
      <p
        className={`mt-1 font-display font-extrabold tabular-nums ${TONOS[tono] || TONOS.navy} ${
          tamano === "grande" ? "text-3xl sm:text-4xl" : "text-2xl"
        }`}
      >
        {hayDato ? formatNumero(mostrado, decimales) : "—"}
        {unidad ? <span className="ml-1 text-sm font-bold text-slate-400">{unidad}</span> : null}
      </p>
      {ayuda ? <p className="mt-1 text-xs leading-snug text-slate-500">{ayuda}</p> : null}
    </div>
  );
}
