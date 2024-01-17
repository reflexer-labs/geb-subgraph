import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import {
  ModifyParameters as ModifyParametersUint,
  ModifyParameters1 as ModifyParametersAddress,
  FixedDiscountCollateralAuctionHouse,
  BuyCollateral,
  SettleAuction,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/templates/FixedDiscountCollateralAuctionHouse/FixedDiscountCollateralAuctionHouse'
import { dataSource, log } from '@graphprotocol/graph-ts'
import { getOrCreateCollateral, DiscountAuction, DiscountAuctionBatch } from '../../../entities'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

export function handleBuyCollateral(event: BuyCollateral): void {
  let id = event.params.id
  let collateral = FixedDiscountCollateralAuctionHouse.bind(dataSource.address()).collateralType()

  let auctionId = event.address.toHexString() + '-' + id.toString()
  let auction = DiscountAuction.load(auctionId)

  if (auction == null) {
    log.error('handleBuyCollateral - auction {} not found.', [auctionId])
  } else {
    let batch = new DiscountAuctionBatch(
      event.address.toHexString() + '-' + id.toString() + '-' + auction.numberOfBatches.toString(),
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
}

export function handleSettleAuction(event: SettleAuction): void {
  let id = event.params.id
  let collateralContract = FixedDiscountCollateralAuctionHouse.bind(dataSource.address())
  let collateralName = collateralContract.collateralType()

  let collateral = getOrCreateCollateral(collateralName, event)
  collateral.activeLiquidations = collateral.activeLiquidations.minus(integer.ONE)

  let auctionId = event.address.toHexString() + '-' + id.toString()
  let auction = DiscountAuction.load(auctionId)
  if (auction != null) {
    auction.isSettled = true
    auction.save()
  }
  
  collateral.save()
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
