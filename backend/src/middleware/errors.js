export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error instanceof ApiError ? error.status : 500;
  let code = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
  let message = error instanceof ApiError ? error.message : "Request could not be completed.";
  if (error.type === "entity.parse.failed") { status = 400; code = "INVALID_JSON"; message = "Invalid JSON body."; }
  if (error.type === "entity.too.large") { status = 413; code = "PAYLOAD_TOO_LARGE"; message = "Request body exceeds 64 KB."; }
  if (error.code === "P2002") { status = 409; code = "CONFLICT"; message = "Record already exists."; }
  if (["P1001", "P1002", "P1017"].includes(error.code)) { status = 503; code = "DATABASE_UNAVAILABLE"; message = "Database is unavailable."; }
  res.status(status).json({ ok: false, error: { code, message } });
}
