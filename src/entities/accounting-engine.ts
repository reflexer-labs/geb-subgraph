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
    let params = engineContract.params()
    engine.totalQueuedDebt = decimal.ZERO
    engine.totalOnAuctionDebt = decimal.ZERO
    engine.surplusAuctionDelay = params.surplusDelay
    engine.popDebtDelay = params.popDebtDelay
    engine.initialDebtAuctionMintedTokens = decimal.fromWad(params.debtAuctionMintedTokens)
    engine.debtAuctionBidSize = decimal.fromRad(params.debtAuctionBidSize)
    engine.surplusAuctionAmountToSell = decimal.fromRad(params.surplusAmount)
    engine.surplusBuffer = decimal.fromRad(params.surplusBuffer)
    engine.disableCooldown = params.disableCooldown
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
