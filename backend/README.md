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

Set `DATABASE_URL` in `.env` when Dev A provides the PostgreSQL connection details. The expected SQLAlchemy driver format is `postgresql+psycopg://...`. No credentials are included in this repository.

## Run the API

```powershell
uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000`. Swagger UI is at `/docs`; the basic routes are `GET /` and `GET /health`.

Set `CORS_ORIGINS` to a comma-separated list of frontend origins. The defaults allow the usual local development origins on ports 3000 and 5173.

## Run tests

```powershell
python -m pytest
```

The basic endpoint tests use FastAPI's test client and never connect to PostgreSQL.

## Seed TASK-01 demo data

From the repository root, configure the Compose .env and run
`docker compose up -d --build api`. Set the local environment variable
`SCHOOLHEALTH_DEMO_PASSWORD` to a demo-only password of 8–72 UTF-8 bytes.

Import the CSV dataset with one command.

```powershell
docker compose exec -T -e SCHOOLHEALTH_DEMO_PASSWORD api python -m app.seed_demo
```

The committed UTF-8 files in `backend/data/` contain 26 fictional students,
their health profiles, three demo accounts, two checkup sessions, and 48 checkup
results. The student CSV columns are `id,full_name,class_name,parentid,allergies,medical_notes`.
It snapshots the current demo data, including two manually added fictional students.
Every student has a parent ID. Students previously lacking a parent link are
assigned to the synthetic `parent` account.

The accounts CSV contains account IDs, emails, and roles. Initial password hashes
are generated from the locally supplied password using PostgreSQL pgcrypto.
Rerunning the importer inserts missing records and preserves existing profile
edits, parent assignments, and password hashes. CSV edits do not overwrite
existing database records. All inserts run in one transaction.
After changing CSV files, rebuild the API image before importing.

The seed writes to the application's PostgreSQL `public` schema.
`GET /students` reads `public.students` and returns each student's `id`,
`full_name`, `class_name`, and `parentid`, ordered by ID.
`POST /students` creates a student and health profile in one transaction. Send
`id`, `full_name`, and `class_name` as nonblank strings. You can also send
`allergies`, `medical_notes`, and `parentid`. The parent ID must reference an existing account with role parent. Existing callers that omit it use the demo account `parent`. The API returns HTTP 201 on success, 409 if the
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
`allergies`, `medical_notes`, and `parentid`. Omitted fields keep their values. Send
`null` or a blank string to clear allergies or notes. An unknown ID returns 404.
If you ran the old seed into `schoolhealth_demo`, rerun the command above to
populate `public`. This creates a new sample dataset in `public` and leaves the
previous demo schema available for reference.

## Docker integration

After seeding, run `docker compose up -d --build api` from the repository root
and open `http://127.0.0.1:8000/students`. Compose connects the API to its
`db` service with the PostgreSQL settings from the root `.env`. For a separate
deployment, set `DATABASE_URL` explicitly.

To try the Nurse screen, run `npm ci` and `npm run dev` from `frontend`, then
open `http://localhost:5173/nurse`. The screen uses the local API on port 8000.
Set `VITE_API_URL` before starting Vite if the API is running elsewhere.
