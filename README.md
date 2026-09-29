# Maia Learn / Maia LMS

Course platform at `https://learn.maiaplatform.org`, built with Node.js, TypeScript, Express and **SQLite**. The application and database run on the host machine; the VPS running **Maia Edge** serves HTTPS and forwards requests through the WireGuard VPN.

## Implementation status

The full product plan is tracked in [TODO.md](TODO.md), including the current-state audit, priorities, dependencies and completion criteria.

This version provides **free courses with text, Markdown and MP4 video lessons**:

- Interface internationalization in English, Portuguese and Spanish: catalog, search, course, lesson, registration, login, password recovery and learner area.
- [Markdown editor](docs/12-authoring.md) with formatting tools, preview, draft recovery, autosave and conflict detection.
- Course, module and lesson authoring; drafts independent of publication and administrator-controlled archiving.
- Homepage course selection, ordering and scheduling at `/admin/home`.
- Preserved revisions for existing enrollments; public previews and access control.
- [Video lessons](docs/13-video.md): resumable uploads, FFmpeg processing, poster images, player and saved playback position.
- [Supplementary materials](docs/14-materials.md): PDF, ZIP and source code with titles, descriptions and authorized downloads tied to revisions.
- [WebVTT captions and transcripts](docs/15-captions.md) in Portuguese, English and Spanish, preserved by revision.
- Idempotent enrollment, lesson progress and learning dashboard.
- Persistent SQLite sessions; email outbox with worker delivery retries.
- Host and VPS installers, verifiable backups, HTTP tests and browser tests.

**Not yet implemented:** adaptive HLS and a complete media library, quizzes, checkout/webhooks/refunds, certificates, MFA and account export/deletion. Existing tables and some inherited adapters prepare for these stages but do not make them available features. Product documents describe the full vision; [the roadmap](docs/09-roadmap.md) distinguishes the current state.

## Development

Requirements: Node.js **22.12+** (22 or 24), npm, Python 3, make and a C++ compiler if native modules need compilation. Video processing also requires FFmpeg/FFprobe (`sudo apt-get install -y ffmpeg` on Debian/Ubuntu).

```bash
npm ci
cp .env.example .env
# Replace SESSION_SECRET and MEDIA_SIGNING_KEY with values from: openssl rand -hex 32
npm run build
npm run migrate
npm run dev:api
```

Open `http://localhost:3000`. In another terminal:

```bash
npm run dev:worker
```

Configure SMTP in `MAIL_TRANSPORT`. To capture email locally with Docker:

```bash
docker compose --env-file .env -f infra/docker-compose.yml --profile dev up -d mailpit
```

Open `http://localhost:8025`. Without SMTP, the application works, but verification and password recovery emails remain queued, with up to five delivery attempts.

Create the first administrator without putting the password in shell history:

```bash
read -rsp 'Administrator password (12–128 characters): ' ADMIN_PASSWORD
export ADMIN_PASSWORD
npm run admin -- admin@example.com
unset ADMIN_PASSWORD
```

Sign in with that account and open `/admin`. The command refuses to overwrite an existing account. Users registering through the site receive the learner role.

## Host + VPS

First configure the tunnel using [Maia Edge](../maia-edge/README.md). The IPs below are examples: use the actual addresses of the existing tunnel.

On the host:

```bash
./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1 --dry-run
sudo ./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1
```

On the VPS, with Nginx and the Maia Edge VPN already working (the same pattern as maia-chat):

```bash
./install.sh vps --upstream 10.77.0.2:3200 --dry-run
sudo ./install.sh vps --upstream 10.77.0.2:3200 --acme-only
sudo certbot certonly --webroot -w /var/www/html -d learn.maiaplatform.org
sudo ./install.sh vps --upstream 10.77.0.2:3200
```

The host installer creates systemd services, random secrets, persistent directories and a backup before upgrading. The VPS installer installs the HTTP/HTTPS virtual host, tests and reloads Nginx, and preserves the existing VPN. If the certificate already exists, skip issuance. The legacy CLI mode remains explicitly available through `--edge-dir`; it may restart the managed VPN.

See [the operations guide](docs/08-operations.md) for SMTP, DNS, TLS, firewall, production administrator accounts, upgrades, backups and restoration. The installers provide `--help` and `--dry-run`.

## Optional Docker deployment

```bash
# In .env: PUBLIC_BASE_URL=http://localhost:3200
# MAIL_TRANSPORT=smtp://mailpit:1025
# NODE_ENV=development for local HTTP

docker compose --env-file .env -f infra/docker-compose.yml --profile dev up -d --build
```

The `maia_data` volume contains SQLite and storage. Do not use `down -v` for upgrades. For production, set `NODE_ENV=production`, the HTTPS URL, `BIND_IP` to the VPN IP and `TRUST_PROXY` to the VPS IP; use real SMTP. Compose does not add another Nginx instance or public ports 80/443.

## Validation

```bash
npm run build
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm audit
```

The suite uses temporary databases. To use an installed Chrome browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome` when running browser tests.

## Structure

| Directory | Responsibility |
|---|---|
| `apps/api` | HTTP, authentication, courses, enrollment and progress |
| `apps/web` | HTML, CSS and JavaScript served by the API process |
| `apps/worker` | Independent email and video-processing queues |
| `packages/domain` | Types, validation and policies |
| `packages/providers` | SMTP and adapters reserved for payments/storage |
| `migrations` | Sequential, transactional SQLite migrations |
| `scripts` | Installation, administrator accounts and backup |
| `spec/openapi.yaml` | Implemented API contract |

`/healthz` reports process liveness; `/readyz` checks the database. SQLite uses WAL, foreign keys and a busy timeout on local disk. No PostgreSQL server is required.

License: [Apache 2.0](LICENSE).
