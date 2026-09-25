# SmartTransit Submission Checklist

Use this before showing the project to faculty.

## 1. Keep Existing Data Safe

Use disposable local accounts and a separate browser session for each role. Do not reset or clean an existing database before presenting. Do not use real assignments, passenger counts or emergencies for demonstration writes.

## 2. Run the complete app

Use the isolated launcher for faculty demonstrations. It creates fresh temporary data, captures test email locally and does not load deployment environment files.

```bash
node Backend/scripts/qa-server.js
```

This starts the local API and the frontend together. Open the frontend URL printed in the terminal.

If the frontend port is busy, choose another free `QA_PORT`. The isolated API chooses an available loopback port. Map tiles require internet access.

## 3. Quick verification

```bash
npm run check
```

This runs linting, tests and production build verification.

## 4. Demo flow

1. Public page: explain the goal of SmartTransit for Indus University transport.
2. Student signup: use captured test mail for a test university address. Verify that email ownership does not bypass admin approval.
3. Student login: show the assigned route, trip state, seats, recorded timestamps, notifications and complaints.
4. Driver login: show assigned transport, checklist, actual trip start and GPS status.
5. Conductor login: submit boarding/deboarding, test invalid counts and confirm visibility in the student/operator sessions.
6. Complete the trip, prepare a separate return journey, then demonstrate campus boarding and stop deboarding.
7. Admin login: show route-stop edit/save/refresh, student approval, assignments, complaint resolution and reports.
8. Use the labelled GPS simulator when movement is unavailable. It never changes real trips or passenger counts.
9. Check mobile menus, forms and logout. Do not interpret a saved report as confirmed external delivery.

## 5. Submission And Release

Use only the isolated fixture credentials in [docs/LOGIN_CREDENTIALS.txt](docs/LOGIN_CREDENTIALS.txt). Exclude `.env` files, production passwords, tokens, private mailbox captures, database snapshots/keys, generated local databases and personal GPS data from the submission archive.

Include the existing source, package/lock files, configuration templates, setup documentation, presentation notes and [latest review](docs/SUBMISSION_REVIEW_2026-09-25.md). Keep genuine simulator, offline, approval and ETA limitations visible.

Local changes are not automatically live. Deployment needs review and approval, then the checks in `DEPLOYMENT.md`. Retain the previous release for code rollback; database restore is a separate reviewed operation.
