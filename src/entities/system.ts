import { ethereum } from '@graphprotocol/graph-ts'

import { SystemState } from '../../generated/schema'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'

export function getSystemState(event: ethereum.Event): SystemState {
  let state = SystemState.load('current')

  if (state == null) {
    state = new SystemState('current')

    // Protocol-wide stats
    state.globalDebt = decimal.ZERO

    // Entities counters
    state.collateralCount = integer.ZERO
    state.collateralAuctionCount = integer.ZERO
    state.proxyCount = integer.ZERO
    state.unmanagedCdpCount = integer.ZERO
    state.cdpCount = integer.ZERO
    state.totalActiveCdpCount = integer.ZERO

    // System parameters
    state.globalStabilityFee = decimal.ZERO
    state.savingsRate = decimal.ONE
    state.globalDebtCeiling = decimal.ZERO
    state.globalUnbackedDebt = decimal.ZERO
  }

  state.createdAtBlock = event.block.number
  state.createdAt = event.block.timestamp
  state.createdAtTransaction = event.transaction.hash

  state.save()

  return state as SystemState
}
