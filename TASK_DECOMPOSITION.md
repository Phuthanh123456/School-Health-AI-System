# UI Redesign Work Breakdown (M0–M9)

This work breakdown is based on the frontend at audit commit `45523ec32718a0f1b226cc7deee434742915f86c` on `test/US-6.1-pr5`. M0 is complete as documentation and baseline evidence only. M1–M9 are planned work and must not be considered implemented until separately completed and reviewed.

## M0 — Baseline audit and preparation (complete)

**Files inspected:** `frontend/package.json`, lockfile, Vite/Tailwind config, `frontend/src/App.tsx`, `auth.ts`, `RoleWorkspace.tsx`, all screen components, CSS, API clients, tests, `docs/US-6.1.md`, root contribution/AI rules, matching backend routes/schemas, and existing documentation.

**Dependencies:** Existing checkout and installed frontend packages.

**Acceptance criteria:** Routes, roles, API shapes, visual screens, interaction states, and high-risk async/concurrency behavior are documented; lint/typecheck/build/test results reflect actual command output; screenshots contain only mocked synthetic data; no application code or existing source document was changed.

**Evidence:** Five screenshots under `docs/ui-baseline/`; all four required frontend checks passed. Playwright specs exist but are not included in the `npm test` script. GitHub fetch failed due network access, so the `dev` baseline could not be refreshed. Local `dev` does not contain the audited frontend source.

**Risks / follow-up:** Before a PR, fetch/rebase the actual current `dev` branch and confirm the team agrees this audited frontend snapshot is the one to redesign. The outer workspace's untracked `.sprint2-worktree/` folder was not changed by M0; the commit below, if made, belongs to the nested SchoolHealth repository.

## M1 — Hybrid Healthcare design system

**Files:** `frontend/src/styles.css`; add reusable primitives under `frontend/src/components/ui/` or the agreed existing component convention; add focused tests under `frontend/tests/`; update this WBS and plan.

**Dependencies:** M0 inventory. Keep React 19, TypeScript, Vite 7, Tailwind 4 and existing dependency versions. No new package unless an accepted requirement cannot be met with the current stack.

**Acceptance criteria:** Add semantic tokens for primary `#0F766E`, secondary `#2563EB`, background `#F7FAFC`, surface `#FFFFFF`, and text `#172B4D` without removing old Tailwind theme classes. Provide accessible Button, Card, Badge, Input, Select, Dialog, Skeleton, EmptyState, and PageHeader primitives with disabled, loading, error, and visible keyboard-focus styles where appropriate. Keep native semantic controls and avoid patient/student fixtures in components. Add component tests; lint, typecheck, build, and test pass.

**Regression risks:** Tailwind 4 token naming can alter existing utility output; global color/font changes can reduce contrast or affect all old screens; Dialog focus/escape behavior can conflict with native dialog usage. Compare baseline screenshots and test native keyboard behavior.

## M2 — Shared responsive application shell

**Files:** Add `frontend/src/AppShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `MobileNavigation.tsx`, and `navigationConfig.ts`; integrate in `frontend/src/App.tsx` and, if needed, `RoleWorkspace.tsx`. Tests in `frontend/tests/`.

**Dependencies:** M1 primitives; existing custom pathname dispatch and current role-specific screens.

**Acceptance criteria:** Desktop has a consistent left navigation; mobile has an accessible drawer that supports focus, Escape to close, and sensible focus return. Navigation is role-aware: Admin management/overview/AI links, Nurse profile/checkup workflows, Parent family dashboard. Preserve `/`, `/login`, `/admin`, `/admin/overview`, `/admin/insights`, `/#admin`, `/nurse`, `/parent`, deep links, role authorization, `restoreSession`, expiry behavior, sign-out, role redirects, and Nurse internal state. Do not add React Router or duplicate headers/sign-out controls. Tests cover role navigation, mobile drawer, session restoration, and direct routes.

**Regression risks:** Route fallback can accidentally expose a screen; duplicate shell headers or sign-out controls; navigation remounts can reset Nurse workflow state; drawer focus traps or stale session checks.

## M3 — Admin health overview

**Files:** `frontend/src/AdminDashboard.tsx`, `StatusDistributionChart.tsx`, `AIInsightsPanel.tsx` (integration retained), shared shell/primitives, relevant `frontend/tests/dashboard.spec.ts` and new focused UI tests.

**Dependencies:** M1 and M2.

**Acceptance criteria:** Header, responsive existing KPI cards, existing status distribution chart, and AI Insights appear in a clear hierarchy. Use only `/api/admin/dashboard` fields: `total_students`, `completed_checkups`, `status_counts.normal`, and `status_counts.needs_follow_up`. Preserve response validation, request cancellation, active-request guard, 15-second timeout, authenticated access, lazy chart import, exact count definitions, and current empty/loading/error/retry states. Include an accessible chart description or equivalent text/table. Verify zero-result, successful, loading and error states.

**Regression risks:** Re-labeling record counts as unique students, inventing unsupported trends/percentages/filters, eagerly loading Recharts, losing timeouts/abort behavior, or hiding errors while showing stale values.

## M4 — Nurse workspace

**Files:** `frontend/src/NurseStudents.tsx`, `NurseCheckupEntry.tsx`, `pages/CheckupSessionsPage.tsx`, `api/checkupSessions.ts`, `checkupMath.js` (read-only dependency), `RoleWorkspace.tsx`, Nurse tests.

**Dependencies:** M1 and M2; preserve the current screen state model.

**Acceptance criteria:** Make student lookup, existing session selection, eligible student selection, result entry, and save/edit feedback easy to follow on desktop and mobile. Keep methods, endpoints, payload/response validation, result statuses, BMI formula/rounding, edit-vs-create behavior, and authorization unchanged. Retain request aborts, request-ID/stale response checks, selected session/student key guards, saving lock and duplicate-submit prevention, explicit failed-result-read lock/retry, and session-change loading reset. Do not silently drop unsaved work. Extend the existing Nurse component tests for loading, errors, empty data, select/change session, result load/retry, validation, save/update, duplicate submit, cancellation, and stale results.

**Regression risks:** A delayed response applying to a different student, saving after a failed read, stale BMI/status, accidental duplicate result, session switch leaving search disabled, or a visual form refactor discarding drafts.

## M5 — Parent family dashboard

**Files:** `frontend/src/ParentDashboard.tsx`, `managementApi.ts`, `useManagementResource.ts` (preserve contracts), `RoleWorkspace.tsx`, Parent tests.

**Dependencies:** M1 and M2.

**Acceptance criteria:** Present the authenticated parent's profile, linked children, latest available checkup and history with clear labels. Only render children returned by `/api/parent/dashboard`; preserve the existing empty-parent, no-child, no-checkup, loading, error/retry, and refresh behavior. Use no extra parent/child API requests or fabricated status. Validate readability for multiple children, long notes, and small viewports.

**Regression risks:** Showing another parent's child data, overemphasizing nullable values as negative health findings, hiding an empty state, or introducing unsupported actions/edit controls.

## M6 — Public landing and sign-in

**Files:** `frontend/src/App.tsx` landing content, `frontend/src/LoginPage.tsx`, `frontend/src/auth.ts` only for reading/contract verification (auth behavior changes are out of scope), shared primitives and tests.

**Dependencies:** M1. M2 integration must preserve public route availability.

**Acceptance criteria:** Improve public landing and login presentation while keeping route behavior, login input validation, password visibility toggle, pending-submit lock, existing error messages, `POST /auth/login` contract and role-based redirect unchanged. The landing illustration remains clearly labeled as illustrative and never suggests real school data. Add visual-state coverage without hardcoded personal data.

**Regression risks:** Browser history/deep-link regressions, form submit on Enter, lost `autocomplete`/labels, invalid password toggle semantics, double login, or unsupported claims on the public page.

## M7 — AI Insights presentation

**Files:** `frontend/src/AIInsightsPanel.tsx`, `AdminDashboard.tsx`, `docs/US-6.1.md`, AI UI tests.

**Dependencies:** M1–M3 and the existing backend AI contract; no backend changes.

**Acceptance criteria:** Make the aggregate-only scope and non-clinical disclaimer visible. Preserve the explicit three-field allowlist, snapshot-change cancellation, active controller duplicate guard, 25-second browser timeout, minimum data gating, stale-statistics lock, request/response validation, retry/error state, and exact relationship to visible dashboard counts. Success only appears for an actual valid response; errors leave dashboard metrics usable. Tests assert only aggregate fields are sent and cover insufficient-data, loading, success, stale, timeout, and service errors.

**Regression risks:** Exposing student-level or free-text data, promising diagnosis/treatment, fabricated fallback content, mismatched aggregate snapshot, or an AI failure blocking the overview.

## M8 — Cross-role accessibility and responsive review

**Files:** Components/screens from M1–M7, `frontend/src/styles.css`, responsive/accessibility test coverage, screenshots.

**Dependencies:** M1–M7.

**Acceptance criteria:** Keyboard-only review for navigation, dialogs, forms and chart alternatives; visible focus and semantic headings/labels/live regions; responsive review at narrow mobile, tablet and desktop widths; text zoom/long localized content; reduced-motion preferences. Role-restricted links and private data remain hidden from unauthorized roles. Update screenshots with synthetic data only.

**Regression risks:** CSS-only interactions inaccessible to assistive technology, clipped data tables, invisible focus, inconsistent states between viewport breakpoints, or screenshots accidentally using a real local database.

## M9 — Integration regression and handoff

**Files:** Frontend test suites, affected components, WBS/plan/rules, baseline screenshots as needed. Do not alter backend contracts or schemas.

**Dependencies:** M0–M8 accepted and current `dev` branch fetched/reconciled.

**Acceptance criteria:** Run from `frontend/`: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, and the agreed Playwright suite. Review diffs for API/auth/business logic or schema changes; confirm all route and role cases, deep links, async race/submit locks, assignment `If-Match`, and aggregate privacy remain covered. Update synthetic screenshots and record remaining limitations. Commit only the accepted UI/docs work to a reviewable feature branch and open a PR to the agreed target branch after remote access is available.

**Regression risks:** Combining unfinished milestones, silently changing backend assumptions, stale local `dev`, tests that miss browser specs, real data in screenshots/logs, or merge conflicts with teammates' work.
