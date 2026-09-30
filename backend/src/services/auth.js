import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import { ApiError } from "../middleware/errors.js";
const scrypt = promisify(scryptCallback);
export const cookieName = "motion_session";
export const sessionMs = 7 * 24 * 60 * 60 * 1000;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$${salt}$${key.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [algorithm, cost, salt, hex] = stored.split("$");
  if (algorithm !== "scrypt" || cost !== "32768" || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const key = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(key, Buffer.from(hex, "hex"));
}
export function cookieOptions(config) {
  return { httpOnly: true, secure: config.production, sameSite: "lax", path: "/api" };
}
export async function establishSession(db, config, user, res) {
  const session = await db.authSession.create({ data: { userId: user.id, expiresAt: new Date(Date.now() + sessionMs) } });
  const token = jwt.sign({}, config.secret, { algorithm: "HS256", subject: user.id,
    jwtid: session.id, issuer: "motion-tracker", audience: "motion-browser", expiresIn: "7d" });
  res.cookie(cookieName, token, { ...cookieOptions(config), maxAge: sessionMs });
}
export async function findSession(db, config, token) {
  if (!token) return null;
  let claims;
  try { claims = jwt.verify(token, config.secret, { algorithms: ["HS256"], issuer: "motion-tracker", audience: "motion-browser" }); }
  catch { return null; }
  if (typeof claims.sub !== "string" || typeof claims.jti !== "string" || !/^[a-f0-9-]{36}$/i.test(claims.jti)) return null;
  const session = await db.authSession.findUnique({ where: { id: claims.jti }, include: { user: true } });
  return session && !session.revokedAt && session.expiresAt > new Date() && session.userId === claims.sub ? session : null;
}
export function requireAuth(db, config) {
  return async (req, res, next) => {
    const session = await findSession(db, config, req.cookies[cookieName]);
    if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Войдите в аккаунт для доступа к сохранённым тренировкам.");
    req.identity = { user: session.user, sessionId: session.id };
    next();
  };
}
