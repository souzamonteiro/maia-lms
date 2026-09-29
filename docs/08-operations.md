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

There is no default password. Create authors through a controlled database administration procedure; the current interface creates learners and courses but does not manage user roles.

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
