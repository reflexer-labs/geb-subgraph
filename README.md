# GEB subgraph

A Graph protocol subgraph for GEB.

```
git clone https://github.com/reflexer-labs/geb-subgraph
cd geb-subgraph
git submodule update --init --recursive
```

## Deploy on the hosted service

First, set the addresses of the smart-contracts you want to index in `config/kovan.json` or `config/mainnet.json`.

Then, open a terminal and run:

```
npm install -D

# To run once with the token from the dashboard
npm run auth <GRAPH AUTH TOKEN>

# For kovan testnet
npm run deploy-hosted-kovan
# For mainnet
npm run deploy-hosted-mainnet
```

## Local development

First, start a blockchain node on `localhost:8545` (Ganache, Parity POA, etc..) configure the smart contract addresses in `config/test.json`.

Configure the `docker/.env` to:

```
POSTGRES_PASSWORD=1234

# For MacOS
ETHEREUM_RPC=http://host.docker.internal:8545/

#For Linux
ETHEREUM_RPC=http://172.17.0.1:8545/

NETWORK=test
```

Run:

```
cd docker
docker-compose up -d
```

Then access the GraphQL endpoints using:

http://localhost/subgraphs/name/reflexer-labs/rai (HTTP queries)

## Production Graph node deployment

Run a graph node on a live chain (Ethereum Mainnet, Kovan etc..), deploy to subgraph on the node, expose the graphQL endpoint.
Frist, configure the smart contract addresses in `config/kovan.json` or `config/mainnet.json`.

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

Then run the following commands:

```
cd graph-node
docker-compose up -d
```

These will start the Graph node, an IPFS node, a Postgress DB and then it will deploy the subgraph on the Graph node.
