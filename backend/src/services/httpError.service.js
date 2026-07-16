export function buildError(message, status = 400, payload = null) {
  const error = new Error(message);
  error.status = status;
  if (payload) error.payload = payload;
  return error;
}

export function respondWithError(res, error, fallbackMessage, fallbackStatus = 500) {
  const status = error?.status || fallbackStatus;
  const payload = error?.payload || null;

  console.error(fallbackMessage, error);
  return res.status(status).json({
    error: error?.message || fallbackMessage,
    ...(payload ? payload : {}),
  });
}
