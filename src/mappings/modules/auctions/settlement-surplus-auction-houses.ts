import {
  ModifyParameters as ModifyParametersPre,
  IncreaseBidSize as IncreaseBidSizePre,
  RestartAuction as RestartAuctionPre,
  SettleAuction as SettleAuctionPre,
} from '../../../../generated/templates/PreSettlementSurplusAuctionHouse/PreSettlementSurplusAuctionHouse'

import { EnglishAuctionConfiguration, EnglishAuctionBid, EnglishAuction } from '../../../entities'
import { BigInt, ethereum, BigDecimal, Bytes, dataSource } from '@graphprotocol/graph-ts'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import * as enums from '../../../utils/enums'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'

export function handleModifyParametersPre(event: ModifyParametersPre): void {
  let config = getOrCreateEnglishAuctionConfiguration(dataSource.address(), enums.EnglishAuctionType_SURPLUS)
  modifyParameter(config, event.params.parameter.toString(), event.params.data)
}

function modifyParameter(config: EnglishAuctionConfiguration, what: string, val: BigInt): void {
  if (what == 'bidIncrease') {
    config.bidIncrease = decimal.fromWad(val)
  } else if (what == 'bidDuration') {
    config.bidDuration = val
  } else if (what == 'totalAuctionLength') {
    config.totalAuctionLength = val
  } else if (what == 'amountSoldIncrease') {
    config.DEBT_amountSoldIncrease = decimal.fromWad(val)
  }
  config.save()
}

export function handleIncreaseBidSizePre(event: IncreaseBidSizePre): void {
  increaseBidSize(
    event.params.id,
    decimal.fromRad(event.params.bid),
    event.params.highBidder,
    event.params.bidExpiry,
    event,
    true,
  )
}

function increaseBidSize(
  id: BigInt,
  bidAmount: BigDecimal,
  highBidder: Bytes,
  bidExpiry: BigInt,
  event: ethereum.Event,
  isPre: boolean,
): void {
  let auction = EnglishAuction.load(auctionId(id, isPre))
  let bid = new EnglishAuctionBid(bidAuctionId(id, auction.auctionId, isPre))

  bid.bidNumber = auction.numberOfBids
  bid.type = enums.EnglishBidType_INCREASE_BUY
  bid.auction = auction.id
  bid.sellAmount = auction.sellInitialAmount
  bid.buyAmount = bidAmount
  bid.price = bid.sellAmount.div(bid.buyAmount)
  bid.bidder = highBidder
  bid.createdAt = event.block.timestamp
  bid.createdAtBlock = event.block.number
  bid.createdAtTransaction = event.transaction.hash
  bid.save()

  auction.numberOfBids = auction.numberOfBids.plus(integer.ONE)
  auction.auctionDeadline = bidExpiry
  auction.sellAmount = bid.sellAmount
  auction.price = bid.price
  auction.winner = bid.bidder
  auction.save()
}

export function handleRestartAuctionPre(event: RestartAuctionPre): void {
  restartAuction(event.params.id, event.params.auctionDeadline, true)
}

export function handleSettleAuctionPre(event: SettleAuctionPre): void {
  settleAuction(event.params.id, true)
}

function restartAuction(id: BigInt, auctionDeadline: BigInt, isPre: boolean): void {
  let auction = EnglishAuction.load(auctionId(id, isPre))
  auction.auctionDeadline = auctionDeadline
  auction.save()
}

function settleAuction(id: BigInt, isPre: boolean): void {
  let auction = EnglishAuction.load(auctionId(id, isPre))
  auction.isClaimed = true
  auction.save()
}

function auctionId(auctionId: BigInt, isPre: boolean): string {
  return isPre
    ? enums.EnglishAuctionType_SURPLUS
    : enums.EnglishAuctionType_SURPLUS + '-' + auctionId.toString()
}

function bidAuctionId(auctionId: BigInt, bidNumber: BigInt, isPre: boolean): string {
  return isPre
    ? enums.EnglishAuctionType_SURPLUS
    : enums.EnglishAuctionType_SURPLUS + '-' + auctionId.toString() + '-' + bidNumber.toString()
}
