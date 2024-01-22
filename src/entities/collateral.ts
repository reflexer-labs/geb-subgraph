import { CollateralType, CollateralSafe } from '../../generated/schema'
import { Bytes, ethereum, BigInt, Entity, Address } from '@graphprotocol/graph-ts'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'

export function getOrCreateCollateral(
  collateralType: Bytes,
  event: ethereum.Event,
): CollateralType {
  let collateral = CollateralType.load(collateralType.toString())
  if (collateral == null) {
    collateral = new CollateralType(collateralType.toString())
    let collateralSafe = new CollateralSafe(collateralType.toString())
    collateralSafe.safeIds = []
    collateral.debtCeiling = decimal.ZERO
    collateral.debtFloor = decimal.ZERO
    collateral.debtAmount = decimal.ZERO

    // TODO: auction parameter init

    collateral.liquidationPenalty = decimal.ZERO
    collateral.liquidationQuantity = decimal.ZERO
    collateral.liquidationCRatio = decimal.ZERO
    collateral.safetyCRatio = decimal.ZERO
    collateral.collateralAuctionHouseAddress = Address.fromHexString(
      '0x0000000000000000000000000000000000000000',
    ) as Bytes
    
    collateral.accumulatedRate = decimal.fromRay(BigInt.fromI32(10).pow(27))

    collateral.stabilityFee = decimal.ONE
    collateral.totalAnnualizedStabilityFee = decimal.ONE
    collateral.stabilityFeeLastUpdatedAt = event.block.timestamp

    collateral.unmanagedSafeCount = integer.ZERO
    collateral.safeCount = integer.ZERO

    collateral.totalCollateral = decimal.ZERO
    collateral.totalCollateralLockedInSafes = decimal.ZERO

    collateral.liquidationsStarted = integer.ZERO
    collateral.activeLiquidations = integer.ZERO

    collateral.createdAt = event.block.timestamp
    collateral.createdAtBlock = event.block.number
    collateral.createdAtTransaction = event.transaction.hash

    collateral.save()
    collateralSafe.save()
  }

  collateral.modifiedAt = event.block.timestamp
  collateral.modifiedAtBlock = event.block.number
  collateral.modifiedAtTransaction = event.transaction.hash
  collateral.save()

  return collateral as CollateralType
}

export function getCollateral(
  collateralType: string,
): CollateralType | null {
  let collateral = CollateralType.load(collateralType)
  return collateral
}

