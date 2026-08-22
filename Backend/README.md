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

For real production storage, also set `SMARTTRANSIT_STORAGE=mongodb` and `SMARTTRANSIT_MONGODB_URI` on the backend host. If MongoDB is not configured, the backend uses local JSON storage only.
