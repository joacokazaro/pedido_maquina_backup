export function buildActorHeaders(user) {
  const username = String(user?.username || "").trim();
  if (!username) return {};
  return { "x-auth-username": username };
}