import {
  ModifyParameters,
  IncreaseBidSize,
  RestartAuction,
  SettleAuction,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/SurplusAuctionHouse/SurplusAuctionHouse'

import { EnglishAuctionConfiguration, EnglishAuctionBid, EnglishAuction } from '../../../entities'
import { BigInt, ethereum, BigDecimal, Bytes, dataSource } from '@graphprotocol/graph-ts'

import { toUnsignedInt } from '../../../utils/bytes'
import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import * as enums from '../../../utils/enums'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import { getOrCreateAccountingEngine } from '../../../entities/accounting-engine'

export function handleModifyParameters(event: ModifyParameters): void {
  let config = getOrCreateEnglishAuctionConfiguration(
    dataSource.address(),
    enums.EnglishAuctionType_SURPLUS,
  )
  let data = toUnsignedInt(event.params._data)
  modifyParameter(config, event.params._param.toString(), data)
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

export function handleIncreaseBidSize(event: IncreaseBidSize): void {
  increaseBidSize(
    event.params._id,
    decimal.fromWad(event.params._soldAmount),
    event.params._bidder,
    event.params._bidExpiry,
    event,
  )
}

function increaseBidSize(
  id: BigInt,
  bidAmount: BigDecimal,
  highBidder: Bytes,
  bidExpiry: BigInt,
  event: ethereum.Event,
): void {
  let auction = EnglishAuction.load(auctionId(id))
  let bid = new EnglishAuctionBid(bidAuctionId(id, auction.numberOfBids))

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
  auction.buyAmount = bid.buyAmount
  auction.price = bid.price
  auction.winner = bid.bidder
  auction.save()
}

export function handleRestartAuction(event: RestartAuction): void {
  restartAuction(event.params._id, event.params._auctionDeadline)
}

export function handleSettleAuction(event: SettleAuction): void {
  settleAuction(event.params._id, event)
}

function restartAuction(id: BigInt, auctionDeadline: BigInt): void {
  let auction = EnglishAuction.load(auctionId(id))
  auction.auctionDeadline = auctionDeadline
  auction.save()
}

function settleAuction(id: BigInt, event: ethereum.Event): void {
  let accounting = getOrCreateAccountingEngine(event)
  accounting.activeSurplusAuctions = accounting.activeSurplusAuctions.minus(integer.ONE)
  accounting.save()

  let auction = EnglishAuction.load(auctionId(id))
  auction.isClaimed = true
  auction.save()
}

function auctionId(auctionId: BigInt): string {
  return enums.EnglishAuctionType_SURPLUS + '-' + auctionId.toString()
}

function bidAuctionId(auctionId: BigInt, bidNumber: BigInt): string {
  return enums.EnglishAuctionType_SURPLUS + '-' + auctionId.toString() + '-' + bidNumber.toString()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params._account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params._account, event)
}
