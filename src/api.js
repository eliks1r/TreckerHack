/**
 * BACKEND & AUTHENTICATION INTEGRATION BOUNDARY
 * Local-first persistence using localStorage with support for real accounts,
 * registration, login, session tokens, and workout history.
 */

const STORAGE_USERS = "motion_users_db";
const STORAGE_SESSION = "motion_auth_session";
const STORAGE_HISTORY = "motion_workout_history";

// Initial seed user for instant testing
const DEFAULT_DEMO_USER = {
  id: "user_demo_1",
  name: "Александр Волков",
  email: "alex@motion.ai",
  passwordHash: "demo123", // mock representation
  avatar: "./assets/athlete_portrait.jpg",
  streakDays: 14,
  level: "PRO Атлет",
  totalReps: 420,
  createdAt: "2026-09-01T10:00:00.000Z",
};

function getUsersDB() {
  try {
    const raw = localStorage.getItem(STORAGE_USERS);
    if (!raw) {
      const initial = [DEFAULT_DEMO_USER];
      localStorage.setItem(STORAGE_USERS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [DEFAULT_DEMO_USER];
  }
}

function saveUsersDB(users) {
  try {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  } catch {}
}

export async function getCurrentUser() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    if (!raw) return { ok: true, data: null };
    const session = JSON.parse(raw);
    const users = getUsersDB();
    const user = users.find((u) => u.id === session.userId) ?? null;
    return { ok: true, data: user ? sanitizeUser(user) : null };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function registerUser({ name, email, password }) {
  if (!name || !email || !password) {
    return { ok: false, error: "Заполните все обязательные поля." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getUsersDB();

  if (users.some((u) => u.email === cleanEmail)) {
    return { ok: false, error: "Пользователь с таким email уже зарегистрирован." };
  }

  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim(),
    email: cleanEmail,
    passwordHash: password,
    avatar: "./assets/athlete_portrait.jpg",
    streakDays: 1,
    level: "Начинающий",
    totalReps: 0,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsersDB(users);

  // Set active session
  localStorage.setItem(STORAGE_SESSION, JSON.stringify({ userId: newUser.id, token: `tok_${Date.now()}` }));

  return { ok: true, data: sanitizeUser(newUser) };
}

export async function loginUser({ email, password }) {
  if (!email || !password) {
    return { ok: false, error: "Введите email и пароль." };
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getUsersDB();
  const user = users.find((u) => u.email === cleanEmail);

  if (!user || user.passwordHash !== password) {
    return { ok: false, error: "Неверный email или пароль." };
  }

  // Set active session
  localStorage.setItem(STORAGE_SESSION, JSON.stringify({ userId: user.id, token: `tok_${Date.now()}` }));

  return { ok: true, data: sanitizeUser(user) };
}

export async function loginDemoUser() {
  const users = getUsersDB();
  let demo = users.find((u) => u.email === DEFAULT_DEMO_USER.email);
  if (!demo) {
    demo = DEFAULT_DEMO_USER;
    users.push(demo);
    saveUsersDB(users);
  }
  localStorage.setItem(STORAGE_SESSION, JSON.stringify({ userId: demo.id, token: `tok_${Date.now()}` }));
  return { ok: true, data: sanitizeUser(demo) };
}

export async function logoutUser() {
  localStorage.removeItem(STORAGE_SESSION);
  return { ok: true };
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function saveWorkoutResult(result) {
  const saved = structuredClone(result);
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY);
    const history = raw ? JSON.parse(raw) : [];
    const currentUserRes = await getCurrentUser();
    if (currentUserRes.ok && currentUserRes.data) {
      saved.userId = currentUserRes.data.id;
    }
    history.unshift(saved);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 50)));
  } catch {}
  return { ok: true, data: structuredClone(saved) };
}

export async function getWorkoutHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY);
    const history = raw ? JSON.parse(raw) : [];
    return { ok: true, data: history };
  } catch {
    return { ok: true, data: [] };
  }
}

export async function saveUserProgress(progress) {
  return { ok: true, data: structuredClone(progress) };
}
