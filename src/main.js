import { APP_EVENTS, APP_STATES, INITIAL_STATE } from "./config.js";
import { emit, on } from "./events.js";
import { startCamera, stopCamera } from "./camera.js";
import { initPose, startPoseLoop, stopPoseLoop, disposePose } from "./pose.js";
import { clearPose, drawPose, sizePoseCanvas } from "./drawPose.js";

const screens = {
  [APP_STATES.SPLASH]: document.querySelector("#splash-screen"),
  [APP_STATES.CAMERA]: document.querySelector("#camera-screen"),
};

let currentState = INITIAL_STATE;
let sessionId = 0;
let bodyVisible = false;

const video = document.querySelector("#camera-video");
const canvas = document.querySelector("#pose-canvas");
const emptyView = document.querySelector("#camera-empty");
const status = document.querySelector("#camera-status");
const help = document.querySelector("#camera-help");
const fpsIndicator = document.querySelector("#fps-indicator");

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
  status.textContent = message;
  status.classList.toggle("is-error", isError);
  help.textContent = detail;
  help.hidden = !detail;
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
    state === APP_STATES.CAMERA ? "G2.1 / CAMERA" : "G2.1 / SPLASH";
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
on(APP_EVENTS.POSE_BODY_FOUND, () => showStatus("Body detected"));
on(APP_EVENTS.POSE_BODY_LOST, () => showStatus("Stand in front of the camera"));
on(APP_EVENTS.POSE_ERROR, showError);
on(APP_EVENTS.POSE_RESULT, ({ landmarks, fps }) => {
  sizePoseCanvas(canvas, video);
  drawPose(canvas, landmarks);
  fpsIndicator.textContent = fps ? `FPS ${fps}` : "FPS --";

  const found = Boolean(landmarks?.length);
  if (found !== bodyVisible) {
    bodyVisible = found;
    emit(found ? APP_EVENTS.POSE_BODY_FOUND : APP_EVENTS.POSE_BODY_LOST);
  }
});

async function enterCamera() {
  const thisSession = ++sessionId;
  setState(APP_STATES.CAMERA);
  emptyView.hidden = false;
  bodyVisible = false;
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
