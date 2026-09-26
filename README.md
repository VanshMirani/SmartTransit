# SmartTransit

Transport tracking and management for Indus University.

- Website: https://smart-transit-lyart.vercel.app/
- Repository: https://github.com/VanshMirani/SmartTransit

## Project Team

- Vansh Mirani
- Riicha Rupareliya
- Rajveer Singh Gill

## Features

- Students: approved route assignments, bus tracking, seat availability, notices and complaints.
- Drivers: safety checklist, morning/return trips, phone GPS sharing and emergency reports.
- Conductors: boarding/deboarding counts, capacity validation and update history.
- Administrators: students and approvals, staff, buses, routes, stop locations, assignments, notices, complaints and reports.
- Administrator GPS simulator: explicitly labelled, session-private demonstration; it does not change real vehicle locations.

## Project Structure

```text
SmartTransit/
  Backend/          Node HTTP API, authentication, storage and transport logic
    scripts/        Development launcher and production configuration check
    tests/          Backend regression tests
  Frontend/
    public/         Branding, icons and public assets
    src/            React pages, components, styles and API clients
    tests/          Frontend regression tests
  README.md         Setup, architecture and deployment instructions
  package.json      Shared commands and dependencies
  render.yaml       Backend hosting configuration
  vercel.json       Frontend hosting configuration
```

## Run Locally

Install Node.js and npm. The package requires Node 20 or newer; local verification used Node 24.19.0. The existing Render blueprint pins Node 20; changing the hosted runtime requires a separately tested update.

1. Run `npm ci` from the project root.
2. For a new checkout, create `.env` using `.env.example`. Do not overwrite an existing environment file.
3. For isolated local development set `SMARTTRANSIT_STORAGE=json`, `VITE_USE_BACKEND=true`, and `SMARTTRANSIT_ALLOWED_ORIGIN=http://localhost:5173`. Do not connect a development preview to production MongoDB.
4. Run `npm run dev:full`, then open the frontend URL printed in the terminal.

The launcher normally uses frontend port 5173 and API port 5050. It chooses the next free API port if needed. If the frontend port is occupied, stop the previous preview first.

Local JSON data is stored in `Backend/data/smarttransit-db.json`. Set `SMARTTRANSIT_DB_FILE` to a separate file for an independent local dataset. New isolated stores initialize development fixtures; live accounts are not copied into them. Real signup/reset emails require a configured email provider. Automated tests inject captured mail and temporary stores.

| Command | Purpose |
| --- | --- |
| `npm run dev:full` | Start frontend and backend |
| `npm run dev` | Frontend only |
| `npm start` | Backend only |
| `npm run check` | Lint, regression tests and production build |
| `npm run test:frontend` | Frontend regression tests |
| `npm run test:backend` | API and transport regression tests |
| `npm run build` | Generate `Frontend/dist` |
| `npm run preview` | Preview the built frontend |
| `npm run check:production` | Validate supplied production configuration without database writes |

`Frontend/dist` and its `assets` folder are generated build output, not source files. Run `npm run build` before `npm run preview`. Development rebuilds its cache automatically; keep the original files in `Frontend/public` and `Frontend/src`.

## Credentials And Privacy

The owner's read-only `LOGIN_CREDENTIALS.txt` is local-only and excluded from Git. Share access privately with the faculty; do not upload this file, `.env`, database files or private backups. Public checkouts intentionally do not include live credentials. Development fixtures in the source/tests are for isolated environments only.

Student registration verifies email ownership and then requires transport-admin approval. Staff accounts are provisioned by administrators. An email verification is not an approval or a route assignment. Never expose real passwords, OTP secrets or private API keys through `VITE_*` configuration: these values are included in the browser build.

## Architecture

React 19, JavaScript/JSX, Vite 6 and React Router provide the frontend. Maps use Leaflet/OpenStreetMap; icons use Lucide; reports use Recharts.

The backend uses Node's HTTP module, scrypt password hashes and persisted opaque bearer sessions. Authentication, approval, role and assignment permissions are enforced by the server. It does not use Express, JWT or Socket.IO. The browser stores its session token in sessionStorage. Authenticated polling and refresh-after-write synchronize the dashboards.

Production uses MongoDB with a revision-checked application state document. The JSON adapter is for single-process local development. Production refuses JSON storage and an unprovisioned database instead of creating demonstration accounts.

- Seat occupancy is calculated by the backend: previous occupied + boarded - deboarded. Available seats = capacity - occupied. Updates require whole numbers within capacity and use request IDs for safe retries.
- New trips start with zero occupancy and no inherited GPS. Return runs have their own trip records; conductors record actual boarding at campus.
- GPS is accepted only for the assigned active trip. Recorded fix/sync times distinguish fresh, stale and unavailable locations.
- Route edits retain administrator-selected stop coordinates. Stop order, coordinates and version checks support consistent saves.
- Emergency reports show server acceptance separately from delivery or administrator acknowledgement.

## Deployment

Keep the existing Vercel frontend and Render backend projects linked to this repository. Renaming the local folder does not rename either hosted service.

Frontend: build with `npm run build`, publish `Frontend/dist`, and use the included `vercel.json` for deep-link rewrites and headers.

```text
VITE_USE_BACKEND=true
VITE_API_BASE_URL=https://your-backend-domain.com/api
VITE_SHOW_DEMO_CONTROLS=false
```

Backend: run `npm start`; configure `NODE_ENV=production` and these private values on the hosting platform:

```text
SMARTTRANSIT_STORAGE=mongodb
SMARTTRANSIT_MONGODB_URI
SMARTTRANSIT_MONGODB_DB
SMARTTRANSIT_MONGODB_COLLECTION
SMARTTRANSIT_ALLOWED_ORIGIN
SMARTTRANSIT_OTP_SECRET
SMARTTRANSIT_EMAIL_PROVIDER=brevo
SMARTTRANSIT_BREVO_API_KEY
SMARTTRANSIT_MAIL_FROM
```

Use the exact HTTPS frontend origin for CORS and a random OTP secret of at least 32 characters. See `.env.production.example` for configuration names/placeholders. Brevo requires an approved sender. Keep the allowed signup-domain settings empty to use the application's Indus University restriction.

Run `npm run check` before publishing. With the intended production variables supplied, run `npm run check:production`; it validates configuration, not database connectivity, email delivery or hosting health. After an approved deployment verify `/api/health`, all four logins, direct-page refreshes and maps. Use isolated data for write testing.

Back up MongoDB and verify restoration into an isolated database before risky changes. Store backups and keys privately, outside this repository. Roll back code through the hosting platform's previous known-good deployment; do not overwrite current data with an old database snapshot as part of a routine code rollback.

## Operational Limits

- ETA is a qualified estimate from stop geometry and usable speed, not a traffic-aware road-routing prediction. Invalid, stale, stopped or off-route GPS can make ETA unavailable.
- The phone browser must continue providing location. Screen-lock/background GPS is device-dependent and is not guaranteed.
- Return trips reverse the configured stop sequence. Different return roads or stops require a separately agreed route model.
- University transport staff must confirm physical pickup points and support contacts.
- Saved in-app alerts do not prove SMS, push, telephone or other external emergency delivery.
- Production settings/permission controls are read-only where no configuration endpoint exists.
- The SPA shows a custom not-found screen; an unknown deep link can still receive HTTP 200 from the hosting rewrite.
