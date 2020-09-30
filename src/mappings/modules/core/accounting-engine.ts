import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
  AuctionDebt,
  AuctionSurplus,
} from '../../../../generated/AccountingEngine/AccountingEngine'
import { getOrCreateAccountingEngine } from '../../../entities/system'
import { EnglishAuction, EnglishAuctionConfiguration } from '../../../entities'
import { log } from '@graphprotocol/graph-ts'
import * as enums from '../../../utils/enums'
import { DebtAuctionHouse, PreSettlementSurplusAuctionHouse } from '../../../../generated/templates'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'

export function handleModifyParametersAddress(event: ModifyParametersAddress): void {
  let what = event.params.parameter.toString()
  let data = event.params.data
  let accounting = getOrCreateAccountingEngine(event)

  if (what == 'surplusAuctionHouse') {
    // Assign the surplus auction house
    accounting.surplusAuctionHouse = data

    // Create or update the auction house object
    getOrCreateEnglishAuctionConfiguration(data, enums.EnglishAuctionType_SURPLUS_PRE)

    // Start indexing
    PreSettlementSurplusAuctionHouse.create(data)
    log.info('Set surplus pre auction house to {}', [accounting.surplusAuctionHouse.toHexString()])
    accounting.surplusAuctionHouse = data
  } else if (what == 'debtAuctionHouse') {
    // Assign the debt auction house
    accounting.debtAuctionHouse = data

    // Create or update the auction house object
    getOrCreateEnglishAuctionConfiguration(data, enums.EnglishAuctionType_DEBT)

    log.info('Set debt auction house to {}', [accounting.debtAuctionHouse.toHexString()])

    // Start indexing
    DebtAuctionHouse.create(data)
  } else if (what == 'postSettlementSurplusDrain') {
    accounting.postSettlementSurplusDrain = data
  } else if (what == 'protocolTokenAuthority') {
    accounting.protocolTokenAuthority = data
  } else {
    log.warning('Unknown parameter {}', [what])
  }

  accounting.save()
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()
  let data = event.params.data
  let accounting = getOrCreateAccountingEngine(event)

  if (what == 'surplusAuctionDelay') {
    accounting.surplusAuctionDelay = data
  } else if (what == 'popDebtDelay') {
    accounting.popDebtDelay = data
  } else if (what == 'surplusAuctionAmountToSell') {
    accounting.surplusAuctionAmountToSell = decimal.fromRad(data)
  } else if (what == 'debtAuctionBidSize') {
    accounting.debtAuctionBidSize = decimal.fromRad(data)
  } else if (what == 'initialDebtAuctionMintedTokens') {
    accounting.initialDebtAuctionMintedTokens = decimal.fromWad(data)
  } else if (what == 'surplusBuffer') {
    accounting.surplusBuffer = decimal.fromRad(data)
  } else if (what == 'disableCooldown') {
    accounting.disableCooldown = data
  }
}

export function handleAuctionDebt(event: AuctionDebt): void {
  let accounting = getOrCreateAccountingEngine(event)
  let config = getOrCreateEnglishAuctionConfiguration(accounting.debtAuctionHouse, enums.EnglishAuctionType_DEBT)

  if (config == null) {
    log.error('handleAuctionDebt - auction configuration {} not found', [enums.EnglishAuctionType_DEBT])
  }

  accounting.totalOnAuctionDebt = accounting.totalOnAuctionDebt.plus(accounting.debtAuctionBidSize)

  let id = event.params.id
  let auction = new EnglishAuction(enums.EnglishAuctionType_DEBT + '-' + id.toString())
  auction.auctionId = id
  auction.numberOfBids = integer.ZERO
  auction.englishAuctionType = enums.EnglishAuctionType_DEBT
  auction.buyToken = enums.AuctionToken_COIN
  auction.sellToken = enums.AuctionToken_COLLATERAL
  auction.sellInitialAmount = accounting.initialDebtAuctionMintedTokens
  auction.buyInitialAmount = accounting.debtAuctionBidSize
  auction.sellAmount = auction.sellInitialAmount
  auction.buyAmount = auction.buyInitialAmount
  auction.startedBy = event.address
  auction.isClaimed = false
  auction.createdAt = event.block.timestamp
  auction.createdAtBlock = event.block.number
  auction.createdAtTransaction = event.transaction.hash
  auction.englishAuctionConfiguration = enums.EnglishAuctionType_DEBT
  auction.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)

  auction.save()
  accounting.save()
}
export function handleAuctionSurplus(event: AuctionSurplus): void {
  let accounting = getOrCreateAccountingEngine(event)
  let config = getOrCreateEnglishAuctionConfiguration(
    accounting.surplusAuctionHouse,
    enums.EnglishAuctionType_SURPLUS_PRE,
  )

  if (config == null) {
    log.error('handleAuctionSurplus - auction configuration {} not found', [enums.EnglishAuctionType_DEBT])
  }

  accounting.lastSurplusAuctionTime = event.block.timestamp

  let id = event.params.id
  let auction = new EnglishAuction(enums.EnglishAuctionType_SURPLUS_PRE + '-' + id.toString())
  auction.auctionId = id
  auction.numberOfBids = integer.ZERO
  auction.englishAuctionType = enums.EnglishAuctionType_SURPLUS_PRE
  auction.buyToken = enums.AuctionToken_PROTOCOL_TOKEN
  auction.sellToken = enums.AuctionToken_COIN
  auction.sellInitialAmount = accounting.surplusAuctionAmountToSell
  auction.buyInitialAmount = decimal.ZERO
  auction.sellAmount = auction.sellInitialAmount
  auction.buyAmount = auction.buyInitialAmount
  auction.startedBy = event.address
  auction.isClaimed = false
  auction.createdAt = event.block.timestamp
  auction.createdAtBlock = event.block.number
  auction.createdAtTransaction = event.transaction.hash
  auction.englishAuctionConfiguration = enums.EnglishAuctionType_SURPLUS_PRE
  auction.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)

  auction.save()
  accounting.save()
}
