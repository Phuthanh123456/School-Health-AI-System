# SCRUM-51 / SCRUM-52: Parent and Admin workspaces

Scope follows the supplied Jira descriptions. The School filter was explicitly removed by the product owner in this session. Admin filters are Class, Parent and Nurse. US-5.2 statistics are kept on their own branch.

## Start the demo

Set `.env` from `.env.example` once, then run from the repository root:

```powershell
docker compose up -d --build api frontend
```

Open `http://localhost:5174/login`. Successful login routes Admin to `/admin`, Parent to `/parent`, and Nurse to `/nurse`.

All initial synthetic accounts use `SCHOOLHEALTH_DEMO_PASSWORD` from the local `.env`; existing password hashes are preserved on later seed runs.

| Demo account | Email | Purpose |
| --- | --- | --- |
| Admin | `admin@schoolhealth.example` | Browse/filter records and assign/unassign accounts |
| Dedicated Parent | `parent001@schoolhealth.example` | DEMO001; other dedicated accounts run through parent024 |
| Shared demo Parent | `parent@schoolhealth.example` | DEMO001 and DEMO017 for a multiple-child example on a fresh seed |
| Dedicated Nurses | `nurse001@schoolhealth.example`, `nurse002@schoolhealth.example` | Existing Nurse IDs NURSE001 and NURSE002 |
| Compatibility Nurse | `nurse@schoolhealth.example` | Existing checkup-entry demo login |

The shared Parent's exact children depend on current Admin assignments; it can have an empty state after unlinking. Names, date of birth, phone numbers, guardian descriptions and vaccinations are not present in the source CSV/schema. The UI marks missing fields as not recorded or omits optional fields; it does not manufacture them. Account email is the available contact information.

## Shared data and seed

Zen's committed fictional CSV files are in `backend/data/`. `python -m app.seed_demo` imports all four files in one transaction into **schoolhealth_demo**, the schema used by authentication, profiles, checkups and both workspaces. The Compose `seed` service is the single active seed entry point; `backend/scripts/seed_demo.sql` is a historical seed, not invoked by Compose.

The import adds the CSV's existing `student_nurses` relationship table and a small `assignment_audit` table. Existing student, account and result columns/IDs are unchanged. Additive indexes support class, relationship and latest-result lookups. No School or Class management module is introduced; `classId` is the existing `class_name` value, such as `6A1`.

Missing demo records are inserted. Saved profile/checkup edits and password hashes are not overwritten. CSV Parent/Nurse links are initialized only when suitable links are absent and no Admin assignment audit exists. Re-running the seed therefore preserves deliberate removals as well as reassignments. The established shared Parent demo links are retained alongside dedicated CSV parents; on a fresh seed they are created for DEMO001 and DEMO017.

## API contract

Every endpoint below requires `Authorization: Bearer <login JWT>`. The server verifies both the signed role and the corresponding account's current role in PostgreSQL. Responses have `Cache-Control: no-store`; password hashes are never serialized. Validation/database failures return generic messages without submitted health notes, SQL or stack traces.

| Endpoint | Role | Response / behavior |
| --- | --- | --- |
| `GET /api/parent/dashboard` | Parent | The current Parent profile and all linked children, including latest saved checkups and participation history |
| `GET /api/parent/children/{studentId}` | Parent | One owned child; returns 404 for an unknown or unlinked child |
| `GET /api/admin/health-records/options` | Admin | Existing Class values and Parent/Nurse account references |
| `GET /api/admin/health-records` | Admin | `{items,total,page,page_size}` with latest health information and account assignments |
| `PUT /api/admin/students/{studentId}/parent` | Admin | Replace current Parent links with one existing Parent account |
| `DELETE /api/admin/students/{studentId}/parent` | Admin | Clear all current Parent links after the UI confirms the displayed IDs |
| `PUT /api/admin/students/{studentId}/nurse` | Admin | Assign/replace the existing Nurse account |
| `DELETE /api/admin/students/{studentId}/nurse` | Admin | Unassign the current Nurse after confirmation |

Admin list query parameters: `classId`, `parentId`, `nurseId`, `page` (default 1), `pageSize` (default 20, maximum 100). Filters combine with AND. Ordering is stable by student name then ID. The UI defaults to 10 rows per page. Empty filters return the full authorized list. The page is batch-loaded without querying individually for every student.

Parent identity comes exclusively from the authenticated account, never from a request's Parent ID. The Parent response contains no other guardians' account references or Admin assignment versions. Each child is rendered separately. The generic `/students` APIs are now restricted to Nurse/Admin JWTs, preventing a Parent from bypassing ownership through the older profile endpoints; the Nurse profile UI supplies its existing login token.

Latest saved checkup means the most recent checkup date among records with a saved Normal/Needs Follow-up outcome and valid measurements; update time and session ID break ties. Pending/Absent participation remains visible in the child's history. BMI is recomputed from stored centimetres/kilograms and displayed to two decimals. No health category is inferred from notes or BMI.

### Assignment writes

The Admin list returns `assignment_version`. Send it in `If-Match` for every assignment mutation, together with the following body for PUT:

```json
{"account_id":"PARENT002"}
```

For Nurse writes use an existing Nurse ID, such as NURSE002. DELETE has no body. The backend locks the Student row, checks the version, validates account existence and role, changes the link and appends an audit row in one transaction. Audit entries contain actor ID, student ID, kind, timestamp and old/new account IDs; no health notes are logged. Missing precondition returns 428, stale state 409, unknown/wrong-role account 422, invalid authentication 401 and wrong role 403. Failed writes roll back. The UI blocks duplicate submissions and requires a fresh table after an uncertain or failed write; successful changes automatically reload the filtered list.

## Review and checks

Parent cases: one/multiple/no linked children, history and latest saved result, errors with retry, anonymous access, wrong role, and attempts to access another Parent's child. Admin cases: combined filters, reset, pagination, assign/change/remove Parent and Nurse, confirmation/cancel, invalid IDs, stale writes and immediate refresh.

```powershell
cd backend
python -m pytest -q tests
cd ../frontend
npm test
npm run lint
npm run build
npx playwright test
```

Real PostgreSQL tests use a disposable `management_test_*` schema and remove it after the test. They exercise the CSV importer, genuine JWT role/ownership checks, preservation of profile/password edits and removed links after reseeding, and two concurrent Admin writes against one version. Set `RUN_POSTGRES_TESTS=1` and `DATABASE_URL` to run `backend/tests/test_management_postgres.py`. CI starts a PostgreSQL service and runs this test separately after the default suite.

The historical AI preview remains at `/admin/insights` with Admin route protection and its existing temporary AI credential gate. The database-backed US-5.2 overview is available at `/admin/overview`, separate from the SCRUM-52 record-management page at `/admin`.
