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
unpredictable. Generation, rate limiting, and public verification remain separate
CERT-02 work.

## Implementation boundary

The runtime currently uses users, http_sessions, email_tokens, courses, course_revisions, modules, lessons, enrollments, entitlements, lesson_progress, promotions, home_settings, audit_events and outbox. Other tables reserve the planned product model; their presence is not evidence of implemented payment, quiz or certificate flows. The invariants for those extensions above must be implemented and tested before exposing their endpoints. SQLite does not support row-level `FOR UPDATE`; use short `IMMEDIATE` transactions and database constraints.

Migration 002 adds lesson titles, session versioning and the actual session store; migration 003 adds worker lease tokens. Never modify an applied migration to upgrade an existing database. Migration 004 adds separate editable/public revision pointers, revision metadata snapshots, plain/markdown content format and home concurrency state. Course edits create a new editable revision without changing published status or metadata; publication atomically promotes that revision. Existing enrollments keep their revision and entitlement. Legacy content defaults to plain and is never implicitly interpreted as Markdown. Archiving closes public discovery/enrollment while preserving existing access.

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
