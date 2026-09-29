import {
  ARMRAISE_DOWN,
  ARMRAISE_LATERAL_MIN,
  ARMRAISE_LOWERING_DELTA,
  ARMRAISE_MAX_REP_MS,
  ARMRAISE_MIN_REP_MS,
  ARMRAISE_RISING,
  ARMRAISE_TOP_AVG,
  ARMRAISE_TOP_BOTH_MIN,
  ARMRAISE_TOP_MIN,
  PHASE_CONFIRM_FRAMES,
  TRACKING_LOSS_RESET_MS,
} from "../config.js";
import { anglePx, distancePx } from "../geometry.js";
import { isUsableLandmark, JOINTS } from "../poseQuality.js";

const REQUIRED = [
  JOINTS.LEFT_SHOULDER, JOINTS.RIGHT_SHOULDER,
  JOINTS.LEFT_ELBOW, JOINTS.RIGHT_ELBOW,
  JOINTS.LEFT_WRIST, JOINTS.RIGHT_WRIST,
];

export function createArmRaise(config = {}) {
  const confirmFrames = config.confirmFrames ?? PHASE_CONFIRM_FRAMES;
  const lossResetMs = config.lossResetMs ?? TRACKING_LOSS_RESET_MS;
  const minDurationMs = config.minDurationMs ?? ARMRAISE_MIN_REP_MS;
  const maxDurationMs = config.maxDurationMs ?? ARMRAISE_MAX_REP_MS;

  let phase = "down";
  let armed = false;
  let reps = 0;
  let startedAt = null;
  let lastValidAt = null;
  let peakLeft = null;
  let peakRight = null;
  let phaseCandidate = null;
  let phaseConfirmFrames = 0;
  let candidateStartedAt = null;

  function clearCandidate() {
    phaseCandidate = null;
    phaseConfirmFrames = 0;
    candidateStartedAt = null;
  }

  function cancelCycle(keepArmed = false) {
    phase = "down";
    armed = keepArmed;
    startedAt = null;
    peakLeft = null;
    peakRight = null;
    lastValidAt = null;
    clearCandidate();
  }

  function confirm(next, condition, nowMs) {
    if (!condition) {
      clearCandidate();
      return false;
    }
    if (phaseCandidate !== next) {
      phaseCandidate = next;
      phaseConfirmFrames = 0;
      candidateStartedAt = nowMs;
    }
    phaseConfirmFrames += 1;
    return phaseConfirmFrames >= confirmFrames;
  }

  function result(visible, selectedView, metrics = {}, repEvent = null) {
    return {
      visible,
      phase,
      reps,
      cleanReps: reps, // Form errors are not classified for Arm Raise yet.
      errors: [],
      repEvent,
      metrics: {
        hL: null,
        hR: null,
        outwardL: null,
        outwardR: null,
        leftElbowAngle: null,
        rightElbowAngle: null,
        selectedView,
        phase,
        phaseCandidate,
        phaseConfirmFrames,
        ...metrics,
      },
    };
  }

  return {
    id: "armraise",
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
        return result(false, view ?? "UNKNOWN");
      }

      const leftShoulder = landmarks[JOINTS.LEFT_SHOULDER];
      const rightShoulder = landmarks[JOINTS.RIGHT_SHOULDER];
      const shoulderWidth = distancePx(leftShoulder, rightShoulder, videoWidth, videoHeight);
      if (!(shoulderWidth > 0)) {
        clearCandidate();
        if (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs) cancelCycle();
        return result(false, view);
      }
      if (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs) cancelCycle();
      lastValidAt = nowMs;

      const hL = (leftShoulder.y - landmarks[JOINTS.LEFT_WRIST].y) * videoHeight / shoulderWidth;
      const hR = (rightShoulder.y - landmarks[JOINTS.RIGHT_WRIST].y) * videoHeight / shoulderWidth;
      const side = Math.sign(leftShoulder.x - rightShoulder.x);
      const outwardL = (landmarks[JOINTS.LEFT_WRIST].x - leftShoulder.x) * videoWidth * side /
        shoulderWidth;
      const outwardR = (landmarks[JOINTS.RIGHT_WRIST].x - rightShoulder.x) * videoWidth * -side /
        shoulderWidth;
      const averageHeight = (hL + hR) / 2;
      const leftElbowAngle = anglePx(leftShoulder, landmarks[JOINTS.LEFT_ELBOW],
        landmarks[JOINTS.LEFT_WRIST], videoWidth, videoHeight);
      const rightElbowAngle = anglePx(rightShoulder, landmarks[JOINTS.RIGHT_ELBOW],
        landmarks[JOINTS.RIGHT_WRIST], videoWidth, videoHeight);

      let repEvent = null;
      if (phase === "down") {
        if (!armed) {
          if (confirm("down", Math.max(hL, hR) <= ARMRAISE_DOWN, nowMs)) {
            armed = true;
            clearCandidate();
          }
        } else if (confirm("rising", averageHeight > ARMRAISE_RISING, nowMs)) {
          phase = "rising";
          startedAt = candidateStartedAt;
          peakLeft = hL;
          peakRight = hR;
          clearCandidate();
        }
      } else if (phase === "rising") {
        peakLeft = Math.max(peakLeft, hL);
        peakRight = Math.max(peakRight, hR);
        const enoughHeight = Math.min(hL, hR) >= ARMRAISE_TOP_MIN ||
          (averageHeight >= ARMRAISE_TOP_AVG && Math.min(hL, hR) >= ARMRAISE_TOP_BOTH_MIN);
        const bothAtTop = enoughHeight &&
          Math.min(outwardL, outwardR) >= ARMRAISE_LATERAL_MIN;
        if (bothAtTop) {
          if (confirm("top", true, nowMs)) {
            phase = "top";
            clearCandidate();
          }
        } else if (Math.max(hL, hR) <= ARMRAISE_DOWN) {
          // Returning before TOP is a partial movement, not a repetition.
          if (confirm("down", true, nowMs)) cancelCycle(true);
        } else clearCandidate();
      } else if (phase === "top") {
        peakLeft = Math.max(peakLeft, hL);
        peakRight = Math.max(peakRight, hR);
        if (confirm("lowering",
          hL <= peakLeft - ARMRAISE_LOWERING_DELTA &&
          hR <= peakRight - ARMRAISE_LOWERING_DELTA, nowMs)) {
          phase = "lowering";
          clearCandidate();
        }
      } else if (phase === "lowering" &&
                 confirm("down", Math.max(hL, hR) <= ARMRAISE_DOWN, nowMs)) {
        const durationMs = nowMs - startedAt;
        const counted = durationMs >= minDurationMs && durationMs <= maxDurationMs;
        if (counted) reps += 1;
        repEvent = { counted, clean: counted, errors: [], durationMs };
        cancelCycle(true);
      }

      return result(true, view, {
        hL, hR, outwardL, outwardR, leftElbowAngle, rightElbowAngle,
      }, repEvent);
    },
    reset() {
      cancelCycle();
      reps = 0;
    },
  };
}
