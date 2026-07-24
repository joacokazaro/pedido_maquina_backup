import { matchPath } from "react-router-dom";

/**
 * Árbol de navegación de la app: mapea el patrón de cada ruta con su ruta
 * "padre" (el nivel de arriba al que debe llevar el botón "Volver").
 *
 * Motivación: `navigate(-1)` vuelve a la última URL del historial del
 * navegador, lo que depende de cómo llegaste y puede dejarte rebotando entre
 * dos pantallas (A → B → A → B). Subir por este árbol da un destino
 * determinístico: "Volver" siempre lleva al padre lógico de la pantalla.
 *
 * Para agregar una pantalla nueva: sumá una línea `"<patrón>": "<padre>"`.
 * Los `:param` del padre se completan con los valores de la ruta actual
 * (ej. estando en `/admin/eventuales/5/completar`, el padre
 * `/admin/eventuales/:id` se resuelve a `/admin/eventuales/5`).
 */
const MAPA_PADRES = {
  // ---- Supervisor ----
  "/supervisor/pedidos": "/supervisor",
  "/supervisor/maquinas": "/supervisor",
  "/supervisor/vehiculos": "/supervisor",
  "/supervisor/prestamos": "/supervisor",
  "/supervisor/eventuales": "/supervisor",
  "/supervisor/maquinas/:id": "/supervisor/maquinas",
  "/supervisor/eventuales/:id": "/supervisor/eventuales",
  "/supervisor/pedido/nuevo": "/supervisor/pedidos",
  "/supervisor/pedido/:id": "/supervisor/pedidos",
  "/supervisor/pedido/:id/devolucion": "/supervisor/pedido/:id",
  "/supervisor/prestamo/:id": "/supervisor/prestamos",
  "/supervisor/prestamo/:id/asignar": "/supervisor/prestamo/:id",
  "/supervisor/prestamo/:id/confirmar": "/supervisor/prestamo/:id",

  // ---- Depósito ----
  "/deposito/pedidos": "/deposito",
  "/deposito/maquinas": "/deposito",
  "/deposito/servicios": "/deposito",
  "/deposito/supervisores": "/deposito",
  "/deposito/servicios/:id": "/deposito/servicios",
  "/deposito/pedido/:id": "/deposito/pedidos",
  "/deposito/pedido/:id/asignar": "/deposito/pedido/:id",
  "/deposito/pedido/:id/confirmar": "/deposito/pedido/:id",

  // ---- Admin ----
  "/admin/pedidos": "/admin",
  "/admin/pedido/:id": "/admin/pedidos",
  "/admin/usuarios": "/admin",
  "/admin/usuarios/nuevo": "/admin/usuarios",
  "/admin/usuarios/:username": "/admin/usuarios",
  "/admin/supervisores-servicios": "/admin",
  "/admin/seguros": "/admin",
  "/admin/taller": "/admin",

  // Máquinas
  "/admin/maquinas": "/admin",
  "/admin/maquinas/amortizaciones": "/admin/maquinas",
  "/admin/maquinas/nueva": "/admin/maquinas",
  "/admin/maquinas/tipos": "/admin/maquinas",
  "/admin/plazos-amortizacion": "/admin/maquinas",
  "/admin/maquinas/:id/pedidos-historicos": "/admin/maquinas/:id",
  "/admin/maquinas/:id": "/admin/maquinas",

  // Vehículos
  "/admin/vehiculos": "/admin",
  "/admin/vehiculos/nuevo": "/admin/vehiculos",
  "/admin/vehiculos/importar": "/admin/vehiculos",
  "/admin/vehiculos/asignaciones": "/admin/vehiculos",
  "/admin/vehiculos/:id/historial": "/admin/vehiculos/:id",
  "/admin/vehiculos/:id": "/admin/vehiculos",

  // Servicios
  "/admin/servicios": "/admin",
  "/admin/servicios/nuevo": "/admin/servicios",
  "/admin/servicios/importar": "/admin/servicios",
  "/admin/servicios/:id": "/admin/servicios",

  // Eventuales
  "/admin/eventuales": "/admin",
  "/admin/eventuales/historial": "/admin/eventuales",
  "/admin/eventuales/nuevo": "/admin/eventuales",
  "/admin/eventuales/:id": "/admin/eventuales",
  "/admin/eventuales/:id/completar": "/admin/eventuales/:id",
  "/admin/eventuales/:id/corregir": "/admin/eventuales/:id",
  "/admin/eventuales/:id/finalizar": "/admin/eventuales/:id",
};

// Precomputamos los candidatos ordenados de más específico a menos específico:
// primero los patrones con menos `:param` (los estáticos ganan a los dinámicos,
// p. ej. `/supervisor/pedido/nuevo` antes que `/supervisor/pedido/:id`), y a
// igual cantidad de params, los de más segmentos primero.
const CANDIDATOS = Object.entries(MAPA_PADRES)
  .map(([patron, padre]) => ({
    patron,
    padre,
    params: (patron.match(/:/g) || []).length,
    segmentos: patron.split("/").filter(Boolean).length,
  }))
  .sort((a, b) => a.params - b.params || b.segmentos - a.segmentos);

/**
 * Devuelve la ruta padre de `pathname` según el árbol, con los `:param`
 * completados, o `null` si la ruta no está mapeada.
 */
export function resolverRutaPadre(pathname) {
  for (const candidato of CANDIDATOS) {
    const match = matchPath({ path: candidato.patron, end: true }, pathname);
    if (!match) continue;

    let padre = candidato.padre;
    const params = match.params || {};
    for (const [clave, valor] of Object.entries(params)) {
      if (valor != null) padre = padre.replace(`:${clave}`, valor);
    }
    return padre;
  }
  return null;
}
