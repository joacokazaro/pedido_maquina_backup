import { createRemoteJWKSet, jwtVerify } from "jose";

const SUPABASE_URL = (process.env.KAZARO_360_SUPABASE_URL || "https://qyksgoutbbjnegiiqmhz.supabase.co").replace(/\/$/, "");
const ISSUER = `${SUPABASE_URL}/auth/v1`;

const jwks = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

// Verifica un access_token emitido por Supabase Auth de Kazaró 360 (firma real contra las
// claves públicas del proyecto, vía JWKS) y devuelve el email de la sesión. No requiere
// ningún secreto compartido: la verificación es contra la clave pública del proyecto.
export async function verifyToken360(token) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience: "authenticated",
  });

  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) {
    throw new Error("El token de Kazaró 360 no trae un email válido");
  }

  return { email };
}
