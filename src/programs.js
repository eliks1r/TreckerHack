export const EXERCISE_NAMES = Object.freeze({
  squat: "Squat",
  armraise: "Arm Raise",
  sidebend: "Side Bend",
  pushup: "Push-up",
  clap: "Clap",
});

export const PROGRAMS = Object.freeze([
  {
    id: "full-body-beginner",
    name: "Full Body Beginner",
    description: "Balanced full-body session.",
    durationMinutes: 4,
    mode: "full_body",
    developmentAvailable: true,
    exercises: [
      { id: "squat", targetReps: 8, implemented: true },
      { id: "armraise", targetReps: 8, implemented: true },
      { id: "sidebend", targetReps: 10, implemented: false },
    ],
  },
  {
    id: "desk-mode",
    name: "Desk Mode",
    description: "Short upper-body movement break.",
    durationMinutes: 3,
    mode: "upper_body",
    developmentAvailable: true,
    exercises: [
      { id: "armraise", targetReps: 8, implemented: true },
      { id: "clap", targetReps: 8, implemented: false },
      { id: "sidebend", targetReps: 10, implemented: false },
    ],
  },
  {
    id: "strength",
    name: "Strength",
    description: "Build a stronger movement base.",
    durationMinutes: 5,
    mode: "strength",
    developmentAvailable: false,
    exercises: [
      { id: "squat", targetReps: 10, implemented: true },
      { id: "pushup", targetReps: 5, implemented: false },
      { id: "armraise", targetReps: 10, implemented: true },
    ],
  },
].map((program) => Object.freeze({
  ...program,
  exercises: Object.freeze(program.exercises.map((exercise) => Object.freeze(exercise))),
})));

export function getProgram(programId) {
  return PROGRAMS.find((program) => program.id === programId) ?? null;
}
