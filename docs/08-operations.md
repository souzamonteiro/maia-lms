# Operations and deployment

## Environments

Local: disposable PostgreSQL, API, web and worker with fake payment provider and small fixture media. Staging: production-like TLS, real provider sandbox and synthetic accounts. Production: separate database roles, encrypted secret store, filesystem/object storage, monitored worker and backups. Never reuse production keys in staging. Nginx forwards only trusted proxy headers and sets upload limits; keep application private behind gateway. Maia Edge topology is optional and must be load tested.

Config examples: DATABASE_URL, SESSION_SECRET, PUBLIC_BASE_URL, STORAGE_BACKEND, STORAGE_ROOT, MEDIA_SIGNING_KEY, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, MAIL_TRANSPORT. Supply `.env.example` with placeholders only during implementation. Validate every required variable on startup. Use separate keys for sessions, media and webhooks.

## Deployment runbook

1. Verify migration compatibility and restore point; deploy additive schema migrations.
2. Deploy worker then API/web in a rolling or brief maintenance window; run readiness probes.
3. Verify catalog, enrollment, playback, webhook sandbox and certificate verification smoke tests.
4. Monitor errors, queue age, disk usage, outgoing bandwidth and provider reconciliation.
5. Roll back application code if needed; use forward corrective migrations for database changes.

Back up DB daily and media incrementally with retention by policy. Restore to a disposable environment regularly, check referential integrity and playable media, record RPO/RTO targets after measured drills. Store job retry/dead-letter records with operator replay. Observability: request latency/error rate, paid order conversion, webhook lag, stuck transcodes, delivery failures, storage capacity, bandwidth, certificate failures. Alerts require an owner and escalation path.

## Launch checks

Provider production onboarding and Pix eligibility; legal terms/privacy/refund and tax review; captions for launch catalog; payments/refunds and reconciliation tested in sandbox and small live transaction; malware scanning; access bypass and webhook replay tests; backup restore; accessible checkout fallback; support contact; disk/uplink capacity tests. Do not claim DRM or accredited credentials.
