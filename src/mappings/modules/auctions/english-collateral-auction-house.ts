import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
  DecreaseSoldAmount,
  EnglishCollateralAuctionHouse,
  IncreaseBidSize,
  RestartAuction,
  SettleAuction,
} from '../../../../generated/templates/EnglishCollateralAuctionHouse/EnglishCollateralAuctionHouse'
import { EnglishAuctionBid, EnglishAuction, getOrCreateCollateral } from '../../../entities'
import { dataSource, BigDecimal } from '@graphprotocol/graph-ts'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import * as enums from '../../../utils/enums'
import { getOrCreateEnglishAuctionConfiguration } from '../../../entities/auctions'

export function handleModifyParametersAddress(event: ModifyParametersAddress): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(
    EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType(),
    event,
  )
  let config = getOrCreateEnglishAuctionConfiguration(dataSource.address(), collateral.id)
  let address = event.params.data

  if (what == 'oracleRelayer') {
    config.LIQUIDATION_oracleRelayer = address
  } else if (what == 'osm') {
    config.LIQUIDATION_osm = address
  }

  config.save()
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(
    EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType(),
    event,
  )
  let config = getOrCreateEnglishAuctionConfiguration(dataSource.address(), collateral.id)
  let val = event.params.data

  if (what == 'bidIncrease') {
    config.bidIncrease = decimal.fromWad(val)
  } else if (what == 'bidDuration') {
    config.bidDuration = val
  } else if (what == 'totalAuctionLength') {
    config.totalAuctionLength = val
  }

  config.save()
}

export function handleDecreaseSoldAmount(event: DecreaseSoldAmount): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()

  let auctionId = collateral.toString() + '-' + id.toString()
  let auction = EnglishAuction.load(auctionId)
  let bid = new EnglishAuctionBid(collateral.toString() + '-' + id.toString() + '-' + auction.numberOfBids.toString())

  bid.bidNumber = auction.numberOfBids
  bid.type = enums.EnglishBidType_DECREASE_SOLD
  bid.auction = auctionId
  bid.sellAmount = decimal.fromRad(event.params.amountToBuy)
  bid.buyAmount = auction.targetAmount as BigDecimal
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

export function handleIncreaseBidSize(event: IncreaseBidSize): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()

  let auctionId = collateral.toString() + '-' + id.toString()
  let auction = EnglishAuction.load(auctionId)
  let bid = new EnglishAuctionBid(collateral.toString() + '-' + id.toString() + '-' + auction.numberOfBids.toString())

  bid.bidNumber = auction.numberOfBids
  bid.type = enums.EnglishBidType_INCREASE_BUY
  bid.auction = auctionId
  bid.sellAmount = auction.sellInitialAmount
  bid.buyAmount = decimal.fromRad(event.params.rad)
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

export function handleRestartAuction(event: RestartAuction): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()
  let auctionId = collateral.toString() + '-' + id.toString()
  let auction = EnglishAuction.load(auctionId)
  auction.auctionDeadline = event.params.auctionDeadline
  auction.save()
}

export function handleSettleAuction(event: SettleAuction): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()
  let auctionId = collateral.toString() + '-' + id.toString()
  let auction = EnglishAuction.load(auctionId)
  auction.isClaimed = true
  auction.save()
}
