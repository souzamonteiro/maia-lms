# Data model and invariants

SQLite stores UUIDs as TEXT, UTC timestamps as TEXT (ISO 8601 or SQLite datetime defaults), JSON as TEXT, booleans as INTEGER 0/1; money in integer minor units and ISO currency; immutable ledger-style billing records. Use case-insensitive normalized email uniqueness while preserving display spelling. Add indexes for foreign keys, course slug/visibility, enrollment user/course, events provider/event, and progress enrollment/lesson.

| Table | Principal fields | Constraints |
|---|---|---|
| users | id, email, display_name, password_hash, verified_at, status, locale, session_version | unique normalized email; private display name; no plaintext credentials |
| http_sessions | sid, data, expires_at | SQLite session store; expires_at in Unix milliseconds; signed cookie rotated on login |
| sessions | original reserved schema | not used by the runtime |
| courses | id, slug, access_mode, status, locale, author_id, current_revision_id, published_revision_id | unique slug; revision pointers must reference revisions owned by this course; controlled transitions |
| course_revisions | id, course_id, title, summary, slug, access_mode, locale, learning_outcomes, policy_json, cover_file_id, trailer_video_id, published_at | immutable once published; cover/trailer uploads belong to course and match media kind |
| modules | id, revision_id, sort_order, title | unique revision/order |
| lessons | id, module_id, title, sort_order, kind, video_id, body, content_format, is_required, is_preview | unique module/order; video must belong to revision's course and have video media kind; preview explicit |
| course_attachments | id, revision_id, lesson_id?, upload_id, title, description, sort_order | upload must be an attachment belonging to revision's course; optional lesson must belong to revision; unique position within each revision/lesson list |
| assets | id, owner_id, kind, storage_key, status, metadata_json | private key; controlled processing |
| prices | id, course_id, currency, amount_minor, active_from, active_to | order snapshots price; historical rows retained |
| enrollments | id, user_id, course_id, revision_id, state, enrolled_at | unique user/course; assignment immutable; revision must belong to course; entitlement not inferred from row alone |
| entitlements | id, enrollment_id, source_type, source_id, starts_at, ends_at, revoked_at | order source must match enrollment user/course; active access derived from interval/revocation |
| lesson_progress | enrollment_id, lesson_id, position_seconds, completed_at | unique enrollment/lesson; non-negative integer position; triggers preserve lesson/enrollment revision agreement |
| quizzes | id, revision_id, lesson_id?, pass_percent, max_attempts, time_limit_seconds? | integer pass percent 1–100; positive integer attempt limit; optional positive integer time limit; one final quiz per revision; settings freeze when attempts exist |
| questions | id, quiz_id, prompt, choices_json, correct_choice_keys, points, sort_order | positive integer points; non-negative integer unique sort position; definition freezes when attempts exist; answer keys never returned with public payload |
| attempts | id, enrollment_id, quiz_id, revision_id, started_at, submitted_at, score, pass | enrollment, quiz, and attempt revisions agree; max_attempts enforced per enrollment/quiz; submitted rows immutable; API flow/grading still require QUIZ-02 |
| attempt_answers | attempt_id, question_id, selected_keys, awarded_points | question belongs to attempt quiz; awarded points are an integer from zero to question points; answer rows freeze on submission; score calculation still requires QUIZ-02 |
| orders | id, user_id, course_id, price_snapshot, currency, provider, state, idempotency_key, provider_checkout_id | positive integer price; immutable commercial snapshot; checkout ID unique per provider; lifecycle transitions constrained |
| provider_payments | id, order_id, provider_payment_id, state, raw_ref | provider payment ID unique within provider |
| webhook_events | id, provider, external_event_id, payload_hash, processed_at, status | unique provider/event ID |
| refunds | id, order_id, provider_ref, amount_minor, status | provider refund ID unique within provider; positive integer amount; pending+approved total capped at order snapshot |
| certificates | id, enrollment_id, supersedes_id?, public_code, confirmed_name, payload_hash, issued_at, revoked_at, reason | supersession links a revoked prior certificate from same enrollment; public code at least 32 characters; unique code; one active per enrollment; revocation reason required; snapshot immutable; history retained |
| promotions | id, slot, course_id, starts_at, ends_at, priority | bounded placement, audited |
| home_settings | id=1, version | optimistic concurrency for editorial changes |
| audit_events | id, actor_id, action, subject_type, subject_id, occurred_at, metadata | append-only privileged actions |
| outbox | id, event_type, payload, available_at, processed_at, attempts, lease_token | retryable async work |

Published course revisions bind a consistent set of modules, lessons, quiz and certificate policy. Enrollment stores assigned revision; course pages may show latest. Future revisions require an explicit migration policy for existing learners. Certificate snapshot includes canonical learner name, title, workload, completion and issuer; subsequent profile edits do not silently rewrite history.

## Critical transaction boundaries

- Free enrollment: unique user/course row and entitlement in one transaction.
- Verified paid capture: lock order, transition monotically, create/reuse enrollment and entitlement, append audit/outbox in one transaction.
- Quiz submit: lock attempt; score against server-side answer snapshot; finalize once.
- Certificate issue: lock enrollment, verify progress and passing attempt, ensure unique issued record, queue PDF generation.
- Refund: record provider result, revoke or adjust entitlement by policy and audit, never delete billing history.

Use SQL constraints plus domain checks; reject inconsistent cross-course references. Migrations 017–030 add revision, media, progress, assessment, order, and provider-reference integrity checks; these do not implement quiz grading or checkout/refund policy. Migration 031 limits each enrollment to one non-revoked certificate and allows reissue after revocation. It does not repair pre-existing duplicate active certificates. Migration 032 blocks audit-event updates and deletes; retention/anonymization still requires an explicit policy and process. Migration 033 caps pending plus approved refunds at the order's price snapshot; rejected refunds do not reserve the cap. This is not reconciliation against provider-captured funds. Migration 034 ensures non-null checkout references are unique within a provider while allowing multiple orders without a checkout ID. It does not validate the provider contract. Migration 035 restricts order state transitions to the documented lifecycle and allows a late authoritative payment confirmation to move an expired/canceled order to paid. It does not perform provider reconciliation. Migration 036 freezes attempt rows and their answers after submission; migration 037 freezes quiz settings and questions once attempts exist. Migration 038 validates integer quiz thresholds/limits, question points/order, and per-question awarded-point bounds. Migration 039 enforces the attempt cap per enrollment/quiz and prevents deleting attempts to regain quota. Migration 040 supports an optional positive time limit per quiz, derives the deadline from immutable `started_at`, and rejects answer writes and submission after expiry. Migration 041 freezes enrollment identity/course/revision assignment, and migration 042 freezes module/lesson structure for any revision assigned to learners. Editing enrolled content must create a new revision; migrating existing learners to it requires an explicit policy. These constraints still do not implement API attempt start, grading semantics, or expired-result handling. Treat other deletions as policy-driven retention tasks and preserve legally required transaction evidence.

Migration 041 makes enrollment ownership, course, and assigned revision immutable
after creation while leaving `state` mutable for access revocation. Migration 042
blocks module/lesson inserts, updates, and deletes in revisions already assigned to
learners; authoring must create a new revision. Moving existing learners to a newer
revision requires a future explicit migration policy and workflow.

Migration 043 makes an issued certificate's identity, code, payload hash, and
issue time immutable, and prevents deleting certificate history. Revocation time
and reason remain mutable for administrative revocation records; reissuance creates
a new certificate after revoking the old one.

Migration 045 requires a non-empty reason when a certificate is marked revoked.
Migration 046 requires revocation time to be at or after issuance, prevents
clearing it or moving it backward, and allows later timestamps. Neither migration
records which administrator performed the action or replaces an audited
revocation workflow.

Migration 047 adds an optional immutable supersession link from a replacement
certificate to a revoked predecessor for the same enrollment; a predecessor can
have at most one direct successor. This stores lineage but does not implement the
reissue UI or public history view.

Migration 044 rejects new or updated public codes shorter than 32 characters; this
is only a minimum-length safeguard, not proof that code generation is random or
unpredictable. Random code generation, rate-limited public verification, and
asynchronous private PDF/QR generation are implemented; the learner's certificate
screen remains separate CERT-02 work.

## Implementation boundary

The runtime currently uses users, http_sessions, email_tokens, courses, course_revisions, modules, lessons, enrollments, entitlements, lesson_progress, promotions, home_settings, audit_events and outbox. Other tables reserve the planned product model; their presence is not evidence of implemented payment, quiz or certificate flows. The invariants for those extensions above must be implemented and tested before exposing their endpoints. SQLite does not support row-level `FOR UPDATE`; use short `IMMEDIATE` transactions and database constraints.

Migration 002 adds lesson titles, session versioning and the actual session store; migration 003 adds worker lease tokens. Never modify an applied migration to upgrade an existing database. Migration 004 adds separate editable/public revision pointers, revision metadata snapshots, plain/markdown content format and home concurrency state. Course edits create a new editable revision without changing published status or metadata; publication atomically promotes that revision. Existing enrollments keep their revision and entitlement. Legacy content defaults to plain and is never implicitly interpreted as Markdown. Archiving closes public discovery/enrollment while preserving existing access.

Migration 049 adds `courses.withdrawn_at` and `withdrawal_reason` for urgent withdrawal, distinct from `ARCHIVED`. The marker/reason are immutable after setting and require a nonblank reason; the API records the actor and reason in append-only audit history. Authorization is rechecked against the marker at course, lesson, video, caption, cover, attachment, grant, and progress-write routes. Withdrawal preserves the enrollment, entitlement, and lesson-progress rows while preventing those entitlements from authorizing further learner access.

Migration 050 adds optional `questions.explanation` text, defaulting to empty for existing quiz definitions. It belongs to the revision-bound immutable question snapshot and is returned only with submitted-attempt feedback; active quiz and attempt payloads omit explanations and correctness markers.

Migration 051 adds monotonic `enrollments.completed_at`. Migration 052 adds immutable JSON snapshots of required lesson IDs and quiz IDs to each enrollment, backfilling existing enrollments from their assigned revision. New free or admin-granted enrollments capture the lists transactionally. Migration 053 backfills `completed_at` for legacy enrollments only if those snapshots are satisfied and active access remains. Completion readiness uses the snapshots rather than later revision definitions: there must be at least one required lesson, each snapshotted lesson must be complete, every snapshotted quiz must have a passing attempt, and entitlement must currently be active on a non-withdrawn course. Progress writes and quiz submissions reevaluate the policy in their immediate transaction. The completion timestamp remains historical if access is later revoked; `completion_ready` separately reflects current access. Migration 054 adds an immutable JSON certificate payload, reviewed disclosure hash/version, and consent timestamp for newly issued records; legacy certificate rows are not backfilled with invented consent or snapshots. Issuance snapshots learner name, assigned-revision title/slug, publisher-declared workload minutes, instructor name as issuer, completion time, issue time, code, and valid status.

Migration 055 adds certificate PDF state (`UNAVAILABLE`, `PENDING`, `READY`, `FAILED`), private storage key, and non-sensitive processing error. Historical certificates remain `UNAVAILABLE`; new issuance queues `certificate.generate` in the same transaction as the certificate and audit record. The worker creates a PDF/QR at a deterministic private key, and retries reuse an already-written artifact. Only the certificate owner or an administrator can download a `READY` artifact; public verification continues to expose the immutable data snapshot, never the PDF or private processing state.

Migration 056 constrains assessment attempt result shape: open attempts require `score` and `pass` to remain null; submitted attempts require an integer score percentage in 0–100 and an integer pass flag in {0,1}. This complements submitted-row immutability by preventing invalid result states at insert/update time, including direct SQL writes.

Migration 057 protects outbox processing state: retry count must remain a non-negative integer; a lease requires an unprocessed job and at least one claim; and a processed job cannot retain a lease. Normal worker claim, retry release, and completion transitions remain valid.

Migration 060 makes outbox lifecycle monotonic: attempts cannot decrease, acquiring/replacing a lease advances exactly one attempt, a lease can only be released with a failure or completion recorded, and `processed_at` cannot be cleared or rewritten. This prevents SQL-level job reopening, lease theft, and completion without a claimed worker.

Migration 058 requires entitlement `starts_at` to be parseable and, when present, `ends_at` to be parseable and strictly later. Open-ended grants remain valid; malformed, zero-length, or reversed windows cannot be inserted or updated.

Migration 059 constrains upload status changes to `UPLOADING → QUEUED/CANCELLED`, `QUEUED → PROCESSING`, `PROCESSING → READY/FAILED` (including same-state lease recovery), and `FAILED → QUEUED` retry. Idempotent same-state writes are allowed; READY and CANCELLED are terminal. Fixture setup and test updates follow this worker/API lifecycle.

Migrations 061 and 062 prevent deleting or changing the ID of a course revision
while it is referenced by either `current_revision_id` or
`published_revision_id`. This protects the legacy current pointer, which has no
foreign-key constraint, from becoming orphaned through direct SQL. Revisions can
still be deleted after both pointers are cleared, subject to their other references.

Migration 063 makes published revision rows immutable and rejects inserts already
marked published. Publication may set `published_at` only after the course points
to the revision, matching the API transaction order. Migration 064 freezes modules,
lessons, attachments, category assignments, quizzes, and questions while a revision
has been published; new draft revisions remain editable.

Migration 065 requires every non-null `courses.published_revision_id` to reference
a same-course revision whose `published_at` is set. The API marks the validated
revision published before switching the pointer, within one transaction, so the
public catalog cannot be redirected to an unpublished draft through direct SQL.

Migration 066 prevents updating or deleting a video upload referenced by published
revision content, including lesson video, cover, trailer, and attachment links. This
keeps artifact keys and media metadata stable after publication; uploads for drafts
remain mutable through the processing lifecycle.

Migration 067 requires a course with status `PUBLISHED` to have a non-null public
revision pointer to a same-course revision with `published_at` set. This applies to
inserts and status/pointer changes; archiving or drafting may retain the historical
published pointer.

Migration 071 makes an entitlement's enrollment, source type, and source ID
immutable after creation. This prevents an order-backed grant from being relabeled
as a free/admin grant or detached from its order through direct SQL. Access-window
and revocation fields remain mutable under their own invariants.

Migration 072 makes `courses.author_id` immutable after course creation. Ownership
transfer is not an exposed API workflow; direct SQL cannot silently transfer
authoring rights to another account.

Migration 073 requires a newly inserted certificate to start active. A revoked
state can only be reached by updating an issued certificate through the existing
reason-required, timestamp-monotonic revocation guards.

Migration 074 requires certificate `issued_at` and any non-null `revoked_at` to be
parseable SQLite timestamps, preventing malformed strings from bypassing chronology
checks through `julianday()` returning `NULL`.

Migration 075 requires each new certificate payload to be a JSON object with
non-empty learner/course/instructor text, positive integer workload, parseable
completion and issuance timestamps, `status: "valid"`, and `publicCode` matching
the certificate's indexed code. This keeps the immutable snapshot usable by public
verification and downstream PDF generation.

Migration 076 requires the payload's `confirmedName` and `issuedAt` to equal the
certificate row's immutable `confirmed_name` and `issued_at`, preventing public,
administrative, and PDF views from disagreeing about identity or issuance time.

Migration 077 requires payload `courseTitle`, `workloadMinutes`, `issuerName`, and
`completedAt` to match the enrollment's assigned revision and completion record.
This prevents direct SQL from issuing a validly shaped but forged certificate
snapshot for a different course, workload, instructor, or completion date.

Migration 068 enforces the course state machine at the database boundary: `DRAFT`
may move to `REVIEW`, `PUBLISHED`, or `ARCHIVED`; `REVIEW` may move to `PUBLISHED`
or `ARCHIVED`; `PUBLISHED` may move to `ARCHIVED`; and `ARCHIVED` is terminal.
Idempotent same-state writes remain valid. This matches the API's review, publish,
and archive actions and rejects direct-SQL unpublishing or resurrection.

Migration 069 allows an urgent withdrawal marker only when the course is
`PUBLISHED` or `ARCHIVED` and its public pointer references a same-course revision
with `published_at` set. The withdrawal reason remains mandatory and the marker
remains immutable under migration 049.

Migration 070 rejects new enrollment rows for `REVIEW`, `ARCHIVED`, and urgently
withdrawn courses. For `PUBLISHED` courses, the enrollment revision must equal the
valid public revision pointer. Existing enrollment rows remain intact when a
course is withdrawn.

Migration 051 adds monotonic `enrollments.completed_at`. Server completion policy is derived from the enrollment's immutable revision: at least one required lesson, every required lesson completed, every quiz in that revision passed by this enrollment, and active entitlement on a non-withdrawn course. Progress writes and quiz submissions reevaluate in their immediate transaction. Access withdrawal does not erase completion history; current entitlement remains a separate eligibility check for any future certificate issuance.

## MP4 video — migration 005

`video_uploads` records owner/course, reserved size, offset, status, output/poster,
duration, and processing lease/heartbeat. `video_chunks` records offset, size,
private key, and SHA-256; the upload/offset combination is unique. `lessons.video_id`
associates each revision with its video without reusing the reserved `assets` records.
The API prevents cross-course relationships and publication without READY video.
`kind` is derived from text/video as article, mixed, or video. The video queue is
independent of the outbox.

## Materials — migration 006

`video_uploads.media_kind` distinguishes videos from attachments (legacy records use video).
`course_attachments` links a file, revision, and optional lesson, with its own title,
description, and order. Metadata and relationships are copied to new revisions;
files are immutable. The API checks upload type and course, and READY status on publication.

## Captions — migration 007

`lessons.captions_json` stores up to three tracks (language, label, vtt), defaulting to `[]`.
The API validates format, size, and language uniqueness before creating a revision.
Transcripts are derived from valid cue blocks and do not alter the original content.

## Rendering policy — migration 008

`lessons.render_policy_version` is a positive integer, defaulting to 1 for existing
lessons. The server writes its current policy on new revisions and dispatches
lesson rendering by the stored version. Bodies and enrollment revision references
are unchanged. Unsupported versions fail closed; clients cannot choose a policy.

## Upload activity — migration 009

`video_uploads.last_activity_at` stores the last committed chunk time. An insert
trigger initializes it; migration initializes existing rows at upgrade time.
An index supports inactive-upload selection. The worker marks unreferenced
UPLOADING uploads CANCELLED with `error=UPLOAD_EXPIRED` after seven inactive days.
Upload rows remain for history; registered chunks are removed after successful
file deletion. This does not affect completed media or course revision references.

## Course covers — migration 010

`course_revisions.cover_file_id` optionally references a PNG/JPEG attachment upload;
`cover_alt` stores alternative text with default empty string. Existing courses have
no cover. The relationship is indexed and copied by incremental revision saves.
Publication validates course ownership, media type, readiness, and nonblank alt text.
Upload expiration excludes every image referenced by a revision's cover.

## Presentation metadata — migration 011

Migration 011 adds `course_revisions.prerequisites` with an empty-string default.
The existing `learning_outcomes`, `level`, and `duration_minutes` fields now support
the authoring and learner-facing flows. API inputs use `learningOutcomes`,
`prerequisites`, `level`, and `durationMinutes`; responses retain database field
names. All fields are revision-bound. Blank workload and level are stored as NULL;
no synthetic workload is inferred from video duration.

## Instructor and terms — migration 012

`course_revisions` adds `instructor_name`, `instructor_bio`, `access_terms`, and
`certificate_terms`, all non-null TEXT with empty defaults. API inputs use camelCase;
responses use these column names. Full and incremental saves copy them into the
new revision. They are presentation metadata, not authorization or certificate
policy. Existing courses gain no instructor claims or certificate promises.

## Course trailers — migration 013

`course_revisions.trailer_video_id` optionally references `video_uploads` and is
indexed. The reserved legacy `trailer_media_id` is unchanged and not used by this
workflow. API inputs use `trailerVideoId`; responses use `trailer_video_id`. New
revisions copy the reference, publication requires a same-course READY video, and
upload expiration protects any revision reference. Existing courses have no trailer.

## Course categories — migration 014

`categories` stores global `id`, unique `slug`, `name`, `description`, and integer
`version` (initially 1). Updates compare `expectedVersion` within an immediate
transaction and increment it; stale edits/deletions return CATEGORY_CONFLICT.

`course_revision_categories` joins revisions and categories with a composite primary
key and a category/revision lookup index. Revision deletion cascades to assignments;
category deletion is restricted while any revision references it. Existing courses
start without categories; their content and enrollment references are unchanged.
Course inputs accept up to ten unique `categoryIds`; detail and preview responses
expose `categories` objects. Incremental saves copy unchanged assignments. Catalog
filtering uses only `published_revision_id`, while enrolled learners retain their
assigned revision's associations. Category names/slugs are global metadata, not
revision snapshots, and updates to them apply immediately.

## Private account display name — migration 016

Migration 016 adds `users.display_name TEXT NOT NULL DEFAULT ''`; existing accounts
retain their identity, sessions, enrollments, and progress. `PUT /api/v1/auth/profile`
updates only the authenticated user's value, trims surrounding whitespace, and
accepts 1–100 characters. `GET /api/v1/auth/me` returns it. The field is private
account data, not a public instructor profile or course instructor presentation.

## Translation and operations integrity — migrations 089–090

Migration 089 validates course revision `translations_json` on insert and updates
that change locale or translations. Entries must be supported-locale objects, differ
from the source locale, use unique locales and keys, contain only known metadata
fields, and satisfy the API field bounds. Invalid direct-SQL writes are rejected.

Migration 090 adds `worker_instances`, keyed by a random process instance ID, with
start, heartbeat, and stop timestamps. Worker processes refresh every ten seconds;
the operations dashboard treats heartbeats older than 45 seconds as stale. This is
process liveness, not proof that SMTP, payments, or playback are healthy.

## Account privacy requests — migration 091

`account_privacy_requests` records an authenticated user's deletion request and
status. A partial unique index allows only one OPEN/IN_REVIEW request per account.
The self-service API is idempotent and leaves the account active; this table does
not delete user data or define retention, legal review, or request-resolution policy.

## Playback aggregates — migration 092

`playback_metrics_daily` stores counts by UTC date, resource type, and HTTP status
class. The application records MP4, poster, caption, HLS playlist, and HLS segment
requests after responses finish. It stores no URL/path, course or lesson ID, user ID,
IP address, or payload. The dashboard reports a seven-day window. These are request
counts only; they do not measure playback starts, buffering, latency, or watch time.
