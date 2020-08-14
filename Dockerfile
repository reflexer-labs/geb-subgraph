FROM node:12 AS deployer
WORKDIR /usr/graph/

COPY package.json .
RUN npm install -D
COPY . .
# COPY ./src/ ./src
# COPY schema.graphql schema.graphql

RUN chmod +x docker/wait-for-it.sh

ENTRYPOINT [ "/bin/bash", "-c" ]