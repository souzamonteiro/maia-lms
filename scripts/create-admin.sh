#!/usr/bin/env bash
# Production administrator setup: prompt AFTER sudo, then drop privileges.
set +x
set -Eeuo pipefail
if ((EUID != 0)); then
  echo 'Run with sudo: sudo ./scripts/create-admin.sh you@domain.com [--reset]' >&2
  exit 1
fi
email="${1:-}"
reset="${2:-}"
# bash's [[ =~ ]] uses POSIX ERE, where backslash has no special meaning inside [...].
if [[ ! "$email" =~ ^[^][:space:]()]+@[^][:space:]()]+\.[^][:space:]()]+$ ]]; then
  echo 'Provide a plain email, without brackets, links or mailto:.' >&2
  exit 1
fi
if [[ -n "$reset" && "$reset" != '--reset' ]]; then
  echo "Unknown option: $reset" >&2
  exit 1
fi
[[ -r /opt/maia-lms/current/scripts/admin.mjs ]] || { echo 'Installation not found at /opt/maia-lms/current.' >&2; exit 1; }
[[ -t 0 ]] || { echo 'Run this in an interactive terminal.' >&2; exit 1; }
trap 'unset ADMIN_PASSWORD confirmation' EXIT
read -r -s -p 'New administrator password (12-128 characters): ' ADMIN_PASSWORD
printf '\n'
if ((${#ADMIN_PASSWORD} < 12 || ${#ADMIN_PASSWORD} > 128)); then
  echo 'The password must be between 12 and 128 characters.' >&2
  exit 1
fi
read -r -s -p 'Confirm the password: ' confirmation
printf '\n'
[[ "$ADMIN_PASSWORD" == "$confirmation" ]] || { echo 'Passwords do not match.' >&2; exit 1; }
unset confirmation
export ADMIN_PASSWORD
# runuser without --login preserves ADMIN_PASSWORD; sudo has already run.
runuser -u maia-lms -- node --env-file=/etc/maia-lms/app.env \
  /opt/maia-lms/current/scripts/admin.mjs "$email" ${reset:+--reset}
