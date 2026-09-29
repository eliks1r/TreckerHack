import {
  CALIBRATION_START_OFFSET,
  CALIBRATION_UP_MAX,
  CALIBRATION_UP_MIN,
  CALIBRATION_UP_OFFSET,
  MAX_REP_DURATION_MS,
  MIN_REP_DURATION_MS,
  PHASE_CONFIRM_FRAMES,
  SQUAT_BOTTOM_THRESHOLD,
  SQUAT_RISING_DELTA,
  TRACKING_LOSS_RESET_MS,
} from "../config.js";
import { anglePx } from "../geometry.js";
import { isUsableLandmark, JOINTS } from "../poseQuality.js";

const SIDES = {
  LEFT: [JOINTS.LEFT_SHOULDER, JOINTS.LEFT_HIP, JOINTS.LEFT_KNEE, JOINTS.LEFT_ANKLE],
  RIGHT: [JOINTS.RIGHT_SHOULDER, JOINTS.RIGHT_HIP, JOINTS.RIGHT_KNEE, JOINTS.RIGHT_ANKLE],
};

function sideScore(landmarks, side) {
  const joints = SIDES[side];
  const visibility = joints.reduce((sum, index) =>
    sum + Math.max(0, landmarks?.[index]?.visibility ?? 0), 0) / joints.length;
  return { visibility, usable: joints.every((index) => isUsableLandmark(landmarks?.[index])) };
}

export function createSquat(config = {}) {
  const bottomThreshold = config.bottomThreshold ?? SQUAT_BOTTOM_THRESHOLD;
  const risingDelta = config.risingDelta ?? SQUAT_RISING_DELTA;
  const confirmFrames = config.confirmFrames ?? PHASE_CONFIRM_FRAMES;
  const minDurationMs = config.minDurationMs ?? MIN_REP_DURATION_MS;
  const maxDurationMs = config.maxDurationMs ?? MAX_REP_DURATION_MS;
  const lossResetMs = config.lossResetMs ?? TRACKING_LOSS_RESET_MS;

  let phase = "up";
  let reps = 0;
  let armed = false;
  let minKneeAngle = null;
  let startedAt = null;
  let lockedSide = null;
  let phaseCandidate = null;
  let phaseConfirmFrames = 0;
  let candidateStartedAt = null;
  let candidateMinAngle = null;
  let lastValidAt = null;

  function clearCandidate() {
    phaseCandidate = null;
    phaseConfirmFrames = 0;
    candidateStartedAt = null;
    candidateMinAngle = null;
  }

  function cancelCycle(keepArmed = false) {
    phase = "up";
    armed = keepArmed;
    minKneeAngle = null;
    startedAt = null;
    lockedSide = null;
    lastValidAt = null;
    clearCandidate();
  }

  function confirm(next, condition, nowMs, kneeAngle) {
    if (!condition) {
      clearCandidate();
      return false;
    }
    if (phaseCandidate !== next) {
      phaseCandidate = next;
      phaseConfirmFrames = 0;
      candidateStartedAt = nowMs;
      candidateMinAngle = kneeAngle;
    }
    phaseConfirmFrames += 1;
    candidateMinAngle = Math.min(candidateMinAngle, kneeAngle);
    return phaseConfirmFrames >= confirmFrames;
  }

  function result(visible, kneeAngle, selectedSide, upThreshold, downStartThreshold, repEvent = null) {
    return {
      visible,
      phase,
      reps,
      cleanReps: reps, // No form-error classification exists in G2.3a.
      errors: [],
      repEvent,
      metrics: {
        kneeAngle,
        minKneeAngle,
        selectedSide,
        upThreshold,
        downStartThreshold,
        phase,
        phaseCandidate,
        phaseConfirmFrames,
      },
    };
  }

  return {
    id: "squat",
    view: "SIDE",
    analyze(landmarks, context = {}) {
      const { calibration, videoWidth, videoHeight, nowMs, view, framing } = context;
      const theta0 = calibration?.theta0;
      const upThreshold = Number.isFinite(theta0)
        ? Math.max(CALIBRATION_UP_MIN, Math.min(CALIBRATION_UP_MAX,
          theta0 - CALIBRATION_UP_OFFSET))
        : null;
      const downStartThreshold = upThreshold === null
        ? null
        : upThreshold - CALIBRATION_START_OFFSET;
      const left = sideScore(landmarks, "LEFT");
      const right = sideScore(landmarks, "RIGHT");
      const preferred = left.visibility >= right.visibility ? "LEFT" : "RIGHT";
      const other = preferred === "LEFT" ? "RIGHT" : "LEFT";
      const scores = { LEFT: left, RIGHT: right };
      const selectedSide = lockedSide ||
        (scores[preferred].usable ? preferred : scores[other].usable ? other : preferred);
      const sideUsable = scores[selectedSide].usable;
      const valid = upThreshold !== null && view === "SIDE" && framing === "READY" &&
        Number.isFinite(nowMs) && videoWidth > 0 && videoHeight > 0 && sideUsable;

      if (!valid) {
        // A view change or missing calibration invalidates the unseen part of a cycle.
        if (view !== "SIDE" || upThreshold === null) {
          cancelCycle();
        } else {
          clearCandidate();
          if (!Number.isFinite(nowMs) ||
              (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs)) {
            cancelCycle();
          }
        }
        return result(false, null, selectedSide, upThreshold, downStartThreshold);
      }

      const [, hipIndex, kneeIndex, ankleIndex] = SIDES[selectedSide];
      const kneeAngle = anglePx(
        landmarks[hipIndex], landmarks[kneeIndex], landmarks[ankleIndex],
        videoWidth, videoHeight,
      );
      if (!Number.isFinite(kneeAngle)) {
        clearCandidate();
        if (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs) cancelCycle();
        return result(false, null, selectedSide, upThreshold, downStartThreshold);
      }
      if (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs) cancelCycle();
      lastValidAt = nowMs;

      let repEvent = null;
      if (phase === "up") {
        if (!armed) {
          if (confirm("up", kneeAngle >= upThreshold, nowMs, kneeAngle)) {
            armed = true;
            clearCandidate();
          }
        } else if (confirm("down", kneeAngle < downStartThreshold, nowMs, kneeAngle)) {
          phase = "down";
          startedAt = candidateStartedAt;
          minKneeAngle = candidateMinAngle;
          lockedSide = selectedSide;
          clearCandidate();
        }
      } else if (phase === "down") {
        minKneeAngle = Math.min(minKneeAngle, kneeAngle);
        if (kneeAngle <= bottomThreshold) {
          if (confirm("bottom", true, nowMs, kneeAngle)) {
            phase = "bottom";
            clearCandidate();
          }
        } else if (kneeAngle >= upThreshold) {
          // A bend that never reached the bottom is not a repetition.
          if (confirm("up", true, nowMs, kneeAngle)) cancelCycle(true);
        } else {
          clearCandidate();
        }
      } else if (phase === "bottom") {
        minKneeAngle = Math.min(minKneeAngle, kneeAngle);
        if (confirm("rising", kneeAngle > minKneeAngle + risingDelta, nowMs, kneeAngle)) {
          phase = "rising";
          clearCandidate();
        }
      } else if (phase === "rising") {
        minKneeAngle = Math.min(minKneeAngle, kneeAngle);
        if (confirm("up", kneeAngle >= upThreshold, nowMs, kneeAngle)) {
          const durationMs = nowMs - startedAt;
          const counted = durationMs >= minDurationMs && durationMs <= maxDurationMs &&
            minKneeAngle <= bottomThreshold;
          if (counted) reps += 1;
          repEvent = { counted, durationMs, minAngle: minKneeAngle };
          cancelCycle(true);
        }
      }

      return result(true, kneeAngle, selectedSide, upThreshold, downStartThreshold, repEvent);
    },
    reset() {
      cancelCycle();
      reps = 0;
    },
  };
}
