export function readConfig(env = process.env) {
  if (!env.DATABASE_URL || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    throw new Error("DATABASE_URL must specify your PostgreSQL database.");
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT.");
  const origin = env.FRONTEND_ORIGIN ?? "http://localhost:8000";
  if (new URL(origin).origin !== origin) throw new Error("FRONTEND_ORIGIN must be an origin without a trailing slash.");
  const production = env.NODE_ENV === "production";
  if (production && !origin.startsWith("https://")) throw new Error("Production frontend requires HTTPS.");
  return { port, origin, secret: env.JWT_SECRET, production,
    demo: !production && env.ENABLE_DEMO_AUTH === "true", databaseUrl: env.DATABASE_URL };
}
