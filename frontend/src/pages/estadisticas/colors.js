// Mismos valores hex que el grupo `viz.*` de tailwind.config.js (los charts de
// Recharts necesitan el hex literal para el prop `fill`, no una clase Tailwind).
// Mapeo fijo por dominio, nunca cíclico, para que un estado sea siempre el
// mismo color en toda la página.
export const VIZ = {
  good: "#0ca30c",
  warning: "#d97706",
  critical: "#dc2626",
  s1: "#2a78d6",
  s2: "#eb6834",
  s3: "#1baf7a",
  s4: "#eda100",
  s5: "#e87ba4",
  s6: "#008300",
  s7: "#4a3aa7",
  s8: "#e34948",
};

export const COLOR_ESTADO_PEDIDO = {
  PENDIENTE_PREPARACION: VIZ.s1,
  PREPARADO: VIZ.s2,
  ENTREGADO: VIZ.s3,
  PENDIENTE_CONFIRMACION: VIZ.s4,
  PENDIENTE_CONFIRMACION_FALTANTES: VIZ.s5,
  ENTREGA_CONFIRMADA: VIZ.s6,
  PENDIENTE_CANCELACION: VIZ.s7,
};

export const LABEL_ESTADO_PEDIDO = {
  PENDIENTE_PREPARACION: "Pend. preparación",
  PREPARADO: "Preparado",
  ENTREGADO: "Entregado",
  PENDIENTE_CONFIRMACION: "Pend. confirmación",
  PENDIENTE_CONFIRMACION_FALTANTES: "Pend. confirm. (faltantes)",
  ENTREGA_CONFIRMADA: "Entrega confirmada",
  PENDIENTE_CANCELACION: "Pend. cancelación",
};

export const COLOR_ESTADO_MAQUINA = {
  disponible: VIZ.s3,
  asignada: VIZ.s1,
  no_devuelta: VIZ.s4,
  fuera_servicio: VIZ.s5,
  taller: VIZ.s7,
  baja: VIZ.s8,
};

export const LABEL_ESTADO_MAQUINA = {
  disponible: "Disponible",
  asignada: "Asignada",
  no_devuelta: "No devuelta",
  fuera_servicio: "Fuera de servicio",
  taller: "En taller",
  baja: "Baja",
};

export const COLOR_SEMAFORO = { rojo: VIZ.critical, amarillo: VIZ.warning };
