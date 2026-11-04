# SchoolHealth AI System

SchoolHealth is a web-based school health management platform for students, families, and school health teams. It is designed to keep student health records organized, make checkup results easier to follow, and support coordinated care over time.

> **Project status:** In development. The frontend foundation is in place; backend services and the planned product features are still being developed.

## Product goals

- Keep student health records and checkup history together across school years.
- Import existing Excel records with validation and duplicate detection.
- Track checkup results, health trends, and cases that need follow-up.
- Help school health staff, families, and students coordinate care with role-based access.
- Use AI to explain health information and suggest nutrition improvements, with clinical decisions left to healthcare professionals.

## Planned features

1. User login, role-based permissions, and parent–student account linking.
2. Student profiles with health history and nutrition habits.
3. Excel import and migration with column mapping, validation, duplicate detection, and a preview before confirmation.
4. School checkup management, examination results, and follow-up notes.
5. Dashboards and reports by student, class, school year, and checkup session.
6. AI-assisted health explanations and nutrition suggestions using Ollama.

## Proposed technology stack

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Tailwind CSS |
| Charts | Recharts |
| Backend API | Python, FastAPI |
| Database | PostgreSQL |
| Excel import | pandas, openpyxl |
| AI integration | Ollama |
| Testing | pytest, Playwright |
| Development and demo | Docker Compose |
| Version control | Git, GitHub |

## Repository structure

```text
.
├── frontend/                 # React + TypeScript application
│   └── src/                  # Application source
├── backend/                  # FastAPI application (planned)
├── AI_RULES.md               # Safe AI use for development and product features
├── CONTRIBUTING.md           # Branch, commit, and pull request process
└── .github/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/ci.yml      # GitHub Actions workflow
```

## Getting started

Clone the repository:

```bash
git clone https://github.com/Phuthanh123456/School-Health-AI-System.git
cd School-Health-AI-System
```

### Frontend

The frontend uses Vite, React, TypeScript, and Tailwind CSS. Install dependencies and start the development server:

```bash
cd frontend
npm install
npm run dev
```

Vite prints the local URL (usually `http://localhost:5173`). Frontend checks can also be run from the `frontend` directory:

```bash
npm run lint
npm run typecheck
npm run build
```

### Backend

Backend setup instructions will be added when the FastAPI application and its dependency files are available.

### Start PostgreSQL locally

From the repository root with Docker running, copy the sample environment file if you do not already have a local configuration.

```powershell
Copy-Item .env.example .env
docker compose up -d --wait db
docker compose ps db
'SELECT 1;' | docker compose exec -T db sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1'
```

Expect the service to report `healthy` and the query to return `1`. The database is reachable from other Compose services at `db:5432`. The named volume preserves data when the container is recreated. The sample credentials are for local development.

## Testing and CI

### Admin AI insights (US-6.1)

After signing in as Admin, `/admin` loads current school-wide counts directly from the database and can generate Ollama-backed insights. See [US-6.1 setup, API contract and safeguards](docs/US-6.1.md). Configure the provider key only on the backend. AI requests use the same authenticated API client and `VITE_API_URL` as sign-in. The old `/#admin` bookmark now requires an Admin session too.

The GitHub Actions workflow at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes, pull requests, and manual dispatch. It is prepared to:

- Install backend dependencies from `backend/requirements.txt` and run pytest tests in `backend/tests/`.
- Install frontend dependencies with `npm ci`, then run the `lint`, `typecheck`, and `build` scripts defined in `frontend/package.json`.
- Install Chromium and run Playwright tests when a `frontend/playwright.config.*` file and test files under `frontend/tests/` are present.

Run the corresponding checks locally:

```bash
# Backend
cd backend
python -m pytest -q tests

# Frontend checks
cd ../frontend
npm ci
npm run lint
npm run typecheck
npm run build

# End-to-end tests (after Playwright is configured)
npx playwright test
```

Playwright should have a `webServer` configuration to start the application before running end-to-end tests. Backend checks will run once the backend dependency file and tests are added.

## Team workflow and data safety

- Use Jira as the source of truth for Sprint goals, stories, acceptance criteria, status, and blockers.
- Work on small, short-lived branches tied to a Jira item; open a pull request and merge completed increments into `main` frequently.
- Require passing CI and at least one teammate review before merging; mark Jira work Done only after acceptance criteria and the Definition of Done are met.
- Use synthetic student records for development and demos. Do not commit passwords, API keys, or real student health data.
- Treat AI output as informational support only; it does not replace a healthcare professional's diagnosis or decisions.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the repository workflow and [`AI_RULES.md`](AI_RULES.md) for detailed AI-use rules.
