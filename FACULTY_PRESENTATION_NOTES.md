# SmartTransit Presentation Notes

## Short overview

SmartTransit is a college transport management application for Indus University. It helps students track their assigned bus, helps drivers and conductors manage daily trip operations, and gives the transport admin a complete dashboard for monitoring buses, routes, staff, students, complaints and alerts.

The main goal is to reduce confusion during daily bus travel by showing live route status, ETA, seat availability, notifications and support options in one place.

## Problem statement

Students often do not know where the bus is, whether it is delayed, how many seats are available, or whom to contact during an issue. At the same time, the transport office needs a clear view of all active buses, route delays, driver/conductor assignments and complaints.

SmartTransit solves this by connecting student-facing transport information with staff operations and admin monitoring.

## Basic features

- Student app: live bus tracking, assigned route, ETA, seat availability, stop list, route alerts, complaints, profile and emergency help.
- Driver app: assigned bus and route, pre-trip checklist, start/end trip workflow, GPS sharing only during active trips, emergency reporting and trip history.
- Conductor app: passenger boarding/deboarding updates, current stop selection, seat availability calculation, update history and emergency reporting.
- Admin dashboard: live fleet map, bus status, delay alerts, occupancy summary, route management, bus/driver/conductor/student management, assignments, notifications, complaints, reports and settings.
- Responsive UI: works on desktop and mobile screens.
- Connected transport records: the Node.js API handles authentication, approvals, complaints, notifications, assignments and staff trip operations. Production records persist in MongoDB.

## How It Works

React provides the four dashboards. A Node.js HTTP API checks permissions, account status and assignments. Production uses MongoDB; isolated local tests can use a temporary JSON store. Dashboards fetch current records through polling, not shared browser storage.

Student email verification and transport approval are separate steps. Administrators approve students and assign transport, and only administrators provision staff accounts. Opaque server sessions enforce authorization on every protected operation.

Driver location is shared during active trips and includes its recorded update time. ETA is an approximate distance/speed calculation, not a traffic-aware road-navigation service. Stopped, unreliable or missing GPS can make ETA unavailable. The conductor's confirmed count determines available seats: previous occupied + boarded - deboarded, then capacity - occupied. This is not individual attendance or a reservation.

## Demo flow for faculty

1. Start by showing the public home page and explain that SmartTransit is for Indus University transport.
2. Sign in as the student and show the assigned bus, route, recorded update times, seats and complaint option.
3. In a separate session, sign in as the driver, complete the checklist and start a trip. The recorded departure is the actual start time.
4. Sign in as the conductor, enter a valid boarding count and confirm that the student/operator views receive it through the API and polling.
5. Finish the trip, prepare a separate return journey, and demonstrate campus boarding followed by deboarding.
6. In the operator dashboard, demonstrate approval and assignment, route-stop editing, and complaint resolution using temporary records.
7. Use **GPS simulator** for a clearly labelled route simulation when necessary. It is private to that administrator session and does not move a real bus or change passenger counts.
8. Demonstrate mobile navigation, validation and recovery after a failed request.

Use isolated data for all write demonstrations. A saved emergency report is not proof of external notification delivery or that help has arrived.

## Isolated Accounts

Use only the local fixture accounts in [docs/LOGIN_CREDENTIALS.txt](docs/LOGIN_CREDENTIALS.txt). These are not production credentials. Live accounts such as Mahipal are not copied into the isolated environment. Keep private production handover files out of the submission archive.

## Run commands

```bash
node Backend/scripts/qa-server.js
```

This starts the complete local app with a fresh temporary database and captured test mail. It does not load deployment environment files or send real emails. Open the displayed URL; set `QA_PORT` to another free port if necessary. Do not reset or clean an existing database before presenting.

```bash
npm run check
```

Use this to verify linting, tests and production build before presentation.

## Verification Scope

See [the submission review](docs/SUBMISSION_REVIEW_2026-09-25.md) for current browser and database evidence. The OnePlus test confirmed a real phone location reaching the isolated server. Continuous movement, screen-lock/background operation and outage recovery on that phone remain unverified. Most pickup locations still need transport-office confirmation. The simulator does not establish GPS accuracy or stop correctness.

The [production handover record](docs/PRODUCTION_HANDOVER_2026-09-25.md) contains credential-rotation, controlled email and encrypted application-state restore evidence. A passing local build is not unrestricted production certification or official university endorsement.
