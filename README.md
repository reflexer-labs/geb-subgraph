# GEB subgraph

The Graph protocol subgraph for GEB

## Hosted service

Deploy the subgraph on the hosted Graph protocol service.

Need authentication

Set the smart-contract addresses in configuration files `config/kovan.json` or `config/mainnet.json`.

```
npm install -D

# For kovan testnet
npm run deploy-hosted-kovan
# For mainnet
npm run deploy-hosted-mainnet
```

## Local development graph node

First start a blockchain node on `localhost:8545` (Ganache, Parity POA, etc..)

Configure the `docker/.env` to:

```
POSTGRES_PASSWORD=1234
ETHEREUM_RPC=http://host.docker.internal:8545/
NETWORK=test
```

```
cd docker
docker-compose up -d
```

Then access the GraphQL endpoints:
Queries (HTTP): http://localhost:8000/subgraphs/name/reflexer-labs/rai
Subscriptions (WS): http://localhost:8001/subgraphs/name/reflexer-labs/rai

## Prod graph node deployment

Run a graph node on a live chain (Ethereum Mainnet, Kovan etc..), deploy to subgraph on the node, expose the graphQL endpoint.

Configure the `docker/.env` to:

```
# Set an actual password
POSTGRES_PASSWORD=1234

# Ethereum node RPC endpoint (i.g: infura)
ETHEREUM_RPC=https://kovan.infura.io/v3/<API_KEY>/

# Set to mainnet or kovan
NETWORK=kovan

# Name of the subgraph on the graph node.
SUBGAPH_NAME=reflexer-labs/rai

```

Run the following command. It will start the graph node, start an ipfs node, start the postgress DB and deploy the subgraph on the graph node.

```
cd graph-node
docker-compose up -d
```

Then access the GraphQL endpoints:
Queries (HTTP): http://localhost:8000/subgraphs/name/reflexer-labs/rai
Subscriptions (WS): http://localhost:8001/subgraphs/name/reflexer-labs/rai
