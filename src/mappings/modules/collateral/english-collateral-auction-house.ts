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
  CollateralAuction,
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
    collateral.totalAuctionLength = val
  } else if (what == 'bidToMarketPriceRatio') {
    config.bidToMarketPriceRatio = decimal.fromRay(val)
  }

  config.save()
}

export function handleDecreaseSoldAmount(event: DecreaseSoldAmount): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()
  let bid = new EnglishAuctionBid(event.block.number.toString() + '-' + id.toString())

  let auctionId = id.toString() + '-' + collateral.toString()
  let auction = CollateralAuction.load(auctionId)

  bid.type = 'DecreaseSoldAmount'
  bid.auction = auctionId
  bid.bidAmount = auction.amountToRaise
  bid.amountToSell = decimal.fromRad(event.params.amountToBuy)
  bid.price = bid.amountToSell.div(bid.bidAmount)
  bid.bidExpiry = event.params.bidExpiry
  bid.bidder = event.params.highBidder
  bid.createdAt = event.block.timestamp
  bid.createdAtBlock = event.block.number
  bid.createdAtTransaction = event.transaction.hash
  bid.save()

  auction.auctionDeadline = event.params.bidExpiry
  auction.save()
}

export function handleIncreaseBidSize(event: IncreaseBidSize): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()
  let bid = new EnglishAuctionBid(event.block.number.toString() + '-' + id.toString())

  let auctionId = id.toString() + '-' + collateral.toString()
  let auction = CollateralAuction.load(auctionId)

  bid.type = 'IncreaseBidSize'
  bid.auction = auctionId
  bid.bidAmount = decimal.fromRad(event.params.rad)
  bid.amountToSell = auction.collateralAmount
  bid.price = bid.amountToSell.div(bid.bidAmount)
  bid.bidExpiry = event.params.bidExpiry
  bid.bidder = event.params.highBidder
  bid.createdAt = event.block.timestamp
  bid.createdAtBlock = event.block.number
  bid.createdAtTransaction = event.transaction.hash
  bid.save()

  auction.auctionDeadline = event.params.bidExpiry
  auction.save()
}

export function handleRestartAuction(event: RestartAuction): void {
  let id = event.params.id
  let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()
  let auctionId = id.toString() + '-' + collateral.toString()
  let auction = CollateralAuction.load(auctionId)
  auction.auctionDeadline = event.params.auctionDeadline
}

export function handleSettleAuction(event: SettleAuction): void {
    let id = event.params.id
    let collateral = EnglishCollateralAuctionHouse.bind(dataSource.address()).collateralType()
    let auctionId = id.toString() + '-' + collateral.toString()
    let auction = CollateralAuction.load(auctionId)
    auction.isClaimed = true
}
