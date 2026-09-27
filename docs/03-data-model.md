# Data model and invariants

SQLite stores UUIDs as TEXT, UTC timestamps as TEXT (ISO 8601 or SQLite datetime defaults), JSON as TEXT, booleans as INTEGER 0/1; money in integer minor units and ISO currency; immutable ledger-style billing records. Use case-insensitive normalized email uniqueness while preserving display spelling. Add indexes for foreign keys, course slug/visibility, enrollment user/course, events provider/event, and progress enrollment/lesson.

| Table | Principal fields | Constraints |
|---|---|---|
| users | id, email, password_hash, verified_at, status, locale, session_version | unique normalized email; no plaintext credentials |
| http_sessions | sid, data, expires_at | SQLite session store; expires_at in Unix milliseconds; signed cookie rotated on login |
| sessions | original reserved schema | not used by the runtime |
| courses | id, slug, access_mode, status, locale, author_id, current_revision_id | unique slug; controlled transitions |
| course_revisions | id, course_id, title, summary, learning_outcomes, policy_json, published_at | immutable once published |
| modules | id, revision_id, sort_order, title | unique revision/order |
| lessons | id, module_id, title, sort_order, kind, media_id, body, is_required, is_preview | unique module/order; preview explicit |
| assets | id, owner_id, kind, storage_key, status, metadata_json | private key; controlled processing |
| prices | id, course_id, currency, amount_minor, active_from, active_to | order snapshots price; historical rows retained |
| enrollments | id, user_id, course_id, revision_id, state, enrolled_at | unique user/course; entitlement not inferred from row alone |
| entitlements | id, enrollment_id, source_type, source_id, starts_at, ends_at, revoked_at | active access derived from interval/revocation |
| lesson_progress | enrollment_id, lesson_id, position_seconds, completed_at | unique enrollment/lesson |
| quizzes | id, revision_id, lesson_id?, pass_percent, max_attempts | one final quiz per revision |
| questions | id, quiz_id, prompt, choices_json, correct_choice_keys, points | answer keys never returned with public payload |
| attempts | id, enrollment_id, quiz_id, revision_id, started_at, submitted_at, score, pass | attempts bounded, immutable submission |
| attempt_answers | attempt_id, question_id, selected_keys, awarded_points | score calculated on server |
| orders | id, user_id, course_id, price_snapshot, currency, provider, state, idempotency_key | immutable amount/owner/course |
| provider_payments | id, order_id, provider_payment_id, state, raw_ref | unique provider/payment ID |
| webhook_events | id, provider, external_event_id, payload_hash, processed_at, status | unique provider/event ID |
| refunds | id, order_id, provider_ref, amount_minor, status | audit partial/full outcomes |
| certificates | id, enrollment_id, public_code, payload_hash, issued_at, revoked_at, reason | unique code; one active per completion policy |
| promotions | id, slot, course_id, starts_at, ends_at, priority | bounded placement, audited |
| audit_events | id, actor_id, action, subject_type, subject_id, occurred_at, metadata | append-only privileged actions |
| outbox | id, event_type, payload, available_at, processed_at, attempts, lease_token | retryable async work |

Published course revisions bind a consistent set of modules, lessons, quiz and certificate policy. Enrollment stores assigned revision; course pages may show latest. Future revisions require an explicit migration policy for existing learners. Certificate snapshot includes canonical learner name, title, workload, completion and issuer; subsequent profile edits do not silently rewrite history.

## Critical transaction boundaries

- Free enrollment: unique user/course row and entitlement in one transaction.
- Verified paid capture: lock order, transition monotically, create/reuse enrollment and entitlement, append audit/outbox in one transaction.
- Quiz submit: lock attempt; score against server-side answer snapshot; finalize once.
- Certificate issue: lock enrollment, verify progress and passing attempt, ensure unique issued record, queue PDF generation.
- Refund: record provider result, revoke or adjust entitlement by policy and audit, never delete billing history.

Use SQL constraints plus domain checks; reject inconsistent cross-course lesson references. Treat deletions as policy-driven retention/anonymization tasks and preserve legally required transaction evidence.

## Implementation boundary

The runtime currently uses users, http_sessions, email_tokens, courses, course_revisions, modules, lessons, enrollments, entitlements, lesson_progress, audit_events and outbox. Other tables reserve the planned product model; their presence is not evidence of implemented payment, quiz or certificate flows. The invariants for those extensions above must be implemented and tested before exposing their endpoints. SQLite does not support row-level `FOR UPDATE`; use short `IMMEDIATE` transactions and database constraints.

Migration 002 adds lesson titles, session versioning and the actual session store; migration 003 adds worker lease tokens. Never modify an applied migration to upgrade an existing database. Course edits create a new revision and mark the course DRAFT; existing enrollments keep their revision and entitlement. Archiving closes public discovery/enrollment while preserving existing access.
