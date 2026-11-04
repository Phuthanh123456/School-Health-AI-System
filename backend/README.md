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

## Seed fictional CSV demo data

From the repository root, configure `.env` from `.env.example`, including the PostgreSQL values, `AUTH_TOKEN_SECRET` and `SCHOOLHEALTH_DEMO_PASSWORD` (8?72 UTF-8 bytes). Start the full demo with:

```powershell
docker compose up -d --build api frontend
```

The Compose `seed` service runs `python -m app.seed_demo`, importing Zen's four fictional CSV files from `backend/data/` into the shared `schoolhealth_demo` schema. It creates 24 students, their health profiles, two checkup sessions and 48 participation/result rows; pending and absent rows have no measurements. Existing data and passwords are preserved. The CSV's dedicated Parent/Nurse IDs are used directly. The existing shared demo Parent/Nurse logins remain available for compatibility.

The import creates the supporting `student_nurses` and `assignment_audit` tables and lookup indexes. Admin link changes and removals survive reseeding. To explicitly re-import after editing CSV files:

```powershell
docker compose build seed
docker compose run --rm seed
```

In a local Python environment with a configured database and `SCHOOLHEALTH_DEMO_PASSWORD`, run `python -m app.seed_demo` from `backend` instead. Compose and local development invoke the same importer.

The historical `scripts/seed_demo.sql` is retained for reference; Compose no longer invokes it. Current CSV IDs are DEMO001 through DEMO024. Existing installations that still use legacy hyphenated DEMO-001 IDs need the legacy ID migration before CSV import to avoid creating a second demo population.

See [SCRUM-51/52 accounts, API contracts, security and demo checks](../docs/SCRUM-51-52.md), [checkup session endpoints](docs/checkup-sessions-api.md), and [the shared schema contract](docs/data-schema.md).

## Nurse checkup session selection and result entry

The checkup API uses the seeded `schoolhealth_demo` tables. Apply
`backend/scripts/migrate_checkup_results.sql` to an existing seeded database
before starting the updated API. Fresh demo databases receive the same columns
from the ORM schema used by `python -m app.seed_demo`. The migration adds BMI, vision, and audit
timestamps while retaining existing demo statuses. The composite primary key
`(session_id, student_id)` ensures one result per participating student/session.

Checkup routes use HTTP Basic credentials checked against the seeded accounts;
use the Nurse account and demo password configured when the database was
seeded. Available routes are:

- `GET /checkups/sessions` ? predefined sessions with class and participant count
- `GET /checkups/sessions/{session_id}` ? one session with its participating students
- `GET /checkups/sessions/{session_id}/students?q={name-or-student-code}` ? search/list participants
- `GET /checkups/sessions/{session_id}/students/{student_id}/result`
- `PUT /checkups/sessions/{session_id}/students/{student_id}/result`

The participant list derives from existing
`checkup_results(session_id, student_id)` rows, including pending and absent
demo rows. The API accepts only the Nurse-selected `Normal` and
`Needs Follow-up` values and maps them to the existing database values
`completed` and `follow_up`. BMI is calculated from centimeters and kilograms;
the UI rounds it to two decimals for display. Session selection does not create
or schedule sessions.

Example save request:

```http
PUT /checkups/sessions/DEMO-CURRENT/students/DEMO001/result
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

Dev A should provide the PostgreSQL hostname/service name reachable from the API container, port, database name, username, password, and any required SSL options. The API accepts `DATABASE_URL` or the documented `POSTGRES_*` settings. The root Compose file provisions PostgreSQL and runs the CSV seed service before starting the API.
