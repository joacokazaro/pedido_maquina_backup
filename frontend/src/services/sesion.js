// src/services/sesion.js
//
// La sesión de la app es un token firmado que emite el backend al entrar con Kazaró 360
// (guardado dentro de `authUser`, en localStorage). Acá se engancha UNA vez en `fetch` para
// que toda llamada a la API lo lleve (Authorization: Bearer) sin tocar cada pantalla.
import { API_BASE } from "./apiBase";

const CLAVE_USUARIO = "authUser";
export const EVENTO_SESION_VENCIDA = "auth:expired";

export function leerTokenSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_USUARIO) || "null")?.sessionToken || null;
  } catch {
    return null;
  }
}

function urlDe(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input?.url || "";
}

// Solo las llamadas a NUESTRA api: el token nunca viaja a otros dominios (S3, Browix, etc.).
function esLlamadaApi(url) {
  if (!url) return false;
  if (url.startsWith(API_BASE)) return true;
  try {
    const abs = new URL(url, window.location.origin);
    const base = new URL(API_BASE, window.location.origin);
    return abs.origin === base.origin && abs.pathname.startsWith(base.pathname);
  } catch {
    return false;
  }
}

async function avisarSiVencio(res, teniaToken) {
  if (res.status !== 401 || !teniaToken) return;
  try {
    const data = await res.clone().json();
    if (data?.code === "SESSION_INVALID" || data?.code === "SESSION_REQUIRED") {
      window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
    }
  } catch {
    /* respuesta sin JSON: no es un aviso de sesión */
  }
}

let instalado = false;

export function instalarSesionEnFetch() {
  if (instalado) return;
  instalado = true;

  const fetchOriginal = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!esLlamadaApi(urlDe(input))) return fetchOriginal(input, init);

    const token = leerTokenSesion();
    if (!token) return fetchOriginal(input, init);

    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetchOriginal(input, { ...init, headers });
    await avisarSiVencio(res, true);
    return res;
  };
}

/* ------------------------------------------------------------------
   Descargas por link (<a href="/api/.../export">, window.location.href = ...):
   una navegación del navegador NO puede mandar el header Authorization, así que se
   interceptan y se bajan con fetch + blob. Cubre también cualquier link a la API que
   se agregue más adelante.
------------------------------------------------------------------ */
function nombreDeArchivo(res, url) {
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return decodeURIComponent(new URL(url, window.location.origin).pathname.split("/").pop() || "descarga");
}

export async function descargarArchivoApi(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `No se pudo descargar (HTTP ${res.status})`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = nombreDeArchivo(res, url);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

export function instalarDescargasConSesion() {
  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a || a.hasAttribute("download") || a.href.startsWith("blob:")) return;
      if (!esLlamadaApi(a.href)) return;

      e.preventDefault();
      descargarArchivoApi(a.href).catch((err) => window.alert(err.message || "No se pudo descargar el archivo"));
    },
    true
  );
}
