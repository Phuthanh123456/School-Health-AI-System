# Public landing: Frontline reference study

## Reference inspection before implementation

Reference: https://www.frontlineeducation.com/school-health-management/

The rendered page was inspected in Chromium at 1440px and 375px. Cookie consent was dismissed and the entire page was scrolled to trigger entrance animations before capturing `reference-desktop.png` and `reference-mobile.png`. Reference screenshots remain local in the outer workspace's `.ui-reference-artifacts/frontline/` directory, outside this Git repository and the public app assets. Some embedded video content did not render in the desktop capture; the actual layout, type, photography, benefit columns, alternating sections and footer were visible. Initial sandbox networking was unavailable; public-page capture succeeded with network-enabled execution.

Observed composition:

- A narrow pale utility strip above a white corporate header; brand left, horizontal navigation in the center, outlined pill CTA right. At mobile sizes navigation collapses.
- A pale gray hero with a small breadcrumb/eyebrow, a large regular-weight sans headline at roughly 70px, readable copy and mint pill CTAs. The right photo is a compact landscape rectangle with gently rounded corners, surrounded by restrained linework.
- Approximately 1280px content containers, roughly 80px desktop gutters at 1440px, broad section spacing and centered section introductions.
- A structured solutions area with quiet gray backgrounds, icon/title rows, dotted separators and aligned CTAs. A contrasting purple benefit band uses open three-column content with dotted dividers rather than floating cards.
- Large white alternating photo/text sections; landscape photo crops, regular-weight headings and concise supporting paragraphs.
- A deep blue-green footer with a prominent brand/CTA column and compact link columns. No dashboard mockups, glass effects or moving metric cards.

## SchoolHealth adaptation

Keep the SchoolHealth wordmark and teal brand. Translate the contrasting benefit band to a SchoolHealth teal tone, retain the reference's pale hero, mint actions, open column rhythm, soft rectangular photography and dark footer. Use only supported records, checkups, Parent access, Admin management and aggregate-only AI capabilities. All primary calls to action lead to `/login`; section links remain local anchors. No reference logos, proprietary artwork, testimonials or claims are reused.

## Implementation and visual refinement

- Extracted the public presentation into `frontend/src/LandingPage.tsx` and `LandingPage.css`. Every CSS selector is scoped to `.schoolhealth-landing`; shared globals and protected screens are unchanged.
- Kept `App.tsx` pathname dispatch, the legacy `/#admin` route and all code from `ProtectedRoute` onward identical to the prior commit. `/`, `/home` and existing fallback public paths render the extracted page.
- Added native modal mobile navigation using the shared Dialog. It closes on Escape, section selection and desktop resize. Escape restores trigger focus; section selection focuses its target. Links use real anchors and `/login`.
- Added the five supported product solutions, five benefits, a three-step workflow, alternating care/Nurse/family photo sections, three role descriptions, an aggregate-only AI description and a final login CTA. No invented clinical services, testimonials, customers or credentials appear.
- Kept SchoolHealth's wordmark/teal identity while adopting regular-weight sans headlines, pale gray hero, mint pill CTAs, 1280px containers, dotted divisions, landscape imagery and a dark multi-column footer. No proprietary reference logo, text, artwork or photographs are shipped.
- Locally hosted 640px/1280px Pexels WebP photos have individual provenance and license details in [asset credits](../frontend/public/images/landing/CREDITS.md). Stock models illustrate care/learning settings; no personal student data or health records were used.

First-pass artifacts: `landing-frontline/schoolhealth-desktop-before.png` and `schoolhealth-mobile-before.png`. Visual comparison led to full-width stacked mobile CTAs, two-column tablet solutions and a contrasting footer brand panel. A second tablet review showed the 768px hero was too narrow in two columns; it now stacks at 768–899px. Final viewport/full-page captures were reviewed after refinements. This is an adaptation, not a pixel-perfect clone: branding, supported copy, feature count, stock photography and destinations are SchoolHealth's own.

## Validation

| Check | Actual result |
| --- | --- |
| `npm run lint` | Passed; rerun after final visual refinement |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; rerun after final visual refinement |
| `npm test` | Passed: 3 BMI tests, 24 Vitest tests |
| Full Playwright regression | 53/53 passed against local Vite with synthetic protected-page API fixtures |
| Landing Playwright after final tablet refinement | 5/5 passed |
| Viewports | 320, 375, 768, 1024, 1440 and 1920px: no document/body horizontal overflow |
| Public behavior | Login CTA, section targets, keyboard flow, native modal, Escape/focus return, resize close, `/home`, reduced motion and local photo loading passed |
| Protected behavior | Role navigation, restoration, authorization, Nurse workflows, Parent records, Admin assignment concurrency and AI regressions passed. Live backend/database and LLM integration are outside this presentation task. |

Browser regression used an ephemeral Playwright config pointing at `http://127.0.0.1:5176`; it was removed after validation. No dependencies were added.

## Review artifacts

- [Final desktop full page](landing-frontline/schoolhealth-desktop.png)
- [Final mobile full page](landing-frontline/schoolhealth-mobile.png)
- [Mobile menu](landing-frontline/mobile-menu.png)
- Viewport captures: `landing-frontline/viewport-{320,375,768,1024,1440,1920}.png`.
- Local reference captures: `D:/PhuThanh/Code/scrum_course_project/.ui-reference-artifacts/frontline/`.

Earlier M9 screenshots remain the historical baseline. This document describes the subsequent authorized public-landing replacement. No remote push or merge was performed.
