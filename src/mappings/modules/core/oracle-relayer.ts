import { log, dataSource, BigInt, Address } from '@graphprotocol/graph-ts'

import * as bytes from '../../../utils/bytes'
import * as decimal from '../../../utils/decimal'

import {
  UpdateCollateralPrice,
  UpdateRedemptionPrice,
  ModifyParameters as ModifyParametersCollateralTypeAddress,
  ModifyParameters1 as ModifyParametersUint,
  ModifyParameters2 as ModifyParametersCollateralTypeUint,
  OracleRelayer,
  AddAuthorization,
  RemoveAuthorization,
} from '../../../../generated/OracleRelayer/OracleRelayer'

import { RateSetter } from '../../../../generated/OracleRelayer/RateSetter'

import {
  CollateralType,
  CollateralPrice,
  RedemptionPrice,
  RedemptionRate,
} from '../../../../generated/schema'
import { getSystemState } from '../../../entities'
import { getOrCreateCollateral } from '../../../entities/collateral'
import { eventUid } from '../../../utils/ethereum'
import { addressMap } from '../../../utils/addresses'
import { SECOND_PER_YEAR } from '../../../utils/integer'
import { addAuthorization, removeAuthorization } from '../governance/authorizations'

export function handleUpdateCollateralPrice(event: UpdateCollateralPrice): void {
  let collateralType = event.params.collateralType.toString()
  let collateralPrice = decimal.fromWad(event.params.priceFeedValue)

  let collateral = CollateralType.load(collateralType)

  if (collateral != null) {
    let price = new CollateralPrice(eventUid(event))
    price.block = event.block.number
    price.collateral = collateral.id
    price.safetyPrice = decimal.fromRay(event.params.safetyPrice)
    price.liquidationPrice = decimal.fromRay(event.params.liquidationPrice)
    price.timestamp = event.block.timestamp
    price.value = collateralPrice
    price.save()

    collateral.currentPrice = price.id
    collateral.save()
  }
}

export function handleUpdateRedemptionPrice(event: UpdateRedemptionPrice): void {
  let price = new RedemptionPrice(eventUid(event))
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

export function handleModifyParametersCollateralTypeAddress(
  event: ModifyParametersCollateralTypeAddress,
): void {
  let what = event.params.parameter.toString()

  if (what == 'orcl') {
    let collateral = getOrCreateCollateral(event.params.collateralType, event)

    collateral.fsmAddress = event.params.addr
    collateral.modifiedAt = event.block.timestamp
    collateral.modifiedAtBlock = event.block.number
    collateral.modifiedAtTransaction = event.transaction.hash

    collateral.save()
  }
}

export function handleModifyParametersCollateralTypeUint(
  event: ModifyParametersCollateralTypeUint,
): void {
  let what = event.params.parameter.toString()
  let collateralType = CollateralType.load(event.params.collateralType.toString())

  if (collateralType != null) {
    if (what == 'safetyCRatio') {
      collateralType.safetyCRatio = decimal.fromRay(event.params.data)
    } else if (what == 'liquidationCRatio') {
      collateralType.liquidationCRatio = decimal.fromRay(event.params.data)
    }
  
    collateralType.save()
  }
}

export function handleModifyParametersUint(event: ModifyParametersUint): void {
  let what = event.params.parameter.toString()

  if (what == 'redemptionPrice') {
    log.error('ModifyParameters-redemptionPrice is not supported', [])
  } else if (what == 'redemptionRate') {
    let system = getSystemState(event)
    let rate = new RedemptionRate(eventUid(event))

    let perSecondRate = decimal.fromRay(event.params.data)
    let perSecondRateRay = event.params.data
    rate.perSecondRate = perSecondRate

    // Calculate solidity annualized rate by calling the contract

    const rpowerRate = (rate: BigInt, nSeconds: i32): decimal.BigDecimal => {
      // Exponentiate in web assembly, it's not exactly like Solidity but more than accurate enough
      return decimal.fromNumber(parseFloat(decimal.fromRay(rate).toString()) ** nSeconds)
    }

    rate.annualizedRate = rpowerRate(perSecondRateRay, 31536000)
    rate.eightHourlyRate = rpowerRate(perSecondRateRay, 3600 * 8)
    rate.twentyFourHourlyRate = rpowerRate(perSecondRateRay, 3600 * 24)
    rate.hourlyRate = rpowerRate(perSecondRateRay, 3600)

    rate.createdAt = event.block.timestamp
    rate.createdAtBlock = event.block.number
    rate.createdAtTransaction = event.transaction.hash

    system.currentRedemptionRate = rate.id

    rate.save()
    system.save()
  }
}

export function handleAddAuthorization(event: AddAuthorization): void {
  addAuthorization(event.params.account, event)
}

export function handleRemoveAuthorization(event: RemoveAuthorization): void {
  removeAuthorization(event.params.account, event)
}
