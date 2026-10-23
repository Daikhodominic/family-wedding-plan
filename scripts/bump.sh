#!/usr/bin/env bash
# Bump the cache version everywhere in one go: ?v= on every import, the service worker cache, and the tests.
# Usage: scripts/bump.sh            (from the repo root)
set -euo pipefail
cd "$(dirname "$0")/.."
cur=$(grep -o 'app.js?v=[0-9]*' index.html | head -1 | sed 's/.*v=//')
nxt=$((cur + 1))
sed -i -E "s#\?v=${cur}'#?v=${nxt}'#g" js/*.js
sed -i -E "s#\?v=${cur}([\"'])#?v=${nxt}\1#g" index.html preview.html
sw=$(grep -o "fwp-shell-v[0-9]*" sw.js | sed 's/.*v//')
sed -i "s/fwp-shell-v${sw}/fwp-shell-v$((sw + 1))/" sw.js
[ -d tests ] && sed -i "s/v=${cur}\b/v=${nxt}/g" tests/*.py tests/*.html 2>/dev/null || true
left=$(grep -rl "v=${cur}[\"']" js index.html preview.html || true)
[ -n "$left" ] && { echo "Still on v=${cur}: $left"; exit 1; }
echo "v=${cur} -> v=${nxt}, service worker cache fwp-shell-v$((sw + 1))"
