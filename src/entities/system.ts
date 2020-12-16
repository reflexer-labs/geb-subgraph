import { ethereum } from '@graphprotocol/graph-ts'

import { SystemState } from '../../generated/schema'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'
import { addressMap } from '../utils/addresses'

export function getSystemState(event: ethereum.Event): SystemState {
  let state = SystemState.load('current')

  if (state == null) {
    state = new SystemState('current')

    // Protocol-wide stats
    state.globalDebt = decimal.ZERO
    state.globalDebt24hAgo = decimal.ZERO
    state.erc20CoinTotalSupply = decimal.ZERO
    state.debtAvailableToSettle = decimal.ZERO
    state.systemSurplus = decimal.ZERO

    // Entities counters
    state.collateralCount = integer.ZERO
    state.collateralAuctionCount = integer.ZERO
    state.proxyCount = integer.ZERO
    state.unmanagedSafeCount = integer.ZERO
    state.safeCount = integer.ZERO
    state.totalActiveSafeCount = integer.ZERO

    // System parameters
    state.globalStabilityFee = decimal.ZERO
    state.savingsRate = decimal.ONE
    state.globalDebtCeiling = decimal.ZERO
    state.perSafeDebtCeiling = decimal.fromWad(integer.MAX_UINT_256)
    state.globalUnbackedDebt = decimal.ZERO
    state.lastPeriodicUpdate = integer.ZERO
    state.coinAddress = addressMap.get('GEB_COIN')
    state.wethAddress = addressMap.get('ETH')

    // Created at
    state.createdAtBlock = event.block.number
    state.createdAt = event.block.timestamp
    state.createdAtTransaction = event.transaction.hash
  }

  state.modifiedAt = event.block.timestamp
  state.modifiedAtBlock = event.block.number
  state.modifiedAtTransaction = event.transaction.hash

  state.save()

  return state as SystemState
}
