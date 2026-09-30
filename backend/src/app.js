import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { randomUUID, randomBytes } from "node:crypto";
import { ApiError, errorHandler } from "./middleware/errors.js";
import { validate } from "./middleware/validation.js";
import { loginSchema, registerSchema } from "./validation/auth.js";
import { workoutSchema } from "./validation/workout.js";
import { cookieName, cookieOptions, hashPassword, verifyPassword, establishSession, findSession, requireAuth } from "./services/auth.js";
import { saveWorkout } from "./services/workouts.js";
import { getProgress } from "./services/progress.js";
import { serializeUser } from "./serializers/user.js";
import { serializeWorkout, workoutInclude } from "./serializers/workout.js";

export function createApp({ db, config }) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    const origin = req.get("origin");
    if (origin && origin !== config.origin) return next(new ApiError(403, "ORIGIN_DENIED", "Origin is not allowed."));
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("sec-fetch-site") === "cross-site") {
      return next(new ApiError(403, "ORIGIN_DENIED", "Cross-site writes are not allowed."));
    }
    next();
  });
  app.use(cors({ origin: config.origin, credentials: true, methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] }));
  app.use(express.json({ limit: "64kb", type: "application/json" }));
  app.use(cookieParser());
  const auth = requireAuth(db, config);
  const success = (res, data, status = 200) => res.status(status).json({ ok: true, data });
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30,
    standardHeaders: "draft-8", legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ ok: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } }) });

  app.get("/api/health", async (req, res) => {
    try { await db.$queryRaw`SELECT 1`; success(res, { status: "healthy", database: "connected" }); }
    catch { throw new ApiError(503, "DATABASE_UNAVAILABLE", "Database is unavailable."); }
  });
  app.post("/api/auth/register", limiter, validate(registerSchema), async (req, res) => {
    const { name, email, password } = req.body;
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({ data: { displayName: name, email, passwordHash, progress: { create: {} } } });
    await establishSession(db, config, user, res);
    success(res, serializeUser(user), 201);
  });
  app.post("/api/auth/login", limiter, validate(loginSchema), async (req, res) => {
    const user = await db.user.findUnique({ where: { email: req.body.email } });
    // Do comparable hashing work even for unknown accounts.
    const stored = user?.passwordHash ?? `scrypt$32768$${"0".repeat(32)}$${"0".repeat(128)}`;
    const valid = await verifyPassword(req.body.password, stored);
    if (!user || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Неверный email или пароль.");
    await establishSession(db, config, user, res);
    success(res, serializeUser(user));
  });
  app.post("/api/auth/demo", limiter, async (req, res) => {
    if (!config.demo) throw new ApiError(403, "DEMO_DISABLED", "Демо-вход отключён. Зарегистрируйте аккаунт.");
    const current = await findSession(db, config, req.cookies[cookieName]);
    if (current) return success(res, serializeUser(current.user));
    const user = await db.user.create({ data: { email: `demo-${randomUUID()}@demo.invalid`, displayName: "Демо-атлет",
      passwordHash: await hashPassword(randomBytes(32).toString("hex")), progress: { create: {} } } });
    await establishSession(db, config, user, res);
    success(res, serializeUser(user), 201);
  });
  app.post("/api/auth/logout", async (req, res) => {
    const session = await findSession(db, config, req.cookies[cookieName]);
    if (session) await db.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    res.clearCookie(cookieName, cookieOptions(config));
    success(res, null);
  });
  app.get(["/api/me", "/api/auth/me"], auth, (req, res) => success(res, serializeUser(req.identity.user)));
  app.post("/api/workouts", auth, validate(workoutSchema), async (req, res) => {
    const saved = await saveWorkout(db, req.identity.user.id, req.body);
    success(res, saved.result, saved.created ? 201 : 200);
  });
  app.get("/api/workouts", auth, async (req, res) => {
    const rows = await db.workoutSession.findMany({ where: { userId: req.identity.user.id }, include: workoutInclude,
      orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }] });
    success(res, rows.map(serializeWorkout));
  });
  app.get("/api/workouts/:id", auth, async (req, res) => {
    const row = await db.workoutSession.findUnique({ where: { userId_resultId: { userId: req.identity.user.id, resultId: req.params.id } }, include: workoutInclude });
    if (!row) throw new ApiError(404, "WORKOUT_NOT_FOUND", "Workout was not found.");
    success(res, serializeWorkout(row));
  });
  app.get("/api/progress", auth, async (req, res) => success(res, await getProgress(db, req.identity.user.id)));
  app.use((req, res, next) => next(new ApiError(404, "NOT_FOUND", "API route was not found.")));
  app.use(errorHandler);
  return app;
}
