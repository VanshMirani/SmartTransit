# Production Deployment Verification - 25 September 2026

## Authorization And Release

After the local audit and GitHub branch push, the owner explicitly requested publishing the changes to the live website. This supersedes the earlier no-deployment restriction for this release only. No account reset, operational-data cleanup, GPS simulation, email or emergency submission was performed in production.

- Released commit: `3a956723adc0194abde3401664e76e60c2235e27`.
- `main` was fast-forwarded from `4387358ec299484a03fbadd5ad95b34660e27056`; no force push or history rewriting.
- The GitHub connector could not create a pull request (integration permission 403). Publication used the existing authorized Git connection instead. No pull request was created.
- Preserved the unrelated local `DEPLOYMENT.md` deletion and older local evidence.

## Hosting Results

| Component | Result |
| --- | --- |
| Website | https://smart-transit-lyart.vercel.app/ |
| Frontend deployment | `dpl_J3SU349kensWt2tp2JLh857v3fdD`, production, READY, exact released commit |
| Frontend alias | Existing public domain points to the new deployment; no new domain or project |
| Backend service | `srv-da4uebu1egvs73ab5j0g` |
| Backend deployment | `dep-dar66sjl550s73d3gbh0`, live at `2026-09-25T12:06:09Z`, exact released commit |
| Backend URL | https://smarttransit-api-0c4n.onrender.com/api |
| Trigger | Existing Git auto-deployment on both hosts; no duplicate manual deployment |

Vercel already uses Node 24. Render remains configured for Node 20: approval to upgrade was requested and not received before this release. `npm exec --yes --package=node@20 -- npm run check` passed lint, all 118 tests and build using Node **20.20.2**, in addition to the prior Node 24.19.0 audit. Node 20 lifecycle risk remains; compatibility testing is not a support-lifecycle endorsement.

## Configuration And Read-Only Verification

Render environment values were validated in memory through its authenticated API. Only booleans, variable names and non-secret runtime settings were reported. The new secret/origin startup requirements passed; MongoDB storage, the expected frontend origin and required mail/database settings were present. No environment variables were changed. `NODE_ENV` was not explicitly listed as a service override; the running host's inherited value was not independently inspected.

- All **11** public GET checks passed: homepage, login, protected frontend deep link, unknown SPA path, favicon, manifest, logo, API health, and three unsigned API rejection checks.
- API health returned 200; unsigned session/student/admin requests returned 401.
- Confirmed frontend `nosniff`, referrer policy, same-origin geolocation permission, report-only CSP, and private-route `noindex` headers.
- Confirmed API `Cache-Control: no-store`, `nosniff`, and the correct allowed frontend origin.
- Confirmed absolute HTTPS social-image URL. Actual social-platform preview generation was not tested.
- Browser checked the rendered homepage, sign-in navigation/title, password-recovery page without submission, and unauthenticated tracking redirect to login. No warning/error entries were recorded in that browser session.
- Render CLI error-log query for this service from `2026-09-25T12:05:00Z` completed successfully with no matching error records. This is a short post-release observation window, not continuous monitoring.
- Public unknown routes still return the static SPA shell with HTTP 200; this is distinct from its client-rendered 404.

Read-only response evidence: `docs/qa/2026-09-25-deployed/public-http.json`. The prior baseline evidence was not overwritten.

## Scope And Remaining Work

Authenticated production workflows were not re-exercised because doing so would change real records. Their isolated multi-role/MongoDB results are in `QA_AUDIT_2026-09-25.md`. No production credentials were tried, reset or exposed. Exposed demonstration-account rotation status, real-phone background GPS, external mail delivery, actual road/stop validation, backup/restore and operator acceptance remain open.

This document records a successful deployment and bounded smoke checks, not full university production certification. CSP remains report-only and does not enforce blocking.

## Rollback Reference

- Previous frontend: `dpl_A4hJ3sMrBXCAfr6zySfVbqrqetR3`.
- Previous backend: `dep-danrm44s728c73b3ec70`.
- Previous production commit: `4387358ec299484a03fbadd5ad95b34660e27056`.

If rollback is needed, use the host's existing previous-deployment controls for both components under explicit approval, or prepare a reviewed revert commit. Do not force-push main or restore/delete database records simply to roll back code. This release contains no database migration. No rollback was performed.
