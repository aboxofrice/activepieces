# Nightly Postgres -> encrypted Google Drive backup for the warehouse stack.
# Builds for linux/amd64 (warehouse server) and linux/arm64 (Apple Silicon test runs).
#
# Alpine 3.20 is the newest branch that still ships a PostgreSQL 14 client. The client must match
# the server's major version (postgres:14.4): a newer pg_dump emits settings PG14 rejects on restore.
# To update: bump the digest, then the apk versions printed by `apk policy <pkg>` in that image.
FROM alpine:3.20.10@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc

ARG TARGETARCH
ARG RCLONE_VERSION=1.74.4
ARG RCLONE_SHA256_AMD64=fe435e0c36228e7c2f116a8701f01127bb1f694005fc11d1f27186c8bca4115d
ARG RCLONE_SHA256_ARM64=97685285c9ad6a0cf17d5844115d2a67245af6444db672187074bd9c358de419

RUN apk add --no-cache \
        postgresql14-client=14.17-r0 \
        tzdata=2026b-r0 \
        ca-certificates=20261020-r0 \
    && case "$TARGETARCH" in \
        amd64) sha="$RCLONE_SHA256_AMD64" ;; \
        arm64) sha="$RCLONE_SHA256_ARM64" ;; \
        *) echo "unsupported arch: $TARGETARCH" >&2; exit 1 ;; \
       esac \
    && zip="rclone-v${RCLONE_VERSION}-linux-${TARGETARCH}.zip" \
    && wget -q -O "/tmp/$zip" "https://downloads.rclone.org/v${RCLONE_VERSION}/$zip" \
    && echo "$sha  /tmp/$zip" | sha256sum -c - \
    && unzip -q "/tmp/$zip" -d /tmp \
    && install -m 0755 "/tmp/rclone-v${RCLONE_VERSION}-linux-${TARGETARCH}/rclone" /usr/local/bin/rclone \
    && rm -rf /tmp/rclone-* \
    && rclone version | head -1

COPY --chmod=0755 backup.sh /usr/local/bin/backup

ENV RCLONE_CONFIG=/config/rclone.conf
VOLUME ["/config", "/status"]
ENTRYPOINT ["/usr/local/bin/backup"]
CMD ["daemon"]
