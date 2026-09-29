/**
 * MOTION CORE
 * Changes to pose tracking require regression testing.
 * See CORE_OWNERSHIP.md and CORE_TESTS.md.
 */
import {
  MEDIAPIPE_WASM_PATH,
  NUM_POSES,
  POSE_MODEL_PATH,
  TRACKING_LOSS_RESET_MS,
} from "./config.js";
import { createLandmarkSmoother } from "./filter.js";

let landmarker = null;
let loopVideo = null;
let frameHandle = null;
let loopId = 0;
let initId = 0;
let lastVideoTime = -1;
let lastTimestamp = -1;
let recentFrames = [];
let lastBodyTime = null;
let smootherResetAfterLoss = false;
const smoother = createLandmarkSmoother();

function cancelled() {
  return Object.assign(new Error("Pose initialization cancelled."), { code: "POSE_CANCELLED" });
}

export async function initPose() {
  disposePose();
  const thisInit = initId;
  let instance = null;

  try {
    const { FilesetResolver, PoseLandmarker } = await import(
      "../vendor/mediapipe/vision_bundle.mjs"
    );
    if (thisInit !== initId) throw cancelled();

    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
    if (thisInit !== initId) throw cancelled();

    const options = (delegate) => ({
      baseOptions: { modelAssetPath: POSE_MODEL_PATH, delegate },
      runningMode: "VIDEO",
      numPoses: NUM_POSES,
    });

    let delegate = "GPU";
    try {
      instance = await PoseLandmarker.createFromOptions(fileset, options("GPU"));
    } catch {
      if (thisInit !== initId) throw cancelled();
      delegate = "CPU";
      instance = await PoseLandmarker.createFromOptions(fileset, options("CPU"));
    }

    if (thisInit !== initId) {
      instance.close();
      throw cancelled();
    }

    landmarker = instance;
    return { delegate };
  } catch (error) {
    if (error?.code === "POSE_CANCELLED") throw error;
    throw Object.assign(new Error("Could not load the pose model."), {
      code: "MODEL_FAILED",
      cause: error,
    });
  }
}

export function startPoseLoop(videoElement, onResult, onError) {
  if (!landmarker) throw new Error("Pose model is not initialized.");
  stopPoseLoop();
  const thisLoop = loopId;
  loopVideo = videoElement;
  lastVideoTime = -1;
  lastTimestamp = -1;
  recentFrames = [];
  lastBodyTime = null;
  smootherResetAfterLoss = false;
  smoother.reset();
  const useVideoFrames = typeof videoElement.requestVideoFrameCallback === "function";

  function schedule() {
    if (thisLoop !== loopId) return;
    frameHandle = useVideoFrames
      ? videoElement.requestVideoFrameCallback(step)
      : requestAnimationFrame(step);
  }

  function step(now, metadata) {
    frameHandle = null;
    if (thisLoop !== loopId) return;

    try {
      const frameTime = metadata?.mediaTime ?? videoElement.currentTime;
      if (videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          frameTime !== lastVideoTime) {
        lastVideoTime = frameTime;
        const timestampMs = Math.max(now, lastTimestamp + 1);
        lastTimestamp = timestampMs;
        const result = landmarker.detectForVideo(videoElement, timestampMs);
        const rawLandmarks = result.landmarks[0] || null;
        let landmarks = null;
        if (rawLandmarks) {
          lastBodyTime = timestampMs;
          smootherResetAfterLoss = false;
          landmarks = smoother.smooth(rawLandmarks, timestampMs);
        } else if (lastBodyTime !== null && !smootherResetAfterLoss &&
                   timestampMs - lastBodyTime >= TRACKING_LOSS_RESET_MS) {
          smoother.reset();
          smootherResetAfterLoss = true;
        }

        recentFrames.push(now);
        while (recentFrames.length > 1 && now - recentFrames[0] > 1000) {
          recentFrames.shift();
        }
        const span = now - recentFrames[0];
        const fps = span > 0 ? Math.round((recentFrames.length - 1) * 1000 / span) : 0;
        onResult({ landmarks, fps, timestampMs });
      }
      schedule();
    } catch (error) {
      stopPoseLoop();
      onError?.(Object.assign(new Error("Pose tracking stopped."), {
        code: "MODEL_FAILED",
        cause: error,
      }));
    }
  }

  schedule();
}

export function stopPoseLoop() {
  loopId += 1;
  if (frameHandle !== null && loopVideo) {
    if (typeof loopVideo.cancelVideoFrameCallback === "function") {
      loopVideo.cancelVideoFrameCallback(frameHandle);
    } else {
      cancelAnimationFrame(frameHandle);
    }
  }
  frameHandle = null;
  loopVideo = null;
  recentFrames = [];
  lastBodyTime = null;
  smootherResetAfterLoss = false;
  smoother.reset();
}

export function disposePose() {
  initId += 1;
  stopPoseLoop();
  try {
    landmarker?.close();
  } catch {
    // Cleanup must not prevent the camera from stopping or the UI from leaving.
  }
  landmarker = null;
}
