// DOM-free session orchestration. Exercise analyzers own motion decisions.
export const WORKOUT_STATUSES = Object.freeze({
  IDLE: "IDLE",
  PROGRAM_SELECTED: "PROGRAM_SELECTED",
  READY: "READY",
  ACTIVE: "ACTIVE",
  REST: "REST",
  EXERCISE_READY: "EXERCISE_READY",
  COMPLETE: "COMPLETE",
});

export function createWorkout(program) {
  if (!program?.exercises?.length || !Number.isInteger(program.workoutNumber)) {
    throw new TypeError("A numbered program with exercises is required");
  }

  let currentExerciseIndex = 0;
  let status = WORKOUT_STATUSES.IDLE;
  let exerciseResults = [];
  let startedAt = null;
  let finishedAt = null;
  let exerciseStartedAt = null;

  function getCurrentExercise() {
    return program.exercises[currentExerciseIndex] ?? null;
  }

  function getState() {
    return {
      workoutNumber: program.workoutNumber,
      programId: program.id,
      currentExerciseIndex,
      status,
      exerciseResults: exerciseResults.map((item) => ({
        ...item,
        errors: item.errors.map((error) => ({ ...error })),
      })),
      startedAt,
      finishedAt,
    };
  }

  return {
    getCurrentExercise,
    getState,
    selectProgram() {
      if (status !== WORKOUT_STATUSES.IDLE) return false;
      status = WORKOUT_STATUSES.PROGRAM_SELECTED;
      return true;
    },
    readyWorkout() {
      if (status !== WORKOUT_STATUSES.PROGRAM_SELECTED) return false;
      status = WORKOUT_STATUSES.READY;
      return true;
    },
    startWorkout(now = Date.now()) {
      if (status !== WORKOUT_STATUSES.READY) return false;
      startedAt = now;
      status = WORKOUT_STATUSES.EXERCISE_READY;
      return true;
    },
    startExercise(now = Date.now()) {
      if (status !== WORKOUT_STATUSES.EXERCISE_READY || !getCurrentExercise()) return false;
      exerciseStartedAt = now;
      status = WORKOUT_STATUSES.ACTIVE;
      return true;
    },
    completeCurrentExercise(result, now = Date.now()) {
      const exercise = getCurrentExercise();
      if (status !== WORKOUT_STATUSES.ACTIVE || !exercise ||
          !Number.isFinite(result?.reps) || result.reps < exercise.targetReps) return null;
      const completed = {
        exerciseId: exercise.id,
        targetReps: exercise.targetReps,
        completedReps: exercise.targetReps,
        cleanReps: Math.max(0, Math.min(result.cleanReps ?? 0, exercise.targetReps)),
        durationMs: Math.max(0, now - exerciseStartedAt),
        errors: Array.isArray(result.errors)
          ? result.errors.map(({ rep, code, severity }) => ({ rep, code, severity })) : [],
      };
      exerciseResults = [...exerciseResults, completed];
      exerciseStartedAt = null;
      if (currentExerciseIndex + 1 < program.exercises.length) {
        status = WORKOUT_STATUSES.REST;
      } else {
        status = WORKOUT_STATUSES.COMPLETE;
        finishedAt = now;
      }
      return { ...completed, errors: completed.errors.map((error) => ({ ...error })) };
    },
    readyNextExercise() {
      if (status !== WORKOUT_STATUSES.REST) return null;
      currentExerciseIndex += 1;
      status = WORKOUT_STATUSES.EXERCISE_READY;
      return getCurrentExercise();
    },
    resetWorkout() {
      currentExerciseIndex = 0;
      status = WORKOUT_STATUSES.IDLE;
      exerciseResults = [];
      startedAt = null;
      finishedAt = null;
      exerciseStartedAt = null;
      return getState();
    },
  };
}

export function buildWorkoutResult(session, id = globalThis.crypto?.randomUUID?.() ??
  `workout-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  if (session?.status !== WORKOUT_STATUSES.COMPLETE ||
      !Number.isFinite(session.startedAt) || !Number.isFinite(session.finishedAt)) {
    throw new TypeError("A completed workout session is required");
  }
  return {
    id,
    workoutNumber: session.workoutNumber,
    programId: session.programId,
    startedAt: new Date(session.startedAt).toISOString(),
    finishedAt: new Date(session.finishedAt).toISOString(),
    durationMs: Math.max(0, session.finishedAt - session.startedAt),
    exercises: session.exerciseResults.map((item) => ({
      exerciseId: item.exerciseId,
      targetReps: item.targetReps,
      completedReps: item.completedReps,
      cleanReps: item.cleanReps,
      durationMs: item.durationMs,
      errors: item.errors.map((error) => ({ ...error })),
    })),
    completed: true,
  };
}
