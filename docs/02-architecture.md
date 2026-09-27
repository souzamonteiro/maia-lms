# Architecture and media

## Components

```mermaid
flowchart TD
  Browser[Browser] --> Nginx[Nginx TLS gateway]
  Nginx --> Web[Web application]
  Nginx --> API[Node.js API]
  API --> DB[(SQLite)]
  API --> Store[Storage adapter]
  API --> Queue[Jobs/outbox]
  Queue --> Worker[Media and document worker]
  Worker --> Store
  Worker --> DB
  Provider[Payment provider] --> API
```

The implemented MVP serves API and web in one Node.js process, plus an email outbox worker. Video, billing and certificate flows below are planned extensions.

Use modular monolith boundaries: identity; catalog/content; enrollment/entitlements; learning/progress; assessments; billing; certificates; media; analytics. SQLite transactions enforce key invariants. Start with SQLite-backed jobs/outbox and a dedicated worker; introduce a separate queue if measured throughput warrants it. Avoid distributed transactions between database and provider.

Use Node.js LTS/Express or a minimal equivalent, SQL migrations, runtime schema validation, and explicit service interfaces. Prefer plain HTML/CSS/JS and progressive enhancement. Code identifiers/comments in English and JavaScript camelCase. Lock dependency versions and document supported versions when implementation begins.

## Video lifecycle

Upload authorization → private quarantine → size/type inspection and malware scanning → ffprobe validation → FFmpeg encoding → poster and captions/transcript association → READY. A failed job stays FAILED with a retry count and human-readable status. Originals are retained by policy, never served directly from public web roots. Publish only READY media. Generate HLS renditions (for example 360p/720p with source-dependent caps) and progressive MP4 fallback if justified by client tests. Preserve captions as WebVTT, plus downloadable transcript and language metadata. Media processing happens off the API request path.

Public courses can serve public media through cached paths. Paid/private assets use an authorized short-lived playback session and segment access control; do not place long-lived bearer credentials in public manifests, logs or referer URLs. Validate authorization for playlists, segments, keys and attachments. HLS tokens limit casual sharing, not screen capture. CDN/object storage is an adapter option; local disk is acceptable at small scale with measured uplink capacity, disk headroom and backups. Storage interface: putPrivate, readAuthorized, delete, generateDeliveryGrant, stat.

Serving video via Maia Edge requires a load test with realistic concurrent viewers and bitrate. Approximate outbound demand: viewers × average bitrate, plus protocol overhead; e.g. 100 viewers × 2 Mb/s already approaches 200 Mb/s before overhead. A VPS gateway or home uplink must be tested before paid launch.

## Interfaces

PaymentProvider: createCheckout, getPayment, verifyWebhook, refund, normalizeEvent. StorageProvider and EmailProvider are separate ports. Avoid translating provider events directly into enrollment state without normalized order state transitions. Optional future CourseAssistant port can index consented course assets in Maia RAG and surface cited answers through Maia Chat, with per-course access checks.

## Reliability

Health endpoints distinguish liveness and readiness. Timeouts/retries with backoff around external calls; idempotent workers and webhook consumers; transactional outbox for notifications and certificate jobs. Structured logs include correlation IDs but redact tokens and personal/payment data. Backups and restore drills cover database and media together. See operations.

## SQLite implementation

`better-sqlite3` opens a local filesystem path from `DATABASE_URL`; this is not a server connection URL. Connections enable WAL, foreign keys, a 5-second busy timeout and synchronous NORMAL. UUIDs and JSON are TEXT, booleans INTEGER (0/1), and timestamps UTC TEXT. Existing migration defaults use SQLite `datetime('now')`; application timestamps may use ISO 8601, so interval comparisons use `julianday` instead of comparing mixed text formats.

SQLite serializes writers. Use short synchronous transactions and `BEGIN IMMEDIATE` for job claims/enrollment decisions. Do not hold transactions across SMTP or other network calls. There is no `SELECT FOR UPDATE` or `SKIP LOCKED`; the worker claims leases under the database write lock. API and worker must share local disk, not a network filesystem. Backups use the SQLite backup API.

Sessions use `http_sessions` in the application database; the original `sessions` schema table is reserved and unused. Role/status/session-version are rechecked on authenticated requests. The web package is mounted by the API, so it has no separate listening port.

Production topology: `learn.maiaplatform.org` → VPS Nginx/Maia Edge (TLS) → WireGuard → host API on 3200. Bind to the host VPN IP and trust only the VPS VPN IP. Installation does not change the tunnel; see [operations](08-operations.md).

## Implemented authoring and home

The browser studio saves revision snapshots with optimistic concurrency; published and editable pointers are independent. New drafts are explicitly created before server autosave starts. Local recovery is scoped to the signed-in account. Markdown preview and lesson rendering share the server-side parser and HTML allowlist; raw HTML remains literal. The editorial home uses promotions and a versioned singleton updated in a short immediate transaction. See [authoring](12-authoring.md) for limits and migration details.
