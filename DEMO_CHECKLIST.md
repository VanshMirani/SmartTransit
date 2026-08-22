# SmartTransit Demo Checklist

Use this before showing the project to faculty.

## 1. Reset demo data

```bash
npm run reset:data
```

This restores the local API data to the original Indus University demo state.
Run it before `npm run dev:full`, or restart the local backend after resetting.

## 2. Run the complete app

For real student signup OTPs, first create `.env` from `.env.example` and set the Gmail/SMTP values. Demo account login does not require email delivery.

```bash
npm run dev:full
```

This starts the local API and the frontend together. Open the frontend URL printed in the terminal.

If the default API port is busy, the script automatically tries the next available port and connects the frontend to it.

## 3. Quick verification

```bash
npm run check
```

This runs linting, tests and production build verification.

## 4. Demo flow

1. Public page: explain the goal of SmartTransit for Indus University transport.
2. Student signup: if SMTP is configured, create a student using an institute email and the emailed OTP.
3. Student login: show live route IU-R4, bus 9468, ETA, seats, notifications and complaints.
4. Driver login: show assigned route, checklist, GPS privacy and emergency alert.
5. Conductor login: show seat updates, boarded/deboarded controls and update history.
6. Admin login: show live operations map, fleet status, complaints, notifications and route management.

## 5. Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Student | student@iite.indusuni.ac.in | Student@123 |
| Driver | driver@transport.indusuni.ac.in | Driver@123 |
| Conductor | conductor@transport.indusuni.ac.in | Conductor@123 |
| Admin | admin@transport.indusuni.ac.in | Admin@123 |
