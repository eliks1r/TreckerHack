export const APP_STATES = Object.freeze({
  SPLASH: "SPLASH",
  CAMERA: "CAMERA",
});

export const APP_EVENTS = Object.freeze({
  STATE_CHANGED: "app:state-changed",
  CAMERA_READY: "camera:ready",
  CAMERA_ERROR: "camera:error",
  POSE_READY: "pose:ready",
  POSE_RESULT: "pose:result",
  POSE_ERROR: "pose:error",
  POSE_BODY_FOUND: "pose:body-found",
  POSE_BODY_LOST: "pose:body-lost",
});

export const INITIAL_STATE = APP_STATES.SPLASH;

export const VIDEO_WIDTH = 640;
export const VIDEO_HEIGHT = 480;
export const NUM_POSES = 1;
export const VISIBILITY_THRESHOLD = 0.5;
export const POSE_MODEL_PATH = new URL(
  "../vendor/mediapipe/models/pose_landmarker_lite.task",
  import.meta.url,
).href;
export const MEDIAPIPE_WASM_PATH = new URL(
  "../vendor/mediapipe/wasm",
  import.meta.url,
).href;
