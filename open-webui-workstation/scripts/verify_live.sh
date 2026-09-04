#!/usr/bin/env bash
# Read-only live verification for the Open WebUI workstation pod.
set -euo pipefail

POD_ID="${POD_ID:-c7togjwbwnqjqi}"
URL="${OWUI_URL:-https://${POD_ID}-8080.proxy.runpod.net}"

echo "== Health =="
curl -fsS --max-time 20 "$URL/health"
echo

echo "== Config =="
curl -fsS --max-time 20 "$URL/api/config" | python3 -m json.tool

echo "== Root =="
code=$(curl -sS -o /tmp/owui_root.html -w "%{http_code}" --max-time 20 "$URL/")
echo "HTTP $code"
python3 - <<'PY'
import re
html=open('/tmp/owui_root.html',errors='replace').read()
m=re.search(r'<title>(.*?)</title>', html, re.I|re.S)
print('title:', m.group(1).strip() if m else None)
PY

if [[ -n "${RUNPOD_API_KEY:-}" ]]; then
  echo "== RunPod pod =="
  curl -fsS -X POST "https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d "{\"query\":\"query { pod(input:{podId:\\\"${POD_ID}\\\"}) { id name desiredStatus imageName machineType networkVolumeId volumeMountPath runtime { uptimeInSeconds ports { privatePort publicPort type } } machine { cpuCount gpuDisplayName dataCenterId } } }\"}" \
    | python3 -c "import sys,json,re; r=sys.stdin.read(); r=re.sub(r'(KEY=)[^\\\"\\s]+',r'\\1***',r); print(json.dumps(json.loads(''.join(c if ord(c)>=32 or c in '\\n\\t' else ' ' for c in r)), indent=2))"
fi

echo "Done."
