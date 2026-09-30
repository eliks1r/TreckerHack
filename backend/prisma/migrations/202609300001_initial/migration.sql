-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" UUID NOT NULL,
    "result_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "workout_number" INTEGER NOT NULL,
    "program_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "finished_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_ms" BIGINT NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_results" (
    "id" UUID NOT NULL,
    "workout_session_id" UUID NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "target_reps" INTEGER NOT NULL,
    "completed_reps" INTEGER NOT NULL,
    "clean_reps" INTEGER NOT NULL,
    "duration_ms" BIGINT NOT NULL,

    CONSTRAINT "exercise_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_errors" (
    "id" UUID NOT NULL,
    "exercise_result_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "error_code" TEXT NOT NULL,
    "rep" INTEGER NOT NULL,
    "severity" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "exercise_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progress" (
    "user_id" UUID NOT NULL,
    "total_workouts" INTEGER NOT NULL DEFAULT 0,
    "total_reps" BIGINT NOT NULL DEFAULT 0,
    "total_duration_ms" BIGINT NOT NULL DEFAULT 0,
    "last_workout_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_progress_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "workout_sessions_user_id_finished_at_idx" ON "workout_sessions"("user_id", "finished_at");

-- CreateIndex
CREATE UNIQUE INDEX "workout_sessions_user_id_result_id_key" ON "workout_sessions"("user_id", "result_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_results_workout_session_id_order_index_key" ON "exercise_results"("workout_session_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_errors_exercise_result_id_order_index_key" ON "exercise_errors"("exercise_result_id", "order_index");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_results_workout_session_id_fkey" FOREIGN KEY ("workout_session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_errors" ADD CONSTRAINT "exercise_errors_exercise_result_id_fkey" FOREIGN KEY ("exercise_result_id") REFERENCES "exercise_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce invariants even for writes made outside the HTTP API.
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_values_check" CHECK (
    "duration_ms" >= 0 AND "finished_at" >= "started_at" AND
    (("workout_number" = 1 AND "program_id" = 'full-body') OR
     ("workout_number" = 2 AND "program_id" = 'strength') OR
     ("workout_number" = 3 AND "program_id" = 'light'))
);
ALTER TABLE "exercise_results" ADD CONSTRAINT "exercise_values_check" CHECK (
    "exercise_id" IN ('squat', 'armraise', 'sidebend', 'pushup') AND
    "order_index" >= 0 AND "target_reps" >= 0 AND "completed_reps" >= 0 AND
    "clean_reps" >= 0 AND "clean_reps" <= "completed_reps" AND "duration_ms" >= 0
);
ALTER TABLE "exercise_errors" ADD CONSTRAINT "error_values_check" CHECK (
    "rep" >= 1 AND "count" >= 1 AND "order_index" >= 0 AND "severity" IN ('critical', 'minor')
);
ALTER TABLE "user_progress" ADD CONSTRAINT "progress_values_check" CHECK (
    "total_workouts" >= 0 AND "total_reps" >= 0 AND "total_duration_ms" >= 0
);
