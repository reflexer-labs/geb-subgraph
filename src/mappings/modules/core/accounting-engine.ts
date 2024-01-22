import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import * as bytes from '../../../utils/bytes'
import {
  ModifyParameters,
  AuctionDebt,
  AuctionSurplus,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/AccountingEngine/AccountingEngine'
import { EnglishAuction } from '../../../entities'
import { log } from '@graphprotocol/graph-ts'
import * as enums from '../../../utils/enums'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import { getOrCreateAccountingEngine } from '../../../entities/accounting-engine'

export function handleModifyParameters(event: ModifyParameters): void {
  let what = event.params._param.toString()
  let data = event.params._data
  let accounting = getOrCreateAccountingEngine(event)

  if (what == 'surplusAuctionHouse') {
    // If this is called we need to adjust the subgraph accordingly anyway
    log.error('Setting surplus auction house to {}', [accounting.surplusAuctionHouse.toHexString()])
  } else if (what == 'debtAuctionHouse') {
    // If this is called we need to adjust the subgraph accordingly anyway
    log.error('Setting debt auction house to {}', [accounting.debtAuctionHouse.toHexString()])
  } else if (what == 'postSettlementSurplusDrain') {
    accounting.postSettlementSurplusDrain = bytes.toAddress(data)
    log.info('Set postSettlementSurplusDrain in accounting engine', [])
  } else if (what == 'surplusAuctionDelay') {
    accounting.surplusAuctionDelay = bytes.toUnsignedInt(data)
  } else if (what == 'popDebtDelay') {
    accounting.popDebtDelay = bytes.toUnsignedInt(data)
  } else if (what == 'surplusAuctionAmountToSell') {
    accounting.surplusAuctionAmountToSell = decimal.fromRad(bytes.toUnsignedInt(data))
  } else if (what == 'debtAuctionBidSize') {
    accounting.debtAuctionBidSize = decimal.fromRad(bytes.toUnsignedInt(data))
  } else if (what == 'initialDebtAuctionMintedTokens') {
    accounting.initialDebtAuctionMintedTokens = decimal.fromWad(bytes.toUnsignedInt(data))
  } else if (what == 'surplusBuffer') {
    accounting.surplusBuffer = decimal.fromRad(bytes.toUnsignedInt(data))
  } else if (what == 'disableCooldown') {
    accounting.disableCooldown = bytes.toUnsignedInt(data)
  }

  accounting.save()
}

export function handleAuctionDebt(event: AuctionDebt): void {
  let accounting = getOrCreateAccountingEngine(event)
  let config = getOrCreateEnglishAuctionConfiguration(
    accounting.debtAuctionHouse,
    enums.EnglishAuctionType_DEBT,
  )

  if (config == null) {
    log.error('handleAuctionDebt - auction configuration {} not found', [
      enums.EnglishAuctionType_DEBT,
    ])
  }

  accounting.totalOnAuctionDebt = accounting.totalOnAuctionDebt.plus(accounting.debtAuctionBidSize)
  accounting.debtAuctionCount = accounting.debtAuctionCount.plus(integer.ONE)
  accounting.activeDebtAuctions = accounting.activeDebtAuctions.plus(integer.ONE)

  let id = event.params._id
  let auction = new EnglishAuction(enums.EnglishAuctionType_DEBT + '-' + id.toString())
  auction.auctionId = id
  auction.numberOfBids = integer.ZERO
  auction.englishAuctionType = enums.EnglishAuctionType_DEBT
  auction.buyToken = enums.AuctionToken_COIN
  auction.sellToken = enums.AuctionToken_PROTOCOL_TOKEN
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
    enums.EnglishAuctionType_SURPLUS,
  )

  if (config == null) {
    log.error('handleAuctionSurplus - auction configuration {} not found', [
      enums.EnglishAuctionType_DEBT,
    ])
  }

  accounting.lastSurplusAuctionTime = event.block.timestamp
  accounting.surplusAuctionCount = accounting.surplusAuctionCount.plus(integer.ONE)
  accounting.activeSurplusAuctions = accounting.activeSurplusAuctions.plus(integer.ONE)

  let id = event.params._id
  let auction = new EnglishAuction(enums.EnglishAuctionType_SURPLUS + '-' + id.toString())
  auction.auctionId = id
  auction.numberOfBids = integer.ZERO
  auction.englishAuctionType = enums.EnglishAuctionType_SURPLUS
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
  auction.englishAuctionConfiguration = enums.EnglishAuctionType_SURPLUS
  auction.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)

  auction.save()
  accounting.save()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params._account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params._account, event)
}
