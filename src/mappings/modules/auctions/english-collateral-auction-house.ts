import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
  DecreaseSoldAmount,
  EnglishCollateralAuctionHouse,
  IncreaseBidSize,
  RestartAuction,
  SettleAuction,
} from '../../../../generated/templates/EnglishCollateralAuctionHouse/EnglishCollateralAuctionHouse'
import {
  EnglishAuctionConfiguration,
  EnglishAuctionBid,
  EnglishCollateralAuction,
  getOrCreateCollateral,
} from '../../../entities'
import { dataSource, log } from '@graphprotocol/graph-ts'

import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'

export function handleModifyParametersAddress(event: ModifyParametersAddress): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(
    EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType(),
    event,
  )
  let config = EnglishAuctionConfiguration.load(collateral.id)
  let address = event.params.data

  if (what == 'oracleRelayer') {
    config.oracleRelayer = address
  } else if (what == 'osm') {
    config.osm = address
  }

  config.save()
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(
    EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType(),
    event,
  )
  let config = EnglishAuctionConfiguration.load(collateral.id)
  let val = event.params.data

  if (what == 'bidIncrease') {
    config.bidIncrease = decimal.fromWad(val)
  } else if (what == 'bidDuration') {
    config.bidDuration = val
  } else if (what == 'totalAuctionLength') {
    config.totalAuctionLength = val
  } else if (what == 'bidToMarketPriceRatio') {
    config.bidToMarketPriceRatio = decimal.fromRay(val)
  }

  config.save()
}

export function handleDecreaseSoldAmount(event: DecreaseSoldAmount): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()

  let auctionId = id.toString() + '-' + collateral.toString()
  let auction = EnglishCollateralAuction.load(auctionId)
  let bid = new EnglishAuctionBid(collateral.toString() + '-' + id.toString() + '-' + auction.numberOfBids.toString())

  bid.type = 'DecreaseSoldAmount'
  bid.auction = auctionId
  bid.bondAmountRaised = auction.bondAmountToRaise
  bid.bidExpiry = event.params.bidExpiry
  bid.bidder = event.params.highBidder
  bid.createdAt = event.block.timestamp
  bid.createdAtBlock = event.block.number
  bid.createdAtTransaction = event.transaction.hash
  bid.bidNumber = auction.numberOfBids

  // Decrease the amount of collateral sold off
  bid.collateralAmountSold = decimal.fromRad(event.params.amountToBuy)
  bid.price = bid.collateralAmountSold.div(bid.bondAmountRaised)
  bid.save()

  auction.numberOfBids = auction.numberOfBids.plus(integer.ONE)
  auction.auctionDeadline = event.params.bidExpiry
  auction.collateralAmountSold = bid.collateralAmountSold
  auction.highestBidPrice = bid.price
  auction.highestBidder = bid.bidder
  auction.save()
}

export function handleIncreaseBidSize(event: IncreaseBidSize): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()

  let auctionId = id.toString() + '-' + collateral.toString()
  let auction = EnglishCollateralAuction.load(auctionId)
  let bid = new EnglishAuctionBid(collateral.toString() + '-' + id.toString() + '-' + auction.numberOfBids.toString())

  bid.type = 'IncreaseBidSize'
  bid.auction = auctionId
  bid.collateralAmountSold = auction.initialCollateralAmount
  bid.bidExpiry = event.params.bidExpiry
  bid.bidder = event.params.highBidder
  bid.createdAt = event.block.timestamp
  bid.createdAtBlock = event.block.number
  bid.createdAtTransaction = event.transaction.hash
  bid.bidNumber = auction.numberOfBids

  // Increased to amount of bond received
  bid.bondAmountRaised = decimal.fromRad(event.params.rad)
  bid.price = bid.collateralAmountSold.div(bid.bondAmountRaised)
  bid.save()

  auction.numberOfBids = auction.numberOfBids.plus(integer.ONE)
  auction.auctionDeadline = event.params.bidExpiry
  auction.bondAmountRaised = bid.bondAmountRaised
  auction.highestBidPrice = bid.price
  auction.highestBidder = bid.bidder
  auction.save()
}

export function handleRestartAuction(event: RestartAuction): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()
  let auctionId = id.toString() + '-' + collateral.toString()
  let auction = EnglishCollateralAuction.load(auctionId)
  auction.auctionDeadline = event.params.auctionDeadline
}

export function handleSettleAuction(event: SettleAuction): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()
  let auctionId = id.toString() + '-' + collateral.toString()
  let auction = EnglishCollateralAuction.load(auctionId)
  auction.isClaimed = true
}
