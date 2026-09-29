import {
  FRONT_VIEW_RATIO,
  SIDE_VIEW_RATIO,
  TOO_CLOSE_BODY_HEIGHT,
  TOO_CLOSE_SHOULDER_WIDTH,
  TOO_CLOSE_TORSO_HEIGHT,
  VISIBILITY_THRESHOLD,
} from "./config.js";
import { distancePx, midpoint } from "./geometry.js";

export const JOINTS = Object.freeze({
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
});

const CORE_REQUIRED = [
  "LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP",
];
export const FULL_BODY_REQUIRED = Object.freeze([
  ...CORE_REQUIRED, "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE", "RIGHT_ANKLE",
]);
export const UPPER_BODY_REQUIRED = Object.freeze([
  ...CORE_REQUIRED, "LEFT_ELBOW", "RIGHT_ELBOW", "LEFT_WRIST", "RIGHT_WRIST",
]);

export function isUsableLandmark(point) {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1 &&
    (point.visibility ?? 0) >= VISIBILITY_THRESHOLD);
}

export function assessPoseQuality(landmarks, videoWidth, videoHeight) {
  const usable = Array.isArray(landmarks)
    ? landmarks.filter(isUsableLandmark)
    : [];
  const bodyDetected = usable.length > 0;
  const has = (name) => isUsableLandmark(landmarks?.[JOINTS[name]]);
  const coreVisible = CORE_REQUIRED.every(has);
  const leftLegVisible = has("LEFT_KNEE") && has("LEFT_ANKLE");
  const rightLegVisible = has("RIGHT_KNEE") && has("RIGHT_ANKLE");
  const leftArmVisible = has("LEFT_ELBOW") && has("LEFT_WRIST");
  const rightArmVisible = has("RIGHT_ELBOW") && has("RIGHT_WRIST");
  const fullBodyVisible = coreVisible && (leftLegVisible || rightLegVisible);
  const upperBodyVisible = coreVisible && (leftArmVisible || rightArmVisible);
  const missingJoints = bodyDetected
    ? FULL_BODY_REQUIRED.filter((name) => !has(name))
    : [...FULL_BODY_REQUIRED];

  let bodyHeight = 0;
  let torsoHeight = 0;
  let shoulderWidthRatio = 0;
  let shoulderWidthPx = null;
  let torsoLengthPx = null;
  let viewRatio = null;
  let view = "UNKNOWN";

  if (bodyDetected) {
    const ys = usable.map((point) => point.y);
    bodyHeight = Math.max(...ys) - Math.min(...ys);
  }

  if (coreVisible && videoWidth > 0 && videoHeight > 0) {
    const leftShoulder = landmarks[JOINTS.LEFT_SHOULDER];
    const rightShoulder = landmarks[JOINTS.RIGHT_SHOULDER];
    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const hipMid = midpoint(landmarks[JOINTS.LEFT_HIP], landmarks[JOINTS.RIGHT_HIP]);
    shoulderWidthPx = distancePx(leftShoulder, rightShoulder, videoWidth, videoHeight);
    torsoLengthPx = distancePx(shoulderMid, hipMid, videoWidth, videoHeight);
    torsoHeight = torsoLengthPx / videoHeight;
    shoulderWidthRatio = shoulderWidthPx / videoWidth;
    if (torsoLengthPx > 0) {
      viewRatio = shoulderWidthPx / torsoLengthPx;
      view = viewRatio > FRONT_VIEW_RATIO
        ? "FRONT"
        : viewRatio < SIDE_VIEW_RATIO ? "SIDE" : "UNKNOWN";
    }
  }

  const tooClose = bodyHeight > TOO_CLOSE_BODY_HEIGHT ||
    torsoHeight > TOO_CLOSE_TORSO_HEIGHT ||
    shoulderWidthRatio > TOO_CLOSE_SHOULDER_WIDTH;
  const framing = !bodyDetected
    ? "NO_BODY"
    : tooClose ? "TOO_CLOSE" : fullBodyVisible ? "READY" : "PARTIAL_BODY";

  return {
    bodyDetected,
    fullBodyVisible,
    upperBodyVisible,
    missingJoints,
    framing,
    view,
    metrics: {
      bodyHeight,
      torsoHeight,
      shoulderWidthRatio,
      shoulderWidthPx,
      torsoLengthPx,
      viewRatio,
    },
  };
}
