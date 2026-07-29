#!/usr/bin/env bash
set -euo pipefail

log_file="/tmp/emmanuel-portfolio-next.log"
font_cache="/tmp/emmanuel-portfolio-font-cache"
mkdir -p "$font_cache/fontconfig"

npx next start -H 127.0.0.1 -p 3000 >"$log_file" 2>&1 &
server_pid=$!

cleanup() {
  kill "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT

for _ in {1..50}; do
  if curl -fsS http://127.0.0.1:3000 >/dev/null; then
    break
  fi
  sleep 0.2
done

if ! curl -fsS http://127.0.0.1:3000 >/dev/null; then
  sed -n '1,160p' "$log_file"
  exit 1
fi

XDG_CACHE_HOME="$font_cache" VERCEL= node scripts/visual-verify.mjs
