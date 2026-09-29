import { APP_EVENTS, APP_STATES, INITIAL_STATE } from "./config.js";
import { emit, on } from "./events.js";

const screens = {
  [APP_STATES.SPLASH]: document.querySelector("#splash-screen"),
  [APP_STATES.CAMERA]: document.querySelector("#camera-screen"),
};

let currentState = INITIAL_STATE;

function renderState(state) {
  for (const [name, element] of Object.entries(screens)) {
    element.hidden = name !== state;
  }

  document.querySelector(".footer span:last-child").textContent =
    state === APP_STATES.CAMERA ? "G1 / CAMERA PLACEHOLDER" : "G1 / SPLASH";
}

function setState(nextState) {
  if (!screens[nextState] || nextState === currentState) return;
  currentState = nextState;
  emit(APP_EVENTS.STATE_CHANGED, { state: nextState });
}

on(APP_EVENTS.STATE_CHANGED, ({ state }) => renderState(state));
document.querySelector("#start-button").addEventListener("click", () => {
  setState(APP_STATES.CAMERA);
  document.querySelector("#back-button").focus();
});
document.querySelector("#back-button").addEventListener("click", () => {
  setState(APP_STATES.SPLASH);
  document.querySelector("#start-button").focus();
});

renderState(currentState);
