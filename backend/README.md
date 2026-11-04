# SchoolHealth Backend

Backend foundation for the SchoolHealth application, built with FastAPI and SQLAlchemy 2.x.

## Requirements

- Python 3.12 or newer
- PostgreSQL is only needed when adding or using database-backed features. The root and health endpoints and their tests do not require it.

## Local setup

Run these commands from the `backend` directory:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `DATABASE_URL` in `.env` when Dev A provides the PostgreSQL connection details. The expected SQLAlchemy driver format is `postgresql+psycopg://...`. Set `AUTH_TOKEN_SECRET` to a unique random value of at least 32 characters; generate one with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. No real credentials or signing secrets belong in the repository.

## Run the API

```powershell
uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`. Swagger UI is at `/docs`. Routes include `GET /`, `GET /health`, `POST /auth/login`, `GET /auth/me`, and the student profile endpoints.

Set `CORS_ORIGINS` to a comma-separated list of frontend origins. The defaults allow the usual local development origins on ports 3000 and 5173.

## Run tests

```powershell
python -m pytest
```

The endpoint tests use FastAPI's test client and test authentication against synthetic account fixtures; they do not require a PostgreSQL connection.

## Seed TASK-01 demo data

From the repository root, configure the local Compose `.env` and start PostgreSQL
with `docker compose up -d --wait db`. In PowerShell, set
`$env:SCHOOLHEALTH_DEMO_PASSWORD` to a demo-only password of at least eight
characters and at most 72 UTF-8 bytes. Set `$OutputEncoding = [Text.UTF8Encoding]::new($false)`
to preserve Vietnamese names when piping SQL.

Run the seed with one command:

```powershell
Get-Content -Raw -Encoding UTF8 backend/scripts/seed_demo.sql | docker compose exec -T -e SCHOOLHEALTH_DEMO_PASSWORD db sh -c 'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

The script creates 24 fictional students in class 6A1,
24 health profiles, two checkup sessions, and 48 result rows. Results include
completed, follow-up, pending, and absent statuses. Pending and absent rows have
no measurements so dashboards can distinguish them from completed screenings.

| Role | Demo account |
| --- | --- |
| Admin | `admin@schoolhealth.example` |
| Nurse | `nurse@schoolhealth.example` |
| Parent | `parent@schoolhealth.example` |

The initial accounts share the demo password supplied on the first run and store
bcrypt hashes through PostgreSQL's `pgcrypto` extension. The parent is linked
to students `DEMO-001` and `DEMO-017`. Rerunning the seed fills in missing demo
rows and preserves existing rows, including profile edits and password hashes.

The seed writes to the application's PostgreSQL `schoolhealth_demo` schema.
`GET /students` reads `schoolhealth_demo.students` and returns each student's `id`,
`full_name`, and `class_name`, ordered by ID.
`POST /students` creates a student and health profile in one transaction. Send
`id`, `full_name`, and `class_name` as nonblank strings. You can also send
`allergies` and `medical_notes`. The API returns HTTP 201 on success, 409 if the
student ID already exists, and 422 if the request fails validation.
New student IDs must contain 1–50 ASCII letters, digits, hyphens, or underscores
(`A-Z`, `a-z`, `0-9`, `-`, `_`). The creation form enforces the same format.
`GET /students/{student_id}` returns the student's basic profile.
`PATCH /students/{student_id}` accepts changes to `full_name`, `class_name`,
`allergies`, and `medical_notes`. Omitted fields keep their values. Send
`null` or a blank string to clear allergies or notes. An unknown ID returns 404.
If you ran an older seed into `public`, rerun the command above to populate
`schoolhealth_demo` with the shared demo accounts and sample records.

## Demo login API

`POST /auth/login` accepts `email` and `password` as JSON. It checks the
SCRUM-27 seeded account's bcrypt password hash and returns a signed bearer token
with the user's `id`, `email`, and lowercase `role` (`admin`, `nurse`, or
`parent`). Invalid credentials return HTTP 401 without issuing a token.
`GET /auth/me` requires a valid bearer token and returns the authenticated user.
Tokens expire after one hour. See
[`../docs/us-1.1-auth-contract.md`](../docs/us-1.1-auth-contract.md) for the
request/response contract and role landing routes.

The `/auth/me` endpoint is the protected authentication check for this story.
Authorization for student health data remains in SCRUM-20.

## Docker integration

After seeding, run `docker compose up -d --build api` from the repository root
and open `http://127.0.0.1:8000/students`. Compose connects the API to its
`db` service with the PostgreSQL settings from the root `.env`. For a separate
deployment, set `DATABASE_URL` explicitly.

To try the Nurse screen, run `npm ci` and `npm run dev` from `frontend`, then
open `http://localhost:5173/nurse`. The screen uses the local API on port 8000.
Set `VITE_API_URL` before starting Vite if the API is running elsewhere.
