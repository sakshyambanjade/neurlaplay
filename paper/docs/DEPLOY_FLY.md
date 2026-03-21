# Fly.io Deployment

This deployment model runs the backend and built frontend in one Fly app and stores run artifacts on a Fly volume.

## Preconditions

- Fly CLI installed and authenticated
- A Fly app name reserved
- Groq keys available as secrets

## Runtime layout

- App code: `/app`
- Paper workspace: `/app/paper`
- Persistent run data: `/data/paper`

The server uses:

- `PAPER_WORKSPACE_ROOT=/app/paper`
- `PAPER_DATA_ROOT=/data/paper`

That keeps configs and docs in the image while storing runs and logs on the volume.

## First-time setup

1. Edit [fly.toml](E:\neurlaplay\fly.toml) and set `app` to your actual Fly app name if `neurlaplay-paper` is not available.
2. Create the volume once:

```bash
fly volumes create paper_data --region sin --size 20
```

3. Set secrets:

```bash
fly secrets set GROQ_API_KEYS="key1,key2,key3"
```

Optional:

```bash
fly secrets set OLLAMA_BASE_URL="http://127.0.0.1:11434"
```

## Deploy

```bash
fly deploy
```

## Operate

- Open the deployed app URL
- Use `Run Main Experiment`, `Run Validation Batch`, or `Resume Last Run`
- Artifacts are written under the mounted volume at `/data/paper/runs`

## Notes

- The service is configured as one always-on machine.
- This is the correct shape for resumable research runs with websocket progress and persistent artifacts.
- If you change regions, create the volume in the same region as `primary_region`.
