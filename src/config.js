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
  POSE_QUALITY: "pose:quality",
  POSE_VIEW: "pose:view",
  CALIBRATION_START: "calibration:start",
  CALIBRATION_PROGRESS: "calibration:progress",
  CALIBRATION_COMPLETE: "calibration:complete",
  CALIBRATION_RESET: "calibration:reset",
  REP: "rep",
  HINT: "hint",
  PROGRAM_SELECTED: "program:selected",
  WORKOUT_START: "workout:start",
  EXERCISE_START: "exercise:start",
  EXERCISE_COMPLETE: "exercise:complete",
  WORKOUT_REST: "workout:rest",
  WORKOUT_COMPLETE: "workout:complete",
  WORKOUT_RESET: "workout:reset",
});

export const INITIAL_STATE = APP_STATES.SPLASH;

export const VIDEO_WIDTH = 640;
export const VIDEO_HEIGHT = 480;
export const NUM_POSES = 1;
export const VISIBILITY_THRESHOLD = 0.5;
export const TOO_CLOSE_BODY_HEIGHT = 0.95;
export const TOO_CLOSE_TORSO_HEIGHT = 0.4;
export const TOO_CLOSE_SHOULDER_WIDTH = 0.62;
export const FRONT_VIEW_RATIO = 0.55;
export const SIDE_VIEW_RATIO = 0.35;

export const ONE_EURO_MIN_CUTOFF = 1.5;
export const ONE_EURO_BETA = 4;
export const ONE_EURO_D_CUTOFF = 1;
export const TRACKING_LOSS_RESET_MS = 500;

export const CALIBRATION_DURATION_MS = 1500;
export const CALIBRATION_STABILITY_WINDOW_MS = 350;
export const CALIBRATION_MAX_WINDOW_DRIFT = 0.025;
export const CALIBRATION_MAX_TOTAL_DRIFT = 0.04;
export const CALIBRATION_MIN_KNEE_ANGLE = 145;
export const CALIBRATION_MIN_SAMPLES = 10;
export const CALIBRATION_TRIM_FRACTION = 0.1;
export const CALIBRATION_UP_OFFSET = 12;
export const CALIBRATION_UP_MIN = 155;
export const CALIBRATION_UP_MAX = 165;
export const CALIBRATION_START_OFFSET = 15;
export const SQUAT_BOTTOM_THRESHOLD = 125;
export const SQUAT_GOOD_DEPTH = 100;
export const SQUAT_KNEE_WARN = 0.06;
export const SQUAT_KNEE_FAIL = 0.12;
export const SQUAT_LEAN_FAIL_DEG = 55;
export const SQUAT_FAST_MS = 900;
export const SQUAT_NOT_UP_MIN = 145;
export const SQUAT_NOT_UP_MAX = 160;
export const SQUAT_NOT_UP_MS = 1500;
export const SQUAT_FORM_SAMPLE_MAX_ANGLE = 140;
export const HINT_COOLDOWN_MS = 4000;
export const HINT_MIN_DISPLAY_MS = 1500;
export const REST_DURATION_SECONDS = 20;
export const SQUAT_RISING_DELTA = 8;
export const PHASE_CONFIRM_FRAMES = 3;
export const MIN_REP_DURATION_MS = 500;
export const MAX_REP_DURATION_MS = 10000;
export const POSE_MODEL_PATH = new URL(
  "../vendor/mediapipe/models/pose_landmarker_lite.task",
  import.meta.url,
).href;
export const MEDIAPIPE_WASM_PATH = new URL(
  "../vendor/mediapipe/wasm",
  import.meta.url,
).href;
