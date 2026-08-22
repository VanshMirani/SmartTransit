# Backend

This folder contains the SmartTransit API side:

- API routes in `apiServer.js`
- OTP email sending in `emailService.js`
- local JSON database in `data/`
- seed/demo data in `seedData.js`
- backend tests in `tests/`
- helper scripts in `scripts/`

Use this folder when you need to change authentication, OTP email, stored data, API responses or backend tests.

For deployment, the root `npm start` command runs this backend. Set `PORT`, SMTP values and `SMARTTRANSIT_OTP_SECRET` on the hosting platform.

For real production storage, also set `SMARTTRANSIT_STORAGE=mongodb` and `SMARTTRANSIT_MONGODB_URI` on the backend host. If MongoDB is not configured, the backend uses local JSON storage only.
