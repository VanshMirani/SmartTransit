# SmartTransit Findings

Current round: 2026-09-25, base `3a95672`, local branch `codex/coverage-audit-2026-09-25`. No push, merge or deployment performed. FIXED-RETESTED below describes local evidence only, never the live website.

| ID | Severity | Finding | Classification / status |
| --- | --- | --- | --- |
| F01 | High | Stale full admin route/record saves overwrote newer edits. | FIXED-RETESTED for versioned current forms; legacy limitation below |
| F02 | Medium | CSV text could be interpreted as a spreadsheet formula. | FIXED-RETESTED (export-byte regression) |
| F03 | Medium | PDF export silently omitted rows after line 40 and truncated escaped strings. | FIXED-RETESTED (pagination/escaping regression and browser download) |
| F04 | Medium | Daily on-time chart denominator differed from the KPI. | FIXED-RETESTED (calculation regression) |
| F05 | Medium | Management save errors were hidden behind the open modal. | FIXED-RETESTED (browser conflict/retry flow) |
| F06 | Medium | Driver start/end dialogs did not contain/restore keyboard focus or close on Escape. | FIXED-RETESTED (browser keyboard checks) |
| F07 | Medium | Long conductor stop lists overflowed; compact staff sidebar icons disappeared. | FIXED-RETESTED (six widths and enlarged-text evidence) |
| F08 | Medium | Sessions with unverifiable lifetime metadata remained valid indefinitely. | FIXED-RETESTED (JSON and MongoDB API tests) |
| F09 | Medium | Read-only report tables could not receive keyboard focus for horizontal scrolling. | FIXED-RETESTED (browser and axe) |
| F10 | Medium | Frontend-host API paths returned SPA HTML with HTTP 200. | FAIL on live; local routing correction tested as a matcher, hosted retest BLOCKED pending deployment approval |
| F11 | Low | Logo loading shifted mobile login/home content because image space was not reserved. | FIXED-RETESTED (blocked-image browser assertion and local production-build timing samples) |
| R01 | Critical, resolved exposure | Published fixture admin/student/conductor passwords were still valid. | FIXED-LIVE-VERIFIED: three owner-approved rotations, 103 stored sessions revoked, old passwords rejected; email recovery still needs an owner process |
| R02 | Medium | Render Node 20 versus Vercel/local Node 24. | Source/host-confirmed; runtime upgrade requires approval |
| R03 | Medium | Full administrative actor/time audit history and return-specific road geometry are not implemented. | Requirement gaps, not safe to invent policy/schema |
| R04 | High release gate | Real-phone GPS, remaining pickup validation and full disaster recovery remain incomplete. | PARTIAL: backup/restore and one owner-confirmed inbox delivery passed; two supplied stop pins applied live; USB authentication and 157 pickup confirmations pending |

## Reproduction, Fix And Retest

### F01: Stale Administrative Edits

Two local admin sessions read the same route. Session A saves a new name; session B saves its old full form with another change. Before: both responses were 200 and A's name disappeared. Expected: B receives a conflict and can review the newer state. Reproduced by the regression test before patching.

`Backend/apiServer.js` now returns an ephemeral `_version` derived from stored master data, checks supplied versions inside the serialized/CAS mutation, and returns 409 on conflict. GPS projection changes do not invalidate master-data drafts. `_version` is removed before persistence; no database migration. `assignmentDrafts.js` and `AdminAssignmentsPage.jsx` retain the read version while an assignment draft is dirty.

Retest: `stale admin route and record forms cannot overwrite a newer saved edit`, dirty-draft unit test, JSON suite, temporary MongoDB suite and independent browser bus-edit conflict all pass. Screenshot: `qa/2026-09-25-coverage-verified/admin-edit-conflict.png`.

Compatibility boundary: clients that omit `_version` retain old behavior. This is not a universal mandatory precondition. Before enforcing it globally, approve a coordinated client/backend compatibility policy. Deleted-record resurrection and every combination of concurrent administrative actions remain NOT TESTED.

### F02: CSV Formula Interpretation

Call the existing export helper with `=1+1` as text. Before: the quoted CSV cell still began with a formula marker. Quoting alone does not make formula text inert. `Frontend/src/utils/reportExport.js` prefixes risky string cells with an apostrophe, including whitespace/BOM and full-width prefix variants. Numeric values stay numeric; quotes, delimiters, line breaks and UTF-8 are retained.

Retest: `reportExport.test.js` failed before, passes after; browser downloads remain functional. Actual Excel/LibreOffice import behavior is NOT TESTED. Reference: [OWASP CSV injection](https://community.owasp.org/attacks/CSV_Injection).

### F03: Truncated PDF Reports

Export 90 rows plus a long parenthesized line. Before: row 90 was absent, and slicing after escaping could consume a PDF delimiter. The helper now wraps before escaping, generates multiple page/content objects and includes page numbers. Regression checks all rows, final text, three pages and escaped delimiters; browser confirms a PDF download.

Remaining limitation: the existing Helvetica/ASCII PDF renderer still strips unsupported Unicode. No full font internationalization, PDF-reader matrix or arbitrary long-glyph layout certification is claimed. CSV preserves Unicode and is preferable for lossless data export. Current report exports contain fixed categories/codes, not a general multilingual student directory.

### F04: Inconsistent On-Time Percentage

Source-confirmed example: one measured on-time journey and one journey with no dated target produced 50% in the daily chart but 100% in the KPI. `dailyPerformance()` in `recordedReports.js` now divides by measured journeys, preserves unknown days as null and sorts dates. `AdminReportsPage.jsx` consumes it. Regression verifies mixed/unknown days and agreement with route summaries. Missing actual target dates are still unavailable, not invented.

### F05: Invisible Save Failure

Open Admin > Buses > Edit, change that bus through a second local admin session, then save the old form. The 409 message was rendered outside the modal and could not be seen inside it. `ManagementPage.jsx` now renders feedback within the open editor, retains values, prevents closing during an outstanding save and associates field errors with inputs. Browser verifies create/search/filter/sort/view, stale edit, visible error, retained input, cancel, refreshed newer value and permitted deletion of only the fixture.

### F06: Driver Confirmation Keyboard Handling

Before patch: opening the start confirmation left focus outside; pressing Escape left the dialog open. `useDialogFocus.js` focuses and contains keyboard interaction, supports Escape and restores focus. It is applied to the existing start/end dialogs without changing their layout or trip logic. Closing during a pending transition remains guarded.

Retest: browser checks focus, Shift+Tab containment, Escape, focus return, reopening, start and end. Screen-reader speech output and every assistive technology remain NOT TESTED.

### F07: Conductor Reflow And Blank Sidebar Actions

At 768 CSS pixels with root text enlarged to 200%, a 14-stop route overflowed the page; labels collided. The same compact sidebar rendered empty emergency/logout controls because their SVG dimensions inherited zero-size text.

`styles.css` now constrains the conductor grid, keeps the stop list scrollable within its panel at every breakpoint, allocates a readable minimum stop width, and gives those two icons stable dimensions. No body-level overflow hiding was added. Reproduced failure: `qa/2026-09-25-coverage-staging/conductor-text-200.png`; corrected: `qa/2026-09-25-coverage-verified/conductor-text-200.png`. Browser asserts icon dimensions and no page overflow across six widths, landscape and enlarged text. This is text enlargement, not real-device testing or true browser zoom.

### F08: Invalid Session Lifetime

In an isolated stored session, remove both expiry and creation metadata (or make both invalid). Before: `/auth/session` returned 200. Expected: an unverifiable lifetime cannot authorize indefinite access. `sessionExpired()` now fails closed when neither a usable expiry nor bounded creation time exists. A legacy session with a valid creation time still expires according to configured duration. Current valid sessions are unchanged.

The new test failed 200 vs 401 before the one-line change and passes in JSON and real temporary MongoDB. Logout, normal expiry, reset/revocation and temporary frontend outage regressions remain passing. No production sessions or credentials were modified.

### F09: Report Table Keyboard Access

The full width matrix found a serious axe `scrollable-region-focusable` violation on `/admin/reports` at 320 pixels with actual completed-trip data. Report tables had no interactive children and no tab stop. All three report table variants now have labelled region semantics and `tabIndex=0`. Browser focuses the complaint table, presses ArrowRight, and reruns the full page matrix. The final 58 axe scans report zero violations; 37 scans still have incomplete checks requiring human review. This is not WCAG certification.

### F10: API/Asset Fallback Routing

One read-only GET to `https://smart-transit-lyart.vercel.app/api/qa-unknown` returned 200 `text/html` containing the React root. `vercel.json` matched every path. A local negative-lookahead rewrite now excludes `/api`, `/api/*`, `/assets` and `/assets/*`, retaining normal/deep/unknown page routing. No proxy, backend origin or hosting setting was changed.

`deploymentRouting.test.js` fails against the old matcher and passes after. The browser's existing non-JSON API protection remains unchanged. Local Vite does not implement Vercel rewrites, so actual hosted HTTP behavior is NOT VERIFIED until an approved preview/release. An unknown UI page still intentionally renders a visual 404 over a SPA HTTP 200. Syntax follows [Vercel rewrite configuration](https://vercel.com/docs/project-configuration/vercel-json).

### F11: Logo Layout Movement

At 390 pixels, blocking the logo request left a 230x60 image box instead of its square space. Twelve local production-build samples before the fix recorded maximum observed layout shifts of 0.1630 on home and 0.2247 on login. The actual JPEG is 1254x1254; `Brand.jsx` now declares those intrinsic dimensions while retaining existing CSS sizing, branding and layout.

Retest: the browser scenario blocks the image, asserts its square space, then restores the image and reloads. A separate twelve-sample run observed maximum shifts of 0.0328 on mobile home and 0.0017 on mobile login. Evidence: `qa/2026-09-25-coverage-performance-after/performance-samples.json` and `logo-space-restored.png` in the final browser run. These are unthrottled loopback measurements with other QA possibly running, not field Core Web Vitals or a Lighthouse score; startup timings varied and are not claimed as a speed improvement.

## Open Risks And Limits

- **R01, exposure resolved with remaining recovery limitation:** the owner explicitly authorized rotation/private handover after current live admin and stored student/conductor fixture matches were confirmed. Exactly those three accounts received new random passwords; 103 stored sessions and targeted outstanding reset challenges were revoked. Old passwords return 401, new credentials return 200, a pre-rotation token returns 401, and successful verification sessions were logged out. A final database comparison shows zero published-fixture matches. Emails/roles/assignments/history stayed intact. The uncontrolled demo inboxes still lack reliable self-service recovery; no provider-secret rotation is claimed. See [handover evidence](PRODUCTION_HANDOVER_2026-09-25.md).
- **R02:** runtime declarations/Render Node 20 versus tested Node 24 need an approved, tested hosting alignment. No runtime upgrade was performed.
- **R03:** complete admin actor/time audit history, contractor-specific scope and independent return-road definitions are not implemented. University policy is needed before adding these capabilities.
- **R04:** encrypted live application-state snapshots, including a final post-rotation copy, restored exactly into disposable MongoDB after reconnect. Production was not restored/restarted; off-device retention and full disaster recovery are unverified. The OnePlus screenshot shows pending USB authorization, so no phone GPS result is claimed. Gmail was rejected before delivery by the university-domain rule; one subsequently approved university-inbox request returned 200 and the owner confirmed Inbox receipt. Authentication headers/delivery SLA remain untested. Two supplied IU-R9 references were applied and verified; 157 pickup entries remain unconfirmed. Real-device background behavior, provider outages and load capacity are still unverified.
- **R05, source-confirmed:** PDF Unicode limitation described in F03; do not claim arbitrary multilingual PDF fidelity.
- **R06, source-confirmed:** some admin mutations still merge full record bodies rather than rejecting every unknown field. Non-admin access is rejected, but a full field allowlist and every malformed payload permutation are not signed off. No demonstrated privilege escalation is claimed.
- **R07, source-confirmed:** rate limiting is process-local; MongoDB uses one application-state document. Small concurrent-writer tests pass, not unlimited scaling or document-growth/retention safety.
- **R08:** CSP remains report-only and broad HTTPS sources remain allowed; this does not provide enforced CSP/XSS or clickjacking protection. Tightening and provider compatibility require an approved deployment review. Browser-stored bearer-token XSS exposure remains an architecture risk, not silently replaced.
- **R09:** stale form preconditions are optional for backward compatibility. Make them mandatory only with coordinated deployment/API policy.
- **R10:** map panning/follow policy, nearby parallel roads/diversions, map search/geocoder failure/rate policy and provider production SLA require additional review. No physical stop pin was guessed or changed.
- **R11:** wrong content-type handling, exhaustive mass-assignment/prototype-pollution permutations, multitab account-switch races, long-duration leak tests, real browser zoom/virtual keyboard and every control's universal failure matrix remain NOT TESTED. These are explicit coverage gaps, not passes.

## Standards Consulted

Review targets, not certifications: [WCAG 2.2 recommendation](https://www.w3.org/TR/2024/REC-WCAG22-20241212/), [OWASP WSTG 4.2](https://wstg.owasp.org/v4.2/), ASVS 5.0.0 [session management](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md), [authorization](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md) and [validation/business logic](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x11-V2-Validation-and-Business-Logic.md). No ASVS assurance level or penetration-test sign-off is claimed.
