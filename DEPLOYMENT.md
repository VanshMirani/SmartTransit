# SmartTransit Deployment Guide

This is the basic production path for turning SmartTransit into a real hosted application.

Do not deploy automatically. Review [the latest audit and release gates](docs/QA_AUDIT_2026-09-25.md), obtain deployment approval, and test in an isolated staging environment first. Publishing the September 25 audit branch to GitHub does not authorize a production merge or deployment.

## 1. Prepare The Settings

Copy `.env.production.example` and fill in real values on your hosting platform.

Important values:

- `VITE_USE_BACKEND=true`
- `VITE_API_BASE_URL=https://your-backend-domain.com/api`
- `SMARTTRANSIT_STORAGE=mongodb`
- `SMARTTRANSIT_MONGODB_URI=your MongoDB Atlas connection string`
- Brevo values for OTP email on Render Free
- `SMARTTRANSIT_OTP_SECRET` with at least 32 random characters, not the development value
- `SMARTTRANSIT_ALLOWED_ORIGIN` as one exact HTTPS frontend origin, without a path, trailing slash or wildcard
- keep `VITE_ALLOWED_SIGNUP_EMAIL_DOMAINS` and `SMARTTRANSIT_ALLOWED_SIGNUP_EMAIL_DOMAINS` empty so signup accepts only `indusuni.ac.in` emails

Do not upload `.env` publicly.

## 2. Check The App Locally

Run:

```bash
npm install
npm run check
```

This checks code quality, runs tests and confirms the frontend builds successfully.

After filling production environment values, run:

```bash
npm run check:production
```

This checks required configuration, HTTPS API/origin values and the signing-secret requirement. It does not connect to MongoDB, send mail, validate credentials, or verify deployment health. Never expose backend credentials in `VITE_*` variables.

## 3. Deploy The Backend On Render

Deploy the Node backend from the project root. A `render.yaml` blueprint is included, so Render can auto-fill the main Node settings.

The blueprint still pins Node 20. The current local audit used Node 24.19.0. Approve and test one supported Node major across local, package and hosting configuration before releasing; no live runtime was changed by the audit.

If you configure it manually, use:

```bash
npm start
```

The backend reads the port from `PORT` or `API_PORT`.

Set the backend environment variables on Render. For real production, use MongoDB Atlas by setting `SMARTTRANSIT_STORAGE=mongodb` and `SMARTTRANSIT_MONGODB_URI`.

Required Render values:

- `SMARTTRANSIT_MONGODB_URI`: your MongoDB Atlas connection string
- `SMARTTRANSIT_ALLOWED_ORIGIN`: your Vercel frontend URL
- `SMARTTRANSIT_EMAIL_PROVIDER`: `brevo`
- `SMARTTRANSIT_BREVO_API_KEY`: your Brevo transactional email API key
- `SMARTTRANSIT_MAIL_FROM`: `SmartTransit <your verified Brevo sender email>`
- `SMARTTRANSIT_OTP_SECRET`: a long random text value

Production startup requires an existing, deliberately provisioned MongoDB state document. An empty production database fails closed; it does not seed public demonstration accounts. Provision/import only with a separately reviewed procedure and backup. Isolated local/test storage can create fixtures. Existing production records are not reset by startup.

## 4. Deploy The Frontend On Vercel

Build command:

```bash
npm run build
```

Frontend output folder:

```text
Frontend/dist
```

Set the frontend environment variable:

```text
VITE_USE_BACKEND=true
VITE_API_BASE_URL=https://your-backend-domain.com/api
VITE_SHOW_DEMO_CONTROLS=false
VITE_ALLOWED_SIGNUP_EMAIL_DOMAINS=
```

The included `vercel.json` file sets the build output and sends refreshed React Router pages back to `index.html`.

The proposed headers preserve geolocation for this origin and add nosniff, a referrer policy, and private-route noindex headers. CSP is report-only, not enforced protection. Review browser violations with actual map/API/font providers in hosted staging before tightening it. No report collector is configured. The SPA fallback renders a visual 404 for unknown URLs but returns HTTP 200; this is not a server-side 404.

## 5. Final Production Test

Use isolated staging accounts and captured mail for write tests. Production checks should remain read-only unless the owner explicitly approves a narrowly scoped test and cleanup. In staging, test these flows:

- open the public website on desktop and mobile;
- create a student account and confirm the OTP email arrives;
- use forgot password for a registered student account and confirm the reset OTP changes the password;
- sign in as student and track the bus;
- sign in as driver, conductor and admin using isolated provisioned accounts, never shared published passwords;
- check that refresh works on routes like `/student/track`, `/driver`, `/conductor` and `/admin`;
- submit one complaint and one notification in the admin/operator flow.

Before release: verify exposed demonstration accounts are disabled or rotated, approve a tested runtime, confirm operational contacts and email delivery, complete real-phone GPS testing, and rehearse backup/restore and rollback. Do not reset accounts or live data as part of a routine build.

## Suggested Hosting

Chosen student-project setup:

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

For a college-level production deployment, use MongoDB Atlas or another managed database and a university-controlled email sender.
