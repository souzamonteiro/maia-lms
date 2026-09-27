#!/usr/bin/env bash
# Repair releases installed with the original installer's leaked umask 077.
set -Eeuo pipefail
((EUID == 0)) || { echo 'Run with sudo: sudo ./scripts/repair-permissions.sh' >&2; exit 1; }
exec 9>/run/lock/maia-lms-install.lock
flock -n 9 || { echo 'Another installation is running.' >&2; exit 1; }
release="$(readlink -f /opt/maia-lms/current)"
[[ "$release" == /opt/maia-lms/releases/* && -d "$release" ]] || { echo 'Current release is outside /opt/maia-lms/releases.' >&2; exit 1; }
for entry in apps/api/dist/server.js apps/worker/dist/worker.js; do
  [[ -f "$release/$entry" ]] || { echo "Missing build artifact: $entry. Reinstall the application." >&2; exit 1; }
done
# Only application code is changed. Secrets and database permissions are preserved.
chmod -R a+rX,go-w "$release"
for entry in apps/api/dist/server.js apps/worker/dist/worker.js; do
  runuser -u maia-lms -- test -r "$release/$entry"
done
chmod 0644 /etc/systemd/system/maia-lms.service /etc/systemd/system/maia-lms-worker.service
systemctl daemon-reload
systemctl restart maia-lms.service maia-lms-worker.service
sleep 2
systemctl --no-pager --full status maia-lms.service maia-lms-worker.service
