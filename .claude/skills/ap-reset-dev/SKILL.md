---
name: ap-reset-dev
description: DESTRUCTIVE — wipe the ActivePieces dev environment. Removes `~/.activepieces`, local `node_modules/`, devcontainer containers (db, redis, app), and devcontainer volumes (redis_data, postgres_data). Use only when the user explicitly wants to reset their ActivePieces devcontainer state from scratch.
---

# ActivePieces Dev Reset (DESTRUCTIVE)

Runs `tools/reset-dev.sh` from the ActivePieces repo root. This **permanently deletes**:
- `~/.activepieces` directory
- Local `node_modules/`
- Containers: `activepieces_devcontainer_db_1`, `activepieces_devcontainer_redis_1`, `activepieces_devcontainer_app_1`
- Volumes: `activepieces_devcontainer_redis_data`, `activepieces_devcontainer_postgres_data`

## How to use this skill

1. **Always confirm with the user before running.** State explicitly what will be deleted (containers, volumes, node_modules, ~/.activepieces) and that Postgres/Redis data in those volumes will be unrecoverable.
2. Confirm the current working directory is the ActivePieces repo root.
3. Only after the user confirms, run `bash tools/reset-dev.sh`.
4. Report what was deleted.

## When NOT to use

- If the user just wants to rebuild without losing data → use `ap-rebuild` instead.
- If the user is on a non-devcontainer setup → use `ap-reset` instead (targets `docker compose` containers, not devcontainer-named ones).