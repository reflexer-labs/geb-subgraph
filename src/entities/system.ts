import { ethereum, dataSource } from '@graphprotocol/graph-ts'

import { SystemState, AccountingEngine } from '../../generated/schema'

import { AccountingEngine as AccountingEngineBind } from '../../generated/AccountingEngine/AccountingEngine'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'

export function getSystemState(event: ethereum.Event): SystemState {
  let state = SystemState.load('current')

  if (state == null) {
    state = new SystemState('current')

    // Protocol-wide stats
    state.globalDebt = decimal.ZERO
    state.globalDebt24hAgo = decimal.ZERO
    state.erc20CoinTotalSupply = decimal.ZERO

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
    state.globalUnbackedDebt = decimal.ZERO
    state.lastPeriodicUpdate = integer.ZERO

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

export function getOrCreateAccountingEngine(event: ethereum.Event): AccountingEngine {
  let engine = AccountingEngine.load('current')

  if (engine == null) {
    let engineContract = AccountingEngineBind.bind(dataSource.address())
    engine = new AccountingEngine('current')
    engine.totalQueuedDebt = decimal.ZERO
    engine.totalOnAuctionDebt = decimal.ZERO
    engine.surplusAuctionDelay = integer.ZERO
    engine.popDebtDelay = integer.ZERO
    engine.initialDebtAuctionMintedTokens = decimal.ZERO
    engine.debtAuctionBidSize = decimal.ZERO
    engine.surplusAuctionAmountToSell = decimal.ZERO
    engine.surplusBuffer = decimal.ZERO
    engine.disableCooldown = integer.ZERO
    engine.contractEnabled = true
    engine.safeEngine = engineContract.safeEngine()
    engine.surplusAuctionHouse = engineContract.surplusAuctionHouse()
    engine.debtAuctionHouse = engineContract.debtAuctionHouse()
    engine.protocolTokenAuthority = engineContract.protocolTokenAuthority()
    engine.postSettlementSurplusDrain = engineContract.postSettlementSurplusDrain()
    engine.debtAuctionCount = integer.ZERO
    engine.surplusAuctionCount = integer.ZERO
    engine.activeDebtAuctions = integer.ZERO
    engine.activeSurplusAuctions = integer.ZERO
  }

  engine.modifiedAt = event.block.timestamp
  engine.modifiedAtBlock = event.block.number
  engine.modifiedAtTransaction = event.transaction.hash

  engine.save()

  return engine as AccountingEngine
}
