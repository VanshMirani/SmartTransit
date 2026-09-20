# SmartTransit Live Website Review

Date: 20 September 2026 (Asia/Kolkata)

Target: https://smart-transit-lyart.vercel.app/

## Latest Route-Editor Correction

Release **`4387358`** is now live: Vercel is READY with the production alias, and Render is live on the same commit. Existing-route map edits now target a named existing stop; failed saves display their reason inside the editor and retain the draft. Active-trip route protection remains in effect. Lint, 105 tests and build passed; disposable MongoDB verification passed 25 tests and adapter checks. Post-release API health returned 200/ok and unsigned admin access returned 401. No existing production records were changed. Browser interaction/visual verification remains policy-blocked; see [the route-pin follow-up](./QA_AUDIT_REPORT.md#existing-route-pin-save-follow-up-20-september-2026) for exact coverage and manual checks.

## Previous Submission Review

**Frontend and backend now run release `8afd90d`**, including administration safeguards and the isolated Admin GPS simulator. Vercel reports READY and Render reports live on that commit. The authorized temporary-record live API check passed all eight groups; zero created test records remain and deleted staff sessions were revoked. Existing users, real trips and alert history were not edited or deleted. Full local verification passed lint, 100 tests and build; temporary MongoDB verification passed 24 tests plus adapter concurrency/reopen checks.

**Not an unconditional production sign-off:** the public demo administrator password was confirmed to work live and needs owner-controlled rotation. IU-R9's Electrotherm and Saanvi stops share a pin, and one student email is duplicated across transport records. These existing records were left untouched pending confirmation. Real-phone GPS, external notification delivery and a fresh visual/mobile walkthrough remain unverified. Browser security policy blocked access; no workaround was used.

Use **Admin > GPS simulator** for clearly labelled movement/ETA demonstration on a route with valid distinct pins. It does not publish fake positions to real users. See [QA_AUDIT_REPORT.md](./QA_AUDIT_REPORT.md#submission-audit-follow-up-20-september-2026) for current findings, deployment IDs, changed files and handover actions. The rest of this document is historical evidence from the older review, not the current application's bug list.

## Historical Verdict

The public website and backend are available, and the main public layouts are usable. The currently deployed frontend is **not ready for an operational sign-off**: emergency submission can report success after failure, and a temporary session-verification outage logs the user out.

The live asset is `/assets/index-D1RCzM4a.js`. It still contains the older emergency and authentication implementations. The local audit branch at `3226c59` contains fixes from `6b1cc2d`, but this review confirms that those particular frontend fixes are not present in the live asset. This does not establish the live backend's commit or database configuration. Publishing a Git branch did not, by itself, update this deployment.

No production records, passwords, assignments, trips or alerts were changed. No registration, OTP email, password-reset email or real login was submitted. No deployment was performed. Application source was not changed during this review.

**Subsequent local remediation:** the user's follow-up request has now been implemented and tested locally. All findings below are retained as evidence of the deployed version reviewed, not as the status of the updated working tree. See [QA_AUDIT_REPORT.md](./QA_AUDIT_REPORT.md#live-review-remediation-20-september-2026) for fixes, 78 automated tests, 22 browser scenarios and remaining release gates. The live deployment has not been changed.

## Method And Boundaries

- Chrome through Playwright, fresh browser sessions, actual HTTPS production pages.
- Home, login, signup, password reset, privacy and an unknown route at widths 1440, 768, 390 and 320 pixels: 24 page/width combinations.
- 16 additional direct-route checks covering tracking/help aliases and protected role pages.
- Mobile menu, section links, browser Back, client-side form validation, password visibility and sign-in failure recovery.
- Four actual, unauthenticated, read-only API requests from the live frontend origin: health, session, student transit and admin bootstrap.
- Two session-failure reproductions with fictional browser state and entirely intercepted backend requests: connection failure and HTTP 503.
- Four emergency reproductions: driver/conductor, each with HTTP 503 and network failure. Authentication, trip data and API responses were simulated only in the review browser. **Every backend request in these four contexts was intercepted before reaching production.** These are deployed-frontend behavior tests, not real-account or multi-user backend tests.
- Screenshots contain public pages or fictional QA data only. No tokens, passwords, OTPs or private student details are saved in the evidence.

## Confirmed Findings

### P1: Emergency Forms Falsely Confirm Receipt After Failure

Affected: deployed `Frontend/src/operations/OperationsContext.jsx`, both `submitEmergency` functions and `syncBackend`; deployed `Frontend/src/components/staff/StaffUI.jsx`, `EmergencyForm`.

Reproduction:

1. In a browser-only test context, intercept authentication and trip reads with fictional driver or conductor data.
2. Open the corresponding emergency page, select Breakdown and enter a fictional note.
3. Intercept `/api/staff/emergencies` with HTTP 503 or a network failure.
4. Submit the form.

Actual: all four cases show `Emergency alert submitted` and state that the transport control room has received the alert. No server accepted these requests. The form moves to an acknowledgement instead of retaining a retryable failure state.

Expected: wait for server confirmation; distinguish saved, failed and unconfirmed; preserve details and support an idempotent retry. A saved record is not proof of control-room acknowledgement or external delivery.

Status: already corrected in the audit branch's source, but confirmed still broken in the deployed frontend. Do not treat the live emergency success message as reliable until the reviewed fix is released and checked.

Evidence: `qa/2026-09-20-live/emergency-results.json`, `driver-emergency-simulated-failure.png`, `conductor-emergency-simulated-failure.png`.

### P1: Emergency Location Is Invented From The Next Stop

Affected: the same deployed emergency providers and form/page location labels.

Reproduction: supply a next stop and its coordinates but no GPS fix in the browser-only fixture. Submit an emergency with the request intercepted.

Actual: `Near QA Stop, Ahmedabad` is labelled as the attached current location, although the test provides no phone position and no active trip. The next route stop does not establish the bus's actual position.

Expected: a reliable timestamped fix, clearly labelled last-known/approximate data, or location unavailable. Do not silently substitute next-stop coordinates.

Status: corrected in the audit branch, not reflected in the deployed implementation. The conductor emergency heading also says Active Trip when the intercepted trip status is `not-started`; that label is independently misleading.

### P1: Temporary Verification Failure Clears The Session

Affected: deployed `Frontend/src/services/authService.js`, `validateSession()`, and its authentication-context caller.

Reproduction:

1. In an isolated browser context, provide a fictional cached session and placeholder token.
2. Intercept all backend requests before network access.
3. Open `/student` while `/auth/session` fails at network level; repeat with HTTP 503.

Actual: both cases remove `smarttransit.session` and `smarttransit.authToken`, then redirect to `/login`. Neither response establishes that a real session is invalid. Inspection of the deployed bundle confirms a catch-all call to `logout()`.

Expected: preserve the session during temporary failure, block unverified privileged content, show reconnecting/unavailable, and retry verification. Clear the session only on a confirmed authentication failure or explicit logout.

Status: corrected in the audit branch, absent from this live bundle. This reproduction does not use or validate a real production account.

Evidence: `qa/2026-09-20-live/interactions.json`.

### P2: Narrow Privacy Header Overflows

Affected: `/privacy`, `.privacy-header` / `.privacy-header-actions` and their responsive styles.

Reproduction: open `/privacy` at 320 CSS pixels wide.

Actual: document width is 333 pixels; the Sign in button extends beyond the viewport and wraps awkwardly. No page-level overflow was detected on the other 23 combinations tested.

Expected: wrap or stack the header actions while retaining readable button labels and touch targets.

Status: recorded for a scoped responsive fix; no application edits made in this live review.

Evidence: `privacy-mobile-first-viewport.png` and `results.json`.

### P2: Homepage Preview And Copy Overstate Live Readiness

Affected: deployed `Frontend/src/components/PhonePreview.jsx` and `Frontend/src/pages/HomePage.jsx`.

Actual: the decorative phone shows `Live now`, a named student, a specific bus, `8 min`, and `17 / 50` without fetching live transport data. The public copy also says `Accurate ETA`, `Ready to present`, and `Backend-ready APIs`, including a claim that a real backend can connect later, despite the current backend already being connected.

Expected: clearly identify the phone as a preview and use honest estimated-arrival wording. Replace presentation/development copy with useful transport information. Do not imply that a decorative preview is a current bus position.

Status: some copy/preview changes already exist in the audit branch; presentation-oriented wording remains there and still needs review. The live site retains the older wording.

Evidence: `home-desktop-first-viewport.png`, `results.json`.

### P2: Public Help Requires Login

Affected: `Frontend/src/App.jsx`, `/help` via `StudentEntryRedirect`, plus public Help center links.

Actual: clicking Open help center on the public homepage sends a signed-out visitor to sign-in. Someone unable to log in cannot use the linked help center. This is a confirmed navigation behavior and a usability gap, not an authentication bypass or an accidental 404.

Suggested follow-up: expose limited public account-access/support information while keeping private student help data protected. Verify the transport contact mailbox before relying on it; delivery to the displayed address was not tested.

## Checks That Passed

| Check | Actual result |
| --- | --- |
| Public availability | Home/login/signup/reset/privacy and not-found screen rendered successfully. Direct-route refresh works. |
| Normal public-page errors | No uncaught page exceptions, console errors, failed assets or broken images in the 24 page/width checks. Expected errors from separately intercepted failures are not counted as normal-page errors. |
| Layout | Home/auth forms visually inspected on desktop/mobile. No page overflow in 23 of 24 tested combinations. |
| Mobile navigation | Menu opens/closes; Features, Operations, Safety and Help anchors exist and navigate; choosing a link closes the menu. |
| Browser Back | Returns from the help/sign-in redirect to the homepage. |
| Protected route guards | Signed-out role-page checks redirect to login. Unauthorized page renders separately. This is not a complete backend role/assignment audit. |
| Login validation | Empty/invalid input rejected before any login request; show/hide password works. |
| Login request failure | Intercepted failed request shows an error, preserves input and releases the loading button; intercepted server rejection is displayed. The raw `Failed to fetch` message could be more user-friendly. |
| Signup/reset validation | Empty and non-university email input rejected before any OTP request. Email delivery and complete account flows intentionally not tested. |
| API health | Actual HTTP 200 JSON with `ok: true`; approximately 1.06 seconds for this single observation. This is not a load test. |
| Signed-out API protection | `/auth/session`, `/student/transit`, `/admin/bootstrap` each returned HTTP 401 JSON, not HTML or transport records. |
| Browser-to-API connection | These cross-origin requests were readable from the live frontend origin; no CORS or mixed-content error in these checks. |

## Performance Observations

On this desktop/network, the first home navigation had approximately 237 ms time to first byte and 1005 ms to DOMContentLoaded. This is one browser observation, not a Lighthouse/Core Web Vitals assessment or a real-phone result.

The public homepage eagerly loads the main, maps and charts JavaScript chunks, although its map is only an illustration. Their encoded resource sizes total about 300 KB. Lazy-loading role-specific maps/charts is a possible optimization, not a confirmed user-visible slowdown in this run.

## Not Verified On Production

- Real role-account sign-in and current assignments/data consistency.
- New signup, actual email delivery, approval/rejection and complete password reset.
- Real outbound/return trip starts, seat counts, concurrent updates or persistence.
- Actual map tiles/stop coordinates and GPS/ETA accuracy in authenticated tracking screens.
- Driver-phone permission handling, weak GPS, outdoor movement, screen locking/background operation and battery consumption on Android/iPhone.
- Real emergency delivery, administrator acknowledgement, notification delivery or complaint resolution.
- Hosted backend commit, MongoDB persistence/configuration, backup/restore or production load.
- Full keyboard/screen-reader/contrast accessibility audit.

## Recommended Release Sequence

1. Review the already-pushed audit branch and its staging evidence. The fixes must be included in the frontend/backend release together where their API contracts require it.
2. Correct the remaining narrow privacy header and public copy/support issues locally, preserving the visual identity.
3. With explicit deployment approval, release the reviewed changes and verify the served asset/version. Do not assume GitHub push means the live website changed.
4. Repeat outage/emergency regression checks, then use authorized controlled accounts for a supervised four-role review. Schedule real-phone route/GPS testing before operational sign-off.

This review is suitable for prioritizing the release fixes, not for certifying the current live deployment as fully functional.

## Evidence And Reproduction Files

Directory: `docs/qa/2026-09-20-live/`

- `results.json`: page/width checks, redirects, public asset measurements.
- `interactions.json`: form/navigation checks, actual read-only API results and simulated session failures.
- `emergency-results.json`: four browser-intercepted emergency failures.
- `public-review.mjs`, `public-interactions.mjs`, `emergency-interception.mjs`: review scripts. Runtime import paths are machine-specific. They are evidence/reproduction utilities, not application code.
- Selected PNG screenshots: public layouts and explicitly simulated emergency failures. The existing QA screenshot ignore rule remains unchanged; these files are local evidence and were not pushed.
