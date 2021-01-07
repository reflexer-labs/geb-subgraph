import { dataSource, log } from '@graphprotocol/graph-ts'
import {
  UpdateResult,
  Medianizer as ChainlinkMedianizer,
  ModifyParameters,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/EthMedianizer/Medianizer'
import { Medianizer as UniMedianizer } from '../../../../generated/CoinMedianizer/Medianizer'
import { UniswapV2Pair as UniswapPairContract } from '../../../../generated/templates/UniswapV2Pair/UniswapV2Pair'
import { UniswapV2Pair as UniswapPairIndexer } from '../../../../generated/templates'
import {
  getOrCreateCollateral,
  getSystemState,
  MedianizerUpdate,
  UniswapPair as UniswapPairEntity,
} from '../../../entities'
import { eventUid, NULL_ADDRESS } from '../../../utils/ethereum'
import * as decimal from '../../../utils/decimal'
import { addressMap } from '../../../utils/addresses'
import { ETH_A } from '../../../utils/bytes'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

// Called for both Chainlink and Uniswap medianizer
export function handleUpdateResult(event: UpdateResult): void {
  let id = eventUid(event)
  let update = new MedianizerUpdate(id)
  let contractAddress = dataSource.address()

  update.medianizerAddress = contractAddress
  update.value = decimal.fromWad(event.params.medianPrice)
  update.symbol = ChainlinkMedianizer.bind(contractAddress)
    .symbol()
    .toString()
  update.createdAt = event.block.timestamp
  update.createdAtBlock = event.block.number
  update.createdAtTransaction = event.transaction.hash
  update.save()

  if (contractAddress.equals(addressMap.get('MEDIANIZER_ETH'))) {
    let collateral = getOrCreateCollateral(ETH_A, event)
    collateral.currentMedianizerUpdate = id
    collateral.save()
  } else if (contractAddress.equals(addressMap.get('MEDIANIZER_RAI'))) {
    let system = getSystemState(event)
    system.currentCoinMedianizerUpdate = id
    system.save()
  } else {
    log.error('Medianizer address not found', [])
  }
}

// Only call for the Uniswap medianizer
export function handleModifyParameters(event: ModifyParameters): void {
  let uniswapMedian = UniMedianizer.bind(dataSource.address())
  let pairAddress = uniswapMedian.uniswapPair()

  if (pairAddress.equals(NULL_ADDRESS)) {
    // We are updating another parameter
    return
  }

  let pair = UniswapPairEntity.load(pairAddress.toHexString())
  if (pair == null) {
    // Create a new pair entity
    pair = new UniswapPairEntity(pairAddress.toHexString())
    let pairContract = UniswapPairContract.bind(pairAddress)

    pair.medianizerSymbol = uniswapMedian.symbol().toString()
    pair.address = pairAddress

    pair.token0 = pairContract.token0()
    pair.token1 = pairContract.token1()

    let reserves = pairContract.getReserves()
    pair.reserve0 = decimal.fromWad(reserves.value0)
    pair.reserve1 = decimal.fromWad(reserves.value1)

    if (pair.reserve1.notEqual(decimal.ZERO)) pair.token0Price = pair.reserve0.div(pair.reserve1)
    else pair.token0Price = decimal.ZERO
    if (pair.reserve0.notEqual(decimal.ZERO)) pair.token1Price = pair.reserve1.div(pair.reserve0)
    else pair.token1Price = decimal.ZERO

    pair.totalSupply = decimal.fromWad(pairContract.totalSupply())

    pair.createdAt = event.block.timestamp
    pair.createdAtBlock = event.block.number
    pair.createdAtTransaction = event.transaction.hash
    pair.modifiedAt = event.block.timestamp
    pair.modifiedAtBlock = event.block.number
    pair.modifiedAtTransaction = event.transaction.hash

    pair.save()
  }

  // Start indexing
  UniswapPairIndexer.create(pairAddress)

  // Set system reference to Coin medianizer
  let system = getSystemState(event)
  system.coinUniswapPair = pairAddress.toHexString()
  system.save()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
