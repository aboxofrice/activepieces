---
name: ap-update
description: Update a running ActivePieces Docker instance. Runs `git pull`, `docker compose pull`, and `docker compose up -d --remove-orphans` to fetch and deploy the latest version. Use when the user wants to update their ActivePieces installation to the newest release.
---

# ActivePieces Update

Runs `tools/update.sh` from the ActivePieces repo root. The script:
1. Pulls the latest code with `git pull`
2. Pulls the latest Docker images with `docker compose pull`
3. Recreates containers with `docker compose up -d --remove-orphans`

## How to use this skill

1. Confirm the current working directory is the ActivePieces repo root.
2. Check `git status` first — if there are uncommitted changes, warn the user that `git pull` may fail or conflict, and ask how they want to proceed.
3. Run `bash tools/update.sh`.
4. Report the outcome — note any new images pulled and whether containers restarted cleanly.
