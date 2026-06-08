---
name: ap-deploy
description: Generate a fresh ActivePieces `.env` file from `.env.example` with randomly-generated secrets (AP_API_KEY, AP_POSTGRES_PASSWORD, AP_JWT_SECRET, ENCRYPTION_KEY). Use when the user wants to bootstrap environment variables for a new ActivePieces deploy.
---

# ActivePieces Deploy Bootstrap

Runs `tools/deploy.sh` from the ActivePieces repo root. The script copies `.env.example` to `.env` and replaces the secrets with freshly-generated random values using `openssl rand`.

## How to use this skill

1. Confirm the current working directory is the ActivePieces repo root (the directory that contains `tools/deploy.sh` and `.env.example`).
2. Warn the user if `.env` already exists — running this will overwrite it and invalidate any existing encrypted data tied to the old `ENCRYPTION_KEY`. Ask for confirmation before proceeding.
3. Run `bash tools/deploy.sh`.
4. Report success and note that the new `.env` contains fresh random secrets.
