export const EXERCISE_NAMES = Object.freeze({
  squat: "Squat",
  armraise: "Arm Raise",
  sidebend: "Side Bend",
  pushup: "Push-up",
});

export const EXERCISE_VIEWS = Object.freeze({
  squat: "SIDE",
  armraise: "FRONT",
  sidebend: "FRONT",
  pushup: "SIDE",
});

export const PROGRAMS = Object.freeze([
  {
    workoutNumber: 1,
    id: "full-body",
    name: "Workout 1 — Full Body",
    shortName: "Full Body",
    description: "Balanced full-body movement.",
    durationMinutes: 4,
    exercises: [
      { id: "squat", targetReps: 8 },
      { id: "armraise", targetReps: 8 },
      { id: "sidebend", targetReps: 10 },
    ],
  },
  {
    workoutNumber: 2,
    id: "strength",
    name: "Workout 2 — Strength",
    shortName: "Strength",
    description: "A short strength circuit.",
    durationMinutes: 5,
    exercises: [
      { id: "squat", targetReps: 10 },
      { id: "pushup", targetReps: 5 },
      { id: "armraise", targetReps: 10 },
    ],
  },
  {
    workoutNumber: 3,
    id: "light",
    name: "Workout 3 — Light",
    shortName: "Light",
    description: "A gentle movement break for your desk.",
    durationMinutes: 3,
    exercises: [
      { id: "armraise", targetReps: 8 },
      { id: "sidebend", targetReps: 10 },
      { id: "armraise", targetReps: 8 },
    ],
  },
].map((program) => Object.freeze({
  ...program,
  exercises: Object.freeze(program.exercises.map((exercise) => Object.freeze(exercise))),
})));

export function getProgram(programId) {
  return PROGRAMS.find((program) => program.id === programId) ?? null;
}
