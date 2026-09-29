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
- [ ] **BASE-02 — Migrate existing data without reinterpreting text.**
  Add new additive migrations for revisions, content format, media relationships,
  translations/metadata, and editorial slots according to the workflows below.
  Dependency: BASE-01. Acceptance: restoring the prototype database in an isolated
  environment preserves accounts, enrollments, progress, and lessons; legacy text
  remains `plain`, without executing previously harmless markup. Do not edit applied migrations.
- [x] **EDIT-01 — Markdown editor with toolbar and preview.**
  Headings, bold, italic, lists, links, quotes, code blocks, tables, and images with
  alt text; accessible editing and preview. Dependencies: BASE-01/02.
  Acceptance: authors format, save, and reopen content, and learners receive the same
  rendered structure. Markdown is the initial choice; a visual editor may be added
  without requiring unrestricted HTML to complete this delivery.
- [ ] **EDIT-02 — Safe, versioned rendering.**
  Define `content_format`, parser, and server-side allowlist sanitization; block
  scripts, handlers, dangerous URLs, arbitrary SVG/HTML, and unapproved embeds.
  Dependency: EDIT-01. Acceptance: preview and lessons use the same policy; XSS
  cases fail; legitimate content and translations remain readable. Installing a
  parser alone is insufficient.
- [ ] **EDIT-03 — Studio organized by course/module/lesson.**
  Split the single form into screens/components, support keyboard and drag reordering,
  duplicate/remove drafts with confirmation, and preview as a learner/visitor.
  Dependency: BASE-01. Acceptance: build a multi-module course without editing JSON/SQL;
  deletion does not break enrolled revisions or remove media still referenced.
- [ ] **EDIT-04 — Autosave, conflicts, and unsaved work protection.**
  Save per editing unit, indicate status/errors, recover drafts, and detect concurrent
  edits through a version/ETag. Dependency: EDIT-03. Acceptance: network failure,
  two tabs, navigation, and language switching do not erase or silently overwrite
  content. At the original audit, `languageSelect` called `main()` and recreated the form.
- [ ] **EDIT-05 — Lesson types and publication validation.**
  Support `video`, `article`, `mixed`, media and attachment association, duration,
  required status, and preview. Dependencies: BASE-02, MEDIA-03, EDIT-02. Acceptance:
  video-only lessons need no placeholder text; publication lists missing fields and
  blocks non-READY media, invalid ordering, and links to another course/author.

## P0 — end-to-end media and video

- [ ] **MEDIA-01 — Private, secure storage.**
  Confine paths to the root, including protection against `../`, absolute paths, and
  symlinks; server-generated keys, streaming, temporary writes/rename, and cleanup
  after failure. Dependencies: none. Acceptance: confinement and author isolation
  tests; large file transfers without an entire Buffer in memory. The original
  adapter must not be exposed before this correction.
- [ ] **MEDIA-02 — Upload videos, images, and attachments.**
  Authorized endpoints, resumable streaming/chunks, progress, cancel/retry, quotas,
  and incomplete upload cleanup. Check size and actual content, quarantine originals,
  and define inspection/antimalware for attachments. Dependencies: MEDIA-01, BASE-02.
  Acceptance: interrupted uploads resume without duplication; invalid files or files
  belonging to another author are rejected; a full disk produces a recoverable error.
- [ ] **MEDIA-03 — FFprobe/FFmpeg processing.**
  Validate containers/streams, generate compatible playback MP4 and adaptive HLS,
  poster, duration, and metadata; CPU/memory/time limits and subprocesses without
  shell interpolation. Dependencies: MEDIA-02, JOB-01. Acceptance: real video reaches
  READY with verified outputs; corrupted files become FAILED with useful errors;
  publication never points to incomplete files. Do not artificially upscale resolution.
- [ ] **JOB-01 — Long-running jobs and controlled concurrency.**
  Separate media capacity from the email queue; lease renewal, progress, heartbeat,
  cancellation, and crash recovery; idempotent outputs and manual retry.
  Dependency: MEDIA-01. Acceptance: transcoding longer than five minutes is not
  reclaimed by another worker; crashes/restarts neither produce concurrent duplicate
  outputs nor block SMTP.
- [ ] **MEDIA-04 — Media library and lifecycle.**
  List by author/course, search, select, replace with a new version, associate
  images/covers/posters/attachments, and display queue/errors. Dependencies:
  MEDIA-02/03, EDIT-03. Acceptance: authors follow the entire process without a
  terminal; orphan collection considers old revisions and removes only eligible
  files after a defined retention period.
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
- [ ] **PLAY-01 — Authorized MP4 and HLS delivery.**
  Playback endpoints tied to lesson/revision/entitlement, HTTP Range/206/416, correct
  Content-Type, HEAD, and playback session expiration/renewal; also check secondary
  playlists, segments, keys, and attachments. Dependencies: MEDIA-03, BASE-01.
  Acceptance: direct access/copied URLs cannot bypass enrollment or revocation;
  public previews expose only the approved asset, never the entire directory.
- [ ] **PLAY-02 — Integrated, responsive player.**
  HTML5 player with native HLS/appropriate fallback, play/pause, seek, volume, speed,
  fullscreen, keyboard controls, loading/error states, and quality selection.
  Dependency: PLAY-01. Acceptance: playback and seeking work on desktop, Android,
  and Safari/iOS; access renewal during long lessons does not unnecessarily interrupt playback.
- [x] **PLAY-03 — Captions and transcripts.**
  WebVTT upload/validation, language and track selection, accessible text transcripts,
  replacement workflow, and availability indication. Dependencies: MEDIA-04, PLAY-02.
  Acceptance: authors publish captions and learners enable them in the player;
  private course tracks follow the same authorization as video.
- [ ] **PLAY-04 — Learner resumption and navigation.**
  Persistent module outline, previous/next, last lesson, debounced position saving,
  continue watching, and course progress. Dependencies: PLAY-02, BASE-01.
  Acceptance: reloads/device changes resume position; requests stay within API limits;
  explicit completion follows course policy, without treating seconds reported by
  the browser as proof of learning.
- [ ] **OPS-01 — Adapt HTTP and installation for video.**
  Separate uploads from the original JSON-only middleware; dedicated authentication/CSRF
  for multipart/chunks. Define route and rate limits for uploads/player; review
  Nginx (1 MB at the audit), buffering, timeouts, Range, temporary storage, FFmpeg,
  and dependencies in systemd/Docker installations. Dependencies: MEDIA-02, PLAY-01.
  Acceptance: representative uploads, seeking, and long playback cross the VPS/WireGuard
  without inappropriate 413/415/429 errors, exposing new public services, or restarting the VPN.

## P0 — homepage and course presentation

- [x] **HOME-01 — Editorial course selection.**
  Dashboard to select hero, featured courses, and collections, order them, schedule
  start/end dates, and remove them from the homepage without unpublishing. Use/evolve
  `promotions`; provide a dedicated public API separate from general search.
  Dependency: BASE-01. Acceptance: administrators explicitly choose homepage courses
  and their order; drafts/archived courses never leak; removing a highlight keeps
  the course in the catalog.
- [ ] **HOME-02 — Covers, cards, and sales/presentation page.**
  Cover and alt text, trailer/preview, author/bio, objectives, prerequisites, level,
  language, workload, curriculum, and access/certificate terms. Dependencies:
  MEDIA-04, EDIT-03, HOME-01. Acceptance: dashboard edits appear on the public page;
  cards have images and CTAs consistent with enrollment/pricing, without fake statistics.
- [ ] **HOME-03 — Catalog, categories, and paginated search.**
  Manageable taxonomy, access/language/level filters, sorting, and real pagination
  instead of the fixed 100-item limit. Dependency: HOME-02. Acceptance: composable
  filters, shareable URLs, useful empty states, and courses accessible beyond page one.

## P1 — identity, management, and internationalization

- [ ] **I18N-01 — Complete existing internationalization.**
  Preserve `en`, `pt-BR`, `es`, and existing detection behavior; translate all new
  components, states, validations, emails, and API messages using stable codes;
  format dates/numbers/prices by locale. Dependency: part of every delivery, not a
  later rewrite. Acceptance: the same flows tested in all three languages, missing
  keys detected, and language switching without form loss (EDIT-04).
- [ ] **I18N-02 — Separate interface and course languages.**
  Save user preferences, let authors set content/caption locales, and support
  translated metadata with explicit fallback. Dependencies: BASE-02, I18N-01.
  Acceptance: selecting Spanish in the interface neither reclassifies a Portuguese
  course nor promises automatic video translation; preferences persist across devices.
- [ ] **ADMIN-01 — User and author management.**
  Listing/search, roles, suspension/reactivation, public instructor profiles, and
  auditing; administrative bootstrap/reset with specific errors and no default passwords.
  Dependency: existing identity. Acceptance: administrators delegate authorship in
  the dashboard; authors cannot change another author/account; access changes
  invalidate the relevant sessions.
- [ ] **AUTH-01 — Complete account workflows.**
  Profile, password changes, verification resend/feedback, localized recovery,
  account states, and explicit unverified-email policy; administrator MFA with
  recovery. Dependencies: I18N-01, ADMIN-01. Acceptance: used/expired tokens,
  unavailable SMTP, and lost second factors have verifiable recovery paths.
- [ ] **ADMIN-02 — Enrollments, grants, and audit.**
  Dashboard for enrollments, progress, manual grants/revocation with reasons,
  history, and support handling. Dependencies: BASE-01, ADMIN-01. Acceptance:
  authorized, audited operations change access without deleting history or requiring manual SQL.
- [ ] **ADMIN-03 — Publication, review, and urgent withdrawal.**
  DRAFT → REVIEW → PUBLISHED workflow, checklist, optional scheduling, and notifications;
  distinguish archiving (preserves access) from urgent access withdrawal.
  Dependencies: EDIT-05, ADMIN-02. Acceptance: each transition's rules are tested;
  urgent withdrawal leaves no access through old URLs/media grants.

## P1 — assessments and completion

- [ ] **QUIZ-01 — Assessment builder and versioning.**
  Single/multiple-choice questions, scoring, passing grade, attempts, lesson/final
  assessments, and preview. Dependencies: BASE-01, EDIT-03. Acceptance: authors build
  assessments in the dashboard; answer keys never appear in learner payloads;
  new revisions do not change old answers/attempt policies.
- [ ] **QUIZ-02 — Server-side attempts and grading.**
  Atomic start/submission, limits, duplicate handling, deadlines, and result feedback.
  Dependency: QUIZ-01. Acceptance: manipulated, repeated, concurrent, or cross-course
  answers cannot produce a passing result; accepted submissions become immutable.
- [ ] **LEARN-01 — Consistent completion policy.**
  Snapshot required lessons/grades/attempts per revision, server-side calculation,
  and idempotent completion. Dependencies: PLAY-04, QUIZ-02. Acceptance: dashboard
  and certificates use the same decision; revoked access and failed assessments prevent issuance.

## P1 — sales and payments

- [ ] **PAY-01 — Pricing, orders, and real checkout.**
  Enable PAID in the editor with price/currency/terms, order snapshots, idempotency,
  hosted checkout, and pending/canceled/approved screens. Dependencies: BASE-01,
  HOME-02, ADMIN-02. Acceptance: browser-supplied prices are not trusted; return
  redirects do not grant access; buyers can see their orders and status.
- [ ] **PAY-02 — Review the adapter contract and receive webhooks.**
  Check current official documentation before implementation; test signatures,
  identifier sources, headers/query/body, and correct deduplication. At the audit,
  `verifyWebhook` attempted to extract `data.id` from the body as URLSearchParams
  and used that identifier as the event; do not consider the integration validated.
  Session/origin/JSON middleware and raw-byte capture must follow the provider's
  specific contract without broad exceptions on other routes. Dependency: PAY-01.
  Acceptance: official/sandbox fixtures accepted, tampered ones rejected, and distinct
  transitions of the same payment processed without duplicate grants.
- [ ] **PAY-03 — Confirmation, reconciliation, and access rights.**
  Query authoritative status and verify seller, reference, currency, and amount;
  write order/payment/enrollment/entitlement/outbox in a short SQLite transaction;
  reconcile lost/delayed events. Dependency: PAY-02. Acceptance: approved payments
  grant access once; repeated/out-of-order notifications cannot create incorrect
  access; approved orders without enrollment are detected and recovered.
- [ ] **PAY-04 — Refunds, disputes, and commercial support.**
  Full/partial refunds, chargebacks, audit trail, access revocation, and policy for
  issued certificates; orders and receipts dashboard. Dependencies: PAY-03, ADMIN-02.
  Acceptance: retries cannot duplicate refunds; local state reconciles with the
  provider; partial refund rules are explicit.
- [ ] **PAY-05 — Validation and commercial configuration.**
  Separate sandbox/production, review seller identity, currency, access/refund terms,
  support, receipts, and tax requirements with a qualified responsible party.
  Dependencies: PAY-01–04. Acceptance: purchase/reversal tested in the sandbox;
  real activation depends on the owner's credentials/configuration. Do not substitute
  fake production payments for a pending integration.

## P1 — certificates

- [ ] **CERT-01 — Eligibility and idempotent issuance.**
  Check completion, entitlement, verified email, name, and disclosure consent;
  snapshot identity/course/workload/issuer. Dependencies: LEARN-01, AUTH-01, and
  PAY-04 for paid courses. Acceptance: concurrent requests produce one valid issuance;
  subsequent profile/course edits do not rewrite the document.
- [ ] **CERT-02 — PDF, QR, and public verification.**
  Asynchronous generation, authorized download, opaque code, public verification
  with minimal data and valid/revoked status; learner certificates screen.
  Dependencies: CERT-01, JOB-01. Acceptance: QR opens the canonical URL, PDF text
  remains readable, workers can retry without duplicate issuance, and lookup does
  not enumerate identities.
- [ ] **CERT-03 — Revocation and reissuance.**
  Dashboard and private reason, new document when needed, link to the previous one,
  and preservation of old-code lookups. Dependencies: CERT-02, ADMIN-02.
  Acceptance: revoked documents remain verifiable as revoked; only authorized
  administrators can reissue, with auditable history.

## P1 — reliability, protection, and full launch

- [ ] **DATA-01 — Strengthen SQLite invariants.**
  Validate cross-references among revisions/media/courses and uniqueness of final
  quizzes, active issuance, and payment identifiers before enabling workflows.
  At the audit, `UNIQUE(revision_id, lesson_id)` allowed multiple quizzes with NULL
  lesson_id; certificates lacked uniqueness per issuance policy. Dependencies:
  BASE-02 and QUIZ/PAY/CERT design. Acceptance: migrations and concurrency tests
  prevent invalid states without relying exclusively on prior code checks.
- [ ] **OPS-02 — Integrated backup and media restoration.**
  Database + manifests/versions/referenced files + configuration, retention,
  off-site copies, and rehearsed restoration. Dependency: MEDIA-04. Acceptance:
  restoring a published course and old revision allows playback, resumption, and
  certificate verification; a SQLite-only backup is not a complete video backup.
- [ ] **OPS-03 — Observability and dashboard operations.**
  Queue/transcode/playback/SMTP/payment/disk metrics, logs without tokens/PII,
  alerts, inspection, and administrative retries. Dependencies: JOB-01, PAY-03.
  Acceptance: operators identify stuck jobs and error causes without inspecting
  secrets; API readiness is not treated as proof that every worker is healthy.
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
- [ ] **SEC-01 — Authorization, abuse, and hostile content.**
  Tests for cross-user/author/course access, private/revoked media, Markdown,
  uploads, extraction/transcoding, payment replay, and storage limits.
  Dependencies: corresponding deliveries. Acceptance: no new endpoint bypasses
  policies; hostile test files fail in a controlled way without leaks.
- [ ] **PRIV-01 — Privacy and self-service.**
  Profile/correction, export, deletion requests, versioned consent, account/media/payment
  retention, and support contact. Dependencies: ADMIN-01, PAY-04, CERT-03.
  Acceptance: traceable requests respect defined retention; public certificate
  lookups expose only consented data. Legal review is an external dependency, not
  a claim that compliance has already been achieved.
- [ ] **UX-01 — Accessibility and real usage states.**
  Keyboard/focus, screen readers, contrast, zoom/mobile, captions, error messages,
  skeleton/loading and empty states; test all three languages. Dependencies:
  EDIT-03, PLAY-03, HOME-03, I18N-01. Acceptance: publish and watch without a mouse;
  player, editor, and forms retain context when errors occur.
- [ ] **SEO-01 — Indexable public pages.**
  Useful server-rendered content, per-course title/description, canonical URLs,
  sitemap, Open Graph/covers, and locale; prevent indexing of private areas.
  Dependencies: HOME-02/03, I18N-02. Acceptance: initial HTML for a published course
  contains its presentation; crawlers do not receive only the original generic shell.
- [ ] **QA-01 — Complete product test suite and demonstration.**
  Extend HTTP, database, job, and browser tests to all workflows below, including
  Chrome/Firefox/Safari and mobile where applicable. Dependencies: all P0/P1
  deliveries. Acceptance: new reports per version; the original English article
  test does not establish acceptance for video, editor, languages, checkout, or certificates.
- [ ] **DOC-01 — Keep contracts and operations aligned with implementation.**
  Update OpenAPI, data model, installation/configuration, author/learner/admin
  manuals, limits, and recovery procedures with every delivery. Dependency:
  cross-cutting. Acceptance: implemented API and future plans are separate;
  runnable examples do not depend on default credentials or omitted steps.

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
