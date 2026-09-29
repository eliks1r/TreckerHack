import {
  CALIBRATION_START_OFFSET,
  CALIBRATION_UP_MAX,
  CALIBRATION_UP_MIN,
  CALIBRATION_UP_OFFSET,
  MAX_REP_DURATION_MS,
  MIN_REP_DURATION_MS,
  PHASE_CONFIRM_FRAMES,
  SQUAT_BOTTOM_THRESHOLD,
  SQUAT_FAST_MS,
  SQUAT_FORM_SAMPLE_MAX_ANGLE,
  SQUAT_GOOD_DEPTH,
  SQUAT_KNEE_FAIL,
  SQUAT_KNEE_WARN,
  SQUAT_LEAN_FAIL_DEG,
  SQUAT_NOT_UP_MAX,
  SQUAT_NOT_UP_MIN,
  SQUAT_NOT_UP_MS,
  SQUAT_RISING_DELTA,
  TRACKING_LOSS_RESET_MS,
} from "../config.js";
import { anglePx, distancePx } from "../geometry.js";
import { isUsableLandmark, JOINTS } from "../poseQuality.js";

const SIDES = {
  LEFT: [JOINTS.LEFT_SHOULDER, JOINTS.LEFT_HIP, JOINTS.LEFT_KNEE, JOINTS.LEFT_ANKLE],
  RIGHT: [JOINTS.RIGHT_SHOULDER, JOINTS.RIGHT_HIP, JOINTS.RIGHT_KNEE, JOINTS.RIGHT_ANKLE],
};
const TOE = { LEFT: 31, RIGHT: 32 };
const FORM_ERRORS = Object.freeze({
  SQ_KNEE_TOE: { code: "SQ_KNEE_TOE", severity: "critical" },
  SQ_LEAN: { code: "SQ_LEAN", severity: "critical" },
  SQ_SHALLOW: { code: "SQ_SHALLOW", severity: "critical" },
  SQ_NOT_UP: { code: "SQ_NOT_UP", severity: "minor" },
  SQ_FAST: { code: "SQ_FAST", severity: "minor" },
});

function formError(code, side) {
  const [shoulder, hip, knee, ankle] = SIDES[side];
  const joints = {
    SQ_KNEE_TOE: [knee, TOE[side], ankle],
    SQ_LEAN: [shoulder, hip],
    SQ_SHALLOW: [hip, knee],
    SQ_NOT_UP: [hip, knee],
    SQ_FAST: [],
  };
  return { ...FORM_ERRORS[code], joints: joints[code] };
}

function formMetrics(landmarks, side, width, height, legLength) {
  const [shoulderIndex, hipIndex, kneeIndex, ankleIndex] = SIDES[side];
  const shoulder = landmarks[shoulderIndex];
  const hip = landmarks[hipIndex];
  const knee = landmarks[kneeIndex];
  const ankle = landmarks[ankleIndex];
  const toe = landmarks[TOE[side]];
  const torsoDx = (shoulder.x - hip.x) * width;
  const torsoDy = (shoulder.y - hip.y) * height;
  const lean = Math.atan2(Math.abs(torsoDx), Math.abs(torsoDy)) * 180 / Math.PI;
  const measuredLeg = distancePx(hip, knee, width, height) +
    distancePx(knee, ankle, width, height);
  const scale = Number.isFinite(legLength) && legLength > 0 ? legLength : measuredLeg;
  // Toe direction supplies the forward sign, independent of camera mirroring or body side.
  const footDx = isUsableLandmark(toe) ? (toe.x - ankle.x) * width : 0;
  const kneeOver = Math.abs(footDx) > 0 && scale > 0
    ? Math.max(0, ((knee.x - toe.x) * width * Math.sign(footDx)) / scale)
    : null;
  return { kneeOver, lean };
}

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
  let cleanReps = 0;
  let armed = false;
  let minKneeAngle = null;
  let startedAt = null;
  let lockedSide = null;
  let phaseCandidate = null;
  let phaseConfirmFrames = 0;
  let candidateStartedAt = null;
  let candidateMinAngle = null;
  let lastValidAt = null;
  let kneeOver = null;
  let lean = null;
  let maxKneeOver = null;
  let maxLean = null;
  let kneeWarnFrames = 0;
  let kneeFailFrames = 0;
  let leanFailFrames = 0;
  let kneeWarn = false;
  let kneeFail = false;
  let leanFail = false;
  let notUpSince = null;
  let notUpDetected = false;

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
    kneeOver = null;
    lean = null;
    maxKneeOver = null;
    maxLean = null;
    kneeWarnFrames = 0;
    kneeFailFrames = 0;
    leanFailFrames = 0;
    kneeWarn = false;
    kneeFail = false;
    leanFail = false;
    notUpSince = null;
    notUpDetected = false;
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

  function result(visible, kneeAngle, selectedSide, upThreshold, downStartThreshold,
    repEvent = null, completedMetrics = null) {
    const errors = [];
    if (phase !== "up" && selectedSide) {
      if (kneeFail) errors.push(formError("SQ_KNEE_TOE", selectedSide));
      if (leanFail) errors.push(formError("SQ_LEAN", selectedSide));
      if (notUpDetected) errors.push(formError("SQ_NOT_UP", selectedSide));
      // A warning-level knee observation uses the same correction without failing the rep.
      if (kneeWarn && !kneeFail) errors.push({
        ...formError("SQ_KNEE_TOE", selectedSide), severity: "minor",
      });
    }
    if (repEvent?.errors.length) errors.splice(0, errors.length, ...repEvent.errors);
    return {
      visible,
      phase,
      reps,
      cleanReps,
      errors,
      repEvent,
      metrics: {
        kneeAngle,
        minKneeAngle: completedMetrics?.minKneeAngle ?? minKneeAngle,
        kneeOver,
        lean,
        maxKneeOver: completedMetrics?.maxKneeOver ?? maxKneeOver,
        maxLean: completedMetrics?.maxLean ?? maxLean,
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

      ({ kneeOver, lean } = formMetrics(
        landmarks, selectedSide, videoWidth, videoHeight, calibration.legLen,
      ));
      if (phase !== "up" && kneeAngle <= SQUAT_FORM_SAMPLE_MAX_ANGLE) {
        if (kneeOver !== null) {
          maxKneeOver = Math.max(maxKneeOver ?? 0, kneeOver);
          kneeWarnFrames = kneeOver > SQUAT_KNEE_WARN ? kneeWarnFrames + 1 : 0;
          kneeFailFrames = kneeOver > SQUAT_KNEE_FAIL ? kneeFailFrames + 1 : 0;
          if (kneeWarnFrames >= confirmFrames) kneeWarn = true;
          if (kneeFailFrames >= confirmFrames) kneeFail = true;
        } else {
          kneeWarnFrames = 0;
          kneeFailFrames = 0;
        }
        maxLean = Math.max(maxLean ?? 0, lean);
        leanFailFrames = lean > SQUAT_LEAN_FAIL_DEG ? leanFailFrames + 1 : 0;
        if (leanFailFrames >= confirmFrames) leanFail = true;
      } else {
        kneeWarnFrames = 0;
        kneeFailFrames = 0;
        leanFailFrames = 0;
      }

      let repEvent = null;
      let completedMetrics = null;
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
        if (kneeAngle >= SQUAT_NOT_UP_MIN && kneeAngle <= SQUAT_NOT_UP_MAX) {
          notUpSince ??= nowMs;
          if (nowMs - notUpSince > SQUAT_NOT_UP_MS) notUpDetected = true;
        } else {
          notUpSince = null;
        }
        if (confirm("up", kneeAngle >= upThreshold, nowMs, kneeAngle)) {
          const durationMs = nowMs - startedAt;
          const counted = durationMs >= minDurationMs && durationMs <= maxDurationMs &&
            minKneeAngle <= bottomThreshold;
          if (counted) reps += 1;
          const errors = [];
          if (kneeFail) errors.push(formError("SQ_KNEE_TOE", selectedSide));
          if (leanFail) errors.push(formError("SQ_LEAN", selectedSide));
          if (minKneeAngle > SQUAT_GOOD_DEPTH && minKneeAngle <= bottomThreshold) {
            errors.push(formError("SQ_SHALLOW", selectedSide));
          }
          if (notUpDetected) errors.push(formError("SQ_NOT_UP", selectedSide));
          if (durationMs < SQUAT_FAST_MS) errors.push(formError("SQ_FAST", selectedSide));
          if (kneeWarn && !kneeFail) errors.push({
            ...formError("SQ_KNEE_TOE", selectedSide), severity: "minor",
          });
          const clean = counted && !errors.some((error) => error.severity === "critical");
          if (clean) cleanReps += 1;
          repEvent = { counted, clean, errors, durationMs, minAngle: minKneeAngle };
          completedMetrics = { minKneeAngle, maxKneeOver, maxLean };
          cancelCycle(true);
        }
      }

      return result(true, kneeAngle, selectedSide, upThreshold, downStartThreshold,
        repEvent, completedMetrics);
    },
    reset() {
      cancelCycle();
      reps = 0;
      cleanReps = 0;
    },
  };
}
