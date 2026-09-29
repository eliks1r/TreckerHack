import { APP_EVENTS, APP_STATES } from "./config.js";
import { emit } from "./events.js";

const initialState = () => ({
  screen: APP_STATES.SPLASH,
  cameraStatus: "IDLE",
  calibration: null,
  selectedProgram: null,
  workout: null,
  currentExercise: null,
  currentExerciseResult: null,
});

let state = initialState();
const subscribers = new Set();

export function getAppState() {
  return structuredClone(state);
}

export function setAppState(patch) {
  const previousScreen = state.screen;
  state = { ...state, ...structuredClone(patch) };
  const snapshot = getAppState();
  if (snapshot.screen !== previousScreen) {
    emit(APP_EVENTS.APP_SCREEN_CHANGE, { screen: snapshot.screen, previousScreen });
  }
  emit(APP_EVENTS.APP_STATE_CHANGE, snapshot);
  for (const subscriber of subscribers) subscriber(snapshot);
  return snapshot;
}

export function subscribeAppState(subscriber) {
  subscribers.add(subscriber);
  subscriber(getAppState());
  return () => subscribers.delete(subscriber);
}

export function resetAppState() {
  return setAppState(initialState());
}
