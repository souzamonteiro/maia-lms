#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-help}" in
  host|onprem) shift; exec "$ROOT/scripts/install-host.sh" "$@" ;;
  vps) shift; exec "$ROOT/scripts/install-vps.sh" "$@" ;;
  *) printf '%s\n' 'Usage: ./install.sh host|vps [options]' 'Run ./install.sh host --help or ./install.sh vps --help.' ;;
esac
