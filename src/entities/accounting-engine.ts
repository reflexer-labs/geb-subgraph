import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'
import { AccountingEngine } from '.'
import { dataSource, ethereum } from '@graphprotocol/graph-ts'
import { AccountingEngine as AccountingEngineBind } from '../../generated/AccountingEngine/AccountingEngine'

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
