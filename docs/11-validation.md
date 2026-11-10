
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

## Course attachment metadata in account export — October 27, 2026

The authenticated account export now includes attachment titles, descriptions,
ordering, and course/revision/lesson associations when the requesting user owns
the upload and authors the course. The query requires both ownership relationships
and does not expose attachments or uploads belonging to other accounts.

Validation: the focused privacy API suite, build, lint, OpenAPI parse and
`git diff --check` passed. The privacy test verifies the owner attachment data is
present and another account's corresponding attachment and revision metadata are
absent. No full-suite or browser rerun was needed for this isolated export field.
This is local implementation and validation only; no deployment or host changes
were made.

## Terminal privacy-request state — October 27, 2026

Migration 097 adds a SQLite trigger preventing a CLOSED privacy request from being
reopened through direct status updates. Existing OPEN and IN_REVIEW workflow
updates, including closure and repeated review notes, remain permitted.

Validation: the focused migration and privacy API tests passed (4 tests), as did
build, lint and `git diff --check`. The full suite passed 214 tests across 65 files;
one existing backup-restoration test timed out at its 5-second limit under suite
load. All 17 tests in that backup test file passed when rerun alone. This strengthens
the local database invariant only; it does not fulfill or delete privacy requests
and does not change host or deployment state.

## Immutable privacy-request identity — October 27, 2026

Migration 098 makes each privacy request's ID, owner, type and creation timestamp
immutable, preserving its audit subject and provenance. Status and update timestamps
remain mutable according to the existing request workflow and terminal-state rule.

Validation: the focused migration test verifies blocked ID/owner/creation-time
rewrites, permitted update-time changes and ordinary status progression. Focused
privacy/migration tests, build, lint and `git diff --check` passed. The full local
regression passed all 215 tests across 65 files using a 10-second test timeout;
the earlier default-timeout run had one backup-restoration timeout under suite load,
and its 17-test file passed independently. No deployment or host changes were made.

## Privacy-request timestamp integrity — October 27, 2026

Migration 099 rejects malformed request timestamps and ensures `updated_at` is
not earlier than `created_at` or its previous value when requests are inserted or
their update timestamp changes. This preserves current database-default and ISO
timestamp formats.

Validation: the focused migration/API tests, build, lint and `git diff --check`
passed. The full local regression passed all 215 tests across 65 files using a
10-second timeout. No deployment or host changes were made.

## Monotonic privacy-request review state — October 27, 2026

Migration 100 prevents direct SQL updates from moving a privacy request from
IN_REVIEW back to OPEN; repeated review and transition to CLOSED remain allowed.
The migration runner now sorts numeric version prefixes so migration 100 follows
migration 099 on fresh databases as well as databases with pending migrations.

Validation: the focused privacy migration and API suites passed (4 tests), as did
build, lint, editor diagnostics and `git diff --check`. The migration regression
test also verifies version 100 is applied after 099 on a fresh database. No full
suite, deployment, host or running-instance changes were performed.

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

Reconciliation failures and rejected results also emit fixed category messages;
provider exceptions and payment identifiers/payloads are not written to logs.
The operations summary raises the localized `PAYMENT_RECONCILIATION_FAILED` alert
when the seven-day aggregate contains failed checks, and clears it when the failures
are absent from the window.

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

## Payment reconciliation dashboard alert — October 27, 2026

The local operations API now emits `PAYMENT_RECONCILIATION_FAILED` when the
seven-day aggregate contains failed checks. The admin UI translates it in en,
pt-BR and es, and the alert clears when no failures remain in the measurement
window. This is dashboard-only; no external alert channel was configured.

Validation: 10 focused API/translation tests passed, all three Chromium operations
workflows passed on isolated port 4330, build and lint passed, OpenAPI YAML parsed,
and `git diff --check` passed. No full-suite or external provider qualification
was run. No deployment, host or running-instance changes were made.

## Email transport dashboard alert — October 27, 2026

The local operations summary now emits `EMAIL_TRANSPORT_FAILED` when the seven-day
email-transport aggregate has failed attempts. The admin page translates it in en,
pt-BR and es and clears it when failed attempts leave the window. It measures failed
transport attempts, not inbox delivery, and does not create external notification.

Validation: the focused operations API/localization tests and three Chromium
operations workflows passed; build, lint, OpenAPI YAML parsing and
`git diff --check` passed. No external SMTP qualification, deployment, host or
running-instance changes were performed.

## Backup and restore failure cleanup — October 27, 2026

The bundle and restore commands now remove the newly created destination if work
fails before completion, leaving source data and the original bundle untouched.
Cleanup errors are surfaced together with the original operation error. Tests
verify that a missing referenced media object leaves no partial bundle and that
the same destination can be reused after correcting the source; injected
authentication-invalidation failure leaves no partial restore directory.

Validation: all 17 focused backup/restore tests passed; build, lint, editor
diagnostics and `git diff --check` passed. No full-suite run, deployment, host
change or modification to the running instance was performed.

The restored manifest now includes only the count of unprocessed `email.send`
messages, so operators can see that preserved recovery work needs review before
starting the worker. A regression test verifies processed/non-email jobs are
excluded and recipient/link payload values are not copied into the manifest.

Validation update: the focused 17-test backup/restore file passed with the
recovery-queue count check; build, lint, editor diagnostics and `git diff --check`
passed. No external qualification or host changes were performed.

## Firefox privacy workflow synchronization — October 27, 2026

The admin privacy E2E now waits for the localized page rerender and completed
request-list refresh before adding the one-shot failure route. This prevents
the route from racing the asynchronous locale change and intercepting its initial
list request instead of the search retry. The workflow passes in Firefox alone.

The complete Firefox run with `VIDEO_TEST_REAL=1` executed 39 workflows: 38 passed,
including both real-media workflows; `course-review` timed out after 30 seconds
waiting for page navigation at different steps in two suite runs. It passed in
isolation, so no per-test navigation timeout workaround was applied. Firefox
full-suite qualification remains open.

Validation: the focused Firefox privacy and course-review workflows passed.
The focused Chromium privacy workflow passed; build was not needed for this
test-only change. Lint, editor diagnostics and `git diff --check` passed.

## Full Chromium E2E regression — October 27, 2026

The complete Chromium browser suite passed all 39 workflows with
`VIDEO_TEST_REAL=1`, including real video playback and attachment delivery, on
isolated E2E port 4330. This verifies local Chromium behavior only; it does not
close the intermittent Firefox full-suite result, constitute a WebKit rerun, or
qualify a physical device or deployed host.

Validation: 39/39 Chromium workflows passed. No source code changed and no
deployment, host or running-instance changes were made.

## Delegated author to editorial homepage — October 30, 2026

The local integrated Chromium workflow now follows the author-management path
through to public homepage curation: an administrator promotes a registered user
to author, the author creates a course and submits it for review, an administrator
publishes it and places it in the featured homepage section, and the public home
renders the course. This joins existing admin-user and homepage-curation behavior
without treating local E2E coverage as full-product or deployed-domain acceptance.

Validation: the focused `tests/e2e/admin-users.spec.ts` workflow passed in Chromium.
No application runtime code, production database, deployment, host or running
instance was changed. The remaining final-acceptance criteria and public-domain
qualification remain open.

## Published revision remains live during draft editing — October 30, 2026

The authoring browser workflow now checks the learner-facing lesson page after a
new draft has autosaved but before publication. The public page must retain the
previous published Markdown and must not expose draft-only text; the editor then
reopens with its draft intact. This is local Chromium evidence for revision
isolation, not the full video-course/revision workflow or deployed-domain acceptance.

Validation: the focused authoring E2E passed in Chromium. No production runtime,
database, deployment, host or running instance was changed.

## Anonymous catalog discovery and lesson preview — October 30, 2026

The local learning workflow now has an unauthenticated visitor search the catalog
by course title and enrolled-free access mode, open the published course, and
access the lesson explicitly marked as a public preview. The paired non-preview
lesson API request is rejected with HTTP 403 before registration or enrollment.
Afterward, the existing learner registration, enrollment and lesson-completion
workflow continues.

Validation: `tests/e2e/learning.spec.ts` passed in Chromium. This is local
authorization and discovery evidence, not device or deployed-domain qualification.
No production runtime, database, deployment, host or running instance was changed.

## Anonymous direct video-asset requests — October 30, 2026

The real-media Chromium workflow now captures the published lesson ID and, in a
separate browser context with no session cookie, requests its enrolled-only MP4,
poster, English captions, HLS master playlist and HLS segment directly. Every
request is rejected with HTTP 403 before the learner enrolls. The same workflow
later enrolls and plays the video, so the denial assertions coexist with the
authorized playback path.

Validation: the focused real-video workflow passed with `VIDEO_TEST_REAL=1`;
`npx eslint tests/e2e/video.spec.ts` passed. This is local Chromium evidence only,
not device or deployed-host qualification. No production runtime, database,
deployment, host or running instance was changed.

## Refunds enforce lesson access — October 30, 2026

The local admin-order browser workflow now probes the paid lesson API directly
through the learner's authenticated browser context: it returns 403 before payment,
200 after approval, remains 200 after a partial refund, and returns 403 after a full
refund. The existing assertions also verify the matching active/revoked enrollment
state and the order's partial/full refund history. This does not qualify provider
sandbox settlement or certificate reversal policy.

Validation: `tests/e2e/admin-orders.spec.ts` passed in Chromium and
`npx eslint tests/e2e/admin-orders.spec.ts` passed. No production runtime, database,
deployment, host or running instance was changed.

## Full WebKit E2E regression — October 27, 2026

The complete WebKit browser suite passed all 39 workflows with
`VIDEO_TEST_REAL=1`, including real video playback and attachment delivery, on
isolated E2E port 4330. This is local WebKit automation only; Firefox full-suite
qualification remains open because of its intermittent 30-second navigation
timeout. Neither run qualifies physical devices or the deployed host.

Validation: 39/39 WebKit workflows passed. No source code changed and no
deployment, host or running-instance changes were made.

## Firefox full-suite rerun — October 27, 2026

A further complete Firefox run with `VIDEO_TEST_REAL=1` again passed 38/39
workflows, including both real-media cases. The 30-second `page.goto` timeout
moved from `course-review` to `course-withdrawal` at `/my-learning`; the
course-withdrawal test passed in isolation. Across full Firefox attempts the
navigation timeout moves between workflows, so no test-specific timeout change
was made and full-suite Firefox qualification remains open.

Validation: 38/39 complete Firefox workflows passed; the isolated
course-withdrawal workflow passed. No source code change, deployment, host or
running-instance modification was made.

## Firefox suite stability follow-up — October 31, 2026

Two homepage-authoring E2E selectors were scoped to the most recently added
placement; the authoring/admin subset passed 9/9 in Firefox. The course-review
test's auxiliary author-page navigation now waits for `domcontentloaded` rather
than the full `load` event; its state/API assertions remain in place. The
course-review workflow passed in isolation and in the subsequent full run.

The latest complete Firefox run with `VIDEO_TEST_REAL=1` passed 37/39. The
remaining 30-second timeouts occurred in paid-checkout's login navigation and
the video workflow's enrollment-response wait. Paid checkout and both video
workflows passed together in isolation (3/3). Earlier full runs also placed the
timeout in course review, while the affected workflows passed in isolation.
Because the timeout moves between workflows, this is still suite-level
intermittency; Firefox full-suite qualification remains open. These are local
E2E test changes only, not application-behavior changes.

Validation:
- `E2E_PORT=4363 npm run test:e2e -- tests/e2e/authoring.spec.ts tests/e2e/admin-users.spec.ts --browser=firefox` (9/9).
- `E2E_PORT=4366 npm run test:e2e -- tests/e2e/course-review.spec.ts --browser=firefox` (1/1).
- `VIDEO_TEST_REAL=1 E2E_PORT=4369 npm run test:e2e -- tests/e2e/paid-checkout.spec.ts tests/e2e/video.spec.ts --browser=firefox` (3/3).
- Full real-media Firefox run on port 4368: 37/39; timeouts in paid-checkout and video noted above.
- `git diff --check` passed. No build/lint was needed because application code was unchanged.

No deploy, host changes, production data access, or running-instance modification
was performed. Physical-device and deployed-host qualification remain pending.

## Full local regression follow-up

The full Vitest regression passed all 215 tests across 65 files with
`VIDEO_TEST_REAL=1` and a 10-second test timeout. The workspace build and lint
also passed. These checks cover the current local checkout only; they do not
resolve the intermittent full-suite Firefox navigation timeout or qualify
physical devices or the deployed host.

Validation: `VIDEO_TEST_REAL=1 npm test -- --reporter=dot --testTimeout=10000`
(215/215); `npm run build`; `npm run lint`. No deploy, host changes, or
modification to the running instance was performed.

## Learner keyboard navigation — October 27, 2026

The learner E2E now uses Enter to open a lesson from the course outline, mark
the lesson complete, and navigate to the next lesson, asserting focus before
each keyboard activation. This focused workflow passed in Chromium, Firefox,
and WebKit. It is a specific local keyboard-operability check, not a
screen-reader, contrast, zoom, mobile-device, or full accessibility audit, nor
does it qualify the complete browser suites.

Validation:
- `E2E_PORT=4330 npm run test:e2e -- tests/e2e/learning.spec.ts --browser=chromium` (1/1).
- `E2E_PORT=4331 npm run test:e2e -- tests/e2e/learning.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4332 npm run test:e2e -- tests/e2e/learning.spec.ts --browser=webkit` (1/1).

No deployment, host or running-instance changes were performed.

## Production pilot configuration preflight — October 31, 2026

Added a read-only preflight for a named production environment file. It clears
ambient application settings before loading that file, requires production
settings to be explicit, enforces checkout disabled and persistent absolute
paths, rejects local SMTP and unsafe file modes, and never prints environment
values. It validates configuration only; it does not test service-user access,
SMTP, VPN/TLS connectivity, or owner/provider qualification.

Validation:
- `npm test -- --run apps/api/src/config.test.ts` (12/12).
- `npm run build` passed.
- `npm run lint` passed.
- CLI integration tests verified successful pilot configuration and rejection
  of enabled checkout without disclosing a test secret.
- `git diff --check` passed.

No deployment, host or running-instance changes were performed.

## Off-site backup encryption runbook — October 31, 2026

Documented an operator-managed `age` workflow for encrypting verified backup
bundles to recipient public keys and decrypting into a new private staging
directory before `backup:verify` and isolated restore. The procedure keeps
private identities outside the application host and off-site storage, uses
unique output names, and states that encryption does not establish sender
identity. Backup retention remains a data-owner decision; automatic pruning is
not enabled.

This was a documentation-only change. The local environment does not have the
`age` executable, so no age interoperability or off-site storage test was run.
No key was generated, package installed, backup encrypted, or host/environment
changed. The command sequence is guidance and must be rehearsed with the selected
OS package and recovery identity before operational use.

## Firefox full-suite follow-up — October 31, 2026

The public HTML workflow with JavaScript disabled now waits for the initial
response commit, then uses DOM assertions to verify the server-rendered
document. Its focused Firefox, Chromium and WebKit runs passed (1/1 each). A
subsequent full Firefox run with real video passed 38/39; the remaining timeout
was at the initial `/auth/login` navigation in the course-withdrawal workflow.
That workflow passed in isolation (1/1), continuing the pattern of the timeout
moving among otherwise passing workflows. The categories workflow now waits for
`domcontentloaded` on its initial login navigation; it passed in the full run
and in a focused Firefox rerun.

Validation:
- `E2E_PORT=4371 npm run test:e2e -- tests/e2e/public-html.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4372 npm run test:e2e -- tests/e2e/public-html.spec.ts --browser=chromium` (1/1).
- `E2E_PORT=4373 npm run test:e2e -- tests/e2e/public-html.spec.ts --browser=webkit` (1/1).
- `E2E_PORT=4383 npm run test:e2e -- tests/e2e/categories.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4382 npm run test:e2e -- tests/e2e/course-withdrawal.spec.ts --browser=firefox` (1/1).
- Full real-media Firefox run on port 4381: 38/39; course-withdrawal login navigation timed out.

Firefox full-suite qualification remains open. This test-only adjustment does
not claim to resolve the broader suite-level intermittency or qualify physical
devices or the deployed host. No deploy, host change, production data access, or
running-instance modification was performed.

## Registered media orphan retention — October 31, 2026

The worker now records the start of an unreferenced period and collects only
registered READY media after the owner-selected 90-day policy. A sweep rechecks
lesson, attachment, cover, and trailer references across all revisions, resets the
timer when media is reused, and locks candidates against new references before
deleting output, poster, HLS-prefix, and upload-chunk files. Failed deletions keep
the lock and are retried. Unregistered files, empty directories, and failed
transcodes are intentionally not collected.

Validation:
- Focused storage, orphan-collection, published-media immutability, upload-cleanup,
  and video API tests: 18 passed, 1 skipped.
- `npm test -- --reporter=dot --testTimeout=10000` (222 passed, 3 skipped;
  64 files passed, 2 skipped).
- `npm run build` passed.
- `npm run lint` passed.
- `git diff --check` passed.

These are local tests using temporary directories and an in-memory database.
No production media was deleted, and no deployment, host or running-instance
changes were performed. Host disk-space behavior and restoration remain
operational qualification.

## Latest Firefox full-suite follow-up

The full local Firefox run with `VIDEO_TEST_REAL=1` again passed 38/39
workflows. Both real-media workflows passed; the video lifecycle uses a scoped
60-second test limit and completed in under 30 seconds. Initial login navigation
in the quiz and learner article workflows now waits for response commit, with
subsequent locators checking readiness; both focused Firefox runs passed. The
remaining timeout moved to the auxiliary author context's `/admin` navigation
in course-review while waiting for `DOMContentLoaded`. Its UI was present in the
failure snapshot, and the course-review workflow passed focused Firefox
validation (1/1). Focused ESLint and `git diff --check` passed.

Validation:
- Focused Firefox quiz workflow on port 4387: 1/1.
- Focused Firefox real-video lifecycle on port 4389: 1/1.
- Full real-media Firefox run on port 4390: 38/39; learner article login timed out.
- Focused Firefox learner article workflow on port 4391: 1/1.
- Full real-media Firefox rerun on port 4392: 38/39; auxiliary course-review navigation timed out.
- Focused Firefox course-review workflow on port 4393: 1/1.

The timeout continues to move between workflows; Firefox full-suite
qualification remains open. These are local E2E changes only. No deployment,
host change, production data access, or physical-device qualification was
performed.

## Media orphan-retention invariants

Migration 102 rejects malformed orphan/collection timestamps and retention
markers on non-READY media. Migration 103 requires an existing valid orphan
timestamp at least 90 days before collection begins; the worker cannot leave
media in a non-READY state while its retention timer or collection lock is active.
The migration test exercises direct SQL rejection and valid cleanup-lock state;
the existing worker regression continues to verify 90-day selection, reference
resets, and retry after storage failure. Migration 102 remains unchanged; the
additional collection-boundary invariant is a new migration 103.

Validation:
- Focused migration and worker cleanup tests: 4 passed across 2 files.
- `npm test -- --reporter=dot`: 223 passed, 3 skipped across 65 passed and 2 skipped files.
- `npm run build` and `npm run lint` passed.
- `git diff --check` passed.

This adds local database enforcement only; it does not change the 90-day
retention period, delete production media, qualify host disk/storage behavior,
or perform a deployment.

## Firefox full-suite rerun — November 1, 2026

The complete local Firefox E2E run with real video enabled passed 38/39
workflows, including both media workflows. The remaining 30-second timeout
moved to the initial `/auth/login` navigation in course-withdrawal, waiting for
`load`. The affected test passed in isolation (1/1), but that does not establish
the cause or resolve the full-suite failure. No further navigation workaround
was added. Firefox full-suite qualification remains open.

Validation:
- Full real-media Firefox run on port 4394: 38/39.
- Focused Firefox course-withdrawal run on port 4395: 1/1.

No deploy, host change, production data access, or physical-device qualification
was performed.

## Chromium and WebKit full-suite reruns — November 1, 2026

The complete local E2E suite passed in both Chromium and WebKit with
`VIDEO_TEST_REAL=1`: each engine passed 39/39 workflows, including real video
upload/playback and supplementary-material workflows. Runs used separate
isolated fixture ports and were performed serially.

Validation:
- Full real-media WebKit run on port 4396: 39/39.
- Full real-media Chromium run on port 4397: 39/39.

These runs qualify the local browser automation only. Firefox remains
intermittent at full-suite level (38/39 on its latest run); Android/iOS physical
devices, the deployed host, and public-domain capacity remain unqualified. No
deployment, host change, production data access, or running-instance
modification was performed.

## Firefox full-suite follow-up against migrations 102–103 — November 1, 2026

The first current-checkout Firefox run passed 37/39. The operations storage
measurement workflow encountered a disposed Playwright API response body while
modifying the intercepted response, and the quiz workflow timed out during
lesson navigation. The operations workflow passed by itself (1/1). A second
complete run passed 38/39; the remaining timeout moved to the auxiliary
author-context `/admin` navigation in course-review while waiting for
`DOMContentLoaded`. Course-review passed in the prior complete run. The two
real-media workflows passed in both runs. The failures move between unrelated
flows, so no timeout or assertion workaround was added.

Validation:
- Full real-media Firefox run on port 4398: 37/39.
- Focused Firefox operations storage workflow on port 4399: 1/1.
- Full real-media Firefox rerun on port 4400: 38/39.

Firefox remains unqualified at full-suite level. The local WebKit and Chromium
runs recorded above each passed 39/39. No deployment, host change, production
data access, or physical-device qualification was performed.

## Real-video desktop browser coverage — October 31, 2026

The real-video E2E workflow passed in both Firefox and WebKit desktop browsers.
Each run covered upload, publication, and learner playback against an isolated
local fixture server.

Validation:
- `VIDEO_TEST_REAL=1 E2E_PORT=4360 npm run test:e2e -- tests/e2e/video.spec.ts --browser=firefox --grep "author uploads a real video"` (1/1).
- `VIDEO_TEST_REAL=1 E2E_PORT=4361 npm run test:e2e -- tests/e2e/video.spec.ts --browser=webkit --grep "author uploads a real video"` (1/1).

These focused desktop runs do not qualify the full Firefox suite, Android Chrome,
physical iOS Safari, or long playback through the deployed host/session renewal.
No deployment, host or running-instance changes were performed.

## Private-route crawler exclusion — October 30, 2026

The public SEO integration test now verifies all six private-path `Disallow`
rules in `robots.txt`, its absolute sitemap reference, and the `noindex,
nofollow, noarchive` header on seven representative admin, authentication,
learner, lesson, and development routes. The focused integration test, lint,
and `git diff --check` passed. No implementation change was needed.

Validation: `npm test -- --reporter=dot apps/api/src/app.test.ts -t "renders
only the published revision"` (1 passed, 55 skipped by the name filter);
`npm run lint`; `git diff --check`. No deployment, host or running-instance
changes were performed.

## Full local regression rerun — October 30, 2026

The complete Vitest suite passed all 215 tests across 65 files with
`VIDEO_TEST_REAL=1` and a 10-second test timeout. The workspace build and lint
also passed. This is local validation only; the intermittent full-suite
Firefox navigation timeout, physical-device checks, host qualification, and
other external launch criteria remain open.

Validation: `VIDEO_TEST_REAL=1 npm test -- --reporter=dot --testTimeout=10000`
(215/215); `npm run build`; `npm run lint`. No deployment, host or
running-instance changes were performed.

## Sitemap visibility transitions — October 29, 2026

The public instructor integration test now checks sitemap membership across
visibility changes: private profiles are omitted, published courses and an
opted-in profile are included, draft courses are omitted, and disabling the
profile removes it again. The focused API integration test passed; lint and
`git diff --check` passed. No sitemap implementation change was needed.

Validation: `npm test -- --reporter=dot apps/api/src/app.test.ts -t "allows
authors to opt in"` (1 passed, 55 skipped by the name filter); `npm run lint`;
`git diff --check`. No deployment, host or running-instance changes were
performed.

## Privacy-review keyboard operation — October 29, 2026

The admin privacy E2E now uses Enter to submit the request search and record
the review, asserting focus on each action and retaining the post-save focus
check. Existing failure/retry, unsaved-note preservation, localized state, and
private-note exclusion checks remain in the same workflow. The focused test
passed in Chromium, Firefox, and WebKit. This is a targeted local interaction
check, not a full accessibility audit or browser-suite qualification.

Validation:
- `E2E_PORT=4348 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts --browser=chromium` (1/1).
- `E2E_PORT=4349 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4350 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts --browser=webkit` (1/1).

No deployment, host or running-instance changes were performed.

## Account-security keyboard errors — October 29, 2026

The password-change E2E now submits mismatch cases with Enter in en, pt-BR,
and es, then verifies that the localized assertive alert receives focus. The
focused account-security workflow passed in Chromium, Firefox, and WebKit.
This tests this form's keyboard/error-focus path only; it is not a full
accessibility audit.

Validation:
- `E2E_PORT=4345 npm run test:e2e -- tests/e2e/account-security.spec.ts --browser=chromium --grep "learner changes password"` (1/1).
- `E2E_PORT=4346 npm run test:e2e -- tests/e2e/account-security.spec.ts --browser=firefox --grep "learner changes password"` (1/1).
- `E2E_PORT=4347 npm run test:e2e -- tests/e2e/account-security.spec.ts --browser=webkit --grep "learner changes password"` (1/1).

No deployment, host or running-instance changes were performed.

## Catalog keyboard navigation — October 27, 2026

The catalog E2E now uses keyboard focus and Enter to navigate to the next page
and apply a search, asserting focus before activation and retaining URL,
filter, and result assertions. The focused workflow passed in Chromium,
Firefox, and WebKit. This is a targeted local interaction check, not a full
accessibility audit or complete browser-suite qualification.

Validation:
- `E2E_PORT=4342 npm run test:e2e -- tests/e2e/catalog.spec.ts --browser=chromium` (1/1).
- `E2E_PORT=4343 npm run test:e2e -- tests/e2e/catalog.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4344 npm run test:e2e -- tests/e2e/catalog.spec.ts --browser=webkit` (1/1).

No deployment, host or running-instance changes were performed.

## Authoring keyboard reordering — October 27, 2026

The local-draft recovery E2E now moves a lesson with the keyboard-accessible
Move up button, asserting focus before activation and after the move as well as
the resulting lesson order. The focused workflow passed in Chromium, Firefox,
and WebKit. This is a targeted control/flow check, not a complete accessibility
audit.

Validation:
- `E2E_PORT=4339 npm run test:e2e -- tests/e2e/authoring.spec.ts --browser=chromium --grep "recovers a local draft"` (1/1).
- `E2E_PORT=4340 npm run test:e2e -- tests/e2e/authoring.spec.ts --browser=firefox --grep "recovers a local draft"` (1/1).
- `E2E_PORT=4341 npm run test:e2e -- tests/e2e/authoring.spec.ts --browser=webkit --grep "recovers a local draft"` (1/1).

No deployment, host or running-instance changes were performed.

## Quiz preview dialog focus — October 27, 2026

The quiz-builder E2E now verifies that opening the preview focuses its close
button, Escape dismisses the modal dialog, and focus returns to the preview
trigger. The focused authoring workflow passed in Chromium, Firefox, and
WebKit. This is a targeted keyboard/focus check, not a complete accessibility
audit.

Validation:
- `E2E_PORT=4336 npm run test:e2e -- tests/e2e/quiz-builder.spec.ts --browser=chromium` (1/1).
- `E2E_PORT=4337 npm run test:e2e -- tests/e2e/quiz-builder.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4338 npm run test:e2e -- tests/e2e/quiz-builder.spec.ts --browser=webkit` (1/1).

No deployment, host or running-instance changes were performed.

## Learner quiz keyboard operation — October 27, 2026

The quiz-attempt E2E now uses keyboard activation to start/resume an attempt,
select an answer with Space, and submit with Enter, checking focus on key
actions and retaining the existing autosave/reload/result assertions. The
focused workflow passed in Chromium, Firefox, and WebKit. This validates the
tested controls and path only; it is not a screen-reader or full accessibility
audit.

Validation:
- `E2E_PORT=4333 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts --browser=chromium` (1/1).
- `E2E_PORT=4334 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4335 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts --browser=webkit` (1/1).

No deployment, host or running-instance changes were performed.

## Learner narrow-viewport layout — October 30, 2026

The integrated learning E2E now exercises enrollment, lesson navigation and
completion, and the learning-progress page at a 360×780 viewport. It checks that
the course, lesson, and progress pages do not overflow horizontally. This is
local responsive-layout coverage in Chromium, Firefox, and WebKit, not
physical-device playback or qualification.

Validation:
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome E2E_PORT=4342 npm run test:e2e -- tests/e2e/learning.spec.ts --browser=chromium` (1/1).
- `E2E_PORT=4343 npm run test:e2e -- tests/e2e/learning.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4344 npm run test:e2e -- tests/e2e/learning.spec.ts --browser=webkit` (1/1).
- `npm run lint` passed.
- `git diff --check` passed.

No deployment, host or running-instance changes were performed.

## Real video playback in mobile browser emulation — October 30, 2026

The real-media E2E now opens a separate Chromium context with a narrow mobile
viewport, touch input, and device scale factor. It signs in the learner, opens
the enrolled video lesson, verifies the saved playback position is restored,
checks for horizontal overflow, and plays the video. This is local browser
emulation and does not qualify playback on a physical device.

Validation:
- `VIDEO_TEST_REAL=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome E2E_PORT=4345 npm run test:e2e -- tests/e2e/video.spec.ts --browser=chromium --grep "author uploads a real video"` (1/1).
- Focused ESLint passed.
- `git diff --check` passed.

No deployment, host or running-instance changes were performed.

## Quiz interaction in mobile browser emulation — October 30, 2026

The quiz-attempt E2E now uses a separate Chromium context configured with a
390×844 mobile viewport, touch input, and device scale factor. The learner opens
the remaining attempt, selects an answer with a touchscreen tap, confirms the
autosave status, and submits the passing result. The page is checked for
horizontal overflow. This is local browser emulation, not physical-device
qualification.

Validation:
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome E2E_PORT=4346 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts --browser=chromium` (1/1).
- `E2E_PORT=4347 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts --browser=firefox` (1/1; standard browser flow).
- `E2E_PORT=4348 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts --browser=webkit` (1/1; standard browser flow).
- `npm run lint` passed.
- `git diff --check` passed.

No deployment, host or running-instance changes were performed.

## Quiz attempt resumption across interface languages — October 30, 2026

The learner quiz E2E now changes the interface language among Portuguese,
Spanish, and English during an active attempt. After each full page rerender,
the learner resumes the attempt and the test verifies the saved answer is still
selected and the in-progress status is translated. The workflow then continues
through submission and the existing result checks. This is local
Chromium/Firefox/WebKit coverage of this quiz path, not qualification of all
translated workflows or external devices.

Validation:
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome E2E_PORT=4339 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts` (1/1).
- `E2E_PORT=4340 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts --browser=firefox` (1/1).
- `E2E_PORT=4341 npm run test:e2e -- tests/e2e/quiz-attempts.spec.ts --browser=webkit` (1/1).
- `npm run lint` passed.
- `git diff --check` passed.

No deployment, host or running-instance changes were performed.

## Isolated backup and restoration rehearsal — October 31, 2026

Repeated the local real-media recovery rehearsal and focused bundle tests. They
use fictional accounts, temporary directories and loopback HTTP servers; the
rehearsal removes the source database/media from service before starting the
recovered copy. Coverage includes old published-revision playback, MP4 Range/HLS,
captions/poster, progress, certificate verification/PDF identity, authorization,
and invalidation of recovered sessions and one-time links. All 18 selected tests
passed. This does not rehearse destination configuration, off-site recovery,
encryption/retention, or a target host.

Validation:
- `VIDEO_TEST_REAL=1 npm test -- --run apps/api/src/backup-recovery.test.ts apps/api/src/db/backup.test.ts` (18/18).

No deployment, host or running-instance changes were performed.

## Isolated backup and restoration rehearsal — November 6, 2026

Repeated the local real-media recovery rehearsal with the current migration
set and backup-bundle tests. They use fictional accounts, temporary directories
and loopback HTTP servers; the rehearsal removes the source database/media from
service before starting the recovered copy. Coverage includes old published-
revision playback, MP4 Range/HLS, captions/poster, progress, certificate
verification/PDF identity, authorization, and invalidation of recovered sessions
and one-time links. All 20 selected tests passed. This does not rehearse
destination configuration, off-site recovery, encryption/retention, or a target
host.

Validation:
- `VIDEO_TEST_REAL=1 npm test -- --run apps/api/src/backup-recovery.test.ts apps/api/src/db/backup.test.ts --maxWorkers=1 --testTimeout=10000` (20/20).

No deployment, host or running-instance changes were performed.

## Prototype migration completeness check — November 6, 2026

The synthetic prototype restoration test now compares the applied migration
records with every SQL migration in the checkout, then runs the migration
runner again and verifies the recorded schema does not change. It starts from
the prototype-era schema and uses fictional accounts/content in a temporary
database. This is local migration coverage, not an upgrade/rollback rehearsal
on systemd, Docker, staging, or a target host.

Validation:
- `npm test -- --run apps/api/src/db/authoring-migration.test.ts`: 4/4 passed.

No deployment, host or running-instance changes were performed.

## Sensitive-data-safe operational error logs — November 6, 2026

Unexpected API failures now log only the HTTP method, registered route template,
and an allowlisted error type/code. Request URLs, query values, correlation IDs,
messages and stacks are omitted. Worker failure logs use the same restricted
error label instead of raw exception messages; API startup failures are also
sanitized. The admin CLI preserves its expected duplicate-account instructions
but replaces unexpected database error output with a fixed message. Tests inject
secret-bearing messages, stacks, query strings, correlation IDs and SQLite
trigger errors and also simulate a missing database path; they verify that such
details are not emitted. This covers application logs only, not host journal
policy, external log collectors, retention or alert delivery.

Validation:
- Focused safe-logging, outbox-worker, admin CLI and admin-operations tests:
  19 passed.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

No deployment, host or running-instance changes were performed.

## Backup destination symlink-alias protection — November 5, 2026

Bundle creation now resolves the destination parent and source database to
canonical paths before checking that the new bundle is outside the database and
media-storage paths. This rejects a destination whose parent is a symlink alias
into the media root, preventing the backup from copying its own growing output.
A regression test verifies rejection occurs before a destination is created.

Validation:
- `npm test -- --reporter=dot apps/api/src/db/backup.test.ts`: 19/19 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

This is a local backup-tool change only; no backup was made from production,
and no deployment, host, or running-instance changes were performed.

## Worker stale alert beyond dashboard list limit — November 5, 2026

The operations dashboard displays at most 20 worker instances. Its stale-worker
alert now aggregates every active instance independently of that presentation
limit, so a stale worker cannot be hidden behind 20 more recent healthy entries.
Stopped historical instances remain excluded from the stale count.

The focused operations API tests passed, including a regression with 21 recent
healthy workers and one stale active worker. Build, lint, and `git diff --check`
passed. This is local dashboard/API validation only; no external worker,
deployment, host, or running-instance changes were performed.

The operations runbook and OpenAPI alert description were corrected to
distinguish the 20-row display limit from alert evaluation across all worker
records. The documentation and contract update is local; it does not change
alert delivery or qualify external workers.

## Keyboard focus indicator contrast — November 1, 2026

The shared `:focus-visible` outline was darkened from `#c18317` to `#b5750c`
after a local contrast check measured 2.98:1 against the page paper surface,
below the 3:1 non-text contrast target for a visible focus indicator. The new
color measures 3.53:1 against paper (`#f5f7f3`) and 3.81:1 against white.
A regression test reads the CSS tokens and checks both surface combinations.
The same focused check found that the form error-message border measured 2.97:1
against its background; it was darkened to `#b87358`, measuring 3.38:1, and the
test now guards this status-surface pair as well.
The shared text-field, select, and textarea border measured 2.79:1 against the
page paper background. It was darkened to `#71877e`, measuring 3.56:1 on paper
and 3.84:1 on white; both combinations are covered by the regression test.
Disabled primary buttons rendered at only 2.87:1 against white (2.91:1 on paper)
because the shared disabled rule applied 60% opacity to both foreground and
background. They now use opaque `#132a34` text on `#d9e3df`, which exceeds 4.5:1,
at 11.36:1. A regression test prevents reintroducing opacity and checks the text
ratio.
Semantic `fieldset` boundaries inherited a 1.31:1 line color on white. They now
use `#71877e`, measuring 3.84:1 on white, 3.56:1 on paper, and 3.66:1 on the
editor's pale panel background; all three surfaces are covered by regression
tests. Other decorative separators retain the lighter line color.
The lesson/module drag state used 60% opacity on the entire fieldset, reducing
muted helper text to 2.58:1 on white. It now uses a dashed green outline instead,
which distinguishes the dragged item without lowering text contrast; tests check
the outline against white and the editor's pale panel and reject opacity.
The Markdown toolbar and lesson/module row controls were verified to use
secondary buttons on hover. Their inherited ink text on the pale hover fill
exceeds 4.5:1; the focused contrast suite now guards that combination.
The same suite now checks regular body text, links, muted and certificate labels,
valid/revoked certificate states, badges, primary/secondary buttons, module-editor
helper text, form errors, draft-save feedback, and code blocks on their declared
backgrounds. The lowest text ratio among these combinations is 5.62:1 (muted
text on the page), above the 4.5:1 normal-text target.

Validation:
- `npm test -- --run apps/web/src/focus-contrast.test.ts` (30/30).
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome E2E_PORT=4394 npm run test:e2e -- tests/e2e/authoring.spec.ts --grep "focused studio"` (1/1).
- `npm run build` passed for all workspaces.
- `npm run lint` passed.
- `git diff --check` passed.

This is a focused local contrast check, not a complete WCAG/accessibility audit
or screen-reader, browser-suite, physical-device, or deployed-host qualification.
No deployment, host or running-instance changes were performed.

## Full Chromium, WebKit, and Firefox E2E follow-up — November 4, 2026

The complete local Chromium E2E suite passed 39/39 with real video enabled,
including upload/playback and supplementary-material workflows. The complete
local WebKit suite also passed 39/39 with real video enabled. An earlier WebKit
attempt had a navigation interruption during admin MFA followed by browser
closure errors; that focused MFA workflow passed alone (1/1), and the subsequent
full WebKit rerun passed. Do not count the interrupted attempt as a full run.

The complete local Firefox suite passed 38/39. Course withdrawal timed out while
loading `/my-learning`; the same workflow passed alone (1/1). This repeats the
existing moving full-suite navigation intermittency, so no timeout workaround
was introduced and Firefox full-suite qualification remains open.

Validation:
- Full real-media Chromium E2E on isolated port 4326: 39/39.
- Full real-media WebKit E2E on isolated port 4329: 39/39.
- Focused WebKit admin-MFA rerun on isolated port 4328: 1/1.
- Full real-media Firefox E2E on isolated port 4324: 38/39.
- Focused Firefox course-withdrawal rerun on isolated port 4325: 1/1.

These are local browser-automation results only. Firefox is not yet qualified
for a clean complete run; physical Android/iOS devices and the deployed host
remain unqualified. No deployment, host, or running-instance changes were made.

## Firefox full-suite follow-up — November 4, 2026

A further full local Firefox run with real video enabled passed 38/39. The
remaining timeout moved to the initial `/auth/login` navigation in the admin
date-localization workflow; course withdrawal passed in this run. The
date-localization workflow passed alone (1/1). This confirms that the
navigation timeout continues to move between workflows and does not establish
the cause. No per-test timeout workaround was applied.

Validation:
- Full real-media Firefox E2E on isolated port 4330: 38/39.
- Focused Firefox admin date-localization rerun on isolated port 4331: 1/1.

Firefox remains unqualified at full-suite level. No deployment, host, or
running-instance changes were made.

## Firefox full-suite rerun — November 7, 2026

The complete local Firefox E2E run with real-media coverage passed 38/44. Six
failures appeared in authoring, paid checkout, quiz attempt/build, and video
upload/material workflows. They involved a timeout at initial login navigation,
three waits for the administrator link, and two quiz checks where that link was
missing after navigation to `/my-learning`. All six failed cases passed when
rerun together in an isolated focused invocation. This supports suite-level
intermittency, but does not identify its cause. No per-test timeout or
navigation workaround was made.

Validation:
- `VIDEO_TEST_REAL=1 E2E_PORT=4443 npm run test:e2e -- --browser=firefox`: 38/44.
- Focused Firefox rerun of the six failed workflows on isolated port 4444: 6/6 passed.

Firefox remains unqualified at full-suite level. These are local browser results
only; no deployment, host, or running-instance changes were made.

## Category SQLite whitespace invariant — November 4, 2026

The category-field integrity migration now treats the JavaScript `trim()`
Unicode whitespace set as blank when validating names at the SQLite boundary.
This aligns direct SQL writes with the existing API `.trim().min(1)` rule.

Validation:
- Focused category field/version migration tests: 2/2 passed; the tests apply
  the complete migration chain through migration 142 and reject Unicode-only
  names on both insert and update.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This is local migration/test validation only. No deployment, host, or
running-instance changes were made; Firefox/WebKit full-suite and physical
device qualifications are unaffected.

## Category name UTF-16 length invariant — November 4, 2026

Migration 143 aligns the SQLite category-name maximum with JavaScript/Zod
length semantics. SQLite counts Unicode code points, while JavaScript counts
UTF-16 code units; the trigger now counts supplementary characters as two.
The direct-SQL test accepts exactly 100 UTF-16 units and rejects 102 on both
insert and update.

Validation:
- Focused category field/version migration tests: 2/2 passed; the tests apply
  the complete migration chain through migration 143.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Translated metadata UTF-16 integrity — November 5, 2026

Migration 152 supplements the course-translation shape triggers with JavaScript
UTF-16 length enforcement for translated title, summary, and long-text fields,
and rejects embedded NUL in translated text. It applies on direct inserts and
updates without changing the existing locale/shape policy.

The focused course translation migration test passed, covering insert and
update limits and NUL rejection. Workspace build, lint, and `git diff --check`
also passed. This change is local only; it has not been deployed or applied to
a host or running instance.

## Translated metadata Unicode whitespace integrity — November 5, 2026

Migration 153 aligns the SQLite translated-content requirement with the API's
JavaScript `.trim()` check. A translation whose permitted text fields contain
only JavaScript whitespace is now rejected on direct inserts and updates; valid
content in another field remains accepted.

The focused course translation migration test passed for all JavaScript trim
whitespace code points on insert, plus update rejection and mixed-field
acceptance. Workspace build, lint, and `git diff --check` passed. This change
is local only; it has not been deployed or applied to a host or running
instance.

## Revision price currency API enum — November 5, 2026

Migration 154 closes a direct-SQL validation gap: paid course revisions now
accept only `BRL`, `USD`, and `EUR`, matching the API schema. It adds insert and
update triggers and does not rewrite any existing price snapshots.

The focused revision-pricing migration test passed for all supported currencies
and rejected unsupported uppercase three-letter codes on insert and update.
Workspace build, lint, and `git diff --check` passed. This change is local only;
it has not been deployed or applied to a host or running instance.

## Revision price amount API bounds — November 5, 2026

Migration 155 aligns direct SQLite writes for paid course revision prices with
the API's integer range of 1 through 100,000,000 minor units. It rejects
fractional values and out-of-range amounts on inserts and updates, without
rewriting historical price snapshots.

The focused revision-pricing migration test passed at both valid boundaries and
for rejected fractions and over-limit values on insert/update. Workspace build,
lint, and `git diff --check` passed. This change is local only; it has not been
deployed or applied to a host or running instance.

## Course revision text limits — November 5, 2026

Migration 156 enforces the API's 255-unit title and 1,000-unit summary maxima
in UTF-16 at the SQLite boundary and rejects embedded NUL in either field.
The API applies the same NUL rejection. Existing minimum-length behavior is
unchanged, avoiding a rewrite or stricter validation of historical data.

Focused SQLite migration and course-metadata API tests passed. Workspace build,
lint, and `git diff --check` passed. The full `app.test.ts` run exposed a
separate `ReferenceError: profile is not defined` in the instructor-profile
home-curation test; that unrelated failure is not part of this validation.
This change is local only; it has not been deployed or applied to a host or
running instance.

## Operations dashboard narrow-viewport localization — November 6, 2026

The mobile viewport E2E now checks the public catalog and administrator
operations dashboard at 320 CSS pixels and verifies that the page has no
horizontal overflow. On the dashboard it also switches among English, Brazilian
Portuguese, and Spanish, checking the localized title and refresh control while
retaining the viewport-width assertion. This is a browser-emulated viewport
check, not a browser-zoom audit or physical-device qualification.

Validation:
- `E2E_PORT=4410 npm run test:e2e -- tests/e2e/mobile-viewport.spec.ts`: 1/1 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

No deployment, host or running-instance changes were performed.

## Authoring title limits — November 5, 2026

Migration 157 aligns module, lesson, and course-attachment title validation
with the API's 1–200 UTF-16-unit limit and rejects embedded NUL. SQLite direct
insert/update triggers cover all three tables, and the course authoring API
uses the same shared title schema.

Focused migration and API tests, workspace build, lint, and `git diff --check`
passed. This change is local only; it has not been deployed or applied to a
host or running instance.

## Attachment description integrity — November 5, 2026

Migration 158 rejects empty module, lesson, and attachment titles on direct
SQLite writes, matching the API's minimum length. It also enforces the API's
2,000 UTF-16-unit attachment-description limit and rejects embedded NUL on
direct SQL and API writes.

The focused migration test passed for inserts and updates, including a valid
2,000-unit boundary and rejected NUL/over-limit descriptions. Focused API tests,
workspace build, lint, and `git diff --check` also passed. This change is local
only; it has not been deployed or applied to a host or running instance.

## Course revision metadata limits — November 5, 2026

Migration 159 enforces API-matching UTF-16 maxima and embedded-NUL rejection
for instructor name/bio, access and certificate terms, learning outcomes,
prerequisites, and cover alternative text. The course API uses a shared bounded
metadata schema for these fields. Existing minimum-length behavior is unchanged.

Focused SQLite migration and course-metadata API tests passed. Workspace build,
lint, and `git diff --check` passed. This change is local only; it has not been
deployed or applied to a host or running instance.

## Lesson body limits — November 5, 2026

Migration 160 aligns direct SQLite lesson-body writes with the API's 100,000
UTF-16-unit limit and rejects embedded NUL. The check preserves existing
nullable body records and applies to both insert and update paths. The API uses
the same schema for authored lesson content and content previews.

Focused SQLite migration tests passed for the exact UTF-16 boundary, oversized
ASCII and supplementary text, NUL rejection, and nullable legacy bodies.
Focused API tests passed for the boundary, over-limit, and NUL cases in authored
content and previews. Workspace build, lint, and `git diff --check` passed.
This change is local only; it has not been deployed or applied to a host or
running instance.

## Course slug integrity — November 5, 2026

Migration 161 applies the API's 3–100-character lowercase ASCII slug policy to
course rows and non-null course-revision slugs on direct SQLite inserts and
updates. Nullable historical revision slugs remain valid.

Focused migration tests passed for valid boundary values and invalid length,
case, character, and hyphen placement on both insert and update paths.
Workspace build, lint, and `git diff --check` passed. This change is local only;
it has not been deployed or applied to a host or running instance.

## Published course slug consistency — November 5, 2026

Migration 162 prevents direct SQLite writes from separating a published
course's public slug from its published revision slug. Normal publication can
change both values in its existing transaction. Draft slugs remain independent,
and nullable legacy revision slugs are preserved.

Focused migration tests passed for rejected course-slug, published-pointer, and
revision-slug mismatches, plus successful synchronized publication updates and
nullable legacy slugs. Database and course-publication regression tests passed
(87 tests across 58 files). Workspace build, lint, and `git diff --check`
passed. This change is local only; it has not been deployed or applied to a host
or running instance.

## Published course access-mode consistency — November 5, 2026

Migration 163 prevents direct SQLite writes from separating a published
course's access mode from its published revision. Publication can switch both
values atomically; nullable legacy revision access modes remain compatible.

Focused migration tests passed for rejected access-mode and published-pointer
mismatches, a successful synchronized revision update, and nullable legacy
modes. Database and course-publication regression tests passed (88 tests across
59 files). Workspace build, lint, and `git diff --check` passed. This change is
local only; it has not been deployed or applied to a host or running instance.

## Published course locale consistency — November 5, 2026

Migration 164 enforces the API locale enum (`en`, `pt-BR`, `es`) for direct
SQLite writes to courses and non-null course-revision locales. Published course
locales must match their published revision; nullable legacy revision locales
remain accepted.

Focused migration tests passed for invalid enum values, locale/published-pointer
mismatches, synchronized publication updates, and nullable legacy locales.
Database and course-publication regression tests passed (89 tests across 60
files). Workspace build, lint, and `git diff --check` passed. This change is
local only; it has not been deployed or applied to a host or running instance.

## User locale format integrity — November 5, 2026

Migration 165 enforces the registration schema's lowercase two-letter language
or language-region format on direct user-locale inserts and updates. It retains
the API's broader supported-language format rather than limiting account
locales to the currently translated interface languages. Existing rows are not
rewritten.

Focused migration tests passed for accepted language and language-region
locales, malformed casing/length/whitespace/NUL values, and update behavior.
All database migration tests passed (87 tests across 60 files). Workspace build,
lint, and `git diff --check` passed. This change is local only; it has not been
deployed or applied to a host or running instance.

## Course revision duration integrity — November 5, 2026

Migration 166 enforces the course API's optional integer duration range of
1–60,000 minutes on direct SQLite inserts and updates. Null remains valid for
unspecified and legacy durations.

Focused migration tests passed for minimum and maximum bounds, nullable values,
and rejection of zero, negative, over-limit, fractional, and text inputs on
insert/update paths. All database migration tests passed (88 tests across 61
files). Workspace build, lint, and `git diff --check` passed. This change is
local only; it has not been deployed or applied to a host or running instance.

## User session-version integrity — November 5, 2026

Migration 167 enforces nonnegative integer session versions and allows updates
only to preserve the value or increment it by one. This matches the API's
session invalidation paths for password, role/status changes, and bundle
restoration. Existing rows are neither rewritten nor retroactively validated.

Focused migration tests passed for valid defaults, preserved values, single
increments, and rejection of negative, fractional, text, regressing, and
multi-generation updates. All database migration tests passed (89 tests across
62 files); workspace build, lint, and `git diff --check` passed. This change is
local only; it has not been deployed or applied to a host or running instance.

## User email normalization integrity — November 5, 2026

Migration 168 requires `email_normalized` to equal the lowercase, trimmed
address on user inserts and address updates, and on pending email-change
requests. Embedded NUL is rejected. Mixed-case display addresses remain valid
and are preserved; the normalized value continues to serve login and uniqueness
lookups. Existing rows are not rewritten or retroactively validated.

The migration test covers valid mixed-case addresses, rejected mismatches and
NULs for both tables, and a valid user email update. The account email-change
confirmation API workflow also passed. All database migration tests passed
(91 tests across 63 files); workspace build and lint passed. This change is
local only; it has not been deployed or applied to a host or running instance.

## User timestamp integrity — November 5, 2026

Migration 169 requires parseable `created_at`, `updated_at`, and optional
`verified_at` values on user inserts and updates to those timestamp fields.
SQLite's default datetime format and the API's ISO timestamps remain accepted;
null verification timestamps remain valid. The migration does not impose
timestamp ordering or rewrite existing rows.

The focused migration test covers valid SQLite/ISO timestamps, null and
populated verification dates, malformed inserts and updates, and normal
verification changes. Four account API flows for email verification, email
change, password change, and password reset passed. All database migration
tests passed (92 tests across 64 files); workspace build and lint passed. This
change is local only; it has not been deployed or applied to a host or running
instance.

## User password-hash integrity — November 5, 2026

Migration 170 requires `users.password_hash` to be nonempty, NUL-free text on
user inserts and password-hash updates. It does not impose a specific encoded
hash format, preserving compatibility with existing credential encodings and
test/legacy opaque hashes. Existing rows are not rewritten or retroactively
validated.

The focused migration test covers accepted nonempty text and rejected empty,
NUL-containing, and BLOB values on both insert and update. The complete database
migration suite passed (93 tests across 65 files), and the administrator
password-reset test passed. Workspace build, lint, and `git diff --check` passed.
This change is local only; it has not been deployed or applied to a host or
running instance.

## User email address integrity — November 5, 2026

Migration 171 rejects empty or non-text email addresses and normalized addresses
on user inserts and address updates. It also rejects empty or non-text addresses
on pending email-change inserts. This closes the direct-SQL case where both
address fields could be empty while satisfying the normalization invariant.
Existing rows are not rewritten or retroactively checked.

The focused migration test covers valid mixed-case addresses, empty and
space-only addresses, a BLOB input, mismatched normalization, embedded NUL,
address updates, and pending email-change inserts. The account email-change
confirmation API workflow passed. All database migration tests passed (93 tests
across 65 files); workspace build, lint, and `git diff --check` passed. This
change is local only; it has not been deployed or applied to a host or running
instance.

## Course revision publication timestamp integrity — November 5, 2026

Migration 172 requires `course_revisions.published_at` to be parseable text
without embedded NUL when a draft is transitioned to published. Draft `NULL`
timestamps remain valid. The existing published-revision lifecycle already
prohibits inserting an already-published revision and makes a published revision
immutable, so the new guard validates the actual publication transition only.
Existing rows are not retroactively validated or rewritten.

The focused migration test covers valid SQLite and ISO publication timestamps,
rejected malformed, NUL-containing, and BLOB values, and an unmodified draft
with a `NULL` timestamp. All database migration tests passed (94 tests across
66 files); the three course-publication service tests, workspace build, lint,
and `git diff --check` passed. This change is local only; it has not been
deployed or applied to a host or running instance.

## Scheduled publication timestamp integrity — November 5, 2026

Migration 173 requires `courses.scheduled_publication_at` to be parseable,
NUL-free text on course inserts and scheduled-publication updates whenever it
is set. Unscheduled courses may still keep the field `NULL`; the pre-existing
triggers continue to enforce REVIEW status and matching revision/actor fields.
Existing rows are not rewritten or retroactively validated.

The focused migration test covers valid scheduled timestamps, malformed,
NUL-containing and BLOB updates, an invalid scheduled insert, and schedule
cancellation. All database migration tests passed (94 tests across 66 files),
as did the focused course-publishing tests, workspace build, lint, and
`git diff --check`. This change is local only; it has not been deployed or
applied to a host or running instance.

## Media-retention timestamp integrity — November 5, 2026

Migration 174 strengthens the orphan-retention and collection timestamp guards
to require parseable, NUL-free text on media inserts and updates whenever those
fields are set. It preserves the existing READY-state requirement and minimum
90-day collection boundary. Existing rows are not rewritten or retroactively
validated.

The focused migration test covers valid retention transitions, malformed,
NUL-containing, and BLOB timestamps on insert/update, cancellation, and
rejection of non-READY media. Orphan-cleanup worker tests passed. All database
migration tests passed (94 tests across 66 files); workspace build, lint, and
`git diff --check` passed. This change is local only; it has not been deployed
or applied to a host or running instance.

## Worker heartbeat timestamp integrity — November 5, 2026

Migration 175 requires worker `started_at`, `heartbeat_at`, and optional
`stopped_at` values to be parseable, NUL-free text on insert and update. It
retains the existing timestamp ordering, monotonic heartbeat, immutable process
identity/start time, and terminal stopped-worker rules. Existing worker history
is not rewritten or retroactively validated.

The worker-heartbeat test covers malformed, NUL-containing, and BLOB values for
all timestamps on insert and mutable timestamps on active-worker update, as well
as normal registration/refresh/shutdown and rejected post-shutdown changes.
All database migration tests and the focused worker-heartbeat test passed
(95 tests across 67 files); workspace build, lint, and `git diff --check`
passed. This change is local only; it has not been deployed or applied to a host
or running instance.

## Video duration integrity — November 5, 2026

Migration 176 enforces the media worker's probed-duration contract on direct
SQLite inserts and updates: a provided duration must be numeric, greater than
zero, and no more than 14,400 seconds (four hours). `NULL` remains valid for
unfinished processing and historical rows with no measured duration.

The focused migration test covers `NULL`, the smallest positive numeric
boundary, the four-hour maximum, and rejection of zero, negative, over-limit,
text, BLOB, and infinite values on insert/update. All database migration tests
passed (95 tests across 67 files), as did the video-job test, workspace build,
lint, and `git diff --check`. This change is local only; it has not been
deployed or applied to a host or running instance.

## Video upload timestamp integrity — November 5, 2026

Migration 177 validates media-upload creation, activity, and worker-heartbeat
timestamps on direct SQLite writes. Values must be parseable, NUL-free text;
heartbeat remains optional, and the existing insert trigger continues to
initialize upload activity. The focused migration test checks invalid inserts
and updates while preserving valid ISO timestamps and a nullable heartbeat.

Validation:
- Database test suite: 96 tests passed across 68 files.
- Media API/worker regression tests: 13 passed, 1 optional test skipped.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Video upload byte-range integrity — November 5, 2026

Migration 178 enforces integer upload sizes and current offsets, and requires
each chunk's positive integer byte range to fit within its parent upload. The
focused migration test covers valid boundaries, fractional/text/BLOB values,
negative and over-limit sizes, and invalid chunk ranges on inserts and updates.

Validation:
- Database test suite: 97 tests passed across 69 files.
- Media API/worker regression tests: 13 passed, 1 optional test skipped.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Video chunk digest integrity — November 5, 2026

Migration 179 requires video chunk digests to be 64-character lowercase
hexadecimal SHA-256 values on inserts and updates, matching the API's
`createHash('sha256').digest('hex')` output. The focused migration test covers
valid digests and rejects wrong lengths, non-hex characters, uppercase,
embedded NUL, and BLOB values.

Validation:
- Database test suite: 98 tests passed across 70 files.
- Video/media API and worker tests: 14 passed, 1 optional test skipped.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Video chunk immutability — November 5, 2026

Migration 180 prevents updates to a registered chunk's upload, offset, size,
storage key, or SHA-256 digest. The API and worker only create, read, and delete
chunks; cancellation and retention cleanup continue to delete them. The focused
migration test checks each immutable field and verifies deletion remains allowed.

Validation:
- Database test suite: 99 tests passed across 71 files.
- Video/media API and worker tests: 14 passed, 1 optional test skipped.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Upload chunk cursor integrity — November 6, 2026

Migration 181 requires each new chunk to start at the stored upload cursor and
advances the cursor in the same SQLite transaction. Direct cursor updates must
match the last stored chunk boundary. Chunk deletion is allowed only after an
upload is READY or CANCELLED, preserving API cancellation and retention cleanup.
The API now relies on the database trigger for cursor advancement and still
updates the activity timestamp in its upload transaction.

Validation:
- Database test suite: 100 tests passed across 72 files.
- Video/media API and worker tests: 14 passed, 1 optional test skipped.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Upload completion integrity — November 6, 2026

Migration 182 rejects direct inserts and transitions into `QUEUED`, `PROCESSING`,
`READY`, or `FAILED` unless the stored upload cursor equals the declared size.
Partial uploads may remain `UPLOADING` or be cancelled. The check complements
the existing API completion check and does not change the cursor/chunk invariant
from migration 181. Upload lifecycle and media fixtures now represent completed
uploads before entering processing states.

Validation:
- SQLite migration tests: 101 passed across 73 files.
- Focused video/media API and worker tests: 30 passed, 1 optional test skipped.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Full suite with one worker and a 10-second test timeout: 300 passed, 3 skipped,
  12 failed in unrelated profile/locale fixtures (`profile` undefined and
  invalid/published locale data). The full suite is not green.

This change and its validation were committed and pushed, but not deployed or
applied to a production database or host. Firefox/WebKit and physical-device
qualification remain external and pending.

## Account display-name integrity — November 4, 2026

Migration 151 protects `users.display_name` at the SQLite boundary with
JavaScript-compatible Unicode whitespace trimming, a 100 UTF-16-unit maximum,
and embedded-NUL rejection. Existing signup behavior is preserved: inserts
with the default empty name remain valid, while explicit updates must provide
a nonblank name just as the API requires.

Validation:
- Focused SQLite migration test: passed through migration 151, including the
  empty insert default, exact 100-unit boundary, and invalid update rejection.
- Account profile API tests: passed, covering Unicode whitespace, NUL, and
  over-limit names.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Instructor profile timestamp integrity — November 4, 2026

Migration 150 validates `instructor_profiles.updated_at` on insert and update
and prevents updates from moving the timestamp backward. Equal timestamps
remain valid, preserving same-second updates.

Validation:
- Instructor-profile migration tests: 4/4 passed through migration 150,
  including invalid timestamps, equal-time updates, and backward-time rejection.
- Focused instructor-profile API test: passed.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Instructor website URL integrity — November 4, 2026

Migration 148 enforces the API's 500 UTF-16-unit maximum and rejects embedded
NUL for non-null instructor website URLs on direct SQLite inserts and updates.
Migration 149 requires the HTTPS scheme for direct writes, matching the API's
public website URL policy. These database triggers enforce storage bounds,
NUL exclusion, and protocol only; full URL parsing remains at the API boundary.

Validation through migration 149:
- Instructor-profile migration tests: 3/3 passed through migration 149,
  covering the 500-unit boundary, oversize/NUL rejection on insert and update,
  HTTPS-only direct writes, and nullable URL clearing.
- Focused instructor-profile API test: passed for HTTP rejection and the
  500-unit size limit.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Instructor profile text integrity — November 4, 2026

Migration 147 aligns `display_name` and `bio` SQLite validation with the API:
JavaScript Unicode whitespace-only names are rejected, maximum lengths use
UTF-16 units (100 for display names and 5000 for bios), and embedded NUL is
rejected. The API schema enforces the same NUL rule; direct-SQL coverage checks
insert and update behavior.

Validation:
- Instructor-profile migration tests: 2/2 passed through migration 147,
  covering Unicode-only names, UTF-16 boundaries, NUL, and update rejection.
- Focused instructor-profile API test: passed for the same invalid-input
  categories.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Instructor profile slug invariant — November 4, 2026

Migration 146 enforces the API's profile slug grammar for direct SQLite writes:
3–80 lowercase ASCII letters/digits, with nonempty segments separated by
single hyphens. Inserts and updates reject repeated, leading, trailing, or
otherwise invalid separators.

Validation:
- Focused instructor-profile migration test: passed through migration 146,
  exercising valid inserts/updates and invalid slug boundaries.
- Focused instructor-profile API test: passed, including repeated/trailing
  hyphen rejection.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Category embedded-NUL integrity — November 4, 2026

SQLite's `length()` stops counting text at an embedded NUL, while JavaScript
counts the full string. Migration 144 rejects embedded NUL in category names
and descriptions at the SQLite boundary; the category API rejects them before
writing as well.

Validation:
- Focused category SQLite migration test: passed through migration 144,
  rejecting embedded NUL in name/description on insert and update.
- Focused category API test: passed; create rejects NUL in name/description
  and update rejects NUL in the name.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Category description UTF-16 length invariant — November 4, 2026

Migration 145 aligns the SQLite description limit with JavaScript/Zod
`.max(1000)` semantics. Supplementary Unicode characters count as two UTF-16
units; the direct-SQL test accepts exactly 1000 units and rejects 1002 on
insert and update.

Validation:
- Focused category field/version migration tests: 2/2 passed; the tests apply
  the complete migration chain through migration 145.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `git diff --check`: passed.

This change is local only; it has not been deployed or applied to a host or
running instance.

## Video captions in narrow lesson viewport — November 6, 2026

The local real-video E2E now uses a 320 CSS-pixel viewport for its learner
lesson flow, including video playback, caption metadata/cue availability, and
the transcript. It checks the captions track's language, label, and `kind`, and
confirms the transcript remains visible without horizontal overflow. The
transcript disclosure is also opened with Enter, closed with Space, and reopened
with Enter after checking keyboard focus and disclosure state. The playback-speed
select is changed with arrow keys and Enter, and the resulting video playback
rate is verified before it is restored. This is a desktop browser viewport
emulation, not physical-device or zoom qualification.

The lesson's playback failure message now uses a focusable assertive alert rather
than a polite status message. The E2E dispatches the player error event after
each locale rerender and verifies the translated message and focus in English,
Brazilian Portuguese, and Spanish. This checks local UI error handling; it does
not qualify actual network or device failure behavior.
The same flow dispatches waiting/can-play events for each locale, checks the
localized loading message in a polite live region, and verifies that the status
clears when playback can resume.
The author's draft-preview player now presents its failure in the same alert
pattern, and the real-video preview flow verifies the alert receives focus.

Validation:
- `VIDEO_TEST_REAL=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome E2E_PORT=4422 npm run test:e2e -- tests/e2e/video.spec.ts --browser=chromium --grep "author uploads a real video"`: 1/1 passed.
- `npm run lint`: passed.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

No deployment, host or running-instance changes were performed.

## Certificate history retry and focus recovery — November 6, 2026

The administrator certificate-history disclosure now exposes its content as a
polite live region with an explicit busy state while loading. A failed request
renders a focused alert and a keyboard-operable retry control; successful retry
restores focus to the disclosure summary. The focused browser test exercises a
simulated first-request failure followed by a successful retry, including
announcement semantics and focus recovery.

Validation:
- `E2E_PORT=4423 npm run test:e2e -- tests/e2e/admin-certificates.spec.ts`: 1/1 passed.
- `npm run lint`: passed.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

This is local browser automation only; no deployment, host, or running-instance
changes were performed.

## SQLite video-upload chunk integrity

Migration 183 rejects direct SQL inserts that pre-seed a video upload's byte
cursor. New uploads must start at zero; migration 181's contiguous chunk checks
then provide the only path to a completed cursor. Migration 184 additionally
requires exact full-size chunk coverage when an upload is queued or enters
processing. This also rejects legacy rows with a forged complete cursor but no
chunks before they can be requeued or claimed by a worker. Existing API creation
and resumable upload behavior already follow this sequence. Test fixtures that
represent completed media insert persisted chunks before moving through the
lifecycle; a legacy-row fixture explicitly verifies that both transitions fail
without chunks.

Validation:
- Focused upload, media, lifecycle, and related migration tests: 25/25 passed.
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- `npm test -- --maxWorkers=2`: 304 passed, 12 failed, 3 skipped. The same
  failures remain in five API/payment test files (`profile is not defined`,
  `published course locale mismatch`, and invalid user locale); all other tests,
  including the upload/media coverage, passed.
- `git diff --check`: passed.

This is a local schema and test change only. Firefox/WebKit, physical devices,
the host, and a deployed instance are not qualified; no deployment, host, or
running-instance changes were performed.

## Enrollment completion requirements integrity

Migration 185 makes new enrollments start incomplete and rejects setting
`completed_at` until the enrollment is active, not withdrawn, has a currently
valid entitlement, has at least one captured required lesson and has completed
all captured required lessons and passed all captured quizzes. This mirrors the
completion service's rules at the SQLite boundary. Existing completion history
is preserved; the new checks apply to future inserts and completion transitions.
Migration 186 additionally rejects completion when either captured requirements
snapshot contains blank, non-text, or duplicate IDs, keeping the SQLite check
consistent with the service's count-based completion evaluation.
Migration 187 also requires both snapshots to exactly match the mandatory lessons
and quizzes in the enrollment's immutable revision, preventing a forged snapshot
from omitting requirements or substituting an optional lesson.
Migration 188 applies the same checks to new enrollment inserts, including
non-text/blank and duplicate IDs, so callers cannot bypass the completion guard
by supplying a forged snapshot when creating the row.
Migration 189 prevents deletion of a lesson-progress row after it records
completion, matching the existing immutable-update rule for progress and the
retained history rule for submitted assessment attempts.
Migration 190 prevents deleting enrollment records, including rows that have
not yet accumulated dependent progress or entitlement records. Payment settlement,
reconciliation, and webhook recovery tests now simulate revoked access and
reactivation without deleting historical enrollment or entitlement rows.
Migration 191 prevents deleting entitlement grants, preserving both active and
revoked access records; revocation and replacement grants remain the supported
history-preserving lifecycle.
Migration 192 prevents deleting provider payment and refund rows, preserving
provider-reference deduplication and the refund-total accounting basis.
Migration 193 prevents deleting orders even when no entitlement or provider
payment/refund references exist, preserving idempotency and checkout history.
Migration 194 prevents deleting webhook event rows, preserving replay
deduplication and the ability to detect event-ID reuse with different content.
Migration 195 rejects lesson-progress writes when an enrollment is revoked,
lacks a currently valid entitlement (including revoked, not-yet-started, or
expired grants), or its course is withdrawn, matching the learner-facing
progress route's policy.
Migration 196 applies the same access conditions to assessment attempt creation,
answer changes/deletion, and submission, preventing direct SQL from starting,
changing, removing, or completing quiz work after entitlement loss.
Migration 197 makes assessment attempt IDs, enrollment/quiz/revision assignment,
and randomization seeds immutable, preserving the identity and ownership of open
attempt history before submission.
Migration 198 requires newly created attempts to start open, rejects malformed or
future start timestamps, and requires submissions to have a valid timestamp
between attempt start and current time.
Migration 199 checks selected answer keys against quiz choices/correct answers,
per-answer awarded points against correctness, and aggregate score/pass status
against the quiz threshold when an attempt is submitted. Omitted answers remain
incorrect, matching the API scoring behavior.
Migration 200 validates each answer selection at insertion/update time as a JSON
array of unique string keys present in that question's choices; an empty array
remains valid for unanswered questions.
Migration 201 replaces the legacy 0–100 attempt score ceiling with the quiz's
actual possible point total, matching the API's raw-points score while keeping
pass/fail calculation percentage-based.
Migration 202 validates question choices and correct keys as bounded JSON arrays
of unique, correctly shaped choices; correct keys must be unique strings present
in the choice list. Empty arrays remain permitted for legacy/incomplete draft
fixtures; API validation and publication readiness continue to enforce the
minimum required question content.
Migration 203 enforces the API's 100-question maximum for direct SQLite inserts
and reassignments, while allowing a quiz to reach exactly 100 questions.
Migration 204 rejects blank/whitespace question prompts and prompts or
explanations longer than 5,000 SQLite characters on insert/update.
Migration 205 limits awarded points on each answer row to zero (ungraded/open
answer) or the question's full point value, matching API scoring behavior.
Migration 206 aligns the direct-SQL assessment text limits with the API's
JavaScript UTF-16 code-unit counting and Unicode trimming for prompts,
explanations, choice keys/text, and correct keys. This also counts text after
embedded NUL characters instead of allowing SQLite's text-length behavior to
hide a suffix. SQLite insert/update tests exercise supplementary-plane
characters at and beyond limits, Unicode-only whitespace, and both write paths.

## Assessment text limits — November 10, 2026

Local validation for migration 206:

- The focused assessment integrity and eight migration-version tests passed
  (9/9), covering insert/update limits, exact UTF-16 boundaries, Unicode
  whitespace, and text after embedded NUL.
- `npm test -- --maxWorkers=2`: 316 passed, 3 skipped across 113 files.
- `npm run build`, `npm run lint`, and `git diff --check` passed.

No production migration, deployment, host change, or external qualification was
performed.

## Attachment scan retry recovery — November 10, 2026

Local worker validation now simulates ClamAV failure, confirms the attachment
remains FAILED without a published output, re-queues the job, then retries it
with a clean scanner and verifies that it reaches READY. This exercises the
worker's recoverable processing path, not the HTTP retry endpoint; the MEDIA-02
host scanner/signature qualification remains pending.

Earlier focused validation:
- Database integrity and publication tests: 104/104 passed, including duplicate lesson and
  quiz snapshot rejection, omitted required lesson/quiz rejection, and optional
  lesson substitution rejection on both insert and completion.
- Focused completion, certificate eligibility, certificate lifecycle, payment,
  webhook, and PDF generation tests: 8/8 passed. The previously failing API app
  and payment reconciliation/settlement tests also pass (69/69).
- `npm run build`, `npm run lint`, and `git diff --check`: passed.
- Latest full suite: 316 passed, 0 failed, 3 skipped across 113 test files,
  including migration 188 and updated fixture snapshots.
  Corrected stale test fixtures to define the instructor profile input and align
  published course locale/access mode with each revision.

Validation for migrations 189–205:
- Focused enrollment completion integrity test: 1/1 passed. It verifies deletion
  of completed progress is rejected and deletion of incomplete progress remains
  allowed.
- Focused payment settlement, reconciliation, webhook, and migration-version
  tests: 11/11 passed. They verify enrollment and entitlement deletion are rejected
  and paid access recovery reactivates retained enrollment history with a new
  active entitlement.
- Focused provider-payment/refund integrity test verifies payment/refund row
  deletion is rejected after enforcing provider-reference uniqueness and refund
  limits.
- Focused order-entitlement integrity test verifies deletion is rejected both for
  referenced orders and for an order without dependent financial/access records.
- Focused webhook identity/lifecycle tests verify deletion is rejected while
  retries and status transitions remain supported.
- Focused lesson-progress integrity test verifies writes are rejected after
  enrollment revocation and entitlement revocation while normal
  active-enrollment progress remains valid. Progress integrity plus HTTP workflow
  tests passed 64/64.
- Focused assessment, completion, enrollment-completion, and API workflow tests:
  65/65 passed after migrations 200–202.
- After migration 204, focused assessment, completion, enrollment-completion,
  publication, API, and migration-version tests passed 75/75 across 13 files.
- After migration 205, focused assessment/API and migration-version tests passed
  71/71 across 10 files.
- Focused assessment-attempt integrity test verifies starting attempts, changing
  answers, and submitting are blocked after entitlement revocation.
- The same test rejects direct-SQL changes to an attempt ID, enrollment, quiz,
  revision, or seed while preserving all normal assessment flows.
- It also rejects inserting already-submitted attempts and malformed/future start
  or submission timestamps while preserving valid submissions.
- It rejects forged scores, pass flags, and awarded points that disagree with
  selected answers, while retaining normal quiz submission behavior.
- Selection tests reject malformed/non-array JSON, non-string or unknown keys,
  and duplicates at the SQLite boundary while allowing empty selections.
- Question-definition tests reject malformed/non-array choice and answer-key JSON,
  invalid choice objects, duplicate choice/correct keys, and correct keys absent
  from the available choices on both insert and update.
- Question-count tests allow exactly 100 questions and reject the 101st insert or
  reassignment of another question into a full quiz.
- Question-text tests reject blank prompts and over-limit prompts/explanations on
  insert/update while allowing empty or valid bounded explanations.
- Answer-point tests reject partial awarded points while retaining the API's
  zero-before-submission and full-credit submission states.
- The assessment integrity fixture submits a correct answer worth 101 points,
  exercising totals above the legacy ceiling.
- Full suite after migration 205: 316 passed, 0 failed, 3 skipped across 113
  test files (111 test files passed; 2 skipped).
- `npm run build`, `npm run lint`, and `git diff --check` passed after migration 205.
- After migrations 190–192, the full serial suite again passed: 316 passed,
  0 failed, 3 skipped across 113 test files.
- After migrations 190–193, the full serial suite again passed: 316 passed,
  0 failed, 3 skipped across 113 test files.
- After migrations 190–194, the full serial suite passed: 316 passed,
  0 failed, 3 skipped across 113 test files.
- After migrations 190–195, the full serial suite passed: 316 passed,
  0 failed, 3 skipped across 113 test files; rerun after tightening entitlement
  checks also passed with the same counts.
This is a local schema and test change only. No deployment, host, or
running-instance changes were performed. Firefox/WebKit and physical-device
qualification remain external and pending. Migrations 190–195 preserve enrollment,
entitlement, order, and payment history until a retention workflow is defined;
they do not resolve the open privacy/legal policy or implement account
deletion/anonymization.

## HLS initialization and Firefox video follow-up — November 8, 2026

The course page now registers the enrollment action before awaiting asynchronous
HLS-player initialization, so the visible enrollment button is actionable while
player setup is pending. Player cleanup results are also generation-checked:
if navigation supersedes a pending setup, its eventual cleanup runs rather than
replacing the current page's cleanup state.

Validation:
- `npm run build`: passed across all workspaces.
- `npm run lint`: passed.
- Focused real-video workflow in Chromium: 2/2 passed.
- Focused real-video workflow in Firefox with trace enabled: 1/1 passed.
- Focused real-video workflow in Firefox, rerun sequentially: 1/1 passed.
- `tests/e2e/video.spec.ts` in WebKit: 2/2 passed.
- `git diff --check`: passed before this documentation update.

A Firefox `--repeat-each=3` attempt is not treated as qualification: the first
run timed out at viewport resizing while the Firefox and WebKit browser suites
were competing for local resources; the next two reused the test's published
course slug on the same E2E server and failed on the resulting duplicate state.
The workflow now generates a unique course slug and learner email per attempt,
eliminating both sources of repeat contamination. A subsequent sequential
Firefox `--repeat-each=3` run passed twice and timed out once while waiting for
the enrollment request; its snapshot showed the course and enrollment button,
but no completed enrollment response was captured in the trace. The cause
remains unconfirmed and no timeout was increased.

Validation:
- `VIDEO_TEST_REAL=1 E2E_PORT=4471 npm run test:e2e -- --browser=firefox tests/e2e/video.spec.ts --grep "author uploads a real video" --repeat-each=3`: 2/3 passed; one enrollment-response timeout.
- Isolated real-video workflow in Firefox on port 4472: 1/1 passed.
- Isolated real-video workflow in Chromium on port 4473: 1/1 passed.
- Isolated real-video workflow in WebKit on port 4474: 1/1 passed.

Unique fixtures make repeated runs independent but do not resolve or qualify the
Firefox intermittency. Firefox full-suite qualification, physical-device
testing, and deployed-host qualification remain open. No deployment, host, or
running-instance changes were performed.

## Firefox enrollment trace and HLS CSP experiment — November 8, 2026

A further isolated Firefox `--repeat-each=3 --trace=on` run passed 2/3. In the
failed attempt the recorded Playwright click action completed, but the trace
contained no completed enrollment response; the page snapshot still showed the
course and enrollment button. The browser console also reported that the current
Content Security Policy blocks the blob worker created by HLS.js.

A local experiment adding `worker-src 'self' blob:` allowed worker creation but
caused all three repeated real-video runs to fail at trailer playback: HLS
fallback detached the media source while `play()` was in progress. The policy
change and its temporary header test were reverted. With the original policy
restored, the workspace build passed and the focused Firefox real-video workflow
passed (1/1). A full `apps/api/src/app.test.ts` run during the experiment had
61 passing and two unrelated failures (`profile is not defined` and
`published course locale mismatch`); the temporary CSP-specific test itself
passed.

No timeout or CSP relaxation remains from this experiment. The enrollment
intermittency is unresolved; Firefox full-suite, physical-device, and
deployed-host qualification remain open. No deployment, host, or running-instance
changes were performed.

## Administrative list retry cross-browser checks — November 7, 2026

The focused keyboard failure/retry workflows for the user, order, certificate,
enrollment, and media lists passed in both Firefox and WebKit. Each test injects
a temporary list-request failure, verifies its alert and keyboard retry, holds
the retry response while checking `aria-busy`, then confirms recovery to the
empty state. This supplements their focused local Chromium coverage.

Validation:
- `E2E_PORT=4438 npm run test:e2e -- tests/e2e/admin-users.spec.ts tests/e2e/admin-orders.spec.ts tests/e2e/admin-certificates.spec.ts tests/e2e/admin-enrollments.spec.ts tests/e2e/admin-media.spec.ts --browser=firefox --grep "announces load failures"`: 5/5 passed.
- `E2E_PORT=4439 npm run test:e2e -- tests/e2e/admin-users.spec.ts tests/e2e/admin-orders.spec.ts tests/e2e/admin-certificates.spec.ts tests/e2e/admin-enrollments.spec.ts tests/e2e/admin-media.spec.ts --browser=webkit --grep "announces load failures"`: 5/5 passed.

This is focused local browser automation, not full-suite, physical-device,
host, or deployed-instance qualification. No deployment, host, or
running-instance changes were performed.

## Administrative E2E regression batch — November 7, 2026

The complete focused administrative E2E set passed in all three local browser
engines: privacy requests, user/author management, orders/refunds, certificate
revocation/reissue, enrollment grants/revocation, media library, and operations.
The batch includes 13 workflows per engine and rechecks the established admin
journeys alongside the newer accessibility retry coverage.

Validation:
- `E2E_PORT=4442 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts tests/e2e/admin-users.spec.ts tests/e2e/admin-orders.spec.ts tests/e2e/admin-certificates.spec.ts tests/e2e/admin-enrollments.spec.ts tests/e2e/admin-media.spec.ts tests/e2e/admin-operations.spec.ts --browser=chromium`: 13/13 passed.
- `E2E_PORT=4440 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts tests/e2e/admin-users.spec.ts tests/e2e/admin-orders.spec.ts tests/e2e/admin-certificates.spec.ts tests/e2e/admin-enrollments.spec.ts tests/e2e/admin-media.spec.ts tests/e2e/admin-operations.spec.ts --browser=firefox`: 13/13 passed.
- `E2E_PORT=4441 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts tests/e2e/admin-users.spec.ts tests/e2e/admin-orders.spec.ts tests/e2e/admin-certificates.spec.ts tests/e2e/admin-enrollments.spec.ts tests/e2e/admin-media.spec.ts tests/e2e/admin-operations.spec.ts --browser=webkit`: 13/13 passed.

This is a focused local administrative regression, not full-suite,
physical-device, host, or deployed-instance qualification. No deployment, host,
or running-instance changes were performed.

## Privacy-request list announcements and retry focus — November 6, 2026

The administrator privacy-request list now announces updates through a polite
live region, while its count is also a polite status. On list-load failure,
focus moves to the alert; keyboard Tab reaches retry, and a successful search
retry restores focus to the result summary. The existing privacy workflow checks
these behaviors while retaining the unsaved review note.

Validation:
- `E2E_PORT=4433 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts`: 1/1 passed.
- `npm run lint`: passed.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

This qualifies only local browser automation, not the complete accessibility
audit, Firefox/WebKit suite, physical devices, host, or deployed instance. No
deployment, host, or running-instance changes were performed.

## Privacy-history repeated-failure focus and retry recovery — November 7, 2026

Failed privacy-request history loads now move focus to the alert, including
when the first retry also fails. The Chromium workflow verifies the alert
retains focus after that repeated failure, then holds the next keyboard retry
to check the busy state. Successful recovery clears loading, restores focus to
the disclosure summary, and keeps private notes limited to the administrator's
history.

Validation:
- `E2E_PORT=4435 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts`: 1/1 passed.
- `E2E_PORT=4436 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts --browser=firefox`: 1/1 passed.
- `E2E_PORT=4437 npm run test:e2e -- tests/e2e/admin-privacy.spec.ts --browser=webkit`: 1/1 passed.
- `npm run lint`: passed.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

These are focused local browser workflows, not full-suite or physical-device
qualification. No deployment, host, or running-instance changes were performed.

## Administrator enrollment-list retry and announcements — November 6, 2026

The administrator enrollment list now announces updates through a polite live
region and moves focus to a load-failure alert. A focused Chromium E2E simulates
a temporary API failure, verifies the focused alert and keyboard-operable retry,
holds the retry response to assert `aria-busy="true"`, then verifies the empty
state, cleared alert, and zero-enrollment count after recovery.

Validation:
- `E2E_PORT=4432 npm run test:e2e -- tests/e2e/admin-enrollments.spec.ts --grep "enrollment list announces"`: 1/1 passed.
- `E2E_PORT=4432 npm run test:e2e -- tests/e2e/admin-enrollments.spec.ts`: 2/2 passed, including the existing grant/revoke/history workflow.
- `npm run lint`: passed.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

This qualifies only the focused local Chromium workflow, not Firefox/WebKit,
physical devices, the host, or a deployed instance. No deployment, host, or
running-instance changes were performed.

## E2E suite navigation follow-up — November 8, 2026

The previous full WebKit run passed 15/44. Its MFA workflow attempted a new
login before the asynchronous sign-out redirect completed; the interrupted
workflow left MFA enabled in the shared test database and caused later admin
logins in that run to fail. The MFA test now waits for the redirect to `/`
before starting the next login. Its focused workflow passed in Chromium,
Firefox, and WebKit (1/1 each).

Validation:
- Full WebKit real-media E2E after the test synchronization change: 39/44 on
  isolated port 4449.
- The five remaining checkout, quiz-attempt, quiz-builder, and video workflows
  failed while looking for the administrator link in the complete run; they
  passed together in an isolated WebKit invocation (5/5, port 4450).
- Full real-media Chromium rerun recorded earlier: 39/44; its five checkout,
  quiz-attempt, quiz-builder, and video failures also passed together in isolation
  (5/5).
- Full real-media Firefox rerun recorded earlier: 38/44; its six failed workflows
  passed together in isolation (6/6).
- `git diff --check`: passed.

The WebKit MFA cascade is explained by the test's logout/login race. The remaining
full-suite failures are still unexplained and do not establish full-suite
qualification. These are local automated results only; physical-device, deployed
host, and external qualification remain pending. No application behavior,
deployment, host, or running instance was changed.

## Shared account locale in browser suites — November 8, 2026

Playwright traces from the remaining WebKit failures showed successful admin
authentication and `/auth/me` returning `locale: "es"`. The preceding mobile
viewport workflow changed the shared seeded admin account's saved locale through
English, Portuguese, and Spanish, but did not restore it. Later workflows expected
English accessible names, so they could not find the correctly localized
administrator link. The mobile workflow now selects English at the end and waits
for the English Operations heading, which also verifies the locale update completed.

Validation:
- `VIDEO_TEST_REAL=1 E2E_PORT=4454 npm run test:e2e -- --browser=webkit`: 44/44.
- `VIDEO_TEST_REAL=1 E2E_PORT=4455 npm run test:e2e -- --browser=chromium`: 44/44.
- `VIDEO_TEST_REAL=1 E2E_PORT=4456 npm run test:e2e -- --browser=firefox`: 42/44.
  The authoring publication-checklist workflow timed out waiting for the login
  page load but passed in a focused rerun (1/1). The real-video workflow timed
  out waiting for enrollment in the full run; in a focused two-test rerun the
  authoring workflow passed, but real video timed out later at viewport resizing.
  Do not count the focused result as a Firefox full-suite pass.
- The focused WebKit trace run also reproduced the former locale-dependent
  failures; its network trace confirmed login HTTP 200 and the Spanish admin
  locale.
- `npm run lint` and `git diff --check`: passed.

The locale-related Chromium/WebKit failures are resolved locally. Firefox remains
unqualified at full-suite level because its media/navigation instability has not
been corrected. These results do not qualify physical devices or the deployed
host. No production or host changes were made.

## Administrator certificate-list retry and announcements — November 6, 2026

The administrator certificate list now announces updates through a polite live
region and moves focus to a load-failure alert. A focused Chromium E2E simulates
a temporary API failure, verifies the focused alert and keyboard-operable retry,
holds the retry response to assert `aria-busy="true"`, then verifies the empty
state, cleared alert, and zero-certificate count after recovery.

Validation:
- `E2E_PORT=4431 npm run test:e2e -- tests/e2e/admin-certificates.spec.ts --grep "certificate list announces"`: 1/1 passed.
- `E2E_PORT=4431 npm run test:e2e -- tests/e2e/admin-certificates.spec.ts`: 2/2 passed, including the existing revoke/reissue/history workflow.
- `npm run lint`: passed.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

This qualifies only the focused local Chromium workflow, not Firefox/WebKit,
physical devices, the host, or a deployed instance. No deployment, host, or
running-instance changes were performed.

## Administrator user-list retry and announcements — November 6, 2026

The administrator user list now announces updates through a polite live region
and moves focus to a load-failure alert. A focused Chromium E2E simulates a
temporary API failure, verifies the focused alert and keyboard-operable retry,
holds the retry response to assert `aria-busy="true"`, then verifies the empty
state, cleared alert, and zero-user count after recovery.

Validation:
- `E2E_PORT=4428 npm run test:e2e -- tests/e2e/admin-users.spec.ts --grep "user list announces"`: 1/1 passed.
- `npm run lint`: passed.

This qualifies only the focused local Chromium workflow, not Firefox/WebKit,
physical devices, the host, or a deployed instance. No deployment, host, or
running-instance changes were performed.

## Administrator order-list retry and announcements — November 6, 2026

The administrator order list now announces updates through a polite live region
and moves focus to a load-failure alert. A focused Chromium E2E simulates a
temporary API failure, verifies the focused alert and keyboard-operable retry,
holds the retry response to assert `aria-busy="true"`, then verifies the empty
state, cleared alert, and zero-order count after recovery.

Validation:
- `E2E_PORT=4430 npm run test:e2e -- tests/e2e/admin-orders.spec.ts --grep "order list announces"`: 1/1 passed.
- `E2E_PORT=4430 npm run test:e2e -- tests/e2e/admin-orders.spec.ts`: 2/2 passed, including the existing refund/access workflow.
- `npm run lint`: passed.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

This qualifies only the focused local Chromium workflow, not Firefox/WebKit,
physical devices, the host, or a deployed instance. No deployment, host, or
running-instance changes were performed.

## Media library retry and loading accessibility — November 6, 2026

The admin media list is now a polite live region. Failed loads focus an alert
with a keyboard-operable retry, and the E2E holds the retry response to verify
`aria-busy` remains true until the successful empty result arrives. It then
checks the empty state, cleared alert and busy state, and updated count.

Validation:
- `E2E_PORT=4427 npm run test:e2e -- tests/e2e/admin-media.spec.ts`: 1/1 passed.
- `npm run lint`: passed.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

This is local browser automation only; no deployment, host, or running-instance
changes were performed.

## Enrollment history retry and focus recovery — November 6, 2026

The administrator enrollment-history disclosure now exposes its content as a
polite live region and marks loading with an explicit busy state. A failed
request renders a focused alert and a keyboard-operable retry control; successful
retry restores focus to the history summary. The focused browser test simulates
a temporary first-request failure followed by a successful retry and verifies
the alert, live-region semantics, keyboard activation, and focus recovery. It
also holds the retry response to check that the history remains busy until the
results are available.

Validation:
- `E2E_PORT=4425 npm run test:e2e -- tests/e2e/admin-enrollments.spec.ts`: 1/1 passed.
- `npm run lint`: passed on rerun after the E2E result directory existed; the initial concurrent invocation exited before test startup because the directory was absent.
- `npm run build`: passed across all workspaces.
- `git diff --check`: passed.

This is local browser automation only; no deployment, host, or running-instance
changes were performed.
