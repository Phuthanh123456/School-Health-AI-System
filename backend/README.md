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
to students `DEMO001` and `DEMO017`. Rerunning the seed fills in missing demo
rows and preserves existing rows, including profile edits and password hashes.
The seed also renames the original student IDs `DEMO-001` through `DEMO-024`
to `DEMO001` through `DEMO024` in one transaction, preserving profiles,
parent links, and checkup results. If both forms of an ID already exist,
the transaction stops for manual collision resolution.

The seed writes to the application's PostgreSQL `public` schema.
`GET /students` reads `public.students` and returns each student's `id`,
`full_name`, and `class_name`, ordered by ID.
`POST /students` creates a student and health profile in one transaction. Send
`id`, `full_name`, and `class_name` as nonblank strings. You can also send
`allergies` and `medical_notes`. The API returns HTTP 201 on success, 409 if the
student ID already exists, and 422 if the request fails validation.
New student IDs must contain 1–50 ASCII letters and digits
(`A-Z`, `a-z`, `0-9`). The creation form enforces the same format.
`GET /students/{student_id}` returns the student's basic profile.
`PATCH /students/{student_id}` accepts changes to `full_name`, `class_name`,
`allergies`, and `medical_notes`. Omitted fields keep their values. Send
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
