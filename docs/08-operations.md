# Operations and installation

## Topology

```text
Internet → learn.maiaplatform.org:443 → Nginx/Maia Edge on the VPS
                                         ↓ WireGuard
                                    host:3200 → API + interface
                                                    ↓
                                              local SQLite
                                                    ↑
                                               SMTP worker
```

The application does not require a separate SQLite server, Redis or Nginx on the host. The API and worker share the same SQLite file **on local disk**, using WAL and `busy_timeout=5000`. Do not use NFS, Samba or replicas on different machines against this file. There is one HTTP process; scaling requires measurement and an architecture review.

## Preparation

Use Linux with systemd (reference: Ubuntu 24.04), Node.js 22.12+ installed at a path accessible to the service, npm, rsync, curl, openssl, Python 3, make, g++, iproute2 and util-linux. The installer checks prerequisites; it does not download runtime installation scripts or change system packages.

First configure the VPN through the [Maia Edge CLI](../../maia-edge/docs/CLI.md). Keep the existing IP addresses and interface. Examples in this guide use host `10.77.0.2`, VPS `10.77.0.1` and application port `3200`. Replace these with the actual values.

Restrict TCP 3200 to the VPS over the WireGuard interface in the host firewall; do not expose this port on the public router. The service binds only to the specified address. On the VPS, allow HTTPS 443 and the WireGuard transport according to your configuration. The DNS A record for `learn.maiaplatform.org` points to the VPS public IPv4 address. Do not configure AAAA without preparing and testing IPv6.

## Host

Run from the maia-lms checkout:

```bash
./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1 --dry-run
sudo ./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1
```

`--port` changes port 3200; `--domain` changes the default domain. Installation:

1. Creates the `maia-lms` service account and a release under `/opt/maia-lms/releases`.
2. Installs dependencies and builds as the unprivileged user; published code becomes root-owned.
3. Preserves `/etc/maia-lms/app.env`; creates random secrets only on the first installation.
4. Stops the processes, saves a verifiable backup if a database exists, and applies migrations.
5. Updates `/opt/maia-lms/current`, installs and starts `maia-lms` and `maia-lms-worker`.
6. Checks `/readyz`. Previous releases and backups are retained.

Data: `/var/lib/maia-lms/maia-lms.db`, sessions in `http_sessions`, storage at `/var/lib/maia-lms/storage`. The data directory uses mode 0700 and `UMask=0077`; secrets use mode 0640 and ownership root:maia-lms.

Edit `/etc/maia-lms/app.env` with `sudoedit`. Configure `MAIL_TRANSPORT` with real SMTP and `MAIL_FROM` with an authorized sender; do not leave the example local SMTP setting in production. URL-encode special characters required in SMTP URLs. Then:

```bash
sudo systemctl restart maia-lms maia-lms-worker
sudo systemctl status maia-lms maia-lms-worker
sudo journalctl -u maia-lms -u maia-lms-worker -n 100
```

To create a production administrator, run on the host from the updated checkout:

```bash
sudo ./scripts/create-admin.sh your-email@example.com
```

The script prompts for the password twice without displaying it, after sudo authentication. It creates the account as service user `maia-lms`, using the installation at `/opt/maia-lms/current` and `/etc/maia-lms/app.env`. The password must contain 12–128 characters. There is no need to export variables or use `sudo --preserve-env`.

By default, the command does not replace existing accounts. To reset the password of an existing administrator account, use:

```bash
sudo ./scripts/create-admin.sh your-email@example.com --reset
```

The explicit `--reset` operation rotates the password, ensures the selected account has the administrator role, increments its session version to invalidate existing sign-ins, and records an `admin.account_reset` audit event. Without `--reset`, an existing account is left unchanged and the command prints a concise error. Initial creation records `admin.bootstrap`. There is no default password. After sign-in, administrators can delegate learner, author, and administrator roles from **Manage users**; the worker role cannot be assigned there.

## VPS and TLS — the maia-chat pattern

As in maia-chat, public Nginx forwards directly over the VPN to Node at `10.77.0.2:3200`. maia-rag uses a variant with an additional Nginx instance on the host (4311 → localhost:4310); this layer is unnecessary for the LMS, which already listens on the WireGuard address.

The default VPS installer installs only the LMS virtual host in `sites-available` and `sites-enabled`, tests Nginx and reloads the service. It does not run `maia-edge apply` or restart the VPN. Nginx, Python 3, curl and util-linux must already be installed. Templates are in `deploy/nginx/learn-{acme,vps}.conf.template`.

Point the DNS A record for `learn.maiaplatform.org` to the VPS and allow HTTP 80 and HTTPS 443 in the VPS/provider firewall. For first-time certificate issuance, run **on the VPS** from the updated checkout:

```bash
sudo ./install.sh vps --upstream 10.77.0.2:3200 --acme-only
sudo certbot certonly --webroot -w /var/www/html -d learn.maiaplatform.org
sudo ./install.sh vps --upstream 10.77.0.2:3200
```

The first command serves only the ACME challenge over HTTP; other URLs return 404 until the HTTPS configuration is installed. If the certificate already exists, run only the last command. Use `--dry-run` to preview, and `--cert`/`--key` for certificates outside `/etc/letsencrypt/live/learn.maiaplatform.org/`.

The final configuration redirects HTTP to HTTPS and retains the ACME challenge for renewal. Configure the renewal hook to run `nginx -t && systemctl reload nginx` and check the Certbot schedule. The installer backs up the previous virtual host and restores the file if validation or reloading fails. It refuses to replace sites owned by another manager or create a second virtual host for a domain already found in the standard active-site directories.

If you already registered the LMS through the Maia Edge CLI, keep that method or explicitly plan the migration; do not install two virtual hosts for the same domain. For compatibility, passing `--edge-dir /opt/maia-edge` selects the old installer, which requires a certificate and uses `service add`, `plan`, `apply`. This mode may restart the managed VPN interface and is not the default used in the maia-chat/RAG examples.

### Checking connectivity between the VPS and host

Run **on the VPS**, before enabling the HTTPS proxy:

```bash
curl --connect-timeout 5 --fail http://10.77.0.2:3200/readyz
```

A local response on the host does not prove VPN connectivity. On timeout, check routes, the tunnel and the firewall. The maia-chat example allows the port through the WireGuard interface; for the LMS on the **host**, if UFW is active and the VPS uses `10.77.0.1`, the equivalent restricted rule is:

```bash
sudo ufw status verbose
sudo ufw allow in on wg0 proto tcp from 10.77.0.1 to 10.77.0.2 port 3200
```

Do not enable or reset UFW if the machine uses another firewall manager. Home-router port forwarding is unnecessary. The installer does not assume which firewall manages your infrastructure.

Then check `https://learn.maiaplatform.org/readyz`, login and enrollment. `TRUST_PROXY` remains the VPS WireGuard IP, following [Express proxy behavior](https://expressjs.com/en/guide/behind-proxies/).

## Upgrades and rollback

Run the host installer again from the new version. Existing configuration is preserved: changing upgrade flags does **not** modify `app.env`. Edit the file explicitly when changing IP, port or domain. Migrations are additive; a failure stops installation and must be investigated before restarting processes. Build failures happen before services are stopped.

To roll back code, stop the API/worker, point `current` to an earlier release compatible with the current schema, and restart. Do not automatically downgrade the database. If restoring a backup is unavoidable, use the procedure below, retaining a copy of the recent state first.

## Backup and restoration

Backup uses the [SQLite backup API](https://www.sqlite.org/backup.html), followed by `integrity_check` and `foreign_key_check`. Do not copy only the `.db` while the application is writing: the WAL may contain data not yet incorporated into that file.

```bash
sudo -u maia-lms node --env-file=/etc/maia-lms/app.env \
  /opt/maia-lms/current/scripts/backup.mjs \
  /var/lib/maia-lms/backups/manual-2026-09-27.db
```

Use new filenames; the command refuses to overwrite files. Schedule daily backups, send encrypted copies to another machine and define retention. Back up storage and configuration separately. The file contains personal data, sessions and pending email tokens; restrict access to backups too.

For a local bundle containing a verified SQLite snapshot and a copy of the complete
media storage root, set both `DATABASE_URL` and `STORAGE_ROOT` in the process
environment and use a new destination directory:

```bash
npm run backup:bundle -- /path/to/new-backup-directory
```

The bundle contains `database.sqlite`, `storage/`, and a `manifest.json` with
database checks, per-file SHA-256 hashes, sizes, and referenced-object validation.
It refuses to overwrite a destination, follow storage symlinks, or produce a
successful manifest if any database-referenced storage object is missing.
Environment files, credentials, and other secrets are intentionally excluded.
The database snapshot and media copy are separate operations; stop API and worker
writes before a production recovery point that must be mutually consistent. The
bundle feature is locally tested and does not replace off-site encryption,
retention policy, or a rehearsed restore on the target host.

Verify an existing bundle after transferring or storing it, then restore it to a
new directory whose parent already exists:

```bash
npm run backup:verify -- /path/to/backup-directory
npm run restore:bundle -- /path/to/backup-directory /path/to/new-recovery-directory
```

Verification recalculates database/media sizes and SHA-256 hashes, checks the
exact storage inventory, reruns SQLite integrity and foreign-key checks, and
requires every database-referenced object to be present. Unsupported manifests,
duplicate/unsafe paths, symlinks, extra files and SQLite sidecars fail explicitly.
Hashes detect accidental corruption, not deliberate replacement of both files and
manifest; keep backups in trusted, access-controlled storage.

Restoration verifies the source before creating the destination, refuses any
existing destination or one nested inside the bundle, copies with private
permissions, and revalidates the restored copy. It writes a completion manifest
only for a successfully verified copy; failure can leave a partial directory
without a completion manifest. Preserve it for diagnosis or choose a new directory
for a retry. The command does not load `.env`, overwrite the live database,
configure/start services, apply migrations, or invalidate sessions.

The automated local recovery rehearsal runs with:

```bash
VIDEO_TEST_REAL=1 npm test -- --run apps/api/src/backup-recovery.test.ts apps/api/src/db/backup.test.ts
```

It uses fictional accounts, temporary directories and loopback HTTP servers on
ephemeral ports. It processes real video, publishes a replacement revision, issues
a certificate/PDF and records progress before backup. After stopping the source
application and moving its database/storage offline, it restores and starts an
isolated application to check old-revision MP4/Range/HLS, captions/poster,
progress read/write, certificate verification/PDF bytes and access restrictions.
This is HTTP delivery validation, not browser decoding or physical-device playback;
no services or configuration on the target host are exercised.

New bundles normalize the SQLite snapshot (not the live database) to DELETE
journal mode so recovery needs no WAL/SHM files. Older bundles using WAL mode must
be recreated with the updated backup command; do not manually remove sidecars
from a database that may depend on them.

Test restoration in an isolated directory first, running `PRAGMA integrity_check` and `PRAGMA foreign_key_check` and starting a test instance with the restored file. For actual recovery:

1. Stop `maia-lms-worker` and `maia-lms`.
2. Preserve the entire current directory, including any `-wal` and `-shm` files.
3. Place the verified backup in a **new** restoration directory with permissions for `maia-lms`; never overwrite a `.db` while leaving old WAL files alongside it.
4. Set `DATABASE_URL` in `app.env` to the new file; restore the corresponding storage if applicable.
5. Apply the selected release's migrations, restart and check `/readyz`, login and progress.
6. Record recovery time and data loss since the backup. Decide whether old sessions and email tokens must be invalidated before reopening the site.

## Email and monitoring

The worker claims email jobs in an `IMMEDIATE` transaction, assigns a five-minute lease and retries up to five times with backoff. Failure does not mark the event as processed. Delivery is at least once: a crash after SMTP acceptance may duplicate an email. Unsupported events fail rather than pretending that transcoding or certificate issuance succeeded.

Inspect `outbox` for events with `processed_at IS NULL` and `attempts >= 5`. After fixing the cause, an operator can reset `attempts`, clear `lease_token` and set `available_at=datetime('now')` for selected IDs. Avoid bulk reprocessing without evaluating duplicates.

Monitor readiness, errors, queue age, free space, backups, TLS renewal and VPN operation. There is no automatic remote deployment: running installers at the destination and validating DNS/TLS/SMTP depends on each machine's actual configuration.

The admin-only `/admin/operations` page summarizes worker heartbeat state, media
jobs/stalls, outbox and email retries, payment order states, storage capacity, and
safe alert codes. Migration 090 records each worker process every ten seconds;
heartbeats older than 45 seconds are stale. `/readyz` checks only API/SQLite
readiness and is not a worker health check. Migration 092 stores daily playback
counts by resource type and HTTP status class; it does not store paths, IDs,
IP addresses, or payloads. Migration 094 adds response-duration sums and measured
response counts. The dashboard shows a seven-day UTC window, with a weighted
average completion time in milliseconds and sample count; historical requests
without timings do not lower the average and an empty sample shows "Not measured".
The playback section also displays all five HTTP status classes (1xx–5xx),
including zero counts, using the same seven-day window. These are request counts,
not viewers or failed playback sessions: 4xx includes access denials and missing
resources, while 5xx indicates server errors. A request may be a playlist,
segment, caption, poster, or MP4 request; one viewing session can make many requests.
The timing ends at the server's response `finish` event, not at the client's
download completion; it is not time to first byte or playback startup/buffering.
Aborted responses are excluded. Playback start/buffering and watch-time telemetry
remain unavailable, and dashboard alerts are not delivered to an external channel.

## Repairing permissions from earlier installations

If Node logs `MODULE_NOT_FOUND` for `current/apps/api/dist/server.js` or `current/apps/worker/dist/worker.js`, inspect the path with:

```bash
namei -l /opt/maia-lms/current/apps/api/dist/server.js
sudo journalctl -u maia-lms -u maia-lms-worker -n 100 --no-pager --full
```

The initial installer left `umask 077` active after creating secrets: the build produced `dist` directories with mode 0700, which became inaccessible to the service after ownership changed to root. The corrected installer limits that mask to creating the secrets file, normalizes artifact readability and checks entry points as user `maia-lms` before activating the release.

To repair an affected installation without reinstalling or modifying the database, run from the updated checkout:

```bash
sudo ./scripts/repair-permissions.sh
```

The repair changes only the readability of active-release code and systemd units, preserves secret/data permissions, and restarts the API and worker.

## Upgrading for video lessons (migration 005)

Install `ffmpeg` on the host (`sudo apt-get install -y ffmpeg`) before running the host installer. It checks FFmpeg and FFprobe before stopping services. There is no new VPS port: 512 KiB chunks fit the current 1 MiB limit. See the [video guide](13-video.md) for limits, disk usage, backup and testing through the domain.

## Expired incomplete uploads

After migration 009, the worker performs cleanup at startup and hourly. Each sweep
expires up to 50 unreferenced uploads still UPLOADING after seven days without a
committed chunk. Existing uploads receive a fresh seven-day window during migration.
Any lesson or attachment reference, including an old draft, prevents expiration.
READY, QUEUED, PROCESSING, and FAILED records are outside this expiration policy.

Expired uploads become CANCELLED with UPLOAD_EXPIRED and stop reserving quota.
Their registered chunks are deleted; canceled uploads with leftover chunks are
also retried in batches of up to 50. Failed deletions remain recorded for the next
sweep and produce an `Upload cleanup failed` worker log. Check storage permissions
and disk health if that message recurs. No published output files are removed.
Resume an expired upload by starting a new upload; the old offset is no longer usable.
Unregistered orphan files, empty directories, failed transcodes, and referenced
abandoned drafts require the future media lifecycle workflow, not this sweep.

## Attachment scanner configuration

`ATTACHMENT_SCAN_MODE` accepts `disabled` (default) or `clamav`. Configure it in
`/etc/maia-lms/app.env` for systemd, or the worker environment for containers.
Before enabling, install the scanner and current signatures in that same runtime
and verify access as the service user. Production fails closed if scanning is
disabled or if ClamAV is missing/failing; development/test may use `disabled` for
local work. Existing READY files are not rescanned automatically.
Deployment steps and limits are in [materials](14-materials.md#optional-malware-inspection).

## Course cover upgrade

Apply migration 010 before restarting the updated API and worker. It adds optional
cover metadata to revisions; existing courses remain valid without covers. Covers
use the existing private storage and normalized PNG/JPEG processing. No new public
port or Maia Edge configuration is required. Cover requests are authorized by
revision and return private, no-store responses.

## Course presentation upgrade

Apply migration 011 before starting the updated API. It adds prerequisites to
course revisions with an empty default. Existing objectives, level, and workload
columns retain their values. No new services or Maia Edge configuration are needed.

## Instructor and terms upgrade

Apply migration 012 before starting the updated API. Existing courses receive empty
instructor and terms fields. No account roles, enrollment policies, or certificate
behavior change. No additional service or Maia Edge configuration is required.

## Course trailer upgrade

Apply migration 013 before restarting the updated API and worker. Trailers reuse
the existing video processing, private storage, and authorized Range delivery over
Maia Edge. No new ports or services are required. Published course trailers are
public promotional media; their underlying lesson access rules remain unchanged.

## Upgrading for course categories

Apply migration 014 before starting the updated API. It creates the taxonomy and
revision-assignment tables; existing courses remain uncategorized. The host installer
applies pending migrations as part of its normal upgrade. No new service, environment
variable, port, or Maia Edge configuration is required.
