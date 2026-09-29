import { APP_EVENTS, APP_STATES, HINT_COOLDOWN_MS, HINT_MIN_DISPLAY_MS, INITIAL_STATE, REST_DURATION_SECONDS } from "./config.js";
import { emit, on } from "./events.js";
import { startCamera, stopCamera } from "./camera.js";
import { initPose, startPoseLoop, stopPoseLoop, disposePose } from "./pose.js";
import { clearPose, drawPose, sizePoseCanvas } from "./drawPose.js";
import { assessPoseQuality } from "./poseQuality.js";
import { createCalibration } from "./calibration.js";
import { createExerciseEngine } from "./engine.js";
import { EXERCISE_NAMES, PROGRAMS } from "./programs.js";
import { createWorkout } from "./workout.js";

const screens = {
  [APP_STATES.SPLASH]: document.querySelector("#splash-screen"),
  [APP_STATES.CAMERA]: document.querySelector("#camera-screen"),
};

let currentState = INITIAL_STATE;
let sessionId = 0;
let bodyVisible = false;
let lastView = "UNKNOWN";
let lastCalibrationState = "WAITING";
let squatMode = false;
let flowView = "CALIBRATION";
let sessionCalibration = null;
let selectedProgram = null;
let workout = null;
let restTimerHandle = null;
let cleanStreak = 0;
let feedback = null;
let activeFormError = null;
const shownHints = new Map();
const calibration = createCalibration();
const engine = createExerciseEngine();

const video = document.querySelector("#camera-video");
const canvas = document.querySelector("#pose-canvas");
const emptyView = document.querySelector("#camera-empty");
const status = document.querySelector("#camera-status");
const help = document.querySelector("#camera-help");
const fpsIndicator = document.querySelector("#fps-indicator");
const cameraFrame = document.querySelector(".camera-frame");
const cameraHeading = document.querySelector(".camera-heading");
const cameraStatusRow = document.querySelector(".camera-status-row");
const programsView = document.querySelector("#programs-view");
const workoutHeading = document.querySelector("#workout-heading");
const restView = document.querySelector("#rest-view");
const unavailableView = document.querySelector("#unavailable-view");
const resultsView = document.querySelector("#results-view");
document.querySelector(".stage-label").textContent = "TRAINING / DEVELOPMENT";

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

const squatPanel = document.createElement("section");
squatPanel.className = "squat-panel";
squatPanel.setAttribute("aria-label", "Squat repetition counter");
squatPanel.hidden = true;
const squatTitle = document.createElement("h2");
squatTitle.textContent = "SQUAT";
const squatStats = document.createElement("div");
squatStats.className = "squat-stats";

function makeSquatStat(label, initialValue, className = "") {
  const item = document.createElement("div");
  item.className = `squat-stat ${className}`.trim();
  const name = document.createElement("span");
  name.className = "squat-stat-label";
  name.textContent = label;
  const value = document.createElement("strong");
  value.className = "squat-stat-value";
  value.textContent = initialValue;
  item.append(name, value);
  squatStats.append(item);
  return value;
}

const repValue = makeSquatStat("REPS", "0", "squat-reps");
const cleanValue = makeSquatStat("CLEAN REPS", "0", "squat-clean");
const phaseValue = makeSquatStat("PHASE", "UP");
const angleValue = makeSquatStat("KNEE ANGLE", "—");
const squatViewValue = makeSquatStat("VIEW", "UNKNOWN");
const formPanel = document.createElement("div");
formPanel.className = "form-panel";
formPanel.setAttribute("aria-live", "polite");
const formLabel = document.createElement("span");
formLabel.className = "form-label";
formLabel.textContent = "FORM CHECK";
const formTitle = document.createElement("strong");
formTitle.className = "form-title";
formTitle.textContent = "Ready for squat";
const formHint = document.createElement("span");
formHint.className = "form-hint";
formPanel.append(formLabel, formTitle, formHint);
const endSquatButton = document.createElement("button");
endSquatButton.className = "secondary-button squat-end-button";
endSquatButton.type = "button";
endSquatButton.textContent = "← RETURN TO PROGRAMS";
squatPanel.append(squatTitle, squatStats, formPanel, endSquatButton);
calibrationHud.after(squatPanel);

const corrections = {
  SQ_KNEE_TOE: ["KNEES TOO FAR FORWARD", "Knees move too far forward — push your hips back"],
  SQ_LEAN: ["TORSO LEAN", "Torso is leaning too far — keep your chest higher"],
  SQ_SHALLOW: ["SQUAT DEPTH", "Sit deeper — thighs closer to parallel with the floor"],
  SQ_NOT_UP: ["STAND FULLY", "Stand fully upright at the top"],
  SQ_FAST: ["SLOW DOWN", "Slow down — control the descent"],
};
const errorOrder = ["SQ_KNEE_TOE", "SQ_LEAN", "SQ_SHALLOW", "SQ_NOT_UP", "SQ_FAST"];

function resetFormFeedback() {
  cleanStreak = 0;
  feedback = null;
  activeFormError = null;
  shownHints.clear();
  cleanValue.textContent = "0";
  formTitle.textContent = "Ready for squat";
  formHint.textContent = "";
  formPanel.classList.remove("is-critical", "is-minor", "is-positive");
}

function renderFormFeedback(errors, quality, nowMs, repEvent) {
  let chosen = null;
  if (quality.framing !== "READY") {
    chosen = { code: quality.framing, title: {
      NO_BODY: "Stand in front of the camera",
      PARTIAL_BODY: "Step back so your full body is visible",
      TOO_CLOSE: "Move farther from the camera",
    }[quality.framing], severity: "position" };
  } else if (quality.view !== "SIDE") {
    chosen = { code: "VIEW", title: "Turn sideways to the camera", severity: "position" };
  } else {
    const issue = errorOrder.map((code) => errors.find((error) =>
      error.code === code && error.severity === "critical")).find(Boolean) ||
      errorOrder.map((code) => errors.find((error) => error.code === code)).find(Boolean);
    if (issue) chosen = { ...issue, title: corrections[issue.code][0], hint: corrections[issue.code][1] };
  }

  if (chosen?.severity === "position") {
    feedback = { ...chosen, since: nowMs, until: nowMs + HINT_MIN_DISPLAY_MS };
  } else if (chosen) {
    const same = feedback?.code === chosen.code;
    const onCooldown = nowMs - (shownHints.get(chosen.code) ?? -Infinity) < HINT_COOLDOWN_MS;
    if (same) {
      feedback.until = Math.max(feedback.until, nowMs + HINT_MIN_DISPLAY_MS);
      feedback.severity = chosen.severity;
    } else if (!onCooldown && (!feedback || nowMs >= feedback.until ||
               feedback.severity === "position" ||
               (chosen.severity === "critical" && feedback.severity !== "critical"))) {
      feedback = { ...chosen, since: nowMs, until: nowMs + HINT_MIN_DISPLAY_MS };
      shownHints.set(chosen.code, nowMs);
    }
  } else if (repEvent?.counted) {
    const title = repEvent.clean
      ? cleanStreak >= 3 ? "CLEAN!" : "CLEAN REP"
      : "FORM ISSUE";
    if (!feedback || nowMs >= feedback.until) {
      feedback = { code: "REP_RESULT", title, hint: "", severity: repEvent.clean ? "positive" : "minor",
        since: nowMs, until: nowMs + HINT_MIN_DISPLAY_MS };
    }
  } else if (feedback && nowMs >= feedback.until) {
    feedback = null;
  }

  activeFormError = feedback?.code === chosen?.code && chosen?.joints?.length ? chosen : null;
  formTitle.textContent = feedback?.title || "Ready for squat";
  formHint.textContent = feedback?.hint || "";
  formPanel.classList.toggle("is-critical", feedback?.severity === "critical");
  formPanel.classList.toggle("is-minor", feedback?.severity === "minor");
  formPanel.classList.toggle("is-positive", feedback?.severity === "positive");
}

function showFlow(next) {
  flowView = next;
  cameraHeading.hidden = next !== "CALIBRATION";
  cameraFrame.hidden = next !== "CALIBRATION" && next !== "WORKOUT";
  calibrationHud.hidden = next !== "CALIBRATION" && next !== "WORKOUT";
  cameraStatusRow.hidden = next !== "CALIBRATION" && next !== "WORKOUT";
  squatPanel.hidden = next !== "WORKOUT";
  workoutHeading.hidden = next !== "WORKOUT";
  programsView.hidden = next !== "PROGRAMS";
  restView.hidden = next !== "REST";
  unavailableView.hidden = next !== "UNAVAILABLE";
  resultsView.hidden = next !== "RESULTS";
}

function renderProgramCards() {
  const cards = document.querySelector("#program-cards");
  cards.replaceChildren();
  for (const program of PROGRAMS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `program-card ${program.developmentAvailable ? "is-available" : ""}`;
    card.disabled = !program.developmentAvailable;
    const badge = document.createElement("span");
    badge.className = "program-badge";
    badge.textContent = program.developmentAvailable ? "AVAILABLE • DEVELOPMENT" : "COMING SOON";
    const title = document.createElement("h3");
    title.textContent = program.name.toUpperCase();
    const exercises = document.createElement("p");
    exercises.className = "program-exercises";
    exercises.textContent = program.exercises.map((item) =>
      `${EXERCISE_NAMES[item.id]}${item.implemented ? "" : " (coming soon)"}`).join(" · ");
    const description = document.createElement("p");
    description.textContent = program.description;
    const meta = document.createElement("span");
    meta.className = "program-meta";
    meta.textContent = `~${program.durationMinutes} MIN · ${program.exercises.length} EXERCISES`;
    card.append(badge, title, exercises, description, meta);
    if (program.developmentAvailable) card.addEventListener("click", () => startProgram(program));
    cards.append(card);
  }
}

function clearRestTimer() {
  if (restTimerHandle !== null) clearInterval(restTimerHandle);
  restTimerHandle = null;
}

function showResults() {
  const state = workout?.getState();
  if (!state || !selectedProgram) return;
  document.querySelector("#results-program").textContent = selectedProgram.name;
  const list = document.querySelector("#results-exercises");
  list.replaceChildren();
  for (const item of state.exerciseResults) {
    const row = document.createElement("div");
    row.className = "result-row";
    const name = document.createElement("span");
    name.textContent = EXERCISE_NAMES[item.exerciseId];
    const count = document.createElement("strong");
    count.textContent = `${item.reps} / ${item.targetReps} completed`;
    row.append(name, count);
    list.append(row);
  }
  document.querySelector("#results-count").textContent =
    `${state.exerciseResults.length} / ${selectedProgram.exercises.length}`;
  const seconds = Math.max(0, Math.floor(((state.endedAt ?? Date.now()) - state.startedAt) / 1000));
  document.querySelector("#results-duration").textContent =
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  showFlow("RESULTS");
}

function finishWorkout() {
  if (!workout) return;
  clearRestTimer();
  engine.reset();
  squatMode = false;
  const result = workout.finishWorkout();
  emit(APP_EVENTS.WORKOUT_COMPLETE, result);
  showResults();
}

function beginExercise(exercise) {
  if (!exercise) return;
  emit(APP_EVENTS.EXERCISE_START, {
    programId: selectedProgram.id, exerciseId: exercise.id,
    index: workout.getState().currentExerciseIndex, targetReps: exercise.targetReps,
  });
  if (!exercise.implemented) {
    document.querySelector("#unavailable-title").textContent = EXERCISE_NAMES[exercise.id].toUpperCase();
    showFlow("UNAVAILABLE");
    return;
  }
  if (!engine.startExercise(exercise.id, sessionCalibration)) {
    document.querySelector("#unavailable-title").textContent = EXERCISE_NAMES[exercise.id].toUpperCase();
    showFlow("UNAVAILABLE");
    return;
  }
  squatMode = true;
  resetFormFeedback();
  repValue.textContent = `0 / ${exercise.targetReps}`;
  phaseValue.textContent = "UP";
  angleValue.textContent = "—";
  document.querySelector("#workout-program-name").textContent = selectedProgram.name.toUpperCase();
  document.querySelector("#workout-exercise-number").textContent =
    `EXERCISE ${workout.getState().currentExerciseIndex + 1} / ${selectedProgram.exercises.length}`;
  showFlow("WORKOUT");
  showStatus(lastView === "SIDE" ? "Ready for squat" : "Turn sideways to the camera");
}

function startProgram(program) {
  if (!program.developmentAvailable || !sessionCalibration || workout) return;
  const session = createWorkout(program);
  if (!session.startWorkout()) return;
  selectedProgram = program;
  workout = session;
  emit(APP_EVENTS.PROGRAM_SELECTED, { programId: program.id });
  emit(APP_EVENTS.WORKOUT_START, session.getState());
  beginExercise(session.getCurrentExercise());
}

function startRest(completed) {
  const next = selectedProgram.exercises[workout.getState().currentExerciseIndex + 1];
  document.querySelector("#rest-completed").textContent =
    `${completed.reps} / ${completed.targetReps} ${EXERCISE_NAMES[completed.exerciseId].toUpperCase()} REPS`;
  document.querySelector("#rest-next").textContent = EXERCISE_NAMES[next.id].toUpperCase();
  const endsAt = Date.now() + REST_DURATION_SECONDS * 1000;
  const tick = () => {
    document.querySelector("#rest-timer").textContent =
      String(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    if (Date.now() >= endsAt) clearRestTimer();
  };
  tick();
  restTimerHandle = setInterval(tick, 250);
  showFlow("REST");
  emit(APP_EVENTS.WORKOUT_REST, {
    programId: selectedProgram.id, seconds: REST_DURATION_SECONDS,
    nextExerciseId: next.id,
  });
}

function completeExercise(result) {
  const completed = workout?.completeCurrentExercise(result);
  if (!completed) return;
  engine.reset();
  squatMode = false;
  activeFormError = null;
  emit(APP_EVENTS.EXERCISE_COMPLETE, {
    programId: selectedProgram.id, exerciseId: completed.exerciseId,
    reps: completed.reps, targetReps: completed.targetReps,
  });
  if (workout.getState().status === "REST") startRest(completed);
  else finishWorkout();
}

function returnToPrograms() {
  clearRestTimer();
  engine.reset();
  squatMode = false;
  resetFormFeedback();
  if (workout) {
    const programId = selectedProgram.id;
    workout.resetWorkout();
    emit(APP_EVENTS.WORKOUT_RESET, { programId });
  }
  workout = null;
  selectedProgram = null;
  showFlow(sessionCalibration ? "PROGRAMS" : "CALIBRATION");
}

renderProgramCards();

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
  if (flowView !== "CALIBRATION" && flowView !== "WORKOUT") return;
  showProgress(progress, calibrationState === "CALIBRATED");

  if (squatMode && quality.framing === "READY" && quality.view !== "SIDE") {
    showStatus("Turn sideways to the camera");
    return;
  }

  if (quality.framing === "NO_BODY") {
    showStatus("Stand in front of the camera");
  } else if (quality.framing === "PARTIAL_BODY") {
    showStatus("Step back so your full body is visible");
  } else if (quality.framing === "TOO_CLOSE") {
    showStatus("Move farther from the camera");
  } else if (calibrationState === "CALIBRATED") {
    if (squatMode) {
      showStatus("Ready for squat");
    } else {
      showStatus("Calibration complete");
    }
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
    state === APP_STATES.CAMERA ? "TRAINING / CAMERA" : "TRAINING / SPLASH";
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
  squatViewValue.textContent = view;
});
on(APP_EVENTS.REP, ({ rep, clean }) => {
  const target = workout?.getCurrentExercise()?.targetReps;
  repValue.textContent = target ? `${Math.min(rep, target)} / ${target}` : String(rep);
  cleanStreak = clean ? cleanStreak + 1 : 0;
});
on(APP_EVENTS.POSE_QUALITY, showPoseGuidance);
on(APP_EVENTS.POSE_RESULT, ({ landmarks, fps, timestampMs }) => {
  const quality = assessPoseQuality(landmarks, video.videoWidth, video.videoHeight);
  const calibrationStatus = flowView === "CALIBRATION"
    ? calibration.update(landmarks, quality, timestampMs, video.videoWidth, video.videoHeight)
    : { state: "CALIBRATED", progress: 1, calibration: sessionCalibration };

  sizePoseCanvas(canvas, video);
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
    sessionCalibration = calibrationStatus.calibration;
    emit(APP_EVENTS.CALIBRATION_COMPLETE, calibrationStatus.calibration);
    if (flowView === "CALIBRATION") showFlow("PROGRAMS");
  }
  lastCalibrationState = calibrationStatus.state;
  if (flowView === "WORKOUT" && squatMode) {
    const squat = engine.process(landmarks, {
      calibration: sessionCalibration,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      nowMs: timestampMs,
      view: quality.view,
      framing: quality.framing,
    });
    phaseValue.textContent = squat.phase.toUpperCase();
    cleanValue.textContent = String(squat.cleanReps);
    angleValue.textContent = Number.isFinite(squat.metrics.kneeAngle)
      ? `${Math.round(squat.metrics.kneeAngle)}°`
      : "—";
    renderFormFeedback(squat.errors, quality, timestampMs, squat.repEvent);
    if (squat.reps >= workout.getCurrentExercise().targetReps) {
      completeExercise({ reps: squat.reps, cleanReps: squat.cleanReps });
    }
  }
  if (!cameraFrame.hidden) drawPose(canvas, landmarks, quality, squatMode ? activeFormError : null);
  emit(APP_EVENTS.POSE_QUALITY, {
    quality,
    calibrationState: calibrationStatus.state,
    progress: calibrationStatus.progress,
    resetReason: calibrationStatus.resetReason,
  });
});

async function enterCamera() {
  const thisSession = ++sessionId;
  clearRestTimer();
  engine.reset();
  resetFormFeedback();
  squatMode = false;
  selectedProgram = null;
  workout = null;
  sessionCalibration = null;
  showFlow("CALIBRATION");
  setState(APP_STATES.CAMERA);
  emptyView.hidden = false;
  bodyVisible = false;
  calibration.reset();
  lastCalibrationState = "WAITING";
  lastView = "UNKNOWN";
  viewIndicator.textContent = "VIEW: UNKNOWN";
  squatViewValue.textContent = "UNKNOWN";
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
  clearRestTimer();
  if (workout) emit(APP_EVENTS.WORKOUT_RESET, { programId: selectedProgram.id });
  engine.reset();
  resetFormFeedback();
  squatMode = false;
  selectedProgram = null;
  workout = null;
  sessionCalibration = null;
  showFlow("CALIBRATION");
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
  squatViewValue.textContent = "UNKNOWN";
  showProgress(0);
  fpsIndicator.textContent = "FPS --";
  setState(APP_STATES.SPLASH);
}

endSquatButton.addEventListener("click", returnToPrograms);
document.querySelectorAll(".return-programs-button").forEach((button) =>
  button.addEventListener("click", returnToPrograms));
document.querySelector("#next-exercise-button").addEventListener("click", () => {
  if (workout?.getState().status !== "REST") return;
  clearRestTimer();
  beginExercise(workout.nextExercise());
});
document.querySelector("#finish-demo-button").addEventListener("click", finishWorkout);

document.querySelector("#start-button").addEventListener("click", enterCamera);
document.querySelector("#back-button").addEventListener("click", () => {
  leaveCamera();
  document.querySelector("#start-button").focus();
});
window.addEventListener("pagehide", () => {
  if (currentState === APP_STATES.CAMERA) leaveCamera();
});

renderState(currentState);
