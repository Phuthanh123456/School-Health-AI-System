# US-6.1 — AI-assisted school health insights

## Run and review

1. Configure the existing database and login service using `backend/README.md`, including a unique `AUTH_TOKEN_SECRET`. Use synthetic records for development and demos.
2. In the backend `.env`, configure `LLM_BASE_URL=https://ollama.com/v1`, `LLM_MODEL=gpt-oss:20b`, and `LLM_API_KEY`. For Docker Compose, set these in the root `.env` instead; Compose passes them to the API service. Never use a `VITE_*` variable for provider secrets. Ollama documentation: https://docs.ollama.com/api/openai-compatibility.
3. Start FastAPI from `backend`: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`. Or start the existing Compose API/database services.
4. Start the frontend with `npm ci` then `npm run dev`. Set `VITE_API_URL` to the same API origin used for sign-in (default `http://127.0.0.1:8000`). Configure `CORS_ORIGINS` to allow the frontend origin. Use HTTPS in production.
5. Sign in with an existing Admin account and open `/admin`. No additional AI access code is needed. The legacy `/#admin` bookmark is also behind the Admin route guard. Nurse and Parent sessions cannot access either the dashboard statistics or AI endpoint.

## Authoritative statistics

`GET /api/admin/dashboard-statistics` requires the existing signed Admin bearer token. The response contains `aggregates` plus the latest checkup's title/date for display. Titles and dates are **never** forwarded to the LLM.

The database computes exactly three integer counts in one SQL statement:

- `total_students`: all enrolled students in the current database.
- `checkups_completed`: students with status `completed` or `follow_up` in the latest school-wide checkup session (ordered by checkup date descending, then session ID ascending to break ties).
- `followups_pending`: students with status `follow_up` in that same session; this is a subset of examined students.

Students with missing results, `pending` or `absent` are not counted as examined. Historical sessions are not added together. No sessions produces zero examined/follow-up counts; an empty database produces all zero counts. Missing database configuration or connection failure yields a retryable 503 rather than fabricated statistics. Both successful endpoints use `Cache-Control: no-store`.

The schema does not contain standardized dental/vision flags. These unsupported demo metrics were removed; clinical flags are never inferred from free-text notes or vision strings.

## AI contract and safeguards

`POST /api/admin/ai-insights`, with the same authenticated Admin bearer token. Body is exactly the three counts shown on the dashboard. All are required, strict integers in 0–1,000,000; completed <= total and follow-ups <= completed. Unknown fields, names, IDs, prompts, notes, and record lists are rejected. Validation errors do not echo input.

Before calling the provider, the backend re-reads the authoritative database aggregates. Forged or stale counts return 409 with no LLM call. Refreshing the dashboard loads the latest snapshot and enables generation again. Only the validated database counts are serialized; no student rows or medical notes are loaded for AI.

Cohorts below 20 students or 20 examined students cannot generate insights. Nonzero follow-up counts below 5 are withheld from the provider payload; zeros are permitted. These are conservative engineering thresholds, not a guarantee of anonymization. The committed 24-student synthetic CSV dataset has only 19 examined students in its latest session, so it correctly shows the insufficient-cohort state until genuine database activity changes the count. Do not alter counts in the browser to bypass this check.

Ollama selects 1–2 supported metric codes and 1–3 school action codes. The server validates selections and renders concise Vietnamese text using exact counts and bounded wording. This is **AI-selected, template-rendered text**, not unrestricted model prose. Clinical advice, identifying text, extra output fields, duplicate selections, suppressed metrics and recommendations contradicted by counts are rejected. No model prose or HTML is displayed. There is no historical baseline, diagnosis, prescribing or individual prediction.

Ollama Cloud does not guarantee structured-output enforcement (https://docs.ollama.com/capabilities/structured-outputs), so the backend validates JSON locally. Invalid output gives a retryable 502, never a fabricated success. Provider I/O has a 20-second total deadline; the browser aborts at 25 seconds. Provider keys and response bodies are not returned in errors or logged by the feature. No automatic provider retries are performed.

## UI behavior

The real `/admin` dashboard shows read-only database counts, the relevant session, a refresh button and **Generate AI Insights**. Loading, database unavailable, empty school, no sessions, insufficient cohort, stale counts, invalid provider output and timeout states have explicit recovery behavior. AI failures preserve the visible counts. Refresh cancels in-flight generation and removes old results. Expired sessions redirect to sign-in using the shared authenticated API client. There is no shared-token fallback or public demo route.

## Validation and release review

- Backend: `cd backend; python -m pytest -q`. Tests use actual SQL aggregation against isolated synthetic SQLite tables plus real signed test tokens; provider calls are intercepted.
- Frontend: `npm run lint`, `npm run typecheck`, `npm run build`.
- Browser: `npx playwright install chromium`, then `npx playwright test`. The test server deliberately configures a separate API origin and verifies both session credentials and aggregate-only requests. CI discovers these tests automatically.
- Database/provider checks in a local QA environment are separate from mock-based tests. Never commit QA `.env` files, local credentials or student records.

Teammate review, CI and qualified school health staff review of the prompt/disclaimer/action wording remain required by `AI_RULES.md` before release. No Jira status is changed automatically. Significant AI assistance was used for implementation, tests and documentation and should be disclosed in the PR.
