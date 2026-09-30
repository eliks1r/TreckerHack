import { ApiError } from "./errors.js";
export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(new ApiError(400, "VALIDATION_ERROR", "Invalid request: " + parsed.error.issues.map(i => `${i.path.join(".") || "body"}: ${i.message}`).join("; ")));
    req.body = parsed.data;
    next();
  };
}
