export function workout(id = "test-workout") {
  return { id, workoutNumber: 3, programId: "light", startedAt: "2026-09-30T10:00:00.000Z",
    finishedAt: "2026-09-30T10:04:00.000Z", durationMs: 240000, completed: true,
    exercises: [
      { exerciseId: "armraise", targetReps: 8, completedReps: 8, cleanReps: 8, durationMs: 60000, errors: [] },
      { exerciseId: "sidebend", targetReps: 10, completedReps: 10, cleanReps: 10, durationMs: 60000, errors: [] },
      { exerciseId: "armraise", targetReps: 8, completedReps: 8, cleanReps: 8, durationMs: 60000, errors: [] },
    ] };
}
