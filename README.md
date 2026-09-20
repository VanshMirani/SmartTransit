# SmartTransit

SmartTransit is a responsive college transportation frontend for Indus University. It provides:

- a mobile-first student, driver and conductor application;
- a responsive student website;
- a desktop-first transport-operator dashboard;
- realistic Indus University route data behind replaceable service/context boundaries;
- an included local Node.js API for backend-ready testing;
- MongoDB-ready production storage for public deployment.

Current verified results and remaining limitations are in [docs/QA_AUDIT_REPORT.md](./docs/QA_AUDIT_REPORT.md). Older checklists and [PROJECT_PLAN.md](./PROJECT_PLAN.md) describe earlier milestones, not production certification.
The live-site findings and subsequent local remediation status are recorded in [docs/LIVE_REVIEW_REPORT.md](./docs/LIVE_REVIEW_REPORT.md). Local fixes are not proof that the hosted deployment has been updated.
Faculty-facing explanation notes are available in [FACULTY_PRESENTATION_NOTES.md](./FACULTY_PRESENTATION_NOTES.md).
Use [DEMO_CHECKLIST.md](./DEMO_CHECKLIST.md) before a live presentation.
Use [DEPLOYMENT.md](./DEPLOYMENT.md) when you are ready to host the real frontend and backend.

## Technology

- React 19 with JavaScript/JSX and Vite 6
- React Router
- structured CSS with configurable design tokens in `Frontend/src/styles.css`
- Lucide icons
- Leaflet with OpenStreetMap tiles
- Recharts
- Node’s built-in test runner for domain tests

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. If the terminal says port `5173` is already in use, stop the old SmartTransit terminal and run the command again.

To run the frontend with the included local API:

```bash
npm run dev:full
```

This starts the API on `http://127.0.0.1:5050/api` when available and the Vite frontend on `http://localhost:5173`. If API port `5050` is busy, the script automatically uses the next free API port and connects the frontend to it.

For a disposable test environment, use `node Backend/scripts/qa-server.js`. It starts both services with a fresh temporary JSON database, captures test OTPs locally, and does not load deployment environment files or send email. The QA guide explains browser and MongoDB tests. Do not run `reset:data` or `clean:presentation` against existing data without reviewing the scope and taking a backup.
When the default QA port is busy, choose a free one, for example `QA_PORT=5176 node Backend/scripts/qa-server.js`.

Production verification:

```bash
npm run lint
npm test
npm run build
npm run preview
```

Or run linting, tests and build verification together:

```bash
npm run check
```

After production environment variables are filled, check required configuration with:

```bash
npm run check:production
```

This configuration check does not connect to MongoDB, seed data, send email or verify deployment health. OpenStreetMap tiles require internet. The normal local JSON adapter stores changes in `Backend/data/smarttransit-db.json`; the QA server uses a separate temporary directory.

The production frontend build is created in `Frontend/dist`. The backend can be started with `npm start` on hosting platforms that expect a start command.

## Folder structure

```text
SmartTransit-Complete-Frontend 2/
+-- Backend/      API server, OTP email, seed data, database file and backend tests
+-- Frontend/     React app, pages, public assets, components, styles and frontend tests
+-- package.json  Root commands for running both parts
+-- *.md          Setup, deployment, demo and faculty explanation notes
```

Use `Frontend/src` when editing screens, styles, routes and UI behavior. Use `Backend` when editing APIs, OTP email delivery, data storage or server tests.

## Backend-ready mode

Development can use explicit browser demonstration mode. Production builds always require the backend: missing or invalid `VITE_API_BASE_URL` shows an unavailable/configuration screen, never demo dashboards. Use `npm run dev:full` for backend development. Set `VITE_USE_BACKEND=true` and `VITE_API_BASE_URL` to the HTTPS API URL for deployment. Every `VITE_*` value is public: never put a real password, OTP signing secret or private provider key there.

Backend calls are centralized in `Frontend/src/services/apiClient.js`. Endpoint expectations and data shapes are documented in [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md).
Deployment steps are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

Map tiles use OpenStreetMap by default, with SmartTransit stop labels and an Indus University campus marker added on top of the map. To use a Google-like commercial tile provider later, set `VITE_MAP_TILE_URL` and `VITE_MAP_TILE_ATTRIBUTION` without changing dashboard code. Admin stop coordinates can be filled by choosing a saved stop, pasting a Google Maps link or `lat,lng`, using the current device location, or clicking the route map.

## Faculty GPS Demonstration

Sign in as an administrator and open **GPS simulator**. Choose a route and morning/return direction, choose speed/playback, then **Start simulator**. Pause/resume, restart and exit controls are available. Exit before selecting a different route or direction.

This is an explicitly labelled, session-private simulation using the backend's distance/stop-progress calculation. It follows straight stop segments, not actual roads or traffic, and does not change real trips, GPS, passengers or notifications. It requires valid, distinct stop pins and the connected backend. It expires after 30 minutes without requests and is removed on logout or backend restart. It is not visible as a real bus in student/driver dashboards and does not prove phone GPS works.

Use only isolated demo accounts for demonstrations. Published fixture credentials must not remain usable on the public deployment. Review the latest release gates in the QA report before university handover.

## Production Database

Local development uses JSON storage by default. For a real public production app, set:

```bash
SMARTTRANSIT_STORAGE=mongodb
SMARTTRANSIT_MONGODB_URI=your-mongodb-atlas-uri
SMARTTRANSIT_MONGODB_DB=smarttransit
```

MongoDB persists accounts, hashed OTP records, server sessions, complaints, notifications and transport operations in one state document. Revision-based compare-and-swap protects concurrent writes. Production must use MongoDB. Empty production state fails startup rather than creating public demo accounts; initialization requires a separately reviewed provision/import procedure. Existing production data is not reset. Local/test environments may initialize isolated fixtures.

## Demo Login Credentials

Isolated local demonstration credentials are stored in [docs/LOGIN_CREDENTIALS.txt](./docs/LOGIN_CREDENTIALS.txt). They match the local test fixtures and must not be used in production. The QA preview creates a fresh temporary database: live accounts such as Mahipal and Vraj are not copied into it. Use the local Admin dashboard to create and assign additional test staff when needed.

## Local Demo Accounts

| Role             | Email                      | Password        | Landing route |
| ---------------- | -------------------------- | --------------- | ------------- |
| Student          | `student@iite.indusuni.ac.in`        | `Student@123`   | `/student`    |
| Driver           | `driver@transport.indusuni.ac.in`    | `Driver@123`    | `/driver`     |
| Conductor        | `conductor@transport.indusuni.ac.in` | `Conductor@123` | `/conductor`  |
| Admin / Operator | `admin@transport.indusuni.ac.in`     | `Admin@123`     | `/admin`      |

These published credentials must be restricted to isolated demonstrations. They were not tried against production during the audit. If any still work there, an authorized administrator must rotate or disable them before rollout; this audit does not reset accounts. Students register with an allowed university email and OTP, then remain pending until admin approval. Email verification is not transport approval. Password reset verifies an OTP and revokes existing sessions. The browser keeps an opaque bearer token in `sessionStorage`; server-side sessions, expiry, role/status and assignments are authoritative. Staff accounts are issued only by administrators.

## Real OTP email setup

Create `.env` from `.env.example`, then set these backend email values:

```bash
VITE_ALLOWED_SIGNUP_EMAIL_DOMAINS=
SMARTTRANSIT_EMAIL_PROVIDER=smtp
SMARTTRANSIT_SMTP_HOST=smtp.gmail.com
SMARTTRANSIT_SMTP_PORT=465
SMARTTRANSIT_SMTP_SECURE=true
SMARTTRANSIT_SMTP_USER=your.sender@gmail.com
SMARTTRANSIT_SMTP_PASS=your-gmail-app-password
SMARTTRANSIT_MAIL_FROM="SmartTransit <your.sender@gmail.com>"
SMARTTRANSIT_OTP_SECRET=replace-with-a-long-random-secret
SMARTTRANSIT_ALLOWED_SIGNUP_EMAIL_DOMAINS=
```

For Gmail, the password should be a Google App Password, not your normal Gmail password. Render Free blocks SMTP ports, so use Brevo in production:

```bash
SMARTTRANSIT_EMAIL_PROVIDER=brevo
SMARTTRANSIT_BREVO_API_KEY=your-brevo-api-key
SMARTTRANSIT_MAIL_FROM="SmartTransit <your.verified.sender@gmail.com>"
SMARTTRANSIT_OTP_SECRET=replace-with-a-long-random-secret
```

Keep both allowed-domain lines empty to allow only Indus University addresses ending with `indusuni.ac.in`. Without the selected email-provider values, real signup and password reset OTP sending will be blocked with a clear configuration message.

## Main routes

- Public: `/`, `/signup`, `/login`, `/forgot-password`, `/privacy`
- Student: `/student`, `/student/track`, `/student/routes`, `/student/alerts`, `/student/complaints`, `/student/profile`, `/student/help`
- Driver: `/driver`, `/driver/checklist`, `/driver/trip`, `/driver/emergency`, `/driver/history`, `/driver/profile`
- Conductor: `/conductor`, `/conductor/trip`, `/conductor/emergency`, `/conductor/history`, `/conductor/profile`
- Operator: `/admin`, `/admin/live`, management routes, `/admin/assignments`, `/admin/notifications`, `/admin/complaints`, `/admin/reports`, `/admin/settings`, `/admin/settings/states`

Protected routes enforce the signed-in role and redirect unauthorized users to a permission-denied page.

## Architecture and backend integration

The UI can run without a backend for quick demos, or against the included local backend for end-to-end testing. Replaceable boundaries are organized as follows:

- `Backend/`: local API, OTP email delivery, seed data, JSON data store and backend tests.
- `Frontend/src/services/apiClient.js`: shared JSON API helper with bearer-token support.
- `Frontend/src/services/authService.js`: student registration and authentication; switches between local demo data and backend calls.
- `Frontend/src/services/*Data.js`: structured mock transport, operations, communications and reporting data.
- `Frontend/src/communications/CommunicationsContext.jsx`: notifications and complaints; already uses HTTP when backend mode is enabled.
- `Frontend/src/operations/OperationsContext.jsx`: trip, GPS-sharing, emergency and seat-update workflows.
- `Frontend/src/admin/AdminDataContext.jsx`: fleet, people, route and assignment mutation boundary.
- `Frontend/src/settings/SystemSettingsContext.jsx`: settings, permissions and audit boundary.

The existing server uses Node's built-in HTTP module, scrypt password hashing and persisted opaque sessions, not Express, JWT or Socket.IO. Cross-role updates use authenticated HTTP polling (normally 15 seconds, student home 30 seconds) and refresh after writes. Keep these existing boundaries stable.

## Privacy and safety rules

- Driver GPS is shown only while a trip is active.
- Inactive-trip vehicles show `Not sharing`; their markers are omitted from live operator maps.
- Drivers have no seat-count controls.
- Conductors cannot submit negative, below-zero or over-capacity seat counts.
- Emergency success means the server saved the alert, not external delivery or administrator acknowledgement. Attach only a timestamped bus location; otherwise show unavailable/last known.
- GPS and seat information always includes freshness/timestamp context.

## Responsive and accessibility foundations

- mobile-first student and staff shells;
- desktop operator sidebar with mobile drawer fallback;
- minimum 44px interaction targets;
- visible global focus styles and semantic landmarks;
- accessible labels, validation feedback and status/alert roles;
- table-contained horizontal scrolling and no page-level horizontal overflow;
- reduced-motion support;
- configurable color, spacing, typography, radius and shadow variables in `Frontend/src/styles.css`.

## Scope intentionally excluded

QR passes, online payments, parent tracking, AI ETA, IoT/camera seat detection, route optimization, voice notifications, multilingual support and ERP integration are not implemented.
