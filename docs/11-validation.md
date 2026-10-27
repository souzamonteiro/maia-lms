
No deployment was performed.

The account-security E2E was extended to switch among en, pt-BR, and es, verify the
localized password-field labels and mismatch feedback, then complete the change in
pt-BR. Its focused rerun passed. Full-suite validation for the current delivery is
recorded after the final runs below.
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
No new migration or deployment performed. I18N-02 and AUTH-01 remain partial.

## I18N-01 localized API errors and formatting — October 11, 2026

API and middleware failures now carry stable codes for localized display, including
authentication, authorization, validation, request parsing, rate limits, course,
lesson, enrollment, media, and upload states. Translation parity and placeholders
are tested for `en`, `pt-BR`, and `es`; numeric translation values, catalog page
counts, dates, and currency use locale-aware formatters. A Chromium regression
switches the admin user list date through all three locales. Full validation passed:
126 tests across 40 files, build/lint, and all 26 Chromium workflows. I18N-01 is
complete locally; I18N-02 course-language authoring/metadata and AUTH-01's remaining
account/MFA workflows remain separate open items. No deployment was performed.

## AUTH-01 account workflows — October 12, 2026

Account profile now supports private display-name edits and confirmed email changes;
the new address is not committed until its single-use token is confirmed, and
confirmation verifies it and invalidates prior sessions. The explicit policy allows
unverified users to sign in and learn but blocks certificate issuance until
verification. MFA tests cover encrypted TOTP setup, password-only challenge without
session creation, TOTP replay rejection, challenge lockout, one-use recovery codes,
auditing, and password-plus-factor disable with session invalidation. Email tests
cover current-password validation, duplicate addresses, old-address retention,
confirmation, replay/expiry, and session revocation. The outbox worker test covers
SMTP failure retry; account resend remains generic. Full validation passed 133 tests
across 41 files, build/lint, and all 28 Chromium workflows, including MFA recovery
and localized email-change confirmation. Live SMTP delivery and deployed host
runbook checks were not performed. No deployment occurred.

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
Chromium workflows. The complete real-media suite passed all 81 automated tests and
all 15 Chromium workflows; build, lint, OpenAPI parsing, and `git diff --check` passed.
No deployment was performed.

## Translation catalog completeness — September 30, 2026

A web unit test now checks that the union of interface-message keys is defined for
each supported locale and checks interpolation placeholders against English. Its
first run found `UPLOAD_STORAGE_FULL` missing from
pt-BR and repeated in the English catalog. The key is now defined in the en,
pt-BR, and es catalogs, and the focused completeness test passes. Build and lint
passed; the full real-media suite passed 81 tests and the Chromium suite passed 15
workflows. This guard checks key presence and placeholder parity; it does not
establish translation quality or complete all product flows in each language. No
deployment was performed.

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

## Verification email resend — October 1, 2026

The API suite verifies that unknown, pending, and already-verified accounts receive
the same 204 response; a resend invalidates the prior unused token and uses the
saved pt-BR locale despite a conflicting request locale. The account-language
browser workflow exercises the resend control and generic confirmation in en,
pt-BR, and es. The focused API suite passed 32 tests, and both focused account
Chromium workflows passed. The existing authentication limiter covers this route.
The full real-media suite passed 82 tests and all 15 Chromium workflows; build,
lint, OpenAPI parsing, and `git diff --check` passed. SMTP delivery and deployment
were not performed.

## Private account display name — October 1, 2026

Migration 016 adds a blank, private `users.display_name` for existing accounts. API
tests verify empty defaults, authenticated ownership, whitespace trimming, length
and empty-value rejection, and that email/role data remains unchanged. The account
security Chromium flow saves a display name in pt-BR and verifies it after a fresh
login. It is an account-only field, not a public instructor profile. No deployment
was performed.

Migration 016 also passed the complete migration/integration suite. The full
real-media run passed 86 tests; the full Chromium run passed all 16 workflows.
Build, lint, profile-path OpenAPI validation, and `git diff --check` passed. No
deployment was performed.

## Authenticated password change — October 1, 2026

The API tests verify that unauthenticated requests, wrong current passwords, and
reusing the existing password are rejected; successful changes revoke current and
parallel sessions and invalidate outstanding reset tokens. The account-security
Chromium flow checks confirmation mismatch feedback, successful change, forced
sign-in, rejection of the old password, and acceptance of the new password. The
focused HTTP suite passed 33 tests and the focused browser workflow passed.

## Lesson progress revision integrity — October 1, 2026

Migration 017 adds SQLite triggers that preserve revision agreement when progress
is inserted or reassigned, an enrollment revision changes, or a lesson moves to a
different module. The focused migration test verifies valid progress remains intact
and invalid cross-revision inserts and updates fail without changing the stored
row. Migration 018 also rejects negative and fractional progress positions through
direct database writes. Build and lint passed; the full real-media suite passed 87
tests across 22 files, and all 16 Chromium workflows passed. No deployment or
production migration was performed for those validations.

## Enrollment course/revision integrity — October 1, 2026

Migration 019 rejects enrollment inserts and updates when the revision belongs to a
different course, and prevents moving a referenced revision to another course. The
focused SQLite test covers each rejected mutation and confirms valid same-course
enrollment revisions remain subject to the progress invariant. Build and lint passed;
the full real-media suite passed 87 tests across 22 files, and all 16 Chromium
workflows passed. No deployment or production migration was performed.

## Course revision pointer integrity — October 1, 2026

Migration 020 rejects course inserts or updates that point `current_revision_id`
or `published_revision_id` to another course's revision, and prevents reassigning a
referenced revision to a different course. The focused SQLite test covers invalid
insert/update paths and verifies existing valid pointers remain unchanged. Build
and lint passed; the full real-media suite passed 88 tests across 23 files,
and all 16 Chromium workflows passed. No deployment or production migration was
performed.

## Lesson video ownership integrity — October 1, 2026

Migration 021 rejects lesson video links to uploads owned by another course or to
non-video media. It also prevents later course, revision, module, or upload changes
from invalidating an existing lesson-video relationship. Focused SQLite and
publication tests passed. Build and lint passed; the full real-media suite passed
89 tests across 24 files, and all 16 Chromium workflows passed. No deployment or
production migration was performed.

## Revision cover and trailer integrity — October 1, 2026

Migration 022 enforces same-course ownership and expected media kind for revision
covers and trailers, and rejects upload changes that would break those links. Its
focused SQLite test passes valid associations and rejects cross-course/type changes.
Build and lint passed; the full real-media suite passed 90 tests across 25 files,
and all 16 Chromium workflows passed. No deployment or production migration was
performed.

## Attachment ownership and ordering integrity — October 1, 2026

Migration 023 requires attachment uploads to belong to the revision's course and
have attachment media kind; a lesson-specific attachment must reference a lesson
in that revision. Triggers also guard later upload, lesson, module, and revision
changes. Focused SQLite and publication tests passed. Build and lint passed; the
full real-media suite passed 91 tests across 26 files, and all 16 Chromium
workflows passed. No deployment or production migration was performed.

Migration 024 prevents duplicate `sort_order` values within a revision's global
attachment list or a specific lesson's list, while permitting reuse in another
list. Its focused test covers collisions and valid cross-list reuse. Full
validation passed: build and lint, 91 tests across 26 files, and all 16 Chromium
workflows. No deployment or production migration was performed.

## Password-reset link rotation — October 1, 2026

Requesting password recovery now marks any earlier unused reset links as used
before issuing a new token. A focused API test confirms the prior link is rejected,
the newest link succeeds, and replay of that link fails. Build and lint passed; the
full real-media suite passed 92 tests across 26 files, and all 16 Chromium workflows
passed. No deployment performed.

## Lesson quiz revision integrity — October 1, 2026

Migration 025 requires a lesson-level quiz to reference a lesson in its own
revision. Final quizzes remain revision-level (`lesson_id IS NULL`). Triggers also
reject later changes to quiz, lesson, or module revision links that would break
that relationship. The focused migration test passed, including cross-revision
insert and update rejection. Build and lint passed; the full real-media suite passed
92 tests across 26 files, and all 16 Chromium workflows passed. No deployment or
production migration was performed.

## Assessment attempt reference integrity — October 1, 2026

Migration 026 requires each attempt's enrollment, quiz, and revision to agree, and
each answer's question to belong to the attempt's quiz. Triggers guard inserts and
updates that would create cross-revision attempts or cross-quiz answers. The focused
SQLite migration test passed. These are structural constraints only; attempt
limiting, grading, and immutable submission remain unimplemented. Build and lint
passed; the full real-media suite passed 93 tests across 27 files, and all 16
Chromium workflows passed. No deployment or production migration was performed.

## Assessment question ordering — October 1, 2026

Migration 027 rejects duplicate question `sort_order` values within one quiz on
insert or update, while allowing separate quizzes to reuse positions. The focused
quiz migration test passed. Existing question positions are not rewritten; quiz
authoring and grading remain unimplemented. Build and lint passed; the full
real-media suite passed 93 tests across 27 files, and all 16 Chromium workflows
passed. No deployment or production migration was performed.

## Order entitlement reference integrity — October 1, 2026

Migration 028 requires an order-backed entitlement to reference an existing order
for the enrollment's user and course. It blocks later order identity changes or
deletion that would break the reference. The focused SQLite test passed for valid
links and rejected mismatched user/course, missing orders, and invalid order
updates/deletion. Payment state, checkout, and refund policy are not enforced by
this migration. Build and lint passed; the full real-media suite passed 94 tests
across 28 files, and all 16 Chromium workflows passed. No deployment or production
migration was performed.

## Order snapshot immutability — October 1, 2026

Migration 029 requires a positive integer order price and rejects changes to
owner, course, price, currency, provider, or idempotency key after creation.
Operational state and checkout fields remain mutable. Focused SQLite tests passed;
payment state transitions, checkout, and refund policy remain outside this check.
Build and lint passed; the full real-media suite passed 94 tests across 28 files,
and all 16 Chromium workflows passed. No deployment or production migration was
performed.

## Provider payment and refund identifiers — October 1, 2026

Migration 030 rejects duplicate external payment or refund references within the
same provider while allowing identifier reuse across different providers. Refund
amounts must be positive integers. Focused SQLite tests passed for duplicate
insert/update rejection and valid cross-provider reuse. Cumulative limits are
covered separately below; provider reconciliation and commercial policy remain
unimplemented. Build and
lint passed; the full real-media suite passed 95 tests across 29 files, and all 16
Chromium workflows passed. No deployment or production migration was performed.

## Active certificate issuance integrity — October 1, 2026

Migration 031 allows at most one non-revoked certificate per enrollment and
supports reissue after revoking the prior certificate. The trigger approach does
not rewrite pre-existing duplicate active certificates; those require an explicit
operational review. The focused SQLite migration test passed.
Build and lint passed; the full real-media suite passed 96 tests across 30 files,
and all 16 Chromium workflows passed. No deployment or production migration was
performed.

## Append-only audit events — October 1, 2026

Migration 032 rejects updates and deletes on `audit_events` while allowing new
records. The focused SQLite test passed and verifies the original event remains
unchanged. This is not a retention/anonymization workflow; no audit rows were
deleted or modified. Build and lint passed; the full real-media suite passed 97
tests across 31 files, and all 16 Chromium workflows passed. No deployment or
production migration was performed.

## Cumulative refund snapshot cap — October 1, 2026

Migration 033 prevents pending plus approved refunds from exceeding the order's
price snapshot; rejected refunds do not reserve the cap. Focused SQLite tests
passed for exact-limit acceptance and over-limit insert/update/status rejection.
This does not reconcile against provider-captured amounts or define commercial
refund policy. Build and lint passed; the full real-media suite passed 97 tests
across 31 files, and all 16 Chromium workflows passed. No deployment or production
migration was performed.

## Provider checkout reference uniqueness — October 1, 2026

Migration 034 rejects duplicate non-null checkout IDs within a provider on insert
or update, while allowing reuse across providers and multiple orders with no
checkout ID. The focused SQLite migration test passed. Provider contract and
checkout flow validation remain open. Build and lint passed; the full real-media
suite passed 98 tests across 32 files, and all 16 Chromium workflows passed. No
deployment or production migration was performed.

## Order state transition integrity — October 1, 2026

Migration 035 enforces the documented order state graph, permits idempotent
same-state updates, and allows an authoritative late payment to move an expired
or canceled order to `PAID`. The focused SQLite migration test passed for allowed
and rejected transitions. Provider-state reconciliation remains unimplemented.
Build and lint passed; the full real-media suite passed 98 tests across 32 files,
and all 16 Chromium workflows passed. No deployment or production migration was
performed.

## Submitted assessment immutability — October 1, 2026

Migration 036 permits answer edits while an attempt is open, then rejects attempt
updates and answer inserts, updates, or deletes after `submitted_at` is set. The
focused SQLite test passed. Runtime submission, grading, attempt limits, and
feedback remain unimplemented. Build and lint passed; the full real-media suite
passed 98 tests across 32 files, and all 16 Chromium workflows passed. No
deployment or production migration was performed.

## Assessment definition snapshot — October 1, 2026

Migration 037 permits editing quiz settings and questions before an attempt
exists, then rejects quiz-setting changes and question insert/update/delete once
attempts reference that quiz. The focused SQLite test passed. This protects an
in-flight attempt's definition but does not create a quiz revisioning or authoring
workflow; grading and attempt policies remain open. Build and lint passed; the full
real-media suite passed 98 tests across 32 files, and all 16 Chromium workflows
passed. No deployment or production migration was performed.

## Assessment numeric bounds — October 1, 2026

Migration 038 requires integer pass percentages and positive integer attempt
limits, validates question points and order, and bounds awarded points to an
integer from zero through the question's point value. The focused SQLite test
passed. It does not define partial-credit or overall-score semantics. Build and
lint passed; the full real-media suite passed 98 tests across 32 files, and all 16
Chromium workflows passed. No deployment or production migration was performed.

## Assessment attempt limits — October 1, 2026

Migration 039 enforces `max_attempts` per enrollment and quiz on insert and
reassignment. Attempt rows cannot be deleted to restore quota. The focused SQLite
test passed for exact quota use, over-limit rejection, reassignment rejection, and
history retention. Atomic API start, expiration rules, grading, and feedback remain
unimplemented. Build and lint passed; the full real-media suite passed 98 tests
across 32 files, and all 16 Chromium workflows passed. No deployment or production
migration was performed.

## Timed assessment attempt bounds — October 1, 2026

Migration 040 adds an optional per-quiz positive integer time limit. The deadline is
derived from immutable `started_at`; answer writes and submission are rejected after
expiry. The focused SQLite test passed for invalid configuration, frozen settings/
start time, an expired attempt, and a quiz with no configured deadline. Runtime
attempt creation and expired-state feedback remain unimplemented. Build and lint
passed; the full real-media suite passed 98 tests across 32 files, and all 16
Chromium workflows passed. No deployment or production migration was performed.

## Enrollment assignment integrity — October 2, 2026

Migration 041 prevents changing an enrollment's owner, course, or assigned
revision after creation, even before progress or attempts exist; access `state`
remains mutable for revocation. Focused progress and assessment tests passed.
Moving learners to a newer revision requires an explicit future migration policy.
Build and lint passed; the full real-media suite passed 98 tests across 32 files,
and all 16 Chromium workflows passed. No deployment or production migration was
performed.

## Enrolled revision structure integrity — October 2, 2026

Migration 042 blocks module and lesson insert/update/delete operations once a
revision has an enrollment, including when no progress exists yet. Focused progress
and authoring migration tests passed, confirming new/unassigned revisions remain
editable. Existing learners retain their revision; moving them to a later revision
requires an explicit migration policy. Build and lint passed; the full real-media
suite passed 98 tests across 32 files, and all 16 Chromium workflows passed. No
deployment or production migration was performed.

## Certificate snapshot immutability — October 2, 2026

Migration 043 prevents changing an issued certificate's enrollment, public code,
confirmed name, payload hash, or issue time, and prevents deleting the historical
row. Revocation timestamp and reason remain mutable. The focused certificate
migration test passed, including revoke-then-reissue and rejected snapshot edits.

## Certificate public-code minimum — October 2, 2026

Migration 044 rejects new/updated public certificate codes shorter than 32
characters; existing codes are not rewritten. The focused certificate test passed.
Length alone does not guarantee randomness or unpredictability; code generation,
rate limiting, and public verification remain unimplemented. Build and lint passed;
the full real-media suite passed 98 tests across 32 files, and all 16 Chromium
workflows passed. No deployment or production migration was performed.

## Certificate revocation reason integrity — October 2, 2026

Migration 045 requires a non-empty reason whenever a certificate is inserted or
updated as revoked; active certificates may keep the reason null. The focused
certificate migration test passed. Actor attribution, authorization, and the
administrative revocation workflow remain unimplemented. Build and lint passed;
the full real-media suite passed 98 tests across 32 files, and all 16 Chromium
workflows passed. No deployment or production migration was performed.

## Irreversible certificate revocation — October 2, 2026

Migration 046 requires revocation time at or after issuance and prevents clearing
or moving the revocation timestamp backward. Later timestamps and reason corrections
remain possible. The focused certificate migration test passed; administrative
authorization and actor-attributed audit remain unimplemented. Build and lint passed;
the full real-media suite passed 98 tests across 32 files, and all 16 Chromium
workflows passed. No deployment or production migration was performed.

## Certificate supersession lineage — October 2, 2026

Migration 047 adds an optional immutable `supersedes_id` link for reissued
certificates. The predecessor must be revoked, belong to the same enrollment, and
may have only one direct successor. The focused certificate migration test passed.
The reissue interface, public lineage display, and actor-attributed audit remain
unimplemented. Build and lint passed; the full real-media suite passed 98 tests
across 32 files, and all 16 Chromium workflows passed. No deployment or production
migration was performed.

## Administrator account management and role delegation — October 2, 2026

Administrators can search/filter and paginate user accounts, then suspend or
reactivate an account, and assign learner, author, or admin roles. Tests verify
credentials are excluded from listings, actual changes increment `session_version`
and invalidate existing sessions, reactivation permits a new login, and audit
events are written once per actual change. Self-suspension, self-demotion, and
removing the last active administrator are rejected; worker role assignment is
unavailable. Build and lint passed; OpenAPI YAML parsed; the full real-media suite
passed 101 tests across 32 files, and all 17 Chromium workflows passed. No
deployment or production database changes were made.

The account-management UI is now available at `/admin/users`. Its Chromium flow
searches for a learner, suspends the account, verifies the existing browser is
redirected to sign-in, reactivates the account, confirms a fresh login works,
assigns the author role, verifies session invalidation again, and confirms a fresh
author session receives author navigation. Bootstrap/reset validation is recorded
below.

## Opt-in instructor profiles — October 2, 2026

Migration 048 adds a separate instructor profile with a unique public slug and
explicit opt-in. Authors and administrators can edit the public name, biography,
and HTTPS website independently from the private account display name. Public
lookups contain no account email or user ID and include only published courses;
course details link to the profile only while it is public. Integration tests
cover role authorization, private-by-default behavior, HTTPS validation, draft
filtering, unpublishing, and safe response fields. Build and lint passed; OpenAPI
YAML parsed; the full real-media suite passed 102 tests across 32 files, and all
17 Chromium workflows passed. No deployment or production migration was performed.

## Administrator bootstrap and reset — October 2, 2026

The host CLI creates verified administrator accounts transactionally and records
`admin.bootstrap`. Existing accounts are not changed without explicit `--reset`;
reset rotates the password, promotes the selected account to admin, increments
`session_version` to invalidate prior sessions, and records `admin.account_reset`.
Errors are concise and no default password is introduced. Subprocess integration
tests cover creation, refusal to overwrite, password rotation, role, session
version, and audit records. Build and lint passed; the full real-media suite
passed 104 tests across 33 files, and all 17 Chromium workflows passed. OpenAPI
YAML and `git diff --check` passed. No deployment or production database changes
were made.

## Administrator enrollment support — October 2, 2026

Administrators can search enrollments by learner email, course title, or slug,
review current entitlement and required-lesson progress, grant access to published
courses, revoke access with a required reason, and inspect chronological audit
history. Re-grants reuse an existing enrollment and preserve progress and prior
entitlements. Duplicate active grants and repeated revocations do not add duplicate
access-change events. The focused API integration test covers authorization,
history, access restoration, and persistence; Chromium covers the support UI.
Build and lint passed; OpenAPI YAML parsed; the full real-media suite passed 105
tests across 33 files, and all 18 Chromium workflows passed. No deployment or
production database changes were made.

## Certificate eligibility and record issuance — October 3, 2026

The learner-only preflight checks enrollment ownership, active access to a
non-withdrawn course, recorded completion, verified email, confirmed name,
publisher-declared workload, and revision instructor. It returns the exact public
disclosure fields and a versioned hash. Issuance requires explicit consent bound to
that hash, then rechecks eligibility and atomically stores one certificate with a
256-bit opaque code, immutable learner/course/workload/instructor payload, consent
timestamp/version, SHA-256 payload hash, and append-only audit event. Integration
tests cover blocked and stale-disclosure requests, concurrent requests/retries,
single issuance/audit, and payload/consent immutability. Migrations 053/054 backfill
only qualifying completion timestamps and require snapshots for new certificates
without inventing consent for historical rows. Build and lint passed; the full
real-media suite passed 115 tests across 34 files, and all 22 Chromium workflows
passed. OpenAPI YAML and `git diff --check` passed. PDF generation, learner
certificate UI, and institutional issuer policy remain open. No
deployment or production database changes were made.

## Public certificate verification API — October 3, 2026

Anonymous `GET /api/v1/certificates/verify/{code}` reads only the immutable
certificate snapshot and returns learner name, course title, declared workload,
instructor, issue time, and current valid/revoked status. It does not expose
enrollment IDs, email, payload/disclosure hashes, or private revocation reasons.
Malformed, unknown, and legacy certificates without snapshots share the same 404;
lookups are limited to 20 per minute per client and send `X-Robots-Tag: noindex, nofollow, noarchive` plus `Cache-Control: no-store`. Integration tests cover valid
and revoked results, privacy fields, generic not-found behavior, and HTTP 429.
Build/lint passed; OpenAPI parsed; the full real-media suite passed 115 tests across
34 files. QR, PDF, and the async artifact worker were implemented in the following
increment. No production migration or deployment was performed.

## Learner-facing certificate verification — October 4, 2026

Added the canonical `/certificates/verify/{code}` page to the existing web shell.
The page is localized in English, Brazilian Portuguese, and Spanish; renders only
the API's public snapshot fields; distinguishes valid and revoked certificates;
and displays a generic not-found message. The HTML response carries `X-Robots-Tag:
noindex, nofollow, noarchive`; API lookup retains its rate limit and `no-store`
policy. E2E coverage checks valid, revoked, and missing states plus the `noindex`
header and ensures private payload fields are not rendered. Build/lint passed, the
full suite passed 115 tests across 34 files, all 23 Chromium workflows passed, and
OpenAPI YAML plus `git diff --check` passed. The learner certificate dashboard
was implemented in a later increment. No deployment or production database changes were made.

## Certificate PDF and QR — October 4, 2026

Migration 055 adds artifact state and a private storage key. Issuance atomically
queues `certificate.generate`; the leased outbox retries failures, and the worker
stores a deterministic private PDF containing selectable learner/course/workload/
issuer/completion details and a QR plus clickable canonical verification URL.
Retries detect and reuse an artifact already written before a transient failure.
The authenticated download endpoint permits the certificate owner or an
administrator, returns `CERTIFICATE_PDF_NOT_READY` until ready, and streams with
`private, no-store` and `nosniff`. Tests parse the generated PDF to verify readable
text, confirm private storage/state and idempotent processing, exercise outbox
retry, and check ready/pending/unauthorized download behavior. Build and lint
passed; the full suite passed 117 tests across 35 files, all 24 Chromium workflows
passed, OpenAPI YAML parsed, and `git diff --check` passed. The learner certificate
list/download screen is covered in the validation entry below. No production
migration or deployment was performed.

## Learner certificate list — October 4, 2026

`GET /api/v1/me/certificates` lists only certificates owned through the learner's
enrollments and omits internal hashes. “My learning” displays course/name, current
valid or revoked status, issue date, and PDF processing state; it links to public
verification and offers a private download only when the PDF is ready. English,
Portuguese, and Spanish labels are provided. API integration verifies owner
isolation and pending/ready/revoked state transitions; Chromium verifies pending
has no download and ready does. Build/lint passed; the full real-media suite passed
117 tests across 35 files, all 24 Chromium workflows passed, OpenAPI parsed, and
`git diff --check` passed. No production deployment was performed.

## Certificate revocation and reissue — October 4, 2026

The admin-only `/admin/certificates` workflow supports search, private-reason
revocation, one-time reissue of a revoked predecessor, and private lineage/audit
history with clickable predecessor/successor anchors and verification links for
each preserved code. Reissue preserves the consented public payload, creates a new 256-bit
code and PDF job, and records immutable `supersedes_id` plus actor-attributed
`certificate.reissue`/`certificate.superseded` events. Old public codes remain
verifiable as revoked; only the replacement is valid. Repeating revoke is
idempotent; repeated reissue and reissue while an active certificate exists return
stable conflicts. API coverage verifies role isolation, filtered admin listing,
reason/audit attribution, lineage, outbox enqueue, and old/new code lookups.
Chromium verifies the admin revoke/reissue/history and lineage-link workflow. Build/lint passed;
the full suite passed 117 tests across 35 files, all 25 Chromium workflows passed,
OpenAPI parsed, and `git diff --check` passed. Public verification intentionally
does not reveal private reasons or lineage. No production migration or deployment
was performed.

## BASE-02 isolated prototype restore rehearsal — October 11, 2026

A new file-backed test creates a representative database at prototype migrations
001–003, writes accounts/authentication records, a published course and draft,
legacy media references, enrollment, entitlement, progress, and markup-like lesson
text, then backs it up to a second temporary SQLite file and runs all later
migrations twice. It verifies preserved identities/access/progress/content,
published-pointer backfill, legacy `plain` rendering, editorial promotions, home
settings, `integrity_check`, and `foreign_key_check`. The test passes. No actual
prototype database exists in the workspace (`data/` contains only storage files),
so BASE-02 remains open pending the same isolated rehearsal against a user-provided
prototype database copy. The focused migration test passed all four cases; the full
suite passed 123 tests across 40 files, build and lint passed, and `git diff --check`
was clean. No production database was accessed or changed.

## Course revision publication integrity — October 10, 2026

Migrations 061 and 062 reject direct deletion or ID changes for a revision
referenced by either the editable current pointer or the published pointer. The
focused SQLite test verifies that an unpublished current draft cannot be renamed or
deleted while referenced and can be deleted after its pointer is cleared. No
authoring or publication behavior changed. The focused migration test passed; no
production migration or deployment was performed.

## Published course pointer presence — October 11, 2026

Migration 067 rejects inserts or updates that leave a `PUBLISHED` course without
a same-course revision marked published. Direct-SQL tests cover clearing the public
pointer and attempting to point at a draft; catalog fixtures now follow the valid
draft-to-published sequence. The focused pointer/catalog tests passed. Build and
lint passed; the full suite passed 122 tests across 40 files, and all 25 Chromium
workflows passed. No production migration or deployment was performed.

Migrations 063 and 064 close the direct-SQL publication gap: a published revision's
metadata and its modules, lessons, attachments, category assignments, quiz
definitions, and questions cannot be changed or deleted. The focused test verifies
the actual publication ordering (public pointer first, `published_at` second),
rejects metadata and child-content edits, and confirms draft edits still work. No
authoring or publication route behavior changed. Build and lint passed; the full
suite passed 121 tests across 39 files, and all 25 Chromium workflows passed. No
production migration or deployment was performed.

Migration 065 rejects assigning `published_revision_id` to a same-course draft
revision. The course publication transaction now writes `published_at` before
switching the public pointer; both changes remain atomic. The direct-SQL pointer
test and 12 publication API tests passed. Build and lint passed; the full suite
passed 121 tests across 39 files, and all 25 Chromium workflows passed. One
Chromium run had a transient registration-page timeout in the learner flow; the
isolated test and the complete rerun passed. No production migration or deployment
was performed.

Migration 066 rejects updating or deleting a media upload used by a published
revision, protecting video/artifact keys and metadata from direct SQL rewrites.
The focused test covers output key, poster key, duration, and deletion after the
READY video is published in a lesson. Build and lint passed; the full suite passed
122 tests across 40 files, and all 25 Chromium workflows passed, including real
video playback and published attachment download. No production migration or
deployment was performed.

## Assessment attempt result integrity — October 4, 2026

Migration 056 rejects open attempts carrying a score/pass result and requires
submitted attempts to store an integer score percentage from 0 through 100 plus a
binary pass flag. The focused SQLite migration test exercises inconsistent open
state, out-of-range score, invalid pass flag, and a valid submitted result while
retaining the existing deadline and immutability assertions. No application route
behavior changed; this closes a direct-SQL invariant gap under DATA-01. No production
migration or deployment was performed.

## Course status transitions — October 11, 2026

Migration 068 rejects direct-SQL transitions outside the review, publication, and
archive state machine. The focused test rejects `PUBLISHED → DRAFT`, accepts
`PUBLISHED → ARCHIVED`, and rejects republishing an archived course; same-state
writes remain idempotent. Build and lint passed; the full suite passed 122 tests
across 40 files, and all 25 Chromium workflows passed. No production migration or
deployment was performed.

## Urgent withdrawal state — October 11, 2026

Migration 069 rejects setting `withdrawn_at` on a draft or on a course without a
valid published revision pointer, while preserving withdrawal for published and
archived courses. The focused direct-SQL test verifies both draft rejection and a
valid published-course withdrawal. Build and lint passed; the full suite passed
122 tests across 40 files, and all 25 Chromium workflows passed. No production
migration or deployment was performed.

## Enrollment availability invariant — October 11, 2026

Migration 070 rejects new enrollment rows for `REVIEW`, `ARCHIVED`, and withdrawn
courses, and requires a `PUBLISHED` course to use its exact public revision. The
focused direct-SQL test accepts the active public revision and rejects draft
assignment, archived status, and urgent withdrawal. Existing enrollments remain
unchanged. Build and lint passed; the full suite passed 122 tests across 40 files,
and all 25 Chromium workflows passed. No production migration or deployment was
performed.

## Entitlement provenance — October 11, 2026

Migration 071 makes `enrollment_id`, `source_type`, and `source_id` immutable on
entitlements. The focused SQL test reproduces relabeling an order-backed grant as
free and verifies the write is rejected. Order-reference integrity and entitlement
time-window tests pass together. Build and lint passed; the full suite passed 122
tests across 40 files, and all 25 Chromium workflows passed, including admin grant
and revoke. No production migration or deployment was performed.

## Course ownership — October 11, 2026

Migration 072 rejects changing `courses.author_id` after creation. The focused
direct-SQL test verifies an attempted transfer to another author is denied. Build
and lint passed; the full suite passed 122 tests across 40 files, and all 25
Chromium workflows passed. No production migration or deployment was performed.

## Certificate issuance lifecycle — October 11, 2026

Migration 073 rejects inserting a certificate with `revoked_at` already set,
requiring issuance to begin active and revocation to occur through the guarded
update lifecycle. The certificate regression test covers this direct-SQL bypass
alongside valid revoke-then-reissue. Build and lint passed; the full suite passed
122 tests across 40 files, and all 25 Chromium workflows passed, including
certificate revoke/reissue and history. No production migration or deployment was
performed.

## Certificate timestamp integrity — October 11, 2026

Migration 074 rejects unparseable certificate issuance and revocation timestamps.
The certificate test verifies malformed `issued_at` and `revoked_at` inputs fail,
while valid issuance, monotonic revocation, and reissue continue to pass. Build and
lint passed; the full suite passed 122 tests across 40 files, and all 25 Chromium
workflows passed. No production migration or deployment was performed.

## Certificate payload shape — October 11, 2026

Migration 075 rejects valid JSON that is not a verification-ready certificate
object, including missing display fields or a payload code that does not match the
row's public code. The certificate fixture now mirrors the endpoint payload. Build
and lint passed; the full suite passed 122 tests across 40 files, and all 25
Chromium workflows passed, including issuance, reissue, verification, and PDF
download. No production migration or deployment was performed.

## Certificate payload row consistency — October 11, 2026

Migration 076 rejects certificate inserts where payload `confirmedName` or
`issuedAt` disagrees with the immutable row columns. Direct-SQL coverage reproduces
a conflicting learner name and a conflicting issuance timestamp; valid issuance
and reissue fixtures remain consistent. Build and lint passed; the full suite
passed 122 tests across 40 files, and all 25 Chromium workflows passed, including
certificate reissue and PDF delivery. No production migration or deployment was
performed.

## Certificate payload revision consistency — October 11, 2026

Migration 077 requires the payload's course title, workload, instructor, and
completion time to match the enrollment's assigned revision and completion row.
Direct-SQL tests reject each of these four mismatches while valid issue/reissue
fixtures pass. The PDF worker fixture now mirrors the assigned revision and
completion snapshot. Build and lint passed; the full suite passed 122 tests across
40 files, and all 25 Chromium workflows passed. No production migration or
deployment was performed.

## Outbox retry-state integrity — October 4, 2026

Migration 057 rejects negative or non-integer retry counters, empty/orphan leases,
leases on processed jobs, and lease claims without a recorded attempt. The focused
SQLite test also verifies normal unclaimed, active-lease, failed/retryable, and
processed states. Existing outbox worker tests continue to cover lease exclusion
and failure backoff. No queue semantics or retry count were changed. Build/lint
passed; the full real-media suite passed 118 tests across 36 files, all 25 Chromium
workflows passed, OpenAPI parsed, and `git diff --check` passed. No production
migration or deployment was performed.

Migration 060 additionally prevents decrementing retry counts, replacing a lease
without claiming another attempt, releasing a lease without recording failure or
success, and clearing/re-writing a completed timestamp. The focused direct-SQL test
accepts claim, failure release, expired-lease reclaim, and success; it rejects job
reopening and lease theft. Existing worker integration verifies actual backoff and
retry. No worker semantics changed. Build/lint passed; the full real-media suite
passed 120 tests across 38 files, all 25 Chromium workflows passed, OpenAPI parsed,
and `git diff --check` passed. No production migration or deployment occurred.

## Entitlement time-window integrity — October 4, 2026

Migration 058 requires parseable entitlement start times and a parseable optional
end strictly after the start. The focused SQLite test accepts open-ended and valid
bounded grants and rejects malformed starts/ends, equal/reversed bounds, and
updates that would make a window invalid. No entitlement writer or access policy
changed. Build/lint passed; the full real-media suite passed 119 tests across 37
files, all 25 Chromium workflows passed, OpenAPI parsed, and `git diff --check`
passed. No production migration or deployment was performed.

## Video upload state transitions — October 4, 2026

Migration 059 allows only the upload lifecycle transitions used by the API and
worker: upload to queue/cancel, queue to processing, processing to ready/failure
(or same-state lease recovery), and failure to retry. READY and CANCELLED are
terminal, while same-state idempotent writes remain allowed. Focused tests cover
valid completion, failure/retry, worker recovery, cancellation, and rejected skips
or terminal rewrites; publication/covers/trailers fixtures now follow legal states.
Build/lint passed; the full real-media suite passed 120 tests across 38 files, all
25 Chromium workflows passed, OpenAPI parsed, and `git diff --check` passed. No
production migration or deployment was performed.

## Expired quiz attempt history — October 3, 2026

Timed-out open attempts now appear in the learner's private quiz history as
expired and consumed, with no score or answer feedback. Active open attempts
remain omitted, and starting a replacement still follows the configured attempt
limit. API integration verifies an expired attempt remains unsubmitted and is
listed without grading or answer details; build/lint and full-suite validation
passed: 112 tests across 33 files and 22 Chromium workflows. OpenAPI YAML and
`git diff --check` passed. No deployment or production database changes were made.

## Post-submit quiz explanations — October 3, 2026

Migration 050 adds optional question explanation text, defaulting to empty for
existing definitions. Authors edit the text in the revision-bound studio builder.
Active quiz and attempt payloads omit explanations and correctness markers; the
server includes selected/correct-choice indicators and explanation text only in
the submitted result and the enrolled learner's private result history. API tests
verify the pre-submit redaction and post-submit feedback, and Chromium verifies
the result review interaction. Build and lint passed; OpenAPI YAML parsed; the
full real-media suite passed 112 tests across 33 files, and all 22 Chromium
workflows passed. No deployment or production database changes were made.

## Course publication review — October 2, 2026

Authors can submit an owned draft for review after the shared publication
checklist passes. The API requires the expected current revision, writes a
`course.submit_review` audit event, is idempotent for an already-reviewed course,
and rejects submissions from non-owners or invalid course states. Administrators
publish the reviewed course through the existing publication validator. Direct
administrator publication remains compatible. API integration and Chromium tests
cover ownership, checklist failure, stale-state protection, review, and publish.
Build and lint passed; OpenAPI YAML parsed; the full real-media suite passed 107
tests across 33 files, and all 19 Chromium workflows passed. Scheduling and
notifications remain unimplemented; no deployment or production database changes
were made.

## Urgent course withdrawal — October 2, 2026

Migration 049 adds an immutable `withdrawn_at` marker and required reason. The
administrator studio action audits the actor/reason and is idempotent; normal
publishing cannot restore a withdrawn course. Learner access is rechecked at old
course, lesson, video, caption, cover, attachment, and progress-write URLs, and
withdrawn courses leave public discovery and new manual grants. Existing enrollment,
entitlement, and progress history remains stored; the learner dashboard shows the
historical entry without broken course/continue links. Real-media tests confirmed
previously usable video, caption, attachment, and cover URLs are denied after
withdrawal. Build and lint passed; OpenAPI YAML parsed; the full real-media suite
passed 108 tests across 33 files, and all 20 Chromium workflows passed. No
deployment or production database changes were made.

## Quiz definition API — October 3, 2026

Authors/admins can configure lesson or final quizzes on the current unpublished
revision, including keyed choices, question points/order, pass threshold, attempt
limit, randomization, and optional time limit. Saves are revision-checked,
ownership-checked, transactional, and audited; edits are rejected after attempts
exist. Learner reads require active enrollment and are bound to the enrollment's
revision, including historical revisions after a newer publication. The learner
payload omits correct-answer keys. API tests cover owner checks, invalid keys,
publication/membership gating, answer privacy, and revision preservation. The
visual builder was added in the following increment; preview remains open.
Build and lint passed; OpenAPI YAML parsed; the full real-media suite passed 109
tests across 33 files, and all 20 Chromium workflows passed. No deployment or
production database changes were made.

## Quiz attempt API — October 3, 2026

Learners can atomically start/resume an open attempt, retrieve private attempt
state, and submit answers for server-side grading. Concurrent start requests
converge on one attempt; limits are consumed only after submission. The server
rejects cross-quiz questions and invalid choices, computes score/pass using
server-held answer keys, returns the original result on duplicate submission,
and maps expired deadlines to a stable conflict without committing answers.
Expired open attempts remain counted but are not resumed, allowing a remaining
attempt to start.
Integration coverage includes attempt privacy, ownership, concurrency, limits,
grading, idempotent submission, expiry rollback, and validated partial-answer
saves with zero awarded points until final submission. Question explanations are
stored with the immutable definition and withheld until an attempt is submitted.
Build and lint passed; OpenAPI YAML parsed; the full real-media suite passed
110 tests across 33 files, and all 20 Chromium workflows passed. No deployment or
production database changes were made.

## Lesson-player quiz attempts — October 3, 2026

Enrolled learners can start/resume a lesson quiz in the player, choose options,
submit once, and see the server-calculated score/pass result plus remaining
attempts. Choices autosave without grading and restore after reload. Correct-answer
keys are never sent to the browser. The focused Chromium flow verified start,
reload/resume with saved selection, submission, grading feedback, and remaining
count. Build and lint passed; the full real-media suite passed 110 tests across
33 files, and all 21 Chromium workflows passed. OpenAPI YAML and `git diff --check`
passed. Answer explanations and prior-result history remain open. No deployment or
production database changes were made.

## Studio quiz builder — October 3, 2026

The studio now loads quizzes for the current unpublished revision and provides a
separate builder for final or lesson assessments. Authors/admins can edit settings,
questions, choices, and correct-choice keys, then save through the revision-checked
API without triggering course autosave. The E2E flow creates both a final quiz and
a lesson quiz and verifies the stored definitions. Build and lint passed; the full
real-media suite passed 112 tests across 33 files, and all 22 Chromium workflows
passed. OpenAPI YAML and `git diff --check` passed. No deployment or production
database changes were made.

## Concurrent quiz submission — October 3, 2026

An API integration test submits conflicting answers concurrently to the same open
attempt. Both requests return the same persisted score, pass state, submission time,
and feedback; exactly one request reports that it performed the submission, and a
single immutable answer row remains. This exercises the immediate transaction and
idempotent retry path, complementing the existing concurrent-start, manipulated
answer, ownership, and submitted-row immutability tests. Build and lint passed; the
full real-media suite passed 115 tests across 34 files. No production changes were
made.

## Quiz publication readiness — October 3, 2026

The shared publication checklist now validates configured quizzes: empty quizzes
and malformed choices/correct-answer keys block both readiness checks and publish,
with module/lesson context for author feedback. Quizzes remain optional, so courses
without assessments retain prior publication behavior. Focused service and API
integration tests passed, including an assertion that blocked publication leaves
the course in DRAFT. Build and lint passed; OpenAPI YAML parsed; the full real-media
suite passed 112 tests across 33 files, and all 22 Chromium workflows passed.
No production migration or deployment was performed.

## Revision-consistent course completion — October 3, 2026

Migration 051 adds monotonic `enrollments.completed_at`; migration 052 snapshots
the required lesson and quiz IDs per enrollment, backfilling existing enrollments
and freezing the snapshots. New enrollments capture them transactionally. A shared
server policy requires every snapshotted lesson complete, every snapshotted quiz
passed, and current active entitlement on a non-withdrawn course. Lesson-progress
writes and quiz submissions reevaluate atomically; completion is recorded once.
Integration coverage tests incomplete lessons, failed/passed quizzes, later quiz
additions not changing existing requirements, immutable snapshots, idempotent
completion, access revocation, and legacy snapshot backfill. Build and lint passed;
OpenAPI YAML and `git diff --check` passed; the full real-media suite passed 114
tests across 34 files, and all 22 Chromium workflows passed. Certificate issuance
eligibility integration remains open; no deployment or production database
changes were made.

## Quiz author preview — October 3, 2026

The studio has a local author preview dialog for the current unsaved quiz contents.
It shows prompts, choices, and correct-answer markers, restores focus on close, and
does not save, publish, or call the learner quiz endpoint. Chromium verifies final
quiz preview content and correct-choice marking before continuing to save. Build
and lint passed; the full real-media suite passed 112 tests across 33 files, and
all 22 Chromium workflows passed. OpenAPI YAML and `git diff --check` passed. No
deployment or production database changes were made.

## Learner quiz result history — October 3, 2026

An enrolled learner can retrieve submitted result history for a quiz tied to their
enrollment revision. The response includes attempt timestamp, score, possible
points, pass status, selected/correct-choice markers, and author explanations;
open attempts receive none of this feedback. The lesson player displays prior
results and refreshes history after grading; reload preserves the history. API
tests cover enrollment isolation, pre-submit redaction, and post-submit feedback;
Chromium verifies explanations appear only after grading and persist after reload.
Build/lint, OpenAPI, and diff validation passed; the full real-media suite passed
112 tests across 33 files, and all 22 Chromium workflows passed. No deployment or
production database changes were made.

## Administrator enrollment support — October 12, 2026

ADMIN-02 is complete locally. The admin enrollment listing now reports effective
access as unavailable for revoked enrollments, even when historical entitlement
records remain. API integration coverage confirms unauthorized roles are rejected,
revoked learners cannot open protected lessons, progress and enrollment history are
preserved, and re-grants restore access without duplicating the enrollment. The
Chromium support workflow verifies grant, revoke, and reasoned history. Full
validation passed 133 tests across 41 files, build/lint, and all 28 Chromium
workflows. Provider-payment reconciliation and broad operational reporting remain
out of scope; no production data or deployment was changed.

## Publication scheduling and learner notices — October 12, 2026

ADMIN-03 is complete locally. Migration 081 binds each schedule to a REVIEW course,
its exact current revision, and the scheduling administrator. Admins can schedule,
reschedule, or cancel using local date/time; the worker publishes due revisions only
after rechecking the publication checklist. A failed check clears the schedule and
records issue codes for correction. Revision edits, archive, cancellation, and early
publication clear/audit obsolete schedules. New revisions queue localized email
through the outbox for active learners with verified email; repeated publication of
the same revision does not duplicate notices, and initial publication has no prior
enrollees to notify. Tests cover English, pt-BR, and Spanish templates, recipient
eligibility, schedule lifecycle, and archive-versus-withdrawal access semantics.
Build/lint passed, all 139 automated tests across 43 files passed, and all 28
Chromium workflows passed. SMTP delivery was not live-tested; no production
migration or deployment was performed.

## Media job coordination — October 13, 2026

JOB-01 is complete locally. Migrations 082 and 083 allow queued/processing job
cancellation and persist bounded processing progress. Media concurrency is controlled
independently from outbox concurrency. Lease-protected heartbeats renew every 15
seconds; a simulated-clock test renews through five minutes without reclaim, then
verifies recovery only after the two-minute heartbeat expiry. Lease-specific output
keys and conditional commits preserve idempotency. Processing progress is shown in
the editor, retry resets it, and a real-media workflow verifies READY at 100%. Active
cancellation keeps chunks until worker abort; stale cancelled leases are reclaimed by
the sweeper. Tests cover outbox delivery while media jobs remain active, manual retry,
cancellation, stale recovery, and cleanup safety. Final validation passed 144 tests
across 45 files, build/lint, and all 28 Chromium workflows. No actual five-minute VPS
transcode or production deployment was performed; those remain operational
qualification, not missing worker behavior.

## Paid course pricing and checkout — October 13, 2026

PAY-01 is complete locally. Migration 084 validates immutable revision price
snapshots; migration 085 stores immutable course revision/title/access-term snapshots
on orders. The editor accepts integer minor-unit prices and supported currencies,
the public page formats prices by interface locale, and buyers can create/retry
idempotent hosted checkout orders and inspect private order status. Browser prices are
never accepted by the order API. The local Fake provider exercises pending,
canceled, and approved states; only a matching provider amount/currency and approved
state create one enrollment/entitlement. Returning to the site alone changes no
payment or access state. Production checkout remains disabled until PAY-02 webhook
verification/reconciliation is qualified with a real test account. Full validation
passed 153 tests across 50 files, build/lint, and all 29 Chromium workflows. No live
provider, sandbox transaction, or production migration/deployment was performed.

## Provider adapter and signed order webhooks — October 13, 2026

PAY-02 is complete locally against the current Mercado Pago Checkout Pro Orders API
documentation. Mocked adapter tests verify `POST /v1/orders`, the required stable
idempotency header, the order lookup endpoint, status normalization, the official
HMAC manifest and Orders API refund request shape. HTTP integration tests use an
official-shaped `type=order` event with query `data.id`, preserve the exact raw body,
verify `x-signature`/`x-request-id`, fetch authoritative provider state, reject
amount/currency/reference mismatches, retry failed events, detect event-ID payload
reuse, and grant an entitlement once after approval. Provider-origin headers are
accepted only on the signed webhook route; altered signatures are rejected.
No Mercado Pago credentials or test account were available, so no sandbox purchase
or live webhook delivery was performed. Production checkout stays disabled until an
operator qualifies the configured test webhook. Build/lint passed, the full suite
passed 153 tests across 50 files, and all 29 Chromium workflows passed. No payment
provider was contacted and no deployment occurred.

## Payment confirmation and reconciliation — October 13, 2026

PAY-03 is complete locally. Authoritative status is checked on signed webhook and
buyer refresh; settlement validates configured seller, external reference, amount
and currency against the immutable order snapshot. Order/payment state, enrollment,
entitlement and localized confirmation email are committed transactionally. The
worker reconciles aged pending orders every minute, and repairs PAID orders missing
enrollment/active order entitlement after a failed prior commit, with retry backoff.
Tests cover seller/snapshot mismatch, pending-to-approved transitions, duplicate
events, out-of-order safety, lost-event reconciliation, orphan recovery, and exactly
one entitlement/receipt. Full validation passed 155 tests across 51 files, build/lint,
and all 29 Chromium workflows. No live sandbox transaction/webhook or production
deployment was performed; checkout remains disabled until operator qualification.

## Refunds, chargebacks, and admin order support — October 13, 2026

PAY-04 is complete locally. Admin order search/status/history exposes order snapshots,
approved/pending refund totals, and confirmation-email delivery state. Refund requests
reserve balance before provider calls, persist reason/actor/idempotency identity, and
retry with the same key. Provider refund records reconcile by provider ID, including
timed-out local reservations. Partial refunds keep order access and certificates;
full refunds revoke active entitlements/enrollments and certificates with reasons.
The documented `order.charged_back` signed webhook and manual admin chargeback path
apply the same revocation policy and preserve order/certificate audit records. A stale
approval cannot restore a charged-back or fully refunded order. The Fake provider now
models cumulative partial/full refunds and stable idempotency results.

Focused API, settlement, provider, and browser tests cover pending/approved/rejected
refund outcomes, same-key collisions/retries, refund status reconciliation, chargeback
notification and replay, receipt state, partial-access preservation, full-refund and
chargeback certificate revocation, and the admin workflow in Chromium. Final
validation passed 162 tests across 54 files, build/lint, and all 30 Chromium workflows.
No live Mercado Pago credentials, sandbox purchase/refund/chargeback delivery, or
production deployment was used; production checkout remains disabled pending PAY-05
operator qualification.

## Sandbox and production guards — October 16, 2026

PAY-05 local configuration safeguards are implemented, but the item remains blocked
for external qualification. `MP_ENVIRONMENT` explicitly separates sandbox from
production; test credentials are not classified by token prefix. Nonproduction
Mercado Pago configuration rejects production mode, production rejects sandbox mode,
and enabled checkout requires Mercado Pago plus access token, webhook secret, and
seller ID. The checkout flag parses literal `true` and `false` values correctly;
real-provider checkout is blocked in every environment while disabled. Refunds for
existing orders remain available when new checkout is disabled.

Configuration tests cover default-off behavior, sandbox/production mismatch,
required credentials, and valid environment combinations. The HTTP integration test
confirms disabled Mercado Pago checkout returns `PAYMENT_CHECKOUT_NOT_READY` before
provider checkout is called. Final validation passed 168 tests across 55 files,
build/lint, and all 31 Chromium workflows. No credentials were available or
requested, so no sandbox transaction, refund, chargeback delivery, seller verification, tax review,
or legal/commercial approval was performed. Production checkout remains disabled
until the owner supplies test credentials through a secret store and a qualified
responsible party completes the commercial/legal review.

## Adaptive HLS outputs — October 16, 2026

MEDIA-03 is complete locally. Real FFmpeg processing now persists a private HLS VOD
master playlist, up to 360p/720p variants capped at source resolution, playlists,
and MPEG-TS segments alongside the MP4/poster. READY is committed only after all
outputs are stored; stale leases and processing failures remove incomplete outputs.
The authorized HLS endpoint validates each requested asset path and rechecks the
lesson's revision, preview/entitlement, owner, and withdrawal state for every
playlist and segment request. Real-media integration tests fetch the master, variant,
and segment, then verify revocation/withdrawal rejection. Full validation passed 168
tests across 55 files, build/lint, and all 31 Chromium workflows. Maia Edge capacity
and long-duration processing remain operational qualification; PLAY-02 still owns
browser HLS selection/fallback.

## Media library — October 16, 2026

MEDIA-04 advanced locally with an author/admin media library supporting filename or
course search, course/type/status filters, pagination, usage counts, and processing
errors/progress. API results are owner-scoped for authors and omit storage keys; the
course editor remains the association/replacement workflow. Chromium verifies the
new direct route and finds a READY inline image in its course. Automated validation
passed 168 tests across 55 files, build/lint, and all 31 Chromium workflows. Orphan
collection is not enabled: the owner must define retention first, then cleanup must
recheck all historical revision references before deleting anything.

## Authorized MP4 and HLS playback — October 17, 2026

PLAY-01 is complete locally. MP4, poster, captions, HLS playlists, and HLS segments
are served through lesson/revision-scoped routes; each request rechecks public
preview, active enrollment/entitlement, owner/admin access, and course withdrawal.
MP4 responses support Range/206/416 and HEAD; HLS assets are path-allowlisted and
served from private storage. Protected requests use the seven-day HTTP session,
renewed by the SQLite store and revalidated against current account/session state.
The real-media test now verifies that a different authenticated account cannot reuse
copied MP4 or HLS URLs, and that valid access works until revocation/withdrawal.

## Integrated HLS player — October 17, 2026

PLAY-02 advanced locally: the player uses native HLS when supported and the local
HLS.js bundle where Media Source Extensions are available. The UI exposes automatic
or manual rendition selection when multiple levels exist, preserves native controls
for keyboard/seek/volume/fullscreen, and falls back to the authorized MP4 endpoint
on fatal HLS failure. Loading, media error, speed, and fallback states are localized.
Chromium E2E validates real multi-rendition trailer playback/quality selection and
MP4 fallback after an HLS playlist failure. Real Android Chrome, Safari/iOS, and
long-session playback through deployment renewal have not been qualified; PLAY-02
remains open for those device/environment acceptance checks. Final local validation
passed 168 tests across 55 files, build/lint, and all 31 Chromium workflows.

## Learner resumption and completion — October 18, 2026

PLAY-04 is complete locally. Lesson navigation is revision-scoped and preview-aware;
the dashboard resumes the latest active unfinished lesson, preferring a saved
position. Playback position writes are throttled to 15 seconds and a pause queues the
latest position behind any in-flight write. The player restores the saved position
after media metadata loads, including in a fresh browser context. Completion is
computed server-side from the enrollment's immutable required-lesson/quiz snapshot;
position reports do not count as completion. The real-video browser test covers
pause-save, reload, and isolated-session resumption. Independent Android/Safari and
long-session VPS qualification remains tracked by PLAY-02.

## Course metadata translations — October 18, 2026

I18N-02 is complete locally. Course revisions store optional en/pt-BR/es translations
for presentation metadata separately from the source locale. Public catalog search,
home placements, course detail, enrolled-course lists, instructor course cards, and
author preview take a separate `displayLocale` and fall back field-by-field to the
source revision. Authors edit translations in the studio; duplicate/source-language
entries are rejected, and translations are immutable after publication or enrollment.
The course-language filter and displayed source locale are not rewritten by the UI
language. Captions retain their explicit track language; no automatic translation is
claimed. API tests cover fallback, search, home/profile/learning readers, and immutable
published revisions; Chromium covers studio editing and interface-language switching.
Final validation passed 169 tests across 56 files, build/lint, and all 32 Chromium
workflows.

## Learner completion policy — October 20, 2026

LEARN-01 is complete locally. Completion uses the enrollment's immutable required-
lesson and quiz snapshots, requires active entitlement and a non-withdrawn course,
and is reevaluated transactionally after lesson completion or quiz submission.
`completed_at` is idempotent; revocation preserves the historical timestamp but
makes `completion_ready` false. Certificate eligibility consumes the same server
policy, so browser playback seconds alone cannot qualify a learner. Existing API
coverage checks incomplete lessons, failed quizzes, timestamp stability, revoked
access, and certificate preflight. Chromium coverage verifies completion UI,
navigation, and resumption. No completion state was changed by this documentation
update.

## Course translation database invariants — October 20, 2026

Migration 089 adds SQLite insert/update validation for translated revision metadata:
JSON objects must use supported, unique locales distinct from the source locale;
unknown fields, malformed values, out-of-range strings, and empty translations are
rejected. Focused direct-SQL tests cover valid inserts, invalid insert variants, and
invalid locale/translation updates. The existing translation API workflow remains
covered separately. DATA-01 remains open pending the complete invariant matrix and
the BASE-02 prototype database rehearsal.

## Media upload and attachment inspection — October 20, 2026

Focused validation passed for attachment signature/content checks, ClamAV clean,
malware and scanner-error outcomes, incomplete-upload cleanup, and the API upload
workflow (11 passed, 1 skipped). The local worker keeps originals private, validates
content, scans before READY when `ATTACHMENT_SCAN_MODE=clamav`, and only publishes
normalized artifacts. The mode defaults to `disabled`; no host scanner or signature
database was installed or qualified. MEDIA-02 remains open for that real-host check.

## Operations dashboard and worker heartbeat — October 20, 2026

Migration 090 stores worker instance start, heartbeat, and stop times. Worker
heartbeats refresh every 10 seconds; the admin-only `/api/v1/admin/operations`
summary classifies stale instances using SQLite time, aggregates media/outbox/email/
payment state, reports storage capacity, and emits safe alert codes without job
payloads or user identities. Chromium covers admin authorization, dashboard sections,
and manual refresh. Migration 092 aggregates seven-day playback requests by resource
type and HTTP status class without storing paths or user identifiers; real MP4/HLS
responses are covered by the video API test. Latency/start/buffering metrics remain
unimplemented, and alerts are not delivered externally. Final validation passed 178
tests across 62 files, build/lint, and all 35 Chromium workflows. No host deployment
was performed.

## Security controls — October 20, 2026

Production attachment processing now fails with `FILE_SCAN_FAILED` when
`ATTACHMENT_SCAN_MODE` is disabled; development/test behavior remains configurable.
Focused tests passed for cross-author/media entitlement, revoked media, upload
signature and quota checks, incomplete cleanup, private attachment inspection,
ClamAV clean/malware/error results, Markdown sanitization, and webhook signature and
replay handling. The full SEC-01 hostile-input matrix and host qualification remain
open; ClamAV was not installed or run against real signatures.

## Privacy export and deletion requests — October 20, 2026

Migration 091 stores minimal, idempotent account-deletion requests. Authenticated
exports are `no-store`, contain only the requesting user's account, learning,
assessment, entitlement, payment, certificate/consent, and owned-media metadata, and
omit password hashes, sessions, email-token hashes, provider references, and storage
keys. API tests verify cross-account isolation, secret exclusion, and that requesting
deletion neither suspends nor deletes an account. Privacy routes use a dedicated
rate-limit bucket. Chromium verifies JSON download, request status, and continued
account access. No deletion is executed. Retention, admin review, support contact,
and legal review remain unconfigured.

## Form error accessibility — October 20, 2026

The global message region now switches between polite `status` for success notices
and assertive `alert` for `Error` instances. Error messages receive keyboard focus
and remain localized; form inputs are preserved. Chromium verifies incorrect-login
messages and focus behavior in English, Brazilian Portuguese, and Spanish, alongside
the account-security forms. Contrast, zoom/mobile, captions, and the broader editor/
player audit remain outstanding.

## Public course SEO — October 20, 2026

Published course pages now server-render the selected metadata locale, escaped title
and summary, canonical URL, and Open Graph fields/cover. The generated sitemap lists
only published, non-withdrawn courses; `robots.txt` excludes private areas, which
also return `X-Robots-Tag: noindex`. Web tests cover metadata, localization, escaping,
sitemap and private/missing routes; API integration verifies lookup against the
published SQLite revision. API integration also verifies active home placements and
published catalog rows while excluding drafts. Instructor profiles still need
server-rendered content and full crawler validation.

## Product QA report — October 20, 2026

The report recorded 179 test cases across 62 files; all workspaces built and lint
passed. A fresh full Chromium rerun passed all 35 workflows, including the 360×780
catalog/operations and real-video player checks. One earlier full run had
non-reproducible timeouts beginning in admin MFA; the preceding account/admin block
and subsequent complete rerun passed. A limited Firefox smoke returned 200 for
`/courses` at 360×780 with no horizontal overflow. WebKit lacks host libraries;
WebKit full-suite and physical mobile qualification remain outstanding.

## Product QA rerun — October 21, 2026

Local validation of the current checkout: `npm test` passed 178 tests and skipped
2 (180 total across 62 files); `npm run build` and `npm run lint` passed. Chromium
and WebKit each passed all 35 workflows, including real video playback and the
360×780 viewport checks. WebKit's local blockers were corrected: Helmet now emits
`upgrade-insecure-requests` only in production, the draft-preview video test
scrolls the media into view before playback, and logout flows wait for the
redirect before navigating. The export link also declares its download filename
so WebKit handles the response as a download.

Firefox full-suite attempts remain intermittent: earlier runs passed 34/35, and
the latest passed 33/35 with timeouts in verification navigation and video
enrollment feedback. The verification and video spec files passed together (4/4)
in a focused Firefox run. Keep Firefox qualification open until a clean complete
run passes. No deployment, host changes, or physical-device qualification were
performed; device testing remains external.

## Instructor profile SEO — October 21, 2026

Public instructor pages now server-render the opted-in biography and only
published, non-withdrawn courses, with escaped text, canonical/Open Graph
metadata and sitemap entries. Unpublished/private profiles return a noindex 404.
Web rendering tests cover escaping, metadata, localization and sitemap inclusion;
API integration covers actual profile/course filtering. The combined API/web
rendering regression tests passed 60 cases; build and lint passed. No deployment
or host change was performed.

## BASE-02 synthetic prototype rehearsal — October 21, 2026

`node scripts/create-prototype-fixture.mjs` creates the ignored
`data/prototype-rehearsal.db` using only fictional records and the prototype-era
migrations 001–003. A separate `data/prototype-rehearsal-upgraded.db` copy was
upgraded twice through migration 092. The rehearsal preserved two accounts, two
courses, enrollment and entitlement, 137-second completed progress, legacy media
references, publication/draft state and literal HTML-like lesson text with
`content_format='plain'`. SQLite `integrity_check` returned `ok` and
`foreign_key_check` returned no violations. The focused migration test passed all
four cases; combined migration/API/web regression tests passed 64 cases, and
build/lint passed. This is a synthetic schema/data rehearsal only; there is no
production or real customer database, and none was accessed or modified.

## Playback metric SQLite invariants — October 22, 2026

Migration 093 now rejects impossible/non-ISO metric dates and fractional HTTP
status classes or request counts. It rebuilds the aggregate table transactionally:
valid historical aggregates survive, while a synthetic invalid legacy row makes
the migration fail without losing the row or recording the migration as applied.
Focused migration tests passed both preservation/failure cases; the migration test
also checks invalid inserts and updates. No production database was accessed.

## Implemented API contract — October 20, 2026

`spec/openapi.yaml` now includes HLS playlist/variant/segment routes, privacy
export/request endpoints, and the admin operations summary. Future product design
remains in `spec/planned-openapi.yaml`. The implemented spec parsed successfully
with the repository's YAML-capable Prettier parser; it is still not a complete
catalog of every API route.

## Firefox E2E qualification — October 22, 2026

`npm test` passed 181 tests and skipped 2; build and lint passed.
The Playwright config and isolated E2E server accept `E2E_PORT` to avoid
interfering with an already-running local test instance. With
`VIDEO_TEST_REAL=1 E2E_PORT=4322`, the full Firefox run passed 34/35 workflows;
one course-withdrawal navigation timed out waiting for the browser `load` event.
The course-withdrawal workflow passed in isolation, as did the real-video
workflow, its enrollment API response check, and media processing checks.
Firefox remains unqualified until a full run passes without
intermittent timeouts. The existing instance on port 4320 stayed ready throughout;
no host or external environment was changed.

## Firefox E2E reruns — October 23, 2026

Three additional complete Firefox runs each passed 34/35 workflows. The single
30-second `page.goto` timeout varied between runs (login navigation and
verification navigation); each affected workflow passed when isolated. Waiting
for `domcontentloaded` instead of `load` did not resolve the suite-level
intermittency, so that per-test change was not retained. Firefox remains
unqualified; do not mask the instability by weakening assertions or declaring
success based on focused reruns.

## Default E2E media worker — October 23, 2026

The isolated E2E server now starts its worker regardless of `VIDEO_TEST_REAL`.
That flag still controls real FFmpeg/video browser workflows, while non-video
attachment processing needs the worker too. The Firefox inline-image upload,
publish, and render workflow passed without the flag; lint passed. This remains
local test-harness behavior and does not alter ClamAV configuration or qualify
the real worker host.

## Playback response completion timing — October 23, 2026

OPS-03 now includes server-side response completion timing for MP4, posters,
captions, and HLS playlists/segments, including completed error responses.
Migration 094 preserves historical request counts with no timing samples and
constrains measured counts/duration totals. The seven-day operations summary
reports a weighted average over timed responses only, not an average of bucket
averages, and excludes future dates. Empty samples return `averageMs: null`.
The panel displays sample count and average in en/pt-BR/es with an explicit
unmeasured state. No paths, user/course IDs, addresses, or payloads are recorded.

Validation: 11 focused migration/service/API/i18n tests passed; the full
`VIDEO_TEST_REAL=1 npm test` run passed all 186 tests across 63 files, including
real-media HTTP instrumentation checks. Build and lint passed. The focused
Chromium operations workflow passed against a disposable database on port 4329,
checking the unmeasured state, a real error-response timing, refresh, and all
three languages. A combined Chromium rerun also passed all four operations,
orders, users, and mobile-viewport workflows, checking that language switching
does not affect subsequent shared-admin tests. The OpenAPI YAML parsed
successfully. No Firefox suite was run for this delivery.

This measures elapsed monotonic time until the server response `finish` event,
not time to first byte, client download completion, buffering, or watch time.
Aborted responses are not recorded. OPS-03 remains open for the remaining
telemetry and external alert delivery. No deployment, host configuration change,
or migration of the user's running instance was performed.

## Administrative privacy request review — October 24, 2026

PRIV-01 now has an administrator-only request queue at `/admin/privacy` with
literal email/request-ID search, state filters, pagination, private review notes,
and actor-attributed append-only history. Recording a note moves OPEN to IN_REVIEW
or appends to IN_REVIEW; the request state and audit event are committed atomically.
An audit insertion failure leaves the previous request state intact. CLOSED
requests reject further review. Requesters see their actual state rather than a
hardcoded "Open", but cannot read admin notes/history or other users' requests.
Review neither deletes/suspends accounts nor closes/fulfills deletion requests.
No migration is needed; existing request/audit tables and constraints are reused.

Validation: all 187 tests passed with `VIDEO_TEST_REAL=1`, across 63 files;
build and lint passed. Focused Chromium privacy/account workflows passed 3/3,
covering private note escaping, failed-save retention/retry, locale switches
with unsaved text preserved, requester state/isolation, account export, and
password changes. API tests cover role restrictions for all three admin routes,
pagination/filter validation, note bounds, missing/closed requests, private
no-store responses, atomic rollback, idempotent self-service during review, and
append-only history. Public web tests verify the new shell is noindex. OpenAPI
YAML parsed successfully. No Firefox reruns, deployment, host changes, or changes
to the existing user-test instance were performed. PRIV-01 stays open for legal/
retention policy, support contact, resolution and export completeness review.

## Backup bundle verification and isolated restoration — October 26, 2026

OPS-02 now provides `backup:verify` to validate an existing bundle and
`restore:bundle` to restore into a new private directory. Verification recomputes
database/media hashes and sizes, checks exact storage inventory and manifest
totals, reruns SQLite integrity/foreign-key checks and validates database storage
references. Unsupported versions, unsafe/duplicate paths, symlinks, sidecars,
missing/extra files and corrupted data fail explicitly before creating a restore
destination. Restore refuses existing/nested destinations, rechecks the copied
files and emits its completion manifest only after successful verification.
It neither loads application environment files nor changes running services.

The backup snapshot is normalized to standalone DELETE journal mode; the live
source retains WAL mode. Shared storage-key/reference validation keeps backup
and restore consistent. Earlier WAL-mode bundles must be recreated, not repaired
by deleting potentially necessary sidecars. Hashes detect corruption, not an
attacker replacing both the content and its manifest.

Validation: all 201 tests passed across 63 files with `VIDEO_TEST_REAL=1`;
build and lint passed. The 15 focused backup tests include creating/verifying a
bundle from a live WAL database, restoring after moving the original storage
out of its configured path, private permissions, overwrite/nesting rejection,
corruption, traversal, duplicate paths, symlinks, missing/extra objects, sidecars,
unsupported manifests, missing database references and foreign-key violations
even when the manifest hash matches the modified database. Editor diagnostics
and `git diff --check` were clean.

This is a CLI/data-level restoration rehearsal, not a restored HTTP playback or
certificate verification demonstration. OPS-02 remains open for that full
published-course/old-revision rehearsal, configuration/session recovery policy,
off-site encrypted retention and host qualification. No browser reruns, deploy,
host changes or changes to the existing user-test instance were performed.

## Restored-application HTTP rehearsal — October 26, 2026

OPS-02 now has an automated real-media recovery rehearsal in
`apps/api/src/backup-recovery.test.ts`. It creates fictional users through the
API, uploads and processes an FFmpeg-generated video, publishes a captioned
course, enrolls a learner, saves completed progress and issues a certificate with
its worker-generated PDF. A newer article-only revision is then published so
the enrolled learner's video belongs only to the older revision.

After stopping the source HTTP application and closing its WAL database, the
test creates a bundle, moves the original database/storage away from their
configured paths, restores into a separate directory, reapplies migrations and
starts another loopback HTTP application using only the recovered paths.
It checks readiness, fresh login, the new public title, old enrolled revision,
retained completion/position, captions and poster, byte-identical MP4 delivery,
Range responses, HLS master/variant/segment delivery, public certificate
verification, byte-identical PDF download and idempotent issuance. Anonymous and
unrelated-user restrictions remain enforced. Progress can be updated after
recovery, and SQLite integrity and foreign keys remain valid.

Validation: all 202 tests passed across 64 files with `VIDEO_TEST_REAL=1`;
build, lint and `git diff --check` passed. The focused backup/recovery run passed
16 tests before the final full regression. Editor diagnostics were clean.
All fixtures, HTTP servers and recovery copies are temporary and cleaned up.

This demonstrates local recovery through actual HTTP endpoints, not browser
decoding, physical-device playback or host/systemd/container recovery. No browser
suite was rerun; no deploy, host changes or changes to the user's existing test
instance were performed. OPS-02 remains open for configuration/session recovery
policy, off-site encrypted retention and target-host qualification.

## Privacy review keyboard recovery — October 26, 2026

UX-01 advanced locally: privacy-request search/pagination focuses the result
summary, while a successful review focuses its updated request heading. List
failures focus a retry button and retain unsaved notes across retry. Private
history now has a polite live region, busy state and explicit retry instead of
requiring the user to close/reopen it. Keyboard retry returns focus to the
history summary after success, or to retry after another failure.

Validation: three targeted Chromium privacy/account workflows passed against a
disposable fixture on port 4330. They check search-error retry using Enter,
retained notes, focus after search/review, history-error retry using Enter,
busy state, escaped private history and existing locale/access isolation.
Seven focused API/privacy/i18n tests and lint passed; `git diff --check` passed.
No build or full-suite rerun was needed for this static JavaScript-only change;
the preceding full regression remains 202 tests, not a new full-suite result.
No Firefox or screen-reader/device qualification, deploy, host changes or
changes to the existing user-test instance were performed. UX-01 remains open
for the full accessibility audit.

## Playback HTTP status breakdown — October 26, 2026

OPS-03 now exposes the existing seven-day `byStatusClass` aggregates on the
operations dashboard in en/pt-BR/es. All five classes (1xx–5xx) appear in stable
order, including explicit zero counts. The panel explains that request counts
are not viewer counts or failed playback sessions; 4xx includes denied access
and missing resources, whereas 5xx indicates server errors. No new telemetry,
personal data, schema migration or API contract change was introduced.

Validation: the targeted Chromium operations workflow passed on disposable
port 4330. It checks an empty window, a real missing-video 404 counted in 4xx,
and mocked nonzero counts for every class across all three locales. Mocked
counts validate presentation only, not actual informational/error responses.
Eight focused operations API, playback service and translation tests passed;
lint and `git diff --check` passed. This static UI change did not require a new
build or full-suite run; the previous complete result remains 202 tests.
OPS-03 stays open for remaining instrumentation and external alert delivery.
No Firefox reruns, deployment, host changes or changes to the running user-test
instance were performed.

## Operations refresh failure states — October 26, 2026

OPS-03 now distinguishes an unavailable initial summary from an outdated
previous snapshot. Before the first successful response, metrics are hidden
rather than displayed as empty/healthy. Loading announces progress, sets the
snapshot busy and disables duplicate refreshes. A failed later refresh keeps
the previous data and its last successful timestamp with a localized outdated
warning. Errors receive focus; the existing refresh button supports keyboard
retry, and successful recovery clears the warning. No automatic polling or
age-based freshness threshold was introduced.

Validation: both targeted Chromium operations workflows passed in disposable
port 4330. Injected 503 responses cover initial failure and recovery, held
requests verify loading/button/busy states, and later failures preserve the
snapshot and timestamp before keyboard recovery. All states are checked in
en/pt-BR/es alongside the existing HTTP status breakdown. Six focused API and
translation tests, lint and `git diff --check` passed. No full-suite/build
rerun was needed for this static UI change; the last full result remains
202 tests. OPS-03 remains open for telemetry and external alert delivery.
No Firefox/device/screen-reader qualification, deploy, host changes or changes
to the user's running instance were performed.

## Ready queue diagnostics — October 26, 2026

OPS-03 now returns `outbox.ready` and `oldestReadyDelaySeconds` and displays
them in en/pt-BR/es. Eligibility matches worker selection: unprocessed jobs,
attempts below five and availability at/before now. Expired leases participate;
future availability, processed jobs and exhausted attempts do not. Delay is
rounded seconds since the earliest ready availability, not job creation or SMTP
delivery latency. No ready jobs returns null with an explicit translated empty
state. Existing pending/exhausted counters are unchanged, with no new personal
data, schema migration, alert threshold or scheduling behavior.

Validation: seven focused API/translation tests, build and lint passed.
API fixtures exercise empty and just-ready queues, a five-minute expired lease,
future availability/active leases, processed jobs and exhausted attempts using
valid claim/completion transitions. Chromium operations workflows check numeric
presentation in three locales and the null-delay empty state with mocked queue
values; existing refresh-failure recovery remains covered. The OpenAPI contract
and operations guide document both fields and their meaning. Full-suite/browser
qualification is separate: the last full regression remains 202 tests.
No deploy, host configuration changes or changes to the running user instance.

## Localized initial public HTML — October 26, 2026

SEO-01 now reuses the browser translation catalog during server rendering.
Navigation, language selector, footer, empty states, noscript guidance and
fallback titles/descriptions are localized in en/pt-BR/es before browser scripts
run. Home/catalog Open Graph descriptions match their page descriptions;
Brazilian Portuguese uses `pt_BR` for Open Graph and `pt-BR` for HTML language.
Course cover alt text retains the supplied authored description. Existing
content resolution, query-free canonical URLs, sitemap and private-page noindex
behavior are preserved.

Validation: 11 focused web/translation tests passed, including direct HTTP
assertions for home, empty catalog, course and instructor in each language,
escaping and invalid-query fallback. Full `VIDEO_TEST_REAL=1 npm test` passed
206 tests in 64 files; all workspaces built and lint passed. Three focused
Chromium workflows passed on disposable port 4330: home/catalog with JavaScript
disabled and the two existing operations workflows with browser hydration.
The new browser test initially assumed an empty catalog, but the fixture has
published courses; it now checks visible published links and serialized localized
noscript HTML. Editor diagnostics and `git diff --check` passed.

SEO-01 stays open for external crawler and remaining public-page qualification.
No new complete browser suite, Firefox/WebKit/device qualification, deployment,
host changes or changes to the user's running instance were performed.

## Restored authentication invalidation — October 26, 2026

OPS-02 applies the owner-selected invalidation policy on every bundle restoration.
Only the newly copied database is changed: account session versions advance,
HTTP sessions expire, legacy sessions are revoked, unused email tokens and
email-change confirmations are consumed, and pending MFA login challenges are
consumed in one transaction. Password hashes, addresses/languages, MFA enrollment
and recovery codes are preserved. Source/live databases and source bundles remain
unchanged. The restored completion manifest records policy/time/counts/provenance
and recalculated database size/hash, and is written only after re-verification.

Validation: 18 focused backup and real-media HTTP recovery tests passed;
build, lint, editor diagnostics and `git diff --check` passed. Tests cover source
byte preservation, independent verification of both bundles, expired sessions,
consumed tokens/challenges, preserved previously consumed tokens and account/MFA
data, plus full rollback/no completion marker after injected invalidation failure.
The HTTP rehearsal rejects pre-backup learner/admin cookies and three old link
types, completes fresh password recovery/login, and retains its old-revision
media/progress/certificate checks. An initial test captured the last email after
certificate issuance instead of registration; token capture was corrected to the
registration point. No production behavior was changed to accommodate the test.

This does not rotate restored passwords/MFA keys or reconcile credential changes
after the snapshot. Pending mail is preserved and must be reviewed before worker
startup, because old messages may contain invalidated links. Older snapshots
missing required authentication schema fail explicitly, without silently weakening
the policy. Configuration recovery, encrypted off-site retention and host/device
qualification remain open. No new full regression/browser suite was run; the last
complete regression remains 206 tests. No deployment, host changes or changes to
the user's running instance were performed.

## Unavailable storage measurement alert — October 26, 2026

OPS-03 now emits `STORAGE_UNAVAILABLE` when the filesystem capacity read fails.
The response retains a null storage value and the remaining operational metrics,
with no filesystem path or raw error text. The dashboard translates the alert
and path/permission guidance in en/pt-BR/es. A successful refresh replaces the
unknown state with measured capacity and removes the warning. The existing
`STORAGE_LOW` rule remains strictly below 10% available, with no new threshold.
OpenAPI now documents the nullable capacity fields and the additional alert code.

Validation: eight focused operations API/translation tests passed, plus build,
lint, editor diagnostics and `git diff --check`. API tests inject filesystem
read failures representing missing paths/permissions, verify sanitized output,
and check 9%, 10% and 11% available using deterministic filesystem counters.
All three focused Chromium operations workflows passed on disposable port 4330.
The new workflow simulates unknown/low/recovered capacity in all three languages,
checks the other metrics remain visible, and recovers using keyboard refresh.
These simulations do not qualify disk exhaustion or host service permissions.
No new full regression or Firefox/WebKit/device runs were performed; the last
full regression remains 206 tests. No deploy, host changes or changes to the
user's running instance were performed. OPS-03 remains open for its remaining
telemetry and external alert delivery.

## Email transport attempt telemetry — October 26, 2026

OPS-03 now measures email-provider send attempts in the worker. Migration 095
stores UTC date/outcome aggregates with integral count and duration totals,
rejecting invalid calendar dates, outcomes and numeric values. Valid actual sends
are timed using a monotonic clock; accepted and failed attempts both contribute
to the weighted mean. Retries are separate attempts; invalid/unsupported jobs
and historical uninstrumented sends are excluded. API/dashboard expose seven UTC
dates with explicit zero counts/null duration when no samples exist, in en/pt-BR/es.
No message identities, recipients, content, tokens or raw errors are persisted.
Transport acceptance is not inbox delivery. A telemetry persistence error emits
a fixed safe log without turning an accepted send into a retry.

Validation: 13 focused worker/API/translation tests passed, including deterministic
timings, repeated-outcome aggregation, failed send/retry, invalid job exclusion,
schema constraints, UTC boundaries, weighted averages and telemetry write failure.
Full `VIDEO_TEST_REAL=1 npm test` passed 212 tests in 64 files; build, lint,
editor diagnostics, OpenAPI parsing and `git diff --check` passed. Three focused
Chromium operations workflows passed on disposable port 4330, covering mocked
email aggregates in all three languages and the unmeasured empty state, alongside
existing storage/refresh recovery. The first full run overlapped the browser
build and exceeded the existing five-second limit in one backup test (211 passed);
a standalone full run passed without changing test timeouts or production code.

This is local instrumentation with test providers/mocked browser counts, not
qualification of external SMTP or final delivery, and adds no alert threshold or
external notification channel. No Firefox/WebKit/device reruns, deployment,
host changes or changes to the user's running instance were performed.

## Email-change history in account export — October 27, 2026

PRIV-01's authenticated JSON export now includes the requesting account's
historical and pending email-change requests: target addresses and creation,
expiry and use timestamps. It deliberately omits token hashes and remains scoped
to the authenticated user. OpenAPI, privacy documentation and the TODO describe
the field; export schema version stays `maia-account-export-v1` because this is an
additive optional consumer-facing change.

Validation: all three focused privacy API tests passed; build, lint, editor
diagnostics, OpenAPI parsing and `git diff --check` passed. The export test checks
pending and used rows, excludes another account's email-change record, excludes
token hashes and retains the existing exclusions for passwords, sessions,
verification/reset tokens, storage keys and other-account media. No full-suite or
browser rerun was needed for this isolated authenticated API field addition.
All export queries are also enclosed in one deferred SQLite transaction so the
returned profile and related records share a consistent snapshot without taking a
write reservation.

Validation: the same three focused privacy API tests passed after the snapshot
change; build, lint, editor diagnostics, OpenAPI parsing and `git diff --check`
passed. No full-suite or browser rerun was needed for this isolated authenticated
API transaction boundary. Legal review, retention, support contact and fulfilling
deletion requests remain open. No deployment, host changes or changes to the
user's running instance.

## Payment reconciliation check telemetry — October 27, 2026

OPS-03 now records daily payment reconciliation check outcomes and elapsed time.
Migration 096 enforces valid UTC dates, outcome names and positive integral counts
with non-negative integral durations. The seven-day API/dashboard summary
distinguishes safely handled results (including pending/canceled) from provider
lookup failures or results that cannot be safely reconciled, including mismatches.
It exposes count and weighted average duration in en/pt-BR/es, with null duration
when no checks were measured. No order IDs, checkout references or provider
payloads are retained. Telemetry persistence errors emit only a fixed safe log and
do not alter the payment reconciliation result.

Validation: 12 focused payment reconciliation, operations API and translation
tests passed, including failed provider lookups, mismatched and pending results,
seven-UTC-day aggregation, weighted average, schema constraints, sensitive-data
exclusion and safe behavior when metrics persistence fails. Full
`VIDEO_TEST_REAL=1 npm test` passed 214 tests in 64 files; build, lint, editor
diagnostics, OpenAPI parsing and `git diff --check` passed. The first Chromium
run had a disposed intercepted response in the existing storage test; its
isolated rerun passed, then all three operations workflows passed together on
disposable port 4330, covering mocked reconciliation metrics in all locales and
the explicit empty state. No external provider latency/health, settlement-finality
or refund-monitoring qualification was performed. No deployment, host changes or
changes to the user's running instance.
