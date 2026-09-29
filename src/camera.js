import { VIDEO_HEIGHT, VIDEO_WIDTH } from "./config.js";

let stream = null;
let video = null;
let requestId = 0;
let state = "idle";

function cameraError(error) {
  if (error?.code === "CAMERA_CANCELLED") return error;
  const code = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError"
    ? "CAMERA_DENIED"
    : error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError"
      ? "NO_CAMERA"
      : "CAMERA_ERROR";
  return Object.assign(new Error(error?.message || code), { code });
}

export async function startCamera(videoElement) {
  stopCamera();
  const thisRequest = requestId;
  video = videoElement;
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  state = "requesting";

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access requires a supported browser on localhost or HTTPS.");
    }

    const acquired = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: VIDEO_WIDTH },
        height: { ideal: VIDEO_HEIGHT },
      },
      audio: false,
    });

    if (thisRequest !== requestId) {
      acquired.getTracks().forEach((track) => track.stop());
      throw Object.assign(new Error("Camera request cancelled."), { code: "CAMERA_CANCELLED" });
    }

    stream = acquired;
    video.srcObject = stream;
    await video.play();

    if (thisRequest !== requestId) {
      throw Object.assign(new Error("Camera request cancelled."), { code: "CAMERA_CANCELLED" });
    }

    state = "ready";
    return stream;
  } catch (error) {
    if (thisRequest === requestId) stopCamera();
    throw cameraError(error);
  }
}

export function stopCamera() {
  requestId += 1;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video) {
    video.pause();
    video.srcObject = null;
  }
  video = null;
  state = "idle";
}

export function getCameraState() {
  return state;
}
