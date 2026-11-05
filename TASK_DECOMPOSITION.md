# UI Redesign Work Breakdown (M0–M9)

This work breakdown is based on the frontend at audit commit `45523ec32718a0f1b226cc7deee434742915f86c` on `test/US-6.1-pr5`. M0–M6 are complete through separately committed milestones; M7–M9 remain planned and must not be considered complete until separately validated and committed.

## M0 — Baseline audit and preparation (complete)

**Files inspected:** `frontend/package.json`, lockfile, Vite/Tailwind config, `frontend/src/App.tsx`, `auth.ts`, `RoleWorkspace.tsx`, all screen components, CSS, API clients, tests, `docs/US-6.1.md`, root contribution/AI rules, matching backend routes/schemas, and existing documentation.

**Dependencies:** Existing checkout and installed frontend packages.

**Acceptance criteria:** Routes, roles, API shapes, visual screens, interaction states, and high-risk async/concurrency behavior are documented; lint/typecheck/build/test results reflect actual command output; screenshots contain only mocked synthetic data; no application code or existing source document was changed.

**Evidence:** Five screenshots under `docs/ui-baseline/`; all four required frontend checks passed. Playwright specs exist but are not included in the `npm test` script. GitHub fetch failed due network access, so the `dev` baseline could not be refreshed. Local `dev` does not contain the audited frontend source.

**Risks / follow-up:** Before a PR, fetch/rebase the actual current `dev` branch and confirm the team agrees this audited frontend snapshot is the one to redesign. The outer workspace's untracked `.sprint2-worktree/` folder was not changed by M0; the commit below, if made, belongs to the nested SchoolHealth repository.

## M1 — Hybrid Healthcare design system (complete)

**Files:** `frontend/src/styles.css`; `frontend/src/components/ui/{Button,Card,Badge,Input,Select,Dialog,Skeleton,EmptyState,PageHeader,index}.tsx` (the barrel is `.ts`); `frontend/tests/ui-primitives.test.tsx`; `frontend/package.json`; this WBS and `UI_REDESIGN_PLAN.md`.

**Dependencies:** M0 inventory. Kept React 19, TypeScript, Vite 7, Tailwind 4 and all installed dependencies; no package was added.

**Acceptance criteria met:** Semantic tokens include primary `#0F766E`, secondary `#2563EB`, background `#F7FAFC`, surface `#FFFFFF`, and text `#172B4D`. Existing Tailwind token names are preserved as compatible semantic values/aliases. Implemented `Button`, `Card`, `Badge`, `Input`, `Select`, native modal `Dialog`, `Skeleton`, `EmptyState`, and `PageHeader`. Controls use native semantics, visible focus, disabled/loading/error styles, helper/error descriptions where applicable, and no embedded student/patient fixtures. Six component tests cover loading/disabled buttons, semantic cards/status badges, input/select descriptions, dialog Escape/close behavior, skeleton/empty state, and page heading/actions. The npm script explicitly includes the new TSX suite.

**Validation:** `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` passed after the implementation. `npm test` reports 3 BMI unit tests + 20 Vitest tests passed (14 existing Nurse workflow tests, 6 new primitive tests).

**Regression risks:** The new semantic palette intentionally changes colors globally through backward-compatible token names. Existing screens compile unchanged; visual rework/use of primitives is deferred to M2–M7. Native dialog behavior should be rechecked in browser integration tests when a consuming screen adopts it.

## M2 — Shared responsive application shell (complete)

**Files:** Added `frontend/src/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `MobileNavigation.tsx`, and `navigationConfig.ts`; integrated the shell in `frontend/src/App.tsx`; converted `frontend/src/RoleWorkspace.tsx`, `AdminDashboard.tsx`, `NurseStudents.tsx`, `NurseCheckupEntry.tsx`, and `pages/CheckupSessionsPage.tsx` to content-only surfaces; added `frontend/tests/app-shell.test.tsx` and `frontend/tests/app-shell.spec.ts`; updated `frontend/package.json` and this WBS/plan.

**Dependencies:** M1 primitives; existing custom pathname dispatch and role-specific screens.

**Acceptance criteria met:** A responsive desktop sidebar and native mobile navigation dialog expose Admin management/overview/AI, Nurse profile/checkup sections, and Parent family dashboard destinations. Mobile navigation has a close control, Escape handling, initial focus and focus return. The shared topbar shows current role, page context, and one sign-out action; a skip link targets the shared main region. The Nurse's section and internal route state are held above the screen content, and entering Checkups from Profiles starts the existing result-entry state. Preserved `/`, `/login`, `/admin`, `/admin/overview`, `/admin/insights`, `/#admin`, `/nurse`, `/parent`, direct links, ProtectedRoute behavior, `roleLandingPaths`, `restoreSession`, expiry, sign-out and redirects. No router or dependency added.

**Validation:** Added 4 Vitest shell tests and 5 Playwright navigation tests. Vitest shell tests passed (4/4); the 5 new browser specs plus 3 existing routing specs passed (8/8) against a manually started Vite server. The standard Playwright `webServer` runner remained open after reporting test results, so browser regression was run with a temporary manual-server config. Full frontend lint/typecheck/build/npm-test results are recorded at the M2 commit.

**Regression risks:** App screens now sit inside the shared shell, so later layout changes must avoid nested `<main>` elements, duplicate navigation, or resetting Nurse state. The browser suite should be rerun using a manually started Vite server if Playwright `webServer` teardown continues to hang.

## M3 — Admin health overview (complete)

**Files:** `frontend/src/AdminDashboard.tsx`, shared `Button`, `Card`, `EmptyState`, `PageHeader`, and `Skeleton` primitives; `frontend/tests/dashboard.spec.ts`. Existing `StatusDistributionChart.tsx` and `AIInsightsPanel.tsx` remain integrated without contract changes.

**Dependencies:** M1 and M2.

**Acceptance criteria met:** Added a responsive page header, KPI cards, status distribution and table, existing AI Insights section, readable metric definitions, and explicit zero-result/loading/error/retry states. Data still comes only from `/api/admin/dashboard` fields `total_students`, `completed_checkups`, `status_counts.normal`, and `status_counts.needs_follow_up`. Preserved response validation, request cancellation, active-request guard, 15-second timeout, authenticated access, lazy chart import, and exact count definitions. Chart retains an accessible description and exact-count table.

**Validation:** `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` passed (3 BMI tests and 24 Vitest tests). Admin dashboard Playwright coverage passed 4/4 for successful data, zero results, initial loading, and API failure/retry using synthetic responses and a manually started Vite server.

**Regression risks:** Re-labeling record counts as unique students, inventing unsupported trends/percentages/filters, eagerly loading Recharts, losing timeouts/abort behavior, or hiding errors while showing stale values. Browser test runner teardown still requires manually starting Vite in this environment.

## M4 — Nurse workspace (complete)

**Files:** `frontend/src/NurseStudents.tsx`, `NurseCheckupEntry.tsx`, `pages/CheckupSessionsPage.tsx`, and Nurse unit/browser tests. `api/checkupSessions.ts`, `checkupMath.js`, and `RoleWorkspace.tsx` remain unchanged.

**Dependencies:** M1 and M2; preserve the current screen state model.

**Acceptance criteria met:** Nurse profiles use responsive shared cards, accessible search/profile controls, skeleton/empty states, and clear save/delete feedback. Checkup entry presents the three existing task steps, offers a direct route to browse existing sessions, and uses the shared form controls without changing fields or validation. Session selection and participant details use shared cards, status badges, loading skeletons, empty states, and retry buttons. Existing role authorization, request methods/endpoints, payload/response validation, result statuses, BMI formula/rounding, edit-vs-create behavior, request aborts, stale request guards, selected session/student key guards, save lock/duplicate-submit protection, failed-result-read lock/retry, and session-change loading reset remain in place. Existing save target identity prevents switching students while a write is in flight; drafts are not silently cleared by presentation changes.

**Validation:** `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` passed (3 BMI tests and 24 Vitest tests including all 14 Nurse checkup workflow cases). Added synthetic browser checks for searching/opening a Nurse profile and selecting an existing session/participant; both passed (2/2). `NurseCheckupEntry.test.tsx` now also asserts the accessible workflow-step list. Browser checks used a manually started Vite server.

**Regression risks:** A delayed response applying to a different student, saving after a failed read, stale BMI/status, accidental duplicate result, session switch leaving search disabled, or a visual form refactor discarding drafts. Retain the dedicated async regression suite when changing Nurse forms. Browser runner teardown still requires manually starting Vite in this environment.

## M5 — Parent family dashboard (complete)

**Files:** `frontend/src/ParentDashboard.tsx`, new lazy `frontend/src/ParentHealthTrends.tsx`, and `frontend/tests/management.spec.ts`. Existing `managementApi.ts`, `useManagementResource.ts`, and `RoleWorkspace.tsx` behavior and contracts are unchanged.

**Dependencies:** M1 and M2.

**Acceptance criteria met:** Presents the authenticated Parent profile, linked child count, keyboard-operable child selector for multiple children, one focused child record, profile information, latest saved checkup, measurement cards with explicit units/missing values, and expandable checkup history. Empty-parent, no-child, no-checkup, loading, error/retry, and refresh behavior remain. Only children and checkups from `/api/parent/dashboard` are rendered; no extra API requests, status inference, diagnosis, or fabricated values were added. Lazy height/weight trends appear only when each has at least two real observations; missing values are omitted, measurements use separate unit scales, and an informational note makes chart scope clear.

**Validation:** `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` passed (3 BMI tests and 24 Vitest tests). Parent browser regression passed 7/7 with synthetic responses, including multiple-child switching, actual-history charts, no linked children, no latest result, API failure/retry, role access, and a 390px mobile viewport with no horizontal overflow. Browser checks used a manually started Vite server.

**Regression risks:** Showing another parent's child data, overemphasizing nullable values as negative health findings, hiding an empty state, introducing unsupported actions/edit controls, or changing unit semantics in the history charts. Browser runner teardown still requires manually starting Vite in this environment.

## M6 — Admin health management (complete)

**Files:** `frontend/src/AdminHealthManagement.tsx`, shared UI primitives, and `frontend/tests/management.spec.ts`. `managementApi.ts` and assignment behavior are unchanged.

**Dependencies:** M1 primitives and M2 shared shell; existing management API contracts.

**Acceptance criteria met:** Filter toolbar uses the existing Class, Parent, and Nurse filters only; responsive mobile record cards complement the desktop data table. Assignment actions have accessible labels, badge states, clear loading/empty/error/success feedback, and an accessible native dialog. Pagination reports total records/current page, supports existing page sizes, and retains previous/next/reset behavior. Existing filters, page query parameters, response shape, assignment `PUT`/`DELETE`, `If-Match: assignment_version`, validation, 409/428 conflict lock, reload-before-retry, authorization, and post-save refresh are preserved. No bulk action or new search API was added.

**Validation:** `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` passed (3 BMI tests and 24 Vitest tests). The full synthetic-data Playwright management suite passed 12/12, covering filter combination/reset/pagination, assignment add/change/remove, confirmation cancellation, `If-Match`, stale conflict/reload, role boundaries, and adjacent Nurse/Parent regressions.

**Regression risks:** Duplicate Parent/Nurse assignments must continue to replace according to the existing API semantics; never retry a failed write using a stale assignment version. Mobile record details and desktop table must remain equally actionable and screen-reader accessible.

## M7 — AI Insights presentation

**Files:** `frontend/src/AIInsightsPanel.tsx`, `AdminDashboard.tsx`, `docs/US-6.1.md`, AI UI tests.

**Dependencies:** M1–M3 and the existing backend AI contract; no backend changes.

**Acceptance criteria:** Make the aggregate-only scope and non-clinical disclaimer visible. Preserve the explicit three-field allowlist, snapshot-change cancellation, active controller duplicate guard, 25-second browser timeout, minimum data gating, stale-statistics lock, request/response validation, retry/error state, and exact relationship to visible dashboard counts. Success only appears for an actual valid response; errors leave dashboard metrics usable. Tests assert only aggregate fields are sent and cover insufficient-data, loading, success, stale, timeout, and service errors.

**Regression risks:** Exposing student-level or free-text data, promising diagnosis/treatment, fabricated fallback content, mismatched aggregate snapshot, or an AI failure blocking the overview.

## M8 — Public landing and sign-in

**Files:** `frontend/src/App.tsx` landing content, `frontend/src/LoginPage.tsx`, and relevant browser tests. `auth.ts` is read-only for contract verification.

**Dependencies:** M1 shared primitives; preserve public routes and M2 shell/auth boundaries.

**Acceptance criteria:** Redesign Landing and Login with the same Hybrid Healthcare tokens. Landing explains existing capabilities for school staff and parents, uses clearly illustrative synthetic visuals, and provides a strong sign-in call to action. Login has a polished responsive layout, accessible native controls, inline validation/error/pending feedback, and retains the existing password visibility control. Preserve `/`, `/login`, `/home`, login callback, `POST /auth/login`, session restoration, role redirects, and all security behavior. Do not add role selection, registration, or login providers.

**Regression risks:** Deep-link or history regressions, form submission on Enter, lost labels/autocomplete, double-submit, invalid password toggle semantics, unsupported product claims, or non-reduced-motion-safe animation.

## M9 — Final QA, accessibility and polish

**Files:** Frontend screens/components/tests from M1–M8; `TASK_DECOMPOSITION.md`, `UI_REDESIGN_PLAN.md`, and new final QA report under `docs/`.

**Dependencies:** M1–M8 committed and current local feature branch; no network fetch or merge is required.

**Acceptance criteria:** Run all four required frontend commands plus available Playwright/E2E suites. Review responsive layouts at 320, 375, 768, 1024, and 1440 CSS pixels; keyboard/focus/forms/dialogs/chart alternatives; design-token use; error/loading/empty/success states; overflow; role/privacy boundaries; auth/session, assignment `If-Match`, Nurse save/stale-response, Parent child switching, and AI allowlist. Capture/review screenshots with synthetic data only. Record actual checks, residual limitations, and any fixes in the QA report. Do not claim WCAG conformance without an audit.

**Regression risks:** Treating automated checks as a complete accessibility audit, screenshotting real health data, allowing viewport-specific clipping, weakening tests, or changing backend/API/auth/business rules during polish.
