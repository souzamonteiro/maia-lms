# Validation record — 2026-09-27

Local validation of the MVP delivery, using Node.js 24.18.1:

- `npm run build`: all workspaces compiled in dependency order.
- `npm run lint`: no errors.
- `npm test`: 28 passing tests; policies, migrations, authentication, HTTPS cookies behind a proxy, permissions, idempotent enrollment, access/revisions/progress, session revocation, leases/retries, SMTP and backup/restoration.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e`: passed in Chrome; an administrator creates/publishes a course, a learner registers/signs in/enrolls/completes a lesson and checks progress. Script markup is displayed as text.
- `npm audit` and `npm audit --omit=dev`: no vulnerabilities reported during this validation.
- `npm ci --dry-run`: consistent lockfile.
- Installers: Bash syntax and host/VPS dry runs passed.
- Actual CLI from the maia-edge repository: registration and planning of the HTTPS route `learn.maiaplatform.org → 10.77.0.2:3200` in temporary state with a test certificate; no infrastructure changes applied.
- Compose, OpenAPI and CI YAML parsed without errors.

Not run in this environment: actual systemd installation on host/VPS, Docker build
(Docker unavailable), TLS issuance/renewal, public DNS, external SMTP, load tests
or a full accessibility audit. CI configures Node.js 22/24, a browser and Docker
builds, but remote CI execution is not part of this record.

These results cover the MVP documented in the README at that stage. They do not
validate future video, commerce, quiz or certificate features.

## Authoring and homepage — 2026-09-27

Local validation of the first E1 implementation: `npm run build`, `npm run lint`,
`npm test` (38 tests, 8 files) and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e`
(3 tests) passed. `npm audit` reported no vulnerabilities.

Added coverage: migration 004 over a legacy fixture, publication independent of
drafts, enrollment revisions, conflicts, permissions, Markdown sanitization,
homepage selection/scheduling, local recovery and changing language without losing
content. The mobile test checks a 390px Chrome viewport; it does not qualify actual
devices. Session lookups during navigation no longer consume the login-attempt
quota; credential rate limiting remains tested.

There was no deployment or production database access. Video and other stages in
the [TODO](../TODO.md) remained pending at this stage; see the [authoring guide](12-authoring.md).

## MP4 video — 2026-09-28

Build, lint, 41 automated tests (with `VIDEO_TEST_REAL=1`), four Chrome tests and
three installer/proxy tests passed. FFmpeg and FFprobe were made available in a
temporary directory for local tests without installing system packages on the
host. The browser test uploaded a real MP4, waited for processing, published the
lesson and verified that playback time advanced.

New coverage includes path confinement/symlinks, stream failure, immutable originals,
concurrent chunks, SHA-256, origin, permissions, size limits, cancellation, exclusive
claims, conversion/poster generation, invalid files, Range/HEAD/416 and revocation.
The full test identified HTTP quota consumption by static files: the limit now
covers the API, and uploads have a separate per-user limit.

Deployment, Docker build, Safari/Android, load and HTTPS-through-VPS tests were not
run for this delivery. HLS and captions were not yet available at this stage.

## Supplementary materials — 2026-09-28

Build/lint, 43 automated tests with real video and five Chrome workflows passed.
The new workflow uploads PDF, ZIP and source code through the editor, fills in
descriptions, publishes and checks downloaded contents. HTTP tests check
authorization, revocation, preservation of earlier revisions, cross-course
relationships and blocking publication before READY. Type validation includes
PDF/ZIP signatures and rejection of binary files disguised as source code. This
is not malware validation. No deployment was performed for this delivery.

## Captions and transcripts — 2026-09-28

Build/lint, 45 automated tests and five Chrome workflows passed. The video workflow
imports WebVTT, preserves tracks when changing interface language, loads cues in
the player and opens the transcript. The API rejects access without enrollment,
from an unassigned revision or after enrollment revocation; older captions remain
available after a new publication. Invalid format, markup, duplicate languages and
oversized input are tested. No deployment or Safari/Android qualification was performed.
