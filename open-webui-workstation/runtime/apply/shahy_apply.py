#!/usr/bin/env python3
"""
Idempotent Shahy role bootstrap for Open WebUI 0.11.3.

Usage (inside the pod or any trusted host with network to the pod):
  export OWUI_URL=http://localhost:8080   # or the public proxy URL
  python3 shahy_apply.py

The script prompts for admin email and password securely (no echo).
Set DRY_RUN=1 to preview payloads without mutating.
"""
import getpass, json, os, sys, urllib.request, urllib.error

OWUI_URL = os.getenv('OWUI_URL', 'https://8rhrqskupcsqvq-8080.proxy.runpod.net').rstrip('/')
EMAIL = os.getenv('OWUI_EMAIL')
PASSWORD = os.getenv('OWUI_PASSWORD')
DRY_RUN = os.getenv('DRY_RUN', '').strip().lower() in ('1', 'true', 'yes')
UA = 'Shahy-Apply/1.0'


def prompt_creds():
    global EMAIL, PASSWORD
    if not EMAIL:
        EMAIL = input('Open WebUI admin email: ').strip()
    if not PASSWORD:
        PASSWORD = getpass.getpass('Open WebUI admin password: ')


def req(method, path, payload=None, token=None):
    url = f'{OWUI_URL}{path}'
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8') if payload else None
    headers = {
        'User-Agent': UA,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request(url, data=data, method=method, headers=headers, unverifiable=True)
    try:
        with urllib.request.urlopen(request, timeout=30) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return 0, str(e)


def signin():
    code, body = req('POST', '/api/v1/auths/signin', {'email': EMAIL, 'password': PASSWORD})
    if code != 200:
        print(f'[auth] signin failed HTTP {code}: {body[:400]}', file=sys.stderr)
        sys.exit(1)
    token = json.loads(body).get('token')
    if not token:
        print('[auth] no token in signin response', file=sys.stderr)
        sys.exit(1)
    return token


def get_models(token):
    code, body = req('GET', '/api/v1/models/export', token=token)
    if code != 200:
        print(f'[models] export failed HTTP {code}: {body[:400]}', file=sys.stderr)
        return []
    return json.loads(body)


ROLES = [
    {
        "id": "shahy-fast",
        "name": "FAST",
        "base_model_id": "zen.gpt-5.6-luna",
        "meta": {
            "description": "Low-latency routine chat, summaries, email drafts.",
            "capabilities": {"web_search": True, "code_interpreter": False, "vision": False},
            "tags": ["fast", "economy", "daily"]
        },
        "params": {
            "system": "You are FAST — the low-latency, economical workhorse. Write tight, practical responses in English or Arabic as requested. Prefer brevity. Do not philosophize.",
            "temperature": 0.4,
            "top_p": 0.9
        },
        "is_active": True,
    },
    {
        "id": "shahy-smart",
        "name": "SMART",
        "base_model_id": "zen.gpt-5.6-sol",
        "meta": {
            "description": "Primary daily reasoning, Arabic/English business work and analysis.",
            "capabilities": {"web_search": True, "code_interpreter": True, "vision": False},
            "tags": ["smart", "default", "daily"]
        },
        "params": {
            "system": "You are SMART — the primary daily reasoning partner for Arabic and English business work, analysis, and documentation. Be direct, evidence-based, and culturally fluent.",
            "temperature": 0.6,
            "top_p": 0.95
        },
        "is_active": True,
    },
    {
        "id": "shahy-max",
        "name": "MAX",
        "base_model_id": "zen.gpt-6-astra",
        "meta": {
            "description": "Difficult reasoning, complex investigation, premium escalation.",
            "capabilities": {"web_search": True, "code_interpreter": True, "vision": False},
            "tags": ["max", "premium", "investigation"]
        },
        "params": {
            "system": "You are MAX — reserved for the hardest reasoning and multi-stage analysis. Show your work, question assumptions, and deliver thoroughly verified answers. Escalate budget if uncertain.",
            "temperature": 0.5,
            "top_p": 0.95
        },
        "is_active": True,
    },
    {
        "id": "shahy-builder",
        "name": "BUILDER",
        "base_model_id": "zen.gpt-5.6-sol",
        "meta": {
            "description": "Coding, GitHub, debugging, deployment and application maintenance.",
            "capabilities": {"web_search": True, "code_interpreter": True, "vision": False},
            "tags": ["builder", "coding", "devops"]
        },
        "params": {
            "system": "You are BUILDER — the software engineer and deployment operator. Write clean code, handle GitHub/Railway/RunPod, diagnose root causes, and prefer minimal reversible changes. Never expose secrets.",
            "temperature": 0.6,
            "top_p": 0.95
        },
        "is_active": True,
    },
    {
        "id": "shahy-multimodal",
        "name": "MULTIMODAL",
        "base_model_id": "zen.gpt-5.6-sol",
        "meta": {
            "description": "Images, screenshots, PDFs, audio and document inspection. Vision provider pending.",
            "capabilities": {"web_search": True, "code_interpreter": True, "vision": False},
            "tags": ["multimodal", "vision", "pending"]
        },
        "params": {
            "system": "You are MULTIMODAL — prepared for images, screenshots, PDFs, audio, and document inspection. When vision is unavailable, describe how you would process the media and route to a verified vision-capable backend.",
            "temperature": 0.6,
            "top_p": 0.95
        },
        "is_active": True,
    },
    {
        "id": "shahy-verifier",
        "name": "VERIFIER",
        "base_model_id": "zen.grok-4.6",
        "meta": {
            "description": "Factual validation, calculations, citations and quality control.",
            "capabilities": {"web_search": True, "code_interpreter": False, "vision": False},
            "tags": ["verifier", "qa", "second-opinion"]
        },
        "params": {
            "system": "You are VERIFIER — the independent quality control layer. Check facts, calculations, citations, and logic. Flag uncertainty explicitly. Disagree with the primary answer when warranted.",
            "temperature": 0.3,
            "top_p": 0.9
        },
        "is_active": True,
    },
    {
        "id": "shahy-council",
        "name": "COUNCIL",
        "base_model_id": "zen.gpt-5.6-sol",
        "meta": {
            "description": "Orchestration, delegation and consolidated final decisions across the panel.",
            "capabilities": {"web_search": True, "code_interpreter": True, "vision": False},
            "tags": ["council", "orchestration", "delegation"]
        },
        "params": {
            "system": "You are COUNCIL — the orchestrator. When a request spans multiple roles, delegate to FAST, SMART, BUILDER, VERIFIER, or MAX as appropriate, then synthesize their outputs into a single coherent decision or deliverable.",
            "temperature": 0.6,
            "top_p": 0.95
        },
        "is_active": True,
    },
]

PROMPTS = [
    {"command": "/fast", "name": "FAST mode", "content": "Switch to FAST mode. Be brief and practical. Respond in the user's language."},
    {"command": "/smart", "name": "SMART mode", "content": "Switch to SMART mode. Use evidence-based reasoning. Arabic/English fluent."},
    {"command": "/max", "name": "MAX mode", "content": "Switch to MAX mode. Show full reasoning, verify assumptions, and cite sources."},
    {"command": "/builder", "name": "BUILDER mode", "content": "Switch to BUILDER mode. Write code, inspect repos, or debug deployments."},
    {"command": "/verify", "name": "VERIFY mode", "content": "Switch to VERIFIER mode. Independently check the previous answer for factual and logical errors."},
    {"command": "/council", "name": "COUNCIL mode", "content": "Switch to COUNCIL mode. Delegate sub-tasks to the appropriate panel members, then synthesize a final answer."},
]

KNOWLEDGE = {
    "name": "shahy-core",
    "description": "Core institutional knowledge for Shahy: architecture, runbooks, model catalog, and operational procedures."
}

SUBAGENTS = {
    "ENABLE_SUBAGENTS": True,
    "SUBAGENTS_BACKGROUND_ENABLED": True,
    "SUBAGENTS_MAX_CONCURRENT": 3,
    "SUBAGENTS_MAX_ASYNC": 3,
    "SUBAGENTS_MAX_ITERATIONS": 5,
    "SUBAGENTS_MAX_OUTPUT": 4000,
    "SUBAGENTS_SYSTEM_PROMPT": "You are the sub-agent coordinator. Route tasks to FAST, SMART, BUILDER, VERIFIER, or MAX based on capability. Return the final consolidated result."
}

TASKS = {
    "TASK_MODEL": "zen.gpt-5.6-luna",
    "TASK_MODEL_EXTERNAL": "zen.gpt-5.6-luna",
    "TASK_MODEL_PARAMS": {},
    "ENABLE_TITLE_GENERATION": True,
    "TITLE_GENERATION_PROMPT_TEMPLATE": "Generate a concise chat title (max 6 words) in the user's language.",
    "IMAGE_PROMPT_GENERATION_PROMPT_TEMPLATE": "",
    "ENABLE_AUTOCOMPLETE_GENERATION": False,
    "AUTOCOMPLETE_GENERATION_INPUT_MAX_LENGTH": 200,
    "AUTOCOMPLETE_GENERATION_PROMPT_TEMPLATE": "",
    "TAGS_GENERATION_PROMPT_TEMPLATE": "Suggest 3 relevant tags for this conversation in English.",
    "FOLLOW_UP_GENERATION_PROMPT_TEMPLATE": "",
    "ENABLE_FOLLOW_UP_GENERATION": False,
    "ENABLE_TAGS_GENERATION": True,
    "ENABLE_SEARCH_QUERY_GENERATION": True,
    "ENABLE_RETRIEVAL_QUERY_GENERATION": True,
    "QUERY_GENERATION_PROMPT_TEMPLATE": "Formulate a precise search query to retrieve the most relevant documents.",
    "TOOLS_FUNCTION_CALLING_PROMPT_TEMPLATE": "",
    "ENABLE_VOICE_MODE_PROMPT": False,
    "VOICE_MODE_PROMPT_TEMPLATE": "",
}

CODE_EXECUTION = {
    "ENABLE_CODE_EXECUTION": True,
    "CODE_EXECUTION_ENGINE": "pyodide",
    "CODE_EXECUTION_JUPYTER_URL": None,
    "CODE_EXECUTION_JUPYTER_AUTH": None,
    "CODE_EXECUTION_JUPYTER_AUTH_TOKEN": None,
    "CODE_EXECUTION_JUPYTER_AUTH_PASSWORD": None,
    "CODE_EXECUTION_JUPYTER_TIMEOUT": None,
    "ENABLE_CODE_INTERPRETER": True,
    "CODE_INTERPRETER_ENGINE": "pyodide",
    "CODE_INTERPRETER_PROMPT_TEMPLATE": None,
    "CODE_INTERPRETER_JUPYTER_URL": None,
    "CODE_INTERPRETER_JUPYTER_AUTH": None,
    "CODE_INTERPRETER_JUPYTER_AUTH_TOKEN": None,
    "CODE_INTERPRETER_JUPYTER_AUTH_PASSWORD": None,
    "CODE_INTERPRETER_JUPYTER_TIMEOUT": None,
}


def apply_models(token, existing_ids):
    for role in ROLES:
        rid = role["id"]
        payload = dict(role)
        if DRY_RUN:
            print(f'[dry-run] model {rid}: {json.dumps(payload, ensure_ascii=False)[:300]}')
            continue
        if rid in existing_ids:
            path = '/api/v1/models/model/update'
            code, body = req('POST', path, payload, token)
            ok = code in (200, 201)
            verb = 'updated'
        else:
            path = '/api/v1/models/create'
            code, body = req('POST', path, payload, token)
            ok = code in (200, 201)
            verb = 'created'
        if ok:
            print(f'[models] {rid} {verb} OK')
        else:
            print(f'[models] {rid} {verb} FAILED HTTP {code}: {body[:300]}', file=sys.stderr)


def apply_prompts(token):
    for p in PROMPTS:
        payload = {
            **p,
            "data": None,
            "meta": None,
            "tags": None,
            "access_grants": None,
            "version_id": None,
            "commit_message": "bootstrap",
            "is_production": True,
        }
        if DRY_RUN:
            print(f'[dry-run] prompt {p["command"]}')
            continue
        code, body = req('POST', '/api/v1/prompts/create', payload, token)
        if code in (200, 201):
            print(f'[prompts] {p["command"]} created OK')
        elif code == 400 and ('command' in body.lower() or 'taken' in body.lower()):
            print(f'[prompts] {p["command"]} already exists (skipped)')
        else:
            print(f'[prompts] {p["command"]} FAILED HTTP {code}: {body[:300]}', file=sys.stderr)


def apply_knowledge(token):
    payload = {**KNOWLEDGE, "access_grants": None}
    if DRY_RUN:
        print(f'[dry-run] knowledge {KNOWLEDGE["name"]}')
        return
    code, body = req('POST', '/api/v1/knowledge/create', payload, token)
    if code in (200, 201):
        print(f'[knowledge] {KNOWLEDGE["name"]} created OK')
    elif code == 400 and ('exists' in body.lower() or 'taken' in body.lower()):
        print(f'[knowledge] {KNOWLEDGE["name"]} already exists (skipped)')
    else:
        print(f'[knowledge] {KNOWLEDGE["name"]} FAILED HTTP {code}: {body[:300]}', file=sys.stderr)


def apply_config(token, path, payload, label):
    if DRY_RUN:
        print(f'[dry-run] config {label}')
        return
    code, body = req('POST', path, payload, token)
    if code in (200, 201):
        print(f'[config] {label} OK')
    else:
        print(f'[config] {label} FAILED HTTP {code}: {body[:300]}', file=sys.stderr)


def main():
    prompt_creds()
    token = signin()
    print(f'[auth] signed in as {EMAIL}')
    models = get_models(token)
    existing_ids = {m.get('id') for m in models}
    print(f'[models] existing workspace models: {len(existing_ids)}')
    apply_models(token, existing_ids)
    apply_prompts(token)
    apply_knowledge(token)
    apply_config(token, '/api/v1/configs/subagents', SUBAGENTS, 'subagents')
    apply_config(token, '/api/v1/tasks/config/update', TASKS, 'tasks')
    apply_config(token, '/api/v1/configs/code_execution', CODE_EXECUTION, 'code_execution')
    print('[done] Shahy bootstrap applied. Restart persistence not tested yet.')


if __name__ == '__main__':
    main()
