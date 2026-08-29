# SmartTransit Deployment Guide

This is the basic production path for turning SmartTransit into a real hosted application.

## 1. Prepare The Settings

Copy `.env.production.example` and fill in real values on your hosting platform.

Important values:

- `VITE_USE_BACKEND=true`
- `VITE_API_BASE_URL=https://your-backend-domain.com/api`
- `SMARTTRANSIT_STORAGE=mongodb`
- `SMARTTRANSIT_MONGODB_URI=your MongoDB Atlas connection string`
- Brevo values for OTP email on Render Free
- `SMARTTRANSIT_OTP_SECRET` with a long random secret
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

This checks that MongoDB and required production settings are present.

## 3. Deploy The Backend On Render

Deploy the Node backend from the project root. A `render.yaml` blueprint is included, so Render can auto-fill the main Node settings.

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

The backend automatically creates the initial SmartTransit data in MongoDB when the database is empty.

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

## 5. Final Production Test

After deployment, test these flows:

- open the public website on desktop and mobile;
- create a student account and confirm the OTP email arrives;
- use forgot password for a registered student account and confirm the reset OTP changes the password;
- sign in as student and track the bus;
- sign in as driver, conductor and admin using the seeded/provisioned staff accounts;
- check that refresh works on routes like `/student/track`, `/driver`, `/conductor` and `/admin`;
- submit one complaint and one notification in the admin/operator flow.

## Suggested Hosting

Chosen student-project setup:

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

For a college-level production deployment, use MongoDB Atlas or another managed database and a university-controlled email sender.
