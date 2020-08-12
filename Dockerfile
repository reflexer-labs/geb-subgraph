FROM node:12 AS testchain
WORKDIR /usr/graph/

COPY ./lib/geb-snap-testchain .
ENV SKIP_SUBMODULE_UPDATE=true

RUN ["/bin/sh", "-c", "scripts/launch -s testchain-value-english-governance-median-multisig"]