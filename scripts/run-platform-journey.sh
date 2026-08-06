#!/usr/bin/env bash
set -euo pipefail

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
port="${PLATFORM_JOURNEY_PORT:-3417}"
base_url="http://127.0.0.1:${port}"
log_file="${PLATFORM_JOURNEY_SERVER_LOG:-/tmp/kingxford-platform-journey-next.log}"
font_cache="${PLATFORM_JOURNEY_FONT_CACHE:-/tmp/kingxford-platform-journey-font-cache}"
browser_tmp="$(mktemp -d /tmp/kingxford-platform-journey-browser.XXXXXX)"

cd "$app_root"
mkdir -p "$font_cache/fontconfig"

if [[ ! -f .next/BUILD_ID ]]; then
  echo "No production build was found. Run 'npm run build' before this journey."
  exit 1
fi

if curl -sS --connect-timeout 0.2 "$base_url" >/dev/null 2>&1; then
  echo "Port ${port} is already serving another process. Set PLATFORM_JOURNEY_PORT to a free port."
  exit 1
fi

AI_GATEWAY_API_KEY="" \
VERCEL_OIDC_TOKEN="" \
KINGXFORD_USAGE_HASH_SALT="kingxford-platform-journey-local-hmac-salt-v1" \
npx next start -H 127.0.0.1 -p "$port" >"$log_file" 2>&1 &
server_pid=$!

cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  rm -rf -- "$browser_tmp"
}
trap cleanup EXIT

for _ in {1..75}; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    break
  fi
  if curl -fsS "$base_url" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

if ! kill -0 "$server_pid" 2>/dev/null || ! curl -fsS "$base_url" >/dev/null; then
  sed -n '1,180p' "$log_file"
  exit 1
fi

set +e
TMPDIR="$browser_tmp" \
XDG_CACHE_HOME="$font_cache" \
VERIFY_BASE_URL="$base_url" \
AI_GATEWAY_API_KEY="" \
VERCEL_OIDC_TOKEN="" \
VERCEL="" \
node scripts/verify-platform-journey.mjs
journey_status=$?
set -e

if [[ "$journey_status" -ne 0 ]]; then
  sed -n '1,180p' "$log_file"
fi

exit "$journey_status"
