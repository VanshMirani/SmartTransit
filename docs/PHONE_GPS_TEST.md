# Temporary HTTPS Phone Test

This is an owner-authorized, disposable alternative to USB port forwarding. It does not deploy the audit branch to production or test production data. Real-phone results remain pending until actually observed.

## Isolation And Access

- `Backend/scripts/qa-phone-server.js` creates a new private temporary JSON database. It never loads `.env`, accepts an existing database path, or connects to MongoDB. It rejects inherited `SMARTTRANSIT_*` and `VITE_*` variables.
- Every fixture login receives a fresh random password. Published fixture passwords do not authenticate this copy. The access code and test passwords are written only to a mode-0600 file within a mode-0700 temporary directory, outside Git.
- Only the compiled frontend and an allowlisted loopback API proxy are served. No Vite development server, source directory, mailbox or environment file is exposed.
- An independent access gate protects both static assets and API calls. It issues random `Secure; HttpOnly; SameSite=Strict` cookies. The normal application's server-side bearer authentication and role checks still apply.
- Gate requests are rate-limited. Cross-origin writes, forged cookies and unexpected hosts are rejected. Password recovery, signup and email delivery are disabled. Both mail callbacks reject without contacting a provider.
- The preview expires within two hours and closes its app/API listeners. Its gateway sends no-store/noindex headers and allows same-origin geolocation.
- Cloudflare Quick Tunnel supplies public HTTPS. Test requests, credentials and later owner-permitted GPS cross that provider; this is not an end-to-end private VPN. Keep credentials private. The Mac must remain awake and connected. There is no uptime guarantee and this is not production hosting.

No production secrets, accounts, student records or existing database snapshots are copied into this environment. Test positions are retained in its local JSON database until owner-reviewed removal. Do not commit the database, access file, browser cookies, HAR files, passwords or precise personal GPS evidence.

## Launch And Stop

Use a free loopback port and the official checksum-verified `cloudflared` executable. Start a quick tunnel to that port, then use its exact returned HTTPS origin:

```sh
cloudflared tunnel --url http://127.0.0.1:5186 --no-autoupdate --protocol http2
env -i PATH="$PATH" HOME="$HOME" TMPDIR="$TMPDIR" \
  node Backend/scripts/qa-phone-server.js https://RETURNED-HOST.trycloudflare.com 5186
```

Replace the uppercase placeholder with the actual lower-case returned hostname. The launcher permits only an exact HTTPS trycloudflare.com origin. Build output, data and access credentials remain in the newly generated temporary directory. Read the final startup message for the private handover path and exact expiry. Share only the gate code and test-driver account required for the supervised test, not all roles or any production handover file.

Stop the app and tunnel with Ctrl+C in their respective sessions when finished. The app also stops at expiry; stop the now-unused tunnel separately. Do not delete arbitrary temporary directories: review the exact launcher-created directory first. After sign-out and evidence collection, remove only that test directory with owner approval. No router port forwarding or USB debugging is needed.

## Supervised OnePlus Check

1. Open the HTTPS link in phone Chrome (not an in-app messaging browser), enter the test access code and log in as the supplied test driver. Do not use production credentials.
2. Record Android/OxygenOS and Chrome versions. Before a trip, verify that GPS is not sharing.
3. Complete the normal safety checklist and start the isolated trip. Enable phone Location and allow precise location for this test website. Test only while stationary or walking safely, never while driving.
4. Observe the distinction between obtaining a fix and successful server acceptance. Compare accepted timestamps with a separately authenticated test observer; do not disclose precise personal coordinates in committed evidence.
5. Test foreground movement, denied permission/recovery, brief loss of internet/reconnection, backgrounding, screen lock and reopening. Record actual behavior, including failure to continue in the background.
6. End the trip and log out. Confirm uploads stop and a later trip cannot inherit the old trip's GPS. Revoke site location permission after the test.

Testing near home proves only device/upload/freshness behavior, not campus stop accuracy or road ETA accuracy. No simulated positions are needed for this real-device test.

## Verification So Far

- `npm run check`: lint/build pass, 136 tests pass, zero failures/skips.
- Four new access-gate tests cover unauthenticated app/API access, correct and incorrect codes, rate limits, CSRF rejection, secure cookies, cookie revocation, forged cookies, expiry, disabled mail routes, path restrictions and symlink escape rejection.
- Public HTTPS probes: gate 200; unauthenticated app/deep links redirect to the gate; unauthenticated API returns 401; environment files are not returned. Responses use no-store.
- Fresh automated Chrome renders the empty gate at 390x844 and 1440x900. At 390px, document width is 390px, `isSecureContext` is true, and the Geolocation API exists. No location was requested. No page exception was reported.
- Automated transmission of all four test accounts was blocked by a safety check before execution. The owner then explicitly approved only the temporary gate code and test-driver login through Cloudflare. The narrowed API check passed (gate 303, driver login/data 200, logout 200, gate lock 303); no other role's credentials were transmitted.
- Actual Chrome form submission initially failed: the gate's `no-referrer` policy made its navigation Origin null. The gate document now uses `same-origin` while still rejecting null/foreign Origin writes. The regression suite retains both rejection cases. After restart, the browser gate, driver sign-in and assignment load passed with the new private credentials.
- Driver dashboard at 390x844: secure context true, document width 390px, assigned IU-R4 bus/checklist visible, GPS Inactive and Before Trip, zero page exceptions. Mobile menu logout returned to login; private store inspection confirmed zero remaining sessions, trip not started and zero GPS records. Screenshot: `phone-test-driver-390.png`. This is viewport emulation, not a real-phone pass.
- Final `npm run check` after the form-policy fix passed lint, all 136 tests and build; full output is `docs/qa/2026-09-25-handover/phone-setup-check.log`.
- Initial real OnePlus result: the owner's Chrome screenshot shows an active trip; isolated persisted state has a `driver-phone` fix reported at 15:36:53.959 UTC and accepted at 15:36:54.139 UTC (21:06:54 IST), reported accuracy 3 m, speed 0.5 km/h. No mock position was supplied. Precise coordinates are intentionally omitted. This is an initial device-to-server acceptance, not a sustained tracking pass or a speed/accuracy calibration.
- The screenshot's 1 km/h is whole-number rounding of 0.5 km/h. Backend ETA correctly withholds an arrival below 1 km/h and retains approximate distance. A test away from the route does not verify route-stop passage or road ETA accuracy. Rounding around this threshold is a potential presentation improvement; no active test was restarted or changed for it.
- Sustained movement, cross-role phone-update visibility, background behavior, screen lock, offline/reconnection and trip-end upload cleanup: NOT TESTED yet.

Evidence is under `docs/qa/2026-09-25-handover/`. The screenshots contain the empty access gate only, not credentials or private positions.

Reference: [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
