import { log } from '@graphprotocol/graph-ts'
import {
  AddAuthorization,
  ModifyParameters as ModifyParametersCollateralTypeUint,
  ModifyParameters1 as ModifyParametersUint,
  RemoveAuthorization,
} from '../../../../generated/TaxCollector/TaxCollector'
import { getSystemState, getOrCreateCollateral } from '../../../entities'
import * as decimal from '../../../utils/decimal'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

// TODO: Authorizations
// TODO: Tax Recipients

export function handleModifyParametersCollateralTypeUint(
  event: ModifyParametersCollateralTypeUint,
): void {
  let what = event.params.parameter.toString()

  if (what == 'stabilityFee') {
    let collateral = getOrCreateCollateral(event.params.collateralType, event)
    collateral.stabilityFee = decimal.fromRay(event.params.data)
    collateral.stabilityFeeLastUpdatedAt = event.block.timestamp

    // Calculate the annualized
    let system = getSystemState(event)
    let totalPerSecondRate = decimal.toRay(system.globalStabilityFee).plus(event.params.data)

    collateral.totalAnnualizedStabilityFee = decimal.fromNumber(
      parseFloat(decimal.fromRay(totalPerSecondRate).toString()) ** 31536000,
    )
    collateral.save()
  }
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()

  if (what == 'globalStabilityFee') {
    let system = getSystemState(event)
    system.globalStabilityFee = decimal.fromRay(event.params.data)
    system.save()

    // TODO: Address this.
    log.error(
      `Collateral specific totalAnnualizedStabilityFee need to recalculated for all collateral`,
      [],
    )
  }
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
