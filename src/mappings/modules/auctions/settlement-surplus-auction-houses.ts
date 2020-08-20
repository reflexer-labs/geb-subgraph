import {
  ModifyParameters as ModifyParametersPost,
  IncreaseBidSize as IncreaseBidSizePost,
  RestartAuction as RestartAuctionPost,
  SettleAuction as SettleAuctionPost,
} from '../../../../generated/templates/PostSettlementSurplusAuctionHouse/PostSettlementSurplusAuctionHouse'

import {
  ModifyParameters as ModifyParametersPre,
  IncreaseBidSize as IncreaseBidSizePre,
  RestartAuction as RestartAuctionPre,
  SettleAuction as SettleAuctionPre,
} from '../../../../generated/templates/PreSettlementSurplusAuctionHouse/PreSettlementSurplusAuctionHouse'

import { EnglishAuctionConfiguration, EnglishAuctionBid, EnglishAuction } from '../../../entities'
import { BigInt, ethereum, BigDecimal, Bytes } from '@graphprotocol/graph-ts'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'

export function handleModifyParametersPost(event: ModifyParametersPost): void {
  let config = EnglishAuctionConfiguration.load('SURPLUS_POST') as EnglishAuctionConfiguration
  modifyParameter(config, event.params.parameter.toString(), event.params.data)
}

export function handleModifyParametersPre(event: ModifyParametersPre): void {
  let config = EnglishAuctionConfiguration.load('SURPLUS_PRE') as EnglishAuctionConfiguration
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

export function handleIncreaseBidSizePost(event: IncreaseBidSizePost): void {
  increaseBidSize(
    event.params.id,
    decimal.fromRad(event.params.bid),
    event.params.highBidder,
    event.params.bidExpiry,
    event,
    false,
  )
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
  bid.type = 'INCREASE_BUY'
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

export function handleRestartAuctionPost(event: RestartAuctionPost): void {
  restartAuction(event.params.id, event.params.auctionDeadline, false)
}

export function handleSettleAuctionPre(event: SettleAuctionPre): void {
  settleAuction(event.params.id, true)
}

export function handleSettleAuctionPost(event: SettleAuctionPost): void {
  settleAuction(event.params.id, false)
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
  return isPre ? 'SURPLUS_PRE-' : 'SURPLUS_POST-' + auctionId.toString()
}

function bidAuctionId(auctionId: BigInt, bidNumber: BigInt, isPre: boolean): string {
  return isPre ? 'SURPLUS_PRE-' : 'SURPLUS_POST-' + auctionId.toString() + '-' + bidNumber.toString()
}
