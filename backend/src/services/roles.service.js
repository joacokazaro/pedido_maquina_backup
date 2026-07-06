export const ROLES_VALIDOS = [
  "admin",
  "coordinador",
  "consultor",
  "taller",
  "deposito",
  "supervisor",
];

export function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ROLES_VALIDOS.includes(role) ? role : null;
}

export function normalizeRoles(values = []) {
  if (!Array.isArray(values)) return [];
  const normalized = values.map(normalizeRole).filter(Boolean);
  return Array.from(new Set(normalized));
}

export function isAllowedRoleCombination(roles = []) {
  const normalized = normalizeRoles(roles);
  if (normalized.length === 1) return true;
  if (normalized.length !== 2) return false;

  return normalized.includes("deposito") && normalized.includes("taller");
}

export function derivePrimaryRole(roles = [], fallbackRole = "supervisor") {
  const normalized = normalizeRoles(roles);
  if (normalized.length === 0) {
    return normalizeRole(fallbackRole) || "supervisor";
  }

  for (const role of ROLES_VALIDOS) {
    if (normalized.includes(role)) return role;
  }

  return normalized[0];
}

export function rolesFromUser(user) {
  const fromRelation = normalizeRoles((user?.roles || []).map((r) => r?.rol));
  if (fromRelation.length > 0) return fromRelation;

  const single = normalizeRole(user?.rol);
  return single ? [single] : [];
}

export function userHasRole(user, role) {
  const target = normalizeRole(role);
  if (!target) return false;
  return rolesFromUser(user).includes(target);
}

export function userHasAnyRole(user, roles = []) {
  const targets = normalizeRoles(roles);
  if (targets.length === 0) return false;
  const userRoles = rolesFromUser(user);
  return targets.some((role) => userRoles.includes(role));
}

export function whereHasRole(role) {
  const normalized = normalizeRole(role);
  if (!normalized) return { id: -1 };

  return {
    OR: [
      { rol: normalized },
      { roles: { some: { rol: normalized } } },
    ],
  };
}

export function whereHasAnyRole(roles = []) {
  const normalized = normalizeRoles(roles);
  if (normalized.length === 0) return { id: -1 };

  return {
    OR: [
      { rol: { in: normalized } },
      { roles: { some: { rol: { in: normalized } } } },
    ],
  };
}

export function buildUserRoleResponse(user) {
  const roles = rolesFromUser(user);
  const primary = derivePrimaryRole(roles, user?.rol);

  return {
    rol: String(primary || "").toUpperCase(),
    roles: roles.map((role) => role.toUpperCase()),
  };
}