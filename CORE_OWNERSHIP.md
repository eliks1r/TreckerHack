# Protected Motion Core

**Core owner: [@eliks1r](https://github.com/eliks1r).** These files contain tested motion recognition and workout state logic. Do not modify them without approval from the core owner:

```text
src/camera.js
src/pose.js
src/filter.js
src/poseQuality.js
src/calibration.js
src/geometry.js
src/exercises/**
src/engine.js
src/workout.js
src/programs.js
src/events.js
src/appState.js
CONTRACT.md
```

The MediaPipe pipeline works, calibration has been manually tested, FRONT/SIDE classification is tuned, exercise state machines have been manually tested, and the workout lifecycle is integrated. A small change in these files can regress camera permission or cleanup, tracking, calibration, rep counting, or workout state.

Any proposed change to a protected path requires:

1. A separate `core/<feature-name>` branch or a clearly scoped feature branch.
2. A Pull Request explaining the need and the effect on recognition or state.
3. Manual regression checks from [CORE_TESTS.md](./CORE_TESTS.md), with results in the PR.
4. Approval from @eliks1r before merging.

`CODEOWNERS` requests this review on GitHub. Repository rules must also require code-owner approval for it to be enforced; see [CONTRIBUTING.md](./CONTRIBUTING.md).
