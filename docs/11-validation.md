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

## Assessment attempt result integrity — October 4, 2026

Migration 056 rejects open attempts carrying a score/pass result and requires
submitted attempts to store an integer score percentage from 0 through 100 plus a
binary pass flag. The focused SQLite migration test exercises inconsistent open
state, out-of-range score, invalid pass flag, and a valid submitted result while
retaining the existing deadline and immutability assertions. No application route
behavior changed; this closes a direct-SQL invariant gap under DATA-01. No production
migration or deployment was performed.

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
