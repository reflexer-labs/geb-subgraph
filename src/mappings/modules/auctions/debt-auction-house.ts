import {
  ModifyParameters as ModifyParametersUint,
  DecreaseSoldAmount,
  RestartAuction,
  SettleAuction,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/DebtAuctionHouse/DebtAuctionHouse'
import { EnglishAuctionConfiguration, EnglishAuctionBid, EnglishAuction } from '../../../entities'
import { dataSource, log, BigInt } from '@graphprotocol/graph-ts'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import * as enums from '../../../utils/enums'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'
import { getOrCreateAccountingEngine } from '../../../entities/accounting-engine'

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()

  let config = getOrCreateEnglishAuctionConfiguration(
    dataSource.address(),
    enums.EnglishAuctionType_DEBT,
  )
  let val = event.params.data

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

export function handleDecreaseSoldAmount(event: DecreaseSoldAmount): void {
  let auction = EnglishAuction.load(auctionId(event.params.id))
  if (auction != null) {
    let bid = new EnglishAuctionBid(bidAuctionId(event.params.id, auction.numberOfBids))

    bid.bidNumber = auction.numberOfBids
    bid.type = enums.EnglishBidType_DECREASE_SOLD
    bid.auction = auction.id
    bid.sellAmount = decimal.fromWad(event.params.amountToBuy)
    bid.buyAmount = auction.buyInitialAmount
    bid.price = bid.sellAmount.div(bid.buyAmount)
    bid.bidder = event.params.highBidder
    bid.createdAt = event.block.timestamp
    bid.createdAtBlock = event.block.number
    bid.createdAtTransaction = event.transaction.hash
    bid.save()
  
    auction.numberOfBids = auction.numberOfBids.plus(integer.ONE)
    auction.auctionDeadline = event.params.bidExpiry
    auction.sellAmount = bid.sellAmount
    auction.price = bid.price
    auction.winner = bid.bidder
    auction.save()
  }
}

export function handleRestartAuction(event: RestartAuction): void {
  let auction = EnglishAuction.load(auctionId(event.params.id))
  if (auction != null) {
    auction.auctionDeadline = event.params.auctionDeadline
    auction.save()
  }
}

export function handleSettleAuction(event: SettleAuction): void {
  let accounting = getOrCreateAccountingEngine(event)
  accounting.activeDebtAuctions = accounting.activeDebtAuctions.minus(integer.ONE)
  accounting.save()
  let auction = EnglishAuction.load(auctionId(event.params.id))
  if (auction != null) {
    auction.isClaimed = true
    auction.save()
  }
}

function auctionId(auctionId: BigInt): string {
  return enums.EnglishAuctionType_DEBT + '-' + auctionId.toString()
}

function bidAuctionId(auctionId: BigInt, bidNumber: BigInt): string {
  return enums.EnglishAuctionType_DEBT + '-' + auctionId.toString() + '-' + bidNumber.toString()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
