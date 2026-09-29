export const APP_STATES = Object.freeze({
  SPLASH: "SPLASH",
  CAMERA: "CAMERA",
});

export const APP_EVENTS = Object.freeze({
  STATE_CHANGED: "app:state-changed",
});

export const INITIAL_STATE = APP_STATES.SPLASH;
