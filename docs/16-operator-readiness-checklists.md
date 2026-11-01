# Operator readiness checklists

These are preparation and qualification steps for the system owner/operator.
They are not deployment instructions for the assistant: no host has been
accessed or changed. Keep production checkout disabled until the separate
staging and owner-approval gates below are complete.

## 1. ClamAV attachment scanning

### What the application expects

The worker invokes the `clamscan` executable directly; it does not use
`clamd`/`clamdscan`. Install the ClamAV scanner and maintained signature updates
in the same host/container runtime as `maia-lms-worker`. On the systemd host,
the worker runs as `maia-lms`; that account must be able to execute `clamscan`,
read the signature database, and read the private upload being inspected.

`ATTACHMENT_SCAN_MODE=clamav` makes the worker scan after format/signature checks
and before an attachment can become READY. A clean scan exits 0; a detected
test signature exits 1 and blocks the file; missing scanner, stale/unreadable
signatures, timeout, or other scanner errors fail closed. Current scan limits
are 128 MiB per file, 512 MiB total scan size and two minutes. Enabling scanning
does not rescan attachments already READY.

### Host preparation

1. Schedule the change and confirm the target is the Maia LMS worker host,
   using the supported Linux/systemd installation (reference OS: Ubuntu 24.04).
   Confirm who owns OS updates, signature freshness alerts, disk capacity, and
   incident response. Do not install ClamAV on the public proxy alone if the
   worker runs elsewhere.
2. Confirm the worker service account and current service state without
   displaying `/etc/maia-lms/app.env`:

   ```bash
   sudo systemctl status maia-lms-worker --no-pager
   id maia-lms
   ```

3. Install the scanner and signature updater using the operating system package
   manager. On Debian/Ubuntu:

   ```bash
   sudo apt update
   sudo apt install clamav clamav-freshclam
   sudo systemctl enable --now clamav-freshclam
   ```

   The application does not require `clamav-daemon`. Check the updater service
   and its recent logs; resolve download, DNS, proxy, disk-space, or signature
   errors before proceeding:

   ```bash
   sudo systemctl status clamav-freshclam --no-pager
   sudo journalctl -u clamav-freshclam -n 50 --no-pager
   sudo -u maia-lms clamscan --version
   ```

   If the distribution uses a differently named updater unit, identify and
   enable its supported signature-update mechanism instead. Do not disable
   signature updates after the initial download.
4. As `maia-lms`, scan one harmless, clean attachment and the official EICAR
   antivirus test file in a private staging/test directory. Never use real
   malware. For the clean file, expect exit code 0. For EICAR, expect exit code
   1 and a detection. A missing executable, unreadable database, timeout or
   other exit code is a failure, not a clean result. Do not paste scanner output,
   private paths or file contents into tickets or chat.
5. In an isolated application environment, set only the worker's
   `ATTACHMENT_SCAN_MODE=clamav`; preserve the existing other settings. Confirm
   a clean supported attachment reaches READY and EICAR is rejected with
   `FILE_MALWARE`. Also stop or temporarily make the scanner unavailable in
   staging and confirm the upload remains unavailable with a scan-failure state
   (`FILE_SCAN_FAILED`), then restore the scanner and verify the normal retry
   path. Do not perform the failure injection on production.
6. After the staging checks pass, arrange a production maintenance window.
   Record the previous worker setting securely, set
   `ATTACHMENT_SCAN_MODE=clamav` in `/etc/maia-lms/app.env`, preserve root
   ownership, group `maia-lms`, and mode `0640`, then restart **only** the worker
   and confirm it is healthy and can scan a clean attachment. Do not switch a
   production worker to `disabled` as a workaround: production intentionally
   fails closed when scanning is disabled.

### Completion evidence

Record the OS/package versions, updater unit and last successful signature
update time, `clamscan --version` run as `maia-lms`, clean/EICAR application
results, failure/retry result in staging, worker health after activation, and
the date/owner of the next signature-update review. Do not record secrets,
private storage paths, or test-file contents.

This qualifies attachment scanning only. It does not prove that files are
harmless, scan historical READY files, or qualify video-processing capacity.
Keep MEDIA-02 open until the host result and ongoing signature-update ownership
are recorded.

## 2. Mercado Pago checkout and certificates

### Before creating credentials

Keep `PAYMENTS_CHECKOUT_ENABLED=false` in production. Do all purchase, webhook,
refund and failure tests in a separate nonproduction/staging installation with
its own database, storage root, service configuration and publicly reachable
HTTPS hostname. Use only Mercado Pago test credentials and test buyer/seller
accounts there. Do not put sandbox credentials in production or use the local
Fake provider as evidence of a Mercado Pago qualification.

Before sandbox setup, the owner should assemble and obtain qualified review for:

- The legal seller identity and the Mercado Pago account authorized to receive
  the funds.
- Supported currency/payment methods and the actual course price.
- Course access period, cancellation/refund/partial-refund terms and buyer
  support contact.
- Receipt wording, invoice/nota fiscal responsibility, tax/accounting treatment,
  consumer requirements and privacy/LGPD notice.
- Certificate issuer identity, certificate wording, declared workload, and the
  policy for already-issued certificates after refund or chargeback.

The LMS has local rules for refund/chargeback access and certificate revocation,
but those rules do not decide the issuer's legal identity, tax obligations, or
consumer policy. Keep PAY-05 and CERT-01 open until the responsible owner and
qualified advisors confirm these items.

### Sandbox setup and isolated configuration

1. Create or identify a Mercado Pago developer application and separate test
   seller and buyer accounts. Obtain test credentials for the Checkout Pro
   Orders API and identify the seller account ID expected by the provider.
   Configure webhook notifications for the relevant order/payment lifecycle
   events, including refund and chargeback notifications where the account/API
   supports them.
2. Configure the provider's notification URL as:

   ```text
   https://<staging-host>/api/v1/orders/webhooks/mercado-pago
   ```

   The provider appends its event query parameters, including `data.id`. Confirm
   that public HTTPS on the edge/VPS forwards this exact path to the API without
   dropping the query string, request headers, or raw JSON body. Do not expose
   the application host port directly to the Internet. Use the actual staging
   hostname, not a guessed production route.
3. Obtain the webhook signing secret from the provider's notification
   configuration. Store it, the sandbox access token, and seller ID directly in
   the approved staging secret store or staging environment file. Do not place
   values in source control, ordinary tickets, logs, screenshots, this chat, or
   the production environment file. For a systemd staging service, use the same
   restrictive environment-file ownership and permissions as the production
   installation.
4. Set staging explicitly to sandbox mode and enable checkout only in that
   isolated environment:

   ```text
   NODE_ENV=development
   PAYMENT_PROVIDER=mercado_pago
   MP_ENVIRONMENT=sandbox
   PAYMENTS_CHECKOUT_ENABLED=true
   MP_ACCESS_TOKEN=<sandbox secret, stored privately>
   MP_WEBHOOK_SECRET=<sandbox signing secret, stored privately>
   MP_SELLER_ID=<sandbox seller ID>
   PUBLIC_BASE_URL=https://<staging-host>
   ```

   These lines describe required settings; never send the substituted secret
   values for review. The staging site must use a distinct nonproduction
   configuration, database and storage root. The application rejects sandbox mode for
   production configuration and requires HTTPS plus the real provider
   credentials and seller ID when checkout is enabled.
5. Before any purchase, start the isolated staging release and confirm its
   normal application configuration validation succeeds with
   `NODE_ENV=development`, `PAYMENT_PROVIDER=mercado_pago`, and sandbox mode.
   The production `config:check` command is specifically a free-pilot preflight
   that requires production mode and checkout disabled; it is not the validator
   for sandbox checkout. Confirm no setting was inherited from a production
   environment. Protect environment-file output: inspect only file
   metadata/ownership; do not use `cat`, `printenv`, or shell tracing. Check host
   time synchronization because webhook signature verification depends on a
   signed timestamp.

### Sandbox acceptance sequence

Use a published PAID course with the approved staging price and terms, and a
test buyer account:

1. Create an order. Confirm it uses the server-published amount/currency and that
   repeated creation with the same idempotency key does not create duplicate
   orders.
2. Complete the provider's sandbox payment. Confirm a browser return alone
   does not grant access; access appears only after the backend verifies the
   provider's authoritative order state, seller, reference, amount and currency.
3. Confirm the signed webhook reaches the staging endpoint and the order,
   enrollment/entitlement, receipt-email state, and audit history agree. Redeliver
   the event and confirm there is no duplicate grant. Verify a changed/invalid
   signature is rejected and creates no access.
4. Exercise a sandbox refund. Confirm a partial refund preserves access and an
   approved full refund revokes it; test chargeback notification if the provider's
   sandbox supports it. If chargeback simulation is unavailable, record that
   limitation and do not claim that path was sandbox-qualified.
5. Confirm the operations dashboard and safe service logs show enough status to
   investigate a failed payment without exposing tokens, signatures, buyer
   personal data, or provider payloads. Verify SMTP receipt delivery separately;
   a queued/sent state is not proof of inbox delivery.
6. Save a sanitized evidence record: date, staging release, test case/result,
   provider event category, and nonsecret local order reference. Exclude buyer
   credentials, access tokens, webhook secrets/signatures, full payloads, and
   personal data.

### Production gate

Do not enable production checkout until all of the following are true:

- Owner and qualified accounting/legal review have approved the seller identity,
  currency/methods, pricing, access/refund terms, support, receipt/invoice and
  tax responsibilities, privacy wording and certificate issuer/policy.
- Sandbox purchase, signed webhook, duplicate delivery, invalid signature,
  refund, and available chargeback cases have documented results.
- The production public HTTPS hostname and webhook routing are checked by the
  operator, with the signing secret stored through the approved secret process.
- A production backup/recovery path, operator alert/reconciliation ownership,
  worker health and email transport have been reviewed.
- Production configuration has been reviewed separately with
  `MP_ENVIRONMENT=production`; checkout remains false until the owner explicitly
  authorizes activation and the planned release window.

Only the owner/operator should change the production enablement flag and
production credentials, using the approved release process. Never test a
production charge as a substitute for sandbox qualification. Keep PAY-05 open
until the owner authorizes the commercial terms and records successful sandbox
qualification; keep CERT-01 open until issuer policy is confirmed. See the
[payment contract](04-payments.md), [operations guide](08-operations.md), and
[backlog](../TODO.md).
