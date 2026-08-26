import { API_BASE } from "./apiBase";

export async function loginRequest(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error("Credenciales inválidas");
  }

  return res.json();
}

export async function loginRequest360(token) {
  const res = await fetch(`${API_BASE}/auth/login-360`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "No se pudo iniciar sesión con Kazaró 360");
  }

  return data;
}
