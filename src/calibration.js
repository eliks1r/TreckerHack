import {
  CALIBRATION_DURATION_MS,
  CALIBRATION_MAX_TOTAL_DRIFT,
  CALIBRATION_MAX_WINDOW_DRIFT,
  CALIBRATION_MIN_KNEE_ANGLE,
  CALIBRATION_MIN_SAMPLES,
  CALIBRATION_STABILITY_WINDOW_MS,
  CALIBRATION_START_OFFSET,
  CALIBRATION_TRIM_FRACTION,
  CALIBRATION_UP_MAX,
  CALIBRATION_UP_MIN,
  CALIBRATION_UP_OFFSET,
} from "./config.js";
import { anglePx, distancePx, midpoint } from "./geometry.js";
import { isUsableLandmark, JOINTS } from "./poseQuality.js";

function trimmedMean(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * CALIBRATION_TRIM_FRACTION);
  const kept = sorted.slice(trim, sorted.length - trim);
  return kept.reduce((sum, value) => sum + value, 0) / kept.length;
}

function neutralSample(landmarks, videoWidth, videoHeight, nowMs) {
  const shoulderMid = midpoint(
    landmarks[JOINTS.LEFT_SHOULDER],
    landmarks[JOINTS.RIGHT_SHOULDER],
  );
  const hipMid = midpoint(landmarks[JOINTS.LEFT_HIP], landmarks[JOINTS.RIGHT_HIP]);
  const kneeAngles = [];
  const legLengths = [];

  for (const [hipIndex, kneeIndex, ankleIndex] of [
    [JOINTS.LEFT_HIP, JOINTS.LEFT_KNEE, JOINTS.LEFT_ANKLE],
    [JOINTS.RIGHT_HIP, JOINTS.RIGHT_KNEE, JOINTS.RIGHT_ANKLE],
  ]) {
    const hip = landmarks[hipIndex];
    const knee = landmarks[kneeIndex];
    const ankle = landmarks[ankleIndex];
    if (![hip, knee, ankle].every(isUsableLandmark)) continue;
    const angle = anglePx(hip, knee, ankle, videoWidth, videoHeight);
    const length = distancePx(hip, knee, videoWidth, videoHeight) +
      distancePx(knee, ankle, videoWidth, videoHeight);
    if (Number.isFinite(angle) && length > 0) {
      kneeAngles.push(angle);
      legLengths.push(length);
    }
  }

  if (!kneeAngles.length) return null;
  return {
    nowMs,
    shoulderMid,
    hipMid,
    theta0: kneeAngles.reduce((sum, angle) => sum + angle, 0) / kneeAngles.length,
    sw0: distancePx(
      landmarks[JOINTS.LEFT_SHOULDER],
      landmarks[JOINTS.RIGHT_SHOULDER],
      videoWidth,
      videoHeight,
    ),
    torsoLen: distancePx(shoulderMid, hipMid, videoWidth, videoHeight),
    legLen: legLengths.reduce((sum, length) => sum + length, 0) / legLengths.length,
  };
}

function movedTooMuch(samples) {
  const recent = samples.filter((sample) =>
    sample.nowMs >= samples.at(-1).nowMs - CALIBRATION_STABILITY_WINDOW_MS);
  const drift = (items, key) => {
    const xs = items.map((item) => item[key].x);
    const ys = items.map((item) => item[key].y);
    return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  };
  const first = samples[0];
  const last = samples.at(-1);
  const totalDrift = Math.max(
    Math.hypot(last.shoulderMid.x - first.shoulderMid.x,
      last.shoulderMid.y - first.shoulderMid.y),
    Math.hypot(last.hipMid.x - first.hipMid.x,
      last.hipMid.y - first.hipMid.y),
  );
  return totalDrift > CALIBRATION_MAX_TOTAL_DRIFT ||
    drift(recent, "shoulderMid") > CALIBRATION_MAX_WINDOW_DRIFT ||
    drift(recent, "hipMid") > CALIBRATION_MAX_WINDOW_DRIFT;
}

export function createCalibration() {
  let samples = [];
  let result = null;

  function reset() {
    const hadState = samples.length > 0 || result !== null;
    samples = [];
    result = null;
    return hadState;
  }

  return {
    reset,
    getResult: () => result,
    update(landmarks, quality, nowMs, videoWidth, videoHeight) {
      if (quality?.framing !== "READY" || !quality.fullBodyVisible ||
          !videoWidth || !videoHeight) {
        const changed = reset();
        return {
          state: "WAITING",
          progress: 0,
          resetReason: changed ? quality?.framing || "INVALID_POSE" : null,
        };
      }
      if (result) return { state: "CALIBRATED", progress: 1, calibration: result };

      const sample = neutralSample(landmarks, videoWidth, videoHeight, nowMs);
      if (!sample || sample.theta0 < CALIBRATION_MIN_KNEE_ANGLE ||
          !Number.isFinite(sample.sw0) || sample.sw0 <= 0 ||
          !Number.isFinite(sample.torsoLen) || sample.torsoLen <= 0) {
        const changed = reset();
        return {
          state: "READY",
          progress: 0,
          resetReason: changed ? "INVALID_STANCE" : null,
        };
      }

      samples.push(sample);
      if (samples.length === 1) return { state: "READY", progress: 0 };
      if (movedTooMuch(samples)) {
        reset();
        return { state: "READY", progress: 0, resetReason: "MOVING" };
      }

      const elapsed = nowMs - samples[0].nowMs;
      const progress = Math.min(1, elapsed / CALIBRATION_DURATION_MS);
      if (elapsed < CALIBRATION_DURATION_MS || samples.length < CALIBRATION_MIN_SAMPLES) {
        return { state: "CALIBRATING", progress };
      }

      const theta0 = trimmedMean(samples.map((item) => item.theta0));
      const up = Math.max(CALIBRATION_UP_MIN,
        Math.min(CALIBRATION_UP_MAX, theta0 - CALIBRATION_UP_OFFSET));
      result = Object.freeze({
        theta0,
        sw0: trimmedMean(samples.map((item) => item.sw0)),
        torsoLen: trimmedMean(samples.map((item) => item.torsoLen)),
        legLen: trimmedMean(samples.map((item) => item.legLen)),
        timestamp: Date.now(),
        derived: Object.freeze({ up, start: up - CALIBRATION_START_OFFSET }),
      });
      samples = [];
      return { state: "CALIBRATED", progress: 1, calibration: result };
    },
  };
}
