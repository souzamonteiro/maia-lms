# Security and privacy

## Controls

- HTTPS throughout; secure HttpOnly SameSite cookies; CSRF protection for state-changing cookie-authenticated requests; origin checks; server-side session revocation.
- Password hashing with Argon2id or an equivalent current approved algorithm, email verification, reset tokens stored hashed/expiring, optional TOTP for admins; role and resource authorization on every API/media path.
- Strict Markdown rendering with sanitization; disable arbitrary HTML/script by default. CSP, escaping, upload type/size validation, quarantine/scan, filenames normalized, path traversal protection, SSRF-safe external links and import jobs.
- Parameterized SQL, runtime input validation, rate limits for login/checkout/quiz/certificate endpoints, audit admin changes, dependency/SAST checks, least privilege and secrets outside git.
- Keep payment payloads minimal and redact secrets/PII in logs. Validate webhook signatures against exact raw bytes and reconcile with provider state.
- Database and media backups encrypted, access controlled and restore tested; clear retention schedule; incident response owner and notification process.

## Privacy design

Implement Brazilian LGPD principles through a clear privacy notice, purpose-specific data collection, role-limited access, export/correction/deletion workflow, and a documented retention/legal-basis matrix. Marketing opt-in separate from course enrollment and required service messages. Analytics default to aggregate measures; advertising pixels/cookies only under a reviewed consent design. Record consent version/time/source. Decide controller/processor roles and cross-border processing before enabling third-party analytics, email or AI assistant.

Certificate public verification has explicit name-disclosure consent and a revocation/takedown procedure; explain that anyone with its code or QR may see limited details. AI assistant must enforce course access, document permissions and retention; generated answers cite source passages and remain clearly labeled.

## Threat-focused release checks

Attempt access to paid playlist, segment and attachments without entitlement; try cross-user enrollment/progress mutation; tamper with price/return URL/webhook; replay and reorder payment events; submit fake correct answers; brute force certificate codes; inject HTML through course content; upload disguised executable; exhaust storage with incomplete uploads. Each security test must fail safely and be logged without leaking secrets.
