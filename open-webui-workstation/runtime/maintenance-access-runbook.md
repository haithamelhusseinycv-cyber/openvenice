# Shahy Maintenance Access & Bootstrap Runbook

## Goal
Apply the seven-role model catalog, prompts, knowledge base, sub-agents, task config, and code execution settings to the live Open WebUI runtime.

## Prerequisites
- Admin credentials for the Shahy Open WebUI account.
- RunPod console access to start the web terminal for pod `8rhrqskupcsqvq`.

## 1. Start the RunPod web terminal
1. Open the RunPod console in your browser.
2. Locate pod `open-webui-v0-11-3-cpu-20260909` (ID `8rhrqskupcsqvq`).
3. Click **Connect** → **Web Terminal** and start the terminal.
4. Wait for the shell prompt inside the container.

## 2. Back up persistent data
Inside the terminal, run:
```bash
cp /app/backend/data/webui.db \
   /app/backend/data/webui.db.pre-roles-$(date +%Y%m%d-%H%M%S)
```
This creates a local rollback point without exposing data.

## 3. Download and run the bootstrap script
Still inside the terminal:
```bash
curl -fsSL \
  https://raw.githubusercontent.com/haithamelhusseinycv-cyber/openvenice/feat/shahy-completion-20260910/open-webui-workstation/runtime/apply/shahy_apply.py \
  -o /tmp/shahy_apply.py

export OWUI_URL=http://localhost:8080
python3 /tmp/shahy_apply.py
```
When prompted, type the admin email and password. Characters are hidden.

### Dry-run first (optional)
```bash
export DRY_RUN=1
python3 /tmp/shahy_apply.py
```

## 4. Verify inside Open WebUI
1. Open the Shahy public URL in a browser.
2. Log in as admin.
3. **Workspace → Models**: confirm FAST, SMART, MAX, BUILDER, MULTIMODAL, VERIFIER, COUNCIL are present.
4. **Workspace → Prompts**: confirm `/fast`, `/smart`, `/max`, `/builder`, `/verify`, `/council` exist.
5. **Workspace → Knowledge**: confirm `shahy-core` exists.
6. **Admin Panel → Settings → Models**: confirm default chat model is SMART (or the existing Shahy profile).
7. **Admin Panel → Settings → Tasks**: confirm sub-agents are enabled.
8. **Admin Panel → Settings → Code Execution**: confirm pyodide is selected.

## 5. Acceptance smoke tests
- Start a new chat with **SMART**. Ask a simple question in Arabic and English.
- Switch to **FAST** and request a 1-sentence summary.
- Switch to **BUILDER** and ask for a harmless Python snippet (e.g., `print(2+2)`).
- Switch to **VERIFIER** and ask it to check a fact.
- Switch to **COUNCIL** and ask it to plan a small task involving SMART and BUILDER.
- Restart the pod from RunPod console and confirm the same models/prompts/knowledge survive.

## 6. Next provider steps (after bootstrap)
- **Nube**: probe exact model IDs using `open-webui-workstation/runtime/nube-model-probe.py` (requires `NUBE_API_KEY`).
- **OpenAI / OpenRouter / DeepSeek / Together**: add connections in Admin Panel → Settings → Connections.
- **Vision / multimodal**: connect a verified vision-capable provider and update MULTIMODAL base model.
- **Open Terminal**: deploy via `runtime/open-terminal/runpod.yaml` and connect under Integrations → Open Terminal.

## Rollback
If anything breaks:
1. Stop the pod from RunPod console.
2. In the web terminal, restore the DB backup:
   ```bash
   cp /app/backend/data/webui.db.pre-roles-YYYYMMDD-HHMMSS /app/backend/data/webui.db
   ```
3. Restart the pod.
