import {
  PHASE_CONFIRM_FRAMES,
  SIDEBEND_FULL_DEG,
  SIDEBEND_MAX_REP_MS,
  SIDEBEND_MIN_REP_MS,
  SIDEBEND_NEUTRAL_DEG,
  SIDEBEND_START_DEG,
  TRACKING_LOSS_RESET_MS,
} from "../config.js";
import { midpoint } from "../geometry.js";
import { isUsableLandmark, JOINTS } from "../poseQuality.js";

const REQUIRED = [
  JOINTS.LEFT_SHOULDER, JOINTS.RIGHT_SHOULDER,
  JOINTS.LEFT_HIP, JOINTS.RIGHT_HIP,
];

export function createSideBend(config = {}) {
  const confirmFrames = config.confirmFrames ?? PHASE_CONFIRM_FRAMES;
  const lossResetMs = config.lossResetMs ?? TRACKING_LOSS_RESET_MS;
  const minDurationMs = config.minDurationMs ?? SIDEBEND_MIN_REP_MS;
  const maxDurationMs = config.maxDurationMs ?? SIDEBEND_MAX_REP_MS;

  let phase = "neutral";
  let direction = null;
  let reps = 0;
  let armed = false;
  let startedAt = null;
  let lastValidAt = null;
  let phaseCandidate = null;
  let phaseConfirmFrames = 0;
  let candidateStartedAt = null;

  function clearCandidate() {
    phaseCandidate = null;
    phaseConfirmFrames = 0;
    candidateStartedAt = null;
  }

  function cancelCycle(keepArmed = false) {
    phase = "neutral";
    direction = null;
    armed = keepArmed;
    startedAt = null;
    lastValidAt = null;
    clearCandidate();
  }

  function confirm(next, nowMs) {
    if (phaseCandidate !== next) {
      phaseCandidate = next;
      phaseConfirmFrames = 0;
      candidateStartedAt = nowMs;
    }
    phaseConfirmFrames += 1;
    return phaseConfirmFrames >= confirmFrames;
  }

  function result(visible, torsoAngleDeg = null, repEvent = null) {
    return {
      visible,
      phase,
      reps,
      cleanReps: reps, // Side Bend form errors are not classified yet.
      errors: [],
      repEvent,
      metrics: {
        torsoAngleDeg,
        direction,
        phase,
        phaseCandidate,
        phaseConfirmFrames,
      },
    };
  }

  return {
    id: "sidebend",
    view: "FRONT",
    analyze(landmarks, context = {}) {
      const { videoWidth, videoHeight, nowMs, view, framing } = context;
      const valid = view === "FRONT" && framing !== "NO_BODY" && framing !== "TOO_CLOSE" &&
        videoWidth > 0 && videoHeight > 0 && Number.isFinite(nowMs) &&
        REQUIRED.every((index) => isUsableLandmark(landmarks?.[index]));
      if (!valid) {
        clearCandidate();
        if (!Number.isFinite(nowMs) ||
            (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs)) cancelCycle();
        return result(false);
      }

      const shoulderMid = midpoint(
        landmarks[JOINTS.LEFT_SHOULDER], landmarks[JOINTS.RIGHT_SHOULDER],
      );
      const hipMid = midpoint(landmarks[JOINTS.LEFT_HIP], landmarks[JOINTS.RIGHT_HIP]);
      const dxPx = (shoulderMid.x - hipMid.x) * videoWidth;
      const dyPx = (hipMid.y - shoulderMid.y) * videoHeight;
      if (!(dyPx > 0)) {
        clearCandidate();
        if (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs) cancelCycle();
        return result(false);
      }
      if (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs) cancelCycle();
      lastValidAt = nowMs;
      const torsoAngleDeg = Math.atan2(dxPx, dyPx) * 180 / Math.PI;
      const absoluteAngle = Math.abs(torsoAngleDeg);
      let repEvent = null;

      if (phase === "neutral") {
        if (!armed) {
          if (absoluteAngle < SIDEBEND_NEUTRAL_DEG) {
            if (confirm("neutral", nowMs)) {
              armed = true;
              clearCandidate();
            }
          } else clearCandidate();
        } else if (torsoAngleDeg > SIDEBEND_START_DEG) {
          if (confirm("bending_left", nowMs)) {
            phase = "bending_left";
            direction = "LEFT";
            startedAt = candidateStartedAt;
            clearCandidate();
          }
        } else if (torsoAngleDeg < -SIDEBEND_START_DEG) {
          if (confirm("bending_right", nowMs)) {
            phase = "bending_right";
            direction = "RIGHT";
            startedAt = candidateStartedAt;
            clearCandidate();
          }
        } else clearCandidate();
      } else {
        const signedAngle = direction === "LEFT" ? torsoAngleDeg : -torsoAngleDeg;
        if (phase === "bending_left" || phase === "bending_right") {
          if (signedAngle >= SIDEBEND_FULL_DEG) {
            if (confirm(direction.toLowerCase(), nowMs)) {
              phase = direction.toLowerCase();
              clearCandidate();
            }
          } else if (absoluteAngle < SIDEBEND_NEUTRAL_DEG) {
            // A bend that never reached FULL is incomplete.
            if (confirm("neutral", nowMs)) cancelCycle(true);
          } else if (signedAngle < -SIDEBEND_START_DEG) {
            if (confirm("opposite", nowMs)) cancelCycle();
          } else clearCandidate();
        } else if (phase === "left" || phase === "right") {
          if (signedAngle <= SIDEBEND_START_DEG) {
            if (confirm(`returning_${direction.toLowerCase()}`, nowMs)) {
              phase = `returning_${direction.toLowerCase()}`;
              clearCandidate();
            }
          } else clearCandidate();
        } else if (absoluteAngle < SIDEBEND_NEUTRAL_DEG) {
          if (confirm("neutral", nowMs)) {
            const durationMs = nowMs - startedAt;
            const counted = durationMs >= minDurationMs && durationMs <= maxDurationMs;
            if (counted) reps += 1;
            repEvent = { counted, clean: counted, errors: [], durationMs };
            cancelCycle(true);
          }
        } else if (signedAngle < -SIDEBEND_START_DEG) {
          if (confirm("opposite", nowMs)) cancelCycle();
        } else clearCandidate();
      }

      return result(true, torsoAngleDeg, repEvent);
    },
    reset() {
      cancelCycle();
      reps = 0;
    },
  };
}
