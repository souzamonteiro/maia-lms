# Roadmap and work packages

## Implemented delivery

- M0: SQLite migrations, runnable API/web/worker, workspace build, lockfile, CI, backup tool, Docker packaging and host/VPS installers.
- M1: free-course catalog/search, author/admin editor, publish/archive, revision preservation and public previews.
- M3 (partial): registration/login/verification/password reset, persistent sessions, free enrollment and lesson progress.
- Operations: Maia Edge HTTPS integration for `learn.maiaplatform.org`, configurable VPN addresses and dry-run installers.

## Pending before the full product is complete

M2 video upload/inspection/transcoding/HLS/captions; quizzes and completion policies from M3; M4 commerce including real provider verification and refunds; M5 credentials; MFA, privacy requests, richer catalog/editor, production performance/accessibility checks and deployment on the actual machines. Provider adapters and database tables alone do not complete these milestones. SMTP, VPN, DNS and certificates require the destination environment.

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
