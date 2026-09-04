# Live status

Generated: 2026-09-04T14:31:14Z

## Pod
{'id': 'c7togjwbwnqjqi',
 'name': 'open-webui-v0-11-3-cpu-20260904',
 'desiredStatus': 'RUNNING',
 'imageName': 'ghcr.io/open-webui/open-webui:v0.11.3',
 'machineType': 'CPU',
 'networkVolumeId': 'i6b6qi97gx',
 'volumeMountPath': '/app/backend/data',
 'runtime': {'uptimeInSeconds': 3116,
             'ports': [{'privatePort': 19123,
                        'publicPort': 60794,
                        'type': 'http'},
                       {'privatePort': 8080,
                        'publicPort': 60795,
                        'type': 'http'}]},
 'machine': {'cpuCount': 1,
             'gpuDisplayName': 'unknown',
             'dataCenterId': 'US-KS-2'}}

## HTTP
health: {"status":true}
config: {"onboarding":true,"status":true,"name":"Open WebUI","version":"0.11.3","default_locale":"","oauth":{"providers":{},"auto_redirect":false},"features":{"auth":true,"auth_trusted_header":false,"enable_signup_password_confirmation":false,"enable_ldap":false,"enable_signup":true,"enable_login_form":true,"enable_websocket":true}}

## Blockers
- onboarding still true (no admin JWT)
- OPENROUTER_API_KEY not in agent env
- OPENAI_API_KEY not in agent env
- EXA_API_KEY / TAVILY_API_KEY not in agent env

## Package
/home/runner/work/openvenice/openvenice/open-webui-workstation/README.md
/home/runner/work/openvenice/openvenice/open-webui-workstation/computer/docker-compose.yml
/home/runner/work/openvenice/openvenice/open-webui-workstation/config/admin-checklist.md
/home/runner/work/openvenice/openvenice/open-webui-workstation/config/env.full.example
/home/runner/work/openvenice/openvenice/open-webui-workstation/config/env.phase1.example
/home/runner/work/openvenice/openvenice/open-webui-workstation/config/model-profiles.json
/home/runner/work/openvenice/openvenice/open-webui-workstation/config/system-prompt.txt
/home/runner/work/openvenice/openvenice/open-webui-workstation/docs/ARCHITECTURE.md
/home/runner/work/openvenice/openvenice/open-webui-workstation/docs/BUILD_ORDER.md
/home/runner/work/openvenice/openvenice/open-webui-workstation/docs/STATUS.md
/home/runner/work/openvenice/openvenice/open-webui-workstation/functions/council_maximum_intelligence.py
/home/runner/work/openvenice/openvenice/open-webui-workstation/functions/router_curated.py
/home/runner/work/openvenice/openvenice/open-webui-workstation/scripts/apply_notes.md
/home/runner/work/openvenice/openvenice/open-webui-workstation/scripts/verify_live.sh
