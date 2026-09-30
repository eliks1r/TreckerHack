import { createHash } from "node:crypto";
import { ApiError } from "../middleware/errors.js";
import { serializeWorkout, workoutInclude } from "../serializers/workout.js";

export async function saveWorkout(db, userId, input) {
  const normalized = { ...input, startedAt: new Date(input.startedAt).toISOString(), finishedAt: new Date(input.finishedAt).toISOString() };
  const hash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return db.$transaction(async tx => {
    // Serialize saves per user, including concurrent retries, before checking the result ID.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
    const prior = await tx.workoutSession.findUnique({ where: { userId_resultId: { userId, resultId: input.id } }, include: workoutInclude });
    if (prior) {
      if (prior.payloadHash !== hash) throw new ApiError(409, "RESULT_CONFLICT", "This workout ID already has a different result.");
      return { result: serializeWorkout(prior), created: false };
    }
    const { id, exercises, ...fields } = normalized;
    const saved = await tx.workoutSession.create({ data: { ...fields, resultId: id, payloadHash: hash, userId,
      startedAt: new Date(fields.startedAt), finishedAt: new Date(fields.finishedAt),
      exercises: { create: exercises.map(({ errors, ...exercise }, orderIndex) => ({ ...exercise, orderIndex,
        errors: { create: errors.map(({ code, ...error }, errorIndex) => ({ ...error, errorCode: code, orderIndex: errorIndex, count: 1 })) } })) },
    }, include: workoutInclude });
    const reps = exercises.reduce((sum, e) => sum + e.completedReps, 0);
    const progress = await tx.userProgress.findUnique({ where: { userId } });
    const lastWorkoutAt = !progress?.lastWorkoutAt || progress.lastWorkoutAt < saved.finishedAt ? saved.finishedAt : progress.lastWorkoutAt;
    await tx.userProgress.upsert({ where: { userId },
      create: { userId, totalWorkouts: 1, totalReps: reps, totalDurationMs: fields.durationMs, lastWorkoutAt },
      update: { totalWorkouts: { increment: 1 }, totalReps: { increment: reps }, totalDurationMs: { increment: fields.durationMs }, lastWorkoutAt },
    });
    return { result: serializeWorkout(saved), created: true };
  });
}
