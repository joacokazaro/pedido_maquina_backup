import { createRemoteJWKSet, jwtVerify } from "jose";
import { ROLES_VALIDOS, ROLE_LABELS } from "./roles.service.js";

const SUPABASE_URL = (process.env.KAZARO_360_SUPABASE_URL || "https://qyksgoutbbjnegiiqmhz.supabase.co").replace(/\/$/, "");
const ISSUER = `${SUPABASE_URL}/auth/v1`;

// "Publishable key" de Kazaró 360 (la misma que ya está en supabase-client.js del frontend de
// 360): es pública y por sí sola no da acceso a nada, el acceso real lo da el JWT del usuario + RLS.
const SUPABASE_PUBLISHABLE_KEY =
  process.env.KAZARO_360_SUPABASE_KEY || "sb_publishable_ipwcIx3U3aKCSUf6hHXE8g_63fGqUsc";

// id de esta app en identidad.proyectos
export const PROYECTO_360 = process.env.KAZARO_360_PROYECTO_ID || "app_maquinas";

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

/* ========================================================
   PERMISOS DESDE 360
   El rol en esta app sale de identidad.accesos (proyecto PROYECTO_360), que se administra
   desde el Panel Administrador de Kazaró 360. Se consulta con el JWT del propio usuario:
   la RLS de 360 solo le deja ver sus filas, así que no hace falta ninguna clave privada.
======================================================== */

function normalizarEtiqueta(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Los nombres de rol que se cargan en identidad.roles_proyecto (ver app_maquinas/roles_360.sql
// en el repo de 360) son las etiquetas de ROLE_LABELS, más la única combinación permitida.
// "Administrador" es el nombre que 360 le da a ese rol en TODOS sus proyectos (ROLE_LABELS dice "Admin").
const ROL_360_A_APP = new Map([
  ...ROLES_VALIDOS.map((rol) => [normalizarEtiqueta(ROLE_LABELS[rol]), [rol]]),
  [normalizarEtiqueta("Administrador"), ["admin"]],
  [normalizarEtiqueta("Depósito y Taller"), ["deposito", "taller"]],
]);

// "Usuario" es el rol genérico que 360 siembra en todo proyecto (y con el que ya se dio acceso a la
// tarjeta): significa "puede entrar" pero NO dice qué rol tiene en la app. Para esas cuentas el rol
// es el que ya tienen en la app (ver loginCon360); no se pisa nada.
export function esRolGenerico360(rol360) {
  return normalizarEtiqueta(rol360) === "usuario";
}

export function rolesAppDesdeRol360(rol360) {
  return ROL_360_A_APP.get(normalizarEtiqueta(rol360)) || null;
}

async function consultarIdentidad(token, tabla, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?${query}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Accept-Profile": "identidad",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Kazaró 360 respondió ${res.status} al consultar ${tabla}`);
  }
  return res.json();
}

// Devuelve { rol360, rolesApp, generico, nombre, legajo } o null si la cuenta no tiene acceso a esta app.
// Lanza si 360 no responde: el login falla cerrado, nunca se asume un rol.
export async function leerAcceso360(token) {
  const [accesos, perfiles] = await Promise.all([
    consultarIdentidad(token, "accesos", `select=rol&proyecto_id=eq.${encodeURIComponent(PROYECTO_360)}`),
    consultarIdentidad(token, "perfiles", "select=nombre,legajo&limit=1"),
  ]);

  const rol360 = accesos?.[0]?.rol;
  if (!rol360) return null;

  const perfil = perfiles?.[0] || {};
  return {
    rol360,
    rolesApp: rolesAppDesdeRol360(rol360),
    generico: esRolGenerico360(rol360),
    nombre: perfil.nombre || null,
    legajo: perfil.legajo || null,
  };
}
