import { UniswapPair as UniswapPairEntity } from './'
import { UniswapV3Pool as UniswapPairContract } from '../../generated/UniCoinPool/UniswapV3Pool'
import * as decimal from '../utils/decimal'
import { Address, ethereum } from '@graphprotocol/graph-ts'

export function getOrCreateUniPool(
  pairAddress: Address,
  event: ethereum.Event,
  name?: string,
): UniswapPairEntity {
  let pair = UniswapPairEntity.load(pairAddress.toHexString())
  if (pair == null) {
    // Create a new pair entity
    pair = new UniswapPairEntity(pairAddress.toHexString())
    let pairContract = UniswapPairContract.bind(pairAddress)

    pair.label = name
    pair.address = pairAddress

    pair.token0 = pairContract.token0()
    pair.token1 = pairContract.token1()

    let slot = pairContract.slot0()
    pair.sqrtPriceX96 = slot.value0

    pair.createdAt = event.block.timestamp
    pair.createdAtBlock = event.block.number
    pair.createdAtTransaction = event.transaction.hash
    pair.modifiedAt = event.block.timestamp
    pair.modifiedAtBlock = event.block.number
    pair.modifiedAtTransaction = event.transaction.hash

    pair.save()
  }

  return pair as UniswapPairEntity
}

export function getUniPool(
  pairAddress: Address
): UniswapPairEntity | null {
  let pair = UniswapPairEntity.load(pairAddress.toHexString())
  return pair
}
