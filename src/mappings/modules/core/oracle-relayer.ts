import { log, dataSource } from '@graphprotocol/graph-ts'

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
import { getSystemState } from '../../../entities'

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

  let system = getSystemState(event)
  system.currentRedemptionPrice = price.id

  system.save()
  price.save()
}

export function handleModifyParametersCollateralTypeAddress(event: ModifyParametersCollateralTypeAddress): void {
  let what = event.params.parameter.toString()

  if (what == 'orcl') {
    let collateralType = CollateralType.load(event.params.collateralType.toString())
    collateralType.osmAddress = event.params.addr
    collateralType.save()
  }
}

export function handleModifyParametersCollateralTypeUint(event: ModifyParametersCollateralTypeUint): void {
  let what = event.params.parameter.toString()
  let collateralType = CollateralType.load(event.params.collateralType.toString())

  if (what == 'safetyCRatio') {
    collateralType.safetyCRatio = decimal.fromRay(event.params.data)
  } else if (what == 'liquidationCRatio') {
    collateralType.liquidationCRatio = decimal.fromRay(event.params.data)
  }

  collateralType.save()
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()

  if (what == 'redemptionPrice') {
    log.error('ModifyParameters-redemptionPrice is not supported', [])
  } else if (what == 'redemptionRate') {
    let system = getSystemState(event)
    let rate = new RedemptionRate(event.block.number.toString())
    rate.block = event.block.number
    rate.timestamp = event.block.timestamp
    rate.value = decimal.fromRay(event.params.data)
    let relayer = OracleRelayer.bind(dataSource.address())
    // TODO: Test, does that work ? `redemptionPrice` is not view
    rate.redemptionPrice = decimal.fromRay(relayer.redemptionPrice())
    system.currentRedemptionRate = rate.id

    rate.save()
    system.save()
  }
}
