---
name: ap-reset
description: DESTRUCTIVE — wipe the ActivePieces docker-compose environment. Removes `~/.activepieces`, stops containers via `docker compose down`, and deletes the `activepieces_redis_data` and `activepieces_postgres_data` volumes. Use only when the user explicitly wants to reset their ActivePieces instance from scratch.
---

# ActivePieces Reset (DESTRUCTIVE)

Runs `tools/reset.sh` from the ActivePieces repo root. This **permanently deletes**:
- `~/.activepieces` directory
- All docker-compose containers for ActivePieces (via `docker compose down`)
- Volumes: `activepieces_redis_data`, `activepieces_postgres_data`

## How to use this skill

1. **Always confirm with the user before running.** State explicitly what will be deleted (containers, Postgres volume, Redis volume, ~/.activepieces) and that the database contents will be unrecoverable.
2. Confirm the current working directory is the ActivePieces repo root.
3. Only after the user confirms, run `bash tools/reset.sh`.
4. Report what was deleted.

## When NOT to use

- If the user just wants to rebuild without losing data → use `ap-rebuild` instead.
- If the user is on a devcontainer setup → use `ap-reset-dev` instead (targets devcontainer-named containers/volumes).
