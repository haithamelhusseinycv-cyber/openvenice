# Shahy Open Terminal deployment

Shahy uses a dedicated Open Terminal service for terminal, filesystem, coding,
document and data-analysis work. It must remain separate from the public Open
WebUI container and must not share Open WebUI's data volume.

## Deployment contract

- Create a separate CPU RunPod named `shahy-open-terminal`.
- Use the digest-pinned image in `runpod.yaml`.
- Attach the existing `ai-builder-workspace` network volume (`5imqvn62f9`) at
  `/home/user`. Reusing it avoids another storage charge and activates the
  workspace that was already provisioned for this purpose.
- expose only HTTP port `8000` through RunPod's authenticated HTTPS proxy.
- create a high-entropy `OPEN_TERMINAL_API_KEY` as a RunPod secret; never commit
  it, put it in a chat, or store it in a browser-side personal connection.
- do not mount the Docker socket.
- keep the existing Shahy Open WebUI pod and its volume unchanged.

## Open WebUI connection

After the terminal pod is healthy, add the connection under **Admin settings →
Integrations → Open Terminal**:

- URL: the terminal pod's port-8000 HTTPS proxy URL
- Auth: Bearer
- API key: the same RunPod secret
- Chat uploads: Filesystem

Keep the connection server-side. Shahy's model remains `zen.gpt-5.6-sol` with
native function calling.

## Verification

Run the non-destructive endpoint check locally or in CI:

```bash
OPEN_TERMINAL_URL=https://<pod-id>-8000.proxy.runpod.net \
OPEN_TERMINAL_API_KEY='<secret>' \
bash open-webui-workstation/scripts/verify_open_terminal.sh
```

Then select the System terminal in a saved Shahy chat and ask it to:

1. run `uname -a`;
2. create `shahy-acceptance.txt` containing `OPEN_TERMINAL_OK`;
3. read the file back;
4. restart the terminal pod and verify the same file remains.

The first three checks prove the model/tool loop. The restart check proves
persistence. Do not treat the service as operational until all four pass.
