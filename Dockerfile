FROM node:18 AS deployer
WORKDIR /usr/graph/

COPY package.json .
RUN npm install -D

COPY docker/wait-for-it.sh docker/wait-for-it.sh
RUN chmod +x docker/wait-for-it.sh
COPY  abis abis
COPY subgraph.template.yaml .
COPY schema.graphql .
COPY src src
COPY config config

RUN ls

ENTRYPOINT [ "/bin/bash", "-c" ]