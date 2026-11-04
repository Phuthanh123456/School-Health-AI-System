# SchoolHealth AI System

SchoolHealth is a web-based school health management platform for students, families, and school health teams. It is designed to keep student health records organized, make checkup results easier to follow, and support coordinated care over time.

> **Project status:** Development demo. Login, role-specific screens, student profiles, checkup sessions/results, demo data, and an AI insights preview are available. Some integrations still require local configuration.

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

### Full Docker demo

From the repository root, create the local environment file once, then start the complete stack. Compose builds the frontend and API, waits for PostgreSQL, seeds synthetic students and checkup results, and then starts the web app.

```powershell
Copy-Item .env.example .env
docker compose up -d --build api frontend
docker compose ps
```

Open `http://localhost:5174`. Demo accounts use the same password from `SCHOOLHEALTH_DEMO_PASSWORD` in `.env`:

| Role | Email |
| --- | --- |
| Admin | `admin@schoolhealth.example` |
| Nurse | `nurse@schoolhealth.example` |
| Parent (multiple-child demo) | `parent@schoolhealth.example` |
| Dedicated Parent | `parent001@schoolhealth.example` (through parent024) |
| Dedicated Nurse | `nurse001@schoolhealth.example`, `nurse002@schoolhealth.example` |

The database is reachable by Compose services at `db:5432`; the API is available on `http://localhost:8001`. PostgreSQL data stays in the named Compose volume. For AI-generated insights, configure `LLM_API_KEY` and `INSIGHTS_ADMIN_TOKEN` in `.env`, then restart with `docker compose up -d --force-recreate api`.

## Testing and CI

### Parent and Admin workspaces (SCRUM-51 / SCRUM-52)

After login, Parents open `/parent` to view their own profile and linked children's health information. Admins open `/admin` to filter student health records by Class, Parent and Nurse, paginate results, and assign or remove Parent/Nurse links. The School filter was removed from this scope. See [API contracts, data rules, demo accounts and acceptance checks](docs/SCRUM-51-52.md).

The seed now imports Zen's fictional CSVs into the shared `schoolhealth_demo` schema. It preserves saved edits and explicit Admin assignment removals when re-run. The old AI preview is at `/admin/insights`; its server-side provider configuration and temporary credential gate are documented in [US-6.1](docs/US-6.1.md).

The GitHub Actions workflow at [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes, pull requests, and manual dispatch. It:

- Install backend dependencies from `backend/requirements.txt` and run pytest tests in `backend/tests/`.
- Install frontend dependencies with `npm ci`, then run lint, typecheck, build, unit tests and browser specs.
- Run Parent/Admin integration against a disposable PostgreSQL schema, including concurrent writes and seed preservation.
- Install Chromium and run Playwright tests when configured test files are present.

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

Playwright uses the configuration in `frontend/playwright.config.ts`.

## Team workflow and data safety

- Use Jira as the source of truth for Sprint goals, stories, acceptance criteria, status, and blockers.
- Work on small, short-lived branches tied to a Jira item; open a pull request and merge completed increments into `main` frequently.
- Require passing CI and at least one teammate review before merging; mark Jira work Done only after acceptance criteria and the Definition of Done are met.
- Use synthetic student records for development and demos. Do not commit passwords, API keys, or real student health data.
- Treat AI output as informational support only; it does not replace a healthcare professional's diagnosis or decisions.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the repository workflow and [`AI_RULES.md`](AI_RULES.md) for detailed AI-use rules.
