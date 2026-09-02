import { useEffect, useState } from "react";

const CONSULTA = "(max-width: 700px)";

/**
 * `true` en pantallas angostas.
 *
 * Los gráficos de barras horizontales reservan ~170px para el eje de
 * categorías y hasta 130px de margen derecho para las etiquetas de valor. En
 * un celular eso se come todo el ancho y el área de dibujo queda en casi cero:
 * las barras se calculan bien pero se dibujan de 0px y el gráfico parece
 * vacío. Con esto se achican esas reservas cuando no hay lugar.
 */
export default function useEsAngosto() {
  const [angosto, setAngosto] = useState(() => window.matchMedia?.(CONSULTA)?.matches ?? false);

  useEffect(() => {
    const mq = window.matchMedia?.(CONSULTA);
    if (!mq) return undefined;

    const alCambiar = (e) => setAngosto(e.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);

  return angosto;
}
