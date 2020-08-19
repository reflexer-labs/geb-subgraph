import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
  FixedDiscountCollateralAuctionHouse,
  BuyCollateral,
} from '../../../../generated/templates/FixDiscountCollateralAuction/FixedDiscountCollateralAuctionHouse'
import { dataSource } from '@graphprotocol/graph-ts'
import {
  getOrCreateCollateral,
  FixDiscountAuctionConfiguration,
  FixDiscountCollateralAuction,
  FixDiscountAuctionBatch,
} from '../../../entities'

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(
    FixedDiscountCollateralAuctionHouse.bind(dataSource.address()).collateralType(),
    event,
  )
  let config = FixDiscountAuctionConfiguration.load(collateral.id)
  let val = event.params.data

  if (what == 'discount') {
    config.discount = decimal.fromWad(val)
  } else if (what == 'lowerCollateralMedianDeviation') {
    config.lowerCollateralMedianDeviation = decimal.fromWad(val)
  } else if (what == 'upperCollateralMedianDeviation') {
    config.upperCollateralMedianDeviation = decimal.fromWad(val)
  } else if (what == 'lowerSystemCoinMedianDeviation') {
    config.lowerSystemCoinMedianDeviation = decimal.fromWad(val)
  } else if (what == 'upperSystemCoinMedianDeviation') {
    config.upperSystemCoinMedianDeviation = decimal.fromWad(val)
  } else if (what == 'minSystemCoinMedianDeviation') {
    config.minSystemCoinMedianDeviation = decimal.fromWad(val)
  } else if (what == 'minimumBid') {
    config.minimumBid = decimal.fromWad(val)
  } else if (what == 'totalAuctionLength') {
    config.totalAuctionLength = val
  }

  config.save()
}

export function handleModifyParametersAddress(event: ModifyParametersAddress): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(
    FixedDiscountCollateralAuctionHouse.bind(dataSource.address()).collateralType(),
    event,
  )
  let config = FixDiscountAuctionConfiguration.load(collateral.id)
  let address = event.params.data

  if (what == 'oracleRelayer') {
    config.oracleRelayer = address
  } else if (what == 'collateralOSM') {
    config.collateralOSM = address
  } else if (what == 'collateralMedian') {
    config.collateralMedian = address
  } else if (what == 'systemCoinOracle') {
    config.systemCoinOracle = address
  }

  config.save()
}

export function handleBuyCollateral(event: BuyCollateral): void {
  let id = event.params.id
  let collateral = FixedDiscountCollateralAuctionHouse.bind(dataSource.address()).collateralType()

  let auctionId = collateral.toString() + '-' + id.toString()
  let auction = FixDiscountCollateralAuction.load(auctionId)
  let batch = new FixDiscountAuctionBatch(
    collateral.toString() + '-' + id.toString() + '-' + auction.numberOfBatches.toString(),
  )

  batch.batchNumber = auction.numberOfBatches
  batch.auction = auctionId
  batch.collateral = decimal.fromRad(event.params.boughtCollateral)
  let wad = decimal.fromWad(event.params.wad)
  let remainingToRaise = auction.bondAmountToRaise.minus(auction.bondAmountRaised)
  batch.debtAmount = wad.gt(remainingToRaise) ? remainingToRaise : wad
  batch.price = batch.collateral.div(batch.debtAmount)
  batch.buyer = event.address
  batch.createdAt = event.block.timestamp
  batch.createdAtBlock = event.block.number
  batch.createdAtTransaction = event.transaction.hash
  batch.save()

  auction.numberOfBatches = auction.numberOfBatches.plus(integer.ONE)
  auction.bondAmountRaised = auction.bondAmountRaised.plus(batch.debtAmount)
  auction.collateralAmountSold = auction.collateralAmountSold.plus(batch.collateral)
  auction.isTerminated = auction.bondAmountRaised.equals(auction.bondAmountToRaise) ? true : false
  auction.save()
}
