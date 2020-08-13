import { CollateralType } from '../../generated/schema'
import { Bytes, ethereum } from '@graphprotocol/graph-ts'

import * as decimal from '../utils/decimal'
import * as integer from '../utils/integer'

export function getOrCreateCollateral(collateralType: Bytes, event: ethereum.Event): CollateralType {
  let collateral = CollateralType.load(collateralType.toString())

  if (collateral == null) {
    collateral = new CollateralType(collateralType.toString())
    collateral.debtCeiling = decimal.ZERO
    collateral.debtFloor = decimal.ZERO
    collateral.debtAmount = decimal.ZERO

    // TODO: auction parameter init

    collateral.liquidationPenalty = decimal.ZERO
    collateral.liquidationCRatio = decimal.ZERO
    collateral.safetyCRatio = decimal.ZERO

    collateral.rate = decimal.ZERO

    collateral.stabilityFee = decimal.ONE

    collateral.unmanagedCdpCount = integer.ZERO
    collateral.cdpCount = integer.ZERO

    collateral.addedAt = event.block.timestamp
    collateral.addedAtBlock = event.block.number
    collateral.addedAtTransaction = event.transaction.hash

    collateral.save()
  }
  return collateral as CollateralType
}
