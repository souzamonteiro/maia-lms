# Decisions and open questions

## Proposed defaults

- Single Maia publisher, no marketplace in v1.
- Brazil-first, BRL payment and pt-BR interface; multilingual course metadata supported structurally.
- Mercado Pago hosted checkout first; PayPal second; Pix availability validated with account.
- Node.js API + SQLite + worker + Nginx; plain web frontend with progressive enhancement.
- Local private media storage initially, with object/CDN adapter; transcode to HLS.
- Public certificates only for identity-linked enrolled learners who explicitly confirm displayed name and disclosure.
- Apache-2.0 software license; course content under separate terms.

## Decisions before implementation or production

1. Brand/domain and who legally sells the courses (person/company), tax/receipts, published support contact.
2. Learner access duration and refund/revocation policy; archive treatment for existing learners.
3. Expected peak simultaneous viewers and outbound bandwidth; local disk versus object storage.
4. Whether OPEN_FREE courses should permit optional account enrollment and certificates in a later release.
5. Which courses launch first, language/caption obligations, and certificate wording/workload.
6. Whether multiple authors need delegated publishing in v1.

Defaults permit implementation to start. Production commerce and public certificate policy require explicit owner review.

## Implementation decisions — 2026-09-27

- SQLite replaces the originally proposed server database in development and this single-host deployment. WAL and short transactions support API and worker; no shared database over WireGuard.
- `learn.maiaplatform.org` is the production hostname. Maia Edge owns TLS on the VPS; systemd owns API/worker on the host.
- Native Node.js compilation and workspace exports are built in dependency order. The lockfile is committed.
- Sessions live in the same SQLite database, using better-sqlite3; no second SQLite driver/store is required.
- Initial usable slice: free text courses, authoring, enrollment and progress. No simulated payment grants or fake successful media/certificate jobs are exposed.
- Email delivery is durable through the outbox, with bounded retries and leases.
