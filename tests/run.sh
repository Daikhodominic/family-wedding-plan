#!/usr/bin/env bash
# Run the browser regression tests against a local copy of the site (demo mode).
# Needs: python3, playwright (Chromium) and Pillow.   Usage: tests/run.sh
set -uo pipefail
cd "$(dirname "$0")"
mkdir -p shots
started=0
if ! curl -s -o /dev/null http://localhost:8765/index.html; then
  (cd .. && python3 -m http.server 8765 >/dev/null 2>&1 & echo $! > /tmp/fwp-test-server.pid); started=1; sleep 1
fi
v=$(grep -o 'app.js?v=[0-9]*' ../index.html | head -1 | sed 's/.*v=//')
fail=0
for t in t7 t8 t10 t11 t12 t15 t16 t18 t20 t21 t22 t23 t24 t25 t26 t27 t28 t29 t30 t32 t33 t34 t35 t36 t37 t38 t39 t40 t41 t42; do
  if out=$(timeout 300 python3 $t.py 2>&1); then echo "ok   $t"; else echo "FAIL $t"; echo "$out" | tail -5; fail=1; fi
done
timeout 300 python3 t43.py >/dev/null 2>&1 && echo "ok   t43" || { echo "FAIL t43"; fail=1; }
timeout 300 python3 t44.py >/dev/null 2>&1 && echo "ok   t44" || { echo "FAIL t44"; fail=1; }
timeout 300 python3 t31.py "$v" >/dev/null 2>&1 && echo "ok   t31" || { echo "FAIL t31"; fail=1; }
[ "$started" = 1 ] && kill "$(cat /tmp/fwp-test-server.pid)" 2>/dev/null
exit $fail
