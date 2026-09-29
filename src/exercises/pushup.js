import {
  PHASE_CONFIRM_FRAMES,
  PUSHUP_BOTTOM_DEG,
  PUSHUP_DESCEND_DEG,
  PUSHUP_MAX_REP_MS,
  PUSHUP_MIN_REP_MS,
  PUSHUP_PROFILE_MAX_TILT_DEG,
  PUSHUP_RISING_DELTA,
  PUSHUP_UP_DEG,
  TRACKING_LOSS_RESET_MS,
} from "../config.js";
import { anglePx } from "../geometry.js";
import { isUsableLandmark, JOINTS } from "../poseQuality.js";

const SIDES = Object.freeze({
  LEFT: [JOINTS.LEFT_SHOULDER, JOINTS.LEFT_ELBOW, JOINTS.LEFT_WRIST,
    JOINTS.LEFT_HIP, JOINTS.LEFT_ANKLE],
  RIGHT: [JOINTS.RIGHT_SHOULDER, JOINTS.RIGHT_ELBOW, JOINTS.RIGHT_WRIST,
    JOINTS.RIGHT_HIP, JOINTS.RIGHT_ANKLE],
});

function sideScore(landmarks, side) {
  const joints = SIDES[side];
  return {
    visibility: joints.reduce((total, index) =>
      total + Math.max(0, landmarks?.[index]?.visibility ?? 0), 0) / joints.length,
    usable: joints.every((index) => isUsableLandmark(landmarks?.[index])),
  };
}

export function createPushup(config = {}) {
  const confirmFrames = config.confirmFrames ?? PHASE_CONFIRM_FRAMES;
  const lossResetMs = config.lossResetMs ?? TRACKING_LOSS_RESET_MS;
  const minDurationMs = config.minDurationMs ?? PUSHUP_MIN_REP_MS;
  const maxDurationMs = config.maxDurationMs ?? PUSHUP_MAX_REP_MS;

  let phase = "up";
  let reps = 0;
  let armed = false;
  let selectedSide = null;
  let lockedSide = null;
  let minElbowAngle = null;
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
    phase = "up";
    armed = keepArmed;
    lockedSide = null;
    minElbowAngle = null;
    startedAt = null;
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

  function result(visible, elbowAngle = null, bodyLineAngle = null,
    selectedView = "UNKNOWN", repEvent = null, completedMinAngle = null) {
    return {
      visible,
      phase,
      reps,
      cleanReps: reps, // Push-up form quality is not classified yet.
      errors: [],
      repEvent,
      metrics: {
        elbowAngle,
        bodyLineAngle,
        minElbowAngle: completedMinAngle ?? minElbowAngle,
        selectedSide,
        selectedView,
        phase,
        phaseCandidate,
        phaseConfirmFrames,
      },
    };
  }

  return {
    id: "pushup",
    view: "SIDE",
    analyze(landmarks, context = {}) {
      const { videoWidth, videoHeight, nowMs, view } = context;
      const left = sideScore(landmarks, "LEFT");
      const right = sideScore(landmarks, "RIGHT");
      const preferred = left.visibility >= right.visibility ? "LEFT" : "RIGHT";
      const other = preferred === "LEFT" ? "RIGHT" : "LEFT";
      const scores = { LEFT: left, RIGHT: right };
      selectedSide = lockedSide || (scores[preferred].usable ? preferred :
        scores[other].usable ? other : preferred);
      const joints = SIDES[selectedSide];
      const usable = scores[selectedSide].usable;
      let bodyLineAngle = null;
      let sideProfile = false;
      if (usable && videoWidth > 0 && videoHeight > 0) {
        const [shoulder, , , hip, ankle] = joints.map((index) => landmarks[index]);
        bodyLineAngle = anglePx(shoulder, hip, ankle, videoWidth, videoHeight);
        // Only recover an UNKNOWN generic view when one side's core is occluded and
        // the visible shoulder/hip/ankle form a horizontal side profile.
        const opposite = selectedSide === "LEFT" ? "RIGHT" : "LEFT";
        const oppositeCoreOccluded = !isUsableLandmark(landmarks?.[SIDES[opposite][0]]) ||
          !isUsableLandmark(landmarks?.[SIDES[opposite][3]]);
        const torsoDx = (shoulder.x - hip.x) * videoWidth;
        const torsoDy = (shoulder.y - hip.y) * videoHeight;
        const tiltDeg = Math.atan2(Math.abs(torsoDy), Math.abs(torsoDx)) * 180 / Math.PI;
        sideProfile = oppositeCoreOccluded && tiltDeg <= PUSHUP_PROFILE_MAX_TILT_DEG;
      }
      const selectedView = view === "SIDE" || (view === "UNKNOWN" && sideProfile)
        ? "SIDE" : view ?? "UNKNOWN";
      const valid = selectedView === "SIDE" && usable &&
        Number.isFinite(nowMs) && videoWidth > 0 && videoHeight > 0 &&
        Number.isFinite(bodyLineAngle);

      if (!valid) {
        clearCandidate();
        if (view === "FRONT" || !Number.isFinite(nowMs) ||
            (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs)) cancelCycle();
        return result(false, null, bodyLineAngle, selectedView);
      }
      if (lastValidAt !== null && nowMs - lastValidAt >= lossResetMs) cancelCycle();
      lastValidAt = nowMs;
      const [shoulderIndex, elbowIndex, wristIndex] = joints;
      const elbowAngle = anglePx(landmarks[shoulderIndex], landmarks[elbowIndex],
        landmarks[wristIndex], videoWidth, videoHeight);
      if (!Number.isFinite(elbowAngle)) {
        clearCandidate();
        return result(false, null, bodyLineAngle, selectedView);
      }

      let repEvent = null;
      let completedMinAngle = null;
      if (phase === "up") {
        if (!armed) {
          if (confirm("up", elbowAngle >= PUSHUP_UP_DEG, nowMs)) {
            armed = true;
            clearCandidate();
          }
        } else if (confirm("descending", elbowAngle < PUSHUP_DESCEND_DEG, nowMs)) {
          phase = "descending";
          startedAt = candidateStartedAt;
          minElbowAngle = elbowAngle;
          lockedSide = selectedSide;
          clearCandidate();
        }
      } else if (phase === "descending") {
        minElbowAngle = Math.min(minElbowAngle, elbowAngle);
        if (elbowAngle <= PUSHUP_BOTTOM_DEG) {
          if (confirm("bottom", true, nowMs)) {
            phase = "bottom";
            clearCandidate();
          }
        } else if (elbowAngle >= PUSHUP_UP_DEG) {
          if (confirm("up", true, nowMs)) cancelCycle(true);
        } else clearCandidate();
      } else if (phase === "bottom") {
        minElbowAngle = Math.min(minElbowAngle, elbowAngle);
        if (confirm("rising", elbowAngle > minElbowAngle + PUSHUP_RISING_DELTA, nowMs)) {
          phase = "rising";
          clearCandidate();
        }
      } else if (phase === "rising") {
        minElbowAngle = Math.min(minElbowAngle, elbowAngle);
        if (confirm("up", elbowAngle >= PUSHUP_UP_DEG, nowMs)) {
          const durationMs = nowMs - startedAt;
          const counted = durationMs >= minDurationMs && durationMs <= maxDurationMs &&
            minElbowAngle <= PUSHUP_BOTTOM_DEG;
          if (counted) reps += 1;
          repEvent = { counted, clean: counted, errors: [], durationMs,
            minAngle: minElbowAngle };
          completedMinAngle = minElbowAngle;
          cancelCycle(true);
        }
      }
      return result(true, elbowAngle, bodyLineAngle, selectedView, repEvent,
        completedMinAngle);
    },
    reset() {
      cancelCycle();
      reps = 0;
      selectedSide = null;
    },
  };
}
