# Backend integration guide

Development can use browser demo mode; production builds require the real backend and fail clearly if it is not configured. To connect the existing Node HTTP backend, create a `.env` file from `.env.example` and set:

```bash
VITE_USE_BACKEND=true
VITE_API_BASE_URL=http://localhost:5050/api
VITE_SHOW_DEMO_CONTROLS=false
```

The frontend uses `Frontend/src/services/apiClient.js` for all backend calls. It sends JSON and includes `Authorization: Bearer <token>` after login when the backend returns `token` or `accessToken`.

`VITE_SHOW_DEMO_CONTROLS` can be set to `true` only when you want internal UI state preview controls visible during development.

## Included local API

For presentation and testing, the project includes a small Node.js API:

```bash
npm run dev:full
```

This starts:

- frontend: the Vite URL shown in the terminal;
- backend: `http://127.0.0.1:5050/api` when available;
- local data store: `Backend/data/smarttransit-db.json`.

If API port `5050` is already busy, `npm run dev:full` automatically tries the next available API port and passes the correct API URL to the frontend.

Use `npm run backend` if you want to run only the API, and `npm run test:backend` if you want to test only the API endpoints.

Use `node Backend/scripts/qa-server.js` for disposable testing without loading production environment files. Do not automatically reset or clean existing data.

The server uses scrypt and persisted opaque bearer sessions, not JWT. Role, approval and assignment checks run on the backend. JSON writes are serialized and atomic within one process; MongoDB uses a revision-checked state document. Multi-process JSON is unsupported. Polling, not sockets, carries updates between independently signed-in users.

## Expected endpoints

### Safe Administration And Simulator

- `DELETE /admin/{buses|drivers|conductors|students|routes}/:id`: admin-only, repeat-safe deletion. Unassign records first. Active trips, linked student assignments, completed trip history and linked student complaint history protect records from deletion; deactivate historical records instead. Deleting a removable staff/student record revokes its linked login sessions. There is no general notification-history deletion endpoint.
- Record/route writes validate IDs, capacity, duplicate codes, linked accounts and conflicting active assignments. Assigned resources cannot be changed during an active trip. New students created in management are transport records, not a substitute for email-verified registration.
- `GET /admin/simulation`: current authenticated admin session's isolated simulation or `idle`.
- `POST /admin/simulation`: `{ routeId, direction: 'morning'|'return', speedKmh, playbackRate }`; speed 5-60, playback 1/10/30/60.
- `PATCH /admin/simulation`: `{ id, action: 'pause'|'resume' }`; stale simulation IDs are rejected.
- `DELETE /admin/simulation`: exit. Logout clears the simulation too.

Simulation state is memory-only and session-private with a 30-minute inactivity expiry, not persisted GPS. It uses the same backend ETA/progress projection with explicitly simulated locations. It does not write transport records or broadcast to other roles. Multiple backend instances would need a shared simulation store or session affinity; real operations continue to use MongoDB independently.

Notification creation accepts `requestId` for safe retry. Repeating the same administrator/request ID and normalized details returns the existing publication; changing details with that ID is rejected. Publication does not prove external delivery or administrator acknowledgement. JSON request bodies are limited to 512 KiB.

### Authentication

- `POST /auth/login`
  - Body: `{ email, password, role }`
  - Response: `{ token, user: { id, name, email, role, initials } }`
- `POST /auth/signup-otp`
  - Body: `{ email }`
  - Email must be an institute subdomain address, for example `name@iite.indusuni.ac.in`.
  - Response: `{ ok, expiresInMinutes }`
  - The backend sends this OTP through the configured email provider and never returns the code to the frontend.
- `POST /auth/register/student`
  - Body: `{ fullName, email, phone, password, otp }`
  - Response: `{ token, user: { id, name, email, role, initials } }`
- `POST /auth/password-reset`
  - Body: `{ email }`
- `POST /auth/password-reset/confirm`
  - Body: `{ email, otp, password }`; resets the password and revokes sessions.
- `GET /auth/session`
  - Returns the current authorized user; 401/403 clears browser authentication. Network/5xx failures do not mean logout.
- `POST /auth/logout`
  - Revokes the bearer session on the server.

New verified students remain pending. Registration does not automatically sign the browser into restricted transport pages. Administrators approve/reject and assign transport separately. Existing sessions are checked for changed status.

### OTP email sending

The included API can send signup OTPs through local SMTP or a production email API. Create `.env` from `.env.example` and set:

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

For Gmail, use a Google App Password. Render Free blocks SMTP ports, so production can use Brevo instead:

```bash
SMARTTRANSIT_EMAIL_PROVIDER=brevo
SMARTTRANSIT_BREVO_API_KEY=your-brevo-api-key
SMARTTRANSIT_MAIL_FROM="SmartTransit <your.verified.sender@gmail.com>"
SMARTTRANSIT_OTP_SECRET=replace-with-a-long-random-secret
```

Keep both allowed-domain values empty for the final deployment; signup will then accept only Indus University addresses ending with `indusuni.ac.in`. The API stores only a hashed OTP with an expiry time in the configured backend store, so the real code is not exposed in frontend responses.

### Student

- `GET /student/transit`
  - Response should match the shape of `studentTransitData` in `Frontend/src/services/mockData.js`.
- `GET /student/complaints`
  - Response: complaint array.
- `POST /student/complaints`
  - Body: `{ category, subject, relatedService, description }`
  - Response: full complaint object.
- `GET /student/preferences`, `PATCH /student/preferences`
  - Persist only the signed-in student's supported notification preferences.
- `POST /student/notifications/read`
  - Persists read state for the current student, not all recipients.

### Admin communications

- `GET /communications/bootstrap`
  - Response: `{ notifications, campaigns, complaints }`
- `POST /admin/notifications`
  - Body: `{ type, title, message, audience, routeCode, deliveryMode, scheduledFor }`
  - Response: notification campaign object.
- `PATCH /admin/complaints/:id`
  - Body: `{ id, status, assignedTo, internalNote, resolution }`
  - Response: updated complaint object.

### Admin management

- `GET /admin/bootstrap`
  - Response includes `{ records, routes, fleetVehicles, adminActivity, tripHistory }`.
- `PUT /admin/:kind/:id`
  - Writable kinds: `buses`, `drivers`, `conductors`, `students`. Stops are derived from routes; direct stop-directory writes are rejected.
  - Body: full record object.
- `PATCH /admin/:kind/:id/status`
  - Body: updated record object.
- `PUT /admin/routes/:id`
  - Body: full route object. Explicit coordinates are validated and marked admin-owned so template enrichment cannot replace them.
- `PATCH /admin/routes/:id/status`
  - Body: updated route object.

### Staff operations

- `GET /driver/trips/current`
  - Response: current operation state.
- `POST /driver/trips/:id/start`
- `POST /driver/trips/:id/end`
- `POST /staff/emergencies`
  - Body: `{ id, tripId, type, note }`. Retain the same ID and payload after an unconfirmed response for safe retry. The server validates the trip assignment and derives reliable GPS; it does not trust a route stop as the bus location.
  - Server persistence, external provider delivery and administrator acknowledgement are separate events. External emergency delivery is not connected.
- `GET /conductor/trips/current`
  - Response: current operation state with seat updates.
- `POST /conductor/trips/:id/seat-updates`
  - Body: `{ id, stopId, boarded, deboarded }`. Use the same ID and payload when retrying an unconfirmed submission.
  - Assigned active trip required. Server calculates occupancy and availability from stored state; client totals/timestamps are not authoritative. Invalid integers, stops and capacity violations are rejected. Duplicate IDs with different input are rejected.
- `POST /driver/trips/:id/location`
  - Body: `{ latitude, longitude, accuracy, speedMetersPerSecond, heading, timestamp }`.
  - Requires the assigned active trip and a recent, reliable position. Old/out-of-order fixes are rejected. Response includes the actual fix time and server acceptance time.

Outbound and return runs have separate trip IDs and histories. New runs start with zero occupancy and no inherited GPS. Conductors enter actual campus boarding for return runs. Current return stop order reverses the configured outbound stops; different return roads/stops require a separately designed route model and university confirmation.

## Route data

`Frontend/src/services/indusRoutes.js` contains reference route templates. Backend records and explicit admin coordinate edits drive connected dashboards. Backend mode does not substitute a default trip for an unassigned user.

Stop coordinates in the current demo are approximate where exact public coordinates were unavailable.

ETA is a qualified estimate from remaining stop geometry and usable speed, not a traffic-aware road routing prediction. Missing, stale, stopped or off-route GPS can make ETA unavailable. Do not substitute scheduled time for live stop progress. All event times are full timestamps displayed in Asia/Kolkata; scheduled times remain schedules.

Scheduled in-app notices become published when the communications endpoint is fetched after their due time. This is not a background notification worker or delivery receipt. System settings/permission switches are read-only in backend mode; a general configuration API and complete administrator audit log are not implemented. See [the QA report](docs/QA_AUDIT_REPORT.md) for evidence and remaining work.
