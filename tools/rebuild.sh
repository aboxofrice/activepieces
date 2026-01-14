#!/bin/bash

# Rebuild ActivePieces with fresh piece cache
# Usage: ./tools/rebuild.sh [--no-cache]
#   --no-cache: Force rebuild without Docker cache (use when dependencies change)

set -e

cd "$(dirname "$0")/.."

NO_CACHE=""
if [[ "$1" == "--no-cache" ]]; then
    NO_CACHE="--no-cache"
    echo "Building without cache..."
fi

echo "Stopping containers..."
docker compose down

echo "Cleaning up Docker resources..."
docker system prune -f

echo "Clearing piece cache..."
rm -rf ./cache/v7/common

echo "Building and starting containers..."
docker compose build --no-cache
docker compose up -d

echo "Done! Containers are starting up."
echo "Use 'docker compose logs -f activepieces' to watch logs."
