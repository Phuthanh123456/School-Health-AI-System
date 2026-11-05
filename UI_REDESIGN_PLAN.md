# Hybrid Healthcare UI/UX Redesign Plan

## Purpose and guardrails

This plan prepares a staged visual and interaction redesign of the existing SchoolHealth frontend. M0 was a baseline audit only; M1 established shared tokens and UI primitives. No route, API contract, authentication, authorization, business rule, health calculation, or schema was changed in either milestone.

Implementation must stay on the existing React, TypeScript, Vite, Tailwind CSS 4, and Recharts stack. Work should be limited to presentation and client-side composition. The current implementation is the source of truth for behavior until a separately reviewed product requirement changes it.

## M0 baseline

- Audited checkout: `test/US-6.1-pr5` at `45523ec32718a0f1b226cc7deee434742915f86c`.
- The checkout was clean before the audit. The outer workspace contains an untracked `.sprint2-worktree/` directory; it was left untouched as a parent-workspace change.
- The local `dev` ref is `e2164dc`; cached `origin/dev` is `3a32895`, and neither contains the frontend implementation present in the audited checkout. Fetching `origin/dev` failed because this environment could not connect to GitHub. Reconcile the branch baseline before opening a PR to `dev`.
- Frontend dependencies were already installed. `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` all passed. `npm test` runs the Node BMI tests and the Vitest Nurse result-entry suite; it does not run the Playwright `.spec.ts` suite.
- Playwright Chromium was present. Five baseline screenshots were captured at 1440 x 1000 with mocked synthetic data only: [landing](docs/ui-baseline/landing.png), [login](docs/ui-baseline/login.png), [Admin overview and AI panel](docs/ui-baseline/admin-overview.png), [Nurse profiles](docs/ui-baseline/nurse-profiles.png), and [Parent dashboard](docs/ui-baseline/parent-dashboard.png).
- No existing UI redesign plan, decomposition, or root `project_rules.md` was present. Existing `AI_RULES.md`, `CONTRIBUTING.md`, and `docs/US-6.1.md` remain intact.

## Current screen and route inventory

`frontend/src/App.tsx` implements pathname dispatch directly; there is no React Router. Preserve every path and its role check.

### Screen source files

- **Admin:** `frontend/src/AdminHealthManagement.tsx` is `/admin`; `frontend/src/AdminDashboard.tsx` is `/admin/overview`, `/admin/insights`, and the guarded `/#admin` legacy route; the dashboard imports `frontend/src/StatusDistributionChart.tsx` lazily and renders `frontend/src/AIInsightsPanel.tsx`.
- **Nurse:** `frontend/src/NurseStudents.tsx` is the initial profile view; `frontend/src/NurseCheckupEntry.tsx` coordinates the checkup flow; `frontend/src/pages/CheckupSessionsPage.tsx` renders the session list/detail; `frontend/src/api/checkupSessions.ts` provides session API calls; `frontend/src/checkupMath.js` contains BMI calculation/formatting.
- **Parent:** `frontend/src/ParentDashboard.tsx` renders the parent profile, linked children, latest result, and checkup history.
- **Landing:** public fallback in `frontend/src/App.tsx` (the landing UI is not yet extracted to its own component).
- **Login:** `frontend/src/LoginPage.tsx`, with routing/auth orchestration in `frontend/src/App.tsx` and session/API behavior in `frontend/src/auth.ts`.
- **Shared screen/layout/API files:** `frontend/src/RoleWorkspace.tsx`, `frontend/src/styles.css`, `frontend/src/managementApi.ts`, `frontend/src/useManagementResource.ts`, and `frontend/src/auth.ts`.
- **Existing UI/browser tests:** `frontend/tests/dashboard.spec.ts`, `insights.spec.ts`, `management.spec.ts`, `merge-routing.spec.ts`, and `NurseCheckupEntry.test.tsx`; BMI unit coverage is in `frontend/tests/checkupMath.test.mjs`.

## M2 shared shell

The authenticated routes now render inside `frontend/src/AppShell.tsx`. The shared components are `Sidebar.tsx`, `Topbar.tsx`, and `MobileNavigation.tsx`; `navigationConfig.ts` declares only existing role destinations and Nurse's existing in-page section actions. Admin `/admin/overview`, `/admin/insights`, and `/#admin` share one active overview navigation item. Nurse section and workflow route state remain mounted above profile/checkup content. Role checks, session restoration/expiry, role redirects, and sign-out storage behavior remain in the existing `App.tsx`/`auth.ts` flow. Public Landing and Login keep their existing public layouts.

`RoleWorkspace`, AdminDashboard, Nurse profile/checkup pages are content surfaces under the shell; the shared topbar owns the only authenticated sign-out control. The mobile drawer is a native modal dialog with Escape-to-close, initial navigation focus, and focus return to its trigger. A skip link targets the shell's single main content region. Four Vitest tests cover role destinations, Nurse section selection, mobile drawer keyboard/focus behavior, and sign-out. Five Playwright tests cover restored Admin deep links, management navigation, Nurse section switching, Parent authorization/redirect, and mobile navigation. These and three existing routing specs passed (8/8) against a manually started Vite server because the configured Playwright `webServer` process stayed alive after reporting results.

| Route | Current screen | Permitted role / access | Data behavior |
| --- | --- | --- | --- |
| `/` | Public product landing page | Public | Static explanatory content and explicitly illustrative chart. |
| `/login` | Sign-in form | Public | `POST /auth/login`; validates inputs, disables submission while pending, presents errors, then redirects to the signed-in role's landing path. |
| `/admin` | Admin health-management screen | Admin | Filter options and paged student health records; assignment add/change/remove actions. |
| `/admin/overview` | School overview, status chart, AI Insights panel | Admin | `GET /api/admin/dashboard`; optional user-triggered `POST /api/admin/ai-insights` with aggregate-only values. |
| `/admin/insights` | Same `AdminDashboard` currently used by `/admin/overview` | Admin | Same statistics and AI panel; preserve this existing deep link. |
| `/#admin` | Legacy bookmark to Admin overview | Admin | Protected and redirected according to current session role. |
| `/nurse` | Nurse student-profile workspace; internal switch to checkup sessions and result entry | Nurse | `/students` profile APIs, `/checkups/sessions`, participant roster, result read and save APIs. Internal section/selection state is held in React, not encoded as URL routes. |
| `/parent` | Parent profile and linked-child health dashboard | Parent | `GET /api/parent/dashboard`; displays each authorized linked child and saved checkup history. |
| Other paths | Public landing fallback | Public | Do not invent routes as part of the shell redesign. |

## M1 design-system primitives

`frontend/src/styles.css` now defines the requested semantic color, radius, and minimal card-shadow tokens. Existing utility token names (`primary`, `primary-strong`, `primary-soft`, `on-primary`, `background`, `foreground`, `muted`, `subtle`, `border`, `sky-soft`, and `sky-mid`) remain available as aliases or compatible semantic values for current screens.

Reusable components live in `frontend/src/components/ui/` and are exported by `index.ts`: `Button` (variant/size/loading and native disabled behavior), `Card` (semantic `div`/`section`/`article`), `Badge` (neutral/info/success/warning/danger), `Input` and `Select` (native controls with helper/error descriptions), `Dialog` (controlled native modal with Escape cancellation), `Skeleton` (decorative placeholder for an enclosing announced busy region), `EmptyState` (labeled section and optional action), and `PageHeader` (page-level heading, context, and actions). Form labels remain the consuming screen's responsibility. These primitives contain no student or patient data and are not wired into existing screens until later milestones.

M1 checks passed: lint, typecheck, build, and `npm test` (3 BMI unit tests, 14 Nurse workflow tests, and 6 UI primitive tests). The npm test script now explicitly includes both TSX suites so new component tests are not silently skipped on Windows.

## API and data contracts to preserve

These shapes are defined in the frontend API clients and the matching backend schemas. Do not rename fields, alter methods, or move health calculations into presentation components.

| Workflow | Existing request and response contract |
| --- | --- |
| Authentication | `POST /auth/login` sends `{ email, password }`; response `{ access_token, token_type: "bearer", expires_in, user: { id, email, role } }`. `GET /auth/me` uses `Authorization: Bearer …` and returns `{ id, email, role }`. Roles are `admin`, `nurse`, and `parent`. |
| Parent | `GET /api/parent/dashboard` returns `{ parent, children }`. Child entries include identity/class, nullable date of birth/relationship/allergies/medical notes/latest checkup, and a `checkups` history list. Checkups include session ID/title/date/status, nullable measurements/BMI/vision/notes, and update time. |
| Admin filters and records | `GET /api/admin/health-records/options` returns `{ classes, parents, nurses }`. `GET /api/admin/health-records` accepts `classId`, `parentId`, `nurseId`, `page`, `pageSize` and returns `{ items, total, page, page_size }`. Record entries contain student/profile fields, latest checkup, parent list, optional nurse, and opaque `assignment_version`. |
| Admin assignments | `PUT /api/admin/students/{student_id}/parent` or `/nurse` sends `{ account_id }`; `DELETE` removes an assignment. Both mutation methods require `If-Match: <assignment_version>` and return the updated health record. Preserve 409/428 conflict handling, pending-submit lock, and reload-before-retry behavior. |
| Nurse profiles | `GET /students` returns profile summaries `{ id, full_name, class_name }[]`; `GET /students/{id}` returns profile details; `POST /students` creates; `PATCH /students/{id}` updates; `DELETE /students/{id}` removes. Create/update data uses `id`, `full_name`, `class_name`, nullable `allergies`, and nullable `medical_notes`. |
| Checkup sessions | `GET /checkups/sessions` returns `{ id, title, checkup_date, class_name, participant_count }[]`. `GET /checkups/sessions/{session_id}` returns the session plus `{ id, full_name, class_name }[]`. `GET /checkups/sessions/{session_id}/students?q=…` searches that session's participants and returns `{ id, student_code, full_name, class_name }[]`. |
| Checkup result | `GET /checkups/sessions/{session_id}/students/{student_id}/result` reads a saved result; only the explicit no-result 404 is treated as a new editable result. `PUT` sends `{ height_cm, weight_kg, vision, notes, status }`; response includes session/student IDs, measurements, server BMI, optional vision/notes, and selected status. Status remains `Normal` or `Needs Follow-up`. |
| Admin aggregate dashboard | `GET /api/admin/dashboard` returns `{ total_students, completed_checkups, status_counts: { normal, needs_follow_up } }`. Counts are records as documented in `docs/US-6.1.md`; do not infer new metrics or categories. |
| AI Insights | `POST /api/admin/ai-insights` sends exactly `{ total_students, checkups_completed, followups_pending }`, derived from the visible overview. Response is `{ summary, recommendations, disclaimer, aggregates }`. Keep provider keys server-side and never send identifiers, individual records, or free-text medical notes from the browser. |

## Shared interaction states and invariants

- Authentication restoration calls `restoreSession`, verifies the backend session, honors expiry, redirects unauthenticated users to `/login`, redirects authenticated users away from an unauthorized role route, and signs out on expiry or invalid-token responses. Preserve `roleLandingPaths`, `signOut`, and the shared authenticated fetch behavior.
- Async screens use `AbortController`, request identity guards, or both. Preserve cancellation and stale-response protection when navigating or changing students, sessions, filters, or aggregate snapshots.
- Nurse checkup saves reject duplicate submits and remain locked until the selected student/session result was successfully read or a confirmed no-result response was received. Preserve the existing save target identity checks, metric precision/ranges, status choice, and BMI calculation/rounding.
- Admin parent/nurse assignment mutations use `If-Match` with `assignment_version`; after a failed/ambiguous write, the UI requires a reload before another attempt.
- Existing states to retain: auth session-checking/unavailable; login validation/pending/error; admin records loading/error/empty/pagination/success/conflict; overview loading/error/retry/zero checkups/chart loading; AI insufficient-data/idle/loading/error/stale/success; Nurse list/details/sessions/participants/results loading/error/empty/success; Parent loading/error/no linked children/no saved result.
- Do not show fabricated values to fill visual space. Landing-page illustration is currently labeled illustrative and must remain clearly non-data.
- Health information is sensitive: use synthetic records for local review, tests, and screenshots, and preserve role-limited visibility.

## Milestone summary

| Milestone | Outcome | Main dependencies | Completion evidence |
| --- | --- | --- | --- |
| M0 | Baseline audit and plan | Existing repository and local toolchain | Route/API/invariant inventory, passing baseline checks, synthetic screenshots, these planning documents. |
| M1 | **Complete:** semantic visual tokens and reusable accessible primitives | M0 inventory; Tailwind 4 global CSS | Requested tokens and aliases are in place; all nine primitives have focused tests; existing screens compile without component migration. |
| M2 | **Complete:** responsive role-aware shared shell | M1 primitives; existing `App.tsx`, `RoleWorkspace.tsx`, auth contract | Existing routes/deep links and role guards retained; accessible desktop/mobile navigation, one topbar sign-out, Nurse section/route state retained. |
| M3 | **Complete:** Admin school overview redesign | M1/M2; current dashboard response | Existing KPI definitions and chart use only API data; AI panel remains present; zero/loading/error/retry/accessibility behavior verified. Four dashboard browser tests passed; lint/typecheck/build/frontend tests passed. |
| M4 | **Complete:** Nurse task-oriented workflow redesign | M1/M2; M0 Nurse race/concurrency invariants | Profiles, session selection, eligible student selection, result read/edit/save work with unchanged API and calculation semantics. Fourteen Nurse component cases and two synthetic Nurse browser checks passed; lint/typecheck/build/frontend tests passed. |
| M5 | **Complete:** Parent family dashboard redesign | M1/M2; Parent API contract | Parent profile and linked children render from the existing API; child selection, latest measurements, empty/loading/error/history states, actual-data trends, and mobile layout verified. Seven Parent browser tests and all frontend quality checks passed. |
| M6 | **Complete:** Admin health management | M1/M2 shared UI and shell; existing management API | Responsive records view, current filters and pagination, accessible assignment dialog, success/error/loading/empty feedback. Assignment create/change/remove, conflict reload, filtering and pagination browser regressions passed (management suite 12/12); all frontend gates passed. |
| M7 | **Complete:** AI Insights presentation refinement | M3 aggregate dashboard and existing AI contract | Only current aggregate allowlist is sent; loading/error/stale/insufficient/success states and disclaimer remain clear; no fabricated success. AI browser suite 14/14 passed; frontend lint, typecheck, build, and tests passed. |
| M8 | Public landing and sign-in redesign | M1 shared primitives; auth contract | Landing and login share the Hybrid Healthcare system; public routes, validation, pending/error states, password visibility and role landing redirects remain intact. |
| M9 | Final QA, accessibility and handoff | All accepted prior milestones | Required frontend and browser regressions pass; responsive layouts, keyboard/focus, states and role/privacy boundaries are reviewed; synthetic-data screenshots and a factual QA report document residual limitations. |

Detailed files, dependencies, acceptance criteria, and risks are in [TASK_DECOMPOSITION.md](TASK_DECOMPOSITION.md). Project constraints are in [project_rules.md](project_rules.md); the existing [AI_RULES.md](AI_RULES.md) and [CONTRIBUTING.md](CONTRIBUTING.md) remain authoritative for AI/data and contribution practices.
