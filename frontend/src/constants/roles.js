// Roles del sistema (en MAYÚSCULAS, como los normaliza el backend/AuthContext).
//
// "ENCARGADO_EV" es el rename directo del ex-rol "SUPERVISOR": mismas funcionalidades.
// "SUPERVISOR_LIMPIEZA" hereda TODO lo del encargado y además puede crear pedidos para
// eventuales asignados a él (única diferencia, gestionada en el backend/CreatePedido).
export const ROLES_SUPERVISION = ["ENCARGADO_EV", "SUPERVISOR_LIMPIEZA"];

// Roles que pueden crear/operar pedidos como TITULAR (reciben las máquinas a su nombre):
// los supervisores y, además, el coordinador, que puede pedir a su propio nombre como
// "un supervisor más". El coordinador NO es supervisor_limpieza (no pide para eventuales).
export const ROLES_PEDIDO_TITULAR = [...ROLES_SUPERVISION, "COORDINADOR"];

// Etiquetas legibles para los ABM de usuarios y pantallas que muestren el rol.
export const ROLE_LABELS = {
  ADMIN: "Admin",
  COORDINADOR: "Coordinador",
  CONSULTOR: "Consultor",
  TALLER: "Taller",
  DEPOSITO: "Depósito",
  ENCARGADO_EV: "Encargado EV",
  SUPERVISOR_LIMPIEZA: "Supervisor Limpieza",
};

export function roleLabel(role) {
  const key = String(role || "").toUpperCase();
  return ROLE_LABELS[key] || key;
}
