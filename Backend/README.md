# Backend

This folder contains the SmartTransit API side:

- API routes in `apiServer.js`
- OTP email sending in `emailService.js`
- local JSON database in `data/`
- seed/demo data in `seedData.js`
- backend tests in `tests/`
- helper scripts in `scripts/`

Use this folder when you need to change authentication, OTP email, stored data, API responses or backend tests.

For deployment, the root `npm start` command runs this backend. Set `PORT`, MongoDB values, OTP secret and email-provider values on the hosting platform. Render Free should use `SMARTTRANSIT_EMAIL_PROVIDER=brevo` with `SMARTTRANSIT_BREVO_API_KEY`; local development can still use Gmail SMTP.

For production, set `SMARTTRANSIT_STORAGE=mongodb` and `SMARTTRANSIT_MONGODB_URI`. Production rejects JSON storage and empty/unprovisioned MongoDB state rather than falling back to demonstration records. JSON is single-process local/test storage only. Set an exact HTTPS `SMARTTRANSIT_ALLOWED_ORIGIN` and a non-development `SMARTTRANSIT_OTP_SECRET` of at least 32 characters. See the root deployment guide and current audit before publishing.
