import { Sync } from '../../../../generated/templates/UniswapPair/UniswapPair'
import { UniswapPair } from '../../../entities'
import * as decimal from '../../../utils/decimal'

export function handleSync(event: Sync): void {
  let pair = UniswapPair.load(event.address.toHex())

  pair.reserve0 = decimal.fromWad(event.params.reserve0)
  pair.reserve1 = decimal.fromWad(event.params.reserve1)

  if (pair.reserve1.notEqual(decimal.ZERO)) pair.token0Price = pair.reserve0.div(pair.reserve1)
  else pair.token0Price = decimal.ZERO
  if (pair.reserve0.notEqual(decimal.ZERO)) pair.token1Price = pair.reserve1.div(pair.reserve0)
  else pair.token1Price = decimal.ZERO

  pair.modifiedAt = event.block.timestamp
  pair.modifiedAtBlock = event.block.number
  pair.modifiedAtTransaction = event.transaction.hash

  pair.save()
}
