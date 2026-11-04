# US-6.1 — AI-assisted school health insights

## Run and review

1. In `backend`, install `requirements.txt`. Copy `.env.example` to `.env` only if no local configuration exists.
2. Configure `LLM_BASE_URL=https://ollama.com/v1`, `LLM_MODEL=gpt-oss:20b`, and `LLM_API_KEY` on the server. Never use a `VITE_*` variable for keys. Ollama Cloud uses the OpenAI-compatible chat endpoint: https://docs.ollama.com/api/openai-compatibility.
3. Set `INSIGHTS_ADMIN_TOKEN` to an independently generated random secret, e.g. `python -c "import secrets; print(secrets.token_urlsafe(32))"`. It is a temporary admin access credential, not the provider key.
4. Run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from `backend`.
5. Sign in with the Admin role first. In `frontend`, run `npm ci` then `npm run dev`. Visit `http://localhost:5173/admin/insights`, enter the admin access credential and press **Generate AI Insights**. Demo counts are editable and explicitly synthetic. The existing landing page remains available at `/#home`.
6. Production hosting must proxy `/api` to FastAPI using HTTPS. Vite supplies this proxy only for development.

## Contract and safeguards

`POST /api/admin/ai-insights`, `Authorization: Bearer <admin credential>`.
Body is exactly five integer counts: `total_students`, `checkups_completed`, `followups_pending`, `vision_flags`, `dental_flags`. Counts represent distinct students in the CURRENT school-wide snapshot; flags/follow-ups refer to examined students and may overlap. Do not sum overlapping groups. All fields are required. Strict integers only, 0–1,000,000; completed <= total and each flag/follow-up <= completed.

Unknown fields, names, IDs, notes, prompts and record lists are rejected before provider calls. Validation errors do not echo input. Only explicit numeric fields are serialized, with no school name, class, dates, cohort labels or user data. Cohorts below 20 students or 20 examined students are refused; nonzero cells below 5 are omitted from the provider payload. Zero counts remain valid. These are conservative engineering thresholds, not an assertion of anonymization or a substitute for the team's privacy review. There is no historical baseline or individual risk inference.

Ollama selects 1–3 metric codes and 1–3 general school action codes. The backend validates those selections and renders a concise Vietnamese summary using the supplied counts plus reviewed, bounded action wording. This is **AI-selected, template-rendered text**, not unrestricted model prose. Arbitrary advice, diagnostic/treatment codes, extra output fields, duplicates, suppressed metrics, malformed JSON and recommendations contradicted by counts are rejected. No model prose, reasoning or HTML is displayed. The informational disclaimer is server-owned and visible even before generation.

Ollama Cloud currently does not guarantee structured output enforcement (https://docs.ollama.com/capabilities/structured-outputs); therefore the prompt requests JSON and the server validates it. Invalid output yields a retryable 502, never a fabricated success summary. Provider I/O has a 20-second total deadline; the frontend aborts at 25 seconds. Missing configuration gives 503; unauthorized access 403; invalid counts 422; provider/format failure 502; timeout 504. No automatic retries that could duplicate provider charges. No request bodies, provider response bodies or credentials are logged by feature code.

`AIInsightsPanel` accepts `stats` and `adminToken`; it constructs its own five-field allowlist. Loading disables duplicate requests, errors preserve dashboard counts and allow retry, and changed statistics/credentials cancel pending requests and clear stale results. Credentials stay in component memory and are cleared on navigation/reload; never local/session storage. Provider secrets are never returned to the browser.

## Integration work required before release

The repository does not yet have authenticated Admin sessions or a dashboard statistics API. This story provides a preview screen and a fail-closed temporary backend access gate, **not completed production RBAC**. Replace `require_admin` with the shared authenticated Admin role dependency; pass the session credential into the panel and remove the manual development credential input. Source `stats` from the authoritative school-wide aggregation API; do not pass individual records or user-selected small cohorts. Remove the editable demo counts on the real dashboard. Do not expose the temporary shared-token preview publicly. The endpoint currently validates supplied counts but cannot verify their database provenance.

Qualified school health staff must review the prompt, disclaimer and action wording before release per `AI_RULES.md`. Team review and CI are required before merge; implementation does not mark the Jira story Done. No chatbot, RAG, model training, individual prediction, diagnosis or prescribing is included.

## Validation

- Backend: `cd backend; python -m pytest -q` (provider mocked; no secret needed).
- Frontend: `cd frontend; npm run lint; npm run typecheck; npm run build`.
- Browser regressions: `cd frontend; npx playwright install chromium; npx playwright test`. CI discovers these tests automatically.
- Live provider validation uses only synthetic school counts and the local ignored `.env`. It is separate from automated mock-based regressions; real-provider latency/availability and model selections can vary.

Significant AI assistance was used for this implementation and should be disclosed in the review/PR.
