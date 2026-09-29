# Product specification

> **Initial MVP status:** this document records requirements for the complete product. The initial MVP delivered free text courses, identity, enrollment, and progress. Video, commerce, quizzes, certificates, MFA, and privacy requests still required implementation at that stage. See [the roadmap](09-roadmap.md) for subsequent deliveries.

## Audience and promise

Learners discover practical courses built around working Maia software. The publisher records with Maia capture tools, edits in Maia Reel, publishes in Maia LMS, and may attach a Maia Chat/RAG assistant grounded in that course's approved materials. Course pages also link to relevant Maia projects and consulting contact points with clear labeling.

## Roles

- Visitor: browse/search and access OPEN_FREE content or designated previews.
- Learner: manage account, enroll, pay, study, submit attempts, receive certificates, request data export/deletion.
- Author: create and edit owned courses, lessons, quizzes, media and landing-page content; submit for publication.
- Admin: publish/unpublish, feature/promote, manage refunds/access, verify processing failures, audit actions.
- Worker: process media, notifications and certificates via narrowly scoped service credentials.

One publisher organization owns sales in v1. Author does not have access to payment secrets or another author's drafts. Promotions are editorial placements, not fabricated rankings.

## Domain and workflows

Course → ordered modules → ordered lessons. Lesson kinds are video, article, or mixed; each may include sanitized Markdown content, attachments and optional formative quiz. A course may have a final graded quiz. A published revision is stable for active learners: edits create drafts and publishing records a new revision. Keep quiz/certificate policy snapshots for completed attempts.

Lifecycle: DRAFT → REVIEW → PUBLISHED → ARCHIVED. Publishing requires title, slug, locale, summary, image alt text, valid lesson order, approved media readiness, access mode, and (if PAID) valid price/currency. Archived courses keep enrolled learner access by explicit policy; default is access retained, sales closed. Courses may be unpublished immediately for legal/security reasons with admin audit and learner notice.

Catalog: featured hero, curated collections (free/new/recommended), categories, search, filters, course card with access type, level, locale, duration, instructor, and learning outcomes. Never infer endorsements. Course page: trailer, syllabus, prerequisites, instructor profile, refund/access terms, accessible CTA, project links, transcript availability, and certificate eligibility.

Enrollment is idempotent per learner/course. OPEN_FREE access needs no account; ENROLLED_FREE enrolls immediately; PAID creates an order and grants an entitlement only after verified successful provider state. A payment return URL is informational, not evidence of payment. A refunded or charged-back order revokes paid entitlement per stated policy, preserving audit and historical records.

Progress is per enrolled user and lesson. Resume position is advisory; completion requires a learner action after required viewing/content criteria. Never rely on client-reported playback percentage alone for high-stakes credentials. V1 completion rule: all required lessons explicitly marked complete and final quiz passed if enabled; configurable passing score and maximum attempts. Course policy is snapshotted at enrollment or at course revision assignment.

## Non-goals for initial release

Marketplace, split payments, SCORM, gradebook, live-class scheduling, forums, complex cohorts, DRM claims, automated proctoring, mobile apps, and course AI assistant. Maintain extension seams without shipping placeholder UI.

## Success measures

Catalog visit → course page → enrollment/checkout → first lesson → completion; payment success/reconciliation rate; media startup/error rate; quiz pass rate; certificate verification success; refund volume. Collect privacy-conscious aggregate metrics, with consent handling where required. Segment by acquisition channel without exposing learner identities in public dashboards.
