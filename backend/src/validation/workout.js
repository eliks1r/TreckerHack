import { z } from "zod";

export const exerciseIds = ["squat", "armraise", "sidebend", "pushup"];
const integer = z.number().int().min(0).max(2147483647);
const duration = z.number().int().min(0).max(7 * 24 * 60 * 60 * 1000);
const timestamp = z.iso.datetime({ offset: true }).refine(v => Number.isFinite(Date.parse(v)));
const exercise = z.object({
  exerciseId: z.enum(exerciseIds), targetReps: integer, completedReps: integer,
  cleanReps: integer, durationMs: duration,
  errors: z.array(z.object({
    rep: integer.min(1), code: z.enum(["SQ_KNEE_TOE", "SQ_LEAN", "SQ_SHALLOW", "SQ_NOT_UP", "SQ_FAST"]),
    severity: z.enum(["critical", "minor"]),
  }).strict()).max(1000),
}).strict().superRefine((value, ctx) => {
  if (value.cleanReps > value.completedReps) ctx.addIssue({ code: "custom", message: "cleanReps exceeds completedReps" });
  if (value.errors.some(e => e.rep > value.completedReps || value.exerciseId !== "squat")) {
    ctx.addIssue({ code: "custom", message: "Invalid exercise errors" });
  }
});
export const workoutSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  workoutNumber: z.number().int().min(1).max(3),
  programId: z.enum(["full-body", "strength", "light"]),
  startedAt: timestamp, finishedAt: timestamp, durationMs: duration,
  exercises: z.array(exercise).min(1).max(3), completed: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (["full-body", "strength", "light"][value.workoutNumber - 1] !== value.programId) {
    ctx.addIssue({ code: "custom", message: "Program does not match workoutNumber" });
  }
  if (Date.parse(value.finishedAt) < Date.parse(value.startedAt)) ctx.addIssue({ code: "custom", message: "finishedAt precedes startedAt" });
  if (value.exercises.some(e => e.durationMs > value.durationMs)) ctx.addIssue({ code: "custom", message: "Exercise duration exceeds session" });
});
