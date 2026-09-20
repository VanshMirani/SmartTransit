# SmartTransit QA Audit

Date: 5 September 2026 (Asia/Kolkata)

## Distance-Based Arrival Correction (20 September 2026)

The next live screenshot showed GPS Active and a speed, but no distance and an old start-based arrival. Inspection confirmed two medium-severity calculation defects: `buildLiveEtaContext()` discarded distance when the bus was over 1 km from schematic stop-to-stop lines or had zero speed, and inferred speeds were clamped upwards to 12 km/h even for tiny GPS jitter. This explains a reproducible failure class; no private production trip was queried to prove its exact stored coordinates.

Fixes:

- Keep approximate distance independent from motion and the schematic-route corridor. The existing GPS-only stop-progress safeguards remain unchanged, so an off-corridor fix does not skip the first stop.
- Derive active arrivals from the latest reliable GPS fix time plus remaining ordered-stop distance divided by usable speed. Refreshing alone does not move the predicted clock forward. Morning and return use their own ordered stops.
- Remove the start-plan fallback from active arrival labels. Preserve schedules and recorded departure plans in data, but never present them as a current arrival prediction. Passed stops say Passed.
- Keep distance when stationary; withhold arrival predictions until motion is usable. Do not inflate slow measured speeds to 12 km/h. Treat displacement inside the combined accuracy envelope as no reliable movement rather than inferred speed. If speed is genuinely unknown, retain the existing 24 km/h assumption and explicitly label it as assumed.
- Publish common numeric distance, estimate timestamp, source and arrival fields in staff, student and admin responses. Driver and admin final-arrival summaries now use the same distance-based result. GPS timestamps and trip records are unchanged.
- Keep the existing layout; allow the Driver estimate note to wrap and increase its small text for readability.

Important accuracy boundary: this is a **coordinate-based approximation**, using bus-to-next-stop and subsequent ordered-stop segments with the existing 1.25 distance factor. It is not actual road routing or traffic-aware ETA. Distances show `~`, and the UI identifies the approximation/assumed speed. No bus coordinates were sent to another service. An approved road-routing provider and validated stop pins would be needed for better road-distance accuracy.

Verification: three new backend regressions failed before the correction, then passed; `npm run check` passed lint, **91 automated tests**, and production build. A separate temporary MongoDB run passed **18 tests**, plus cross-adapter concurrent-write, exact reopen and empty-production fail-closed checks. Coverage includes both trip directions, distance/speed changes, cross-role equality, stationary and stale GPS, jitter and assumed speed. No production records or real GPS were used. Browser expectation updates are included, but not run because the browser security restriction remains unresolved; no new visual or real-phone pass is claimed. Fresh full local QA preview is on port 5177; the existing port 5176 preview was preserved.

Changed: backend ETA/speed calculations and regression tests; shared stop-time and driver GPS helpers and tests; Driver home, Student tracking and Admin live arrival summaries; scoped Driver CSS; browser regression expectations; this report. No new secrets, configuration variables, packages or database migration are required. Publication results follow after deployment.

## Authorized Production Release (20 September 2026)

The user explicitly requested publication to the live website after the GPS follow-up. This release includes the audited backend/frontend, departure-time propagation fix and GPS presentation/retry changes below. Earlier statements that no deployment occurred describe their respective historical test runs.

Pre-release checks: lint, all 86 automated tests and production build passed again. Before publication, both hosted production services ran `4abc104aca1fd1678b8ffadd0bc46e1f1cd3563a` from `main`; Render auto-deploys that branch. The pre-release public frontend used the correct HTTPS API, and API health/CORS checks passed. No environment variables, accounts or production records were modified. The unrelated local `DEPLOYMENT.md` edit is excluded.

Published `cc7032efcf9e3b3387ccdd66fa4c650b419fa42e` by fast-forwarding both `main` and `codex/qa-reliability-audit`. Application fixes are in `0a70b75` on top of the earlier audited commits. Both deployments were triggered by the existing Git integrations, with no manual duplicate deploy:

- Vercel production `dpl_AMndRZQFoz2BZ4ykTjSdUUiMwSze`: **READY**, correct commit, with `smart-transit-lyart.vercel.app` assigned and no alias error.
- Render `dep-danovsflk1mc73fhg8kg`: **live**, correct commit, completed 20 September 2026 at 13:19:45 IST.
- Post-release read-only API checks: `/api/health` returned 200 and `ok: true`; `/api/auth/session`, `/api/student/transit` and `/api/admin/bootstrap` each returned 401 without credentials. All returned the intended frontend CORS origin.
- No production sign-in, trip start/end, GPS upload, passenger count, account reset, email or emergency test was performed. Existing production data was not reset or seeded.

Rollback reference: Vercel `dpl_3Ag9TZGk4PCALcRUoaK8SVBdJdw5`, Render `dep-dad9e70ae00c73dlqovg`. No rollback was performed. This post-release documentation is kept on the audit branch without triggering another production restart.

Newest GPS UI/retry browser verification remains blocked by the computer-use security check, including a fresh attempt to open the production site. No indirect browser-access workaround was used. Vercel's build-log connector returned an unavailable-tool error; Render logs required a separately confirmed workspace, so detailed hosted logs were not reviewed. Deployment states and API responses above were verified through their independent deployment/service interfaces. The earlier 22-scenario browser result and latest automated tests are not a substitute for real-phone testing or production workflow certification.

User check: refresh the live website, sign in with the existing driver account, allow location access on a GPS-capable phone, and use Retry GPS if prompted. After starting a trip at an unscheduled time, stops should use the saved actual-departure plan; reliable accepted GPS may refine the estimates. Missing GPS must show a labelled start-based arrival, not a fake live ETA. An active trip that predates this release cannot be guaranteed to contain the new saved timing plan; do not reset it merely to refresh the display.

## Missing GPS Presentation Follow-Up (20 September 2026)

The supplied Driver screenshot showed working start-based stop times but no accepted GPS fix. Confirmed UI issues: a green `GPS Inactive` badge, `GPS updated Not sharing`, repeated unavailable text, and a freshness timer replacing the original device/upload error with a stale-location warning even before the first accepted location.

Local fixes preserve the current layout and do not fabricate tracking:

- Share accurate GPS labels between Driver home and active-trip pages. Use the existing amber status style unless GPS is actually sharing; the status dot follows its text colour.
- Show a clearly labelled start-based arrival when no usable live ETA exists, separate from GPS-derived speed/distance. Show `No location received yet` instead of presenting `Not sharing` as a timestamp.
- Display the actionable GPS error near the trip summary and offer `Retry GPS`. Retrying disposes the old uploader/watch before creating a new attempt; it does not override browser or device permission settings.
- Preserve permission, weak-signal, device and upload errors through freshness checks. First-fix waiting no longer implies a previous location exists. An older upload acknowledgement cannot erase a newer permission error.

Files: `Frontend/src/operations/gpsSync.js`, `OperationsContext.jsx`, new `gpsPresentation.js`; Driver home/trip pages; scoped status/notice CSS; frontend regression tests; and the browser regression script's GPS scenario.

`npm run check` passed lint, **86 automated tests**, and production build. Added tests cover first-fix waiting, persistent device/upload errors, late acknowledgement after permission denial, planned versus live values, and stale/missing location display. No backend logic or production data was changed in this follow-up.

**Visual/browser limitation:** computer-use access to the existing local tab failed because its admin-enforced browser security check was unavailable. No alternative browser-control mechanism was used to bypass it. The new retry-button browser scenario was updated but **not executed**; the earlier 22-scenario browser pass predates these presentation/retry changes. A visual check of the updated banner and an actual retry/recovery check are still required. Real-device GPS delivery is not proven by the supplied screenshot or by unit tests. No push or deployment occurred.

## Stop-Time Regression Follow-Up (20 September 2026)

The user reported fixed stop times on the **live website**. Earlier local fixes had not been deployed. Investigation also reproduced an additional local bug that the previous read/refresh checks missed.

**Confirmed, medium severity:** starting a trip and reading a dashboard returned actual-departure estimates, but `storeDriverLocation()` and the first successful `updateTripProgressFromSeatUpdate()` response returned raw timetable stops. The staff contexts replace their displayed stops with these mutation responses, losing `departureEstimateAt` and `estimatedArrivalAt` until the next poll. Frequent GPS uploads could repeatedly restore fixed times. The shared stop-label helper then silently displayed `scheduledTime` for an active trip without an estimate.

Reproduction: start a morning trip outside its schedule, open Driver > Active trip, accept a controlled GPS update, then submit a conductor passenger count. Inspect both POST responses and the immediately rendered stop times rather than only refreshing the page. Repeat with a separate return trip. New tests for both responses and the active-stop fallback all failed before the fix.

Fix: both write responses now use `operationsWithLiveLocation()`, the same assigned-trip projection as the read/start endpoints. They retain the saved departure plan, supply usable GPS estimates, and preserve recorded GPS timestamps. Active stops with missing/invalid estimates show `ETA unavailable`, never an unlabelled fallback to the original timetable. Before departure, the scheduled timetable remains unchanged. Starting late shifts the initial plan by the actual departure time; usable GPS can refine it, and clock time still does not mark stops as passed.

Files: `Backend/apiServer.js`, `Frontend/src/utils/dateLabels.js`, `Backend/tests/reliability.test.js`, `Frontend/tests/dateLabels.test.js`, `Backend/scripts/qa-browser.js`, and this report. Earlier uncommitted work remains preserved.

Verification:

- `npm run check`: lint, **81 tests**, and production build passed. Added cases cover morning/return, stationary and moving test GPS, first passenger submission, duplicate retry, refresh consistency, and missing/invalid estimate labels. Existing early/late/midnight timing tests also pass.
- Full production-built local HTTPS/MongoDB browser review: **22 scenarios passed**, no uncaught page errors or map-loading limitations. New assertions compare the rendered Driver labels immediately after GPS upload and Conductor labels immediately after seat submission against the returned estimates, including a return journey without GPS. MongoDB adapter reopening preserved exact saved state.
- The first browser attempt exposed a missing wait in the new test for the lazy-loaded Driver page; corrected the wait and repeated the full run successfully. Evidence is retained in `docs/qa/2026-09-20-stop-estimates/` and `docs/qa/2026-09-20-stop-estimates-final/`.
- Visually inspected `actual-departure-plan.png` and `return-departure-plan-after-seats.png` in the final directory. Refreshed the disposable local preview at `http://127.0.0.1:5176` and confirmed its sign-in page loads without browser errors.

No push, deployment, real email, production account operation or production trip change was performed. **Both frontend and backend need an explicitly approved release before this fix appears on the live website.** No new configuration variables or data migration are required. Outdoor/real-phone GPS accuracy remains unverified; this change corrects time propagation, not traffic-aware routing.

## Live Review Remediation (20 September 2026)

**Status: all confirmed live-review findings have local fixes and regression coverage. The live website has not been deployed or changed by this work.** The earlier emergency/location/session fixes were already present on `codex/qa-reliability-audit`; this follow-up verified them again and corrected the remaining public-site issues. The original production observations are preserved in [LIVE_REVIEW_REPORT.md](./LIVE_REVIEW_REPORT.md).

### Fixes and Reproduction

| Finding | Resolution | Verification |
| --- | --- | --- |
| Emergency forms claimed receipt after a failed request, and used the next stop as current GPS. | Retained the existing audited server-confirmed submission, idempotent retry and server-selected reliable-location logic. Both staff forms identify missing/unconfirmed information honestly; the conductor heading reflects actual trip state. | Driver and conductor each tested with HTTP 503 and network failure before a trip: no success screen, retained note and identical retry ID, no client-invented coordinates. Existing accepted-but-lost response test saves exactly one alert; backend location tests pass. |
| Temporary session-verification errors logged users out. | Retained the audited distinction between temporary failure and confirmed 401/403. Also normalized network/timeout errors into actionable language without changing authentication status. | Failed connection and 503 retain the session while blocking initially unverified content; retry restores access; 401 clears authentication. Added four API-client tests for failures, timeouts, cancellation, HTML responses and interrupted response bodies. |
| Privacy header overflowed at 320px. | Header actions now wrap with intact labels and touch targets. | Public pages checked at 320, 390, 768 and 1440px; no page overflow. |
| Public preview and readiness copy implied real live data or an unfinished backend. | Kept the existing visual identity, replaced development/presentation wording, qualified arrival estimates, removed the hardcoded route count and fictional person/bus/seat/arrival values, and clearly labelled the phone as a preview. | Browser asserts no fake live claim or old presentation copy. Visual inspection also found a floating badge over the heading and mobile navigation covering the next stop. Removed the redundant badge and its unused CSS; changed only the illustration's internal layout to fixed header/navigation rows and a flexible map area. Dedicated four-width checks confirm visible next-stop text and a fitting heading. |
| Public Help sent signed-out users back to login. | `/help` now provides public account, approval, assignment, staff-access and GPS guidance. Private `/student/help` and all backend permissions remain protected. Added sign-in help and privacy links. Public help/privacy remain available even with missing API configuration. | Direct load, refresh, FAQ expansion, reset navigation, browser Back, and sign-in help link pass. A separately built, intentionally unconfigured production bundle blocks transport access but still exposes help/privacy. |
| Public contact address was unverified. | Public home/footer/privacy/help now use the university's published general help desk/email and identify them as university contacts, not a confirmed dedicated transport mailbox. | Checked against the [official university contact page](https://indusuni.ac.in/contact-us.php) on 20 September 2026. Email delivery and call routing were not tested. |
| Homepage downloaded maps and charts it did not use. | Lazy-load the six map/chart role pages, with a visible loading state and recoverable error boundary. | Production browser confirms no maps/charts JavaScript on the homepage. Blocking a tracking-page download shows recovery; reload restores the page. All role pages, maps and reports still pass. Main bundle is approximately 455 kB instead of 515 kB; no chunk-size warning. |

### Actual Verification

- Baseline: lint, 74 tests and build passed before this follow-up.
- Final `npm run check`: lint, **78 tests**, and production build pass.
- Production-built frontend with HTTPS loopback API and fresh disposable MongoDB: **22 browser scenarios pass**, **90 public/role page-width checks**, **zero uncaught page errors**, and **zero map-loading limitations**. Negative tests deliberately generate failed requests/console errors, recorded separately in the evidence.
- Verified all four roles, actual-departure estimates, controlled GPS input, polling between independent sessions, seat retries, separate return journeys, captured-email password reset and signup, pending/approval, complaint resolution, preference saving, route access rejection, offline/reconnection and logout cleanup.
- Exact MongoDB state survived adapter closure/reopening after the browser workflows.
- A separate missing-configuration production-build check passed; public help never becomes an alternative route into private transport data.
- The final phone-internal CSS adjustment followed the full functional run and was then checked independently at all four widths, with explicit heading-fit, page-overflow and next-stop/navigation bounds assertions. No backend or dashboard logic changed after the full functional run.

Evidence: `docs/qa/2026-09-20-release-review/browser-results.json`, `preview-layout-results.json`, selected viewport screenshots and the generated role/public screenshot gallery. Configuration evidence: `docs/qa/2026-09-20-public-config/public-config-results.json`. Screenshots remain local under the existing ignore rule; no production identifiers or secrets were recorded.

### Changed Files

- Application: `Frontend/src/App.jsx`, `components/DeferredPage.jsx`, `components/Footer.jsx`, `components/PhonePreview.jsx`, `pages/HomePage.jsx`, `pages/PrivacyPage.jsx`, `pages/PublicHelpPage.jsx`, `pages/auth/LoginPage.jsx`, `services/apiClient.js`, `services/supportContacts.js`, and `styles.css`.
- Verification: `Frontend/tests/apiClient.test.js`, `Backend/scripts/qa-browser.js`, `Backend/scripts/qa-public-config.js`, and `Backend/scripts/qa-server.js` (optional `QA_PORT` for an unused local port).
- Documentation/evidence: this report, the live-review status note, README and the QA evidence directories. The pre-existing `DEPLOYMENT.md` edit was preserved unchanged. No package, lockfile, production configuration, account or data changes.

### Manual Review and Release

Local frontend/backend preview: `http://127.0.0.1:5176`, using a new disposable database and captured test email. Open Home, Help, Privacy and Sign in at mobile and desktop sizes. Use the documented isolated demo accounts to review each role; do not try published demo credentials in production.

No new API keys or configuration variables are required for these UI/recovery fixes. The earlier audited backend and frontend must be reviewed and released together where their API contracts require it. Nothing in this follow-up was committed, pushed, merged or deployed. Production still needs an explicitly authorized release and post-release verification.

Real Android/iPhone GPS, screen lock/background behavior, weak reception, outdoor ETA accuracy, controlled Brevo delivery, hosted configuration/Atlas, load testing and operational emergency response remain unverified. This is ready for release review, not a claim of complete university production certification.

## Supervised Local Staging Review (20 September 2026)

**Decision: the tested local staging workflows pass after fixes. Proceed to a hosted staging/deployment review, not university production sign-off.** No separate staging URL was provided. This run did not deploy to Vercel/Render, inspect production accounts, send provider emails, or modify live data. Earlier uncommitted work remains preserved.

### Environment and Evidence

- Production-built React/Vite frontend served over loopback HTTPS; production-mode backend with the existing MongoDB adapter. Cross-origin frontend/API traffic used a staging-specific allowed origin.
- A fresh temporary MongoDB 7.0.14 instance received isolated fixtures. No application `.env` was loaded. Test email was captured locally in a restricted temporary file. Simulated GPS was injected only into test browser contexts.
- Chrome with independent Student, Driver, Conductor and Admin sessions; desktop 1440px and mobile 390px. Local Node was 24.19.0. The Render blueprint's Node 20 runtime was not separately exercised.
- The local certificate was self-signed and accepted only by the test browser. This is not validation of hosted certificates, DNS, cloud CORS or Atlas network policy.
- Final evidence: `docs/qa/2026-09-20-staging-final/browser-results.json` and 88 automatically captured screenshots locally. Selected representative screenshots are included in Git; the remaining generated gallery stays local to avoid committing duplicate images. Earlier `2026-09-20-staging*` result files preserve pre-fix failures. One Admin screenshot caught imagery mid-fade; an additional isolated preview inspection confirmed tiles and all ancestor opacities settle to 1, saved as `admin-map-settled-preview.png`.

### Newly Confirmed Issues

| Finding | Severity | Reproduction and fix | Verification |
| --- | --- | --- | --- |
| A student's tracking page kept its green GPS live label until the next failed poll after internet loss. The offline copy also retained a GPS-derived arrival clock. | Medium | Start an isolated trip, accept simulated GPS, open Student tracking, then disable that browser's network. `useStudentData` now reacts immediately to the offline event, retains the recorded location/time, clears live ETA/distance estimates, and waits for a successful fetch before restoring live status. Inactive trips remain inactive offline. | New browser regression failed before the fix, then passed: no live chip within 3 seconds, no GPS estimate label, unchanged timestamp/token, and recovery without refresh. |
| Leaflet zoom work could outlive the map during rapid navigation. | Medium | The initial run recorded an uncaught `_leaflet_pos` error after its original assertion checkpoint. Automatic `MapFitBounds` updates now avoid zoom animation; `MapAutoCenter` stops movement when its effect changes, guarding against an already removed parent map. An intermediate cleanup regression was caught and corrected before the final run. | Final rapid navigation, trip completion, return preparation, mobile navigation and teardown had zero uncaught page errors. |
| Admin monitoring said "Waiting for active trips" even when a trip was active but awaiting GPS. | Low | `AdminLiveOperationsPage` now distinguishes no active trip, an active trip waiting for GPS, and fresh GPS. | A focused browser check using a new isolated API/database verified all three states; the repeatable return-trip browser scenario also asserts the waiting-for-GPS heading. |
| Browser verification could miss errors after the role-page loop and could accept transparent placeholder tiles as loaded imagery. | Medium (test reliability) | Browser assertions now cover final navigation/teardown, capture error stacks and scenario names, and require real tile dimensions rather than a one-pixel placeholder. Built-application API probes no longer depend on Vite source imports. | Final results contain 18 passing scenarios, no page errors and no map-loading limitations. |

### Actual Results

- `npm run check`: lint, **74 automated tests**, and production build passed. The existing roughly 515 kB main bundle warning remains.
- Temporary MongoDB regression run: **12 API scenarios plus 1 JSON adapter test passed**, alongside separate cross-adapter concurrent-write, exact reopening and empty-production fail-closed checks. This is local real MongoDB, not Atlas verification.
- **18 browser scenarios passed**, with **76 public/role page-width combinations** and additional workflow screenshots. No page-level horizontal overflow or uncaught JavaScript exceptions were recorded. Expected denied requests, deliberately failed writes/map requests and revoked sessions appear in the negative-test console/network logs; normal rendering had no unexpected console errors.
- Verified actual departure agreement, GPS upload, occupancy arithmetic and zeroed separate return journeys, signup/pending/admin assignment and approval, direct-role access rejection, password reset with old-session revocation, complaint resolution, preference persistence, emergency and seat lost-response retries, GPS failure handling, session outage/recovery, map imagery retry, mobile navigation and logout cleanup.
- A conductor change reached already-open Student and Admin screens through backend polling, with no browser refresh. This is periodic synchronization (up to the existing 15/30-second intervals), not instantaneous streaming.
- After the browser run, the production-mode MongoDB adapter was closed/reopened and the complete saved state matched exactly. Separate MongoDB API tests also restarted the API and checked persisted approvals, assignments, sessions and trip counts.

### Scope of This Turn's Changes

Application fixes are limited to `Frontend/src/hooks/useStudentData.js`, `Frontend/src/components/maps/SmartTransitMap.jsx` and a status label in `Frontend/src/pages/admin/AdminLiveOperationsPage.jsx`. Verification changes: `Backend/scripts/qa-browser.js`, new `Backend/scripts/qa-staging.js`, this report, and sanitized screenshots/results. The 18-scenario production run preceded the final heading-only edit; its three states were then checked separately in the isolated development preview. No UI redesign, package/lockfile change, production cleanup, commit, push or deployment was performed.

To repeat the production-build rehearsal, make Playwright/Chrome and `mongodb-memory-server` available outside the application, set `QA_PLAYWRIGHT_MODULE` and `QA_MONGO_MODULE` to those installed module paths, and run `node Backend/scripts/qa-staging.js` from the repository. Set `QA_RUN_NAME` to a new simple folder name for separate evidence. The runner creates its own loopback database, TLS certificate, captured mailbox and build directory, and closes its servers/database when finished. Never substitute a production MongoDB URI or real mail sender.

### Outstanding Release Gates

1. Supply/authorize a **separate hosted staging URL** and isolated staging database before hosted verification. Check the actual hosting environment, HTTPS API URL, direct-route refresh, CORS, deployment runtime and restart behaviour there. No hosting settings need changing for this local review.
2. Test real Brevo delivery using a controlled staging inbox, and review/rotate any production accounts using published demonstration credentials through an authorized administrator. Neither was done here.
3. Perform an outdoor Android/iPhone trip: compare GPS/ETA against actual stops; test weak accuracy, lost internet, app switching, screen lock and battery use. Desktop simulation does not prove background tracking.
4. Confirm university return-road/stop geography and operational emergency response. The existing reverse-stop route model and in-app emergency acceptance are not proof of different-road return routing or external dispatch.
5. Load/backup/restore testing, larger MongoDB document growth, process-local rate limits and cloud cold-start performance remain open. This was a functional rehearsal, not a capacity benchmark.

## Follow-up: Folder Move and Actual Trip Times (20 September 2026)

Worked in `/Users/vansh/Projects/SmartTransit-Complete-Frontend 2` on the existing audit branch, preserving all prior uncommitted changes. Runtime/configuration scans found no old `/Users/vansh/Downloads` references. Package scripts and frontend/backend paths are relative; no relocation-specific configuration changes were needed. The complete isolated app starts from the new directory.

Confirmed issue: the server already saved actual `startedAt`, but the role screens continued showing fixed route timetable times. New trips now snapshot their scheduled stop-to-stop intervals into `plannedStopOffsets`. Displayed initial arrival estimates use **actual departure + that stop's planned interval**, retaining the original timetable separately. Refresh, later timetable edits and a restart do not move a new trip's saved departure plan. Early/late starts, equal scheduled times, overnight rollover, malformed schedules and separate return trips have targeted coverage.

Fresh usable GPS supplies a separately labelled GPS arrival estimate. A start-based plan is not proof of the bus's current location: stale/missing GPS still makes live ETA unavailable, and elapsed time never advances stop progress. Initial estimates rely on the existing timetable's travel intervals, not a newly introduced traffic/routing provider. Return journeys still use the existing configured/reversed-stop model described under release gates below.

Also corrected coordinate entry: a pasted map URL now prefers the actual place pin over the map viewport centre; encoded coordinate queries and negative coordinates work, and blank fields are no longer interpreted as zero coordinates. Short map-sharing links without embedded coordinates still need to be opened and replaced with a full coordinate-bearing URL or a manually confirmed map pin. No live stop records were changed and no geocoder request was made during these tests.

Validation: `npm run check` passed lint, **74 tests**, and build (existing ~515 kB main-bundle warning remains). **14 browser scenarios passed**, including actual departure agreement across Driver, Conductor, Student and Admin, refresh stability, return-trip timing, GPS and 76 desktop/mobile page combinations. No uncaught browser exceptions or page overflow occurred. An additional Admin form check confirmed a URL with different viewport/pin coordinates fills the pin, without saving the route or calling a geocoder. Screenshots/results: `docs/qa/2026-09-20-timing/`. This follow-up used disposable JSON storage; the earlier MongoDB run below was not repeated, and real-phone testing remains outstanding.

Files changed in this follow-up: `Backend/tripTiming.js`, `Backend/apiServer.js`, `Backend/tests/tripTiming.test.js`, `Backend/tests/reliability.test.js`, `Backend/scripts/qa-browser.js`; frontend date helpers and tests, `locationSearch.js` and its tests; Student home/routes/tracking, Driver home/trip, Conductor home/trip and Admin live operations pages. Existing layout and colours were retained. No deployment, push, production write or account reset was performed.

To verify manually: start a QA driver trip outside its scheduled departure; inspect the Actual departure panel in Student > Routes and the started time on staff/admin screens. Compare the adjusted stop times, refresh, and confirm the times remain anchored to that departure. Without GPS they remain start-based estimates; an accepted moving GPS fix changes the applicable estimate label to GPS estimate. Stop completion must follow location only. End the journey and start Return to obtain a fresh departure and plan.

The remaining sections document the original 5 September audit.

## Scope and Safety

Audited the existing JavaScript/JSX repository on branch `codex/qa-reliability-audit`, starting from commit `4abc104`. The initial worktree contained a user change in `DEPLOYMENT.md`; it was preserved. No new application, framework migration, database replacement or visual redesign was made.

All account, approval, trip, emergency, notification, complaint and passenger write tests used disposable local data. The browser used independent authenticated sessions and explicitly simulated phone positions as test input. Email callbacks captured OTPs into a permission-restricted temporary file; no provider sent mail. No production account was tested, reset or deleted. No deployment, push, destructive seed, `reset:data` or `clean:presentation` command was performed. Tests that exercise the cleanup *function* use fixtures, not an application database.

The public production URL responded HTTP 200 to a read-only HTTPS header request with HSTS. This is not authenticated production verification.

## Actual Architecture

- React 19, JavaScript/JSX, Vite, React Router, Leaflet and Recharts; the existing CSS and navigation are retained.
- Node built-in HTTP API, not Express. Passwords use scrypt; sessions are opaque random bearer tokens with server-side persisted expiry and authorization, not JWT.
- The browser stores a token/user snapshot in sessionStorage. This is not the authority for approval, permissions or transport assignments. Initial unverified privileged access is blocked.
- JSON storage is local, single-process development storage. Writes now serialize with clone/rollback and atomic file replacement. Corrupt data is not replaced with seeds.
- MongoDB persists the existing single application-state document. Revision-based compare-and-swap prevents independent adapters from silently overwriting concurrent updates. This is not a normalized high-scale event store.
- Role contexts and student hooks fetch authenticated HTTP data, generally every 15 seconds (student home 30 seconds), with post-write refresh. There are no sockets. A successful driver upload does not prove that another user's next poll has completed.
- Production frontend builds require a valid HTTPS `VITE_API_BASE_URL`. Missing configuration does not activate demo dashboards. Production storage must be MongoDB. Empty production state now fails startup rather than creating published demonstration accounts.

## Confirmed Findings and Fixes

Severity: High = incorrect authority/safety/data integrity; Medium = misleading state, broken workflow or layout.

| ID | Severity | Reproduction / previous behaviour | Files / functions | Applied fix and regression evidence |
| --- | --- | --- | --- | --- |
| QA-01 | High | Block the emergency POST: local state could report success despite no server confirmation. | `OperationsContext.jsx`, `StaffUI.jsx` emergency form; `apiServer.js` staff emergency endpoint | Await saved response; sending/error/saved states; preserve form and request ID after failure; duplicate/lost-response retries save once. Server acceptance is not delivery/acknowledgement. Browser success/503/network/lost-response tests and backend rejection tests. |
| QA-02 | High | Next stop coordinates could be presented as the actual emergency position. | Driver/Conductor emergency pages; staff endpoint | Backend attaches only accepted phone GPS with fix timestamp/accuracy, labelled last accepted; otherwise location unavailable. Client location claims are ignored. Tested with no GPS and a forged location. |
| QA-03 | High | A failed session verification could clear a valid session during a temporary outage. | `authService.validateSession`, `AuthContext`, `ProtectedRoute` | Clear on confirmed 401/403, retain token on network/5xx; initial unverified dashboard blocked; reconnect and periodic verification; logout revokes server session. Browser outage/recovery/revocation and API expiry/reset/status tests. |
| QA-04 | High | Local phone fix/upload attempt could imply successful GPS synchronization. Old callbacks could affect another trip. | `OperationsContext`, new `gpsSync.js`, driver pages, location endpoint | Distinct detected/uploading/accepted/error states; last success only after acknowledgement; throttle fresh attempts; reject weak/old/future/out-of-order GPS; abort/dispose old-trip requests; real fix and acceptance times. Browser and unit/API tests. |
| QA-05 | High | Missing backend configuration or failed bootstrap could expose plausible default dashboards. | New `backendConfiguration.js`, `apiClient`, `App`, Admin/Operations contexts, student pages | Production fail-closed configuration page; backend bootstrap gates; explicit unassigned/loading/error states. Reject HTML/non-JSON API responses; do not treat a Vercel HTML fallback as valid transport data. Configuration regression tests. |
| QA-06 | High | Duplicate or concurrent passenger updates could double-count or overwrite state; client-supplied totals/times were not authoritative. | `apiServer.updateTripProgressFromSeatUpdate`, JSON/Mongo adapters, Operations context | Server integer/stop/active-assignment/capacity validation, arithmetic from stored count, request-ID retry deduplication, serialized/CAS writes, genuine event timestamps. Tested 30 + 5 - 2 = 33 occupied/17 available, zero/full/empty, invalid counts, concurrent duplicate submissions and lost response. |
| QA-07 | High | Outbound and return runs could reuse state/history; duplicate transitions and conflicts were insufficiently guarded. | Staff trip endpoints and history pages | Separate new trip IDs/history; clear occupancy/GPS at new run; actual initial return boarding; reject duplicate start/end, direction change while active, wrong assignment and active bus/driver conflicts. API and browser outbound-to-return tests. Return geography remains subject to the limitation below. |
| QA-08 | High | Removing managed driver/conductor assignment could restore their old seeded route through static fallback. | `assignedRouteForStaff`, `routeByStaffRecord`, `staffAssignmentForRoute` | Managed route links are authoritative; no template/old user route fallback for staff. Unassigned staff receive no trip and cannot start/update/report on it. Explicit regression covers seeded staff removal and student details. Incomplete legacy assignments now require admin repair rather than guessed access. |
| QA-09 | High | Student complaint responses could include internal notes; staff mutation responses could expose other route operations. | `apiServer.js` user-scoped response helpers | Student output excludes internal notes; staff responses whitelist assigned operational data. Direct role/assignment rejection and response-scope tests. |
| QA-10 | Medium | Signup completion rendered an undefined `Brand` component; returned auth state conflicted with the return-to-sign-in screen. | `SignupPage`, `authService.registerStudent`, ESLint config | Correct `BrandLogo`, intentional sign-in after signup, undefined JSX component lint rule. Browser signup, captured email, pending, admin assignment/approval and permitted access. |
| QA-11 | Medium | Approved but unassigned students could be relabelled as pending or inherit fabricated bus details. | Student API and profile/help/complaint pages | Approval and assignment are separate. Pending receives no restricted transit; approved/unassigned gets an assignment message. Rejection invalidates existing access. Backend tests include persistence/restart. |
| QA-12 | Medium | Admin stop-directory edits were disconnected from the actual route; explicit coordinates could be overwritten by template enrichment. | `ManagementPage`, `AdminRoutesPage`, route API/normalization | Stop edits open the real owning route editor; direct disconnected stop writes rejected. Validate coordinate pairs and preserve `coordinateSource: admin`. Cross-role override test. No claim that every physical stop has been independently re-surveyed. |
| QA-13 | Medium | Route polylines/circle markers were effectively invisible: global `svg` CSS shrank Leaflet's drawing to icon size. GPS badge also covered zoom. | `styles.css`, shared `SmartTransitMap` | Size Lucide icons only; maintain native map SVG dimensions; separate GPS/zoom controls; tile-failure message and retry. Browser checks tile loading and map drawing dimensions, not just container existence. |
| QA-14 | Medium | Admin mobile tables made the whole page wider than the viewport. | `styles.css` `.admin-table-scroll` | Position the scroll container so an absolutely positioned screen-reader label cannot escape it. Preserve internal horizontal table scrolling. Desktop/mobile route checks. |
| QA-15 | Medium | Driver history/report KPIs, times and notification delivery labels could be invented. | Driver history, Admin reports/overview/live/notifications, `recordedReports.js`, date helpers | Use completed records and event timestamps; no invented punctuality without scheduled arrival evidence. Use Published/Saved, not delivered/read claims. Scheduled in-app notices publish once on a due-time fetch, not a fake immediate delivery. Actual India dates and bounded unavailable states. |
| QA-16 | Medium | Student notification preferences/read state could report local-only success. | Student profile/notifications, communications context, student API | Persist per-user preferences/read state; await saves and show errors; filter current user's notifications. API restart and browser failure/retry tests. |
| QA-17 | High | Empty production storage/check script could create demo state; simultaneous storage writes could lose data. | JSON/Mongo adapters, `store.js`, production checker | Fail closed for empty production, atomic JSON writes, Mongo revision checks. Checker is now configuration-only, never instantiates a store. Actual temporary Mongo concurrent-adapter/reopen/empty-production tests. |
| QA-18 | Medium | Settings switches implied backend permission/configuration updates and connected email/push delivery; demo audit records appeared genuine. | System settings context/page | Backend mode explicitly read-only, unsupported delivery disabled and sample audit log omitted. No false save success. This does not implement a general settings API or external alert delivery. |
| QA-19 | Medium | Student home claimed traffic delays were included without a traffic provider, showed a green GPS dot while waiting, and used pickup/campus-arrival labels for return journeys. The route sidebar hardcoded an evening departure. | Student dashboard/routes/profile, `StudentUI`, date helpers, scoped indicator CSS | Qualify approximate ETA, distinguish active trip from accepted GPS, show actual fix time, use direction-specific labels and stored departure time. Browser compares displayed labels/times/GPS state with backend data; greeting tests use Asia/Kolkata. |

Additional cleanup: removed unused GPS synchronization refs/helpers and unsafe static staff assignment helpers after tracing references. Kept route/test fixtures because they remain used by isolated seeds, existing tests and explicit development mode. No existing source/asset file was deleted speculatively. Development password substitution is excluded from production code paths. No new credential list was created.

Public help contacts were corrected to published institutional contacts, without inventing emergency coverage hours. Sources: [Indus contact page](https://indusuni.ac.in/contact-us.php) and [2025-26 student handbook](https://indusuni.ac.in/student/Student%20Information%20Handbook%20A.Y.%202025-26%20%281%29.pdf). University staff must confirm the current operational escalation contacts before rollout.

## Verification Results

Baseline: `npm run check` passed lint, 51 tests and build. A passing baseline did not cover the failures above.

Latest complete repository check: lint passed, **67 tests passed**, build passed. Main JavaScript chunk remains approximately 514 kB minified / 140 kB gzip and produces Vite's >500 kB warning. This is not a build error; low-end-phone and load performance are not certified.

`npm run check:production`: required local configuration is present. No database connection/mutation occurred. This does not prove that hosted environment values, database contents or mail delivery are correct. Secret values were not printed.

Actual temporary MongoDB: concurrent operations from two adapters, exact document reopening and empty-production guard passed. The reliability suite also passed all **12 tests** in this run: 11 API scenarios against MongoDB and the separately JSON-specific storage test. This is a real local MongoDB test, not a mocked adapter; Atlas outages, replicas, failover, backups and production load were not tested.

Browser evidence: **all 14 end-to-end scenarios passed** in `docs/qa/browser-results.json`. Separate contexts covered Student, Driver, Conductor, Admin and a new applicant. Five public pages and 33 role routes were rendered at 1440 px and 390 px: **76 page/width combinations**, plus workflow screenshots. There were no uncaught JavaScript errors or page-level horizontal overflows. Test positions are explicitly simulated, not real bus travel.

After the final student wording/indicator corrections, the public-page, role-page and mobile navigation groups were rerun separately; `docs/qa/browser-pages-results.json` records that final rendering pass. The full failure-injection run correctly logged deliberate 401/403/503 responses and blocked requests; these are expected negative-test evidence, not a claim of zero failed requests. Normal rendering/navigation produced no console warnings/errors or failed API responses. Map tile requests cancelled during navigation/zoom were recorded as `ERR_ABORTED`; loaded map tiles and route drawing dimensions were checked separately.

Passed browser workflows include login/direct access rejection, signup/captured OTP/pending/admin approval, outbound/GPS/passenger propagation, separate return run, emergency failure and lost-response retry, seat lost-response retry, session outage/recovery/revocation, complaint resolution, preferences failure/retry, map tile failure/retry, mobile navigation/back and GPS cleanup. This does not extend to untested administrative input combinations or external delivery providers.

The two changed older test expectations are intentional: approved-without-transport is distinct from pending; incomplete staff assignment no longer restores permissions from sample templates.

## Repeatable Local Testing

1. From the repository run `npm run check`.
2. Start `node Backend/scripts/qa-server.js`. It prints the local frontend/API and a new temporary data directory. Use a fresh instance for each complete browser run. Stop with Ctrl-C.
3. Run `QA_DATA_DIR='<printed-directory>' QA_PLAYWRIGHT_MODULE='<path-to-playwright/index.mjs>' node Backend/scripts/qa-browser.js`. Playwright with Chrome must be available separately; this audit used the desktop's bundled runtime and installed Chrome. Do not point this script at production. `QA_PAGES_ONLY=1` runs just the rendering/navigation subset on existing disposable data.
4. Mongo regression requires a separately available `mongodb-memory-server` module: `QA_MONGO_MODULE='<path-to-module/index.js>' node Backend/scripts/qa-mongo.js`. It creates and stops temporary loopback MongoDB. No dependency or lockfile was added to the app for these external QA tools.
5. Generic isolated QA logins are the original Student/Driver/Conductor/Admin fixtures in `Backend/seedData.js`. The presentation credentials document describes a different prepared dataset; Mahipal/Vraj are not automatically created by the fresh QA server. Never use any of these published passwords for production.

### Role and Workflow Checks

- Student: sign in, check assigned bus/route/stop, tracking and seat snapshot, submit a complaint, save preferences and reload. Use a newly registered QA student to see Pending, then approve and assign through Admin > Students. Test rejection with an existing session.
- Driver: complete the checklist, start the morning trip, permit foreground GPS, inspect accepted upload status, end the trip. Select Return and start again: it must have a different trip ID, no inherited GPS and zero initial passengers. Driver has no passenger editing UI.
- Conductor: select the current valid stop; submit boarded/deboarded counts. On the return trip enter actual campus boarding, then deboarding at each stop. Check 30 + 5 - 2 = 33 occupied and 17 available in a 50-seat bus. Retry a deliberately unconfirmed submission only with unchanged details/ID.
- Admin: approve/reject and assign the QA student; check live operations from a separate session; resolve the student's complaint and verify student visibility. Edit stop coordinates in the owning route and confirm other dashboards load the same point.
- Connectivity: block one browser's requests only, then restore. Failed writes must not show success; stale data must not gain a new event timestamp. New unverified access remains blocked. Existing server-approved data may remain visible with a warning until revalidation.
- Emergency: use only isolated QA. Verify Sending -> Saved by server. Fail the request and verify retained details and an error. Acceptance is not a dispatch, phone call or administrator acknowledgement.

## Remaining Limitations / Release Gates

1. **No blanket production certification.** The audit exercises important workflows and every listed route at two widths, not every conceivable input, browser, assistive technology or combination of concurrent actions. It is not a penetration test, accessibility certification or sustained load test.
2. **Real phone GPS remains unverified.** Test Android Chrome and iPhone Safari outdoors on the actual routes: permission denial, weak reception, internet loss, fresh-fix recovery, navigation, logout, phone sleep, app switching, screen lock and battery use. A web page cannot promise reliable locked-screen/background GPS. Never use these browser tests to claim that capability.
3. **ETA is approximate.** Remaining stop-segment geometry with a road-distance factor and usable speed is not a traffic-aware routing engine. Confirm physical stop coordinates, road paths and arrival error against actual journeys. Missing/stale/off-route/zero-speed data must remain unavailable/qualified, not a precise promise.
4. **Return geography is not separately modeled.** The current return direction reverses configured stops and uses direction schedules. Different roads, stop locations or pickup/drop-off policy require university confirmation and a reviewed route-model extension; reversing names alone does not prove correctness on the road.
5. **External emergency delivery is not connected.** The app saves an in-app alert; there is no tested SMS/push/telephone dispatch or acknowledgement workflow. Scheduled in-app publication occurs on polling, not an independent scheduler. Assign real responders and escalation procedures before operational reliance.
6. **Settings/audit are incomplete backend features.** General configuration/permission editing is explicitly read-only. A complete administrator audit trail and retention/export controls are not implemented. Student preference persistence is implemented and separate.
7. **Production credentials and initialization need review.** Published seed/presentation passwords may exist in a previously seeded production database; that possibility was not tested. An authorized administrator must review and rotate/disable affected accounts. Empty production databases now intentionally require reviewed provisioning/import. Existing installations must repair incomplete explicit staff route links in Admin; no access is inferred from sample assignments.
8. **Database scaling/operations.** MongoDB still uses one state document with bounded CAS retries. Test university-scale concurrency, document growth/size, recovery and backup restoration. JSON is not multi-process production storage. No production migration or cleanup was performed.
9. **Hosted configuration and delivery.** Confirm `NODE_ENV`, `SMARTTRANSIT_STORAGE`, MongoDB variables, `SMARTTRANSIT_ALLOWED_ORIGIN`, `VITE_USE_BACKEND`, `VITE_API_BASE_URL`, `SMARTTRANSIT_EMAIL_PROVIDER`, mail provider credentials, `SMARTTRANSIT_MAIL_FROM`, `SMARTTRANSIT_OTP_SECRET` and allowed signup domains in their correct hosting environments. `VITE_*` is public. Actual Brevo inbox delivery, deployed CORS/direct-route refresh and authenticated hosted flows were not tested.
10. **Further hardening.** OTP/login limits exist, but the current rate limiter is process-local; multi-instance enforcement needs separate work. Review request-body size limits, generic error disclosure, broader admin record validation/conflicting assignments, and race cases involving reassignment during active trips. No claim of comprehensive security coverage is made.
11. **Performance/accessibility.** Main bundle warning remains. Cold starts, slow mobile CPU/network, high concurrent polling, screen readers and full contrast/touch-target audits require staging measurement. Desktop Chrome at a mobile viewport is not a real iPhone/Android test.
12. **No production cleanup.** Unwanted live records were not inspected or deleted. Any cleanup needs a reviewed ID-filtered dry run, backup, preserved staff/account links and rollback plan. Do not run the presentation reset scripts as a deployment step.

## Documentation and Changed Files

Updated `README.md` and `BACKEND_INTEGRATION.md` to describe the actual HTTP/polling/opaque-session architecture, safe QA, server authority and unsupported features. Older planning/checklist documents are historical, not proof of production readiness. `DEPLOYMENT.md` contains pre-existing user edits and was not changed by this audit; its automatic production-seeding guidance is superseded by the fail-closed initialization policy above.

Main changes:
- Backend: `apiServer.js`, `dataStore.js`, `mongoDataStore.js`, `store.js`, `scripts/check-production-config.js`; targeted regression tests and isolated QA runners.
- Frontend reliability: `services/apiClient.js`, `services/authService.js`, new `services/backendConfiguration.js`, auth/context/hooks, Operations context and new `operations/gpsSync.js`.
- Data and presentation: Admin data/communications/settings contexts; staff emergency/history/trip pages; student tracking/preferences/notifications/help/complaints; Admin routes/stops/live/overview/reports/notifications/settings; shared maps; small CSS corrections and signup component fix.
- Reports/tests: new `services/recordedReports.js`, frontend regression tests, undefined-JSX lint rule, this report and sanitized QA evidence.

Recommended release decision: **proceed to a supervised staging test and deployment review after reviewing the diff and configuration; do not yet treat this as university production sign-off.** Nothing has been published by this audit.
