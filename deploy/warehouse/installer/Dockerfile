# Installer image: carries the stack definition and every tool setup needs, so the host only needs
# Docker. Build from deploy/warehouse:
#   docker build -f installer/Dockerfile --build-arg AP_IMAGE=ghcr.io/aboxofrice/activepieces:<sha> \
#     -t ghcr.io/aboxofrice/ap-installer:<sha> .
# AP_IMAGE is required: it is the app image a first install runs, so pin it to an immutable tag
# (git sha) or a digest (ghcr.io/aboxofrice/activepieces@sha256:...). There is no floating default.
FROM alpine:3.20.10

RUN apk add --no-cache bash curl openssl python3 docker-cli docker-cli-compose

ARG AP_IMAGE
RUN [ -n "$AP_IMAGE" ] || { echo "build with --build-arg AP_IMAGE=ghcr.io/aboxofrice/activepieces:<sha>" >&2; exit 1; }
ENV DEFAULT_AP_IMAGE=${AP_IMAGE} \
    TEMPLATE_DIR=/opt/installer \
    DATA_DIR=/data

# restore.sh / backup-setup.sh are run from here (`... ap-installer:<tag> restore`), never from the
# data folder: scripts that drive the Docker socket must not come from a writable host directory.
COPY *.yml pieces.txt install.sh restore.sh backup-setup.sh /opt/installer/
RUN chmod 755 /opt/installer/*.sh

ENTRYPOINT ["/opt/installer/install.sh"]
