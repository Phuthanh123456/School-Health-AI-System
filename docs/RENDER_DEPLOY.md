# Render demo

The Blueprint creates one Docker web service (React and FastAPI on the same origin)
and one new PostgreSQL database. Local databases and `.env` are not uploaded.

1. Connect this GitHub repository in Render and create a Blueprint from
   branch `codex/render-demo`, using `render.yaml`.
2. Enter `SCHOOLHEALTH_DEMO_PASSWORD` (8–72 UTF-8 bytes) and `LLM_API_KEY`
   in Render's secret environment fields. Never commit these values.
3. Deploy and wait for `/health` to return HTTP 200. Open the web service's
   public `https://…onrender.com` URL.

The container imports the fictional CSVs at startup, preserving existing records
and edits. It then starts on Render's `PORT`. Account emails include
`admin@schoolhealth.example`, `nurse001@schoolhealth.example`, and
`parent001@schoolhealth.example`; use the demo password chosen in Render.

Ollama is selected by `LLM_BASE_URL` and `LLM_MODEL`. The key stays in the backend.
`DATABASE_URL` is supplied by Render and normalized to the installed psycopg driver.
The UI uses same-origin relative API URLs, so no localhost endpoint is embedded.

The free web service sleeps when idle, and free Postgres expires after 30 days.
See https://render.com/docs/free for current limits.
