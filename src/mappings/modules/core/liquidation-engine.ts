import {
  ModifyParameters1 as ModifyParametersCollateralTypeUint,
  ModifyParameters2 as ModifyParametersCollateralTypeAddress,
  Liquidate,
} from '../../../../generated/LiquidationEngine/LiquidationEngine'
import { getSystemState, getOrCreateCollateral } from '../../../entities'
import * as decimal from '../../../utils/decimal'
import { updateLastModifyCollateralType } from '../../../utils/state'

export function handleModifyParametersCollateralTypeUint(event: ModifyParametersCollateralTypeUint): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  if (what == 'liquidationPenalty') {
    collateral.liquidationPenalty = decimal.fromRay(event.params.data)
  } else if (what == 'collateralToSell') {
    collateral.maxCollateralToSellInLiquidations = decimal.fromWad(event.params.data)
  }

  updateLastModifyCollateralType(collateral, event)
  collateral.save()
}

export function handleModifyParametersCollateralTypeAddress(event: ModifyParametersCollateralTypeAddress): void {
  let what = event.params.parameter.toString()
  let collateral = getOrCreateCollateral(event.params.collateralType, event)

  if (what == 'collateralAuctionHouse') {
    collateral.collateralAuctionHouseAddress = event.params.data
  }

  updateLastModifyCollateralType(collateral, event)
  collateral.save()
}

export function handleLiquidate(event: Liquidate): void {

}
