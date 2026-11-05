# Project Rules for the Hybrid Healthcare UI Redesign

These rules apply to the planned UI redesign only. They supplement the repository's existing [`AI_RULES.md`](AI_RULES.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), and [`docs/US-6.1.md`](docs/US-6.1.md). Those documents were not replaced or edited during M0 and remain authoritative for their existing topics.

## Scope and stack

- Follow the accepted milestone in `TASK_DECOMPOSITION.md`; M0 is audit/preparation only. Do not begin later milestones until their own task is authorized.
- Continue with the installed React, TypeScript, Vite, Tailwind CSS 4, and Recharts stack. Avoid adding dependencies without an accepted technical need.
- Shared M1 primitives are in `frontend/src/components/ui/` and exported from its `index.ts`; use them for later screen milestones rather than introducing a parallel control library. Keep form labels in consuming screens, and place skeletons inside an announced `aria-busy`/status region.
- Authenticated routes use the role-aware shell in `frontend/src/AppShell.tsx`; keep role navigation in sync with `navigationConfig.ts`, and preserve the Nurse section plus result-entry route state while changing shell layout. The shared shell owns sign-out and the main landmark; avoid adding duplicate topbars, navigation, or nested `<main>` landmarks to screen components.
- Treat visual composition, accessibility, and client-side presentation as the redesign scope. Do not change backend code, API methods/paths/contracts, authentication or authorization rules, health calculations, business rules, or database schemas as UI cleanup.
- Preserve every current route and deep link in `UI_REDESIGN_PLAN.md`. Do not add routes or install React Router as part of the shell work.

## Behavior and privacy

- Preserve session restoration, expiry, sign-out, role landing redirects, and both frontend and backend role checks.
- Preserve request cancellation, stale-response guards, duplicate-submit locks, failed-result-read locks, and assignment `If-Match` concurrency headers.
- Keep count definitions and BMI behavior unchanged. Do not invent metrics or fallback data to fill a visual layout.
- Use only synthetic data in tests, local visual review, and screenshots. Never display real student/parent contact or health data in review artifacts.
- Keep the AI browser payload limited to the existing validated aggregate allowlist. Keep provider credentials server-side. Preserve the non-diagnostic disclaimer and failure states.
- Use accessible semantic controls, labels, heading order, keyboard interactions, visible focus, loading/error announcements, and chart text alternatives.

## Validation and handoff

- For a UI milestone, run in `frontend/`: `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test`; report any pre-existing failures separately. Run Playwright browser tests when the milestone or agreed test plan requires them.
- Update `TASK_DECOMPOSITION.md` and `UI_REDESIGN_PLAN.md` when scope or acceptance criteria change. Keep the original AI and contribution documents intact unless a separately agreed edit explicitly targets them.
- The task brief names `dev` as the target branch. The current repository's `CONTRIBUTING.md` describes `main` as its general integration target. Resolve that difference with the team before opening or merging a PR; do not silently change either convention.
- Keep commits limited to the completed milestone and required docs. Never claim a remote push or PR unless it actually succeeded.
