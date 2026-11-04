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
to students `DEMO-001` and `DEMO-017`. Rerunning the seed fills in missing demo
rows and preserves existing rows, including profile edits and password hashes.

The tables live in the `schoolhealth_demo` schema. The seed provides the data for
the login, parent visibility, Nurse entry, and dashboard stories. Login, parent
visibility, and dashboard flows still need application models and endpoints
wired to the demo tables, or seed data migrated into the team's application
schema once it is agreed.

## Nurse checkup result entry

The current checkup API uses the seeded `schoolhealth_demo` tables. Apply
`backend/scripts/migrate_checkup_results.sql` to an existing seeded database
before starting the updated API. Fresh demo databases receive the same columns
from `backend/scripts/seed_demo.sql`. The migration adds BMI, vision, and audit
timestamps while retaining existing demo statuses. The existing composite
primary key `(session_id, student_id)` remains the database uniqueness rule.

Checkup routes use HTTP Basic credentials checked against the seeded accounts;
use the Nurse account and demo password configured when the database was
seeded. Serve these routes over HTTPS outside local development. Available
routes are:

- `GET /checkups/sessions`
- `GET /checkups/sessions/{session_id}/students?q={name-or-student-code}`
- `GET /checkups/sessions/{session_id}/students/{student_id}/result`
- `PUT /checkups/sessions/{session_id}/students/{student_id}/result`

The student search derives participation from the existing
`checkup_results(session_id, student_id)` rows, including pending and absent
demo rows. The API accepts only the Nurse-selected `Normal` and
`Needs Follow-up` values and maps them to the existing database values
`completed` and `follow_up`. BMI is calculated from centimeters and kilograms;
the UI rounds it to two decimals for display.

Example save request:

```http
PUT /checkups/sessions/DEMO-CURRENT/students/DEMO-001/result
Authorization: Basic <nurse credentials>
Content-Type: application/json

{
  "height_cm": 150,
  "weight_kg": 42.5,
  "vision": null,
  "notes": "Synthetic demo note",
  "status": "Normal"
}
```

The frontend uses `VITE_API_BASE_URL` when set and otherwise calls
`http://localhost:8000`.

## Docker integration

Build the API image from this directory with `docker build -t schoolhealth-api .`. The image starts Uvicorn on port 8000 and is ready to be referenced as the API service's `build` context in the project Docker Compose configuration. Pass `DATABASE_URL` and, if needed, `CORS_ORIGINS` to that service through its environment.

Dev A should provide the PostgreSQL hostname/service name reachable from the API container, port, database name, username, password, and any required SSL options. The API reads the resulting connection string only from `DATABASE_URL`; it does not create the database or a PostgreSQL container.
