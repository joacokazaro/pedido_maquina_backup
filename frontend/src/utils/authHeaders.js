export function buildActorHeaders(user) {
  const username = String(user?.username || "").trim();
  if (!username) return {};
  const roles = Array.isArray(user?.roles)
    ? user.roles.map((r) => String(r || "").toUpperCase()).filter(Boolean)
    : [];
  return {
    "x-auth-username": username,
    ...(roles.length ? { "x-auth-roles": roles.join(",") } : {}),
  };
}