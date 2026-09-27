#!/usr/bin/env bash
set -Eeuo pipefail
DOMAIN=learn.maiaplatform.org UPSTREAM= EDGE_DIR= CERT= KEY= DRY_RUN=0
usage() {
  cat <<'HELP'
Usage: sudo ./install.sh vps --edge-dir /opt/maia-edge --upstream 10.77.0.2:3200 [--domain learn.maiaplatform.org] [--cert /path/fullchain.pem --key /path/privkey.pem] [--dry-run]
Registers an HTTPS proxy using the existing Maia Edge CLI and VPN. Does not create or replace WireGuard peers.
Certificate defaults: /etc/letsencrypt/live/DOMAIN/{fullchain,privkey}.pem.
Issue the certificate first (e.g. Certbot DNS challenge); configure renewal separately.
HELP
}
while (($#)); do
  case "$1" in
    --edge-dir) EDGE_DIR="${2:?Missing directory}"; shift 2 ;;
    --upstream) UPSTREAM="${2:?Missing upstream}"; shift 2 ;;
    --domain) DOMAIN="${2:?Missing domain}"; shift 2 ;;
    --cert) CERT="${2:?Missing certificate}"; shift 2 ;;
    --key) KEY="${2:?Missing private key}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
[[ "$DOMAIN" =~ ^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$ ]] || { echo 'Invalid domain.' >&2; exit 1; }
[[ "$UPSTREAM" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}$ ]] || { echo 'Pass --upstream IPv4:port.' >&2; exit 1; }
IFS=.: read -r a b c d port <<< "$UPSTREAM"
for octet in "$a" "$b" "$c" "$d"; do ((10#$octet <= 255)) || { echo 'Invalid upstream IPv4.' >&2; exit 1; }; done
((10#$port > 0 && 10#$port <= 65535)) || { echo 'Invalid upstream port.' >&2; exit 1; }
[[ -x "$EDGE_DIR/bin/maia-edge" ]] || { echo 'Pass --edge-dir pointing to the Maia Edge repository.' >&2; exit 1; }
CERT="${CERT:-/etc/letsencrypt/live/$DOMAIN/fullchain.pem}"
KEY="${KEY:-/etc/letsencrypt/live/$DOMAIN/privkey.pem}"
printf 'HTTPS route: %s → %s\n' "$DOMAIN" "$UPSTREAM"
printf 'Command: %q service add %q proxy %q 443 %q %q\n' "$EDGE_DIR/bin/maia-edge" "$DOMAIN" "$UPSTREAM" "$CERT" "$KEY"
((DRY_RUN)) && exit 0
((EUID == 0)) || { echo 'Run with sudo, or use --dry-run.' >&2; exit 1; }
[[ -r "$CERT" && -r "$KEY" ]] || { echo 'TLS certificate/key not found. Issue the certificate first; see docs/08-operations.md.' >&2; exit 1; }
curl --noproxy '*' --connect-timeout 5 --max-time 10 -fsS "http://$UPSTREAM/readyz" >/dev/null
"$EDGE_DIR/bin/maia-edge" service add "$DOMAIN" proxy "$UPSTREAM" 443 "$CERT" "$KEY"
"$EDGE_DIR/bin/maia-edge" plan
"$EDGE_DIR/bin/maia-edge" apply
printf '%s\n' "Route installed. Point DNS to this VPS and verify https://$DOMAIN/readyz. Existing Maia Edge apply may restart its managed WireGuard interface."
