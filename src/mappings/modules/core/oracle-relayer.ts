import { Address, Bytes, log, dataSource } from '@graphprotocol/graph-ts'

import * as bytes from '../../../utils/bytes'
import * as decimal from '../../../utils/decimal'

import {
  UpdateCollateralPrice,
  UpdateRedemptionPrice,
  ModifyParameters as ModifyParametersCollateralTypeAddress,
  ModifyParameters1 as ModifyParametersUint,
  ModifyParameters2 as ModifyParametersCollateralTypeUint,
  OracleRelayer,
} from '../../../../generated/OracleRelayer/OracleRelayer'
import { CollateralType, CollateralPrice, RedemptionPrice, RedemptionRate } from '../../../../generated/schema'

export function handleUpdateCollateralPrice(event: UpdateCollateralPrice): void {
  let collateralType = event.params.collateralType.toString()
  let collateralPrice = bytes.toUnsignedInt(event.params.priceFeedValue)

  let collateral = CollateralType.load(collateralType)

  if (collateral != null) {
    let price = new CollateralPrice(event.block.number.toString() + '-' + collateralType)
    price.block = event.block.number
    price.collateral = collateral.id
    price.safetyPrice = decimal.fromRay(event.params.safetyPrice)
    price.liquidationPrice = decimal.fromRay(event.params.liquidationPrice)
    price.timestamp = event.block.timestamp
    price.value = decimal.fromWad(collateralPrice)
    price.save()

    collateral.currentPrice = price.id
    collateral.save()
  }
}

export function handleUpdateRedemptionPrice(event: UpdateRedemptionPrice): void {
  let price = new RedemptionPrice(event.block.number.toString())
  price.block = event.block.number
  price.timestamp = event.block.timestamp
  price.value = decimal.fromRay(event.params.redemptionPrice)
  let relayer = OracleRelayer.bind(dataSource.address())
  price.redemptionRate = decimal.fromRay(relayer.redemptionRate())
  price.save()
}

export function handleModifyParametersCollateralTypeAddress(event: ModifyParametersCollateralTypeAddress): void {}

export function handleModifyParametersCollateralTypeUint(event: ModifyParametersCollateralTypeUint): void {}

export function handleModifyParametersUint(event: ModifyParametersUint): void {}
