# Assessment and certificates

> **Initial MVP status:** this document records requirements for the complete product. The initial MVP delivered free text courses, identity, enrollment, and progress. Video, commerce, quizzes, certificates, MFA, and privacy requests still required implementation at that stage. See [the roadmap](09-roadmap.md) for subsequent deliveries.

Multiple-choice single/multi-select questions with server-held answer keys, deterministic scoring, configurable pass percent and attempt cap. An optional per-quiz time limit is measured from the immutable attempt start. Version question text, choices and grading keys; submitted attempts remain immutable. Random question order is optional and must be reproducible per attempt. Limit abuse through rate limiting and submission deadlines. Clearly state that an unproctored quiz certifies course completion under published rules, not independently verified professional competence.

Completion eligibility: active enrollment and entitlement, required lessons completed, final quiz passed if configured, learner verified email, certificate name confirmed, no unresolved payment reversal. Workload is publisher-defined and disclosed on course page; do not equate playback seconds with academic credit. Issue once per completion record; reissue creates a new certificate and revokes old one with audit trail.

The current API preflight returns the exact disclosure fields and a versioned hash;
issuance requires explicit consent bound to that hash and stores an immutable JSON
snapshot, consent timestamp, and audit event. The current snapshot takes workload
from the publisher-declared revision minutes and issuer from its instructor name.
The worker also generates a private PDF/QR artifact and owner/admin-authorized
download is available once ready. Institutional issuer policy remains to be
confirmed.

The anonymous API verification endpoint `/certificates/verify/{code}` now displays only the learner name, course title, declared workload, instructor, issue time, and current valid/revoked status. The localized learner-facing verification page is implemented at the canonical URL. Unknown and malformed codes share a generic response; API lookup is rate-limited and sends `noindex`/`no-store` headers. Issued records queue an asynchronous PDF job with selectable text and a QR linking to the canonical HTTPS verification URL; the resulting private PDF is downloadable by its learner or an administrator when ready. “My learning” lists certificates, validity, PDF state, verification links, and ready downloads. Administrators can revoke with a private reason and reissue once with immutable predecessor lineage and actor-attributed audit at `/admin/certificates`; predecessor codes remain valid lookups of revoked records. Public lineage details remain intentionally hidden. The learner must see exactly what will be public and consent before issuance. A content hash binds the certificate snapshot but a hash alone does not prove institutional accreditation. Revocation reasons are visible only to authorized administrators.

Tests: anonymous verification; invalid and revoked codes; replay issue job; policy revision; failed quiz; unverified email; refund before/after issuance; PDF text/QR round trip. PDF generation is asynchronous and retryable.
