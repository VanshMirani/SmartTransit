# SmartTransit Final Submission Review

Date: 25 September 2026. Branch: `codex/coverage-audit-2026-09-25`.

This is a submission-polish pass on the existing application, not a new project or a production certification. Existing uncommitted audit fixes, the owner's `DEPLOYMENT.md` changes, and the independent OnePlus phone test were preserved. No production data, credentials, trips or hosting settings were changed in this pass.

## Changes And Evidence

| Finding | Type / impact | Fix | Verification |
| --- | --- | --- | --- |
| Driver guidance used `stops.slice(1, 5)` at every point in a trip | Source-confirmed / medium: next stop could be absent and later stops never appeared | Show the actual next stop and following stops in configured journey order | Unit cases cover first/late stops, return order, missing IDs and completed routes; browser checks compare to authoritative trip data |
| A reported speed of 0.5 km/h displayed as 1 km/h despite the stationary ETA state | Confirmed from OnePlus evidence and source / low: confusing explanation | Display `<1 km/h`, preserving unavailable ETA instead of fabricating arrival | Tests cover sub-1, zero, invalid speed and unavailable GPS |
| Mobile last-GPS timestamp appeared only below the map, after trip controls | Rendered / medium: freshness difficult to find | Display recorded GPS time directly below next-stop/arrival information on every viewport | Active-trip mobile screenshot and browser order assertion |
| Staff assignment initially said unavailable while still loading; a confirmed unassigned result still said loading | Source-confirmed / medium: wrong state | Separate loading, unassigned and failed-request messages; disable repeated refresh while pending; conductor refresh now displays its error | Both role sessions tested with delayed response, unassigned result, 503 and successful recovery |
| Tablet public navigation was crowded and hero actions extended beyond the copy column | Rendered / medium: overlapping controls | Collapse public navigation at 900px and wrap hero actions | Seven-width regression adds column containment and header non-overlap assertions |
| Raw `not-started` and lowercase mobile `trip` / `history` labels | Source-confirmed / low | Human-readable conductor status and explicit mobile labels | Role-page copy and navigation assertions |
| Pre-trip driver panels overflowed at 768px with 200% root text size | Reproduced / medium: horizontal scrolling and cramped controls | Panels stack according to available space and text size; no overflow masking or reduced type | Existing landscape/text-enlargement regression runs in both active and pre-trip states |
| Presentation notes called the implementation backend-ready/future database work and recommended resetting data | Source-confirmed / medium: inaccurate handover and unsafe advice | Describe the actual Node/MongoDB/polling implementation; use disposable QA data and captured email | Reviewed notes and checklist; no reset command was executed |
| Public copy was technical and claimed stops were already mapped without physical confirmation | Content correction / low | Concise commuter-focused copy, clear brand heading, honest route/stop wording, simpler save/recovery messages | Visible-copy search and public/role browser checks |
| Homepage presentation could be clearer without a theme change | Optional polish | Retain navy/teal/amber and Indus logo; fixed-size heading, quieter unframed highlights and compact mobile layout; remove unused decorative glow | Desktop/mobile/tablet screenshots; existing navigation/features retained |

## Verification Status

The baseline and first post-change `npm run check` runs passed. The post-change run contains **138 tests, zero failures/skips**, plus lint and build. The original baseline contained 136 tests.

Browser verification uses the existing `Backend/scripts/qa-staging.js` and `qa-browser.js`: a compiled frontend, loopback HTTPS, independent role contexts, disposable MongoDB and captured test mail. Synthetic GPS is confined to those isolated tests. No real email/emergency/production GPS was sent.

Final browser and build verification completed successfully; exact evidence is linked below. Intermediate runs are retained, not silently counted as passes. Two new test selectors were corrected: one expected the driver's card class on the conductor page, and one expected the conductor dashboard status on an intentionally unavailable-assignment screen. The assertions still verify the intended recovery states. A later pre-trip text-enlargement run reproduced real driver-panel overflow, which was fixed and retested without weakening overflow checks.

## Scope Preserved

- Authentication, approvals and assignments remain server-authoritative.
- Outbound/return trips, conductor-based counts, retry/idempotency, actual timestamps and cross-role polling remain intact.
- Simulator/preview labels, stale/offline warnings, unavailable ETA and saved-versus-delivered distinctions remain visible.
- No new dependency, framework, database migration, environment variable or shared password was introduced.
- No source file or user record was deleted. Only the confirmed unused hero-glow markup/style was removed.

## Files In This Pass

- `Frontend/src/pages/HomePage.jsx`, `Frontend/src/styles.css`
- `Frontend/src/operations/OperationsContext.jsx`, `Frontend/src/operations/gpsPresentation.js`
- `Frontend/src/pages/driver/DriverTripPage.jsx`, `Frontend/src/pages/conductor/ConductorHomePage.jsx`, `Frontend/src/components/staff/StaffLayout.jsx`
- `Frontend/src/components/admin/ManagementPage.jsx`
- `Frontend/src/pages/admin/AdminAssignmentsPage.jsx`, `AdminRoutesPage.jsx`, `AdminLiveOperationsPage.jsx`, `AdminSettingsPage.jsx`, `AdminSimulatorPage.jsx`
- `Frontend/tests/gpsPresentation.test.js`, `Backend/scripts/qa-browser.js`
- `README.md`, `FACULTY_PRESENTATION_NOTES.md`, `DEMO_CHECKLIST.md`, this report and the QA report index

Other dirty files predate this pass; they are not silently attributed to these changes.

## Local Review

The dedicated preview is `http://127.0.0.1:5188` while its local server remains running. It uses disposable data, not the live database. Use `docs/LOGIN_CREDENTIALS.txt` only for this isolated environment. Public/live accounts are deliberately not copied.

1. Open the homepage at desktop/tablet/mobile widths. Check branding, menu, sign-in, help and track links.
2. Driver: complete the checklist, start, allow GPS and inspect the next stop and recorded GPS time. Stationary GPS may correctly have no ETA.
3. Conductor: enter boarding/deboarding, verify bounds and check seats from another student/operator session.
4. Complete the morning trip and prepare a separate return; verify occupancy and location do not carry over.
5. Administrator: approve a test student, assign transport, edit a route stop and confirm it after refresh. Resolve a test complaint.
6. Use the isolated simulator only as labelled simulation. Do not send real emergency reports during presentation.

## Remaining Limits

- This pass is local. No new code is live until a separately approved publication/deployment succeeds.
- The earlier OnePlus test confirmed one real phone fix reaching the server. Continuous travel, screen lock/background and real-network recovery remain unverified.
- Two IU-R9 pickup pins were confirmed by the owner in the earlier handover; 157 other entries are not physically certified. ETA is approximate geometry/speed, not road/traffic navigation.
- Earlier controlled university email receipt and encrypted application-state restore evidence remain in the handover report; they were not repeated in this pass. Recovery for demo-address accounts and off-device disaster recovery remain operational tasks.
- Automated accessibility and viewport checks are not a claim of full WCAG compliance, a screen-reader audit, or real iPhone/Firefox/Safari coverage.
- Full administrative audit history and automated phone/email service notices are not implemented by these cosmetic changes; read-only settings honestly state those limits.

## Publication And Rollback Checklist

1. Review this diff alongside the pre-existing audit changes; obtain approval for the intended branch/deployment.
2. Re-run checks, keep secrets/private snapshots out of Git, and confirm frontend HTTPS API URL, CORS origin and persistent MongoDB settings by variable name without disclosing values.
3. Verify the approved preview's public page, role sign-in, deep-link refresh, map tiles and API responses before promoting it. Do not reset production data.
4. Record the previous frontend/backend release IDs. For a code regression, restore those releases. This pass requires no schema migration; database restoration is a separate reviewed operation.

## Final Results

- **Final source check:** `npm run check` passed lint, **138 tests**, zero failures/cancellations/skips, and the production build. [Command output](qa/2026-09-25-submission-verified/checks.log).
- **Functional browser run:** **29 of 29 scenario groups passed**, using separate role sessions, compiled frontend, loopback HTTPS, captured email and disposable MongoDB. This includes registration/approval, authorization rejection, outbound/return journeys, GPS upload/error handling, cross-role counts, lost-response retries, emergency failure/retry, complaint resolution, preferences and exports. The MongoDB adapter reopened with an exact state comparison. [Results](qa/2026-09-25-submission-verified/browser-results.json).
- **Final presentation retest:** **12 of 12 groups passed** against the final layout, status-copy and mobile-label changes made after the functional run. All **40 public/role pages** were rendered at **320, 360, 390, 430, 768, 1024 and 1440 CSS pixels**. Landscape, 200% root-text enlargement, keyboard menu focus, assignment-loading recovery, direct links and map-navigation cleanup also passed. The MongoDB reopen comparison passed again. [Results](qa/2026-09-25-submission-layout-final/browser-pages-results.json). This retest does not claim to rerun the workflows skipped by `QA_PAGES_ONLY=1`.
- **Browser errors:** zero uncaught page exceptions in either successful run. Ordinary all-role navigation had no console errors; cancelled map requests during navigation were recorded. Deliberately injected failures and denied requests produced expected console/network errors, retained in the evidence rather than suppressed.
- **Accessibility:** 100 automated scans in the functional run and 83 in the final presentation run found zero automated violations. There were respectively 71 and 53 incomplete rule results requiring human judgement; this is not a full accessibility certification. [Functional scans](qa/2026-09-25-submission-verified/accessibility.json), [final scans](qa/2026-09-25-submission-layout-final/accessibility.json).
- **Visual evidence:** 310 functional-run screenshots and 292 final-presentation screenshots were saved locally under their corresponding `docs/qa/` folders. They contain isolated fixture records, not production passwords, OTPs, tokens or real phone locations. Desktop/mobile/tablet homepage and enlarged driver layout were also inspected visually. PNG evidence is ignored by Git by the existing repository rule; JSON results remain reviewable.
- **Copy and diff checks:** visible page copy rejects unfinished terms in the browser regression. Source review found no backend-ready/frontend-only/coming-soon/under-development wording in the reviewed public/role components or presentation documents. Ordinary input `placeholder` attributes are intentional. `git diff --check` passed.

Useful local screenshots: [homepage desktop](qa/2026-09-25-submission-layout-final/public-home-1440.png), [homepage mobile](qa/2026-09-25-submission-layout-final/public-home-390.png), [driver enlarged text](qa/2026-09-25-submission-layout-final/driver-text-200.png).

Commands used for the browser runs, with tool dependency paths supplied by this machine's existing QA setup:

```bash
QA_FULL_MATRIX=1 QA_RUN_NAME=2026-09-25-submission-verified node Backend/scripts/qa-staging.js
QA_FULL_MATRIX=1 QA_PAGES_ONLY=1 QA_RUN_NAME=2026-09-25-submission-layout-final node Backend/scripts/qa-staging.js
```

The actual launches used an empty inherited environment plus `PATH`, `HOME`, `TMPDIR`, `QA_MONGO_MODULE`, `QA_PLAYWRIGHT_MODULE` and `QA_AXE_PATH`. No deployment `.env` file was loaded. These dependency-path variables identify local QA tools, not production services.

**Outcome:** the tested local build is suitable for the documented faculty demonstration and an approved deployment review. This pass was not pushed, merged or deployed. No new production configuration is required by these changes; existing operational limitations above remain explicit.
