import {
  AddAuthorization,
  AddSecondaryReceiver,
  ModifyParameters as ModifyParametersCollateralTypeUint,
  ModifyParameters1 as ModifyParametersUint,
} from '../../../../generated/TaxCollector/TaxCollector'
import { getSystemState, getOrCreateCollateral } from '../../../entities'
import * as decimal from '../../../utils/decimal'

// TODO: Authorizations
// TODO: Tax Recipients 

export function handleModifyParametersCollateralTypeUint(event: ModifyParametersCollateralTypeUint): void {
  let what = event.params.parameter.toString()

  if (what == 'stabilityFee') {
    let collateral = getOrCreateCollateral(event.params.collateralType, event)
    collateral.stabilityFee = decimal.fromRay(event.params.data)
    collateral.stabilityFeeLastUpdatedAt = event.block.timestamp
    collateral.save()
  }
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()

  if (what == 'globalStabilityFee') {
    let system = getSystemState(event)
    system.globalStabilityFee = decimal.fromRay(event.params.data)
    system.save()
  }
}
