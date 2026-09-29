import { APP_EVENTS, APP_STATES, HINT_COOLDOWN_MS, HINT_MIN_DISPLAY_MS, INITIAL_STATE, REST_DURATION_SECONDS } from "./config.js";
import { emit, on } from "./events.js";
import { startCamera, stopCamera } from "./camera.js";
import { initPose, startPoseLoop, stopPoseLoop, disposePose } from "./pose.js";
import { clearPose, drawPose, sizePoseCanvas } from "./drawPose.js";
import { assessPoseQuality } from "./poseQuality.js";
import { createCalibration } from "./calibration.js";
import { createExerciseEngine } from "./engine.js";
import { EXERCISE_NAMES, EXERCISE_VIEWS, PROGRAMS } from "./programs.js";
import { buildWorkoutResult, createWorkout, WORKOUT_STATUSES } from "./workout.js";
import { resetAppState, setAppState } from "./appState.js";
import { saveWorkoutResult } from "./api.js";

const screens = {
  [APP_STATES.SPLASH]: document.querySelector("#splash-screen"),
  [APP_STATES.CAMERA]: document.querySelector("#camera-screen"),
};

let currentState = INITIAL_STATE;
let sessionId = 0;
let bodyVisible = false;
let lastView = "UNKNOWN";
let lastCalibrationState = "WAITING";
let activeExercise = null;
let flowView = "CALIBRATION";
let sessionCalibration = null;
let selectedProgram = null;
let workout = null;
let currentExerciseErrors = [];
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
const introView = document.querySelector("#intro-view");
const exerciseReadyView = document.querySelector("#exercise-ready-view");
const workoutHeading = document.querySelector("#workout-heading");
const restView = document.querySelector("#rest-view");
const resultsView = document.querySelector("#results-view");
document.querySelector(".stage-label").textContent = "TRAINING / PROGRAMS";
document.querySelector("#programs-view .flow-intro").textContent =
  "Choose a workout to review its exercises before starting.";
const repeatButton = document.querySelector("#repeat-workout-button");

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
squatPanel.setAttribute("aria-label", "Exercise repetition counter");
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
const angleLabel = angleValue.previousElementSibling;
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
  cameraFrame.hidden = next !== "CALIBRATION" && next !== "WORKOUT" && next !== "EXERCISE_READY";
  calibrationHud.hidden = next !== "CALIBRATION" && next !== "WORKOUT" && next !== "EXERCISE_READY";
  cameraStatusRow.hidden = next !== "CALIBRATION" && next !== "WORKOUT" && next !== "EXERCISE_READY";
  squatPanel.hidden = next !== "WORKOUT";
  workoutHeading.hidden = next !== "WORKOUT" && next !== "EXERCISE_READY";
  programsView.hidden = next !== "PROGRAMS";
  introView.hidden = next !== "INTRO";
  exerciseReadyView.hidden = next !== "EXERCISE_READY";
  restView.hidden = next !== "REST";
  resultsView.hidden = next !== "RESULTS";
  setAppState({ screen: next, workout: workout?.getState() ?? null });
}

function renderProgramCards() {
  const cards = document.querySelector("#program-cards");
  cards.replaceChildren();
  for (const program of PROGRAMS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "program-card is-available";
    const badge = document.createElement("span");
    badge.className = "program-badge";
    badge.textContent = `WORKOUT ${program.workoutNumber} · AVAILABLE`;
    const title = document.createElement("h3");
    title.textContent = program.shortName.toUpperCase();
    const exercises = document.createElement("p");
    exercises.className = "program-exercises";
    exercises.textContent = program.exercises.map((item) => EXERCISE_NAMES[item.id]).join(" · ");
    const description = document.createElement("p");
    description.textContent = program.description;
    const meta = document.createElement("span");
    meta.className = "program-meta";
    meta.textContent = `~${program.durationMinutes} MIN · ${program.exercises.length} EXERCISES`;
    const action = document.createElement("span");
    action.className = "program-action";
    action.textContent = `START WORKOUT ${program.workoutNumber}`;
    card.append(badge, title, exercises, description, meta, action);
    card.addEventListener("click", () => selectProgram(program));
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
  document.querySelector("#results-title").textContent = "WORKOUT COMPLETE";
  document.querySelector(".results-stats p:last-child strong").textContent = "Completed";
  document.querySelector("#results-program").textContent = selectedProgram.name;
  const list = document.querySelector("#results-exercises");
  list.replaceChildren();
  for (const item of state.exerciseResults) {
    const row = document.createElement("div");
    row.className = "result-row";
    const name = document.createElement("span");
    name.textContent = EXERCISE_NAMES[item.exerciseId];
    const count = document.createElement("strong");
    count.textContent = `${item.completedReps} / ${item.targetReps}`;
    row.append(name, count);
    list.append(row);
  }
  document.querySelector("#results-count").textContent =
    `${state.exerciseResults.length} / ${selectedProgram.exercises.length}`;
  const seconds = Math.max(0, Math.floor((state.finishedAt - state.startedAt) / 1000));
  document.querySelector("#results-duration").textContent =
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  showFlow("RESULTS");
}

function finishWorkout() {
  if (workout?.getState().status !== WORKOUT_STATUSES.COMPLETE) return;
  clearRestTimer();
  engine.reset();
  activeExercise = null;
  const result = buildWorkoutResult(workout.getState());
  setAppState({ currentExercise: null, currentExerciseResult: null,
    workout: workout.getState() });
  emit(APP_EVENTS.WORKOUT_COMPLETE, result);
  showResults();
  // Persistence is deliberately outside the motion engine and never blocks Results.
  Promise.resolve().then(() => saveWorkoutResult(result)).catch(() => {
    // The mock is local; a future backend may fail or be offline.
  });
}

function activateExercise(exercise) {
  if (workout?.getState().status !== WORKOUT_STATUSES.EXERCISE_READY ||
      !engine.startExercise(exercise.id, sessionCalibration)) return;
  if (!workout.startExercise()) {
    engine.reset();
    return;
  }
  activeExercise = exercise.id;
  currentExerciseErrors = [];
  resetFormFeedback();
  squatViewValue.textContent = lastView;
  viewIndicator.textContent = `VIEW: ${lastView}`;
  const isSquat = exercise.id === "squat";
  const isSideBend = exercise.id === "sidebend";
  const isPushup = exercise.id === "pushup";
  squatTitle.textContent = EXERCISE_NAMES[exercise.id].toUpperCase();
  formPanel.hidden = !isSquat;
  cleanValue.parentElement.hidden = !isSquat;
  squatStats.classList.toggle("is-armraise", !isSquat);
  angleLabel.textContent = isSquat ? "KNEE ANGLE" : isPushup ? "ELBOW ANGLE"
    : isSideBend ? "ANGLE" : "ARM HEIGHT";
  repValue.textContent = `0 / ${exercise.targetReps}`;
  phaseValue.textContent = isSquat || isPushup ? "UP"
    : isSideBend ? "NEUTRAL" : "DOWN";
  angleValue.textContent = isSideBend ? "0°" : "—";
  document.querySelector("#workout-program-name").textContent = selectedProgram.name.toUpperCase();
  document.querySelector("#workout-exercise-number").textContent =
    `EXERCISE ${workout.getState().currentExerciseIndex + 1} / ${selectedProgram.exercises.length}`;
  showFlow("WORKOUT");
  setAppState({ currentExercise: { ...exercise, view: EXERCISE_VIEWS[exercise.id] },
    currentExerciseResult: null, workout: workout.getState() });
  emit(APP_EVENTS.EXERCISE_START, {
    programId: selectedProgram.id, workoutNumber: selectedProgram.workoutNumber,
    exerciseId: exercise.id, index: workout.getState().currentExerciseIndex,
    targetReps: exercise.targetReps,
  });
  showStatus(lastView === engine.getRequiredView()
    ? `Ready for ${EXERCISE_NAMES[exercise.id]}`
    : engine.getRequiredView() === "SIDE" ? "Turn sideways to the camera" : "Face the camera");
}

function showIntro() {
  document.querySelector("#intro-number").textContent =
    `WORKOUT ${selectedProgram.workoutNumber}`;
  document.querySelector("#intro-title").textContent = selectedProgram.shortName.toUpperCase();
  document.querySelector("#intro-count").textContent =
    `${selectedProgram.exercises.length} EXERCISES`;
  document.querySelector("#intro-duration").textContent =
    `Estimated time: ~${selectedProgram.durationMinutes} min`;
  const list = document.querySelector("#intro-exercises");
  list.replaceChildren();
  for (const exercise of selectedProgram.exercises) {
    const row = document.createElement("div");
    row.className = "result-row";
    const name = document.createElement("span");
    name.textContent = EXERCISE_NAMES[exercise.id];
    const target = document.createElement("strong");
    target.textContent = `${exercise.targetReps} reps`;
    row.append(name, target);
    list.append(row);
  }
  showFlow("INTRO");
}

function showExerciseReady(exercise) {
  if (!exercise || workout?.getState().status !== WORKOUT_STATUSES.EXERCISE_READY) return;
  activeExercise = null;
  engine.reset();
  const index = workout.getState().currentExerciseIndex;
  document.querySelector("#workout-program-name").textContent = selectedProgram.name.toUpperCase();
  document.querySelector("#workout-exercise-number").textContent =
    `EXERCISE ${index + 1} / ${selectedProgram.exercises.length}`;
  document.querySelector("#exercise-ready-step").textContent =
    index === 0 ? "FIRST EXERCISE" : "NEXT EXERCISE";
  document.querySelector("#exercise-ready-title").textContent =
    EXERCISE_NAMES[exercise.id].toUpperCase();
  document.querySelector("#exercise-ready-reps").textContent =
    `${exercise.targetReps} REPS`;
  document.querySelector("#exercise-ready-position").textContent =
    `POSITION: ${EXERCISE_VIEWS[exercise.id]} VIEW`;
  document.querySelector("#exercise-ready-help").textContent = exercise.id === "pushup"
    ? "Place the camera so your full side profile is visible. Keep shoulder, elbow, wrist, hip, and ankle in frame."
    : EXERCISE_VIEWS[exercise.id] === "SIDE"
      ? "Turn sideways and keep your full body in frame."
      : "Face the camera and keep your arms and torso in frame.";
  showFlow("EXERCISE_READY");
  showStatus(`Prepare for ${EXERCISE_NAMES[exercise.id]}`);
  setAppState({ currentExercise: { ...exercise, view: EXERCISE_VIEWS[exercise.id] },
    currentExerciseResult: null });
  emit(APP_EVENTS.EXERCISE_READY, {
    programId: selectedProgram.id, exerciseId: exercise.id, index,
    targetReps: exercise.targetReps, view: EXERCISE_VIEWS[exercise.id],
  });
}

function selectProgram(program) {
  if (!sessionCalibration || workout) return;
  const session = createWorkout(program);
  if (!session.selectProgram()) return;
  selectedProgram = program;
  workout = session;
  setAppState({ selectedProgram: program, workout: session.getState() });
  emit(APP_EVENTS.PROGRAM_SELECTED, session.getState());
  session.readyWorkout();
  emit(APP_EVENTS.WORKOUT_READY, session.getState());
  showIntro();
}

function startTraining() {
  if (!workout?.startWorkout()) return;
  emit(APP_EVENTS.WORKOUT_START, workout.getState());
  showExerciseReady(workout.getCurrentExercise());
}

function startRest(completed) {
  const next = selectedProgram.exercises[workout.getState().currentExerciseIndex + 1];
  document.querySelector("#rest-completed").textContent =
    `${completed.completedReps} / ${completed.targetReps} ${EXERCISE_NAMES[completed.exerciseId].toUpperCase()} REPS`;
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
  const completed = workout?.completeCurrentExercise({
    ...result, errors: currentExerciseErrors,
  });
  if (!completed) return;
  engine.reset();
  activeExercise = null;
  activeFormError = null;
  emit(APP_EVENTS.EXERCISE_COMPLETE, {
    programId: selectedProgram.id, exerciseId: completed.exerciseId,
    reps: completed.completedReps, targetReps: completed.targetReps,
    result: completed,
  });
  setAppState({ currentExercise: null, currentExerciseResult: null,
    workout: workout.getState() });
  if (workout.getState().status === WORKOUT_STATUSES.REST) startRest(completed);
  else finishWorkout();
}

function returnToPrograms() {
  clearRestTimer();
  engine.reset();
  activeExercise = null;
  currentExerciseErrors = [];
  resetFormFeedback();
  if (workout) {
    const programId = selectedProgram.id;
    workout.resetWorkout();
    emit(APP_EVENTS.WORKOUT_RESET, { programId });
  }
  workout = null;
  selectedProgram = null;
  setAppState({ selectedProgram: null, workout: null, currentExercise: null,
    currentExerciseResult: null });
  showFlow(sessionCalibration ? "PROGRAMS" : "CALIBRATION");
}

function repeatWorkout() {
  if (!workout || !selectedProgram || flowView !== "RESULTS") return;
  engine.reset();
  currentExerciseErrors = [];
  workout.resetWorkout();
  emit(APP_EVENTS.WORKOUT_RESET, { programId: selectedProgram.id });
  workout.selectProgram();
  workout.readyWorkout();
  setAppState({ workout: workout.getState(), currentExercise: null,
    currentExerciseResult: null });
  emit(APP_EVENTS.WORKOUT_READY, workout.getState());
  showIntro();
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
  if (status.textContent !== message) {
    status.textContent = message;
    setAppState({ cameraStatus: message });
  }
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

  if (activeExercise) {
    if (activeExercise === "pushup") {
      if (!quality.bodyDetected) showStatus("Stand in front of the camera");
      else if (quality.view === "FRONT") showStatus("Turn sideways to the camera");
      else if (!engine.getResult()?.visible) showStatus("Keep your full side profile in frame");
      else showStatus("Ready for Push-up");
      return;
    }
    if (quality.framing === "NO_BODY") showStatus("Stand in front of the camera");
    else if (quality.framing === "TOO_CLOSE") showStatus("Move farther from the camera");
    else if (quality.view !== engine.getRequiredView()) {
      showStatus(activeExercise === "squat" ? "Turn sideways to the camera" : "Face the camera");
    } else if (activeExercise === "squat" && quality.framing !== "READY") {
      showStatus("Step back so your full body is visible");
    } else if (activeExercise === "armraise" &&
               (!quality.upperBodyVisible || !engine.getResult()?.visible)) {
      showStatus("Keep both arms visible");
    } else if (activeExercise === "sidebend" && !engine.getResult()?.visible) {
      showStatus("Keep shoulders and hips visible");
    } else showStatus(`Ready for ${EXERCISE_NAMES[activeExercise]}`);
    return;
  }

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
  setAppState({ cameraStatus: error.code ?? "CAMERA_ERROR" });
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
  if (nextState === APP_STATES.SPLASH) setAppState({ screen: APP_STATES.SPLASH });
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
on(APP_EVENTS.REP, ({ rep, clean, errors }) => {
  const target = workout?.getCurrentExercise()?.targetReps;
  repValue.textContent = target ? `${Math.min(rep, target)} / ${target}` : String(rep);
  cleanStreak = clean ? cleanStreak + 1 : 0;
  for (const error of errors ?? []) {
    currentExerciseErrors.push({ rep, code: error.code, severity: error.severity });
  }
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
    setAppState({ calibration: { state: "CALIBRATED", progress: 1,
      result: sessionCalibration } });
    emit(APP_EVENTS.CALIBRATION_COMPLETE, calibrationStatus.calibration);
    if (flowView === "CALIBRATION") showFlow("PROGRAMS");
  }
  if (flowView === "CALIBRATION" && calibrationStatus.state !== "CALIBRATED") {
    setAppState({ calibration: { state: calibrationStatus.state,
      progress: calibrationStatus.progress, result: null } });
  }
  lastCalibrationState = calibrationStatus.state;
  if (flowView === "WORKOUT" && activeExercise) {
    const analysis = engine.process(landmarks, {
      calibration: sessionCalibration,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      nowMs: timestampMs,
      view: quality.view,
      framing: quality.framing,
    });
    phaseValue.textContent = analysis.phase.toUpperCase();
    if (activeExercise === "squat") {
      cleanValue.textContent = String(analysis.cleanReps);
      angleValue.textContent = Number.isFinite(analysis.metrics.kneeAngle)
        ? `${Math.round(analysis.metrics.kneeAngle)}°` : "—";
      renderFormFeedback(analysis.errors, quality, timestampMs, analysis.repEvent);
    } else if (activeExercise === "sidebend") {
      angleValue.textContent = Number.isFinite(analysis.metrics.torsoAngleDeg)
        ? `${Math.round(analysis.metrics.torsoAngleDeg)}°` : "—";
    } else if (activeExercise === "pushup") {
      angleValue.textContent = Number.isFinite(analysis.metrics.elbowAngle)
        ? `${Math.round(analysis.metrics.elbowAngle)}°` : "—";
      squatViewValue.textContent = analysis.metrics.selectedView;
      viewIndicator.textContent = `VIEW: ${analysis.metrics.selectedView}`;
    } else {
      const { hL, hR } = analysis.metrics;
      angleValue.textContent = Number.isFinite(hL) && Number.isFinite(hR)
        ? ((hL + hR) / 2).toFixed(2) : "—";
    }
    if (analysis.reps >= workout.getCurrentExercise().targetReps) {
      completeExercise({ reps: analysis.reps, cleanReps: analysis.cleanReps });
    } else {
      setAppState({ currentExerciseResult: analysis });
    }
  }
  const drawQuality = activeExercise === "pushup" && engine.getResult()?.visible
    ? { ...quality, framing: "READY" } : quality;
  if (!cameraFrame.hidden) drawPose(canvas, landmarks, drawQuality,
    activeExercise === "squat" ? activeFormError : null);
  emit(APP_EVENTS.POSE_QUALITY, {
    quality,
    calibrationState: calibrationStatus.state,
    progress: calibrationStatus.progress,
    resetReason: calibrationStatus.resetReason,
  });
});

async function enterCamera() {
  const thisSession = ++sessionId;
  resetAppState();
  clearRestTimer();
  engine.reset();
  resetFormFeedback();
  activeExercise = null;
  currentExerciseErrors = [];
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
  activeExercise = null;
  currentExerciseErrors = [];
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
  resetAppState();
}

endSquatButton.addEventListener("click", returnToPrograms);
document.querySelectorAll(".return-programs-button").forEach((button) =>
  button.addEventListener("click", returnToPrograms));
document.querySelector("#start-training-button").addEventListener("click", startTraining);
document.querySelector("#start-exercise-button").addEventListener("click", () => {
  if (workout?.getState().status === WORKOUT_STATUSES.EXERCISE_READY) {
    activateExercise(workout.getCurrentExercise());
  }
});
document.querySelector("#next-exercise-button").addEventListener("click", () => {
  if (workout?.getState().status !== WORKOUT_STATUSES.REST) return;
  clearRestTimer();
  showExerciseReady(workout.readyNextExercise());
});
repeatButton.addEventListener("click", repeatWorkout);

document.querySelector("#start-button").addEventListener("click", enterCamera);
document.querySelector("#back-button").addEventListener("click", () => {
  leaveCamera();
  document.querySelector("#start-button").focus();
});
window.addEventListener("pagehide", () => {
  if (currentState === APP_STATES.CAMERA) leaveCamera();
});

renderState(currentState);
