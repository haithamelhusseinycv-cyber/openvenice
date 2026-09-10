#!/usr/bin/env python3
"""Idempotent Shahy P0 bootstrap for Open WebUI 0.11.3.

Run on the pod or a trusted host:
  export OWUI_URL=http://localhost:8080
  python3 shahy_apply.py

Prompts for admin email/password with no echo. Never print the token.
DRY_RUN=1 previews payloads without mutating.
"""
import getpass, json, os, sys, urllib.request, urllib.error

OWUI_URL = os.getenv('OWUI_URL', 'https://8rhrqskupcsqvq-8080.proxy.runpod.net').rstrip('/')
EMAIL = os.getenv('OWUI_EMAIL')
PASSWORD = os.getenv('OWUI_PASSWORD')
DRY_RUN = os.getenv('DRY_RUN', '').strip().lower() in ('1', 'true', 'yes')
UA = 'Shahy-Apply/1.1-p0'


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


# No temperature / top_p — Zen Responses rejects them.
ROLES = [
    {
        'id': 'shahy-fast',
        'name': 'FAST',
        'base_model_id': 'zen.gpt-5.6-luna',
        'meta': {
            'description': 'Direct model answer. No live search. No terminal.',
            'capabilities': {'web_search': False, 'code_interpreter': False, 'vision': False},
            'tags': ['fast', 'economy', 'daily'],
        },
        'params': {
            'system': 'You are FAST. No tools. Answer from model knowledge. Flag stale facts. Under 220 words.',
        },
        'is_active': True,
    },
    {
        'id': 'shahy-smart',
        'name': 'SMART',
        'base_model_id': 'zen.gpt-5.6-sol',
        'meta': {
            'description': 'Live web search, then a cited brief. No terminal.',
            'capabilities': {'web_search': True, 'code_interpreter': False, 'vision': False},
            'tags': ['smart', 'default', 'daily'],
        },
        'params': {
            'system': 'You are SMART. Search the open web before answering. Cite primary sources. If search did not run, say so. Never invent URLs. No terminal.',
        },
        'is_active': True,
    },
    {
        'id': 'shahy-max',
        'name': 'MAX',
        'base_model_id': 'zen.gpt-6-astra',
        'meta': {
            'description': 'Deep research. No terminal.',
            'capabilities': {'web_search': True, 'code_interpreter': False, 'vision': False},
            'tags': ['max', 'premium', 'investigation'],
        },
        'params': {
            'system': 'You are MAX. Search first. Show conflicts. No terminal. No code execution.',
        },
        'is_active': True,
    },
    {
        'id': 'shahy-builder',
        'name': 'BUILDER',
        'base_model_id': 'zen.gpt-5.6-sol',
        'meta': {
            'description': 'Code and spreadsheets via Open Terminal. Jail to /workspace.',
            'capabilities': {'web_search': True, 'code_interpreter': True, 'vision': False},
            'tags': ['builder', 'coding', 'devops'],
        },
        'params': {
            'system': 'You are BUILDER. Use Open Terminal run_command. For Excel/CSV evaluate with Python (openpyxl or pandas) and print the number. SUM(10,20,30) must print 60. Stay under /workspace. Never expose secrets.',
        },
        'is_active': True,
    },
    {
        'id': 'shahy-multimodal',
        'name': 'MULTIMODAL',
        'base_model_id': 'zen.grok-4.6',
        'meta': {
            'description': 'Images and documents. No terminal. No formula eval.',
            'capabilities': {'web_search': True, 'code_interpreter': False, 'vision': True},
            'tags': ['multimodal', 'vision'],
        },
        'params': {
            'system': 'You are MULTIMODAL. Inspect images and documents. Do not evaluate spreadsheet formulas. Route calculation to BUILDER. No terminal.',
        },
        'is_active': True,
    },
    {
        'id': 'shahy-verifier',
        'name': 'VERIFIER',
        'base_model_id': 'zen.grok-4.6',
        'meta': {
            'description': 'Factual validation. Search on. Terminal read-only.',
            'capabilities': {'web_search': True, 'code_interpreter': True, 'vision': False},
            'tags': ['verifier', 'qa', 'second-opinion'],
        },
        'params': {
            'system': 'You are VERIFIER. Check facts and citations. Read-only commands only. Never write, delete, or install. Never claim search ran unless it did.',
        },
        'is_active': True,
    },
    {
        'id': 'shahy-council',
        'name': 'COUNCIL',
        'base_model_id': 'zen.gpt-5.6-sol',
        'meta': {
            'description': 'Orchestration only. Search on. Terminal OFF.',
            'capabilities': {'web_search': True, 'code_interpreter': False, 'vision': False},
            'tags': ['council', 'orchestration'],
        },
        'params': {
            'system': 'You are COUNCIL. Three seats, then one decision. No terminal. No code execution. If calculation is required, BUILDER must run it.',
        },
        'is_active': True,
    },
]

PROMPTS = [
    {'command': '/fast', 'name': 'FAST mode', 'content': 'Switch to FAST. No tools. Brief.'},
    {'command': '/smart', 'name': 'SMART mode', 'content': 'Switch to SMART. Search first. Cite sources.'},
    {'command': '/max', 'name': 'MAX mode', 'content': 'Switch to MAX. Deep search. Show conflicts.'},
    {'command': '/builder', 'name': 'BUILDER mode', 'content': 'Switch to BUILDER. Use Open Terminal. Evaluate formulas in Python.'},
    {'command': '/verify', 'name': 'VERIFY mode', 'content': 'Switch to VERIFIER. Independent check. Read-only terminal.'},
    {'command': '/council', 'name': 'COUNCIL mode', 'content': 'Switch to COUNCIL. No terminal. Synthesize a decision.'},
]

KNOWLEDGE = {
    'name': 'shahy-core',
    'description': 'Core institutional knowledge for Shahy.',
}

SUBAGENTS = {
    'ENABLE_SUBAGENTS': True,
    'SUBAGENTS_BACKGROUND_ENABLED': True,
    'SUBAGENTS_MAX_CONCURRENT': 3,
    'SUBAGENTS_MAX_ASYNC': 3,
    'SUBAGENTS_MAX_ITERATIONS': 5,
    'SUBAGENTS_MAX_OUTPUT': 4000,
    'SUBAGENTS_SYSTEM_PROMPT': 'Route tasks to FAST, SMART, BUILDER, VERIFIER, or MAX. COUNCIL must not receive terminal. Return one consolidated result.',
}

TASKS = {
    'TASK_MODEL': 'zen.gpt-5.6-luna',
    'TASK_MODEL_EXTERNAL': 'zen.gpt-5.6-luna',
    'TASK_MODEL_PARAMS': {},
    'ENABLE_TITLE_GENERATION': True,
    'TITLE_GENERATION_PROMPT_TEMPLATE': 'Generate a concise chat title (max 6 words) in the user language.',
    'ENABLE_AUTOCOMPLETE_GENERATION': False,
    'ENABLE_FOLLOW_UP_GENERATION': False,
    'ENABLE_TAGS_GENERATION': True,
    'ENABLE_SEARCH_QUERY_GENERATION': True,
    'ENABLE_RETRIEVAL_QUERY_GENERATION': True,
}

# Instance default. BUILDER Excel path is Open Terminal, not pyodide.
CODE_EXECUTION = {
    'ENABLE_CODE_EXECUTION': True,
    'CODE_EXECUTION_ENGINE': 'pyodide',
    'ENABLE_CODE_INTERPRETER': True,
    'CODE_INTERPRETER_ENGINE': 'pyodide',
}


def apply_models(token, existing_ids):
    for role in ROLES:
        rid = role['id']
        payload = dict(role)
        if DRY_RUN:
            print(f'[dry-run] model {rid}')
            continue
        if rid in existing_ids:
            code, body = req('POST', '/api/v1/models/model/update', payload, token)
            verb = 'updated'
        else:
            code, body = req('POST', '/api/v1/models/create', payload, token)
            verb = 'created'
        if code in (200, 201):
            print(f'[models] {rid} {verb} OK')
        else:
            print(f'[models] {rid} {verb} FAILED HTTP {code}: {body[:300]}', file=sys.stderr)


def apply_prompts(token):
    for p in PROMPTS:
        payload = {
            **p,
            'data': None,
            'meta': None,
            'tags': None,
            'access_grants': None,
            'version_id': None,
            'commit_message': 'p0',
            'is_production': True,
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
    payload = {**KNOWLEDGE, 'access_grants': None}
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
    print('[done] P0 applied. Manually: disable COUNCIL Open Terminal, swap DDGS -> Brave/Tavily, hide /openapi.json.')


if __name__ == '__main__':
    main()
