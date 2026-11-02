# Installer image: carries the stack definition and every tool setup needs, so the host only needs
# Docker. Build from deploy/warehouse:
#   docker build -f installer/Dockerfile --build-arg AP_IMAGE=ghcr.io/aboxofrice/activepieces:<sha> \
#     -t ghcr.io/aboxofrice/ap-installer:<sha> .
FROM alpine:3.20

RUN apk add --no-cache bash curl openssl python3 docker-cli docker-cli-compose

ARG AP_IMAGE=ghcr.io/aboxofrice/activepieces:latest-warehouse
ENV DEFAULT_AP_IMAGE=${AP_IMAGE} \
    TEMPLATE_DIR=/opt/installer \
    DATA_DIR=/data

COPY *.yml pieces.txt install.sh restore.sh backup-setup.sh /opt/installer/
RUN chmod +x /opt/installer/*.sh

ENTRYPOINT ["/opt/installer/install.sh"]
