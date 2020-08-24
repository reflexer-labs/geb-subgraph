import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
  AuctionDebt,
  AuctionSurplus,
} from '../../../../generated/AccountingEngine/AccountingEngine'
import { getAccountingEngine } from '../../../entities/system'
import { EnglishAuction, EnglishAuctionConfiguration } from '../../../entities'
import { dataSource } from '@graphprotocol/graph-ts'

export function handleModifyParametersAddress(event: ModifyParametersAddress): void {
  let what = event.params.parameter.toString()
  let data = event.params.data
  let accounting = getAccountingEngine(event)

  if (what == 'surplusAuctionHouse') {
    accounting.surplusAuctionHouse = data
  } else if (what == 'debtAuctionHouse') {
    // Assign the debt auction house

    accounting.debtAuctionHouse = data
    let config = new EnglishAuctionConfiguration('debt')
    config.bidIncrease = decimal.fromNumber(1.05)
    config.bidDuration = integer.HOUR.times(integer.fromNumber(3)) // 3 hours
    config.totalAuctionLength = integer.DAY.times(integer.fromNumber(2)) // 2 days
    config.DEBT_amountSoldIncrease = decimal.fromNumber(1.05)
    config.save()
  } else if (what == 'postSettlementSurplusDrain') {
    accounting.postSettlementSurplusDrain = data
  } else if (what == 'protocolTokenAuthority') {
    accounting.protocolTokenAuthority = data
  }
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()
  let data = event.params.data
  let accounting = getAccountingEngine(event)

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
  let accounting = getAccountingEngine(event)
  let config = EnglishAuctionConfiguration.load('DEBT')

  
  accounting.totalOnAuctionDebt = accounting.totalOnAuctionDebt.plus(accounting.debtAuctionBidSize)

  let id = event.params.id
  let auction = new EnglishAuction('DEBT-' + id.toString())

  auction.auctionId = id
  auction.numberOfBids = integer.ZERO
  auction.englishAuctionType = 'DEBT'
  auction.buyToken = 'BOND'
  auction.sellToken = 'PROTOCOL_TOKEN'
  auction.sellInitialAmount = accounting.initialDebtAuctionMintedTokens
  auction.buyInitialAmount = accounting.debtAuctionBidSize
  auction.sellAmount = auction.sellInitialAmount
  auction.buyAmount = auction.buyInitialAmount
  auction.startedBy = event.address
  auction.isClaimed = false
  auction.createdAt = event.block.timestamp
  auction.createdAtBlock = event.block.number
  auction.createdAtTransaction = event.transaction.hash
  auction.englishAuctionConfiguration = 'DEBT'
  auction.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)

  auction.save()
  accounting.save()
}
export function handleAuctionSurplus(event: AuctionSurplus): void {
  // TODO:
}
