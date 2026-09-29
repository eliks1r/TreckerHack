import { APP_EVENTS, HINT_COOLDOWN_MS } from "./config.js";
import { emit } from "./events.js";
import { createSquat } from "./exercises/squat.js";
import { createArmRaise } from "./exercises/armraise.js";

const exerciseFactories = Object.freeze({ squat: createSquat, armraise: createArmRaise });

export function createExerciseEngine() {
  let analyzer = null;
  let currentResult = null;
  const lastHintAt = new Map();
  let lastActiveHint = null;

  function startExercise(exerciseId, calibration) {
    const factory = exerciseFactories[exerciseId];
    if (!factory || !Number.isFinite(calibration?.theta0)) return false;
    analyzer?.reset();
    analyzer = factory();
    currentResult = null;
    lastHintAt.clear();
    lastActiveHint = null;
    return true;
  }

  return {
    startExercise,
    getRequiredView() {
      return analyzer?.view ?? null;
    },
    startSquat(calibration) {
      return startExercise("squat", calibration);
    },
    process(landmarks, context) {
      if (!analyzer) return null;
      currentResult = analyzer.analyze(landmarks, context);
      const rep = currentResult.repEvent;
      const activeHint = currentResult.errors[0] || null;
      if (activeHint && activeHint.code !== lastActiveHint &&
          Number.isFinite(context?.nowMs) &&
          context.nowMs - (lastHintAt.get(activeHint.code) ?? -Infinity) >= HINT_COOLDOWN_MS) {
        emit(APP_EVENTS.HINT, activeHint);
        lastHintAt.set(activeHint.code, context.nowMs);
      }
      lastActiveHint = activeHint?.code ?? null;
      if (rep?.counted) {
        emit(APP_EVENTS.REP, {
          exercise: analyzer.id,
          rep: currentResult.reps,
          clean: rep.clean,
          errors: rep.errors,
          durationMs: rep.durationMs,
          minAngle: rep.minAngle,
        });
      }
      return currentResult;
    },
    getResult() {
      return currentResult;
    },
    reset() {
      analyzer?.reset();
      analyzer = null;
      currentResult = null;
      lastHintAt.clear();
      lastActiveHint = null;
    },
  };
}
