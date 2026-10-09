import { SignJWT, jwtVerify } from "jose";

// Sesión propia de la app, emitida SOLO después de verificar el token de Kazaró 360
// (o, durante la transición, la contraseña local). Firmada con un secreto del servidor:
// a diferencia del viejo `username-timestamp`, nadie puede fabricarla sin ese secreto.
const ISSUER = "pedido-maquina";
const AUDIENCE = "pedido-maquina-app";
// 30 días por defecto: antes la sesión de la app no vencía nunca y el personal de campo la usa desde el celular.
const TTL = process.env.SESSION_TTL || "30d";

let cachedSecret = null;

function getSecret() {
  if (cachedSecret) return cachedSecret;

  const raw = process.env.SESSION_JWT_SECRET;
  if (raw && raw.length >= 32) {
    cachedSecret = new TextEncoder().encode(raw);
    return cachedSecret;
  }

  // Sin fallback "temporal": el servidor de producción NO define NODE_ENV, y un secreto
  // efímero invalidaría todas las sesiones en cada reinicio de PM2 sin avisar.
  throw new Error("Falta SESSION_JWT_SECRET (mínimo 32 caracteres) en backend/.env");
}

// Falla al arrancar (en vez de en el primer login) si producción no tiene el secreto.
export function assertSessionConfig() {
  getSecret();
}

export async function signSessionToken(user) {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(getSecret());
}

export async function verifySessionToken(token) {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
  });

  const username = String(payload.username || "").trim();
  if (!username) throw new Error("Token de sesión sin username");

  return { username, userId: Number(payload.sub) || null };
}
