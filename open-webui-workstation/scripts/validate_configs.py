#!/usr/bin/env python3
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
errors = []

required_paths = [
    BASE / 'models' / 'curated-models.json',
    BASE / 'models' / 'capability-registry.schema.json',
    BASE / 'routing' / 'router-rules.yaml',
    BASE / 'config' / 'runtime-sync-matrix.yaml',
    BASE / 'acceptance' / 'requirements-matrix.yaml',
]

for p in required_paths:
    if not p.exists():
        errors.append(f'missing: {p}')

for p in [BASE / 'models' / 'curated-models.json', BASE / 'models' / 'capability-registry.schema.json', BASE / 'models' / 'capability-registry.example.json']:
    try:
        json.loads(p.read_text(encoding='utf-8'))
    except Exception as e:
        errors.append(f'json invalid: {p} -> {e}')

if errors:
    print('VALIDATION_FAILED')
    for e in errors:
        print(e)
    raise SystemExit(1)

print('VALIDATION_OK')
