export function notFound(_req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(error, _req, res, _next) {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the 32kb limit" } });
  }
  if (error instanceof SyntaxError && error?.status === 400 && "body" in error) {
    return res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ error: { code: "INVALID_DATA", message: "Invalid data" } });
  }
  console.error("Unhandled API error:", error?.message || error);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
}
