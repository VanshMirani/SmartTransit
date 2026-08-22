# Backend integration guide

SmartTransit runs in demo mode by default. To connect a backend, create a `.env` file from `.env.example` and set:

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

Use `npm run reset:data` to restore the local JSON store to the original demo state before a presentation.

## Expected endpoints

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
  - Response: `{ records, routes, fleetVehicles, adminActivity }`
- `PUT /admin/:kind/:id`
  - `kind` can be `buses`, `drivers`, `conductors`, `students`, or `stops`.
  - Body: full record object.
- `PATCH /admin/:kind/:id/status`
  - Body: updated record object.
- `PUT /admin/routes/:id`
  - Body: full route object.
- `PATCH /admin/routes/:id/status`
  - Body: updated route object.

### Staff operations

- `GET /driver/trips/current`
  - Response: current operation state.
- `POST /driver/trips/:id/start`
- `POST /driver/trips/:id/end`
- `POST /staff/emergencies`
  - Body: `{ id, type, note, location, coordinates, submittedAt }`
- `GET /conductor/trips/current`
  - Response: current operation state with seat updates.
- `POST /conductor/trips/:id/seat-updates`
  - Body: `{ id, stopId, stopName, boarded, deboarded, occupiedSeats, availableSeats, timestamp }`
  - Response: saved seat update object.

## Route data

The frontend currently keeps Indus route data in `Frontend/src/services/indusRoutes.js`. When the backend is ready, return the same route, stop, bus, and trip shapes from API responses so the UI can switch over without component rewrites.

Stop coordinates in the current demo are approximate where exact public coordinates were unavailable.
