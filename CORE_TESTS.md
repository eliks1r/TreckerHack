# Core regression checklist

Use a real webcam and browser for motion checks. Run the app locally with `python -m http.server 8000`, then open `http://localhost:8000/`.

## Camera

- [ ] Camera permission works.
- [ ] Mirrored video appears.
- [ ] Live skeleton appears and follows the person.
- [ ] BACK TO HOME releases camera tracks and turns off the browser camera indicator.

## Calibration

- [ ] FRONT view is detected.
- [ ] SIDE view is detected.
- [ ] Calibration reaches 100% with a stable pose.
- [ ] Movement during calibration resets progress.

## Squat

- [ ] One full squat counts as one rep.
- [ ] Holding position or standing jitter does not double count.

## Arm Raise

- [ ] One full raise and lower counts as one rep.
- [ ] Holding arms overhead does not double count.

## Side Bend

- [ ] A full left bend and return counts.
- [ ] A full right bend and return counts.
- [ ] Holding a bend does not double count.

## Push-up

- [ ] A full down-and-up push-up counts as one rep from SIDE view.
- [ ] Holding the bottom does not double count.

## Workouts

- [ ] Workout 1 completes Squat 8 → Arm Raise 8 → Side Bend 10.
- [ ] Workout 2 completes Squat 10 → Push-up 5 → Arm Raise 10.
- [ ] Workout 3 completes Arm Raise 8 → Side Bend 10 → Arm Raise 8.
- [ ] No exercise counts before START EXERCISE.
- [ ] REPEAT WORKOUT resets counts and returns to the intro.
- [ ] Browser console has no new uncaught errors.
