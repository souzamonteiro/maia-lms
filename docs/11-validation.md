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

## Rendering policy versioning — September 28, 2026

EDIT-02 was completed locally with migration 008. Validation:

- `npm run build` and `npm run lint` passed.
- `npm test -- --reporter=dot`: 47 passed; the optional real-video processing test
  was skipped because `VIDEO_TEST_REAL` was not enabled for this content-only change.
- `npm run test:e2e -- tests/e2e/authoring.spec.ts`: both Chromium workflows passed,
  covering safe preview, editing, language switching, autosave, conflicts, recovery,
  reordering, and homepage curation.
- Migration tests preserve existing plain/Markdown bodies and enrollment/progress;
  HTTP tests check preview/lesson policy parity and reject client policy selection
  by always assigning the server policy. Unknown stored policies fail closed.

This validates local content rendering and authoring, not deployment or the complete
video platform. No production migration or deployment was performed.

## Focused studio and drag ordering — September 29, 2026

Local validation for the EDIT-03 increment:

- `npm run build` and `npm run lint` passed.
- `VIDEO_TEST_REAL=1 npm run test:e2e`: all six Chromium workflows passed, including
  real video upload/playback and PDF/ZIP/source attachment downloads.
- The new browser scenario switches editing sections and all three interface
  languages without losing content, reveals hidden invalid fields, drags lessons
  and modules, checks persisted ordering/content, and checks mobile overflow.
- Existing authoring tests still cover keyboard ordering, autosave, conflicts,
  local recovery, sanitized previews, and preservation of published content.

No database migration is required for this frontend delivery. No deployment was
performed. Complete learner/visitor draft preview and incremental per-unit saves
remain pending; the TODO retains EDIT-03 and EDIT-04 as open tasks.

## Draft audience preview — September 29, 2026

EDIT-03 now includes a saved-draft learner/visitor simulation. Local checks:

- Build and lint passed.
- Automated suite: 48 passed, one optional real-transcoding test skipped in this run.
- `VIDEO_TEST_REAL=1 npm run test:e2e`: all seven Chromium workflows passed.
- The two media browser workflows were then extended and rerun successfully to verify
  video playback, captions, and attachment downloads inside the draft preview before publication.
- HTTP tests cover unauthenticated access, another author, learner role, administrator
  access, restricted visitor content, public sample content, no-store responses,
  invalid audience, stale revisions, and absence of publication/enrollment side effects.
- The preview browser test checks sanitized Markdown, audience switching, Escape,
  focus restoration, preservation of editor content, and DRAFT status.

No deployment performed. The preview uses author media credentials; it does not
replace independent tests of real visitor/learner authorization or progress tracking.

## Incremental editing-unit saves — September 29, 2026

Local validation for EDIT-04:

- Build and lint passed; automated suite: 49 passed, one optional real-transcoding
  test skipped in that invocation.
- Seven existing Chromium workflows passed with `VIDEO_TEST_REAL=1`, including
  video, captions, attachments, draft preview, language switching, and conflicts.
- The new incremental browser test initially expected the wrong error wording.
  After correcting that assertion and adding reload recovery, its targeted rerun
  passed. It verifies a failed PATCH preserves local text, restores after reload,
  retries successfully, and never sends the unchanged lesson body.
- HTTP tests cover owner isolation, atomic rejection of invalid units, preservation
  of publication, stale revisions, and course/module/lesson updates without losing
  omitted content.

The server still writes complete immutable revisions. Structural edits use PUT;
this delivery does not reduce revision storage or merge conflicting editors.
No migration or deployment was performed.

## Publication readiness checklist — September 29, 2026

Build and lint passed. The automated suite passed 51 tests, with one optional
real-transcoding test skipped. All nine Chromium workflows passed with
`VIDEO_TEST_REAL=1`, including incremental recovery, draft preview, video/captions,
attachments, and the new checklist correction/publication flow.

New API tests verify owner isolation, all empty lessons reported together, failed
publication leaving DRAFT intact, stale revision rejection, and successful correction.
A database-backed validator test verifies cross-course READY media cannot pass,
invalid ordering is detected, and processing media remains blocked until READY.
No migration or deployment performed. Lesson duration presentation remains pending.

## Video duration in the studio — September 29, 2026

EDIT-05 completed locally. Build and lint passed; the automated suite passed 53
tests with one optional real-transcoding test skipped. Duration unit tests cover
fractional seconds, minute/hour boundaries, long videos, and invalid/missing values.

Both media Chromium workflows passed with `VIDEO_TEST_REAL=1`. The real-video
workflow verifies measured duration after processing, all three language labels,
and clearing/reselecting the video. The attachment workflow verifies no video
duration field appears in attachment controls. Publication, playback, captions,
preview, and downloads continue to work in those workflows.

No migration or deployment performed. Duration represents processed video playback
time; reading-time estimates and certificate workload are separate concerns.

## Private storage completion — September 29, 2026

Build and lint passed. The automated suite passed 56 tests, with one optional real
transcoding test skipped. New provider tests cover a 32 MiB streamed object, bounded
read chunks, the buffered-read cap, traversal/symlink rejection across read/stat/
delete/write, preservation of outside files, and replacement of the initialized
root with a symlink. Existing tests verify immutable writes, failed-stream cleanup,
and author isolation at the HTTP layer.

No UI changes, migration, or deployment were performed in this delivery. The chunk
size test is not an RSS benchmark or a production load test. The local storage
root still requires trusted service/operator ownership.

## Incomplete upload expiration — September 29, 2026

Build and lint passed. `VIDEO_TEST_REAL=1 npm test -- --reporter=dot` passed all
58 tests, including real FFmpeg processing. New cleanup tests verify the inactivity
window, reference protection, preservation of recent/READY/PROCESSING uploads,
canceled-upload cleanup, retry after a simulated deletion failure, idempotency,
and quota release. The HTTP upload test verifies that a committed chunk refreshes
activity. Existing migration tests apply migration 009 without altering enrollment
or progress. No deployment performed; the worker requires migration 009 before restart.

## Optional scanner integration and image materials — September 30, 2026

The scanner integration was tested using a controlled executable returning clean,
detected, and operational-error exit statuses. Only clean scans reached READY;
failed scans had no downloadable output. Missing executable and invalid configuration
were also tested. ClamAV and real signatures are not installed in this development
environment; real scanner validation remains pending. Its mode defaults to disabled.

Image validation uses real FFprobe/FFmpeg for PNG/JPEG normalization, forged/truncated
input rejection, and oversized dimension rejection. The browser material workflow
uploads a PNG, publishes it with its description, and downloads the normalized PNG
through the existing authorized attachment route. No migration or deployment was
performed for scanner integration or image attachments.

Validation results for this delivery: build and lint passed; all 60 automated tests
passed with `VIDEO_TEST_REAL=1`, and both Chromium media workflows passed, including
the newly added PNG upload/download. Scanner tests validate integration behavior,
not real malware detection effectiveness.

## Course covers — September 30, 2026

Build and lint passed. All 61 automated tests passed with `VIDEO_TEST_REAL=1`.
The existing seven non-media browser workflows passed; the two media workflows
passed after updating their controls for the new cover picker. The material flow
selects a processed PNG as cover, supplies alt text, publishes, and verifies that
the course image loads with the expected width.

HTTP tests verify required alt text, cross-course rejection, unpublished cover
protection, HEAD/content type, preservation while editing, and older-revision
access only for authorized users after republishing. No deployment performed.
Migration 010 is required for both the API and upload cleanup worker.

## Course presentation metadata — September 30, 2026

Build and lint passed. All 62 automated tests passed with `VIDEO_TEST_REAL=1`.
All six Chromium authoring workflows passed. New HTTP coverage verifies published
metadata remains unchanged during editing, lesson-only PATCH retains presentation,
and invalid level/workload/length values are rejected. Browser coverage verifies
preservation across all interface languages and literal rendering of author text,
including markup-like input, on the published course page.

Migration 011 is required before starting the updated API. No deployment performed.

## Instructor and course terms — September 30, 2026

Build and lint passed; all 62 automated tests passed with `VIDEO_TEST_REAL=1`.
All six authoring Chromium workflows passed. Extended HTTP assertions verify
published metadata stays unchanged, lesson-only saves preserve instructor/terms,
and length limits reject invalid values. Browser assertions verify preservation
across languages and escaped biography text, access terms, and the explicit
certificate-unavailable notice on the public course page.

Migration 012 is required for the API. No deployment performed; these fields do
not implement account profiles, access policy enforcement, or certificate issuance.
