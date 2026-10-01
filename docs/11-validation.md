No deployment was performed.
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

## Course trailers — September 30, 2026

Build and lint passed. All 63 automated tests passed with `VIDEO_TEST_REAL=1`,
and all nine Chromium workflows passed. The video browser workflow selects the
processed video as trailer, publishes it, and confirms real playback on the course
page before continuing to lesson playback.

HTTP coverage verifies pending-video rejection, owner/admin draft access, rejection
of other authors, public trailer Range/HEAD/poster delivery, invalid ranges, private
lesson isolation, unchanged public playback during draft editing, removal of old
public access after republishing, and cross-course selection rejection.
Migration 013 is required for the API and upload cleanup worker. No deployment
performed. Trailer-specific captions remain unsupported; lesson captions are separate.

## Paginated catalog and filters — September 30, 2026

Build and lint passed. All 64 automated tests passed with `VIDEO_TEST_REAL=1`,
and all ten Chromium workflows passed.

HTTP coverage uses more than 100 courses to verify pagination beyond the legacy
first-page limit, stable ordering, combined filters, literal wildcard searches,
empty results, invalid query rejection, and isolation of unpublished metadata.
The default response remains an array; `format=page` returns pagination metadata.

The anonymous browser workflow verifies 12-course pages, query preservation across
navigation and reload, independent interface/content languages, empty filter
results, browser back navigation, and layout at a 390-pixel viewport. Catalog
fixtures are seeded directly into the isolated browser-test database to avoid
spending the application's request budget on fixture setup.

No new migration or deployment was performed for this increment. HOME-03 remains
open for manageable categories and taxonomy.

## Managed categories — September 30, 2026

Build and lint passed. All 66 automated tests passed with `VIDEO_TEST_REAL=1`,
and all eleven Chromium workflows passed. The OpenAPI YAML parses successfully.
HTTP coverage verifies administrator-only taxonomy mutations, validated fields,
unique slugs, stale-version conflicts, deletion of unused categories, protection
of historical references, assignment limits, preservation during incremental saves,
published/draft separation, preview data, and composable catalog filtering.

The new browser workflow creates and renames a category, verifies literal rendering
of markup-like names, preserves category/form selections across all three interface
languages, publishes a categorized course, follows its catalog link, combines filters,
and verifies deletion rules. Existing catalog coverage also caught and now guards
against edits being lost while language changes wait for taxonomy loading.

Browser tests share one server/IP and now inspect the rate-limit response headers
before each workflow, waiting for the next window when the remaining budget is low.
Production rate limits are unchanged. The full suite passed in approximately
1 minute 24 seconds, including real FFmpeg media processing and playback.

Migration 014 is required before the updated API starts. Existing courses remain
uncategorized. No deployment performed. The taxonomy is flat and its authored text
is shared across interface languages; category assignments are revision-bound,
while category metadata updates are immediate.

## Localized account workflows — September 30, 2026

Build and lint passed. All 71 automated tests passed with `VIDEO_TEST_REAL=1`.
The new multilingual account browser workflow and the existing complete learner
workflow both passed in Chromium. Account HTTP tests verify queued verification and
recovery subjects/links in en, pt-BR and es, English fallback for a legacy locale,
recovery using the saved locale despite a different request locale, unchanged 204
responses for unknown accounts, and stable errors for duplicate registration,
invalid credentials, used/expired tokens and password length.

Browser coverage checks registration payload locale and translated login errors in
all three languages, retained form input while switching languages, and absence of
the entered password from local/session storage. Existing reset tests still verify
single-use tokens and session revocation. Real SMTP delivery was not exercised;
these tests validate the transactional outbox payloads and browser behavior.
No new migration or deployment performed. I18N-01, I18N-02 and AUTH-01 remain partial.

## Email verification confirmation — September 30, 2026

Build and lint passed. All 73 automated tests passed with `VIDEO_TEST_REAL=1`,
and all fourteen Chromium workflows passed in 34.5 seconds, including real video
processing/playback and material downloads. OpenAPI YAML parses successfully.

HTTP tests verify non-consuming page delivery, language hints in newly queued email
links, atomic single-use POST confirmation under competing requests, compatibility
with legacy GET links, and rejection of expired, malformed and password-reset tokens
without changing account verification. Browser coverage checks explicit confirmation,
pending/success controls, success preserved across language changes, all three
interface languages, and invalid/expired/already-used feedback.

Each browser workflow now models an independent client address behind the loopback
proxy configured only in the isolated E2E server. Browser and HTTP request contexts
share that workflow's address. This replaces waiting for a shared global request
window and avoids exhausting the authentication window across unrelated test users.
Application rate limits remain enabled and unchanged.

No new migration or deployment performed. Real SMTP delivery was not exercised.
Verification resend, account preference synchronization and the remaining AUTH-01
requirements remain pending.

## Learner lesson navigation — September 30, 2026

The focused API test verifies ordered navigation, preview filtering without
restricted-title disclosure, and full revision navigation for an enrolled learner.
The Chromium learning workflow verifies the outline and next/previous links, changes
the interface among English, Portuguese, and Spanish without losing lesson context,
checks the dashboard's localized Continue learning action in all three languages,
and confirms course progress remains based on explicit completion. Build and lint
passed. The complete Vitest suite passed 72 tests; two optional real-video tests were
skipped because `VIDEO_TEST_REAL=1` was not enabled. The full Chromium suite passed
12 workflows; its two real-media workflows were skipped for the same reason. The
focused API suite passed all 29 tests, and the focused learner workflow passed
again after adding the three-language dashboard assertions. Three focused unit
tests cover pause during an in-flight save, interval throttling, and visitor
no-write behavior. No deployment or device/browser qualification beyond Chromium
was performed.

## Persisted interface-language preference — September 30, 2026

The HTTP suite verifies authenticated locale updates for en, pt-BR, and es, checks
that `GET /auth/me` returns each saved value, rejects unsupported locales, and
rejects anonymous updates. The Chromium account-language suite passes both workflows;
it confirms signed-in selector changes are persisted and a fresh browser context
with an English browser locale adopts the account's Spanish preference after login.
It also verifies recovery emails use the saved account locale even when a different
locale is supplied with the request. Focused validation passed: 31 API tests and two
Chromium workflows. The complete real-media suite passed all 80 automated tests and
all 15 Chromium workflows; build, lint, OpenAPI parsing, and `git diff --check` passed.
No deployment was performed.

## Recoverable full-disk upload failure — September 30, 2026

The API integration test simulates `ENOSPC` during chunk storage and verifies HTTP
507 with `UPLOAD_STORAGE_FULL`, unchanged offset/chunk metadata, and successful retry
at that offset after storage recovers. The real-video Chromium workflow simulates
the 507 response, checks a localized recovery message, resumes the same selected
file, and observes the error notice clear after success. The focused video HTTP
suite passed five tests (one optional real-video test skipped in that invocation),
and both focused video browser workflows passed with media enabled. This tests
application recovery behavior, not an actually full production filesystem. No
deployment was performed.

## Playback position save race — September 30, 2026

The new position-saver unit tests passed for the in-flight pause race, the
15-second timeupdate throttle, and suppression of writes for public viewers.
`npm run build` and `npm run lint` passed. With FFmpeg/FFprobe available,
`VIDEO_TEST_REAL=1 npm test -- --reporter=dot` passed all 77 tests with no skips.
`VIDEO_TEST_REAL=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome
npm run test:e2e` passed all 14 Chromium workflows, including real video upload,
processing, and playback. The learner video workflow blocks the first position
request, pauses at a later position, confirms the trailing save, reloads the lesson,
verifies restoration, then opens a second Playwright browser context with an
isolated cookie jar, signs in again, and verifies the same lesson resumes there.
This confirms persistence across authenticated browser contexts in Chromium; it does
not qualify other browser engines, physical devices, or production behavior. No
deployment was performed.

## Recoverable full-disk upload failure — September 30, 2026

The API integration test simulates `ENOSPC` during chunk storage and verifies HTTP
507 with `UPLOAD_STORAGE_FULL`, unchanged offset/chunk metadata, and successful retry
at that offset after storage recovers. The editor translates the stable code in all
three supported languages. The focused video HTTP suite passed five tests, with the
optional real-video case skipped in that focused invocation. This tests application
recovery behavior, not an actually full production filesystem. The focused video
Chromium suite passed both workflows, including the localized 507 message, successful
retry, and clearance of the old notice. The complete real-media suite passed 78 tests
and all 14 Chromium workflows; build and lint passed. No deployment was performed.
