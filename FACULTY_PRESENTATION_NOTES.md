# SmartTransit Faculty Presentation Notes

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
- Backend-ready setup: the frontend can run in demo mode, or connect to the included local API for login, OTP-based student signup, complaints, notifications, admin data and staff trip actions.

## How to explain backend readiness

The application is not just static screens. The frontend is separated into service and context layers, so data can come either from local demo data or from an API. A local Node.js API is included for testing. Later, the same frontend can be connected to a real backend database by implementing the documented API endpoints.

Authentication uses role-based login. Student signup verifies ownership of an institute email such as `name@iite.indusuni.ac.in` through OTP, instead of depending on hard-to-maintain enrollment-number formats. After login, the frontend stores a session and sends a bearer token to the backend. Student, admin, driver and conductor screens already call centralized API helpers when backend mode is enabled.

## Demo flow for faculty

1. Start by showing the public home page and explain that SmartTransit is for Indus University transport.
2. Login as student and show the assigned bus, route IU-R4, ETA, available seats, notifications and complaint option.
3. Login as driver and show the assigned bus, route, pre-trip checklist, GPS privacy and emergency option.
4. Login as conductor and show the seat update screen where boarded/deboarded students are entered.
5. Login as admin and show the live operations map, all buses, route status, complaints, notifications and management pages.
6. Mention that the app has been tested for desktop and mobile responsiveness.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Student | student@iite.indusuni.ac.in | Student@123 |
| Driver | driver@transport.indusuni.ac.in | Driver@123 |
| Conductor | conductor@transport.indusuni.ac.in | Conductor@123 |
| Admin | admin@transport.indusuni.ac.in | Admin@123 |

## Run commands

```bash
npm install
npm run dev
```

Use this for frontend demo mode.

```bash
npm run dev:full
```

Use this for the complete local setup with frontend and backend together.

```bash
npm run reset:data
```

Use this before a presentation to restore the original demo data.

```bash
npm run check
```

Use this to verify linting, tests and production build before presentation.
