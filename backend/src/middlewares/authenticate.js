import { verifySessionToken } from "../services/sessionToken.service.js";

// Mientras haya clientes viejos con sesión abierta (sin token firmado), se acepta el header
// `x-auth-username` como antes. Cuando todos hayan vuelto a entrar con Kazaró 360, poner
// AUTH_LEGACY_HEADER=false en backend/.env y reiniciar: desde ahí se exige token firmado.
export function legacyHeaderEnabled() {
  return String(process.env.AUTH_LEGACY_HEADER ?? "true").trim().toLowerCase() !== "false";
}

// Varios endpoints toman "quién hace la acción" del body (`usuario`, `actorUsername`).
// Con sesión firmada ese dato lo pone el servidor: lo que mande el navegador se pisa.
const CAMPOS_ACTOR_EN_BODY = ["usuario", "actorUsername"];

function forzarActorEnBody(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return;
  for (const campo of CAMPOS_ACTOR_EN_BODY) {
    if (campo in req.body) req.body[campo] = req.auth.username;
  }
}

// Si viene un Bearer, manda siempre (aunque también venga el header viejo): así un cliente
// nuevo nunca puede hacerse pasar por otro usuario. Un Bearer inválido NO cae al header.
export async function authenticate(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");

  if (match) {
    try {
      req.auth = await verifySessionToken(match[1].trim());
      forzarActorEnBody(req);
      return next();
    } catch {
      return res.status(401).json({ error: "Sesión inválida o vencida", code: "SESSION_INVALID" });
    }
  }

  if (legacyHeaderEnabled()) return next();

  return res.status(401).json({ error: "Falta iniciar sesión", code: "SESSION_REQUIRED" });
}
