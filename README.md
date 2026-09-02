# SmartTransit

SmartTransit is a responsive college transportation frontend for Indus University. It provides:

- a mobile-first student, driver and conductor application;
- a responsive student website;
- a desktop-first transport-operator dashboard;
- realistic Indus University route data behind replaceable service/context boundaries;
- an included local Node.js API for backend-ready testing;
- MongoDB-ready production storage for public deployment.

The complete implementation status is listed in [FINAL_CHECKLIST.md](./FINAL_CHECKLIST.md). The phase-by-phase build record is in [PROJECT_PLAN.md](./PROJECT_PLAN.md).
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

To reset local JSON API data before a presentation:

```bash
npm run reset:data
```

Run this before `npm run dev:full`, or restart the local backend after resetting. This command is for local JSON data, not production MongoDB.

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

After production environment variables are filled, verify MongoDB and hosting settings with:

```bash
npm run check:production
```

OpenStreetMap tiles require an internet connection. All other demonstration data is local, and the local API stores changes in `Backend/data/smarttransit-db.json`.

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

The app stays in browser demo mode unless a backend is enabled. For the included local backend, use `npm run dev:full`. For another backend, copy `.env.example` to `.env`, set `VITE_USE_BACKEND=true`, and point `VITE_API_BASE_URL` to your API server. If you temporarily enable local demo shortcut buttons, keep their passwords in your local `.env` values instead of the frontend source.

Backend calls are centralized in `Frontend/src/services/apiClient.js`. Endpoint expectations and data shapes are documented in [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md).
Deployment steps are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Production Database

Local development uses JSON storage by default. For a real public production app, set:

```bash
SMARTTRANSIT_STORAGE=mongodb
SMARTTRANSIT_MONGODB_URI=your-mongodb-atlas-uri
SMARTTRANSIT_MONGODB_DB=smarttransit
```

When MongoDB is enabled, accounts, OTP records, sessions, complaints, notifications and transport-operation changes are stored in MongoDB. The backend seeds the initial Indus University data automatically when the database is empty.

## Demo Login Credentials

Faculty demonstration credentials are stored in [docs/LOGIN_CREDENTIALS.txt](./docs/LOGIN_CREDENTIALS.txt). They are for presentation testing only and should not be used in production.

## Current Demo Accounts

| Role             | Email                      | Password        | Landing route |
| ---------------- | -------------------------- | --------------- | ------------- |
| Student          | `student@iite.indusuni.ac.in`        | `Student@123`   | `/student`    |
| Driver           | `mahipal@transport.indusuni.ac.in`   | `Mahipal@123`   | `/driver`     |
| Conductor        | `vraj@transport.indusuni.ac.in`      | `Vraj@123`      | `/conductor`  |
| Admin / Operator | `admin@transport.indusuni.ac.in`     | `Admin@123`     | `/admin`      |

These accounts are configured for presentation and testing. Students can create an account at `/signup` using any email ending with `indusuni.ac.in`, such as `name@iite.indusuni.ac.in` or `zoom1@indusuni.ac.in`, plus OTP verification. Forgot password also uses email OTP verification before changing the password. Real OTP delivery uses the configured backend email provider. Local Gmail SMTP needs a Gmail App Password; Render Free should use Brevo. New student registrations are stored in JSON during local development and in MongoDB when production storage is enabled. The active authentication session is stored in `sessionStorage`. Driver, conductor and operator accounts remain transport-office provisioned.

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

Keep component-facing interfaces stable when adding Node.js/Express adapters. Real-time updates should enter through the contexts rather than directly inside page components.

## Privacy and safety rules

- Driver GPS is shown only while a trip is active.
- Inactive-trip vehicles show `Not sharing`; their markers are omitted from live operator maps.
- Drivers have no seat-count controls.
- Conductors cannot submit negative, below-zero or over-capacity seat counts.
- Emergency submissions attach the current trip location.
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
