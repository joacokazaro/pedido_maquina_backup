// src/services/http.js
import { API_BASE } from "./apiBase";

async function parseError(res) {
  const data = await res.json().catch(() => ({}));
  return data?.error || data?.message || `HTTP ${res.status}`;
}

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res;
}

export async function apiGet(path) {
  const res = await apiFetch(path);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json().catch(() => ({}));
}

export async function apiPut(path, body) {
  const res = await apiFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json().catch(() => ({}));
}

export async function apiDelete(path) {
  const res = await apiFetch(path, { method: "DELETE" });
  return res.json().catch(() => ({}));
}
