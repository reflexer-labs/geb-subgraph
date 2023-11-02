import { Address, ethereum } from '@graphprotocol/graph-ts'
import {
  Swap,
  UniswapV3Pool as UniswapPairContract,
} from '../../../../generated/UniCoinPool/UniswapV3Pool'
import { BigInt } from '@graphprotocol/graph-ts'
import { getOrCreateUniPool } from '../../../entities/uniswap'
import { addressMap } from '../../../utils/addresses'
import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import { eventUid } from '../../../utils/ethereum'

export const UNISWAP_COIN_POOL_LABEL = 'UNISWAP_POOL_COIN'
const UNISWAP_COIN_POOL_TOKEN_LABEL = 'UNISWAP_POOL_TOKEN_COIN'

// Create a swap object
export function handleSwap(event: Swap): void {
    let pair = getOrCreateUniPool(event.address, event, UNISWAP_COIN_POOL_LABEL)

    pair.sqrtPriceX96 = event.params.sqrtPriceX96
  
    pair.modifiedAt = event.block.timestamp
    pair.modifiedAtBlock = event.block.number
    pair.modifiedAtTransaction = event.transaction.hash
  
    pair.save()
  
}

export function getUniEthPrice(event: ethereum.Event): decimal.BigDecimal {
  let uniPair = getOrCreateUniPool(
    addressMap.get('GEB_COIN_UNISWAP_POOL'),
    event,
    UNISWAP_COIN_POOL_LABEL,
  )

  let exp = 2**96

  let expString = exp.toString()

  let expBig = integer.fromString(expString)

  let sqrtPrice = uniPair.sqrtPriceX96

  let token0Price = (sqrtPrice.div(expBig)).pow(2)

  let token1Price = (integer.ONE.div(token0Price))

  let token1PriceDec = decimal.fromWad(token1Price)

  return token1PriceDec
}
