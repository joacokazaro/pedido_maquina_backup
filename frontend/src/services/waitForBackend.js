const API_URL = import.meta.env.VITE_API_URL;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Espera a que el backend responda /health.
 * Reintenta varias veces para sobrevivir al cold start (503) de Render.
 */
export async function waitForBackend({
  retries = 10,
  delayMs = 2500,
} = {}) {
  let lastErr = null;

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
      if (res.ok) return true;

      // si responde pero no ok (503/502/etc), seguimos reintentando
      lastErr = new Error(`Backend respondió ${res.status}`);
    } catch (e) {
      lastErr = e;
    }

    await sleep(delayMs);
  }

  throw lastErr ?? new Error("Backend no disponible");
}
