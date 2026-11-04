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

From the repository root, configure the Compose .env and run
`docker compose up -d --build api`. Set the local environment variable
`SCHOOLHEALTH_DEMO_PASSWORD` to a demo-only password of 8–72 UTF-8 bytes.

Import the CSV dataset with one command.

```powershell
docker compose exec -T -e SCHOOLHEALTH_DEMO_PASSWORD api python -m app.seed_demo
```

The committed UTF-8 BOM files in `backend/data/` contain 24 fictional students,
their health profiles, 27 demo accounts, two checkup sessions, and 48 checkup
results. The student CSV columns are `id,full_name,class_name,parentid,allergies,medical_notes,nurseid`.
The BOM helps Excel recognize Vietnamese text when opening the CSV directly.
Each student has a dedicated synthetic parent account, for example `DEMO001`
links to `PARENT001`. The importer replaces legacy shared `parent` links with
these dedicated IDs. Existing custom parent assignments are preserved.

The 24 students are evenly assigned to two synthetic Nurse accounts.
DEMO001 through DEMO012 use NURSE001 and DEMO013 through DEMO024 use NURSE002.
The API and form require nurseid when creating a student and allow reassignment
to an existing account with role nurse. The database stores one Nurse assignment
per student in student_nurses. Reimport preserves existing assignments.

The accounts CSV contains account IDs, emails, and roles. Initial password hashes
are generated from the locally supplied password using PostgreSQL pgcrypto.
Rerunning the importer inserts missing records and preserves existing profile
edits, parent assignments, and password hashes. CSV edits do not overwrite
existing database records. All inserts run in one transaction.
After changing CSV files, rebuild the API image before importing.

The seed writes to the application's PostgreSQL `schoolhealth_demo` schema.
`GET /students` reads `schoolhealth_demo.students` and returns each student's `id`,
`full_name`, `class_name`, `parentid`, and `nurseid`, ordered by ID.
`POST /students` creates a student and health profile in one transaction. Send
`id`, `full_name`, and `class_name` as nonblank strings. You can also send
`allergies`, `medical_notes`, `parentid`, and `nurseid`. Parent and Nurse IDs must reference existing accounts with the matching role; both fields are required when creating a student. The API returns HTTP 201 on success, 409 if the
student ID already exists, and 422 if the request fails validation.
New student IDs must contain 1–50 ASCII letters and digits
(`A-Z`, `a-z`, `0-9`). The creation form enforces the same format.
The Nurse screen filters IDs by a case-insensitive substring. API clients can
also use `GET /students?student_id=DEMO001`.
`DELETE /students/{student_id}` permanently removes the student, health profile,
parent links, and checkup results in one transaction. The screen requests
confirmation before deletion. Rerunning the demo seed recreates missing sample rows.
`GET /students/{student_id}` returns the student's basic profile.
`PATCH /students/{student_id}` accepts changes to `full_name`, `class_name`,
`allergies`, `medical_notes`, `parentid`, and `nurseid`. Omitted fields keep their values. Send
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
Student profile and checkup endpoints require a valid Nurse bearer token; other
roles receive HTTP 403. The UI restores and verifies the existing login session
before it loads these endpoints.

## Nurse workspace API

All routes below require the authenticated `nurse` role. Send the login token as
`Authorization: Bearer <access_token>`.

- `GET /students?q=<term>` lists up to 200 students and searches ID, name, and
  class. The legacy `student_id` query parameter remains supported. `POST /students`, `GET /students/{student_id}`, and
  `PATCH /students/{student_id}` manage available student and health-profile
  fields (`id`, `full_name`, `class_name`, `allergies`, `medical_notes`, `parentid`, `nurseid`).
- `GET /checkup-sessions` lists seeded sessions.
- `GET /checkup-sessions/{session_id}/results?q=<term>` returns a session roster
  with each student's profile, examination status, measurements, vision, notes,
  and calculated BMI. Students without an examination row appear as `pending`.
- `PUT /checkup-sessions/{session_id}/results/{student_id}` creates or updates
  an examination row. The body accepts `status` (`completed`, `follow_up`,
  `pending`, `absent`), `height_cm`, `weight_kg`, `vision_left`, `vision_right`,
  and `notes`.
- `DELETE /checkup-sessions/{session_id}/results/{student_id}` removes an
  incorrect examination row. It does not delete the student; the student returns
  to the roster as pending.

BMI is returned to one decimal place when both positive metric measurements are
present. The API does not apply clinical thresholds or produce diagnoses. The
shared student model does not currently provide gender, date of birth, age, or
guardian contact fields, so the nurse UI does not invent or display them.

## Docker integration

After seeding, run `docker compose up -d --build api` from the repository root
and open `http://127.0.0.1:8000/students`. Compose connects the API to its
`db` service with the PostgreSQL settings from the root `.env`. For a separate
deployment, set `DATABASE_URL` explicitly.

To try the Nurse screen, run `npm ci` and `npm run dev` from `frontend`, then
open `http://localhost:5173/nurse`. The screen uses the local API on port 8000.
Set `VITE_API_URL` before starting Vite if the API is running elsewhere.
