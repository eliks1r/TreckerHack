export function serializeUser(user) {
  return { id: user.id, name: user.displayName, email: user.email,
    avatar: "./assets/athlete_portrait.jpg", level: "Атлет",
    createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
}
