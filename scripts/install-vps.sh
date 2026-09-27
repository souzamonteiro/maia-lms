#!/usr/bin/env bash
set -Eeuo pipefail
umask 022
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Backward-compatible, explicitly requested CLI-managed deployment.
for arg in "$@"; do
  if [[ "$arg" == --edge-dir ]]; then exec "$ROOT/scripts/install-vps-edge.sh" "$@"; fi
done
DOMAIN=learn.maiaplatform.org UPSTREAM= CERT= KEY= DRY_RUN=0 ACME=0
while (($#)); do
  case "$1" in
    --domain) DOMAIN="${2:?Missing domain}"; shift 2 ;;
    --upstream) UPSTREAM="${2:?Missing upstream}"; shift 2 ;;
    --cert) CERT="${2:?Missing certificate}"; shift 2 ;;
    --key) KEY="${2:?Missing key}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --acme-only) ACME=1; shift ;;
    --help|-h)
      echo 'Usage: sudo ./install.sh vps --upstream 10.77.0.2:3200 [--acme-only] [--dry-run] [--domain DOMAIN] [--cert PATH --key PATH]'
      echo 'Installs a VPS Nginx site using the existing VPN, as in maia-chat. --acme-only prepares HTTP certificate issuance.'
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done
args=(--domain "$DOMAIN" --upstream "$UPSTREAM")
[[ -z "$CERT" ]] || args+=(--cert "$CERT")
[[ -z "$KEY" ]] || args+=(--key "$KEY")
((ACME == 0)) || args+=(--acme-only)
candidate="$(python3 "$ROOT/scripts/render-nginx.py" "${args[@]}")"
if ((DRY_RUN)); then printf '%s\n' "$candidate"; exit 0; fi
((EUID == 0)) || { echo 'Run with sudo or use --dry-run.' >&2; exit 1; }
for tool in nginx systemctl curl flock; do command -v "$tool" >/dev/null || { echo "Missing dependency: $tool" >&2; exit 1; }; done
exec 9>/run/lock/maia-lms-vps.lock
flock -n 9 || { echo 'Another VPS installation is running.' >&2; exit 1; }
site="/etc/nginx/sites-available/$DOMAIN.conf"
link="/etc/nginx/sites-enabled/$DOMAIN.conf"
if [[ -e "$site" ]] && ! head -n 1 "$site" | grep -Fxq '# Managed by maia-lms install-vps.sh'; then
  echo 'Existing site belongs to another installer. Preserve it and resolve the conflict before continuing.' >&2; exit 1
fi
if [[ -e "$link" || -L "$link" ]]; then
  [[ -L "$link" && "$(readlink "$link")" == "$site" ]] || { echo 'Existing activation conflicts with this installer.' >&2; exit 1; }
fi
# Refuse duplicate domain definitions, including sites installed by Maia Edge CLI.
while IFS= read -r file; do
  [[ "$file" == "$link" ]] && continue
  if grep -Eq "^[[:space:]]*server_name[[:space:]][^;]*\b${DOMAIN//./\.}([[:space:];])" "$file"; then
    echo "Domain already configured in $file; keep the existing configuration or explicitly migrate it." >&2; exit 1
  fi
done < <(find -L /etc/nginx/sites-enabled /etc/nginx/conf.d -maxdepth 1 -type f 2>/dev/null)
if ((ACME == 0)); then
  [[ -r "${CERT:-/etc/letsencrypt/live/$DOMAIN/fullchain.pem}" && -r "${KEY:-/etc/letsencrypt/live/$DOMAIN/privkey.pem}" ]] || { echo 'Certificate missing. Run --acme-only and issue it with Certbot first.' >&2; exit 1; }
  curl --noproxy '*' --connect-timeout 5 --max-time 10 -fsS "http://$UPSTREAM/readyz" >/dev/null
fi
install -d -m 0755 /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/html/.well-known/acme-challenge
backup="$(mktemp -d /etc/nginx/maia-lms-backup.XXXXXX)"
had_site=0; had_link=0
if [[ -e "$site" ]]; then cp -p "$site" "$backup/site"; had_site=1; fi
[[ ! -L "$link" ]] || had_link=1
rollback() {
  if ((had_site)); then cp -p "$backup/site" "$site"; else rm -f "$site"; fi
  if ((had_link == 0)); then rm -f "$link"; fi
}
printf '%s\n' "$candidate" > "$site"
chmod 0644 "$site"
ln -sfn "$site" "$link"
if ! nginx -t; then rollback; exit 1; fi
if ! systemctl reload nginx; then rollback; nginx -t && systemctl reload nginx; exit 1; fi
printf 'Installed %s. Previous site retained in %s. VPN unchanged.\n' "$site" "$backup"
