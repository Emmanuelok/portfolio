#!/usr/bin/env bash
set -euo pipefail

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
port="${VISUAL_VERIFY_PORT:-3000}"
base_url="http://127.0.0.1:${port}"
log_file="${VISUAL_VERIFY_SERVER_LOG:-/tmp/kingxford-visual-next.log}"
font_cache="${VISUAL_VERIFY_FONT_CACHE:-/tmp/kingxford-visual-font-cache}"
browser_tmp="$(mktemp -d /tmp/kingxford-browser.XXXXXX)"

cd "$app_root"
mkdir -p "$font_cache/fontconfig"

if [[ ! -f .next/BUILD_ID ]]; then
  echo "No production build was found. Run 'npm run build' before visual verification."
  exit 1
fi

if curl -sS --connect-timeout 0.2 "$base_url" >/dev/null 2>&1; then
  echo "Port ${port} is already serving another process. Set VISUAL_VERIFY_PORT to a free port."
  exit 1
fi

AI_GATEWAY_API_KEY="" \
VERCEL_OIDC_TOKEN="" \
VERCEL="" \
KINGXFORD_USAGE_HASH_SALT="" \
KINGXFORD_ALLOW_EPHEMERAL_USAGE="" \
KINGXFORD_ALLOW_EPHEMERAL_CONTACT="" \
UPSTASH_REDIS_REST_URL="" \
UPSTASH_REDIS_REST_TOKEN="" \
KV_REST_API_URL="" \
KV_REST_API_TOKEN="" \
NEXT_PUBLIC_SUPABASE_URL="" \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="" \
SUPABASE_SERVICE_ROLE_KEY="" \
RESEND_API_KEY="" \
CONTACT_FROM_EMAIL="" \
CONTACT_INBOX_EMAIL="" \
NEXT_PUBLIC_CONTACT_EMAIL="" \
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
node scripts/visual-verify.mjs
visual_status=$?
set -e

if [[ "$visual_status" -ne 0 ]]; then
  sed -n '1,180p' "$log_file"
fi

exit "$visual_status"
