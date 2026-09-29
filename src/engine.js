import { APP_EVENTS } from "./config.js";
import { emit } from "./events.js";
import { createSquat } from "./exercises/squat.js";

export function createExerciseEngine() {
  let analyzer = null;
  let currentResult = null;

  return {
    startSquat(calibration) {
      if (!Number.isFinite(calibration?.theta0)) return false;
      analyzer?.reset();
      analyzer = createSquat();
      currentResult = null;
      return true;
    },
    process(landmarks, context) {
      if (!analyzer) return null;
      currentResult = analyzer.analyze(landmarks, context);
      const rep = currentResult.repEvent;
      if (rep?.counted) {
        emit(APP_EVENTS.REP, {
          exercise: analyzer.id,
          rep: currentResult.reps,
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
    },
  };
}
