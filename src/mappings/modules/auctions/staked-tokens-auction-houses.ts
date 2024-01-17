import {
  ModifyParameters,
  IncreaseBidSize,
  RestartAuction,
  SettleAuction,
  AddAuthorization,
  RemoveAuthorization,
  StartAuction,
} from '../../../../generated/StakedTokenAuctionHouse/StakedTokenAuctionHouse'

import { EnglishAuctionConfiguration, EnglishAuctionBid, EnglishAuction } from '../../../entities'
import { BigInt, ethereum, BigDecimal, Bytes, dataSource, log } from '@graphprotocol/graph-ts'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import * as enums from '../../../utils/enums'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

export function handleModifyParameters(event: ModifyParameters): void {
  let config = getOrCreateEnglishAuctionConfiguration(
    dataSource.address(),
    enums.EnglishAuctionType_STAKED_TOKEN,
  )
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

export function handleStartAuction(event: StartAuction): void {
  let config = getOrCreateEnglishAuctionConfiguration(
    event.address,
    enums.EnglishAuctionType_STAKED_TOKEN,
  )

  if (config == null) {
    log.error('handleStartAuction (Staked token) - auction configuration {} not found', [
      enums.EnglishAuctionType_DEBT,
    ])
  }

  let id = event.params.id
  let auction = new EnglishAuction(enums.EnglishAuctionType_STAKED_TOKEN + '-' + id.toString())
  auction.auctionId = id
  auction.numberOfBids = integer.ZERO
  auction.englishAuctionType = enums.EnglishAuctionType_STAKED_TOKEN
  auction.buyToken = enums.AuctionToken_COIN
  auction.sellToken = enums.AuctionToken_PROTOCOL_TOKEN_LP
  auction.sellInitialAmount = decimal.fromWad(event.params.amountToSell)
  auction.buyInitialAmount = decimal.fromWad(event.params.amountToBid)
  auction.sellAmount = auction.sellInitialAmount
  auction.buyAmount = auction.buyInitialAmount
  auction.startedBy = event.address
  auction.isClaimed = false
  auction.createdAt = event.block.timestamp
  auction.createdAtBlock = event.block.number
  auction.createdAtTransaction = event.transaction.hash
  auction.englishAuctionConfiguration = enums.EnglishAuctionType_STAKED_TOKEN
  auction.auctionDeadline = config.totalAuctionLength.plus(event.block.timestamp)

  auction.save()
}

export function handleIncreaseBidSize(event: IncreaseBidSize): void {
  increaseBidSize(
    event.params.id,
    decimal.fromWad(event.params.bid),
    event.params.highBidder,
    event.params.bidExpiry,
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
  if (auction != null) {
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
}

export function handleRestartAuction(event: RestartAuction): void {
  restartAuction(event.params.id, event.params.auctionDeadline, event.params.minBid)
}

export function handleSettleAuction(event: SettleAuction): void {
  settleAuction(event.params.id, event)
}

function restartAuction(id: BigInt, auctionDeadline: BigInt, newBidAmount: BigInt): void {
  let auction = EnglishAuction.load(auctionId(id))
  if (auction != null) {
    auction.buyInitialAmount = decimal.fromWad(newBidAmount)
    auction.buyAmount = auction.buyInitialAmount
    auction.auctionDeadline = auctionDeadline
    auction.save()
  }
}

function settleAuction(id: BigInt, event: ethereum.Event): void {
  let auction = EnglishAuction.load(auctionId(id))
  if (auction != null) {
    auction.isClaimed = true
    auction.save()
  }
}

function auctionId(auctionId: BigInt): string {
  return enums.EnglishAuctionType_STAKED_TOKEN + '-' + auctionId.toString()
}

function bidAuctionId(auctionId: BigInt, bidNumber: BigInt): string {
  return (
    enums.EnglishAuctionType_STAKED_TOKEN + '-' + auctionId.toString() + '-' + bidNumber.toString()
  )
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
