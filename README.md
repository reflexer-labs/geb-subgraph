# GEB subgraph

The Graph protocol subgraph for GEB

## Hosted service

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

```
cd docker
docker-compose up -d
```

Then access the GraphQL endpoints:
Queries (HTTP):     http://localhost:8000/subgraphs/name/reflexer-labs/rai
Subscriptions (WS): http://localhost:8001/subgraphs/name/reflexer-labs/rai

## Prod graph node deployment

Run a graph node on a live chain (Mainnet, kovan etc..), deploy to subgraph on the node, expose the graphQL endpoint.

You need to setup the `.env` file in the `docker` folder

```
cd graph-node
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
