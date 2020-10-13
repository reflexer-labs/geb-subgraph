import { Address, log } from '@graphprotocol/graph-ts'
import { RateSetter } from '../../../../generated/TaxCollector/RateSetter'
import {
  ModifyParameters as ModifyParametersCollateralTypeUint,
  ModifyParameters1 as ModifyParametersUint,
} from '../../../../generated/TaxCollector/TaxCollector'
import { getSystemState, getOrCreateCollateral } from '../../../entities'
import { addresses } from '../../../utils/addresses'
import * as decimal from '../../../utils/decimal'
import { SECOND_PER_YEAR } from '../../../utils/integer'

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
    let rateSetterContract = RateSetter.bind(addresses.get('GEB_RRFM_SETTER') as Address)
    let totalPerSecondRate = decimal.toRay(system.globalStabilityFee).plus(event.params.data)

    collateral.totalAnnualizedStabilityFee = decimal.fromRay(
      rateSetterContract.rpower(totalPerSecondRate, SECOND_PER_YEAR, decimal.rayBigInt),
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
