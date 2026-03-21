# Supabase Run Store

The research pipeline keeps filesystem run logs as the primary record and uses Supabase Postgres as a secondary run index.

## What is stored in Supabase

- run status
- manifest/config metadata
- preflight status
- artifact index
- matchup progress summaries

## What is not moved into the database

- `moves.jsonl`
- `games.jsonl`
- matchup artifact files
- packaged run outputs

Those remain on disk or on the Fly volume as the primary reproducible record.

## Environment variable

Set this on the backend:

```text
SUPABASE_DB_URL=postgresql://...
```

The backend will auto-create the required tables on first connection.

## Hosted setup

For Fly:

```bash
fly secrets set SUPABASE_DB_URL="postgresql://..."
```

## Tables created automatically

- `paper_runs`
- `paper_matchups`
