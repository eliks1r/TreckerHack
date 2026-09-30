export const workoutInclude = { exercises: { orderBy: { orderIndex: "asc" }, include: { errors: { orderBy: { orderIndex: "asc" } } } } };
export function serializeWorkout(w) {
  return { id: w.resultId, workoutNumber: w.workoutNumber, programId: w.programId,
    startedAt: w.startedAt.toISOString(), finishedAt: w.finishedAt.toISOString(),
    durationMs: Number(w.durationMs), completed: w.completed,
    exercises: w.exercises.map(e => ({ exerciseId: e.exerciseId, targetReps: e.targetReps,
      completedReps: e.completedReps, cleanReps: e.cleanReps, durationMs: Number(e.durationMs),
      errors: e.errors.map(x => ({ rep: x.rep, code: x.errorCode, severity: x.severity })) })) };
}
