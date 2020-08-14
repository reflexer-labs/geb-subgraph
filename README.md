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

## Tests

Run the containerized test suite.

It does:

1. Deploy local testchain with GEB deployed and a few CDP open
2. Start a graph-node
3. Deploy subgraph and sync
4. Verifies proper indexing

```
cd graph-node
docker-compose -f docker-compose.base.yml -f docker-compose.test.yml up -d
```

## Prod graph node deployment

Run a graph node on a live chain (Mainnet, kovan etc..), deploy to subgraph on the node, expose the graphQL endpoint.

You need to configure the `.env` file in the `graph-node` folder

```
cd graph-node
docker-compose -f docker-compose.base.yml -f docker-compose.prod.yml up -d
```
