import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
  FixedDiscountCollateralAuctionHouse,
  BuyCollateral,
  SettleAuction,
} from '../../../../generated/templates/FixDiscountCollateralAuctionHouse/FixedDiscountCollateralAuctionHouse'
import { dataSource, log } from '@graphprotocol/graph-ts'
import {
  getOrCreateCollateral,
  FixDiscountAuctionConfiguration,
  FixDiscountAuction,
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
  let auction = FixDiscountAuction.load(auctionId)

  if (auction == null) {
    log.error('handleBuyCollateral - auction {} not found.', [auctionId])
  }

  let batch = new FixDiscountAuctionBatch(
    collateral.toString() + '-' + id.toString() + '-' + auction.numberOfBatches.toString(),
  )

  batch.batchNumber = auction.numberOfBatches
  batch.auction = auctionId
  let remainingToRaise = auction.amountToRaise.minus(auction.buyAmount)
  let wad = decimal.fromWad(event.params.wad)
  batch.buyAmount = wad.gt(remainingToRaise) ? remainingToRaise : wad
  batch.sellAmount = decimal.fromWad(event.params.boughtCollateral)
  batch.price = batch.sellAmount.div(batch.buyAmount)
  batch.buyer = event.transaction.from
  batch.createdAt = event.block.timestamp
  batch.createdAtBlock = event.block.number
  batch.createdAtTransaction = event.transaction.hash
  batch.save()

  auction.numberOfBatches = auction.numberOfBatches.plus(integer.ONE)
  auction.buyAmount = auction.buyAmount.plus(batch.buyAmount)
  auction.sellAmount = auction.sellAmount.minus(batch.sellAmount)
  auction.isTerminated = auction.amountToRaise.equals(auction.buyAmount) ? true : false
  auction.save()
}

export function handleSettleAuction(event: SettleAuction): void {
  let id = event.params.id
  let collateral = FixedDiscountCollateralAuctionHouse.bind(dataSource.address()).collateralType()
  let auctionId = collateral.toString() + '-' + id.toString()
  let auction = FixDiscountAuction.load(auctionId)

  auction.isSettled = true
  auction.save()
}
