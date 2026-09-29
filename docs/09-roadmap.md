# Roadmap and work packages

> **Updated implementation plan:** [TODO — complete video course platform](../TODO.md).
> The September 27, 2026 audit details gaps verified in the code, P0/P1 priorities,
> dependencies, and acceptance criteria. The prototype is already published and
> includes internationalization (`en`, `pt-BR`, `es`); these changes must be preserved.
> The milestones below provide historical context; actionable tasks and pending
> status are now tracked in the TODO.

## E1 started — local delivery on September 27, 2026

Markdown editor, sanitized preview, drafts separate from publication, autosave,
local recovery, cross-tab conflicts, and editorial homepage implemented. Guide and
limits: [authoring](12-authoring.md). E1 remains partial as tracked in the TODO;
video depends on E2. This delivery was not deployed to the prototype.

## E2 started — September 28, 2026

Resumable uploads, MP4/poster processing, lesson association, publication, and a
player with authorization/resumption implemented locally. See [video](13-video.md).
At this stage, HLS, captions, the complete library, and VPS validation remained
pending. The subsequent caption delivery is recorded below.

## Implemented delivery

- M0: SQLite migrations, runnable API/web/worker, workspace build, lockfile, CI, backup tool, Docker packaging and host/VPS installers.
- M1: free-course catalog/search, author/admin editor, publish/archive, revision preservation and public previews.
- M3 (partial): registration/login/verification/password reset, persistent sessions, free enrollment and lesson progress.
- Operations: Maia Edge HTTPS integration for `learn.maiaplatform.org`, configurable VPN addresses and dry-run installers.

## Pending before the full product is complete

M2 adaptive HLS, full media library and deployed validation; quizzes and completion policies from M3; M4 commerce including real provider verification and refunds; M5 credentials; MFA, privacy requests, richer catalog/editor, production performance/accessibility checks and validation of the complete video workflows on the deployed prototype. Provider adapters and database tables alone do not complete these milestones. SMTP, VPN, DNS and certificates require the destination environment.

The table below remains the complete product roadmap, not a claim that every milestone is shipped.

Each milestone ends with a demo, reviewable migration/API changes, automated tests for stateful logic, and a rollback note. Do not start provider production traffic before the release gate.

| Milestone | Deliverable | Acceptance |
|---|---|---|
| M0 Foundation | Monorepo, Node LTS app skeleton, SQLite migrations, configuration, CI, local compose | Fresh clone boots with one command; migrations and smoke test pass |
| M1 Catalog | Course revisions, author draft/publish, home, filters, landing pages | Admin publishes an OPEN_FREE sample; public browsing works without sign-in |
| M2 Media | Private upload, worker encode, HLS, captions, authorized playback | Failed jobs retry; public/paid boundary enforced for manifest and segments |
| M3 Learning | Identity, verification, free enrollment, progress, quiz | Enroll is idempotent; server scores attempts; unauthorized writes fail |
| M4 Commerce | Mercado Pago adapter, checkout, webhook, reconciliation, refunds | Sandbox paid grant once only; forged/replayed events never grant; reversals handled |
| M5 Credentials | Completion rules, certificate PDF, QR verification | One eligible learner gets verifiable credential; revocation and reissue work |
| M6 Launch | Performance, security, accessibility, privacy, backup/restore, analytics | Checklists completed; realistic video load measured; production pilot with limited courses |
| M7 Extensions | PayPal, Maia Chat/RAG assistant, multilingual captions, coupons | Each independently gated by usage and provider readiness |

## Suggested GitHub issues

Create one issue per vertical slice, not one per layer. Start with: `M0 repository and CI`, `M0 schema and seed`, `M1 course draft/publish`, `M1 catalog`, `M2 upload/transcode`, `M2 media authorization`, `M3 learner enrollment`, `M3 quiz scoring`, `M4 checkout and webhook`, `M4 reconciliation/refund`, `M5 certificate`, `M6 release gate`. Label each with milestone, risk and area. A task is done when its API/UI behavior, migration, permissions, failures and relevant tests are reviewed.

## Testing strategy

Unit tests for policy and scoring; database integration tests for uniqueness and transactions; provider contract tests against sandbox fixtures; end-to-end browser tests for visitor/free/paid learner; media authorization tests for playlists/segments; load test for realistic concurrency; accessibility tests plus manual keyboard/screen reader pass; backup restoration drill. Revisit provider integration docs at implementation time.

## Supplementary materials — September 28, 2026

MEDIA-05 delivered locally: course/lesson attachments, metadata per revision, and
authorized downloads. [Guide](14-materials.md). Other E2 work remains in the TODO.

## Captions — September 28, 2026

PLAY-03 delivered locally: simple WebVTT per language, transcripts, and authorization
per revision. [Guide](15-captions.md). HLS and the remaining E2 additions are still open.
