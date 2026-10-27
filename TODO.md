# TODO — Maia Learn as a complete video course platform

Audit: September 27, 2026. This is the implementation backlog for the complete
product, requested after the prototype was published. The preceding delivery was
a foundation for text courses; it did not yet meet the video course objective.

## First implementation — September 27, 2026

Delivered in the local checkout, not yet deployed: separate public and draft
revisions, Markdown editor with sanitized preview, local recovery, autosave for
existing courses, conflict detection across tabs, duplication/reordering with
buttons, and editorial homepage selection. New components support English,
Portuguese, and Spanish. Guide: [authoring and homepage](docs/12-authoring.md).

- Completed: BASE-01, EDIT-01, and HOME-01 (fixed hero, featured, and recommended sections).
- BASE-02 partial: migration 004 preserves text, enrollments, and progress in a fixture;
  restoration of the real database, media, and translations remain pending.
- EDIT-02 partial: shared, tested parser and sanitization; persisted rendering
  policy versioning remains pending.
- EDIT-03/04 partial: modular editor, button-based ordering, and recovery implemented;
  per-lesson screens, dragging, and incremental saves per editing unit remain pending.
- I18N-01 partial: switching languages preserves the editor; legacy emails/API remain pending.
- Local validation: build, 38 automated tests, and 3 Chrome tests.

E1 still needs the additions above. At this stage, video upload, processing,
captions, and playback remained in E2; the complete platform was not finished.

## First video implementation — September 28, 2026

MP4 workflow delivered in the local checkout: private storage, resumable and
verified chunk uploads, lesson association, separate queue, FFprobe/FFmpeg, poster,
publication validation, and player with Range/HEAD and position resumption. Installation
updated for FFmpeg and worker limits. Validation: build/lint, 41 automated tests,
four Chrome workflows, and three deployment tests. Not deployed.
[Video guide](docs/13-video.md).

MEDIA-01/02/03/04, JOB-01, PLAY-01/02/04, EDIT-05, and OPS-01 advanced but remain
open. At this stage, remaining work included HLS, captions, the complete library,
automatic orphan/expiration cleanup, transcoding progress, learner navigation,
and validation on Maia Edge/devices. E2 and the complete platform remain in progress.

## Supplementary materials — September 28, 2026

MEDIA-05 implemented: multiple course or lesson attachments, titles, descriptions,
ordering, replacement/removal per revision, and authorized downloads. PDF/ZIP and
source code use resumable uploads and signature/encoding validation in the worker.
Antimalware and orphan collection remain in MEDIA-02/04; they are not features of
this delivery. [Materials guide](docs/14-materials.md). Not yet deployed.

## Captions and transcripts — September 28, 2026

PLAY-03 implemented: WebVTT import/editing in en/pt-BR/es, player selection,
per-track transcripts, replacement/removal per revision, and authorized delivery.
Supports the plain-text subset documented in the [guide](docs/15-captions.md);
CSS, positioning, SRT, and automatic generation are outside this delivery.
Locally validated with real video and Chrome; no deployment performed.

## Versioned content rendering — September 28, 2026

EDIT-02 completed locally: migration 008 persists the rendering policy per lesson,
preserving existing plain/Markdown content. New revisions and previews use the
server-selected current policy; lesson delivery uses the stored policy. Unknown
policies fail closed. Migration, API parity, multilingual content, and hostile
markup are covered by automated tests. See [authoring](docs/12-authoring.md).
Not deployed; other E1 tasks remain open.

## Focused studio and drag ordering — September 29, 2026

EDIT-03 advanced locally: an optional course/module/lesson outline switches between
editing sections without unmounting inputs or media components. The selected section
survives language changes; invalid fields reveal their section before native form
validation. Modules and lessons can be dragged within their existing parent, with
Move up/Move down retained for keyboard and touch users. Ordering uses the existing
revision, autosave, and recovery flows. Cross-module lesson dragging is not supported.

EDIT-03 remains open: a complete learner/visitor preview of the draft is still pending.
EDIT-04 also remains open: saves still create a whole-course revision, not incremental
updates per editing unit. No deployment performed. See [authoring](docs/12-authoring.md).

## Draft audience preview — September 29, 2026

EDIT-03 completed locally: **Preview draft** saves the current draft and opens an
author-only learner/visitor simulation with sanitized content, ready video, captions,
transcripts, and attachment downloads. Visitor mode hides restricted lesson content;
open courses and explicitly previewable lessons remain visible. Only the owner or
an administrator can request this preview, and stale revision requests are rejected.
It never publishes, enrolls, or records progress. Media uses existing author access;
this is not a shareable visitor session or a substitute for authorization tests.
EDIT-04 incremental per-unit saving remains pending. No deployment performed.

## Incremental editing-unit saves — September 29, 2026

EDIT-04 completed locally: existing drafts send only changed course metadata,
module titles, or lessons through an atomic PATCH with the expected revision.
Structural additions/removals and legacy recovered drafts without a saved baseline
use PUT; new courses use POST. SQLite still stores a complete immutable revision,
so this reduces request payloads, not revision storage. The editor preserves its
saved baseline with local recovery, reports failed saves, supports explicit retry,
and retains edits made while a request is in flight. Stale revisions are rejected
rather than merged silently. Autosave still requires a valid course form.
No deployment performed. See [authoring](docs/12-authoring.md).

## Publication readiness checklist — September 29, 2026

EDIT-05 advanced locally: publication now reports all missing text/video,
non-ready or invalid media, and module/lesson ordering problems, with module,
lesson, and attachment titles. The author-only revision-bound preflight and the
transactional publish action share the same validator. Direct publish requests
cannot bypass checks, including cross-course media relationships. The studio
shows the full list in English, Portuguese, or Spanish. EDIT-05 remains open for
lesson duration presentation in the editor. No deployment performed.

## Video duration in the studio — September 29, 2026

EDIT-05 completed locally: the selected video's server-probed duration is displayed
in the editor once processing is READY, using m:ss or h:mm:ss. Missing/unfinished
duration is explicitly unavailable, not zero. Refresh, selection changes, and all
three interface languages are supported; attachment upload controls do not display
video duration. Combined with existing article/video/mixed derivation, required and
preview settings, attachments, and the publication checklist, this closes EDIT-05.
No deployment performed; HLS and other MEDIA/PLAY backlog items remain open.

## Private storage completion — September 29, 2026

MEDIA-01 completed locally: the provider contract now exposes streaming reads,
and the legacy buffered helper is capped at 8 MiB with pre-read and streaming
checks. Large objects must use openRead. Storage rejects traversal, absolute paths,
symlink components, and replacement of the initialized root with a symlink;
failed writes clean temporary files and existing objects remain immutable.
Tests transfer a 32 MiB object in bounded chunks and verify confinement across
read, stat, delete, and write operations. Existing HTTP tests cover author isolation.
The storage root and ancestors must remain controlled by the service/operator;
this is not isolation from a malicious process running as the service user.
No deployment performed. Upload lifecycle and orphan collection remain in MEDIA-02/04.

## Incomplete upload expiration — September 29, 2026

MEDIA-02 advanced locally: migration 009 records last upload activity, refreshed
on every committed chunk. The worker checks hourly and expires up to 50 UPLOADING
records inactive for seven days, only when no lesson or attachment in any revision
references them. Existing uploads receive a fresh window on migration. Expiration
sets CANCELLED/UPLOAD_EXPIRED before file deletion, releasing reserved quota and
preventing late chunk commits. Cleanup retries registered chunks of CANCELLED
uploads; failed deletions retain their records. READY, QUEUED, PROCESSING, FAILED,
and referenced uploads are not expired. No output or published media is deleted.
MEDIA-02 remains open for image uploads and attachment inspection/antimalware.
Unregistered orphan files and full lifecycle collection remain in MEDIA-04.
No deployment performed.

## Optional attachment malware scanning — September 29, 2026

MEDIA-02 advanced locally: ATTACHMENT_SCAN_MODE=clamav runs clamscan after format
validation and before publishing any attachment output. Detection/inspection-limit
alerts become FILE_MALWARE; scanner errors, missing executable, cancellation, and
timeouts become FILE_SCAN_FAILED. Both leave the attachment FAILED and unavailable.
Disabled remains the explicit default for existing installations. Scanner failures
are displayed in the editor in all three languages. Integration tests use a fake
scanner; real ClamAV/signature validation on the host or container is still pending.
MEDIA-02 remains open for image uploads and deployment validation of scanning.
No deployment or scanner installation performed.

## Recoverable full-disk upload failure — September 30, 2026

MEDIA-02 advanced locally: an `ENOSPC` while storing an upload chunk returns HTTP
507 with the stable `UPLOAD_STORAGE_FULL` code. The editor displays a recovery
message in English, Portuguese, and Spanish; the failed chunk does not advance the
server offset, so the author can free disk space and resume the same upload. A
successful retry clears the stale error notice. API and Chromium tests simulate the
storage error and verify a subsequent chunk succeeds at the unchanged offset.
MEDIA-02 remains open for its other stated criteria. No deployment performed.

## Image attachments — September 30, 2026

MEDIA-02 advanced locally: PNG/JPEG images can be uploaded as course/lesson
materials with titles and descriptions. The API caps images at 10 MiB; the worker
checks signatures, decodes with FFprobe/FFmpeg, limits dimensions to 8192 per side
and 16 megapixels, and re-encodes a single frame without source metadata before READY.
Normalized output also has a 10 MiB cap. Optional ClamAV inspection applies before
normalization. Downloads retain enrollment/revision authorization and attachment
headers. SVG and other image types remain unsupported. Lesson Markdown can now
insert uploaded PNG/JPEG materials through a same-origin inline endpoint bound to
revision, preview/enrollment, withdrawal, and owner access. MEDIA-02 remains open for
real scanner deployment validation and remaining upload inspection/quota qualification;
HOME-02 tracks course covers. No deployment performed.

## Revision-bound course covers — September 30, 2026

HOME-02/MEDIA-02 advanced locally: the studio uploads/selects a PNG/JPEG cover and
alternative text. Migration 010 stores both on each revision. Publication requires
a READY image belonging to the course and nonblank alt text. Catalog cards,
editorial homepage placements, course pages, and draft previews show the cover.
Draft edits preserve the published image; prior enrolled revisions retain their
image. Public cover delivery exposes only the current published revision, while
owner/admin and active enrolled access are checked for other revisions. Expiration
protects images referenced as covers. HOME-02 remains open for trailers, instructor
profiles, objectives, prerequisites, level, workload, and access/certificate terms.
Inline lesson images and real scanner deployment validation also remain pending.
No deployment performed.

## Course objectives and presentation — September 30, 2026

HOME-02 advanced locally: authors can edit learning objectives, prerequisites,
level, and estimated workload in minutes. Migration 011 adds prerequisites;
existing revision fields store the other values. Course pages and draft previews
show the saved presentation as plain text, with localized labels and levels.
Draft edits do not alter public metadata; lesson-only incremental saves retain
all presentation fields. HOME-02 remains open for trailers, instructor profiles,
and access/certificate terms. No deployment performed.

## Instructor and course terms — September 30, 2026

HOME-02 advanced locally: instructor display name/biography, access terms, and
certificate information can be edited per course revision. They appear as escaped
plain text on the course page and draft preview, survive incremental saves and
language switching, and do not modify published/enrolled revisions. These are
presentation fields, not account identity, enrollment policy, or certificate
issuance. Certificate information includes an explicit notice that the platform
does not yet issue certificates. Migration 012 adds empty defaults for existing
courses. HOME-02 remains open for trailers; account-level instructor management
remains in ADMIN-01. No deployment performed.

## Revision-bound course trailers — September 30, 2026

HOME-02 completed locally: authors upload/select a course trailer using the video
pipeline, and publication requires a READY video from the same course. Migration
013 stores the trailer reference per revision. Course pages and draft previews
include the trailer player and poster; published trailers are explicitly public
even for enrolled courses. Drafts remain author/admin-only, with historical access
for active enrollments assigned to the corresponding revision. Range/HEAD and
poster delivery reuse playback authorization. Changing a draft does not replace
the live trailer until publication. Course language is also shown in presentation.
Together with covers, objectives, prerequisites, level, workload, curriculum,
instructor text, and descriptive terms, this closes HOME-02. Certificates,
commerce, account profiles, HLS, and inline lesson images remain in their own tasks.
No deployment performed.

## Paginated catalog and filters — September 30, 2026

HOME-03 advanced locally: the catalog now displays 12 courses per page with totals,
previous/next links, title or newest sorting, and combinable language, level, and
access filters. Search/filter/page values live in shareable URLs; submitting a new
filter resets pagination, and browser back/reload preserves it. All queries use
published revision metadata and exclude drafts/archives. The API supports pages
beyond the old 100-course ceiling and retains the legacy array response unless
format=page is requested. Empty states and controls support all three languages.
HOME-03 remains open for manageable categories/taxonomy. No migration or deployment.

## Managed course categories — September 30, 2026

HOME-03 completed locally: administrators can create, rename and delete unused
categories; authors select up to ten categories per course revision. The public
catalog combines a category slug with existing filters and pagination, and course
pages link to the corresponding category search. Draft association changes remain
private until publication; historical revision references prevent category deletion.
The taxonomy is flat, with shared authored names/descriptions across interface
languages. Category metadata changes are immediate and use optimistic concurrency.
Migration 014 is required. No deployment performed.

## Localized account emails and authentication errors — September 30, 2026

I18N-01 advanced locally: browser registration saves the selected interface locale;
verification and recovery emails use the saved account locale (en, pt-BR or es,
with English fallback for other legacy locales). Authentication-route errors now
have stable codes translated by the interface. Switching interface language keeps
entered account-form fields in memory without storing passwords in browser storage.

Recovery still returns the same 204 response for known and unknown addresses; the
requester's locale cannot override the account's email language. I18N-01 remains
open for remaining API/email flows and broader translation coverage. I18N-02 still
needs translated course metadata and explicit fallback. Verification feedback/resend
and the remaining AUTH-01 workflows are not completed by this delivery.
No migration or deployment performed.

## Verification email resend — October 1, 2026

AUTH-01 advanced locally: the registration confirmation offers a translated
verification resend action. The API returns the same 204 for unknown, pending,
already verified, and suspended accounts; requests use the existing authentication
rate limit. Resend invalidates prior unused verification links, stores a hash for
the replacement token, and sends the email in the saved account locale. HTTP tests
cover non-enumeration, locale selection, and superseded tokens; Chromium tests the
generic confirmation in all three languages. AUTH-01 remains open for profile
management, MFA, and other account workflows. No deployment performed.

## Translation catalog completeness check — September 30, 2026
I18N-01 advanced locally: web unit tests compare the union of translation keys
across supported locales and check interpolation placeholder parity against English.
They fail when any locale is missing a key or changes a placeholder signature. The
initial audit found
`UPLOAD_STORAGE_FULL` absent from `pt-BR` and duplicated in the English catalog;
the English, Brazilian Portuguese, and Spanish messages are now assigned to their
respective catalogs. I18N-01 remains open for broader flow coverage, formatting,
and missing translation work outside this detected key. No deployment performed.

## Persisted interface-language preference — September 30, 2026

I18N-02 advanced locally: authenticated users can update their account interface
language through `PUT /auth/locale`, restricted to `en`, `pt-BR`, and `es`. A new
session applies the saved account preference before browser detection/local storage;
anonymous visitors retain browser-local selection. API tests verify all supported
values, invalid-locale rejection, and authentication. Chromium coverage changes
languages while signed in, then opens a fresh isolated browser context with English
browser settings and confirms the account's Spanish preference is restored. I18N-02
remains open for authored course metadata translations, caption-locale authoring,
and explicit metadata fallback. No migration or deployment performed.

## Email verification confirmation — September 30, 2026

AUTH-01 and I18N-01 advanced locally: newly queued verification emails open a
localized confirmation page rather than a JSON response. Merely opening the page
does not consume its token. Explicit POST confirmation provides pending, success,
invalid, expired, already-used and retry states; switching interface language keeps
the result without resubmitting. Legacy GET email links remain compatible. Token
validation, consumption and account verification are atomic, including competing
requests. Verification resend is now available after registration, always returns
the same response across account states, uses saved account locale, replaces old
verification tokens, and has translated UI confirmation. AUTH-01 remains open for
profile management, MFA and the remaining account workflows.
No migration or deployment performed.

## Persisted interface language preference — September 30, 2026
I18N-02 advanced locally: authenticated users can save `en`, `pt-BR`, or `es` as
their interface preference through `PUT /auth/locale`. A new login applies the
account locale ahead of the browser's detected or locally stored locale; anonymous
language selection remains browser-local. API validation rejects unsupported
values, and Chromium coverage verifies all three preferences plus restoration in
an isolated browser context. I18N-02 remains open for author-selected caption
locales and translated course metadata/fallback. Recovery emails also use the
current saved account locale even when the recovery request supplies a different
locale. No migration or deployment performed.

## Learner lesson navigation — September 30, 2026

PLAY-04 advanced locally: authorized lesson responses now include an ordered
module outline and previous/next links. Visitors see only public or preview lessons;
active learners see lessons in their assigned revision, and owners/admins can
inspect their authorized draft. API tests verify order and ensure restricted lesson
titles do not leak through preview navigation. The outline labels are translated in
English, Portuguese, and Spanish. The learning dashboard links to the most recently
active unfinished lesson, otherwise the first unfinished lesson; when all lessons
are complete, it links to the latest lesson with activity. Revoked courses have no
continuation action. Position saves remain throttled to the existing 15-second
interval; a pause during an in-flight save now queues the final position instead
of dropping it. Unit tests cover this race, the throttle, and visitor write denial.
Real-video Chromium coverage now enrolls a learner, holds the first progress request,
pauses at a later position, verifies the trailing API save, reloads the lesson, and
checks that playback resumes from the saved point. It then ends the learner session,
checks that playback resumes from the saved point. A second Playwright browser
context with an isolated cookie jar signs in as the same learner and verifies that
the same lesson resumes there. PLAY-04 remains open for independent browser-engine/
device qualification and real-device/media testing. No migration or deployment
performed.

## Evidence and limitations of the original review

Reviewed the API, interface, internationalization, SQLite schema, worker, adapters,
tests, installation, and documents 01–11. The public page at
`https://learn.maiaplatform.org/` responded to an HTTP request and includes the
language selector and modular script. The authenticated dashboard, credentials,
private data, and remote VPS configuration were not accessed. Internal details
below are observations from the local checkout, which may differ from the published
release. This audit made no functional changes or deployments; previous tests do
not demonstrate pending features.

Audit status, before the first implementation above:

| Area | Existing capabilities | Missing capabilities / evidence |
|---|---|---|
| Identity | Registration, login, SQLite sessions, recovery/verification, admin bootstrap | User administration, verification resend, profile, MFA; admin creation still needs a real installation test |
| Identity | Registration, login, SQLite sessions, recovery/verification resend, admin bootstrap | User administration, profile, MFA; admin creation still needs a real installation test |
| Languages | `en`, `pt-BR`, `es`, selector, detection, and local persistence | API errors/emails, account preference, formatting, tests, and form protection when switching languages; [i18n.js](apps/web/public/i18n.js) |
| Authoring | Form for title, summary, modules, and lessons | Text `textarea` only; no media, Markdown, cover, assisted reordering, or autosave; [app.js](apps/web/public/app.js) |
| Content | `body` displayed with HTML escaping | No Markdown rendering; `lessonSchema` requires text and does not accept `kind`/`mediaId`; [courses.ts](apps/api/src/routes/courses.ts) |
| Publication | Create revision, publish, archive, enrollment pinned to revision | Editing changes the course to DRAFT and replaces `current_revision_id`, removing the published version from the catalog |
| Videos | `media_id`, `kind` columns and `assets` table | No upload, inspection, transcoding, captions, player, or authorized delivery |
| Worker | Persistent outbox, leases, and email retries | Rejects events other than `email.send`; [jobs.ts](apps/worker/src/jobs.ts) |
| Storage | Local adapter still disconnected from routes | Reads entire files into a Buffer; path resolution does not guarantee confinement to the root; [local.ts](packages/providers/src/storage/local.ts) |
| Homepage | Fixed hero and the same listing as `/courses` | No editorial selection, ordering, or sections; `promotions` table has no API/interface |
| Learning | Free enrollment, manual completion, dashboard counts | No video resumption, lesson navigation, completion policy, or assessments |
| Commerce | Tables and fake/Mercado Pago adapters | API accepts only OPEN_FREE/ENROLLED_FREE; no operational orders/checkout/webhooks/reconciliation |
| Certificates | Table and written requirements | No eligibility, issuance, PDF, QR, verification, or revocation |
| Operations | systemd, SQLite, backup, Nginx, and installers | Large videos, processing, media backup, monitoring, and prototype upgrades require dedicated validation |

## Priorities and completion rule

- **P0:** make publishing and taking a real video course viable, with an editor and curated homepage.
- **P1:** complete management, assessment, commerce, certificates, and operations for the specified product. This is part of the full delivery, not excluded because it follows P0.
- **P2:** extensions planned after the core product, explicitly separated at the end.

Each unchecked box represents pending work. Mark complete only when UI + API +
database + permissions + failure handling + relevant tests + documentation are
delivered. A SQL table, isolated adapter, mock, or button without a real workflow
does not satisfy a task. Preserve local internationalization changes and prototype data.

## P0 — editing and publication foundation

- [x] **BASE-01 — Separate drafts from the published version.**
  Introduce separate references for working and public revisions; update the catalog,
  details, authorization, and enrollment to select the correct revision.
  Dependencies: none. Acceptance: saving a draft keeps the course live; visitors see
  the previous publication, authors see the draft, and existing learners retain
  their revision. Publication switches the public reference in a transaction.
- [x] **BASE-02 — Migrate existing data without reinterpreting text (synthetic rehearsal complete).**
  Add new additive migrations for revisions, content format, media relationships,
  translations/metadata, and editorial slots according to the workflows below.
  Dependency: BASE-01. Acceptance: restoring the prototype database in an isolated
  environment preserves accounts, enrollments, progress, and lessons; legacy text
  remains `plain`, without executing previously harmless markup. Do not edit applied migrations.
  A file-backed synthetic upgrade test applies the prototype-era migrations to a
  temporary backup and verifies accounts, sessions/tokens, published and draft
  revisions, legacy media references, enrollments, entitlements, progress, literal
  text, promotion slots, repeatability, and SQLite integrity.
  `node scripts/create-prototype-fixture.mjs` now creates an ignored local fixture from
  migrations 001–003 with fictional records. A separate copy was upgraded twice
  through migration 092; account/course/enrollment counts, progress and literal
  `plain` lesson content were preserved, `integrity_check` returned `ok`, and
  `foreign_key_check` returned no rows. This validates migration behavior against
  the synthetic prototype schema only; no production or real customer database
  exists or was used.
- [x] **EDIT-01 — Markdown editor with toolbar and preview.**
  Headings, bold, italic, lists, links, quotes, code blocks, tables, and images with
  alt text; accessible editing and preview. Dependencies: BASE-01/02.
  Acceptance: authors format, save, and reopen content, and learners receive the same
  rendered structure. Markdown is the initial choice; a visual editor may be added
  without requiring unrestricted HTML to complete this delivery.
- [x] **EDIT-02 — Safe, versioned rendering.**
  Define `content_format`, parser, and server-side allowlist sanitization; block
  scripts, handlers, dangerous URLs, arbitrary SVG/HTML, and unapproved embeds.
  Dependency: EDIT-01. Acceptance: preview and lessons use the same policy; XSS
  cases fail; legitimate content and translations remain readable. Installing a
  parser alone is insufficient.
- [x] **EDIT-03 — Studio organized by course/module/lesson.**
  Split the single form into screens/components, support keyboard and drag reordering,
  duplicate/remove drafts with confirmation, and preview as a learner/visitor.
  Dependency: BASE-01. Acceptance: build a multi-module course without editing JSON/SQL;
  deletion does not break enrolled revisions or remove media still referenced.
- [x] **EDIT-04 — Autosave, conflicts, and unsaved work protection.**
  Save per editing unit, indicate status/errors, recover drafts, and detect concurrent
  edits through a version/ETag. Dependency: EDIT-03. Acceptance: network failure,
  two tabs, navigation, and language switching do not erase or silently overwrite
  content. At the original audit, `languageSelect` called `main()` and recreated the form.
- [x] **EDIT-05 — Lesson types and publication validation.**
  Support `video`, `article`, `mixed`, media and attachment association, duration,
  required status, and preview. Dependencies: BASE-02, MEDIA-03, EDIT-02. Acceptance:
  video-only lessons need no placeholder text; publication lists missing fields and
  blocks non-READY media, invalid ordering, and links to another course/author.

## P0 — end-to-end media and video

- [x] **MEDIA-01 — Private, secure storage.**
  Confine paths to the root, including protection against `../`, absolute paths, and
  symlinks; server-generated keys, streaming, temporary writes/rename, and cleanup
  after failure. Dependencies: none. Acceptance: confinement and author isolation
  tests; large file transfers without an entire Buffer in memory. The original
  adapter must not be exposed before this correction.
- [ ] **MEDIA-02 — Upload videos, images, and attachments (local implementation; host scan qualification open).**
  Authorized endpoints, resumable streaming/chunks, progress, cancel/retry, quotas,
  and incomplete upload cleanup. Check size and actual content, quarantine originals,
  and define inspection/antimalware for attachments. Dependencies: MEDIA-01, BASE-02.
  Acceptance: interrupted uploads resume without duplication; invalid files or files
  belonging to another author are rejected; a full disk produces a recoverable error.
  - [x] Insert a READY PNG/JPEG upload into lesson Markdown from the attachment row;
    same-origin delivery remains bound to revision, preview/enrollment, and withdrawal
    authorization. E2E covers upload, preview, publication, and browser rendering.
  Local endpoints enforce author ownership, quotas, resumable chunk offsets, and
  cancellation; the worker validates signatures/content in private storage before
  publishing normalized artifacts, and expires/cleans incomplete uploads. The
  ClamAV path is fail-closed when enabled and tested with scanner outcomes, but
  `ATTACHMENT_SCAN_MODE` defaults to `disabled`. Keep this item open until the real
  worker host has ClamAV enabled and its scan behavior is qualified.
  The isolated E2E server now always starts its temporary worker so image/attachment
  workflows run even when real-video conversion tests are skipped; this does not
  change the production scanner policy or qualify host scanning.
- [x] **MEDIA-03 — FFprobe/FFmpeg processing (local implementation).**
  Validate containers/streams, generate compatible playback MP4 and adaptive HLS,
  poster, duration, and metadata; CPU/memory/time limits and subprocesses without
  shell interpolation. Dependencies: MEDIA-02, JOB-01. Acceptance: real video reaches
  READY with verified outputs; corrupted files become FAILED with useful errors;
  publication never points to incomplete files. Do not artificially upscale resolution.
  Delivered locally: FFprobe validates supported containers, video streams, duration,
  and dimensions; FFmpeg emits H.264/AAC MP4, poster, and private HLS VOD master,
  variant playlists, and segments. Variants scale down only, aggregate HLS output is
  capped, and READY is committed only after all outputs are stored. HLS requests
  recheck revision/preview/enrollment/withdrawal access for every playlist and
  segment. Real-media tests cover output generation and authorized delivery. MEDIA-03
  is complete locally; long-duration CPU/disk/bandwidth qualification on Maia Edge
  remains operational work. PLAY-02 still owns adaptive-player integration.
- [x] **JOB-01 — Long-running jobs and controlled concurrency (local implementation).**
  Separate media capacity from the email queue; lease renewal, progress, heartbeat,
  cancellation, and crash recovery; idempotent outputs and manual retry.
  Dependency: MEDIA-01. Acceptance: transcoding longer than five minutes is not
  reclaimed by another worker; crashes/restarts neither produce concurrent duplicate
  outputs nor block SMTP.
  Delivered locally: media processing uses an independent `MEDIA_WORKER_CONCURRENCY`
  pool (default 1, bounded to 4), separate from `WORKER_CONCURRENCY` for outbox work.
  A live media job renews its lease/heartbeat every 15 seconds; only a heartbeat older
  than two minutes can be reclaimed. Lease-specific output keys and conditional READY
  commits keep stale workers from publishing duplicate outputs. Processing milestones
  persist from 0 to 100 and are visible in the editor; retries reset progress. Owners
  and admins can retry FAILED jobs and cancel queued/processing work. Active cancellation
  leases retain chunks until the worker aborts; the sweeper reclaims stale cancelled
  leases and removes chunks safely. Tests cover concurrent claims, outbox progress
  during media jobs, retry, cancellation races, stale-lease recovery, and real-media
  completion. JOB-01 is complete locally; long-duration VPS qualification remains
  operational validation, not an unimplemented queue workflow.
- [ ] **MEDIA-04 — Media library and lifecycle (blocked on retention policy).**
  List by author/course, search, select, replace with a new version, associate
  images/covers/posters/attachments, and display queue/errors. Dependencies:
  MEDIA-02/03, EDIT-03. Acceptance: authors follow the entire process without a
  terminal; orphan collection considers old revisions and removes only eligible
  files after a defined retention period.
  - [x] Add an author/admin library with filename/course search, course/type/status
    filters, pagination, processing/error state, reference counts, and owner-scoped
    results; never expose storage keys. Existing course editor selectors continue
    to handle association and replacement.
  - [ ] Define orphan retention and implement collection that rechecks every old
    revision before deleting only unreferenced media; no retention period or cleanup
    has been activated without an owner policy.
- [x] **MEDIA-05 — Supplementary materials with descriptions.**
  Allow multiple attachments per course or lesson, including PDF, ZIP, source code,
  and other permitted formats. Each attachment has an editable title and description;
  show learners the filename, format, and size. Provide upload, ordering, replacement,
  and removal in the editor, preserving files referenced by previous revisions.
  Dependencies: MEDIA-01/02/04, BASE-01, EDIT-03. Acceptance: authors add a PDF, ZIP,
  and source file with descriptions; authorized learners see materials in their
  course/lesson context and can download them. Downloads respect enrollment,
  revision, revocation, and preview policy; direct URLs cannot bypass authorization.
  Apply size limits and type validation; serve as downloads without executing code
  or automatically extracting ZIP files.
- [x] **PLAY-01 — Authorized MP4 and HLS delivery (local implementation).**
  Playback endpoints tied to lesson/revision/entitlement, HTTP Range/206/416, correct
  Content-Type, HEAD, and playback session expiration/renewal; also check secondary
  playlists, segments, keys, and attachments. Dependencies: MEDIA-03, BASE-01.
  Acceptance: direct access/copied URLs cannot bypass enrollment or revocation;
  public previews expose only the approved asset, never the entire directory.
  Delivered locally: MP4/poster/captions and HLS master/variant/segment requests
  resolve from the requested lesson revision and recheck preview, active entitlement,
  owner/admin, and withdrawal on every request. MP4 supports Range/206/416 and HEAD;
  HLS paths are allowlisted and storage keys remain private. All responses are
  private/no-store. Protected requests use the normal HTTP session cookie, which
  expires after seven days and is touched/renewed by the SQLite store; the API also
  rechecks active user/session version on every request. Real-media integration tests
  cover copied unauthenticated URLs, enrolled access, revocation, withdrawal, HLS
  master/variant/segment delivery, and legacy MP4 ranges. PLAY-01 is complete locally;
  browser player HLS integration remains PLAY-02.
- [ ] **PLAY-02 — Integrated, responsive player (local implementation; device qualification open).**
  HTML5 player with native HLS/appropriate fallback, play/pause, seek, volume, speed,
  fullscreen, keyboard controls, loading/error states, and quality selection.
  Dependency: PLAY-01. Acceptance: playback and seeking work on desktop, Android,
  and Safari/iOS; access renewal during long lessons does not unnecessarily interrupt playback.
  - [x] Use native HLS where supported, local HLS.js with automatic/manual rendition
    selection where MSE is available, and authorized MP4 fallback when adaptive
    playback is unavailable. Native controls provide keyboard, seek, volume and
    fullscreen controls; speed, loading, error, and fallback states are localized.
  - [x] Chromium real-video coverage verifies HLS master/variant/segment playback,
    quality switching, and MP4 fallback after an HLS playlist failure.
  - [ ] Qualify seeking/quality switching on Android Chrome and Safari/iOS, and run
    long lessons through HTTP-session renewal on the deployed host.
- [x] **PLAY-03 — Captions and transcripts.**
  WebVTT upload/validation, language and track selection, accessible text transcripts,
  replacement workflow, and availability indication. Dependencies: MEDIA-04, PLAY-02.
  Acceptance: authors publish captions and learners enable them in the player;
  private course tracks follow the same authorization as video.
- [x] **PLAY-04 — Learner resumption and navigation (local implementation).**
  Persistent module outline, previous/next, last lesson, debounced position saving,
  continue watching, and course progress. Dependencies: PLAY-02, BASE-01.
  Acceptance: reloads/device changes resume position; requests stay within API limits;
  explicit completion follows course policy, without treating seconds reported by
  the browser as proof of learning.
  - [x] Lesson API returns revision-scoped module outline and previous/next links;
    public preview exposes only public/preview lessons, while active learners retain
    navigation in their assigned revision.
  - [x] Browser saves integer playback position at a 15-second interval and sends a
    trailing save on pause, including when a prior save is still in flight.
  - [x] Player restores position after metadata loads; learning dashboard selects the
    most recently active unfinished lesson or the first unfinished lesson.
  - [x] Server completion requires recorded completion for every snapshotted required
    lesson and passing all required quizzes; browser position alone never completes it.
  Full real-video Chromium coverage verifies pause/save, reload and isolated-session
  resume. PLAY-04 is complete locally; independent device qualification remains part
  of PLAY-02.
- [ ] **OPS-01 — Adapt HTTP and installation for video (local implementation; VPS validation open).**
  Separate uploads from the original JSON-only middleware; dedicated authentication/CSRF
  for multipart/chunks. Define route and rate limits for uploads/player; review
  Nginx (1 MB at the audit), buffering, timeouts, Range, temporary storage, FFmpeg,
  and dependencies in systemd/Docker installations. Dependencies: MEDIA-02, PLAY-01.
  Acceptance: representative uploads, seeking, and long playback cross the VPS/WireGuard
  without inappropriate 413/415/429 errors, exposing new public services, or restarting the VPN.
  - [x] Keep uploads as authenticated 512 KiB raw chunks with per-account rate limits,
    same-origin/JSON guards, and a 1 MiB managed Nginx body ceiling; stream requests
    and media responses without Nginx proxy buffering and forward Range headers.
  - [x] Host installer binds the API to the assigned WireGuard IP and trusts only the
    configured proxy IP; no new public port or VPN peer is created.
  - [ ] Exercise uploads, Range/HLS seeking, and long playback through the installed
    VPS/WireGuard domain; local renderer/Nginx syntax tests cannot prove host capacity.

## P0 — homepage and course presentation

- [x] **HOME-01 — Editorial course selection.**
  Dashboard to select hero, featured courses, and collections, order them, schedule
  start/end dates, and remove them from the homepage without unpublishing. Use/evolve
  `promotions`; provide a dedicated public API separate from general search.
  Dependency: BASE-01. Acceptance: administrators explicitly choose homepage courses
  and their order; drafts/archived courses never leak; removing a highlight keeps
  the course in the catalog.
- [x] **HOME-02 — Covers, cards, and sales/presentation page.**
  Cover and alt text, trailer/preview, author/bio, objectives, prerequisites, level,
  language, workload, curriculum, and access/certificate terms. Dependencies:
  MEDIA-04, EDIT-03, HOME-01. Acceptance: dashboard edits appear on the public page;
  cards have images and CTAs consistent with enrollment/pricing, without fake statistics.
- [x] **HOME-03 — Catalog, categories, and paginated search.**
  Manageable taxonomy, access/language/level filters, sorting, and real pagination
  instead of the fixed 100-item limit. Dependency: HOME-02. Acceptance: composable
  filters, shareable URLs, useful empty states, and courses accessible beyond page one.

## P1 — identity, management, and internationalization

- [x] **I18N-01 — Complete existing internationalization.**
  Preserve `en`, `pt-BR`, `es`, and existing detection behavior; translate all new
  components, states, validations, emails, and API messages using stable codes;
  format dates/numbers/prices by locale. Dependency: part of every delivery, not a
  later rewrite. Acceptance: the same flows tested in all three languages, missing
  keys detected, and language switching without form loss (EDIT-04).
  Completed locally: all currently exposed API failures return stable codes with
  translations in all three locales; translation keys/placeholders are parity-
  checked; numeric interpolation, catalog pagination, dates, and currency use the
  selected locale. Browser coverage exercises account, recovery, authoring, catalog,
  learner, verification, and admin date flows across locales. Currency formatting
  is ready for price UI; paid pricing/checkout remain PAY-01, not an I18N-01 gap.
- [x] **I18N-02 — Separate interface and course languages (local implementation).**
  Save user preferences, let authors set content/caption locales, and support
  translated metadata with explicit fallback. Dependencies: BASE-02, I18N-01.
  Acceptance: selecting Spanish in the interface neither reclassifies a Portuguese
  course nor promises automatic video translation; preferences persist across devices.
  Delivered locally: interface-language preference remains account-backed; the course
  source locale is distinct from `displayLocale`. Authors can add optional en/pt-BR/es
  translations for title, summary, outcomes, prerequisites, instructor bio, access
  terms, and certificate terms. Catalog, home, detail, learning, and author preview
  apply field-level fallback to the source revision. Revision translations are
  immutable after publication or enrollment. Caption tracks retain explicit author-
  selected locales. API/E2E tests verify Spanish display over a PT-BR course without
  relabeling its source locale. I18N-02 is complete locally; the actual course
  translations remain content-owner authored.
- [x] **ADMIN-01 — User and author management (local implementation).**
  Listing/search, roles, suspension/reactivation, public instructor profiles, and
  auditing; administrative bootstrap/reset with specific errors and no default passwords.
  Dependency: existing identity. Acceptance: administrators delegate authorship in
  the dashboard; authors cannot change another author/account; access changes
  invalidate the relevant sessions.
  Partial local delivery: administrators can search/filter/paginate accounts in
  the dashboard and suspend/reactivate them. State changes bump session_version
  and write audit events; self-suspension and suspension of the last active admin
  are rejected, and expired HTML sessions return to sign-in. Administrators can
  also delegate learner, author, and admin roles; worker assignment, self-demotion,
  and demotion of the last active admin are rejected. Role changes invalidate
  sessions and are audited. Authors/admins can opt into a public instructor
  profile with a unique address, public name, biography, and HTTPS website; public
  pages expose only published courses and never account email/private display
  name. The host bootstrap/reset command creates verified administrators without
  default passwords; explicit resets rotate credentials, promote the selected
  account to admin, invalidate sessions, and write audit events. ADMIN-01 is
  implemented locally; production runbook execution remains an operator task.
- [x] **AUTH-01 — Complete account workflows (local implementation).**
  Profile, password changes, verification resend/feedback, localized recovery,
  account states, and explicit unverified-email policy; administrator MFA with
  recovery. Dependencies: I18N-01, ADMIN-01. Acceptance: used/expired tokens,
  unavailable SMTP, and lost second factors have verifiable recovery paths.
  Delivered locally: profile display-name and email changes; email changes require
  current-password confirmation and a single-use link to the new address, retain
  the old address until confirmation, then verify the new address and revoke all
  sessions. Unverified accounts may sign in and learn, but certificate issuance
  requires verification; My learning explains this and allows a generic resend.
  Password changes and resets revoke sessions and invalidate pending reset links.
  Verification/recovery/email-change messages use the saved locale; tokens are
  single-use/expiring, and SMTP failures remain retryable in the outbox with resend
  paths. Admin MFA uses encrypted TOTP secrets, pre-authentication challenges,
  replay protection, a five-attempt challenge limit, hashed one-time recovery codes,
  audit events, and password-plus-factor disable with session revocation. Recovery
  codes provide access when an authenticator is lost. Full tests cover used/expired
  tokens, email collisions, session revocation, MFA lockout/replay/recovery, and
  unverified-email policy; Chromium covers localized flows. Local implementation
  is complete; live SMTP/provider delivery and host runbook qualification remain
  deployment/operations checks, not unimplemented account workflows.
- [x] **ADMIN-02 — Enrollments, grants, and audit (local implementation).**
  Dashboard for enrollments, progress, manual grants/revocation with reasons,
  history, and support handling. Dependencies: BASE-01, ADMIN-01. Acceptance:
  authorized, audited operations change access without deleting history or requiring manual SQL.
  Delivered locally: administrators can search and filter enrollments by learner
  email, course title, address, and state; inspect required-lesson progress and
  effective current access; grant access to a published course or revoke it with
  a required reason; and inspect chronological audit history. Only administrators
  can use these operations. Revoked enrollment state blocks protected lesson and
  media access and is reflected as no current access even while prior entitlement
  history remains intact. Re-granting reuses the enrollment and preserves progress;
  duplicate active grants are rejected and repeated revocations do not duplicate
  audit events. API integration and Chromium tests cover authorization, access
  denial/restoration, progress/history retention, and the support UI. ADMIN-02 is
  complete locally. Provider-payment reconciliation, provider-linked support, and
  broad operational reporting remain outside this acceptance and tracked separately.
- [x] **ADMIN-03 — Publication, review, and urgent withdrawal (local implementation).**
  DRAFT → REVIEW → PUBLISHED workflow, checklist, optional scheduling, and notifications;
  distinguish archiving (preserves access) from urgent access withdrawal.
  Dependencies: EDIT-05, ADMIN-02. Acceptance: each transition's rules are tested;
  urgent withdrawal leaves no access through old URLs/media grants.
  Delivered locally: authors submit owned drafts for review only after the shared
  checklist passes, with optimistic revision checks and audit events. Administrators
  can publish immediately or schedule a REVIEW revision for a future local date/time;
  the worker revalidates readiness at execution, and schedules can be rescheduled or
  cancelled. Editing the reviewed revision, archiving, or early publication clears
  and audits the obsolete schedule. New revisions queue localized outbox email only
  for active, verified learners; first publication has no existing recipients, and
  current enrollment/progress revisions remain unchanged. Administrators can archive
  to hide discovery and block new enrollment while preserving existing access, or
  urgently withdraw a published/archived course with a required reason. Migration 049
  stores the immutable withdrawal marker; protected course, lesson, video, caption,
  cover, attachment, grant, and progress routes enforce it, with history retained.
  API, worker-service, migration, and Chromium tests cover transitions, scheduling,
  failed revalidation, notifications, access, and audit. ADMIN-03 is complete locally;
  no live SMTP or production scheduling qualification was performed.

## P1 — assessments and completion

- [x] **QUIZ-01 — Assessment builder and versioning.**
  Single/multiple-choice questions, scoring, passing grade, attempts, lesson/final
  assessments, and preview. Dependencies: BASE-01, EDIT-03. Acceptance: authors build
  assessments in the dashboard; answer keys never appear in learner payloads;
  new revisions do not change old answers/attempt policies.
  Delivered locally: author/admin API and studio builder configure lesson/final
  quizzes, questions, keyed choices, scoring, pass threshold, attempt limit,
  randomization, optional time limit, and explanations on the current draft revision.
  Definitions are audit-logged and freeze after the first attempt; learner reads
  omit answer keys. Publication validates configured quizzes, and author preview
  shows unsaved content without saving or publishing. API and Chromium coverage
  passed. Server attempt/submission concurrency is tracked separately under QUIZ-02.
- [x] **QUIZ-02 — Server-side attempts and grading.**
  Atomic start/submission, limits, duplicate handling, deadlines, and result feedback.
  Dependency: QUIZ-01. Acceptance: manipulated, repeated, concurrent, or cross-course
  answers cannot produce a passing result; accepted submissions become immutable.
  Partial data-layer protection: migrations 026 and 036 bind attempts/answers to
  their enrollment, revision, and quiz, then freeze attempts and answer rows after
  `submitted_at`; migration 037 freezes quiz/question definitions once an attempt
  exists; migration 038 validates positive integer attempt limits and question
  points/order, and bounds awarded points per question; migration 039 enforces
  `max_attempts` per enrollment/quiz and retains attempt history; migration 040
  supports an optional per-quiz time limit and rejects writes/submission after it.
  Delivered locally: enrolled learners can start/resume an open attempt,
  retrieve its private state, and submit answers for server-side grading from the
  lesson player. The player renders choices, restores an open attempt after reload,
  and displays the server's score/pass result and remaining attempts. Starts
  use an immediate transaction, concurrent starts converge on one open attempt,
  answer question/choice IDs are validated, the score/pass result is computed from
  server-held keys, duplicate submissions return the stored result, and expired
  deadlines return a stable error without partial answer writes. Expired open
  attempts remain counted but are not resumed, so remaining configured attempts
  can still start. Lesson-player selections auto-save without scoring, restore on
  resume/reload, and are graded only on final submission. Learners can review
  their submitted score/pass history for their own enrollment revision without
  answer selections or keys. Submitted feedback now marks selected and correct
  choices and can include an author explanation; this feedback is only returned
  after submission. Expired unsubmitted attempts appear in private history as
  consumed, ungraded attempts without answer feedback. Focused API coverage submits
  conflicting answers concurrently to one attempt and verifies both requests
  converge on the same persisted result with one answer row. Additional high-volume
  stress runs and richer deadline recovery UX are operational follow-up, not open
  functional acceptance criteria.
- [x] **LEARN-01 — Consistent completion policy (local implementation).**
  Snapshot required lessons/grades/attempts per revision, server-side calculation,
  and idempotent completion. Dependencies: PLAY-04, QUIZ-02. Acceptance: dashboard
  and certificates use the same decision; revoked access and failed assessments prevent issuance.
  Partial local delivery: migration 051 adds a monotonic enrollment `completed_at`;
  migration 052 backfills and freezes the required lesson/quiz ID snapshots for
  existing enrollments, and new enrollments capture the same lists transactionally.
  One server policy requires at least one snapshotted required lesson, all those
  lessons complete, every snapshotted quiz passed, and active non-withdrawn
  entitlement. Lesson-completion writes and quiz submissions reevaluate atomically;
  repeated updates preserve the original completion timestamp. `/me/enrollments`
  exposes `completion_ready` and the learner dashboard marks recorded completion.
  Certificate eligibility and record issuance use this same completion policy;
  they store an immutable certificate payload and consent snapshot. API tests cover
  incomplete lessons, failed quizzes, completion timestamps, revoked entitlement,
  and certificate eligibility; browser tests cover progress/dashboard/navigation.
  LEARN-01 is complete locally. Real-device playback qualification remains under
  PLAY-02, and institutional issuer policy remains under CERT-01.

## P1 — sales and payments

- [x] **PAY-01 — Pricing, orders, and checkout workflow (local implementation).**
  Enable PAID in the editor with price/currency/terms, order snapshots, idempotency,
  hosted checkout, and pending/canceled/approved screens. Dependencies: BASE-01,
  HOME-02, ADMIN-02. Acceptance: browser-supplied prices are not trusted; return
  redirects do not grant access; buyers can see their orders and status.
  Delivered locally: authors can price a PAID revision in integer minor units with
  BRL/USD/EUR and published terms; migration 084 requires a valid price snapshot.
  Buyers see localized public prices and can create orders from the published
  revision only. Migration 085 stores immutable revision/title/terms snapshots;
  server-owned price/currency, per-user idempotency and pending-order reuse prevent
  browser price changes and duplicate attempts. Buyers can see private order status.
  The development/test Fake provider offers a local hosted-checkout simulation;
  approval checks provider status, amount and currency before transactionally creating
  enrollment/entitlement, while cancel and browser return do not grant access.
  Production startup rejects fake checkout activation and production checkout remains
  disabled until PAY-02 signature/webhook/reconciliation validation is implemented.
  PAY-01 is complete locally; live provider sandbox/production qualification remains
  under PAY-02/PAY-05, not as an unimplemented local order flow.
- [x] **PAY-02 — Orders API adapter and verified webhooks (local implementation).**
  Check current official documentation before implementation; test signatures,
  identifier sources, headers/query/body, and correct deduplication. At the audit,
  `verifyWebhook` attempted to extract `data.id` from the body as URLSearchParams
  and used that identifier as the event; do not consider the integration validated.
  Session/origin/JSON middleware and raw-byte capture must follow the provider's
  specific contract without broad exceptions on other routes. Dependency: PAY-01.
  Acceptance: official/sandbox fixtures accepted, tampered ones rejected, and distinct
  transitions of the same payment processed without duplicate grants.
  Delivered locally after reviewing Mercado Pago's current Checkout Pro Orders API
  documentation: the adapter creates `/v1/orders` with `X-Idempotency-Key`, manual
  online processing and exact total/item snapshots, and retrieves authoritative order
  state by provider order ID. Webhooks preserve raw JSON only on the dedicated route,
  verify the HMAC manifest from `data.id` query + `x-request-id` + `ts`, require the
  signed body event ID/type/order ID to agree, and re-fetch the order before changes.
  The transaction validates `external_reference`, amount and currency, deduplicates
  by provider/event ID plus payload hash, stores provider payment transitions, and
  grants one entitlement only after approval. Pending, mismatch/retry, duplicate,
  tampered signature, and distinct state transitions have official-shaped fixtures.
  PAY-02 is complete locally. A real Mercado Pago test-account purchase/webhook was
  not run; production checkout stays disabled by default until sandbox qualification.
- [x] **PAY-03 — Confirmation, reconciliation, and access rights (local implementation).**
  Query authoritative status and verify seller, reference, currency, and amount;
  write order/payment/enrollment/entitlement/outbox in a short SQLite transaction;
  reconcile lost/delayed events. Dependency: PAY-02. Acceptance: approved payments
  grant access once; repeated/out-of-order notifications cannot create incorrect
  access; approved orders without enrollment are detected and recovered.
  Delivered locally: webhook and buyer refresh query authoritative Orders API state
  and compare configured seller, external reference, amount and currency against the
  immutable order snapshot. Settlement updates provider-payment state, order state,
  enrollment, order entitlement and a localized confirmation email in one SQLite
  transaction. The worker reconciles aged pending orders once per minute independently
  of media/outbox work; PAID orders missing enrollment/order entitlement are repaired
  with a two-minute retry backoff. Duplicate/out-of-order notifications remain
  idempotent, and a locally PAID order is not downgraded by a stale pending response.
  Tests cover seller/snapshot mismatch, lost-event reconciliation, missing-access
  recovery, duplicate grants/receipts, and buyer-triggered refresh. PAY-03 is complete
  locally; live sandbox reconciliation and production monitoring remain operator
  qualification, and refund/chargeback policy remains PAY-04.
- [x] **PAY-04 — Refunds, disputes, and commercial support (local implementation).**
  Full/partial refunds, chargebacks, audit trail, access revocation, and policy for
  issued certificates; orders and receipts dashboard. Dependencies: PAY-03, ADMIN-02.
  Acceptance: retries cannot duplicate refunds; local state reconciles with the
  provider; partial refund rules are explicit.
  Delivered locally: admin-only order search/status/history, reasoned partial/full
  refunds and manual chargeback records; provider order webhooks now reconcile
  refund IDs/status and `order.charged_back` state. Same-key retries preserve request
  details across browser reloads. Partial refunds retain access/certificates; full
  refunds and chargebacks revoke active order access and certificates with reasons,
  retaining enrollment/progress and audit history. The dashboard reports receipt
  email state. PAY-04 is complete locally; no live Mercado Pago sandbox refund,
  chargeback notification, or production deployment was performed. Production
  checkout remains disabled until PAY-05 operator qualification.
- [ ] **PAY-05 — Validation and commercial configuration (blocked on owner/operator input).**
  Separate sandbox/production, review seller identity, currency, access/refund terms,
  support, receipts, and tax requirements with a qualified responsible party.
  Dependencies: PAY-01–04. Acceptance: purchase/reversal tested in the sandbox;
  real activation depends on the owner's credentials/configuration. Do not substitute
  fake production payments for a pending integration.
  Delivered locally: explicit `MP_ENVIRONMENT`, strict boolean parsing for
  `PAYMENTS_CHECKOUT_ENABLED`, sandbox-only nonproduction and production-only
  production configuration, required real-provider credentials when enabled, and a
  route guard that blocks Mercado Pago checkout whenever the flag is false. The flag
  remains false. Blocked pending owner/operator confirmation of the seller account,
  currency/payment methods, buyer-facing terms/support/receipt wording, tax/accounting
  review, and sandbox credentials/test-user setup. Configure credentials through the
  deployment secret store, never in chat.

## P1 — certificates

- [ ] **CERT-01 — Eligibility and idempotent issuance (blocked on issuer policy).**
  Check completion, entitlement, verified email, name, and disclosure consent;
  snapshot identity/course/workload/issuer. Dependencies: LEARN-01, AUTH-01, and
  PAY-04 for paid courses. Acceptance: concurrent requests produce one valid issuance;
  subsequent profile/course edits do not rewrite the document.
  - [x] Authenticated preflight checks active access, course withdrawal, completion,
    verified email, confirmed name/consent, and active-certificate state; returns
    the exact public disclosure fields and a versioned hash.
  - [x] Transactional issuance rechecks eligibility, requires consent bound to the
    latest disclosure hash, and generates a 256-bit opaque code.
  - [x] Immutable learner/course/workload/instructor snapshot, payload hash,
    consent timestamp/version, and append-only audit event are stored. Concurrent
    requests and retries return the same active issuance; later profile/revision
    edits cannot rewrite that snapshot.
  - [x] Connect paid-course reversal rules from PAY-04: full refunds and chargebacks
    revoke active certificates with reasons while partial refunds preserve them.
  - [ ] Owner confirms institutional issuer policy before production issuance.
    Locally, workload is the published revision's declared minutes and issuer is
    the course revision's instructor name.
- [x] **CERT-02 — PDF, QR, and public verification.**
  Asynchronous generation, authorized download, opaque code, public verification
  with minimal data and valid/revoked status; learner certificates screen.
  Dependencies: CERT-01, JOB-01. Acceptance: QR opens the canonical URL, PDF text
  remains readable, workers can retry without duplicate issuance, and lookup does
  not enumerate identities.
  - [x] Anonymous API lookup and learner-facing verification page show only the
    approved snapshot fields and current valid/revoked status in en, pt-BR, and es.
    Unknown/malformed and legacy-without-snapshot codes share a generic 404; API
    lookup is limited, `noindex`, and `no-store`.
  - [x] Queue PDF generation atomically with issuance; worker retries through the
    leased outbox and stores a private PDF with selectable text and an embedded QR
    linking to the canonical HTTPS verification URL.
  - [x] Provide owner/admin-authorized PDF download; pending artifacts return a
    stable not-ready response. Migration 044 rejects public codes shorter than 32
    characters; issuance generates 256-bit codes.
  - [x] Add the learner's certificate screen to list status and download ready PDFs.
  All functional acceptance criteria are implemented and covered locally. Production
  rollout still depends on confirming CERT-01 issuer/payment policy and deploying
  the worker/storage configuration.
- [x] **CERT-03 — Revocation and reissuance.**
  Dashboard and private reason, new document when needed, link to the previous one,
  and preservation of old-code lookups. Dependencies: CERT-02, ADMIN-02.
  Acceptance: revoked documents remain verifiable as revoked; only authorized
  administrators can reissue, with auditable history.
  - [x] Admin-only search/list, reasoned revocation, one-time reissue of a revoked
    certificate, and private lineage/history view are available in `/admin/certificates`.
  - [x] Reissue preserves the consented public snapshot, assigns a fresh opaque
    code, links to its predecessor, queues a new PDF, and records both lifecycle
    audit events with the acting administrator.
  - [x] Old codes remain publicly verifiable as revoked; duplicate successor or
    reissue while an active certificate exists is rejected.
  Public verification intentionally remains minimal and does not reveal private
  reasons or lineage; the admin history links predecessors/successors and their
  preserved verification codes without exposing that relationship publicly.
  Partial data-layer protection: migrations 031 and 043 limit active issuance,
  preserve issued identity/code/hash snapshots, and retain revoked certificate
  history; migration 045 requires a non-empty reason when revoking; migration 046
  makes revocation timestamps irreversible and monotonic; migration 047 links a
  reissued certificate to its revoked predecessor. Public verification intentionally
  keeps private reasons and lineage hidden. Production policy and worker rollout
  conditions are tracked under CERT-01/CERT-02, not as unfinished CERT-03 behavior.

## P1 — reliability, protection, and full launch

- [ ] **DATA-01 — Strengthen SQLite invariants.**
  - [x] Enforce assessment result-state consistency: open attempts have no result;
    submitted attempts carry a 0–100 integer score and a binary pass flag
    (migration 056, covered by focused direct-SQL integrity tests).
  - [x] Enforce outbox retry counters as non-negative integers and keep active
    lease, processed timestamp, and retry-count states consistent (migration 057;
    tested for valid claim/failure/success and invalid direct-SQL combinations).
  - [x] Keep retry counts monotonic, processed jobs terminal, and lease acquisition
    coupled to exactly one attempt increment (migration 060; focused tests cover
    failed reopen, lease theft, invalid completion, and normal retry transitions).
  - [x] Require entitlement start/end timestamps to parse and any finite end to be
    strictly later than its start (migration 058; tested for insert and update).
  - [x] Restrict upload status changes to the processing lifecycle, recovery,
    retry, or cancellation paths; READY/CANCELLED remain terminal (migration 059,
    with publication/media fixtures following the real transitions).
  - [x] Enforce translated metadata structure, supported unique locales distinct
    from the source locale, allowed fields, and field limits for direct SQL writes
    (migration 089; focused insert/update integrity tests).
  - [x] Restrict playback aggregates to real UTC calendar dates and integral HTTP
    status classes/request counts (migration 093; valid historical rows survive,
    and invalid legacy rows fail the migration without being discarded).
  Partial: migrations 017–018 prevent progress, enrollment-revision, and
  lesson-module changes from crossing the enrollment's assigned revision, and
  constrain progress positions to non-negative integers. Migration 019 ensures
  each enrollment's course matches its revision's owner; migration 020 applies the
  same ownership rule to current/published course revision pointers; migration
  061 prevents deleting and migration 062 prevents renaming a revision still
  referenced by either course pointer; migrations 063–064 freeze published
  revision metadata, modules, lessons, attachments, category assignments, quizzes,
  and questions while leaving drafts editable; migration 065 requires the public
  revision pointer to target a revision marked published; migration 066 freezes
  media upload records referenced by published revisions; migration 067 requires
  PUBLISHED courses to retain a valid published revision pointer; migration 068
  restricts course status transitions to the review, publication, and archive flows.
  Migration 069 permits urgent withdrawal only for published or archived courses
  with a valid published revision pointer.
  Migration 070 rejects new enrollment rows for archived, review, or withdrawn
  courses and validates the exact public revision for published courses.
  Migration 072 makes course ownership immutable, preventing direct-SQL transfer
  of authoring rights without an administrative workflow.
  Migration 073 requires newly inserted certificates to start active; revocation
  must occur through the existing reasoned, monotonic update lifecycle.
  Migration 074 rejects malformed certificate issuance and revocation timestamps.
  Migration 075 requires certificate payloads to be verification-ready objects
  with typed fields and a public code matching the indexed code.
  Migration 076 ties the payload's confirmed name and issue timestamp to the
  corresponding immutable certificate columns.
  Migration 077 ties course title, workload, issuer and completion time in the
  payload to the enrollment's assigned revision and completion record.
  Migration 021 binds lesson videos to their revision's course and video media kind;
  migration 022 applies course
  and media-kind checks to revision covers and trailers; migration
  023 validates attachment ownership and optional lesson/revision associations;
  migration 024 prevents duplicate attachment positions within each list; migration
  025 binds lesson quizzes to lessons in the same revision.
  Migration 026 binds attempts to the enrollment/quiz revision and answers to
  questions from the attempted quiz; migration 027 prevents duplicate question
  positions within a quiz. Migration 028 requires an order-backed entitlement to
  reference a matching order for the enrollment's user and course; migration 071
  makes enrollment/source provenance immutable; migration 029
  enforces a positive price and immutable order snapshot terms. Migration 030
  deduplicates provider payment/refund references per provider and requires
  positive integer refund amounts; migration 031 permits at most one non-revoked
  certificate per enrollment; migration 032 makes audit events append-only.
  Migration 033 caps combined pending/approved refunds at the order price snapshot;
  provider capture reconciliation and refund policy remain open. Migration 034
  prevents duplicate non-null checkout IDs within one provider; migration 035
  constrains order state transitions while allowing late confirmed payment.
  Migration 036 makes submitted attempts and their answer rows immutable; migration
  037 freezes quiz/question definitions after attempt start; migration 038 adds
  numeric bounds for quiz settings and question scoring fields; migration 039
  enforces the configured attempt cap per enrollment and quiz; migration 040
  adds optional timed-attempt enforcement; migration 041 makes enrollment
  user/course/revision assignment immutable while preserving mutable access state;
  migration 042 freezes modules/lessons once their revision has enrolled learners.
  Quiz invariants now include one final quiz per revision, same-revision lesson
  ownership, immutable definitions after attempts start, bounded attempt/scoring
  settings, and immutable submitted attempts/answers. Certificate invariants include
  one active certificate per enrollment, long unique public codes, immutable payload
  and consent snapshots, required consent data for new issuances, revocation rules,
  and valid supersession lineage. Payment invariants cover order snapshots, provider
  identifiers, refund bounds, and state transitions, while provider reconciliation
  and refund policy remain open. Further audit/rollout safety still depends on
  BASE-02 and the end-to-end QUIZ/PAY/CERT workflows; keep the parent open until those
  dependencies and the full invariant matrix are validated. Migrations 092–093
  record only daily aggregate resource/status counts and require a real calendar
  date plus integer status class/count values. Migration 056 requires
  an open attempt to have no score/pass and a submitted attempt to have an integer
  score in 0–100 plus an integer pass flag; focused tests cover invalid direct-SQL
  states while preserving the existing deadline and immutable-submission checks.
  Migration 097 makes CLOSED privacy requests terminal, preventing direct-SQL
  reactivation after closure while preserving OPEN/IN_REVIEW/CLOSED transitions
  needed by the current request queue. Focused migration tests cover allowed updates
  and rejected reopening. Migration 098 makes request IDs, owners, types and
  creation timestamps immutable so audit history cannot be reassigned or rewritten;
  status and update timestamps remain mutable under their lifecycle rules. Migration
  099 rejects malformed privacy-request timestamps and update timestamps earlier
  than creation or the preceding update. Focused migration tests cover these
  constraints and valid lifecycle updates; the complete invariant matrix remains open.
- [ ] **OPS-02 — Integrated backup and media restoration.**
  Database + manifests/versions/referenced files + configuration, retention,
  off-site copies, and rehearsed restoration. Dependency: MEDIA-04. Acceptance:
  restoring a published course and old revision allows playback, resumption, and
  certificate verification; a SQLite-only backup is not a complete video backup.
  Local progress: `npm run backup:bundle -- /path/to/new-directory` creates a
  verified SQLite snapshot plus a copy of the storage root, checks SQLite
  integrity/foreign keys and referenced storage objects, and writes per-file
  SHA-256 hashes to a manifest. `.env` and secrets are excluded.
  `backup:verify` checks stored/transferred bundles; `restore:bundle` restores
  into a new directory and verifies the result without changing live configuration.
  Validation rejects corrupted/missing/extra files, unsafe/duplicate paths,
  symlinks, sidecars and missing database references. New snapshots use DELETE
  journal mode independently of the live database's WAL mode. Tests restore
  the bundle in an isolated temporary directory with the original media offline.
  A real-media HTTP rehearsal now creates/publishes a video course, records
  progress and a PDF certificate, publishes a newer article-only revision,
  backs up/restores with the original database/media offline, and starts an
  isolated application using only the recovered paths. It checks old-revision
  access, MP4 Range/HLS delivery, captions/poster, progress resumption,
  certificate verification/PDF identity and authorization after recovery.
  Restoring a bundle now invalidates recovered sessions, verification/reset/email
  change links and pending MFA login challenges only in the new copy, atomically.
  The restored manifest records the policy/counts/source hash and its new database
  hash; both source and recovery remain independently verifiable. Focused tests
  cover rollback, preserved credentials/preferences/MFA enrollment and rejection
  of old cookies/links before fresh recovery/login in the real-media HTTP rehearsal.
  Keep open for configuration recovery, post-backup credential/MFA review, off-site
  encryption/retention, and host/device qualification.
- [ ] **OPS-03 — Observability and dashboard operations (local dashboard; telemetry and alert delivery open).**
  Queue/transcode/playback/SMTP/payment/disk metrics, logs without tokens/PII,
  alerts, inspection, and administrative retries. Dependencies: JOB-01, PAY-03.
  Acceptance: operators identify stuck jobs and error causes without inspecting
  secrets; API readiness is not treated as proof that every worker is healthy.
  Local delivery: `/admin/operations` shows persisted worker heartbeats, media job
  states/stalls, outbox and email retry counts, payment states, storage capacity,
  and safe alert codes without payloads or identities. Playback requests are
  aggregated over seven days by resource type and HTTP status class; no course/user
  IDs, IPs, or paths are stored. Migration 094 adds the count and total duration of
  measured responses; the panel displays their weighted average completion time
  and sample count in en/pt-BR/es, excluding unmeasured historical requests.
  The panel now exposes the existing HTTP status-class aggregates (1xx–5xx)
  with explicit zero counts and localized explanations distinguishing requests,
  access denials/missing resources and server errors from viewer/playback counts.
  Loading and failed refreshes are explicit: initial failure hides empty metrics;
  later failures retain the last snapshot with an outdated-data warning and its
  original timestamp. Busy state, focused errors and keyboard retry are covered
  in all three locales; a successful refresh clears the warning.
  This is server response completion, not time to first byte, client download
  completion, playback starts, or buffering. Those metrics and production log
  review remain uninstrumented; alerts are
  visible in the panel but have no external delivery channel. Keep OPS-03 open for
  those metrics and alert-delivery qualification.
  Queue diagnostics now show the number of ready messages and the longest wait
  since `available_at`, using the worker's eligibility rule (unprocessed,
  attempts below five, availability reached, including expired leases).
  Future retries/active leases and exhausted messages are excluded; an empty
  ready queue has an explicit no-ready state, not a measured zero delay.
  This is neither SMTP delivery latency nor an automatic alert threshold.
  Storage measurement failures now raise `STORAGE_UNAVAILABLE` alongside a null
  capacity instead of allowing an apparently alert-free snapshot. The panel
  explains the path/permission checks in en/pt-BR/es without exposing paths or
  raw filesystem errors; successful refresh clears the warning. API tests cover
  read failures and the existing strictly-below-10% low-space boundary;
  focused Chromium tests cover unknown/low/recovered states and keyboard refresh.
  Migration 095 adds daily email-transport outcome/count/duration aggregates.
  The worker records actual valid send attempts, including retries, without
  recipients, content or raw errors. The panel displays seven UTC dates of
  accepted/failed attempts and weighted mean duration in en/pt-BR/es; no samples
  remains explicitly unmeasured. Transport acceptance is not inbox delivery.
  Telemetry write failures log a safe message and do not retry an accepted email.
  Full local regression: 214 tests; build/lint and three focused Chromium
  operations workflows passed. External SMTP delivery qualification remains open.
  Payment reconciliation checks now also record daily safe outcome/count/duration
  aggregates. The seven-day dashboard distinguishes safely reconciled checks
  (including handled pending/canceled states) from provider/settlement failures
  and mismatches, with weighted average duration in all three languages. No order
  identifiers or provider payloads are stored; telemetry write failure does not
  replace the reconciliation result. Remaining gaps include external provider
  latency/health and actual payment/refund settlement monitoring.
- [ ] **OPS-04 — Real capacity on Maia Edge.**
  Define audience/bitrate/upload limits and test host, VPN, and VPS bandwidth,
  disk, and SQLite/FFmpeg concurrency. Dependencies: PLAY-02, OPS-01. Acceptance:
  record scenario, latency, error rate, resource use, and supported limits; if
  capacity is exceeded, enable storage/CDN through the adapter without changing access rights.
- [ ] **OPS-05 — Safe upgrades of the published prototype.**
  Staging environment, backup before migration, artifacts/permissions verified as
  the service user, HTTPS smoke tests, rollback, and host/VPS runbook.
  Dependencies: BASE-02, OPS-01/02. Acceptance: upgrade a representative copy and
  test restoration before publishing; preserve `.env`, accounts, languages, and VPN.
  Exercise Docker and systemd installations, not just their syntax.
- [ ] **SEC-01 — Authorization, abuse, and hostile content (local controls strengthened; full matrix open).**
  Tests for cross-user/author/course access, private/revoked media, Markdown,
  uploads, extraction/transcoding, payment replay, and storage limits.
  Dependencies: corresponding deliveries. Acceptance: no new endpoint bypasses
  policies; hostile test files fail in a controlled way without leaks.
  Verified local slices cover cross-author/media entitlement, revoked and withdrawn
  media, Markdown sanitization, upload signatures/quotas/cleanup, transcoding failures,
  and webhook signature/replay behavior. Production attachment scanning now fails
  closed if ClamAV is disabled; no malware scan can report success in production
  without the scanner. Keep open for the complete hostile corpus and deployment
  qualification.
- [ ] **PRIV-01 — Privacy and self-service.**
  Profile/correction, export, deletion requests, versioned consent, account/media/payment
  retention, and support contact. Dependencies: ADMIN-01, PAY-04, CERT-03.
  Acceptance: traceable requests respect defined retention; public certificate
  lookups expose only consented data. Legal review is an external dependency, not
  a claim that compliance has already been achieved.
  Local delivery: authenticated JSON export is scoped to the account's profile,
  enrollments/progress/quiz answers, entitlements, orders/refunds, certificates and
  owned media metadata; it excludes password hashes, session/email tokens and storage
  keys. Export and request endpoints have a dedicated rate limit. Users can create
  and view an idempotent deletion request. Administrators now have a searchable,
  status-filtered, paginated queue at `/admin/privacy`, with private notes and
  actor-attributed append-only review history. Review atomically moves OPEN to
  IN_REVIEW, which the requester sees in their own language; notes remain admin-only.
  Failed saves and language switches preserve unsaved notes in page memory.
  No account data is deleted, and review does not close or fulfill the request.
  The self-service export now includes the account's historical and pending email
  change requests with target address and lifecycle timestamps, while excluding
  token hashes and other accounts' requests. API/OpenAPI and privacy documentation
  describe this addition; cross-account and secret-exclusion tests cover it.
  The export also includes course/revision/lesson placement plus display metadata
  for the requester's own uploads attached to courses they author, excluding other
  accounts' attachment relationships.
  Export sections are read in one deferred SQLite transaction to provide a
  consistent snapshot while allowing concurrent account writes.
  Keep PRIV-01 open for retention/legal policy, support contact, resolution and export
  completeness review.
- [ ] **UX-01 — Accessibility and real usage states (form-error feedback improved; full audit open).**
  Keyboard/focus, screen readers, contrast, zoom/mobile, captions, error messages,
  skeleton/loading and empty states; test all three languages. Dependencies:
  EDIT-03, PLAY-03, HOME-03, I18N-01. Acceptance: publish and watch without a mouse;
  player, editor, and forms retain context when errors occur.
  Local delivery: application errors announce as assertive alerts and receive focus;
  successful notices remain polite status messages. E2E verifies translated login
  errors and focus in en/pt-BR/es while retaining form input. Privacy-request
  searches/pagination and saved reviews restore a useful keyboard focus;
  failed list/history loads offer keyboard-operable retry with busy/live states,
  preserving unsaved notes. Focused Chromium coverage checks failure/retry and
  focus recovery. Keep open for contrast,
  zoom/mobile, captions, and the full author/learner workflow audit.
- [ ] **SEO-01 — Indexable public pages (public SSR delivered locally; qualification open).**
  Useful server-rendered content, per-course title/description, canonical URLs,
  sitemap, Open Graph/covers, and locale; prevent indexing of private areas.
  Dependencies: HOME-02/03, I18N-02. Acceptance: initial HTML for a published course
  contains its presentation; crawlers do not receive only the original generic shell.
  Local delivery: course, home, and catalog pages server-render localized metadata
  and public content; course pages include canonical/Open Graph cover metadata.
  `robots.txt` and `sitemap.xml` include only public courses; private/admin/auth
  pages are `noindex`. Instructor profiles now server-render escaped public
  biographies and published courses with canonical/Open Graph metadata and
  appear in the sitemap only when opted in. Initial HTML now shares the browser
  translation catalog for navigation, language selection, footer, empty states,
  noscript instructions and fallback metadata in en/pt-BR/es. Focused HTTP tests
  cover all four public page types; Chromium checks home/catalog without
  JavaScript. Full local regression: 206 tests; build/lint and three focused
  Chromium workflows passed. Keep SEO-01 open for full crawler
  validation and the remaining public-page coverage.
- [ ] **QA-01 — Complete product test suite and demonstration (current Chromium report recorded; cross-browser open).**
  Extend HTTP, database, job, and browser tests to all workflows below, including
  Chrome/Firefox/Safari and mobile where applicable. Dependencies: all P0/P1
  deliveries. Acceptance: new reports per version; the original English article
  test does not establish acceptance for video, editor, languages, checkout, or certificates.
  Local report, October 23, 2026: `VIDEO_TEST_REAL=1 npm test` passed all 186
  tests across 63 files; build and lint passed. The focused Chromium operations
  workflow passed, including measured/unmeasured durations and all three locales.
  Earlier complete Chromium and WebKit runs each passed all 35 workflows,
  including real video and 360×780 checks; these are not new full-suite runs. Firefox
  full-suite attempts remain intermittent: the October 22 run passed 34/35,
  with one `page.goto` timeout waiting for the `load` event; the course-withdrawal
  workflow passed in isolation. The real-video workflow and its enrollment
  response assertion also passed in a focused run. E2E now accepts
  `E2E_PORT` so browser qualification can use a separate fixture server without
  disturbing the user's local instance. Three full Firefox reruns on October 23
  each passed 34/35, but the lone 30-second navigation timeout moved between
  workflows; the affected workflows pass in isolation. Do not treat a per-test
  navigation workaround as a fix for this suite-wide intermittency. Keep Firefox
  qualification open until a clean full run passes. The WebKit blockers were
  resolved locally: omit
  `upgrade-insecure-requests` outside
  production, initiate preview playback with the video scrolled into view, and
  wait for logout redirects before navigating. Physical-device qualification
  remains open; no deployment or host changes were made.
- [ ] **DOC-01 — Keep contracts and operations aligned with implementation.**
  Update OpenAPI, data model, installation/configuration, author/learner/admin
  manuals, limits, and recovery procedures with every delivery. Dependency:
  cross-cutting. Acceptance: implemented API and future plans are separate;
  runnable examples do not depend on default credentials or omitted steps.
  Local delivery: updated the data model for migrations 089–092, privacy semantics,
  production scanner behavior, worker/playback dashboard limits, SEO metadata, and
  validation results. `spec/openapi.yaml` now documents HLS playback plus the new
  operational and privacy endpoints; the future design remains separate in
  `planned-openapi.yaml`.
  The implemented contract is still incomplete, and installation, recovery,
  author/learner/admin manuals and cross-document review need a full pass. Keep
  DOC-01 open.

## Sequence of demonstrable deliveries

| Delivery | Core items | Required demonstration |
|---|---|---|
| E1 — Usable authoring and editorial homepage | BASE, EDIT-01–04, HOME-01, cross-cutting I18N | Format/reopen a lesson; edit while keeping publication live; select and order highlights |
| E2 — Complete free video course | MEDIA, JOB, PLAY, EDIT-05, HOME-02/03, OPS-01 | Upload real video, monitor processing, publish with captions, and play/resume through the public domain |
| E3 — Management and assessment | ADMIN, AUTH, I18N-02, QUIZ, LEARN, relevant DATA | Administrator delegates authorship; learner takes an assessment; completion calculated on the server |
| E4 — Commerce and credentials | PAY, CERT, relevant DATA | Sandbox purchase, confirmation, access, completion, PDF/QR, refund, and revocation |
| E5 — Validation and full launch | OPS-02–05, SEC, PRIV, UX, SEO, QA, DOC | Restoration, load, accessibility, three languages, and upgrade of the existing installation |

Security, migration, and i18n accompany every delivery; E5 consolidates rehearsals
rather than introducing these concerns for the first time. E2 makes the product
usable for free video courses but does not complete the full P0/P1 scope.

## Final product acceptance test

- [ ] Administrator creates an author and configures editorial homepage selection.
- [ ] Author creates a course with cover/objectives, reorderable modules, Markdown,
  video, captions, and supplementary materials (PDF, ZIP, and source code) with
  descriptions; interrupts/resumes an upload and fixes a processing error.
- [ ] Author prepares a new revision while the old publication remains accessible.
- [ ] Visitor finds a course through search/filters and watches only permitted previews.
- [ ] Learner registers, verifies email, enrolls or pays, watches on desktop/mobile,
  resumes position, takes an assessment, and receives a certificate according to policy.
- [ ] No media URL or browser response grants access to an unauthorized user.
- [ ] Administrator checks an order, refunds/revokes, and verifies effects on access and certificates.
- [ ] Switching among English/Portuguese/Spanish preserves drafts and translates the entire workflow.
- [ ] Operator recovers from worker failure and restores database/media into another working installation.
- [ ] The entire journey above works at `learn.maiaplatform.org`, beyond local tests.

## P2 — recorded extensions that do not block the core

- [ ] **EXT-01:** PayPal and other providers after stabilizing the payment contract.
- [ ] **EXT-02:** Coupons and commercial campaigns with pricing policy and auditing.
- [ ] **EXT-03:** Per-course assistant through Maia Chat/RAG with restricted access and references.
- [ ] **EXT-04:** Automatic caption generation/translation with human review.

Marketplace, split payments between sellers, SCORM, native apps, proctoring, and
promised DRM remain outside the scope defined in [product](docs/01-product.md).
They are not prerequisites for completing the requested single-publisher platform.

## External parameters to define before publishing the corresponding stages

Peak viewers and available bandwidth; video size/duration; limits and original-file
retention; seller identity/account; price/currency; access duration and partial
refunds; workload and certificate wording; SMTP; privacy policy and support owners.
Editor, upload, player, and homepage development need not wait for these commercial
decisions. Estimate schedules per delivery after validating the pipeline with real
files; existing table counts alone cannot provide a reliable completion percentage.
