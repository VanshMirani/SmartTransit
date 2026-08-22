# SmartTransit frontend implementation plan

## Source audit

- Repository state at start: no application code or Git history; one reference PDF only. Nothing needed preservation.
- Product source of truth: the SmartTransit SRS and UI Reference / Codex Build Brief supplied by the user.
- Visual direction: navy `#102A43`, teal `#16A6A1`, saffron `#FFB547`, cool-gray surfaces, semantic green/amber/red, 8px spacing rhythm, 44px targets.
- Architecture direction: React + Vite + JavaScript/JSX, reusable role-aware shells, structured services, backend-ready API boundaries, and Leaflet/Recharts integration.

## Page and workflow checklist

- [x] Public homepage: header, hero, product preview, features, safety/privacy, help, footer
- [x] Authentication: student sign-up, role selector, login, forgot password, validation, protected routes, logout, redirects
- [x] Student: home, tracking, routes/stops, alerts, complaint form/history/detail, profile/preferences, help/emergency
- [x] Driver: home/assignment, checklist, start confirmation, active trip/GPS, route guidance, emergency, end confirmation, history, profile
- [x] Conductor: home, active trip/stops, current stop, boarded/deboarded update, history, emergency, profile
- [x] Admin overview: KPIs, fleet map, alerts, occupancy, activity
- [x] Live operations: fleet list/map, statuses, emergency banner
- [x] Management: buses, routes, stops, drivers, conductors, students, assignments; CRUD, search/filter/sort/page, dialogs and feedback
- [x] Routes and stops: details, ordered timeline, create/edit, schedule, map preview, assignments and status
- [x] Notifications: composer, targeting/schedule/preview, history/delivery; student notification styles
- [x] Complaints: student submission/status/resolution; admin summary/list/detail/timeline/notes/assignment/resolution
- [x] Reports: delay, complaints, route usage, on-time performance, filters, KPIs, charts, tables, PDF/CSV controls
- [x] Settings: roles/permissions, GPS/stale threshold, notifications, privacy, audit log
- [x] System states: loading, empty, offline, server error, permission denied, stale GPS, no trip, cancelled, changed, emergency success, form success/error, no results
- [x] Final integration: role authorization, responsive/a11y verification, backend-ready API mode, lint/tests, README and demo accounts

## Shared system and data plan

- Foundations: CSS variables, typography/spacing/radius/shadow scales, accessible focus and motion rules.
- Primitives: Button, Input, Select, Card, Badge, Alert, Modal, Table, Skeleton and StatePanel.
- Layout: PublicHeader/Footer, MobileBottomNav, StudentShell and AdminShell.
- Domain components: BusSummary, MapPanel, RouteTimeline, SeatMeter, GPSStatus, NotificationCard, ComplaintStatus, KPI card and responsive charts.
- Typed models: User/Role, Bus, Route/Stop, Trip/Location, SeatUpdate, Notification, Complaint and AuditEvent.
- Services: local data adapters and API-ready boundaries first; HTTP/WebSocket adapters can replace them without changing page components.

## Delivery phases

1. Public homepage
2. Authentication and authorization
3. Student experience
4. Driver experience
5. Conductor experience
6. Admin core and management
7. Route/stop builder
8. Notifications
9. Complaints
10. Reports
11. Settings and system states
12. Integration, accessibility, testing, documentation

Each phase is built, run, checked at relevant viewports, linted/built, recorded here, and presented for user review before the next phase.

## Phase completion log

### Phase 1 - Public homepage (complete, 20 August 2026)

- Built the responsive public header, hero and realistic mobile tracking preview.
- Added live location, ETA, seat availability and instant alert feature cards.
- Added journey context, safety/privacy, help/contact and responsive footer sections.
- Connected homepage actions to `/track`, `/login`, `/help` and `/privacy`; later-phase routes have intentional staging screens instead of broken links.
- Verified at 375x812, 768x1024 and 1440x900: no horizontal overflow; mobile/tablet/desktop grids and navigation behave correctly.
- Verified the mobile menu, Track My Bus and Sign In route transitions, and found no browser console warnings/errors.
- ESLint and the production Vite build pass.

### Phase 2 - Authentication (complete, 20 August 2026)

- Added mock JWT-ready authentication service, session persistence and typed role/user models.
- Built role-aware login for Student, Driver, Conductor and Admin/Operator with demo credentials.
- Added password visibility, forgot-password success/error states, field validation, invalid-credential feedback and loading behavior.
- Added protected routes, permission-denied handling, role-based redirects and logout.
- Verified all four role destinations plus protected-route redirection in the browser.

### Phase 3 - Student application (complete, 20 August 2026)

- Built responsive student shell with desktop sidebar, tablet rail and five-item mobile bottom navigation.
- Built home dashboard with assigned bus/route/stop, status, next stop, ETA, seat counts, update timestamps, notifications and emergency shortcut.
- Integrated Leaflet/OpenStreetMap with bus marker, route line, stops, selected stop, speed, ETA and GPS timestamp.
- Added interactive live, stale GPS, offline and no-active-trip tracking states.
- Built route timeline, typed notification cards and filters, complaint creation/history/status/resolution, profile/preferences and help/emergency pages.
- Verified forms, complaint IDs, route data, notification filters, preference saving and emergency contact links.
- Verified all student pages at 375x812, 768x1024 and desktop widths with no horizontal overflow and no browser console warnings/errors.
- ESLint and the production Vite build pass.

### Phase 4 - Driver application (complete, 21 August 2026)

- Built a mobile-first driver shell with desktop/tablet navigation, home assignment, conductor contact, history and profile.
- Added a six-item pre-trip checklist; the start control remains disabled until every safety item is confirmed.
- Added start confirmation and explicit privacy messaging before GPS sharing begins.
- Built the active-trip view with Leaflet route guidance, next stop, ETA, speed, distance, GPS status and last-update time.
- Limited active-trip controls to route guidance, emergency and trip completion; no seat-count controls exist in the driver application.
- Added Breakdown, Accident, Medical, Traffic Block and Other emergency options with automatic location attachment and acknowledgement.
- Added end-trip confirmation; completing a trip immediately changes GPS to Not sharing.
- Verified the complete start/GPS/emergency/end lifecycle plus phone, tablet and desktop layouts without horizontal overflow.

### Phase 5 - Conductor application (complete, 21 August 2026)

- Built a mobile-first conductor shell, active-trip home, bus/driver context, stop progress, history, profile and emergency workflow.
- Added current-stop selection and 44px boarded/deboarded steppers.
- Implemented `occupied = previous occupied + boarded - deboarded` and `available = capacity - occupied` in the shared operations service.
- Enforced zero/capacity bounds, non-negative counters, disabled invalid controls and guarded service validation.
- Prevented accidental duplicate submissions by disabling during submission, resetting counters after success and requiring a new non-zero change.
- Added confirmation feedback and a timestamped seat-update history; verified `30 + 5 - 2 = 33 occupied / 17 available`.
- Added conductor emergency reporting with automatic trip location attachment.
- Verified all conductor workflows plus phone, tablet and desktop layouts without horizontal overflow.
- Both phases pass ESLint, the production Vite build and browser console checks.

### Phase 6 - Admin / Transport Operator dashboard (complete, 21 August 2026)

- Built the protected desktop operator shell with responsive sidebar, top bar and routes for every administration area.
- Added overview KPIs, live Leaflet fleet map, delay and stale-GPS alerts, occupancy summary, activity stream and timestamps.
- Built live operations with searchable/filterable fleet states, map selection, route/driver/speed/ETA/occupancy/GPS details and an emergency banner.
- Added reusable management tables for buses, stops, drivers, conductors and students with search, status filters, sorting, pagination, add/view/edit, duplicate validation and confirmation dialogs.
- Added route assignment controls plus functional operator foundations for notifications, complaints, reports, settings, roles, privacy and audit history; their dedicated later phases will expand these areas.
- Integrated responsive Recharts report visualizations and split chart/map/vendor bundles for a clean production build.
- Verified desktop and tablet layouts, the mobile navigation drawer, table-contained scrolling, 44px touch targets, form feedback and protected admin login.

### Phase 7 - Routes and stops (complete, 21 August 2026)

- Built route list/search/detail views with active/inactive status, ordered stop timelines and Leaflet/OpenStreetMap previews.
- Added create/edit route forms for code, name, start, destination, bus, driver and conductor assignments.
- Added inline stop editing, readable scheduled arrival times, add/remove controls and accessible up/down reordering.
- Added validation for required route fields, unique route codes, valid stops and a minimum two-stop route.
- Verified add/remove/reorder/save flows and responsive map/form layouts at mobile, tablet and desktop sizes.
- ESLint and the production Vite build pass without warnings.

### Phase 8 - Notifications (complete, 21 August 2026)

- Added a shared typed communications data layer so operator delivery and student receipt use the same mock records and can later be replaced by HTTP/WebSocket adapters.
- Built the full operator composer for Delay, Route Change, Cancellation and General Announcement messages.
- Added all-student or selected-route targeting, send-now and schedule-for-later controls, validation, loading, success and failure feedback.
- Added a live mobile preview with clear type-specific styling and recipient context.
- Built notification history with delivered, scheduled and failed states, recipient/delivery counts and status filtering.
- Updated the student alert center with actual unread state, type filters, route context, empty results and mark-all-read behavior.
- Connected student navigation badges and dashboard recent alerts to the shared notification state.
- Verified an operator Route R-3A announcement appeared immediately in the matching student account.

### Phase 9 - Complaints and feedback (complete, 21 August 2026)

- Expanded the student complaint form with category, related bus/route, subject, description, validation, loading/error feedback and generated complaint IDs.
- Added student summary counts, search, status filtering, expandable history, detailed status timelines and transport-office resolution replies.
- Built the operator complaint summary, multi-filter search bar, complaint table and no-results state.
- Added student, route, bus and trip context; assignment controls; internal notes; timeline events; status updates and resolution validation.
- Added a dedicated mark-as-resolved workflow that requires a student-facing response.
- Verified the complete cross-role lifecycle: student submission, operator assignment/note/resolution and student-visible resolved status/reply.
- Verified both phases at mobile, tablet and desktop sizes with contained table scrolling and no page-level horizontal overflow.

### Phase 10 - Reports (complete, 21 August 2026)

- Built Overview, Delay, Complaint, Route Usage and On-time Performance report views over a realistic typed mock dataset.
- Added controlled 7-day, 14-day and custom date ranges plus per-route filtering; KPIs, charts and tables update from the same filtered records.
- Added responsive Recharts line and bar charts for daily trip, delay, on-time and student-journey trends.
- Added route-level and daily report tables with a dedicated no-results state and contained horizontal scrolling on small screens.
- Implemented working CSV and lightweight PDF downloads generated from the active report, date range and route selection.
- Verified filter changes, complaint reporting, an empty R-111 selection, disabled empty exports and both download controls in the browser.

### Phase 11 - Settings and system states (complete, 21 August 2026)

- Added shared controlled settings for active-trip GPS intervals, stale-GPS thresholds, warning visibility and operator notification preferences.
- Built an editable role-permission matrix with fixed safety restrictions: drivers cannot receive seat-count controls and system settings remain operator-only.
- Added validation, asynchronous save feedback and automatic timestamped audit events; audit history supports search and category filtering.
- Added a dedicated privacy surface documenting active-trip-only driver location, authorized viewers, stale-data handling and audit safeguards.
- Built a reusable state component and operator preview library for all 13 required states: loading, empty, offline, server error, permission denied, stale GPS, no active trip, trip cancelled, route changed, emergency submitted, form success, validation failure and no search results.
- Verified settings persistence within the admin session, permission changes, audit creation/search, privacy copy and representative state actions.
- Verified both phases at 375x812, 768x1024 and 1440x900 with no page-level horizontal overflow or browser console errors.
- ESLint and the production Vite build pass without warnings.

### Phase 12 - Final integration and verification (complete, 21 August 2026)

- Audited and connected every public, student, driver, conductor and operator route; removed obsolete staging pages and added complete privacy and 404 experiences.
- Verified protected-route denial, signed-out authentication redirects, signed-in Track/Help destinations and logout for every role shell.
- Added a functional operator global search across routes, buses, stops and people; account navigation now opens settings.
- Enforced operator-side active-trip location privacy: inactive vehicles show `Not sharing` and have no live map marker.
- Completed formerly decorative controls for student account links, map recentering and emergency-alert acknowledgement.
- Added unique route-code and complete assignment validation.
- Extracted the seat calculation into a tested domain utility and added seven passing Node tests for seat boundaries and report aggregation.
- Raised shared gray/teal color tokens to verified WCAG contrast samples of 4.91:1 or higher for normal text and primary buttons.
- Verified representative layouts at 375x812, 768x1024 and 1440x900 with 44px navigation/counter targets, contained tables and no page-level horizontal overflow.
- Verified every role page in the browser with no console errors or warnings.
- Added `README.md` with setup, commands, architecture, privacy rules and all demo accounts, plus `FINAL_CHECKLIST.md` with the final page/feature audit.
- ESLint, tests and the production Vite build pass without warnings or errors.

### Student sign-up enhancement (complete, 21 August 2026)

- Added a public student account-creation route linked from the homepage header, footer and sign-in page.
- Added verified institute-email, OTP, phone, password-strength, confirmation and privacy-consent validation.
- Moved student account creation behind backend OTP verification so newly created accounts are persisted by the API.
- Kept driver, conductor and operator account provisioning restricted to the transport office.
- Added registration validation tests and responsive browser verification.

### Institute email OTP signup update (complete, 22 August 2026)

- Removed mandatory enrollment-number validation from student signup because formats vary by year, institute and branch.
- Added institute email validation for addresses such as `name@iite.indusuni.ac.in`.
- Added OTP request and verification before account creation through the backend API.
- Connected OTP delivery to real Gmail/SMTP settings, removed frontend OTP exposure and stored only hashed OTPs with expiry.

### JavaScript / JSX conversion (complete, 21 August 2026)

- Converted every React application module from `.tsx` to `.jsx` and every pure service, utility and test module from `.ts` to `.js`.
- Removed TypeScript types, compiler configuration, compiler build steps and TypeScript dependencies.
- Updated the Vite entry point, ESLint configuration, test command, documentation and production bundle for JavaScript-only development.
- Re-ran linting, all 11 JavaScript tests, the production build and browser smoke verification.

### Backend-ready completion and presentation hardening (complete, 22 August 2026)

- Added a local Node.js API for authentication, student transit data, complaints, communications, admin bootstrap data, management updates, driver trip actions, conductor seat updates and staff emergencies.
- Added JSON persistence with `Backend/data/smarttransit-db.json` and seed data for the full Indus University route demo.
- Connected frontend authentication, student, communications, admin and staff operation layers to use backend calls when backend mode is enabled.
- Added `npm run dev:full` for frontend plus API, `npm run reset:data` for clean demos and `npm run check` for lint/test/build verification.
- Improved local startup so the API automatically chooses the next free port when the default port is busy.
- Updated the homepage phone preview, privacy copy and current-date labels so the app feels presentation-ready rather than stale.
- Added `BACKEND_INTEGRATION.md`, `DEMO_CHECKLIST.md` and `FACULTY_PRESENTATION_NOTES.md`.
- Verified all 15 tests, ESLint, production build, browser role flows, desktop/mobile layouts and console cleanliness.
