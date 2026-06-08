---
name: ap-rebuild
description: Rebuild ActivePieces Docker containers with a fresh piece cache. Stops containers, prunes Docker resources, clears `./cache/v7/common`, then rebuilds and restarts via docker compose. Supports `--no-cache` for forced rebuilds when dependencies change. Use when the user wants to rebuild ActivePieces after piece or dependency changes.
---

# ActivePieces Rebuild

Runs `tools/rebuild.sh` from the ActivePieces repo root. The script:
1. Stops all containers (`docker compose down`)
2. Prunes Docker resources (`docker system prune -f`)
3. Clears the piece cache at `./cache/v7/common`
4. Builds with `docker compose build --no-cache`
5. Starts containers with `docker compose up -d`

## How to use this skill

1. Confirm the current working directory is the ActivePieces repo root.
2. Check the user's arguments — if they pass `--no-cache` or mention dependency changes, forward `--no-cache` to the script.
3. Warn that this stops running containers and prunes Docker resources. Confirm before proceeding if containers are currently serving traffic.
4. Run `bash tools/rebuild.sh` (optionally with `--no-cache`).
5. After it finishes, remind the user they can follow logs with `docker compose logs -f activepieces`.
