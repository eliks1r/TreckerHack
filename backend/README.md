# Motion Tracker backend

Express + PostgreSQL + Prisma behind the existing `src/api.js`. Camera, MediaPipe and motion processing stay in the browser. Only account metadata and workout summaries cross HTTP. No camera frames, video, images, landmarks, skeleton or canvas data are accepted or stored.

## Requirements and installation

Node.js 24 LTS, npm, and an accessible PostgreSQL database (PostgreSQL 17 is suitable). Use your own authorized PostgreSQL role and administration tool to create application and dedicated test databases. The role needs permission to create tables/indexes in the chosen database's public schema. No database credentials or application secret are supplied by this repository.

From the repository root in PowerShell:

```powershell
Set-Location backend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env: supply your actual DATABASE_URL and a random JWT_SECRET.
npm run generate
npm run validate
npm run migrate
npm start
```

Generate your own secret locally, then put its value in ignored `backend/.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Never commit `.env` or expose signing/database credentials in browser configuration. Prisma CLI loads backend/.env; start/dev use Node env-file support. Shell environment values take precedence. `npm run migrate` applies committed SQL through Prisma migrate deploy; it does not reset data or need a shadow database. Review the migration before applying it to existing databases. Future migrations can be created with Prisma migrate dev on a development database; never reset shared databases to resolve drift.

For local PostgreSQL at localhost:5432 with the existing postgres role, the following alternative automates configuration without changing its password or existing data:

```sh
node scripts/configure-local.js
npm run setup:database
npm run generate
npm run migrate:all
npm start
```

configure-local.js prompts for the existing password with hidden input, writes it only to ignored .env, generates a cryptographically random JWT_SECRET if absent, and preserves an already configured secret. setup:database verifies credentials, creates treckerhack and treckerhack_test only if absent, and configures TEST_DATABASE_URL without printing credentials. migrate:all applies committed migrations to both databases; it never resets them. These helpers use the existing local postgres credentials and do not create/change database roles.

## Environment

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Required real PostgreSQL URL; URL-encode special characters in credentials. |
| `JWT_SECRET` | Required random secret, at least 32 characters. Keep stable across restarts. |
| `PORT` | Default 3000. API binds to 127.0.0.1. |
| `FRONTEND_ORIGIN` | Exact allowed origin; default http://localhost:8000; no trailing slash. For port 8123, configure that origin explicitly. |
| `NODE_ENV` | Production enables Secure cookies and requires HTTPS frontend. |
| `ENABLE_DEMO_AUTH` | Explicit true enables isolated demo accounts in development only. Default false. |
| `TEST_DATABASE_URL` | Actual URL of a migrated dedicated PostgreSQL test database. |
| `BROWSER_EXECUTABLE` | Optional installed Chromium path for browser tests. Windows Edge is detected at its usual path. |

For deployment, put an HTTPS reverse proxy in front of this service and route `/api` to it. Prefer the same public origin for frontend and API. Unrelated cross-site frontend/API domains are not supported by this cookie configuration. Local frontend/API must use the same hostname, with different ports allowed.

## Start the whole project

Run `npm run dev` inside backend/ in one terminal; run `npm run frontend` inside backend/ in another. Open http://localhost:8000, register, and use the existing workout flow. Frontend has no build step. The static server permits only index.html, styles.css, src/, assets/ and vendor/; backend/secrets are not served. The original serve.ps1 has a machine-specific path and remains unchanged.

The adapter defaults to http://localhost:3000/api for localhost/127.0.0.1 and `/api` elsewhere. To change the public API URL, define `globalThis.MOTION_API_BASE_URL` before frontend modules execute. Backend `.env` is not accessible to the browser. The URL must not contain secrets.

## Schema and persistence

See `prisma/schema.prisma` and `prisma/migrations/202609300001_initial/migration.sql`:

| Table | Fields/relations |
| --- | --- |
| users | UUID, unique normalized email, password_hash, display_name, created_at, updated_at |
| auth_sessions | UUID, user FK, expires_at, revoked_at, created_at |
| workout_sessions | UUID, user FK, original result_id, payload_hash, workout_number, program_id, started_at, finished_at, duration_ms, completed, created_at |
| exercise_results | UUID, workout FK, exercise_id, order_index, target_reps, completed_reps, clean_reps, duration_ms |
| exercise_errors | UUID, stage FK, order_index, error_code, rep, severity, count |
| user_progress | user FK/PK, total_workouts, total_reps, total_duration_ms, last_workout_at, updated_at |

Foreign keys cascade deletion. Unique `(user_id,result_id)` prevents duplicate saves; ordered stage/error indexes preserve repeated Arm Raise and original error order. Internal UUIDs do not replace the original WorkoutResult id in responses. Each error record has count=1, preserving rep/code/severity for exact round trips. SQL CHECK constraints enforce nonnegative values, clean reps bounds, known exercises and number/program mapping. Prisma syntax does not represent these CHECK constraints; maintain them in migrations.

One transaction locks the current user row, checks idempotency, inserts workout/stages/errors and updates cached user_progress. Identical retries return the original result without increasing progress; changed content with the same ID returns 409. Concurrent retries cannot double-count. Timestamps normalize to UTC. Data lives in PostgreSQL across process restarts; there is no alternate in-memory/localStorage persistence.

## Auth

Register/login set an HttpOnly SameSite=Lax cookie scoped to `/api`; production sets Secure. Its HS256 JWT identifies a persisted session/user and expires after seven days. Every protected request checks signature, expiration and database revocation. Logout revokes the session and clears the cookie. Changing JWT_SECRET invalidates existing tokens.

Passwords use salted scrypt (N=32768,r=8,p=1) and timing-safe comparison. No plaintext password, hash or token is logged or returned in JSON. Existing localStorage mock users are not migrated or trusted; register a server account. Workout ownership comes exclusively from the session. A foreign workout ID returns 404.

CORS accepts only FRONTEND_ORIGIN with credentials. Other Origin values and browser cross-site writes are rejected. Auth attempts are limited to 30/IP per 15 minutes by an in-process limiter. Browser camera/tracking remains available without auth; anonymous results are not persisted.

Optional demo login creates a separate persisted account for each anonymous caller with an unrecoverable random password hash. It reuses an existing valid session and never shares a demo account. Demo data stays isolated, but the account cannot be recovered by password after its session expires. Demo is disabled by default and always disabled in production.

## API

Success: `{ "ok": true, "data": ... }`. Error: `{ "ok": false, "error": { "code": "...", "message": "..." } }`. JSON only, including unknown routes/errors. Body limit 64 KB. Unknown fields are rejected, including ownership or pose fields.

| Method | Route | Auth | Request body | Response data/status | Possible errors |
| --- | --- | --- | --- | --- | --- |
| GET | /api/health | No | None | 200 `{status:"healthy",database:"connected"}` | 503 database unavailable |
| POST | /api/auth/register | No | `{name,email,password}` | 201 safe user + cookie | 400 validation, 409 duplicate, 429 |
| POST | /api/auth/login | No | `{email,password}` | 200 safe user + cookie | 400, 401 invalid credentials, 429 |
| POST | /api/auth/logout | Optional | None or `{}` | 200 null, revoke cookie/session | 503 |
| POST | /api/auth/demo | No | None or `{}` | 201 new demo user / 200 existing user | 403 disabled, 429 |
| GET | /api/me | Yes | None | 200 safe user | 401 |
| GET | /api/auth/me | Yes | None | Same as /api/me | 401 |
| POST | /api/workouts | Yes | WorkoutResult below | 201 saved result / 200 identical retry | 400, 401, 409 result conflict |
| GET | /api/workouts | Yes | None | 200 array, newest finishedAt first | 401 |
| GET | /api/workouts/:id | Yes | None | 200 original WorkoutResult | 401, 404 absent/foreign |
| GET | /api/progress | Yes | None | 200 progress below | 401 |

Any route may return 403 disallowed origin, 413 oversized body, or 500 unexpected failure. Invalid JSON returns 400 INVALID_JSON; unknown routes return JSON 404 NOT_FOUND. Database details are never exposed. Common connection failures return 503.

Registration validates trimmed nonempty name (max 100), normalized email (max 254), password length 6–128. The minimum preserves the existing UI contract. User DTO: id, name, email, avatar, neutral level, createdAt, updatedAt. No XP, leaderboard or achievements.

### WorkoutResult example

```json
{
  "id": "workout-example-1", "workoutNumber": 1, "programId": "full-body",
  "startedAt": "2026-09-30T10:00:00.000Z", "finishedAt": "2026-09-30T10:04:00.000Z",
  "durationMs": 240000, "completed": true,
  "exercises": [
    { "exerciseId": "squat", "targetReps": 8, "completedReps": 8, "cleanReps": 7, "durationMs": 60000,
      "errors": [{ "rep": 3, "code": "SQ_SHALLOW", "severity": "critical" }] },
    { "exerciseId": "armraise", "targetReps": 8, "completedReps": 8, "cleanReps": 8, "durationMs": 60000, "errors": [] },
    { "exerciseId": "sidebend", "targetReps": 10, "completedReps": 10, "cleanReps": 10, "durationMs": 60000, "errors": [] }
  ]
}
```

POST returns `{ok:true,data:<same result>}`. GET detail uses this original id. Validation checks booleans, integer nonnegative reps/durations, valid timestamps in order, cleanReps <= completedReps, known exercises/errors and number/program mapping: 1/full-body, 2/strength, 3/light. Errors validate rep/code/severity; rep cannot exceed completedReps. The API allows 1–3 stages to accept the contract's shorter examples/incomplete summaries; no programs are modified. Duration is bounded to seven days, reps to PostgreSQL integer capacity, errors to 1000/stage. Exercise duration cannot exceed session duration. Session duration includes preparation/rest and need not equal summed exercise durations. ID supports UUID and existing local fallback string.

### Progress example

```json
{
  "ok": true,
  "data": {
    "totalWorkouts": 1, "totalReps": 26, "totalDurationMs": 240000, "lastWorkoutAt": "2026-09-30T10:04:00.000Z",
    "exerciseTotals": {
      "squat": { "completedReps": 8, "cleanReps": 7, "durationMs": 60000 },
      "armraise": { "completedReps": 8, "cleanReps": 8, "durationMs": 60000 },
      "sidebend": { "completedReps": 10, "cleanReps": 10, "durationMs": 60000 },
      "pushup": { "completedReps": 0, "cleanReps": 0, "durationMs": 0 }
    }
  }
}
```

GET progress aggregates the owner's saved sessions/stages, including incomplete summaries. Last workout is maximum finishedAt; repeated stages contribute separately. Empty accounts return zeros and null lastWorkoutAt. user_progress caches transactionally updated totals; GET reads source records. No PUT progress endpoint exists. Existing `saveUserProgress(progress)` reads server progress and ignores supplied totals.

### Requests (PowerShell 7)

```powershell
$account = @{ name = 'Your name'; email = 'your-email@example.com'; password = Read-Host 'Test password' -MaskInput }
Invoke-RestMethod http://localhost:3000/api/auth/register -Method Post -ContentType application/json -Body ($account | ConvertTo-Json) -SessionVariable motionSession
# Save the WorkoutResult example above to a local workout.json.
Invoke-RestMethod http://localhost:3000/api/workouts -Method Post -ContentType application/json -Body (Get-Content workout.json -Raw) -WebSession $motionSession
Invoke-RestMethod http://localhost:3000/api/workouts -WebSession $motionSession
Invoke-RestMethod http://localhost:3000/api/workouts/workout-example-1 -WebSession $motionSession
Invoke-RestMethod http://localhost:3000/api/progress -WebSession $motionSession
Invoke-RestMethod http://localhost:3000/api/auth/logout -Method Post -WebSession $motionSession
```

Example 401 response: `{ "ok": false, "error": { "code": "UNAUTHENTICATED", "message": "Войдите в аккаунт для доступа к сохранённым тренировкам." } }`.

## Frontend compatibility/failure handling

All eight existing async exports remain. Success shapes are preserved; logout also supplies data:null. Structured HTTP errors adapt to string `error` for existing UI, with code/status fields. Anonymous getCurrentUser returns `{ok:true,data:null}`. New getUserProgress/subscribeApi support progress/save status without touching core events.

Requests time out after ten seconds. Failed saves update Results status without clearing workout rows or stopping camera. No offline fallback reports success. There is no automatic replay queue; failures are explicit. Account changes invalidate pending history responses; logout clears history and server totals. History uses actual stage reps/clean reps rather than fabricated defaults.

## Tests

```sh
npm run generate
npm run validate
npm run check
npm test
npm audit
```

`npm test` now loads ignored .env, so the database suite runs automatically when setup:database has configured TEST_DATABASE_URL. To check the running frontend and API together without HTTP fixtures, start both services and run `npm run smoke:live`. It registers one uniquely named verification user through the existing UI, serializes an actual workout-controller result, saves it to the application database, checks history/progress and logs out. It then deletes only its own verification account/data. The generated repetition counts are synthetic; this does not replace a real camera workout.

Without TEST_DATABASE_URL the database suite explicitly skips. Validation/password, HTTP middleware, adapter/static assets and browser checks can run without database credentials. Browser checks use installed Edge/Chromium and skip if absent. HTTP/UI fixtures only test UI/middleware contracts; they are not database substitutes. Runtime always uses PostgreSQL.

For actual integration tests, create a dedicated test database, supply its real URL and migrate it first. In a fresh PowerShell terminal inside backend/:

```powershell
$env:TEST_DATABASE_URL = Read-Host 'Dedicated test PostgreSQL URL'
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run migrate
npm run test:database
```

The suite starts a real backend child process, checks registration, duplicate/wrong password, login, safe users, ownership, history, ordered repeated stages/errors, validation, idempotency, progress and rollback. It stops/restarts that process, logs in again, checks persisted data, and verifies revoked-cookie replay fails. Cleanup deletes only unique test accounts with FK cascades; no truncate/reset. Never use shared/production databases. Interrupted tests can leave uniquely prefixed test accounts for manual review.

Manual checks: complete all three existing workouts with a real camera; verify saved Results/history/progress; restart backend and log in again; test isolation with a second user; stop backend before workout completion and confirm Results still renders with failure status. Follow ../CORE_TESTS.md for actual camera/calibration/rep/repeat regression. Browser smoke tests cannot establish real-world motion correctness. No pre-existing build/lint commands exist; npm run check validates JS syntax.

Before PR: git diff --check, inspect diff, confirm protected paths unchanged, run database tests using your configured PostgreSQL, and record real camera checks. Do not commit secrets/node_modules. No automatic commit/push/merge is part of setup.
