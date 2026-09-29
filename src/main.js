import { APP_EVENTS, APP_STATES, INITIAL_STATE } from "./config.js";
import { emit, on } from "./events.js";
import { startCamera, stopCamera } from "./camera.js";
import { initPose, startPoseLoop, stopPoseLoop, disposePose } from "./pose.js";
import { clearPose, drawPose, sizePoseCanvas } from "./drawPose.js";
import { assessPoseQuality } from "./poseQuality.js";
import { createCalibration } from "./calibration.js";

const screens = {
  [APP_STATES.SPLASH]: document.querySelector("#splash-screen"),
  [APP_STATES.CAMERA]: document.querySelector("#camera-screen"),
};

let currentState = INITIAL_STATE;
let sessionId = 0;
let bodyVisible = false;
let lastView = "UNKNOWN";
let lastCalibrationState = "WAITING";
const calibration = createCalibration();

const video = document.querySelector("#camera-video");
const canvas = document.querySelector("#pose-canvas");
const emptyView = document.querySelector("#camera-empty");
const status = document.querySelector("#camera-status");
const help = document.querySelector("#camera-help");
const fpsIndicator = document.querySelector("#fps-indicator");
const cameraFrame = document.querySelector(".camera-frame");
document.querySelector(".stage-label").textContent = "G2.2 / CALIBRATION";

// Keep the G2.1 markup intact; the calibration readout belongs to this screen.
const calibrationHud = document.createElement("div");
calibrationHud.className = "calibration-hud";
const viewIndicator = document.createElement("span");
viewIndicator.className = "view-indicator";
viewIndicator.textContent = "VIEW: UNKNOWN";
const progressGroup = document.createElement("div");
progressGroup.className = "calibration-progress";
const progressLabel = document.createElement("span");
progressLabel.className = "calibration-progress-label";
progressLabel.textContent = "CALIBRATION 0%";
const progressTrack = document.createElement("div");
progressTrack.className = "calibration-progress-track";
progressTrack.setAttribute("role", "progressbar");
progressTrack.setAttribute("aria-label", "Calibration progress");
progressTrack.setAttribute("aria-valuemin", "0");
progressTrack.setAttribute("aria-valuemax", "100");
progressTrack.setAttribute("aria-valuenow", "0");
const progressFill = document.createElement("div");
progressFill.className = "calibration-progress-fill";
progressTrack.append(progressFill);
progressGroup.append(progressLabel, progressTrack);
calibrationHud.append(viewIndicator, progressGroup);
cameraFrame.after(calibrationHud);

const errorMessages = {
  CAMERA_DENIED: [
    "Camera access is blocked.",
    "Allow camera access in your browser's site settings, then return home and press START again.",
  ],
  NO_CAMERA: [
    "No camera found.",
    "Connect a webcam or use a device with a camera, then try again.",
  ],
  CAMERA_ERROR: [
    "Camera could not start.",
    "Check that the camera is available and use localhost or HTTPS, then try again.",
  ],
  MODEL_FAILED: [
    "Pose tracking could not start.",
    "Check the local MediaPipe files and reload the page before trying again.",
  ],
};

function showStatus(message, detail = "", isError = false) {
  if (status.textContent !== message) status.textContent = message;
  status.classList.toggle("is-error", isError);
  if (help.textContent !== detail) help.textContent = detail;
  help.hidden = !detail;
}

function showProgress(progress, complete = false) {
  const percent = Math.round(progress * 100);
  const current = String(percent);
  if (progressTrack.getAttribute("aria-valuenow") !== current) {
    progressTrack.setAttribute("aria-valuenow", current);
    progressLabel.textContent = `CALIBRATION ${percent}%`;
    progressFill.style.width = `${percent}%`;
  }
  calibrationHud.classList.toggle("is-complete", complete);
}

function showPoseGuidance({ quality, calibrationState, progress, resetReason }) {
  showProgress(progress, calibrationState === "CALIBRATED");

  if (quality.framing === "NO_BODY") {
    showStatus("Stand in front of the camera");
  } else if (quality.framing === "PARTIAL_BODY") {
    showStatus("Step back so your full body is visible");
  } else if (quality.framing === "TOO_CLOSE") {
    showStatus("Move farther from the camera");
  } else if (calibrationState === "CALIBRATED") {
    showStatus("Calibration complete");
  } else if (calibrationState === "CALIBRATING") {
    showStatus("Calibrating... hold still");
  } else if (resetReason === "MOVING") {
    showStatus("Hold still for calibration", "Movement detected. Keep your shoulders and hips steady.");
  } else if (resetReason === "INVALID_STANCE") {
    showStatus("Hold still for calibration", "Stand straight with at least one leg visible.");
  } else {
    showStatus("Hold still for calibration");
  }
}

function showError(error) {
  const [message, detail] = errorMessages[error.code] || errorMessages.CAMERA_ERROR;
  showStatus(message, detail, true);
  fpsIndicator.textContent = "FPS --";
}

function renderState(state) {
  for (const [name, element] of Object.entries(screens)) {
    element.hidden = name !== state;
  }

  document.querySelector(".footer span:last-child").textContent =
    state === APP_STATES.CAMERA ? "G2.2 / CALIBRATION" : "G2.2 / SPLASH";
}

function setState(nextState) {
  if (!screens[nextState] || nextState === currentState) return;
  currentState = nextState;
  emit(APP_EVENTS.STATE_CHANGED, { state: nextState });
}

on(APP_EVENTS.STATE_CHANGED, ({ state }) => renderState(state));

on(APP_EVENTS.CAMERA_READY, () => {
  emptyView.hidden = true;
  showStatus("Loading pose model...");
});
on(APP_EVENTS.CAMERA_ERROR, showError);
on(APP_EVENTS.POSE_READY, () => showStatus("Stand in front of the camera"));
on(APP_EVENTS.POSE_ERROR, showError);
on(APP_EVENTS.POSE_VIEW, ({ view }) => {
  viewIndicator.textContent = `VIEW: ${view}`;
});
on(APP_EVENTS.POSE_QUALITY, showPoseGuidance);
on(APP_EVENTS.POSE_RESULT, ({ landmarks, fps, timestampMs }) => {
  const quality = assessPoseQuality(landmarks, video.videoWidth, video.videoHeight);
  const calibrationStatus = calibration.update(
    landmarks,
    quality,
    timestampMs,
    video.videoWidth,
    video.videoHeight,
  );

  sizePoseCanvas(canvas, video);
  drawPose(canvas, landmarks, quality);
  fpsIndicator.textContent = fps ? `FPS ${fps}` : "FPS --";

  const found = quality.bodyDetected;
  if (found !== bodyVisible) {
    bodyVisible = found;
    emit(found ? APP_EVENTS.POSE_BODY_FOUND : APP_EVENTS.POSE_BODY_LOST);
  }
  if (quality.view !== lastView) {
    lastView = quality.view;
    emit(APP_EVENTS.POSE_VIEW, { view: lastView, ratio: quality.metrics.viewRatio });
  }
  if (calibrationStatus.resetReason) {
    emit(APP_EVENTS.CALIBRATION_RESET, { reason: calibrationStatus.resetReason });
  }
  if (calibrationStatus.state === "CALIBRATING") {
    if (lastCalibrationState !== "CALIBRATING") emit(APP_EVENTS.CALIBRATION_START);
    emit(APP_EVENTS.CALIBRATION_PROGRESS, { progress: calibrationStatus.progress });
  } else if (calibrationStatus.state === "CALIBRATED" &&
             lastCalibrationState !== "CALIBRATED") {
    emit(APP_EVENTS.CALIBRATION_COMPLETE, calibrationStatus.calibration);
  }
  lastCalibrationState = calibrationStatus.state;
  emit(APP_EVENTS.POSE_QUALITY, {
    quality,
    calibrationState: calibrationStatus.state,
    progress: calibrationStatus.progress,
    resetReason: calibrationStatus.resetReason,
  });
});

async function enterCamera() {
  const thisSession = ++sessionId;
  setState(APP_STATES.CAMERA);
  emptyView.hidden = false;
  bodyVisible = false;
  calibration.reset();
  lastCalibrationState = "WAITING";
  lastView = "UNKNOWN";
  viewIndicator.textContent = "VIEW: UNKNOWN";
  showProgress(0);
  fpsIndicator.textContent = "FPS --";
  showStatus("Waiting for camera permission...");
  document.querySelector("#back-button").focus();

  try {
    await startCamera(video);
    if (thisSession !== sessionId) return;
    emit(APP_EVENTS.CAMERA_READY);

    const { delegate } = await initPose();
    if (thisSession !== sessionId) return;
    emit(APP_EVENTS.POSE_READY, { delegate });

    startPoseLoop(
      video,
      (result) => {
        if (thisSession === sessionId) emit(APP_EVENTS.POSE_RESULT, result);
      },
      (error) => {
        if (thisSession === sessionId) emit(APP_EVENTS.POSE_ERROR, error);
      },
    );
  } catch (error) {
    if (thisSession !== sessionId) return;
    emit(
      error.code?.startsWith("CAMERA") || error.code === "NO_CAMERA"
        ? APP_EVENTS.CAMERA_ERROR
        : APP_EVENTS.POSE_ERROR,
      error,
    );
  }
}

function leaveCamera() {
  sessionId += 1;
  stopPoseLoop();
  stopCamera();
  disposePose();
  clearPose(canvas);
  emptyView.hidden = false;
  bodyVisible = false;
  calibration.reset();
  lastCalibrationState = "WAITING";
  lastView = "UNKNOWN";
  viewIndicator.textContent = "VIEW: UNKNOWN";
  showProgress(0);
  fpsIndicator.textContent = "FPS --";
  setState(APP_STATES.SPLASH);
}

document.querySelector("#start-button").addEventListener("click", enterCamera);
document.querySelector("#back-button").addEventListener("click", () => {
  leaveCamera();
  document.querySelector("#start-button").focus();
});
window.addEventListener("pagehide", () => {
  if (currentState === APP_STATES.CAMERA) leaveCamera();
});

renderState(currentState);
