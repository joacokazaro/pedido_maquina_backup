import prisma from "../db/prisma.js";
import { legacyHeaderEnabled } from "../middlewares/authenticate.js";
import { userHasAnyRole } from "./roles.service.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

// Con sesión firmada (req.auth, puesta por el middleware `authenticate`) el actor es SIEMPRE
// quien inició sesión. Los headers/body/query solo valen en modo transición (AUTH_LEGACY_HEADER).
function readActorUsername(req) {
  if (req.auth?.username) return req.auth.username;
  if (!legacyHeaderEnabled()) return "";

  return (
    normalizeText(req.headers["x-auth-username"]) ||
    normalizeText(req.headers["x-username"]) ||
    normalizeText(req.body?.actorUsername) ||
    normalizeText(req.query?.actorUsername)
  );
}

export async function requireActor(req, res, allowedRoles) {
  const username = readActorUsername(req);
  if (!username) {
    res.status(401).json({ error: "Falta identificar el usuario actor" });
    return null;
  }

  const actor = await prisma.usuario.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      nombre: true,
      rol: true,
      roles: { select: { rol: true } },
      activo: true,
    },
  });

  if (!actor || !actor.activo) {
    res.status(403).json({ error: "Usuario actor inválido o inactivo" });
    return null;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !userHasAnyRole(actor, allowedRoles)) {
    res.status(403).json({ error: "No autorizado" });
    return null;
  }

  return actor;
}