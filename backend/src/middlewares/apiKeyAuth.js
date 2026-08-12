function parseTokens(raw) {
  return String(raw || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function apiKeyAuth(req, res, next) {
  const tokensValidos = parseTokens(process.env.EXTERNAL_API_TOKENS);
  const provisto = req.headers["x-api-key"];

  if (!provisto || !tokensValidos.includes(provisto)) {
    return res.status(401).json({ error: "API key inválida o faltante" });
  }

  next();
}
