import { log } from '@graphprotocol/graph-ts'
import {
  AddAuthorization,
  ModifyParameters as ModifyParameters,
  RemoveAuthorization,
} from '../../../../generated/TaxCollector/TaxCollector'
import { getSystemState, getOrCreateCollateral } from '../../../entities'
import * as decimal from '../../../utils/decimal'
import * as integer from '../../../utils/integer'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

// TODO: Authorizations
// TODO: Tax Recipients

export function handleModifyParameters(
  event: ModifyParameters,
): void {
  let what = event.params._param.toString()

  if (what == 'stabilityFee') {
    let collateral = getOrCreateCollateral(event.params._cType, event)
    let data = decimal.fromRay(integer.BigInt.fromUnsignedBytes(event.params._data))

    collateral.stabilityFee = data
    collateral.stabilityFeeLastUpdatedAt = event.block.timestamp

    // Calculate the annualized
    let system = getSystemState(event)
    let totalPerSecondRate = decimal.toRay(system.globalStabilityFee).plus(decimal.toRay(data))

    collateral.totalAnnualizedStabilityFee = decimal.fromNumber(
      parseFloat(decimal.fromRay(totalPerSecondRate).toString()) ** 31536000,
    )
    collateral.save()
  } else if (what == 'globalStabilityFee') {
    let data = decimal.fromRay(integer.BigInt.fromUnsignedBytes(event.params._data))

    let system = getSystemState(event)
    system.globalStabilityFee = data
    system.save()

    // TODO: Address this.
    log.error(
      `Collateral specific totalAnnualizedStabilityFee need to recalculated for all collateral`,
      [],
    )
  }
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params._account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params._account, event)
}
