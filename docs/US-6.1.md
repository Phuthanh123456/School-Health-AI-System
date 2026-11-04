# US-6.1 — AI-assisted school health insights

## Run and review

1. Configure the existing database and login service using `backend/README.md`, including a unique `AUTH_TOKEN_SECRET`. Use synthetic records for development and demos.
2. In the backend `.env`, configure `LLM_BASE_URL=https://ollama.com/v1`, `LLM_MODEL=gpt-oss:20b`, and `LLM_API_KEY`. For Docker Compose, set these in the root `.env` instead; Compose passes them to the API service. Never use a `VITE_*` variable for provider secrets. Ollama documentation: https://docs.ollama.com/api/openai-compatibility.
3. Start FastAPI from `backend`: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`. Or start the existing Compose API/database services.
4. Start the frontend with `npm ci` then `npm run dev`. Set `VITE_API_URL` to the same API origin used for sign-in (default `http://127.0.0.1:8000`). Configure `CORS_ORIGINS` to allow the frontend origin. Use HTTPS in production.
5. Sign in with an existing Admin account and open `/admin/overview` (also linked from Health management). No additional AI access code is needed. The legacy `/#admin` bookmark is also behind the Admin route guard. Nurse and Parent sessions cannot access either the dashboard statistics or AI endpoint.

## Authoritative statistics

`GET /api/admin/dashboard` is the US-5.2 overview used by the UI. AI generation and this endpoint share the same single-statement database aggregation. The compatibility endpoint `/api/admin/dashboard-statistics` returns the same counts under `aggregates`; its old session metadata fields are null because the scope covers all saved sessions.

- `total_students`: distinct enrolled student rows.
- `checkups_completed`: saved student/session records with status `completed`, `Normal`, `follow_up` or `Needs Follow-up`, across all sessions.
- `followups_pending`: the subset of those records marked `follow_up` or `Needs Follow-up`.

The UI maps `completed_checkups` and `status_counts.needs_follow_up` to the AI payload names above. These are record counts, not distinct examined students: 30 students can have 56 saved checkups. AI text explicitly names record counts and never renders 56/30 student coverage. Missing, pending and absent results are excluded. No sessions or results produces zero record counts. Empty schools produce zero totals. Missing database configuration/connection errors return 503. No request loads names, medical notes or individual records for AI.

The schema does not contain standardized dental/vision flags. These unsupported demo metrics were removed; clinical flags are never inferred from free-text notes or vision strings.

## AI contract and safeguards

`POST /api/admin/ai-insights`, with the same authenticated Admin bearer token. Body is exactly the three counts shown on the dashboard. All are required, strict integers in 0–1,000,000; follow-ups <= completed (record totals may exceed student totals). Unknown fields, names, IDs, prompts, notes, and record lists are rejected. Validation errors do not echo input.

Before calling the provider, the backend re-reads the authoritative database aggregates. Forged or stale counts return 409 with no LLM call. Refreshing the dashboard loads the latest snapshot and enables generation again. Only the validated database counts are serialized; no student rows or medical notes are loaded for AI.

Generation requires at least 20 enrolled students and 20 saved completed/follow-up records. Nonzero follow-up counts below 5 are withheld from the provider; zeros are permitted. These conservative engineering thresholds do not guarantee anonymization. The user cannot edit counts or bypass validation in the browser.

Ollama selects 1–2 supported metric codes and 1–3 school action codes. The server validates selections and renders concise Vietnamese text using exact counts and bounded wording. This is **AI-selected, template-rendered text**, not unrestricted model prose. Clinical advice, identifying text, extra output fields, duplicate selections, suppressed metrics and recommendations contradicted by counts are rejected. No model prose or HTML is displayed. There is no historical baseline, diagnosis, prescribing or individual prediction.

Ollama Cloud does not guarantee structured-output enforcement (https://docs.ollama.com/capabilities/structured-outputs), so the backend validates JSON locally. Invalid output gives a retryable 502, never a fabricated success. Provider I/O has a 20-second total deadline; the browser aborts at 25 seconds. Provider keys and response bodies are not returned in errors or logged by the feature. No automatic provider retries are performed.

## UI behavior

The `/admin/overview` dashboard preserves the US-5.2 metrics/status chart and adds AI Insights using the same visible statistics, with a refresh button and **Generate AI Insights**. Loading, database unavailable, empty school, no sessions, insufficient cohort, stale counts, invalid provider output and timeout states have explicit recovery behavior. AI failures preserve the visible counts. Refresh cancels in-flight generation and removes old results. Expired sessions redirect to sign-in using the shared authenticated API client. There is no shared-token fallback or public demo route. Admin management, Parent and Nurse workspaces are preserved; navigation links connect Admin management and the overview.

## Validation and release review

- Backend: `cd backend; python -m pytest -q`. Tests use actual SQL aggregation against isolated synthetic SQLite tables plus real signed test tokens; provider calls are intercepted.
- Frontend: `npm run lint`, `npm run typecheck`, `npm run build`.
- Browser: `npx playwright install chromium`, then `npx playwright test`. The test server deliberately configures a separate API origin and verifies both session credentials and aggregate-only requests. CI discovers these tests automatically.
- Database/provider checks in a local QA environment are separate from mock-based tests. Never commit QA `.env` files, local credentials or student records.

Teammate review, CI and qualified school health staff review of the prompt/disclaimer/action wording remain required by `AI_RULES.md` before release. No Jira status is changed automatically. Significant AI assistance was used for implementation, tests and documentation and should be disclosed in the PR.
