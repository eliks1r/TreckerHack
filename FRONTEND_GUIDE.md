# Frontend guide

The frontend developer owns presentation. Primarily edit `index.html` and `styles.css`; UI rendering code in `src/main.js` may also change. The current frontend remains in place. A future `src/ui/` directory or another presentation structure is fine as long as the motion modules stay independent of it.

You may redesign screens, typography, cards, workout and result layouts, animations, responsive behavior, and mobile UI. Preserve the explicit user controls: workout selection → intro → START TRAINING → exercise preparation → START EXERCISE. Recognition must remain inactive until START EXERCISE.

Render from the existing interfaces:

- `getAppState()` and `subscribeAppState()` in `src/appState.js` expose screen, camera, calibration, selected program, workout, current exercise, and current exercise result.
- `on(eventName, handler)` in `src/events.js` provides events such as `app:screen-change`, `exercise:ready`, `rep`, and `workout:complete`.
- `PROGRAMS`, `EXERCISE_NAMES`, and `EXERCISE_VIEWS` in `src/programs.js` define workout data and display guidance.
- `src/workout.js` defines session states. [CONTRACT.md](./CONTRACT.md) and [INTEGRATION.md](./INTEGRATION.md) describe payloads.

**Adapt the UI to application state.** Never make recognition depend on DOM structure, CSS classes, or animation timing. The frontend must not change camera tracking, MediaPipe initialization, pose processing, calibration formulas, geometry, exercise thresholds, or exercise state machines without coordinating with @eliks1r and running [CORE_TESTS.md](./CORE_TESTS.md).

If a UI change touches a protected file, explain why in the Pull Request and request core-owner review. Replace UI markup and rendering freely within these boundaries; keep `src/api.js` as the sole route to future backend data.
