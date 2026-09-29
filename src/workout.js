// Session data and transitions only. The UI owns timers, events, and pose analyzers.
export function createWorkout(program) {
  if (!program?.exercises?.length) throw new TypeError("A program with exercises is required");

  let currentExerciseIndex = 0;
  let status = "IDLE";
  let exerciseResults = [];
  let startedAt = null;
  let endedAt = null;

  function getCurrentExercise() {
    return program.exercises[currentExerciseIndex] ?? null;
  }

  function getState() {
    return {
      programId: program.id,
      currentExerciseIndex,
      status,
      exerciseResults: exerciseResults.map((result) => ({ ...result })),
      startedAt,
      endedAt,
    };
  }

  return {
    getCurrentExercise,
    getState,
    startWorkout(now = Date.now()) {
      if (status !== "IDLE" || !getCurrentExercise()?.implemented) return false;
      startedAt = now;
      status = "ACTIVE";
      return true;
    },
    completeCurrentExercise(result, now = Date.now()) {
      const exercise = getCurrentExercise();
      if (status !== "ACTIVE" || !exercise?.implemented ||
          !Number.isFinite(result?.reps) || result.reps < exercise.targetReps) return null;
      const completed = Object.freeze({
        exerciseId: exercise.id,
        reps: exercise.targetReps,
        targetReps: exercise.targetReps,
        cleanReps: Math.min(result.cleanReps ?? 0, exercise.targetReps),
        completedAt: now,
      });
      exerciseResults = [...exerciseResults, completed];
      if (currentExerciseIndex + 1 < program.exercises.length) status = "REST";
      else {
        status = "COMPLETE";
        endedAt = now;
      }
      return { ...completed };
    },
    nextExercise() {
      if (status !== "REST") return null;
      currentExerciseIndex += 1;
      status = "ACTIVE";
      return getCurrentExercise();
    },
    finishWorkout(now = Date.now()) {
      if (status === "IDLE") return null;
      if (status !== "COMPLETE") {
        status = "COMPLETE";
        endedAt = now;
      }
      return getState();
    },
    resetWorkout() {
      currentExerciseIndex = 0;
      status = "IDLE";
      exerciseResults = [];
      startedAt = null;
      endedAt = null;
      return getState();
    },
  };
}
