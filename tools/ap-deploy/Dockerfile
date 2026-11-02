# ap-sync helper: pulls the flows repo and applies managed flows to the Activepieces next to it.
FROM python:3.12.12-slim-bookworm
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY ap_deploy.py ap_sync.py ./
ENV PYTHONUNBUFFERED=1 FLOWS_DIR=/data/flows STATE_FILE=/data/ap-sync-state.json
VOLUME /data
ENTRYPOINT ["python3", "/app/ap_sync.py"]
