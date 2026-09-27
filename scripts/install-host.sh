#!/usr/bin/env bash
set -Eeuo pipefail
# Build artifacts and systemd units must be readable by the service user.
umask 022
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST_IP= PROXY_IP= PORT=3200 DOMAIN=learn.maiaplatform.org DRY_RUN=0
usage() {
  cat <<'HELP'
Usage: sudo ./install.sh host --host-ip 10.77.0.2 --proxy-ip 10.77.0.1 [--port 3200] [--domain learn.maiaplatform.org] [--dry-run]
Requires Linux/systemd, Node.js >=22.12, npm, rsync, curl, openssl, Python3, make and g++.
Uses an existing WireGuard tunnel; does not modify VPN, DNS or firewall.
Installs releases under /opt/maia-lms, data in /var/lib/maia-lms and secrets in /etc/maia-lms/app.env.
Existing app.env is preserved on upgrades. Configure SMTP there and restart the worker.
HELP
}
while (($#)); do
  case "$1" in
    --host-ip) HOST_IP="${2:?Missing host IP}"; shift 2 ;;
    --proxy-ip) PROXY_IP="${2:?Missing proxy IP}"; shift 2 ;;
    --port) PORT="${2:?Missing port}"; shift 2 ;;
    --domain) DOMAIN="${2:?Missing domain}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
valid_ip() { local a b c d; [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1; IFS=. read -r a b c d <<< "$1"; for a in "$a" "$b" "$c" "$d"; do ((10#$a <= 255)) || return 1; done; [[ "$1" != 0.0.0.0 ]]; }
valid_ip "$HOST_IP" && valid_ip "$PROXY_IP" || { echo 'Pass valid --host-ip and --proxy-ip IPv4 addresses.' >&2; exit 1; }
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] && ((10#$PORT > 1024 && 10#$PORT <= 65535)) || { echo 'Port must be 1025-65535.' >&2; exit 1; }
[[ "$DOMAIN" =~ ^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$ ]] || { echo 'Invalid domain' >&2; exit 1; }
printf 'Application: https://%s → %s:%s; trusted proxy: %s\n' "$DOMAIN" "$HOST_IP" "$PORT" "$PROXY_IP"
printf '%s\n' 'Plan: build an isolated release, back up SQLite, apply migrations, install/restart API and email worker systemd units, check /readyz.'
((DRY_RUN)) && exit 0
((EUID == 0)) || { echo 'Run with sudo, or use --dry-run.' >&2; exit 1; }
for tool in node npm rsync curl openssl systemctl runuser python3 make g++ ip flock; do command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool" >&2; exit 1; }; done
case "$(readlink -f "$(command -v node)")" in /home/*|/root/*) echo 'Install Node.js in a system path; the service has ProtectHome enabled.' >&2; exit 1 ;; esac
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22 && b<12)) process.exit(1)' || { echo 'Node.js >=22.12 required.' >&2; exit 1; }
[[ "$(ip -4 addr show)" == *"inet $HOST_IP/"* ]] || { echo 'The host IP must already be assigned to this machine.' >&2; exit 1; }
exec 9>/run/lock/maia-lms-install.lock
flock -n 9 || { echo 'Another installation is running.' >&2; exit 1; }
id maia-lms >/dev/null 2>&1 || useradd --system --home-dir /var/lib/maia-lms --shell /usr/sbin/nologin maia-lms
install -d -m 0755 /opt/maia-lms/releases
install -d -o maia-lms -g maia-lms -m 0700 /var/lib/maia-lms /var/lib/maia-lms/storage /var/lib/maia-lms/backups /var/cache/maia-lms
install -d -m 0750 -o root -g maia-lms /etc/maia-lms
if [[ ! -e /etc/maia-lms/app.env ]]; then
  (
  umask 077
  cat > /etc/maia-lms/app.env <<ENV
NODE_ENV=production
HOST=$HOST_IP
PORT=$PORT
TRUST_PROXY=$PROXY_IP
PUBLIC_BASE_URL=https://$DOMAIN
DATABASE_URL=/var/lib/maia-lms/maia-lms.db
STORAGE_ROOT=/var/lib/maia-lms/storage
SESSION_SECRET=$(openssl rand -hex 32)
MEDIA_SIGNING_KEY=$(openssl rand -hex 32)
MAIL_TRANSPORT=smtp://localhost:1025
MAIL_FROM=noreply@$DOMAIN
WORKER_CONCURRENCY=4
ENV
  )
  chown root:maia-lms /etc/maia-lms/app.env
  chmod 0640 /etc/maia-lms/app.env
fi
release="/opt/maia-lms/releases/$(date -u +%Y%m%dT%H%M%S)-$$"
install -d -o maia-lms -g maia-lms -m 0755 "$release"
rsync -a --exclude=.git --exclude=node_modules --exclude=dist --exclude=.env --exclude='*.db*' --exclude=data --exclude=coverage "$ROOT/" "$release/"
chown -R maia-lms:maia-lms "$release"
runuser -u maia-lms -- env npm_config_cache=/var/cache/maia-lms npm --prefix "$release" ci
runuser -u maia-lms -- npm --prefix "$release" run build
# Stop both writers before migration. A failed migration leaves services stopped and backups intact.
systemctl stop maia-lms-worker.service maia-lms.service 2>/dev/null || true
if [[ -f /var/lib/maia-lms/maia-lms.db ]]; then
  runuser -u maia-lms -- node --env-file=/etc/maia-lms/app.env "$release/scripts/backup.mjs" "/var/lib/maia-lms/backups/pre-install-$(date -u +%Y%m%dT%H%M%S)-$$.db"
fi
runuser -u maia-lms -- node --env-file=/etc/maia-lms/app.env "$release/apps/api/dist/db/migrate.js"
chown -R root:root "$release"
chmod -R a+rX,go-w "$release"
# Check readability after ownership changes, before activating this release.
for entry in apps/api/dist/server.js apps/worker/dist/worker.js; do
  runuser -u maia-lms -- node --check "$release/$entry"
done
ln -sfnT "$release" /opt/maia-lms/current.new
mv -Tf /opt/maia-lms/current.new /opt/maia-lms/current
node_path="$(command -v node)"
for service in api worker; do
  unit=maia-lms; entry=apps/api/dist/server.js; after='network-online.target'; requires=''
  if [[ "$service" == worker ]]; then unit=maia-lms-worker; entry=apps/worker/dist/worker.js; after='maia-lms.service'; requires='Requires=maia-lms.service'; fi
  cat > "/etc/systemd/system/$unit.service" <<UNIT
[Unit]
Description=Maia LMS $service
After=$after
$requires
[Service]
Type=simple
User=maia-lms
Group=maia-lms
WorkingDirectory=/opt/maia-lms/current
EnvironmentFile=/etc/maia-lms/app.env
ExecStart=$node_path /opt/maia-lms/current/$entry
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/maia-lms
[Install]
WantedBy=multi-user.target
UNIT
  chmod 0644 "/etc/systemd/system/$unit.service"
done
systemctl daemon-reload
systemctl enable --now maia-lms.service maia-lms-worker.service
# Read effective bind values from the preserved configuration, without sourcing it as shell code.
bind="$(node --env-file=/etc/maia-lms/app.env -p 'process.env.HOST + ":" + process.env.PORT')"
for attempt in {1..20}; do
  if curl --noproxy '*' -fsS "http://$bind/readyz" >/dev/null; then
    printf '%s\n' 'Installation complete. Configure MAIL_TRANSPORT in /etc/maia-lms/app.env, then restart maia-lms-worker.' 'Create the administrator using the instructions in docs/08-operations.md.'
    exit 0
  fi
  sleep 1
done
printf '%s\n' 'Readiness failed. Inspect journalctl -u maia-lms -u maia-lms-worker. The previous release and pre-install backup are retained.' >&2
exit 1
