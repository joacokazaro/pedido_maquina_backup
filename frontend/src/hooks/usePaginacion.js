import { useEffect, useMemo, useState } from "react";

export const TAMANOS_PAGINA = [10, 25, 50, 100];

/**
 * Pagina una lista en memoria.
 * `reinicio`: dependencias (filtros, búsqueda) que al cambiar vuelven a la página 1.
 */
export function usePaginacion(items, { tamanoInicial = 25, reinicio = [] } = {}) {
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(tamanoInicial);

  useEffect(() => {
    setPagina(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, reinicio);

  const total = items.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const paginaActual = Math.min(pagina, totalPaginas);

  const visibles = useMemo(
    () => items.slice((paginaActual - 1) * tamano, paginaActual * tamano),
    [items, paginaActual, tamano]
  );

  function cambiarTamano(nuevoTamano) {
    setTamano(nuevoTamano);
    setPagina(1);
  }

  return {
    visibles,
    pagina: paginaActual,
    totalPaginas,
    tamano,
    total,
    irAPagina: setPagina,
    cambiarTamano,
  };
}
