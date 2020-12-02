import {
  Swap,
  Sync,
  UniswapPair as UniswapPairContract,
} from '../../../../generated/templates/UniswapPair/UniswapPair'
import { UniswapPair, UniswapSwap } from '../../../entities'
import * as decimal from '../../../utils/decimal'
import { eventUid } from '../../../utils/ethereum'

export function handleSync(event: Sync): void {
  let pair = UniswapPair.load(event.address.toHex())

  pair.reserve0 = decimal.fromWad(event.params.reserve0)
  pair.reserve1 = decimal.fromWad(event.params.reserve1)

  if (pair.reserve1.notEqual(decimal.ZERO)) pair.token0Price = pair.reserve0.div(pair.reserve1)
  else pair.token0Price = decimal.ZERO
  if (pair.reserve0.notEqual(decimal.ZERO)) pair.token1Price = pair.reserve1.div(pair.reserve0)
  else pair.token1Price = decimal.ZERO

  let pairContract = UniswapPairContract.bind(event.address)
  pair.totalSupply = decimal.fromWad(pairContract.totalSupply())

  pair.modifiedAt = event.block.timestamp
  pair.modifiedAtBlock = event.block.number
  pair.modifiedAtTransaction = event.transaction.hash

  pair.save()
}

export function handleSwap(event: Swap): void {
  let swap = new UniswapSwap(eventUid(event))
  swap.pair = event.address.toHexString()
  swap.amount0In = decimal.fromWad(event.params.amount0In)
  swap.amount1In = decimal.fromWad(event.params.amount1In)
  swap.amount0Out = decimal.fromWad(event.params.amount0Out)
  swap.amount1Out = decimal.fromWad(event.params.amount1Out)
  swap.sender = event.params.sender
  swap.createdAt = event.block.timestamp
  swap.createdAtBlock = event.block.number
  swap.createdAtTransaction = event.transaction.hash
  swap.save()
}
