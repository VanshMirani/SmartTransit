# Production Handover Verification

Status on 25 September 2026: **in progress; not fully signed off**. This is a follow-up to the code audit, authorized by the owner. No code push, merge, deployment, database reset, bulk cleanup or real emergency was performed. Two owner-confirmed stop pins were changed through the live admin API. The owner separately approved rotation of three exposed fixture accounts and private local handover. One approved university-inbox reset email was sent without changing that student's password. Other accounts, assignments, trips and history were preserved.

## Gate Status

| Gate | Actual evidence | Status |
| --- | --- | --- |
| Credential rotation | Three exposed fixture passwords rotated with unique random values; 103 stored target sessions revoked. All three old passwords return 401; new passwords return 200. A pre-rotation token returns 401; verification sessions logged out. Final database scan has zero published fixture matches. | **PASS for exposed application credentials; email recovery/provider-secret review remain open** |
| Real-phone GPS | Protected HTTPS test setup passed. Owner's OnePlus screenshot shows an active trip; isolated backend accepted a driver-phone fix at 21:06:54 IST with reported accuracy 3 m. No simulated input or production GPS write. | **PARTIAL PASS: first device-to-server fix; sustained movement, other-role visibility, background/recovery/end cleanup pending** |
| Stop locations | 159 stop entries across 9 routes have structurally valid coordinates; no same-route identical pins in the current snapshot. Two supplied IU-R9 references were applied and verified via the live API and MongoDB. | **PARTIAL: 2 owner references applied; 157 physical pickups unconfirmed** |
| Controlled email | Gmail was rejected by the university-domain rule before sending. After exact university-address confirmation, one live reset request returned 200 and the owner confirmed Inbox receipt. No student password was changed. | **PASS for one owner-confirmed inbox delivery; authentication headers/SLA NOT TESTED** |
| Backup and restore | Read one live application state document and index definitions, encrypted it, restored it to a new disposable MongoDB, reconnected and checked exact equality. Source received no restore writes. | **PASS for application-state restore; off-device retention/disaster recovery still pending** |

## Backup Evidence And Recovery Boundaries

[Initial machine-readable evidence](qa/2026-09-25-handover/backup-restore.json): revision 51, 167,978 BSON bytes. [Second verification after the pin corrections](qa/2026-09-25-handover/backup-restore-after-pins.json): revision 56, 167,978 BSON bytes. Both passed AES-256-GCM authenticated encryption, retained BSON dates, exact data equality after target reconnect, index recreation and zero source writes by the backup verifier. The local configuration's database was correlated with the live API by observing an audit session there; [correlation and stop-save evidence](qa/2026-09-25-handover/live-stop-check.json).

[Final backup after credential rotation](qa/2026-09-25-handover/backup-restore-after-rotation.json): revision 69, 155,039 BSON bytes, exact isolated restore PASS and zero stored matches against the four published fixture passwords. Prefer this snapshot over the pre-rotation copies. It includes the corrected pins and rotated passwords; old copies would require renewed rotation/session revocation before reuse.

Latest private files, deliberately outside Git:

- Archive: `/Users/vansh/Library/Application Support/SmartTransit/Backups/snapshot-xWq9OR/app-state.stbackup`
- Key: `/Users/vansh/Library/Application Support/SmartTransit/BackupKeys/key-uz3lTm/app-state.key`

The archive and key files are mode 0600; their individual directories are 0700. The key's content is not included in any report. Keep the key separate from the archive when arranging an encrypted off-device copy. Separate directories on the same Mac are **not** an off-site backup. No cloud upload, paid backup service or recurring backup schedule was configured.

The second snapshot includes the two authorized pin corrections; the initial snapshot is retained separately as the before-change backup. Each captures one atomic application-state document and collection indexes, not Atlas users/roles, network configuration, environment secrets, provider credentials, deployment code or point-in-time recovery. The temporary restored databases never ran the application or sent mail. They were destroyed after comparison. No production database was replaced or restarted.

The repeatable verifier is `Backend/scripts/verify-handover-backup.js`; the archive format is implemented in `Backend/backupArchive.js`. It deliberately offers no production restore command. Supply an installed `mongodb-memory-server` module for a disposable target, private non-nested backup/key directories outside the repository, and an explicit environment file:

```sh
QA_MONGO_MODULE=/absolute/path/to/mongodb-memory-server/index.js \
node Backend/scripts/verify-handover-backup.js \
  --env-file .env \
  --backup-dir '/private/approved/backup-directory' \
  --key-dir '/different/private/key-directory' \
  --evidence docs/qa/authorized-restore.json
```

Run only with authorization for that source database. The verifier reads the source, generates a separate loopback MongoDB, restores there and stops it after the checks. It does not print database URIs, passwords or document diffs. Never send the key, archive or unredacted database state to logs or Git.

For an actual disaster recovery: obtain owner approval, choose an isolated recovery database, verify exact recovery first, revoke restored sessions, rotate any credentials that were exposed before the snapshot, reconcile writes newer than the snapshot and test the restored application with controlled email before switching traffic. A successful old snapshot restore must not silently re-enable exposed accounts or overwrite newer journeys.

References: [MongoDB BSON driver format](https://www.mongodb.com/docs/drivers/node/current/data-formats/bson/), [Atlas backup and restore options](https://www.mongodb.com/docs/atlas/backup-restore-cluster/). This application snapshot is not a replacement for a reviewed database-provider backup/retention policy.

## Credential Rotation Handoff

Initially, the publicly documented admin password was accepted by the live API and stored student/conductor hashes also matched published fixtures. The owner then explicitly authorized rotating only these three accounts, revoking their sessions and saving new random passwords privately outside Git. [Rotation evidence](qa/2026-09-25-handover/credential-rotation.json).

`Backend/credentialRotation.js` validates all three expected identities and current published-password matches before modifying anything. An owner-authorized maintenance operation used the existing scrypt format and revision-based MongoDB compare-and-swap, preserving unrelated data. It removed 103 stored sessions and any outstanding reset challenges belonging only to those accounts. No role/email/assignment was changed, no account was disabled, and no real student account was converted into an administrator. The operation was tested before use; no reusable web reset bypass or backdoor was added.

Live verification: each old password returned 401, each new private password returned 200 with the correct role, the held pre-rotation admin token returned 401, and every successful verification session was logged out with 200. A subsequent read-only database scan found zero matches against the published fixture passwords. This is not a claim that every password or provider secret has been audited.

Owner-only handover file: `/Users/vansh/Library/Application Support/SmartTransit/PrivateHandover/credentials-f5O8Rl/SMARTTRANSIT_PRIVATE_CREDENTIALS.json`. File mode 0600, directory mode 0700. It contains real credentials; never commit, upload, print or share it as demo documentation. The password values are absent from these reports and command outputs. Place them in the owner's password manager. Local `docs/LOGIN_CREDENTIALS.txt` remains for isolated fixtures only and no longer authenticates these production accounts.

The owner confirmed the demo admin inbox is not controlled and no unused university inbox is available. Email-based recovery for the fixture accounts remains unresolved. Establish an approved recovery/ownership process before university handover; do not silently change another student's role or relax the student-domain rule. Browser-based new-password entry must remain private to the owner.

Provider secrets (MongoDB database user, mail API/SMTP credentials and OTP secret) have not been rotated or certified. No provider account is inferred to be compromised solely because fixture application passwords are public. Confirm owner access and plan coordinated environment changes before rotating service credentials, to avoid breaking live storage/mail delivery.

## OnePlus GPS Test

Device supplied by owner: OnePlus Nord CE 4 Lite. Android, OxygenOS and Chrome versions are not yet recorded. No emulator/mock location is a substitute for this test.

At this session's setup, the isolated app is `http://127.0.0.1:5184`, with API `http://127.0.0.1:50267/api`. It uses a fresh temporary JSON store and captured mail, not production MongoDB or real alerts. Ports can change on a later restart; read the startup output.

Owner setup:

1. Connect and unlock the phone with a data-capable USB cable. Enable USB debugging in Developer options and authorize only the known Mac.
2. In Mac Chrome, open `chrome://inspect/#devices`; enable Discover USB devices.
3. In Port forwarding, map device port 5184 to `127.0.0.1:5184` and device port 50267 to `127.0.0.1:50267`. Enable forwarding.
4. Open `http://localhost:5184` in phone Chrome. Use the isolated fixture driver, not a production account. Confirm the test API is reachable before starting anything.

The internal Chrome setup page is not accessible to the automation tool; it was not bypassed through another interface. The owner reported that the phone page did not open, then supplied a screenshot showing **Offline / Pending authentication: please accept debugging session on the device**. Both Mac endpoints were checked again and returned 200. USB authorization still failed after owner troubleshooting. No remote-control extension, APK or Android platform-tools package was installed. Device serials from the screenshot are deliberately excluded from evidence.

The owner subsequently approved an independent, access-protected HTTPS phone test instead of remote device inspection. A temporary checksum-verified Cloudflare connector forwards only the new protected static-build/API gateway; it does not expose the source tree or production. Fresh random test credentials, disabled email, two-hour expiry and isolated JSON storage are described in [PHONE_GPS_TEST.md](PHONE_GPS_TEST.md). This is not a workaround to access Chrome's internal inspection page. A safety check prevented an all-role external login probe before it ran. The owner explicitly approved the narrower driver-only check, which passed through both API and actual Chrome form submission after correcting the test gate's form referrer policy. The 390px driver page has no horizontal overflow or uncaught page exceptions. Logout left zero sessions, with no started trip or GPS records. Actual phone GPS remains untested.

Initial real-device evidence: the owner supplied a OnePlus Chrome active-trip screenshot. The isolated store contains a phone fix reported at 15:36:53.959 UTC and accepted at 15:36:54.139 UTC, with reported accuracy 3 m and speed 0.5 km/h. This confirms at least one real phone-to-server acceptance; it does not certify continuous/background updates, actual accuracy or route ETA accuracy. No precise personal coordinates are included in reports. The stationary ETA explanation is expected below 1 km/h, despite the UI rounding 0.5 to 1 km/h. See [sanitized phone evidence](qa/2026-09-25-handover/phone-gps-test.json).

Supervised checklist; initial phone-page/trip/fix acceptance is observed, all further behavior remains pending:

- Record device/OS/browser versions and location permission setting, without recording device serials.
- Before a trip, confirm no phone sharing; deny location once and check recovery guidance. Restore permission voluntarily for the test.
- Start the isolated assigned journey through its normal checklist. Permit precise location while the site is in use. Keep the phone outdoors with a clear view, while stationary or walking safely, never operating it while driving.
- Confirm a real phone fix is accepted by the test API; compare the actual fix/acceptance timestamp with a separate local student/admin view after its next poll. Keep precise personal test coordinates out of committed screenshots/reports.
- Observe several minutes of movement. Verify freshness/accuracy handling, no impossible jump acceptance, and correct stale state if samples stop. Testing at home does not prove the campus route's stop passage or road ETA accuracy.
- Test backgrounding, a short screen lock and reopening. Record actual behavior; browser-only GPS is not promised to continue uninterrupted in the background.
- Test connection loss and recovery without logout or pretending old coordinates are fresh. With USB forwarding, disabling mobile data alone does not disconnect the local API; interrupt the forwarded test API deliberately instead. Do not confuse a lost map-tile connection with a lost API connection.
- End the isolated trip and log out; verify uploads stop and no previous-trip fix becomes the next trip's location. Remove only the test port forwards and revoke USB debugging access when done.

Sources: [Android developer options](https://developer.android.com/studio/debug/dev-options), [Chrome USB port forwarding](https://developer.chrome.com/docs/devtools/remote-debugging/local-server). These setup sources do not prove any device test passed.

## Stop Verification

[Full review list](STOP_LOCATION_REVIEW.md) includes every current stop and a map link. Owner supplied separate selected-place links for Electrotherm and Saanvi. Those are now applied live; the two corrections were approximately 1.1 km and 0.8 km from the previous pins. Stop names, IDs, ordering, schedules and other coordinates stayed unchanged. No active trip was interrupted.

The remaining university/campus discrepancy is about 317 m between IU-R9 and IU-R1 through IU-R8. The exact boarding bay requires a transport-office reference. Do not convert a general university address, business centre or map viewport centre into an asserted pickup location. Opposite-direction roadside points also require confirmation.

## Controlled Email Test

The owner authorized one test to their connected Gmail. The live signup endpoint returned 400 before sending, as the existing university-domain restriction requires. [Rejected-Gmail evidence](qa/2026-09-25-handover/email-delivery.json). No account was created and no email was sent by that request; the restriction was preserved.

The provided university address initially used `iie`; the existing account uses `iite`. The owner confirmed the latter before any message was attempted. At 13:37:34 UTC, one live `/auth/password-reset` request for that existing controlled student inbox returned 200/accepted with a ten-minute expiry. The owner then confirmed **Received in Inbox**. [Delivery evidence](qa/2026-09-25-handover/university-email-delivery.json). No OTP was disclosed and no reset-confirm request was made; the real student's password and role remain unchanged.

Receipt is owner-observed, not independently read through a university-mail connector. SPF/DKIM/DMARC headers, exact receive latency, other mail providers and long-term delivery reliability are NOT TESTED. One received message is not a delivery SLA. No message was sent to the uncontrolled demo admin inbox.

Existing local SMTP settings and the hosted Brevo configuration are not assumed to be interchangeable. No real email-provider key was printed or copied into frontend configuration.

## Local Regression Results

- `node --test Backend/tests/backupArchive.test.js`: 2 passed. Round-trip/date preservation, fresh nonce, absence of known plaintext, wrong-key, tamper and truncation rejection.
- `node --test Backend/tests/credentialRotation.test.js`: 2 passed; three-account-only changes, session/reset-challenge revocation, unrelated data preservation and atomic rejection of changed identity/password/weak/incomplete plans.
- `npm run check`: exit 0; lint passed, **132 tests passed, zero failed/skipped**, production build passed. [Full log](qa/2026-09-25-handover/check.log). No new application dependency, migration, UI redesign or runtime change.
- Subsequent HTTPS phone setup: `npm run check` passed **136 tests**, lint and build; four new isolated gateway regressions added. The launcher also built the temporary test frontend with its own HTTPS API origin. No application dependency or production configuration changed.
- Read-only backup, exact disposable restore and private file permissions verified as described above.
- A bounded scan of 292 repository/build text files found none of the three new private passwords. Only match counts/filenames were reported; no credential values were printed. This is a targeted leak check, not an exhaustive secret audit.
- Live API accepted the two approved pins with HTTP 200; new API and MongoDB reads matched both. Both short-lived audit admin sessions were logged out with HTTP 200.

The previous 28 browser scenarios/33 MongoDB regressions remain evidence from the earlier audit, not a newly repeated phone/email test. The broader untested items in QA_COVERAGE.md remain open. Code fixes on the local audit branch are not deployed by these data checks.

New local files in this follow-up: `Backend/backupArchive.js`, `Backend/credentialRotation.js`, their two test files, `Backend/scripts/verify-handover-backup.js`, this report, `docs/STOP_LOCATION_REVIEW.md` and sanitized handover evidence. Existing README/QA reports link the updated results. No existing user work or file was removed.
