import { exerciseIds } from "../validation/workout.js";
export async function getProgress(db, userId) {
  // Read both aggregates from one snapshot even while another workout is committed.
  const [summary, exercises] = await db.$transaction([
    db.workoutSession.aggregate({ where: { userId }, _count: { id: true }, _sum: { durationMs: true }, _max: { finishedAt: true } }),
    db.exerciseResult.groupBy({ by: ["exerciseId"], where: { workout: { userId } },
      _sum: { completedReps: true, cleanReps: true, durationMs: true } }),
  ], { isolationLevel: "RepeatableRead" });
  const exerciseTotals = Object.fromEntries(exerciseIds.map(id => [id, { completedReps: 0, cleanReps: 0, durationMs: 0 }]));
  for (const item of exercises) exerciseTotals[item.exerciseId] = {
    completedReps: item._sum.completedReps ?? 0, cleanReps: item._sum.cleanReps ?? 0, durationMs: Number(item._sum.durationMs ?? 0),
  };
  return { totalWorkouts: summary._count.id,
    totalReps: Object.values(exerciseTotals).reduce((sum, e) => sum + e.completedReps, 0),
    totalDurationMs: Number(summary._sum.durationMs ?? 0),
    lastWorkoutAt: summary._max.finishedAt?.toISOString() ?? null, exerciseTotals };
}
